# F10 — Authentication architecture (proposal)

Status: **proposed, awaiting approval** · Date: 2026-11-03 · Branch: `dev` · Budget: $0

## 1. Current architecture (inspected)

| Area | Today |
|---|---|
| Auth screens | `web/src/app/(auth)/`: login, signup, forgot-password, verify-email, reset-password. They're Stitch-built and complete (validation, strength meter, resend cooldown, masked address). They call server actions in `features/authentication/actions.ts`, which re-validate input and then call `services/mock/auth.ts`, a **demo that checks nothing, creates nothing and sends nothing** |
| Session | None. Every page is public; the sidebar shows a hard-coded "Alex Chen" (`services/mock/user.ts`) |
| Database | **None.** Videos are run folders (`runs/<id>/request.json` and `manifest.json`) read by `services/pipeline/videos.ts`. The design docs allow this for the prototype ("Use local run manifests … if the database is not yet needed") and list MongoDB only as *provisional* |
| Ownership | None. Every visitor sees every run; the status, file and retry/regenerate endpoints take any run id |
| Settings | Browser `localStorage` (F7), shared by everyone on the same browser |
| Middleware | None (Next.js 16 calls it `proxy`) |
| Env vars (web) | `EXPLIVIO_PIPELINE_ROOT`, `VIDEO_SERVICE`, both server-only. Pipeline keys live in the root `.env` |
| Design docs | The Database Design specifies `users` (`authProvider`, `authSubject`, `email`, `emailVerified`, `displayName`, `status`, timestamps), `ownerUserId` on every project, and owner checks "in the application service". The open decision is "managed auth if it fits; users collection stores profile, not credentials" |

## 2. Free-tier facts (official pages, fetched 2026-11-03)

| Provider | Fact | Source |
|---|---|---|
| Clerk Hobby (free) | 50,000 monthly *retained* users per app; passwords, email codes and links included; no SMS; "No credit card required"; custom email templates and custom password rules **not** included; fixed 7-day session | clerk.com/pricing |
| Clerk production | "You will need to have a domain you own" and must add DNS records | clerk.com/docs/deployments/overview |
| Clerk custom UI | "Custom flows" with `useSignUp` / `useSignIn` are supported but "considered advanced and generally not recommended". The email-password guide verifies with a **code** (links need a separate flow). Password reset isn't covered on that page | clerk.com/docs/custom-flows |
| Supabase Free | 50,000 MAU; 500 MB DB; **projects paused after 1 week of inactivity**; 2 free projects | supabase.com/pricing |
| Supabase built-in email | "2 emails per hour"; "will refuse to deliver messages to addresses that are not part of the project's team"; not for production. Custom SMTP required | supabase.com/docs/guides/auth/auth-smtp, /rate-limits |
| Resend Free | 3,000 emails/month, 100/day; "You must add and verify at least one domain to send emails" (a domain you own) | resend.com/pricing, /docs/dashboard/domains/introduction |
| Brevo | Pricing page didn't load; **unverified**, not relied on | — |

**What this means:** with no domain of our own, **no option delivers real verification or reset emails to arbitrary people at $0.** Clerk sends its own emails, but a production instance needs a domain. Supabase sends only to team members (2 per hour). Resend needs a verified domain. Whatever is chosen, real-world email delivery becomes possible only once a domain exists (a domain itself is not free) or once a free SMTP sender is configured. Until then the honest option is a **development outbox**, described in §5.

## 3. Options compared

