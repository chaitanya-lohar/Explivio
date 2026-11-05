# F12 — Security audit (authentication, sessions, authorisation, R2)

Date: 2026-11-05 · Commit audited: `f1a35ab` (dev) · Method: code review of every auth, session, action, route and storage path, plus framework source checks (Next.js 16.4.3 `base-server.js`, `action-handler.js`). Nothing was changed before this report.

## 1. Architecture as implemented

```
Browser ── cookie explivio_session (256-bit random; HttpOnly, Secure, SameSite=Lax, Path=/) ──►
  proxy.ts            no cookie → /login (pages) or 401 (/api/*); NOT a session check (optimistic gate)
  (dashboard)/layout  requireUser() → userForSession(): sha256(token) → sessions → users(active, verified)
  server actions      settings / video-creation / video-generation: getCurrentUser() first; auth actions are public
  /api/videos/[id]    getCurrentUser → getVideo(id, user.id)        (ownership in MongoDB → 404 for others)
  /api/videos/[id]/file  getCurrentUser → getVideoSource(id, user.id) → local stream | R2 Range stream | 5-min signed link
MongoDB: users (scrypt), sessions (hash, TTL), emailTokens (hash, TTL, single use), videoProjects (owner, storage), userSettings
```

**Flows:**
- **Sign-up:** validate → limit (per IP) → existing? notify the owner : hash and insert, then issue a verification token → outbox. The same answer either way.
- **Verify:** an atomic `findOneAndUpdate` on `{hash, purpose, unused, unexpired}` → `emailVerified`.
- **Sign-in:** limits (per account+IP, per IP) → scrypt against the real or a dummy hash → active and verified → new session (7 or 30 days).
- **Sign-out:** the session record is deleted and the cookie cleared.
- **Reset:** a 30-minute single-use token → new hash, all tokens retired, **all sessions deleted**.

## 2. Findings

Classes:
- **CONFIRMED:** a confirmed vulnerability.
- **POTENTIAL:** a weakness to verify by test.
- **PROTECTED:** already protected.
- **N/A:** not applicable.

| # | Finding | Class | Severity | Evidence |
|---|---|---|---|---|
| F1 | **The sign-in brute-force limit can be bypassed with a forged `X-Forwarded-For`.** `clientIp()` trusts the first XFF value. Next.js only fills XFF when it's absent (`req.headers['x-forwarded-for'] ??= socket.remoteAddress`, base-server.js:601), so a client's value is kept. The per-account limit key is `login:acct:<email>:<ip>`, so changing the header per request gives **unlimited password guesses against one account**. The per-IP sign-in, sign-up and reset limits are bypassed the same way | CONFIRMED (framework source and code; to be reproduced by a failing test before the fix) | **High** | `lib/auth/session.ts` `clientIp`, `services/auth/service.ts:176` |
| F2 | **Sign-up timing reveals registered emails.** A new email runs scrypt (N=2^15) plus 3–4 database writes; an existing email does one lookup and writes a file. The difference is roughly 100 ms or more, which defeats the identical-answer design | POTENTIAL (code; to be measured) | Medium | `service.ts:103-126` |
| F3 | **Forgot-password timing reveals registered emails.** An existing account issues a token (2 database writes) plus an outbox write; an unknown one returns after one lookup | POTENTIAL (code; to be measured) | Medium | `service.ts:235-252` |
| F4 | **Rate limits live only in process memory.** They reset on every restart and aren't shared across instances (needed for F14). They are bounded (pruned above 10k keys) | CONFIRMED (design limitation) | Medium | `lib/auth/rate-limit.ts` |
| F5 | **No per-user generation limit.** Generation is one-at-a-time globally, but one account can queue renders back to back (Generate, Try again, Regenerate) and use up the shared Gemini and ElevenLabs free quotas for everyone | CONFIRMED | Medium | `video-creation/actions.ts`, `video-generation/actions.ts` |
| F6 | **No security event logging.** Failed sign-ins, lockouts, resets and authorisation denials leave no trace (only the error name on an unexpected auth error), so there's nothing to monitor in F14 | CONFIRMED | Medium | whole auth surface |
| F7 | **No clickjacking or browser hardening headers.** There's no `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`, so pages (including Generate and sign-out buttons) can be framed by another site | CONFIRMED | Low–Medium | `next.config.ts` |
| F8 | **Signing in again doesn't revoke the session the browser already had.** The old record stays valid until it expires. This isn't fixation, because tokens are only created at sign-in, but a previously leaked token survives a re-login | CONFIRMED | Low | `signInAction` |
| F9 | **No maximum password length on the server.** Inputs are capped only by the 1 MB server-action body. scrypt pre-hashes long input cheaply, so the risk is low | CONFIRMED | Low | `validation/index.ts` |
| F10 | **`CloudFareConfKeys.txt` sits untracked in the repo root and isn't ignored.** It has never been committed (checked with `git log --all`), but a future `git add .` would include it | CONFIRMED (process) | Low | `.gitignore` |
| F11 | **The session has no idle timeout.** It has an absolute expiry only (7 or 30 days); `lastSeenAt` is recorded but unused | CONFIRMED (design) | Low | `userForSession` |

