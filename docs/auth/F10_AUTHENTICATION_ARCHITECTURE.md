# F10 — Authentication architecture

Status: **foundation built; authentication awaiting approval** · Updated 2026-11-03 · Branch: `dev` · Budget: $0

> **Revision (2026-11-03):** an earlier draft (`d069764`) proposed SQLite. That was withdrawn after your decision that **MongoDB Atlas is the single application database**. No SQLite code was committed, and the drafts were removed from the working tree. This document supersedes the earlier version.

## 1. Current architecture (inspected)

| Area | State |
|---|---|
| Auth screens | `web/src/app/(auth)/`: login, signup, forgot-password, verify-email, reset-password. They're complete Stitch screens, wired to server actions that call `services/mock/auth.ts`, a **demo** (checks nothing, sends nothing) |
| Sessions / protection | None. Every page and API is public; the sidebar user is hard-coded |
| Database | **MongoDB Atlas foundation added in F10** (`web/src/lib/db/`, commit `cc36dad`). Before that there was none |
| Video data | Run folders `runs/<id>/` (`request.json`, `manifest.json`, `video.mp4`). Files stay there; MongoDB will hold metadata and ownership |
| Settings | Browser `localStorage` (F7) |
| Design docs | `users` (profile and account state), `ownerUserId` on every project, owner checks in the application service, MongoDB as the database |

## 2. Chosen architecture

**Self-managed authentication in the existing Next.js server, storing everything in the same MongoDB Atlas database.** There's no second database and no external auth provider.

```
Browser (existing Stitch screens)
   │  server actions (Next.js checks Origin) · HttpOnly session cookie
   ▼
Next.js server (web/)
   ├── proxy.ts ............. optimistic redirect when there's no session cookie (convenience only)
   ├── lib/db/ .............. ONE MongoClient per process (done: config, connection, schema, health)
   ├── lib/auth/ ............ scrypt hashing, tokens, sessions, rate limits, email transport   (next phase)
   ├── services/auth ........ sign-up, verify, sign-in/out, forgot/reset, settings              (next phase)
   └── services/pipeline .... every read and write checks ownerUserId                           (next phase)
   ▼                                   ▼
MongoDB Atlas (free cluster)          Pipeline CLI (unchanged) → runs/<id>/ (files stay on disk)
users · sessions · emailTokens · videoProjects · generationAttempts · userSettings
```

**Why self-managed** (official pages checked 2026-11-03; details in §9):
- **Cost and setup:** it's $0, with no third-party auth account or keys, and no new vendor.
- **Data in one place:** it uses the same database as the rest of the app, as you required.
- **No screen changes:** the existing link-based verification screen stays as designed.
- **Fits the design doc:** it follows the `users` / `ownerUserId` model.
- **Clerk:** its free plan works, but production needs a domain you own, and its custom-form flow verifies by *code*.
- **Supabase Auth:** it would add a second (Postgres) database, its built-in email reaches team members only (2/hour), and free projects pause after 7 idle days.

The cost of self-managing is that the security code is ours. That's handled with standard primitives and a test for every rule (§7).

## 3. Database design (implemented in `lib/db/collections.ts`)

| Collection | Key fields | Indexes / constraints |
|---|---|---|
| `users` | `_id` (`usr_` + 128-bit hex), `email`, `emailNormalized`, `name`, `passwordHash` (scrypt), `emailVerified`, `emailVerifiedAt`, `status`, `authProvider: "local"`, `createdAt`, `updatedAt`, `passwordChangedAt` | **Unique `emailNormalized`**. `$jsonSchema` requires the fields, checks the id format, and requires `passwordHash` to start with `scrypt$`, so a plaintext password is rejected by the database |
| `sessions` | `_id` = SHA-256 of the cookie token, `userId`, `createdAt`, `expiresAt`, `lastSeenAt` | `userId`; **TTL on `expiresAt`** |
| `emailTokens` | `_id` = SHA-256 of the link token, `userId`, `purpose` (`verify_email` / `reset_password`), `expiresAt`, `usedAt` | (`userId`, `purpose`); **TTL on `expiresAt`** |
| `videoProjects` | `_id` = run id, **`ownerUserId`**, `title`, `prompt`, `durationSeconds`, `status`, `storage: {kind: "local-run", runId}`, `createdAt`, `updatedAt`, `legacyClaimedAt?` | (`ownerUserId`, `createdAt` desc), (`ownerUserId`, `status`, `createdAt` desc). The validator **requires `ownerUserId`** |
| `generationAttempts` | `_id` = run id of the attempt, `videoId`, **`ownerUserId`**, `status`, `stage`, `safeError`, timestamps | (`videoId`, `createdAt` desc), (`ownerUserId`, `createdAt` desc), (`status`, `updatedAt`) |
| `userSettings` | `_id` = userId, `preferences` (the F7 shape, validated), timestamps | `_id` (one record per user) |

