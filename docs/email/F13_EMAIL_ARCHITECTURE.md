# F13 — Email architecture

Date: 2026-11-06 · Code: `web/src/lib/email/` · Status: [implementation report](F13_IMPLEMENTATION_REPORT.md)

## 1. Overview

```
Sign-up / resend / forgot / reset (services/auth/service.ts)
   │  1 MongoDB insert, no provider call (F12 answer times unchanged)
   ▼
emailJobs (MongoDB, explivio) ── pending ──► worker claims (atomic, 60 s lease)
                                                │ 1. account still active? (verify: not yet verified?)
                                                │ 2. reserve a slot of today's 90 (rateLimits, atomic)
                                                │ 3. create the link token NOW (only its hash stored)
                                                │ 4. render template (HTML + text)
                                                │ 5. mark submittingAt, then send with Idempotency-Key
                                                ▼
                                   provider: outbox (default) │ resend │ test
                                                ▼
                    accepted │ rejected (retry_wait / failed) │ unknown (never resent)
```

- **Providers:** `EMAIL_TRANSPORT` chooses `outbox` (the default; files in `data/outbox/`), `resend` (the real API) or `test` (in memory). A broken `resend` setup never falls back to the outbox; it refuses, with a startup warning.
- **Worker locations:** inside the Next.js server (started by `instrumentation.ts`; polls every 5 s and runs as soon as a job is queued) and as `npm run email:worker [-- --once]`. Both can run at the same time safely.

## 2. Queue lifecycle (`emailJobs`)

| Status | Meaning | Next |
|---|---|---|
| `pending` | Queued by a request | Claimed by a worker |
| `processing` | Leased by one worker for 60 s | Any final status, `retry_wait`, or reclaimed after the lease expires |
| `retry_wait` | A definite temporary refusal (rate limit, connection never opened), the app's daily cap, or the provider's daily quota | Due again at `nextAttemptAt` (backoff 1 min, 5 min, 30 min, 2 h; quota waits run to UTC midnight plus 1 min) |
| `accepted` | The provider took the message (**not** proof it reached the inbox) | Final |
| `failed` | A permanent refusal (validation, testing-domain recipient, keys), 5 submissions used, older than 48 h, or no recipient | Final; the user can ask again |
| `unknown` | Timeout, ambiguous server error, or a crash **after** submitting | Final; **never resent automatically** (avoids duplicates) |
| `skipped` | Account disabled, or already verified (verification jobs) | Final |

**Rules:**
- A worker changes a job only while it holds the lease (`leaseOwner`).
- When a job ends, its `to` and `name` are set to null, and it's deleted 7 days later (TTL on `expireAt`).
- Indexes: `{status, nextAttemptAt}`, `{status, leaseExpiresAt}`, and TTL on `{expireAt}`.

## 3. Tokens: none in the queue

The worker creates the link token at send time (`createPendingEmailToken`), storing only its SHA-256 hash in `emailTokens` like every other token. After the provider answers, `settleEmailToken`:

| Outcome | Effect |
|---|---|
| Accepted | This becomes the only working link of its kind (older unused ones are retired) |
| Rejected | The never-delivered token is deleted; older links keep working |
| Unknown | Nothing changes; both may be valid until they expire |

Because the token is created at send time, a job that waits for the next UTC day still sends a fresh 24 h or 30 min link.

## 4. Daily guard (free plan)

- **Free plan:** Resend Free allows 100 emails a day and 3,000 a month (verified on resend.com on 2026-11-05). There's no overage billing: over a limit, sends are refused with HTTP 429.
- **App cap:** `EXPLIVIO_EMAIL_DAILY_LIMIT` (default **90**) per UTC day, held in one `rateLimits` document per day (`emailday:YYYY-MM-DD`, removed by the TTL index).
- **Reservation:** a slot is reserved atomically before each submission (an increment only while below the cap), so parallel workers can't overshoot. Tested with 3 workers, and with 10 simultaneous reservations on a new day.
- **Release:** a slot is released only on a definite refusal. An `unknown` outcome keeps its slot.
- **Provider quota:** Resend's `daily_quota_exceeded` closes the day for the app; `monthly_quota_exceeded` fails the job. Nothing upgrades, bills or switches provider.
- **Per-account limits:** the F12 limits still apply when a job is queued (3 emails an hour per account, 60 s resend cooldown, per-address and global sign-up limits).

## 5. Resend provider

| Aspect | Behaviour |
|---|---|
| Request | `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, `User-Agent: explivio/1.0`, `Idempotency-Key: <jobId>:<submission>` (Resend honours it for 24 h), and `from`, `to`, `subject`, `html`, `text`. Times out after 10 s |
| 2xx with an `id` | `accepted` |
| 2xx without an `id`, or not JSON | `unknown` |
| 429 `rate_limit_exceeded` | One identical retry after `Retry-After` (capped at 5 s); a second 429 is a retryable refusal |
| 5xx | One identical retry; a second 5xx is `unknown` |
| 429 daily or monthly quota | Refusal, flagged as a quota error |
| Other 4xx | Permanent refusal (includes the testing-domain error: *"You can only send testing emails to your own email address"*) |
| Timeout, or connection lost after sending | `unknown` |
| Connection never opened (`ECONNREFUSED`, DNS) | Retryable refusal |

The key appears only in the Authorization header: never in results, errors or logs.

## 6. Templates

- **Emails:** verification (24 h link), reset (30 min link), password changed (new in F13), and the existing-account notice.
- **Format:** responsive HTML (a single 560 px card, table layout, inline styles, a pre-header, a fallback link) plus the same words in plain text.
- **Not included:** images, tracking, marketing, passwords, session ids or internal details.
- **Escaping:** every outside value is HTML-escaped. Names are reduced to one line without control characters.
- **Headers:** subjects are fixed strings, so nothing a user types can reach a header. `EMAIL_FROM` with a line break is refused at startup.
- **Links:** built only from `EXPLIVIO_APP_URL`, never from the request's Host header, and the renderer refuses non-http(s) links.

## 7. Response timing (F12) and failure handling

- **Timing:** requests only insert a job, so provider latency never shows in response times. Measured after F13: sign-up 1511 vs 1506 ms (new vs taken email), forgot 1207 vs 1210 ms (known vs unknown).
- **Queue failure:** if queuing fails (database down), the action shows the generic "temporarily unavailable" message, never "sent".
- **Password-reset confirmation:** queued best-effort; a failure there never undoes the reset.
- **Delivery failure:** never marks an account verified, never uses up a delivered link, and never reveals whether an account exists (the answers stay neutral).

## 8. Security log events

`email_queued`, `email_accepted`, `email_rejected`, `email_unknown`, `email_deferred` and `email_skipped`. Each records the user id and a reason code only: no address, token or key.

## 9. Webhooks (postponed to F14)

Resend can report delivered, bounced and complained messages through signed webhooks (the free plan allows one endpoint). This needs a public HTTPS address, which the local app doesn't have.

**F14 design:**
- a `/api/webhooks/resend` route that verifies Resend's signature with the raw request body and rejects replays by timestamp and event id;
- idempotent updates of `emailJobs` by `providerMessageId` (fields such as `deliveredAt` and `bouncedAt`);
- no payload or recipient data stored.

## 10. Deployment note (F14)

The in-server worker relies on a long-running Node process, which is how Explivio runs today. On a serverless host it wouldn't keep running. F14 must provide either a separate always-on worker (`npm run email:worker`) or a scheduled call that runs one pass. The queue itself needs no change: jobs wait safely in MongoDB until a worker runs.