| Criterion | **A. Self-managed (recommended)** | B. Clerk (free) | C. Supabase Auth (free) |
|---|---|---|---|
| Free tier | Yes, no account needed | Yes; needs a Clerk account and keys | Yes; needs a Supabase account; pauses after 7 days idle |
| Email verification | Yes: app-issued hashed, single-use, expiring **links** (matches the existing verify screen) | Yes, Clerk-delivered; custom flow uses **codes**, so the verify screen would change | Built-in mail only to team members; needs custom SMTP |
| Password reset | Yes, app-managed tokens | Yes (custom flow not documented on the fetched page) | Yes, same email limitation |
| Real email delivery at $0 without a domain | No (development outbox) | Development instance only (limits not documented); production needs a domain | No |
| Sessions | HttpOnly cookie, DB-backed, revocable | Clerk session JWT plus cookie, fixed 7 days on free | Supabase JWT; refresh-token handling in the app |
| Next.js 16 integration | Native (server actions, `proxy`, route handlers) | `@clerk/nextjs` SDK | `@supabase/ssr` SDK |
| Existing Stitch UI | Kept as is | Kept via custom flows (advanced, "not recommended"); the verify screen becomes code entry | Kept via SDK calls |
| User data and ownership | Our `users` table; `ownerUserId` on runs | Clerk user id as `authSubject`; profile mirrored | Supabase user id; profile in their DB or ours |
| Works offline, next to the local pipeline | Yes | No (calls Clerk on every auth) | No |
| New dependencies | **None** (Node built-ins: `node:sqlite`, `node:crypto`) | `@clerk/nextjs` | `@supabase/supabase-js`, `@supabase/ssr` |
| Lock-in | None. Fits the design doc's `authProvider` / `authSubject` model, so it can migrate to a managed provider later | Medium | Medium |
| Security burden on us | **Higher**: hashing, sessions, tokens, rate limits. Mitigated with standard primitives and tests | Low | Low–medium |

**Recommendation: A, self-managed.** It's the only option that works today at $0 with no account or keys. It keeps the existing link-based verification screen unchanged and adds no dependency. It runs on the same machine as the pipeline, and it already follows the design doc's user model, so a later move to a managed provider stays a data migration, not a rewrite.

Its real cost is that the security code is ours. That's why this plan uses only standard primitives (scrypt, 256-bit random tokens stored as SHA-256 hashes, HttpOnly cookies) and tests every rule.

**Why not Clerk now,** despite the earlier preference for it:
- it needs your Clerk account and keys;
- production needs a domain, which isn't free;
- the free plan can't change password rules or email templates;
- custom flows are "not recommended" by Clerk itself;
- verification would switch from links to codes, which changes the approved screen.

Clerk remains the natural choice once Explivio has a domain and goes public; §9 shows the migration path.

## 4. Proposed architecture

```
Browser (existing Stitch screens)
   │  server actions (Origin-checked by Next.js) · HttpOnly session cookie
   ▼
Next.js server (web/)
   ├── proxy.ts ............ quick redirect for signed-out visitors (optimistic, cookie present?)
   ├── lib/auth/ ........... session (requireUser), passwords (scrypt), tokens, rate limits, email transport
   ├── services/auth/ ...... signUp, verifyEmail, signIn, signOut, forgot/reset, resend
   ├── services/pipeline ... + ownerUserId on new runs; every read/write checks the owner
   └── data/explivio.db .... SQLite via node:sqlite (users, sessions, email_tokens, user_settings)
   ▼
Pipeline CLI (unchanged) ── runs/<id>/ (request.json now records ownerUserId)
```

**Every protected page, server action and API route checks the session on the server.** The `proxy` redirect is only a convenience, never the security boundary.

### 4.1 Database (SQLite file, gitignored; migrations versioned in code)

| Table | Columns (key ones) | Constraints |
|---|---|---|
| `users` | `id` (`usr_` + 128-bit random), `email` (normalised lowercase), `display_name`, `password_hash` (`scrypt$N$r$p$salt$hash`), `email_verified_at`, `status` (`active` / `disabled`), `auth_provider` (`local`), `created_at`, `updated_at`, `password_changed_at` | PK `id`; **UNIQUE `email` COLLATE NOCASE**; CHECK on `status` |
| `sessions` | `token_hash` (SHA-256 of a 256-bit cookie token), `user_id`, `created_at`, `expires_at`, `last_seen_at` | FK → users ON DELETE CASCADE; index `user_id` |
| `email_tokens` | `token_hash`, `user_id`, `purpose` (`verify_email` / `reset_password`), `created_at`, `expires_at`, `used_at` | FK; index (`user_id`, `purpose`) |
| `user_settings` | `user_id`, `preferences` (validated JSON, same shape as F7), `updated_at` | PK / FK `user_id` |

