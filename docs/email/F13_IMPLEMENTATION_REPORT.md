# F13 — Email implementation report

Date: 2026-11-06 · Branch: `dev` · Code commit: `907db56` (plus the docs commit) · Spend: **$0**

## Status

| Item | Status |
|---|---|
| Email service, durable queue, worker, providers, templates | ✅ Implemented |
| Tested with mocks or the outbox | ✅ 8 offline tests (real provider code against a fake Resend endpoint); 9 live-Atlas queue tests; auth and security suites through the queue; browser regression 34/34 (outbox through the in-server worker) |
| Tested against real Resend | ⏳ **Pending your action** (approved: at most 3 emails to your own Resend address; steps in [setup guide §6](F13_SETUP_GUIDE.md)) |
| Verified in your Gmail inbox | ⏳ Pending the step above |
| Delivery to other users | ⏳ **Pending a verified domain.** You have none, and none is bought. Resend's testing domain only delivers to your account address |
| Production worker hosting, delivery webhooks | ⏳ F14 |

## Inspection versus the earlier findings
All confirmed. Corrections:
- the old Resend call had a 15 s timeout, no User-Agent and no idempotency key;
- it was awaited inside the request, which would have broken the F12 timing protection.

## Files

| File | Change |
|---|---|
| `web/src/lib/email/types.ts`, `config.ts`, `templates.ts`, `provider.ts` | New: types; `EMAIL_TRANSPORT` selection; templates; provider choice |
| `web/src/lib/email/providers/{outbox,resend,test}.ts` | New providers (the outbox file format is unchanged) |
| `web/src/lib/email/queue.ts`, `worker.ts`, `quota.ts` | New: queue insert, worker (lease, retries, recovery), daily guard |
| `web/src/lib/auth/email.ts` | Now a thin compatibility layer (`emailMode`, `appUrl`, `outboxDir`) |
| `web/src/services/auth/service.ts` | Every send became a queued job; `createPendingEmailToken` / `settleEmailToken`; password-changed confirmation; old `issueToken` removed |
| `web/src/lib/db/collections.ts` | `emailJobs` and 3 indexes (`npm run db:init` applied to `explivio`; additive) |
| `web/src/lib/security/log.ts` | 6 email events; reason codes may include digits |
| `web/src/instrumentation.ts` | Email-config warning; starts the worker (`EXPLIVIO_EMAIL_WORKER=off` disables it) |
| `web/scripts/email-worker.mts`, `package.json` | `npm run email:worker [-- --once]` |
| `web/.env.example` | Email placeholders |
| `web/tests/email.test.ts`, `email-queue.test.ts` (new); `auth-service.test.ts`, `security.test.ts` | Run the worker before reading the outbox |

**Dependencies added: none.** Resend is called directly over HTTPS.

## Test results (2026-11-06)

| Suite | Result | Kind |
|---|---|---|
| Web `npm test` with live Atlas | **102/102** | Live Atlas (throwaway databases) plus offline |
| Web `npm test` offline | 76 pass, 26 skipped (live-only), 0 fail | Offline |
| … `email.test.ts` | 8/8: configuration, template escaping and header injection, outbox; Resend: accepted with the right headers and body; rate-limit retry with an identical body and key honouring Retry-After; quota, validation and auth never retried; 5xx, malformed, timeout → unknown; unreachable → retryable | Real provider code against a **fake** endpoint |
| … `email-queue.test.ts` | 9/9, stable over 3 runs | Live Atlas plus the in-memory provider |
| … F12 timing (`security.test.ts`) | Sign-up 1511 vs 1506 ms; forgot 1207 vs 1210 ms (raw cost without the floors: 599 vs 440 ms) | Live Atlas |
| Browser regression | **34/34** | Production build, real Atlas, **real R2**, outbox through the in-server worker, stub pipeline |
| Pipeline (root) | 63/63 | — |
| `r2:check` | 10/10 | Real R2 |
| Typecheck, lint, production build | Pass | — |

The 9 queue tests cover:
- a job carries no token; the link uses the configured URL and verifies the account; the address is erased after sending;
- 3 workers: each of 6 jobs sent exactly once;
- lease expiry: before submitting → resent; after submitting → `unknown`, never resent;
- a refusal deletes the unsent link while the delivered link keeps working; backoff of 1 min; at most 5 submissions;
- `unknown` is never resent and both links stay valid;
- the daily guard stops at the limit with parallel workers, the next UTC day works, refusals return slots, and a provider quota closes the day;
- a race of 10 simultaneous reservations on a new day: exactly 3 succeed;
- already-verified jobs are skipped; jobs older than 48 h fail;
- a reset queues the password-changed email; no token or address in jobs or logs.

The browser regression covered:
- sign-up → the in-server worker delivered the verification email about 2 s after the click; verify; single use;
- forgot → reset email; reset → password-changed email, with no token in it;
- the queue states; a job inserted directly into MongoDB was picked up by the 5 s poll in 3.8 s;
- regression checks for settings, R2 generation, playback, seeking and download, Try again, My Videos, isolation and overflow;
- no console or page errors, and no secrets or errors in the server log.

**Found during testing:**
1. **Daily-guard test failures (test bugs):** two tests were wrong:
   - a fixed future date made the jobs look older than 48 h;
   - a timestamp was taken before the jobs were queued.

   While investigating, I suspected a race when several workers create a new day's counter at once, and added a re-check-and-retry. **Measured: the original code also passes the 10-way race**, because MongoDB retries those inserts itself. The re-check stays only as harmless extra protection, not as a confirmed bug fix.
2. **A real-world classification check:** port 1 is a fetch "bad port", not a refused connection. The test now uses a genuinely closed port, which gives `ECONNREFUSED` and is classified correctly.

## Free plan and cost
- **Resend Free, checked on the official pages on 2026-11-05:** $0; 100 emails a day (UTC); 3,000 a month; 10 requests a second; no overage billing (over a limit, sends are refused with 429).
- **App:** at most 90 a day, plus the F12 per-account limits.
- **Real emails sent so far: 0.**

## Remaining limitations
1. **Other recipients:** nobody except your Resend account address can receive email until you verify a domain you own.
2. **Real Resend test:** pending (approved, at most 3 emails).
3. **Worker hosting:** the worker needs a long-running process; serverless hosting needs a separate worker or a scheduled call (F14).
4. **Delivery confirmation:** no delivered or bounced status until webhooks arrive in F14. "Accepted" is not proof of delivery.
5. **`unknown` outcomes:** never retried by design; the user can ask again, within the F12 limits.
