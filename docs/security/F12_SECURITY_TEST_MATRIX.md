# F12 — Security test matrix

Date: 2026-11-05. Results are as measured, not assumed.

**Kind:**
- **Unit:** offline, no services.
- **Mock:** in-memory stores and the stub pipeline.
- **Atlas:** a live throwaway MongoDB database.
- **E2E:** production build, headless Chrome, real Atlas (`explivio_e2e`), **real R2**, stub pipeline.

| # | Scenario | Expected | Actual | Result | Kind |
|---|---|---|---|---|---|
| **Authentication** | | | | | |
| 1 | Sign-up stores scrypt, sends a verification link to the outbox (not "sent") | Unverified account, hashed password | As expected | Pass | Atlas |
| 2 | Duplicate sign-up | No second account; same answer; owner notified | As expected | Pass | Atlas |
| 3 | Verification: valid, reused, invalid, expired; resend retires old links | ok / used / invalid / expired | As expected | Pass | Atlas |
| 4 | Sign-in through the real form | Session cookie set; dashboard opens | As expected | Pass | E2E |
| 5 | Wrong password vs unknown email | Identical answers | As expected | Pass | Atlas |
| 6 | Forgot then reset: single use, 30-min expiry, old password gone | As described | As expected | Pass | Atlas |
| 7 | **Sign-up timing**, registered vs new email | Equal | Raw 537 vs 298 ms (the leak) → **1506 vs 1507 ms** | Pass | Atlas |
| 8 | **Forgot timing**, known vs unknown | Equal | **1208 vs 1209 ms** | Pass | Atlas |
| 9 | Over-long password (over 256) | Refused on sign-up and reset (link kept); wrong on sign-in | As expected | Pass | Atlas |
| **Sessions** | | | | | |
| 10 | Valid session; forged, truncated, altered or over-long tokens | User / null | As expected | Pass | Atlas |
| 11 | Expiry: 7 days, Remember me 30 days, after expiry | null after expiry | As expected | Pass | Atlas |
| 12 | Sign-out (service and UI) deletes the record; token returns 401 | 401 | As expected | Pass | Atlas, E2E |
| 13 | Concurrent sessions on two devices are independent | Both valid | As expected | Pass | Atlas |
| 14 | **Re-sign-in revokes the browser's previous session** | Old token 401; new token valid | As expected | Pass | Atlas, E2E |
| 15 | Fixation: every sign-in issues a fresh token | New token differs | As expected | Pass | Atlas, E2E |
| 16 | Password reset revokes **all** sessions | All null | As expected | Pass | Atlas |
| 17 | Disabled account | Sessions stop at once; sign-in refused | As expected | Pass | Atlas |
| 18 | Cookie flags on the real response | HttpOnly, Secure, SameSite=Lax, Path=/, no Domain | As expected | Pass | E2E |
| **Authorisation and isolation (users A and B)** | | | | | |
| 19 | B gets A's video status, file, download | 404 / 404 / 404, no signed link | As expected | Pass | E2E, Mock |
| 20 | A gets B's video | 404 | As expected | Pass | E2E |
| 21 | B's library | Doesn't contain A's videos | As expected | Pass | E2E (F11), Mock |
| 22 | **Replayed retry action** with A's session on B's failed video | Refused; nothing started | "can't be retried"; 0 runs | Pass | E2E |
| 23 | **Replayed regenerate action** on the other user's video (both directions) | "couldn't find"; nothing started | As expected | Pass | E2E |
| 24 | Replayed settings action with B's session | Writes only B's settings | As expected | Pass | E2E |
| 25 | Settings validated; unknown fields dropped; no owner field accepted | As described | As expected | Pass | Atlas |
| **R2** | | | | | |
| 26 | Signed out: file and download | 401 | As expected | Pass | E2E |
| 27 | Cross-user playback and download | 404, no `Location` | As expected | Pass | E2E |
| 28 | Guessed or malformed ids (`..%2F..`, unknown, near-miss) | 404 | As expected | Pass | E2E (F11) |
| 29 | Object URL without a signature (guessed key) | Refused | HTTP 400 | Pass | E2E, `r2:check` |
| 30 | Expired signed link | 403 | As expected | Pass | `r2:check` |
| 31 | Missing object, invalid credentials | Absent / `StorageAuthError` | As expected | Pass | `r2:check` |
| 32 | Owner playback range, seek, signed download | 206 exact bytes; seek ok; 302 with a 300 s link and exact bytes | As expected | Pass | E2E |
| **CSRF and input** | | | | | |
| 33 | Server action from `Origin: https://evil.example` with A's session | Refused; no change | HTTP 500; settings unchanged | Pass | E2E |
| 34 | Action with no session | No change | As expected | Pass | E2E |
| 35 | Security headers on pages and API | DENY, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, COOP; no X-Powered-By | As expected | Pass | E2E |
| 36 | Object or operator payloads, wrong types | Coerced to strings; rejected | Covered by actions (`asString`); F10 tests | Pass | Atlas |
| **Rate limits** | | | | | |
| 37 | **F1: 10+ wrong passwords from changing forged addresses** (service) | Locked for every address | Old code: signed in. New: locked | Pass | Atlas |
| 38 | **F1 via the real sign-in action** with a different `X-Forwarded-For` each time | 10 × "incorrect", then "Too many…"; the right password is refused | As expected | Pass | E2E |
| 39 | Window expiry restores normal sign-in | Signs in after 16 min | As expected | Pass | Atlas, Unit |
| 40 | Durable limiter under 25 concurrent attempts | Exactly 10 succeed; hashed keys; TTL index | As expected | Pass | Atlas |
| 41 | Reset requests, resend cooldown, emails per account | Limited | As expected | Pass | Atlas |
| 42 | **Generation limit** (2 in the test, 10 by default): 3rd render, re-render retry | Refused with a clear message; nothing started; other users unaffected | As expected | Pass | Mock, E2E |
| 43 | Reset lifts an account lockout | Owner signs in right after resetting | As expected | Pass | Atlas |
| **Logging** | | | | | |
| 44 | Allow-list: invalid id, free-text reason and raw address are dropped or hashed | As described | As expected | Pass | Unit |
| 45 | Full lifecycle logs the expected events and no password, email, token or address | As described | As expected | Pass | Atlas |
| 46 | Real server log: events present; no passwords, emails, session tokens, R2 keys, addresses or signed links | As described | As expected | Pass | E2E |
| **Regression** | | | | | |
| 47 | Web suite (live) / pipeline / `r2:check` / typecheck / lint / build | All pass | 85/85, 63/63, 10/10, pass | Pass | Mixed |
| 48 | F11 upload → ready, playback, download (UI generation) | Works | As expected | Pass | E2E |

**Not tested:**
- An idle timeout and "sign out everywhere": not implemented, by decision.
- Browsers other than Chrome: F15.
- Behaviour behind a real reverse proxy: F14.
