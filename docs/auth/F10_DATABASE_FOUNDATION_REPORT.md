# F10 — Database foundation report (MongoDB Atlas)

Date: 2026-11-03 · Branch: `dev` · Commit: `cc36dad` · Spend: **$0**

## 1. Existing database architecture (before this phase)

| Item | Finding |
|---|---|
| Database | **None.** No MongoDB, Mongoose or other database package and no connection code. Video state lives in `runs/<id>/` JSON files |
| Env vars | None for a database. `web/.env.local` didn't exist; the web app read only `EXPLIVIO_PIPELINE_ROOT` and `VIDEO_SERVICE` |
| Design | The Database Design Document names MongoDB, with collections `users`, `videoProjects`, `generationAttempts`, `userSettings` (+ others later) and owner-scoped indexes |
| Atlas cluster | **None configured.** No connection string was present, so nothing could be reused or verified |

## 2. Atlas configuration status

**Not yet configured, and that's the outstanding user action (§8).** The code is ready and tested offline. The real connection is **not verified**, so MongoDB is *not* marked complete.

## 3. Connection implementation (`web/src/lib/db/`)

| File | Role |
|---|---|
| `config.ts` | Reads `MONGODB_URI` (required) and `MONGODB_DB` (default `explivio`); validates the scheme, host and database name; `redact()` strips credentials from any text |
| `mongo.ts` | **One `MongoClient` per server process**, cached on `globalThis` (survives dev hot reloads). Concurrent first requests share one `connect()`; a failed attempt can be retried. The pool is small (`maxPoolSize` 10; the free tier allows 500 connections), with 5 s timeouts. Errors become `DatabaseConfigError` or `DatabaseUnavailableError` with a credential-free reason (authentication, host not found, unreachable or IP access list) |
| `collections.ts` | Collection names, document types, indexes, `$jsonSchema` validators, idempotent `ensureSchema()` |
| `health.ts` + `GET /api/health/db` | `{status: "ok" \| "not_configured" \| "unavailable", latencyMs}` only, HTTP 200 or 503; details go to the server log, redacted |
| `instrumentation.ts` | At server start, warns if `MONGODB_URI` is missing or malformed (names the variable, never the value). The app still starts, because nothing needs the database until authentication is switched on |
| `legacy-ownership.ts` + `scripts/db-legacy-ownership.mts` | The old-video ownership plan (dry run by default; see the architecture doc §8) |
| Scripts | `npm run db:check` (health), `npm run db:init` (collections and indexes), `npm run db:legacy-ownership` (dry run; `-- --apply` only after approval) |

**Driver:** the official `mongodb` 7.8.0 package (its `engines` field says Node ≥ 20.19; this machine runs 24.19). There's no Mongoose and no second driver. `npm audit --omit=dev` reports 0 vulnerabilities.

## 4. Collections and indexes

See the architecture document §3 for the fields. In summary:

| Collection | Indexes |
|---|---|
| `users` | `email_unique` (`emailNormalized`, unique) + validator |
| `sessions` | `user`; `expiry_ttl` (`expiresAt`, TTL 0) |
| `emailTokens` | `user_purpose`; `expiry_ttl` (TTL 0) |
| `videoProjects` | `owner_newest`, `owner_status_newest` + validator (`ownerUserId` required) |
| `generationAttempts` | `video_newest`, `owner_newest`, `status_updated` |
| `userSettings` | `_id` = userId |

## 5. Environment variables (names only)

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `MONGODB_URI` | `web/.env.local` | Yes (for the database) | Atlas connection string (secret) |
| `MONGODB_DB` | `web/.env.local` | No (default `explivio`) | Database name |
| `MONGODB_TIMEOUT_MS` | `web/.env.local` | No (default 5000) | Connection timeouts |
| `EXPLIVIO_LEGACY_OWNER_EMAIL` | `web/.env.local` | Only for the migration | Account that gets the existing videos |
| `MONGODB_URI_TEST` | Shell, when running tests | No | Enables the live Atlas test (uses a throwaway `explivio_test_<pid>` database and drops it afterwards) |

- **Templates:** `web/.env.example` has placeholders only.
- **Gitignored:** `web/.env.local` is ignored (`web/.gitignore: .env*`, confirmed with `git check-ignore`).
- **Not exposed to the browser:** no variable uses `NEXT_PUBLIC_`.

## 6. Test results (executed)