## 3. Already protected (kept as is; regression-tested in F12)

| Area | Protection |
|---|---|
| Session ids | 256-bit `randomBytes`; only SHA-256 stored; validated server-side on every request; expiry enforced (with a TTL index); deleted at sign-out; all deleted at reset; disabled or unverified accounts are rejected even with a valid session |
| Session fixation | Not possible: no pre-auth session exists, and every sign-in issues a fresh token |
| Cookies | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`; Remember me sets an `Expires` equal to the server expiry, otherwise a browser-session cookie |
| Passwords | scrypt N=2^15, r=8, p=1, 16-byte random salt, `timingSafeEqual`, parameters stored per hash, NFKC normalisation |
| Email tokens | 256-bit, hashed, purpose-bound, 24 h / 30 min, single use via an atomic update, older links retired; a reset token can't act as a session (separate collection and purpose) |
| Enumeration (answers) | Sign-up, forgot and resend give identical answers; sign-in returns one generic error; "unverified" is only revealed after a correct password; a dummy hash is used for unknown emails |
| CSRF | Next.js checks Origin against Host on every server action (action-handler.js:436-456), and `SameSite=Lax` stops cross-site requests from carrying the session. There are no state-changing API routes (only GETs). Adding CSRF tokens would be redundant |
| Open redirect | `safeNextPath` (same-site paths only; auth pages and `//`, `\`, control characters rejected) |
| Authorisation | The user id always comes from the session. Every video read, file, retry and regenerate passes `ownerUserId`, and MongoDB `owns({_id, ownerUserId})` runs before any file, key or signed link. Others' resources answer **404**. Settings are keyed by the session user. Run ids are checked against a regex before any query or path |
| R2 | Private bucket. Keys are built from validated server ids and read from MongoDB, never taken from the client. A signed link (5 min) is made only after the owner check. Range streaming is bounded. Verified on real R2 in F11 (39/39) |
| Input and mass assignment | Actions coerce to strings or booleans (no MongoDB operator injection); `toVideoRequest` and `parsePreferences` allow-list fields and values; no client-supplied owner fields are accepted |
| Errors and logs | Auth errors become one generic message (only the error name is logged); pipeline errors are redacted (paths, keys); R2 errors are redacted; no tokens, passwords or links are logged |
| Body size | Server actions are capped at 1 MB by Next.js |

## 4. Not applicable

- **Password change while signed in:** there's no such feature (only reset).
- **Video deletion:** there's no such feature.
- **Admin roles and account disabling:** there's no admin feature. A disabled status already blocks sessions, and new roles aren't needed (no role was introduced).
- **Upload endpoints:** none; uploads are server-side only.

## 5. Recommended fixes (proposed F12 scope)

| Fix | For | Approach |
|---|---|---|
| A | F1 | Make the sign-in limit **per account, independent of IP** (10 failures per 15 min). Keep the per-IP limits as best effort. Add a **global sign-up backstop**. Trust `X-Forwarded-For` only when `EXPLIVIO_TRUST_PROXY=1` (F14, behind a proxy that overwrites it) |
| B | F4 | Move rate limits into **MongoDB**: a `rateLimits` collection with a TTL index, using atomic `$inc`. In-memory remains the fallback for tests |
| C | F2, F3 | **Equal work and a minimum response time:** sign-up always hashes the password; sign-up, forgot and resend answer no sooner than a fixed floor. Verified by a timing test |
| D | F5 | **Per-user generation limit** (for example 10 per 24 h, counted from `generationAttempts` with the existing `owner_newest` index; no new collection), with a clear message. Upload-only retries don't count |
| E | F6 | **Structured security log:** JSON lines `[security] {event, userId?, ipHash?, …}`. Never passwords, tokens, cookies, emails or keys; IPs are HMAC-hashed |
| F | F7 | **Security headers** in `next.config.ts`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. HSTS and a full CSP wait for F14 (HTTPS host, nonce setup) |
| G | F8 | Revoke the browser's previous session on a successful sign-in |
| H | F9 | Server-side cap: passwords over 256 characters are rejected on sign-up and reset, and treated as invalid on sign-in. The UI checklist is unchanged |
| I | F10 | An exact `.gitignore` entry for `CloudFareConfKeys.txt` (done with this report) |
| — | F11 | Idle timeout: **not proposed** (absolute expiry plus revocation is adequate for this product); documented |

## 6. Tests required

- Failing-first reproductions of F1 (rotating XFF) and F2/F3 (timing).
- Session lifecycle: expiry, revocation, sign-in rotation and revocation, reset revoking all sessions, concurrent sessions, Remember me lifetimes.
- Two-user isolation across both API routes and **all server actions** (including CSRF: bad Origin rejected).
- R2 denial cases (re-run from F11).
- Input cases: malformed ids, operator objects, oversized passwords, unexpected owner fields.
- Rate limits: sign-in, reset, resend, generation, and recovery after the window expires.
- Log scrubbing: no secrets in captured logs.
- Full regression: web suite (live Atlas), pipeline suite, typecheck, lint, build, browser end-to-end on real Atlas and R2.