- **Not stored:** plaintext passwords or tokens, IP addresses, user agents.
- **Timestamps:** ISO-8601 UTC.
- **Location:** `EXPLIVIO_DB_PATH`, defaulting to `<pipeline root>/data/explivio.db`.

### 4.2 Sessions

- **Cookie:** `explivio_session` = 256-bit random token.
  - `HttpOnly`; `SameSite=Lax`; `Path=/`.
  - `Secure` when served over HTTPS; it's dropped only on `http://localhost`, which browsers would otherwise reject.
- **Expiry:** 7 days, or 30 days with "Remember me", with a server-side `expires_at`.
- **Ending a session:**
  - Logout deletes the row and clears the cookie.
  - A password reset deletes **all** of that user's sessions.
  - An expired or unknown token is treated as signed out.
- **CSRF:**
  - Every state change goes through server actions, which Next.js protects by comparing the Origin and Host headers.
  - `SameSite=Lax` blocks cross-site posts.
  - GET routes don't change state.
- **No token in `localStorage`.**

### 4.3 Flows

```
Sign up ─► validate (server) ─► rate limit ─► create user (unverified, scrypt hash)
        ─► verify token (24 h, single use, stored hashed) ─► email ─► /verify-email?to=al***@…
Verify  ─► /verify-email?token=… ─► hash lookup ─► unexpired + unused? ─► mark verified, use token ─► "Email verified" ─► /login
Sign in ─► rate limit (IP + email) ─► user + scrypt compare (constant time; dummy hash when no user)
        ─► unverified? "Verify your email first" + resend ─► else create session ─► redirect to the safe ?next=
Forgot  ─► rate limit ─► always the same generic answer ─► if account: reset token (30 min) + email
Reset   ─► /reset-password?token=… ─► valid? ─► new hash, token used, ALL sessions revoked ─► /login
Logout  ─► delete session, clear cookie ─► /login
```

### 4.4 Email delivery (honest at $0)

- **Transport interface:**
  - `outbox` is the default. Each message is written to `data/outbox/` as a file (a local "mailbox" for development, like Mailpit). The UI then says *"No email was sent. This development server saved it to its outbox."* It never says "sent".
  - `resend` is optional: an HTTP API call via `fetch`, used only when `RESEND_API_KEY` and `EMAIL_FROM` are set. It's **blocked until you own a verified domain**.
- **Logging:** tokens and links are never written to logs or the console. The outbox file *is* the mailbox and stays gitignored.

### 4.5 Ownership

- **New runs:** the web service writes `ownerUserId` into `request.json`. The CLI and pipeline stay unchanged.
- **Every service read and write checks the owner:** list, get, status API, file and download, retry, regenerate.
- **Another user's id gets a 404** (not 403), so the app doesn't reveal that the run exists.
- **Settings:** move from `localStorage` to `user_settings`, behind the existing `usePreferences()` hook (it was designed for this swap).
- **Existing runs** (no owner) are **hidden from everyone**. The one exception: you may set `EXPLIVIO_LEGACY_OWNER_EMAIL`, and that account alone then sees them. Run folders aren't rewritten.
- **Data leak through the build:** `/videos/[id]` currently prerenders ids and titles at build time. That will be removed so no titles end up in static HTML.

### 4.6 Rate limits (in-memory, per server process)

