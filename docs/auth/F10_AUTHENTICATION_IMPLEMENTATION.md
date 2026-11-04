# F10 — Authentication implementation

Date: 2026-11-04 · Branch: `dev` · Commits: `34cb666` (core), `d2dce3e` (screens, protection, ownership) · Spend: **$0**

Design and reasoning: [F10_AUTHENTICATION_ARCHITECTURE.md](F10_AUTHENTICATION_ARCHITECTURE.md). Database setup: [F10_DATABASE_FOUNDATION_REPORT.md](F10_DATABASE_FOUNDATION_REPORT.md).

## 1. Approach and why

**Self-managed authentication** in the existing Next.js server, with everything stored in the **same MongoDB Atlas database** (`explivio`).

Why:
- It's $0, with no third-party auth account.
- It uses one database, as you required.
- It keeps the approved Stitch screens, including link-based verification.
- It follows the design doc's `users` / `ownerUserId` model.

The comparison with Clerk and Supabase is in the architecture doc §9.

## 2. Provider limitations

- **Email:** MongoDB doesn't send email, and no free sender works without a domain you own. Messages are saved to a **development outbox** (`data/outbox/`, gitignored), and the screens say *"No email was sent"*. Real delivery needs `EMAIL_TRANSPORT=resend` plus a Resend key and a **verified domain**.
- **Atlas free tier:** 0.5 GB, 100 ops/s, 500 connections; paused after 30 days with no connections.

## 3. Database changes (collections from `npm run db:init`)

| Collection | Written by | Notes |
|---|---|---|
| `users` | sign-up, verify, reset | Unique `emailNormalized`; `$jsonSchema` requires an scrypt `passwordHash` |
| `sessions` | sign-in | `_id` = SHA-256 of the cookie token; TTL on `expiresAt` |
| `emailTokens` | sign-up, resend, forgot | `_id` = SHA-256 of the link token; single use via an atomic update; TTL |
| `videoProjects` | video creation | `_id` = run id, `ownerUserId`, `storage.runId`; the files stay in `runs/` |
| `generationAttempts` | video creation | One per run; status kept in step on reads |
| `userSettings` | Settings page | The F7 preferences, validated on write |

## 4. Endpoints and server actions

| Kind | Name | Auth |
|---|---|---|
| Server actions (`features/authentication/actions.ts`) | `signUpAction`, `verifyEmailAction`, `resendVerificationAction`, `signInAction`, `signOutAction`, `requestPasswordResetAction`, `checkResetLinkAction`, `resetPasswordAction` | Public; rate-limited; Next.js checks Origin |
| Server actions (`features/settings/actions.ts`) | `loadPreferencesAction`, `savePreferencesAction` | Session user only |
| Server actions (video) | `generateVideo`, `retryGeneration`, `regenerateVideo` | Session user only; owner checks |
| Route | `GET /api/videos/[id]` | 401 when signed out; 404 when not the owner |
| Route | `GET /api/videos/[id]/file` | 401 / 404 the same way; Range support kept |
| Route | `GET /api/health/db` | Public; status and latency only |

## 5. Flows, sessions, verification, recovery

- **Sign-up:**
  - The server validates with the same rules as the form.
  - A duplicate email gives the *same* answer and creates no account; the existing owner is notified instead.
  - New accounts start unverified, and a verification link (24 h) goes to the outbox.
- **Verify:** `/verify-email?token=…` is confirmed **from the browser**, so link-preview scanners can't use the token. The link is single use and expires, and a newer link retires older ones. Resend uses a signed "awaiting verification" cookie (1 day) and has a 60 s cooldown.
- **Sign-in:**
  - The password check uses a dummy hash for unknown emails, so timing reveals nothing.
  - "Unverified" is only revealed after a correct password.
  - It returns to a validated same-site `?next=`.
- **Sessions:**
  - A 256-bit token in the `explivio_session` cookie: HttpOnly, SameSite=Lax, Secure (allowed on localhost).
  - Lasts 7 days, or 30 days with "Remember me" (without it, the cookie ends with the browser).
  - The database keeps only the token's hash, and the dashboard layout re-checks the session on every request.
- **Recovery:** forgot-password always gives the same answer and creates a 30-minute single-use link. A reset changes the hash, uses up the link and **deletes every session** of that account.
- **Logout:** deletes the session record and clears the cookie.

## 6. Route protection

| Layer | What it does |
|---|---|
| `src/proxy.ts` | No session cookie: pages redirect to `/login?next=…` and `/api/*` returns 401 (except `/api/health/`) |
| `(dashboard)/layout.tsx` | `requireUser()` validates the session in the database; a forged or expired cookie redirects to sign-in |
| Data access and actions | Every list, get, file, retry and regenerate call passes the session user's id; there's no other way in |
| `(auth)/layout.tsx` | A signed-in visitor is sent to `/` |