- **Not stored:** plaintext passwords or tokens, IP addresses, user agents.
- **Timestamps:** BSON dates (UTC).
- **Setup:** `npm run db:init` creates collections and indexes and can be re-run safely.

## 4. Authentication flows (next phase)

```
Sign up ─► server validation (existing rules) ─► rate limit ─► email already registered?
           yes: no new account; email the existing owner; SAME response   (no account enumeration)
           no : insert user (unverified, scrypt hash) ─► verify token (24 h) ─► email ─► /verify-email?to=al***@…
Verify  ─► /verify-email?token=… ─► SHA-256 lookup ─► unexpired + unused ─► mark verified + token used ─► sign in
Sign in ─► rate limit (account+IP, IP) ─► user + scrypt compare (dummy hash when no user: same timing)
           wrong: "Email or password is incorrect" · right but unverified: "Verify your email first" + resend
           ok: session (7 days, or 30 with Remember me) ─► redirect to a validated same-site ?next=
Forgot  ─► rate limit ─► SAME answer always ─► if the account exists: reset token (30 min) + email
Reset   ─► /reset-password?token=… ─► valid ─► new hash, token used, ALL sessions deleted ─► /login
Logout  ─► delete session, clear cookie ─► /login
```

## 5. Sessions, cookies and CSRF

- **Cookie:** `explivio_session` = 256-bit random token.
  - `HttpOnly`; `SameSite=Lax`; `Path=/`.
  - `Secure` on HTTPS; it's omitted only on `http://localhost`, which browsers would otherwise reject.
  - It's never readable by JavaScript and never stored in `localStorage`.
- **Server side:** `sessions` holds only the token's hash, with `expiresAt`. A TTL index purges expired rows, and lookups also reject expired ones.
- **Ending sessions:**
  - Logout deletes the row.
  - A password reset deletes all of the user's sessions.
  - A disabled or unverified account has no valid session.
- **CSRF:**
  - State changes go only through server actions, which Next.js protects by comparing the Origin and Host headers.
  - `SameSite=Lax` stops cross-site posts.
  - GET routes don't change state.

## 6. Email (MongoDB does not send email)

- **Transport interface:**
  - **`outbox` (default, development only):** messages are written to `<pipeline root>/data/outbox/` (gitignored). They're readable only on the developer's machine and never returned in an HTTP response. The screens say *"No email was sent. This development server saved it to its outbox."* and never claim delivery.
  - **`resend` (later):** Resend's HTTP API via `fetch`, enabled by `RESEND_API_KEY` + `EMAIL_FROM`. Resend's free plan (100/day, 3,000/month) **requires a verified domain you own**, so it's blocked until a domain exists.
  - **Production guard:** when `NODE_ENV=production` and no real transport is configured, sign-up and reset show an honest "email delivery isn't set up" error. They don't fall back to the outbox.
- **Logging:** links, tokens and bodies are never logged.

## 7. Security design

