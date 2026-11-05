# F12 — Security implementation report

Date: 2026-11-05 · Branch: `dev` · Commits: `2cdf66f` (audit, `.gitignore`), `7cde3d7` (account security), `d5d98c0` (generation limit, logging, headers), plus this documentation commit · Spend: **$0**

Audit: [F12_SECURITY_AUDIT.md](F12_SECURITY_AUDIT.md) · Evidence: [F12_SECURITY_TEST_MATRIX.md](F12_SECURITY_TEST_MATRIX.md)

## 1. Summary

| Finding | Severity | Status |
|---|---|---|
| F1: sign-in limit bypassed by a forged `X-Forwarded-For` | High | ✅ **Fixed.** Reproduced on the old code (12 forged addresses, then the right password signed in); now locked after 10 failures from any address. Tested in service tests, the old-vs-new reproduction and the browser end-to-end replay of the real action |
| F2: sign-up timing reveals registered emails | Medium | ✅ **Fixed.** Measured leak 537 vs 298 ms → 1506 vs 1507 ms |
| F3: forgot-password timing reveals registered emails | Medium | ✅ **Fixed.** 1208 vs 1209 ms |
| F4: rate limits only in memory | Medium | ✅ **Fixed.** Durable MongoDB counters; atomic under 25 concurrent attempts |
| F5: no per-user generation limit | Medium | ✅ **Fixed.** 10 per 24 h; checked in the UI, by service tests and by a server-action replay |
| F6: no security log | Medium | ✅ **Fixed.** 18 event types; secret-free (checked in tests and in the real server log) |
| F7: no anti-framing or hardening headers | Low–Medium | ✅ **Fixed.** Checked on page and API responses |
| F8: re-sign-in left the old session valid | Low | ✅ **Fixed.** Old token returns 401 after a new sign-in |
| F9: no server-side password maximum | Low | ✅ **Fixed.** 256 characters |
| F10: keys file not ignored | Low | ✅ **Fixed.** `/CloudFareConfKeys.txt` is in `.gitignore`; it was never committed |
| F11: no idle timeout | Low | Accepted (absolute expiry plus revocation); documented |

No other vulnerability was found. Every protection listed in the audit §3 was kept and re-tested.

## 2. Changes