## 7. User data ownership

- **Recording the owner:** the owner comes from the session, never from the client. It's written to MongoDB **before** the render starts; if that fails, the run folder is removed and nothing renders.
- **Requests for someone else's data:** another user's run id behaves exactly like an unknown id (404, not 403).
- **Video detail page:** it no longer prerenders run ids or titles into static HTML.
- **Settings:** per account, in `userSettings`.
- **Existing videos:** they're invisible until the **legacy-ownership migration** assigns them to your account (§13).

## 8. Security controls

| Area | How it's covered |
|---|---|
| Passwords | scrypt N=2^15, r=8, p=1 |
| Tokens | Hashed, single use, expiring |
| Cookies | HttpOnly, SameSite, Secure |
| Account enumeration | Neutral answers |
| Rate limits | Sign-in 5 per 15 min per account+IP and 20 per IP; sign-up 5/h per IP; emails 3/h per account with a 60 s cooldown; reset 10/h per IP |
| Redirects | Open redirects blocked |
| CSRF | Server actions only, with Origin checks |
| Secrets | Never sent to the browser; errors redacted |

## 9. Environment variables (names only, all in `web/.env.local`)

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | Atlas connection (secret) |
| `MONGODB_DB` | No (`explivio`) | Database name |
| `AUTH_SECRET` | No | Signs the "awaiting verification" cookie. If unset, a random secret is generated once into `data/auth-secret` (gitignored) |
| `EXPLIVIO_APP_URL` | No (`http://localhost:3000`) | Base URL used in email links |
| `EMAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM` | No | Real email (needs a verified domain) |
| `EXPLIVIO_LEGACY_OWNER_EMAIL` | Only for the migration | Account that receives the existing videos |

## 10. Local development

1. `cd web`, then `npm run db:check` (should print `MongoDB: ok`), then `npm run db:init` (safe to re-run).
2. `npm run dev`, then open http://localhost:3000. You'll be sent to **/login**.
3. **Create account**, then open the newest file in `data/outbox/` (repo root). Copy the `…/verify-email?token=…` link into the browser, then sign in.
4. Forgot password works the same way (`…/reset-password?token=…` in the outbox).

## 11. Testing

| Suite | Result |
|---|---|
| `web: npm test` (with `MONGODB_URI_TEST` = the Atlas URI) | **56/56** pass: auth service 14 (5 offline + 9 live), pipeline service with cross-user ownership 13, Mongo foundation 13, library 9, preferences 8. Live tests use throwaway `explivio_test_*` databases, which they drop |
| Browser end-to-end (production build, real Atlas `explivio_e2e` DB, stub pipeline, two accounts) | **70/70** pass |
| Pipeline tests (`npm test` at the root) | 63/63 |
| Typecheck, lint, production build | Pass |

The 70 browser checks cover:
- sign-up, verification (valid, reused, invalid), unverified login;
- `next` return, cookie flags, refresh, auth-page redirect;
- per-account settings, generate and download;
- cross-user isolation (status, file, `?download=1`, page, progress screen, settings);
- duplicate sign-up, open redirect, brute force;
- reset (honest outbox note, session revocation, reuse, old and new password);
- logout with server-side token invalidation;
- the five screens at 1440, 1280, 768, 390 and 360 px (no overflow, 44 px targets);
- no console errors.

## 12. Known limitations

1. Real email needs a domain (development outbox until then).
2. Rate limits live in memory, so they reset on restart (single server process).
3. The F6, F7 and F9 browser suites predate sign-in and haven't been re-run with a login step. Their behaviour (library, settings, journey) was re-checked inside the F10 end-to-end run, but not every original case was.
4. The Atlas database user still has `atlasAdmin`; reduce it to `readWrite` on `explivio`.
5. "Remember me" on a shared computer keeps you signed in for 30 days (standard; sign out to end it).

## 13. Existing videos: migration (needs your approval)

1. Sign up with your own email and verify it (outbox link).
2. Add `EXPLIVIO_LEGACY_OWNER_EMAIL=<that email>` to `web/.env.local`.
3. `npm run db:legacy-ownership` is a **dry run** that shows how many runs it would assign (20 today).
4. After you approve: `npm run db:legacy-ownership -- --apply`. It inserts ownership records only, never moves files, and is safe to re-run.

## 14. Future migration

`users.authProvider` / `authSubject` let a managed provider (for example Clerk, once there's a domain) map its subject ids to the existing `usr_` ids, so `ownerUserId` on videos never changes. Rate limits could move to a MongoDB TTL collection if the app ever runs on more than one instance.