| Topic | Approach |
|---|---|
| Password hashing | scrypt N=2^15, r=8, p=1, 16-byte salt, 64-byte key (Node built-in; parameters stored per hash so they can be raised) |
| Password rules | The existing shared validation (8+ characters plus a number or symbol), enforced on the server too |
| Tokens | `randomBytes(32)` in base64url; only SHA-256 stored; single use (a `usedAt` check inside an atomic update); verification 24 h, reset 30 min; a newer link retires older ones |
| Enumeration | Sign-up, forgot and resend answer the same either way; "unverified" is revealed only after a correct password |
| Brute force | Per account+IP and per IP limits on sign-in (5 and 20 per 15 min); sign-up 5/h per IP; email sends 3/h per account plus a 60 s cooldown |
| API authorisation | Every protected page, server action and route checks the session on the server; routes return 401 when signed out |
| Ownership | All video and settings reads and writes filter by `ownerUserId` = session user. Another user's id gets **404** (existence not revealed). A client-supplied user id is never trusted |
| Background rendering | The owner is recorded when the job is created (`videoProjects` and `generationAttempts`); the CLI is unchanged and the owner never comes from the CLI |
| Redirects | `?next=` must be a same-site path (`/`, not `//` or `/\`, no scheme); otherwise `/` |
| Secrets | `MONGODB_URI` and future `AUTH_SECRET` / `RESEND_API_KEY` only in `web/.env.local` (gitignored), never `NEXT_PUBLIC_*`; driver errors redacted before logging |
| Rate-limit store | In memory (single server process; resets on restart). Can move to a MongoDB TTL collection if the app runs on more than one instance |

## 8. Existing videos (approved: give them to your account)

- **Configuration:** `EXPLIVIO_LEGACY_OWNER_EMAIL` names the account (it's never hard-coded).
- **Script:** `npm run db:legacy-ownership` is a dry run by default. It changes nothing and prints how many records it would create. Today it reports **20 runs without an owner**.
- **Writing:** only `-- --apply` writes, and only if the configured account exists, is active and is verified. Otherwise it refuses.
- **Insert-only:** it adds `videoProjects` records (`ownerUserId`, `storage.runId`). An existing record is never modified, so it can't reassign and re-running is safe.
- **Scope:** files in `runs/` are never moved, renamed or deleted. New sign-ups never receive legacy videos.
- **Approval:** you approve the actual `--apply` run after seeing the dry run with your account in place.

## 9. Provider comparison (official pages, fetched 2026-11-03)

| Criterion | **Self-managed + Atlas (chosen)** | Clerk free | Supabase Auth free |
|---|---|---|---|
| Free tier | Atlas free cluster: "Free forever", 512 MB | 50,000 monthly retained users; "No credit card required" | 50,000 MAU; 500 MB Postgres |
| Email verification / reset | Yes, app-issued links | Yes, Clerk-sent; custom flow uses **codes** | Yes, but built-in mail only to team members, "2 emails per hour" |
| Real email at $0, no domain | No (development outbox) | Development instance only; production "needs a domain you own" | No |
| Sessions | DB-backed HttpOnly cookie, revocable | Clerk sessions (fixed 7 days on free) | Supabase JWT and refresh tokens |
| MongoDB compatibility | Native (same database) | User ids mirrored into MongoDB | **Second database** (Postgres) |
| Lock-in | None | Medium | Medium |
| Fits the decisions in force | **Yes** | Partly (screen change, domain) | **No** (second database) |

## 10. Zero-cost limitations

| Limit | Effect |
|---|---|
| **Atlas free cluster:** 0.5 GB data, 100 ops/s, 500 connections, 10 GB in / 10 GB out per rolling 7 days, one free cluster per project | Plenty for users, sessions, metadata and settings (no media) |
| **Paused after 30 days with zero connections**; "may deactivate idle Free clusters" per the Terms of Service | Use the app or run `db:check` at least monthly; keep an export |
| **Backups:** the limits page says daily snapshots (4 kept) can be enabled; the pricing FAQ says backups aren't available on free | Conflicting; don't rely on it; export manually |
| **Email:** no free sender without a domain | The development outbox until a domain exists |
| **Rate limits** in memory | Reset on restart |

## 11. Implementation sequence after approval

1. `lib/auth` (hashing, tokens, sessions, rate limits, email) and `services/auth` on MongoDB; tests.
2. Connect the five screens (minimal additions: verify/reset link states, sign-out in the sidebar).
3. Route protection: `proxy` plus server checks on pages, actions and APIs.
4. Ownership: record `videoProjects` / `generationAttempts` at creation; filter every read; server-side settings; run the legacy migration (with your approval).
5. Security tests (two accounts, cross-user, expiry, reuse, brute force, redirects, cookies); responsive check; implementation document.