| Area | Change | Files |
|---|---|---|
| Rate limiting | `RateLimitStore` (MongoDB by default, memory for tests). An atomic pipeline upsert counts each attempt; keys are stored as SHA-256 hashes (no emails or addresses in the database); a TTL index on `resetAt` cleans up. **Sign-in: 10 failures per 15 min per account, from any address.** Per-address sign-in 20 per 15 min (best effort). Sign-up 5/h per address plus **100/h globally**. A password reset clears the account's lockout | `lib/auth/rate-limit.ts`, `lib/db/collections.ts` (`rateLimits` + `expiry_ttl`) |
| Enumeration | Sign-up hashes the password before looking up the email. Sign-up, forgot and resend answer no sooner than **1.5 s, 1.2 s and 1.2 s** (the slowest measured paths against Atlas were 1.51 s and 1.21 s, so the floors hold) | `services/auth/service.ts` |
| Sessions | A successful sign-in deletes the session the browser already held (`signOut(previous, "replaced")`). `signOut` uses `findOneAndDelete` and logs the user id | `features/authentication/actions.ts`, `service.ts` |
| Passwords | `MAX_PASSWORD_LENGTH = 256`: refused on sign-up and reset (the reset link isn't used up); simply wrong on sign-in (counted as a failure; no scrypt work) | `service.ts` |
| Client address | Bounded and validated (`invalid` if it isn't an IP-looking value); used only for best-effort per-address limits and hashed logs | `lib/auth/session.ts` |
| Generation | `countGenerationsSince` on `generationAttempts` (existing `owner_newest` index; no new collection), checked inside the render lock. `GenerationLimitError` gives a clear message in Generate, Try again and Regenerate. Upload-only retries don't count. Set with `EXPLIVIO_DAILY_GENERATIONS` (default 10) | `services/pipeline/{videos,ownership}.ts`, video actions, `services/*` |
| Logging | `securityEvent()`: JSON lines `[security] {ts, event, userId?, ip?, videoId?, reason?, count?}`. Fields are allow-listed and validated; IPs are HMAC-hashed (`anonymize`). Logged on sign-in, sign-up, verify, resend, reset, sign-out and session replacement, plus denied video and file requests, refused retry or regenerate, and generation limits | `lib/security/log.ts`, `lib/auth/crypto.ts`, routes, actions, `service.ts` |
| Headers | `X-Frame-Options: DENY`; `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy`; `Cross-Origin-Opener-Policy: same-origin`; `X-Powered-By` removed | `next.config.ts` |
| Git | `/CloudFareConfKeys.txt` added to `.gitignore` (contents never opened) | `.gitignore` |
| Database | `npm run db:init` on `explivio`: created `rateLimits` with its TTL index (additive only; nothing else changed) | — |

## 3. Retained controls (re-verified)

- **Sessions:** 256-bit tokens stored only as SHA-256; server-side validation on every request; absolute expiry (7 or 30 days) plus TTL; deleted at sign-out; reset revokes all sessions; disabled or unverified accounts are refused.
- **Cookies:** `HttpOnly; Secure; SameSite=Lax; Path=/`, with no `Domain` (checked on the real `Set-Cookie`).
- **CSRF:** the Next.js Origin/Host check on every server action (a cross-origin replay was refused with HTTP 500 and nothing changed) plus `SameSite=Lax`. No CSRF tokens were added; they would be redundant.
- **Ownership:** enforced in MongoDB by `ownerUserId` (404 for others). Owner ids always come from the session; replayed actions carrying another user's video id start nothing.
- **R2:** private bucket; keys come from server metadata; the signed link (5 min) is made only for the owner; ranged playback and seeking work (re-checked against real R2).

## 4. Test results (2026-11-05)

| Suite | Result | Kind |
|---|---|---|
| Web `npm test` with `MONGODB_URI_TEST` | **85/85** | Live Atlas (throwaway databases) plus offline |
| Web `npm test` offline | 68 pass, 17 skipped (live-only), 0 fail | Offline |
| … `security.test.ts` | 8/8 | 2 offline + 6 live Atlas |
| … `auth-service.test.ts` | 14/14 (F1 regression included) | 5 offline + 9 live |
| … `pipeline-service.test.ts` | 23/23 (generation limit included) | Memory stores, stub CLI |
| F1 old-vs-new reproduction | Old code: **signed in after 12 forged-address guesses**. New: `rate_limited` | Live Atlas |
| Browser end-to-end | **36/36** | Production build, real Atlas (`explivio_e2e`, dropped), real R2 (test objects deleted), stub pipeline |
| `npm run r2:check` | 10/10 | Real R2 |
| Pipeline (root) | 63/63 | — |
| Typecheck, lint, production build | Pass | — |

**Fixed during testing:** test bugs only, none in the app:
- one unit-test helper didn't wait for the right user's video;
- two end-to-end script issues: the script clicked before hydration had finished, and it opened the login page while already signed in, which the app correctly redirects away from.

## 5. Remaining risks and limitations

| Risk | Note |
|---|---|
| Lockout as a denial of service | Anyone who knows an email can lock that account for 15 min with 10 wrong guesses. A password reset lifts it. Accepted by you |
| Per-address limits can be forged | Next.js keeps a client-supplied `X-Forwarded-For`, and the socket address isn't available to server actions. Security relies on the per-account and global limits; a trusted proxy that overwrites the header comes with F14 hosting |
| Sign-up is globally capped | Over 100 sign-ups an hour, everyone waits, including real users. Acceptable at this stage |
| Response-time floors | Calibrated on this machine against Atlas (worst cases 1.51 s and 1.21 s against floors of 1.5 s and 1.2 s). A much slower database would need higher floors; the timing test checks this |
| No idle timeout, no "sign out everywhere" button | Reset revokes all sessions; a UI for it isn't needed yet |
| No HSTS or full script CSP | Wait for F14 (production HTTPS, nonces) |
| Logs go to stdout only | Kept for F14 monitoring; not persisted |
| No security emails | No email after a password change; that belongs to F13 (Gmail) |

## 6. Confirmations

- No Make My Marriage resources were accessed.
- `CloudFareConfKeys.txt` was never opened, and is now ignored.
- No secret was printed or committed (diffs scanned, logs checked).
- No paid service.
- Historical videos and `runs/` were untouched.
- Real user data was untouched: tests used throwaway databases. The only change to `explivio` was the additive `rateLimits` collection.