| Action | Limit |
|---|---|
| Login failures | 5 per 15 min per email+IP, and 20 per 15 min per IP |
| Sign-up | 5 per hour per IP |
| Forgot / resend | 3 per hour per email; 60 s between sends |
| Reset submit | 10 per hour per IP |

Single-process memory is fine for this single-server app. It resets on restart, and that limitation is documented.

## 5. Screen-to-functionality mapping

| Existing screen | Kept as is | Connected to | Minimal UI additions (existing components only) |
|---|---|---|---|
| **Login** `/login` | Layout, fields, "Remember me", "Forgot password?", errors | `signIn` → session cookie → `?next=` (validated: same-site path only) | Generic "Email or password is incorrect"; "Verify your email first" with a link to resend; rate-limit message (existing `AuthMessage`) |
| **Sign up** `/signup` | Name, email, password + confirm, strength meter, checklist, terms | `signUp` → user + verification token → email → `/verify-email?to=masked` | "An account with this email may already exist", worded to avoid account enumeration |
| **Verify email** `/verify-email` | "Check your inbox", masked address, resend with cooldown | `?token=` consumes the link; resend uses a signed pending-verification cookie (no email in the URL) | Success, expired and invalid states shown with the existing `AuthMessage`; delivery wording says "outbox" in development |
| **Forgot password** `/forgot-password` | Email field, back link | `requestPasswordReset`, always the same generic answer | — |
| **Reset password** `/reset-password` | New + confirm password, checklist | `?token=` → `resetPassword` → revoke sessions → `/login` | Expired or invalid link state with a link to Forgot password |
| App shell (sidebar `UserSummary`) | Avatar and layout | The real user's name and email from the session | **Sign out** button (required for logout) |

No new pages.

## 6. Security considerations

- **Password hashing:** scrypt N=2^15, r=8, p=1, a 16-byte salt and a 64-byte key. That's above the OWASP minimum, and the parameters are stored with each hash so they can be upgraded later.
- **Timing and enumeration:** password checks use constant-time comparison and run a dummy hash when the account doesn't exist. Sign-up, forgot and resend give answers that don't reveal whether an account exists.
- **Tokens:** `crypto.randomBytes(32)` in base64url, stored as SHA-256. They're single use, expire, and are invalidated on use and on password change.
- **Redirects:** `?next=` must be a same-site path. It must start with `/`, not `//` or `/\`, and contain no scheme; otherwise it falls back to `/`.
- **API protection is independent of the proxy:** routes return 401 when signed out and 404 when the resource isn't the user's.
- **Logs:** no password, token, link or email body is logged. Error messages stay generic.
- **Secrets:**
  - The cookie-signing secret is `AUTH_SECRET`. If it isn't set, the app generates one into `data/auth-secret` on first run.
  - The `data/` directory is gitignored.

## 7. Implementation sequence (separate commits)

1. Dependencies (types only) plus the database layer and migrations; unit tests.
2. Auth core (passwords, tokens, sessions, rate limits, email transport) and services; tests.
3. Connect the five screens and add sign-out; route protection (proxy plus server checks).
4. Video ownership (service, API, file route, actions, legacy handling) and server-side settings.
5. Security and integration tests (two accounts, cross-user, expiry, reuse, brute force, redirects, cookies); responsive check of the five screens.
6. Implementation doc, progress update.

## 8. Limitations to accept

- **Real emails can't be sent until you have a domain** (Resend) or configure an SMTP sender. Until then verification and reset links live in the development outbox, and the UI says so.
- **Rate limits** are per process and reset on restart.
- **Single-server design:** SQLite is fine for one machine; hosting with several instances would need a shared database.

## 9. Future migration

- **To a managed provider:** the `users` table already has `auth_provider` / `auth_subject` columns (following the design doc). A switch to Clerk or Supabase maps their subject id to the existing `usr_` id, so `ownerUserId` on runs never changes.
- **To MongoDB or Postgres:** the same tables map one-to-one.