`web/tests/mongo-foundation.test.ts`:

| # | Test | Result |
|---|---|---|
| 1 | Missing `MONGODB_URI`: configuration error, no connection attempt | PASS |
| 2 | Invalid connection strings rejected before connecting, not echoed | PASS |
| 3 | Valid settings and defaults | PASS |
| 4 | Database unavailable (real driver against 127.0.0.1:1): safe error, no credentials | PASS |
| 5 | One client per process, reused; replaced when settings change | PASS |
| 6 | Collections, validators and indexes created; idempotent | PASS (recording fake) |
| 7 | Duplicate-email protection (unique index; validator rejects a plaintext password) | PASS (spec); live enforcement pending |
| 8 | Ownership and TTL indexes | PASS |
| 9 | Health answer is only status and latency | PASS |
| 10 | No secret leakage (redaction, safe reasons, startup message) | PASS |
| — | Legacy ownership plan (configured, existing, verified account only; never reassigns; idempotent) | PASS |
| — | **Live Atlas:** connect, create schema, E11000 on a duplicate email, validator rejects a plaintext password | **SKIPPED: no cluster configured** (`MONGODB_URI_TEST`) |

- **Whole web suite:** 39 tests, **38 pass, 0 fail, 1 skipped**.
- **Other checks:** typecheck, lint and the production build pass.
- **Scripts without a cluster:**
  - `db:check` prints `MongoDB: not_configured`.
  - `db:legacy-ownership` dry run prints "runs on disk without an owner: 20 … Nothing changed".
  - `/api/health/db` returns `{"status":"not_configured","latencyMs":null}` with HTTP 503.
- **Video generation:** none, and no Gemini or ElevenLabs calls.

## 7. Security considerations

- The URI is only ever read on the server; logs and errors pass through `redact()`, and the health endpoint reveals no configuration.
- `$jsonSchema` validators make the database itself reject a user without a hashed password, and a project without an owner.
- Restrict the Atlas IP access list to your own IP rather than `0.0.0.0/0`. Your home IP can change; Atlas supports temporary entries.
- Use a database user with **readWrite on the `explivio` database only**, not an Atlas admin.

## 8. Outstanding user actions (you, in the Atlas web UI; never paste secrets into chat)

1. **Create the free cluster:**
   - Sign up or log in at <https://cloud.mongodb.com> (no card is needed for the free tier; never enable billing).
   - Create a project, e.g. "Explivio", and then a cluster: choose **Free** (shown as M0, 512 MB).
   - Pick a provider or region near you and leave everything else at its default.
2. **Database user:**
   - Go to *Security → Database Access → Add New Database User*.
   - Choose password authentication, an auto-generated password, and the role *Read and write to any database*, or better, a custom role with `readWrite` on `explivio` only.
3. **Network access:**
   - Go to *Security → Network Access → Add IP Address*.
   - Choose *Add Current IP Address*, not "allow access from anywhere".
4. **Connection string:**
   - Go to *Database → Connect → Drivers → Node.js*.
   - Copy the `mongodb+srv://…` string.
5. **Local configuration:**
   - Copy `web/.env.example` to `web/.env.local`.
   - Paste the string as `MONGODB_URI` and replace `<db_password>` with the user's password.
   - Keep `MONGODB_DB=explivio`.
6. **Verify, then tell me it's done** (without sharing the values):
   - In `web/`, run `npm run db:check`. It should print `MongoDB: ok (… ms)`.
   - Then run `npm run db:init`.
   - Optionally run the live test: `$env:MONGODB_URI_TEST = "<same uri>"; npm test`.
7. **Later, after the sign-up flow exists:** add `EXPLIVIO_LEGACY_OWNER_EMAIL` and review the ownership dry run before approving `--apply`.

## 9. Free-tier limits (official pages, 2026-11-03)

- **Capacity:** 0.5 GB data, 100 operations per second (throttled above that), 500 connections, 10 GB in and 10 GB out per rolling 7 days, one free cluster per project.
- **Pausing:** the cluster is paused after **30 days with zero connections**, and idle clusters may be deactivated under the Terms of Service.
- **Backups:** described inconsistently on the two pages, so don't rely on them.
- **Server:** MongoDB 8.0 (not upgradable on the free tier).
- **Billing:** the pricing page also describes pay-as-you-go for *paid* clusters. Stay on the Free tier and don't add a payment method.
