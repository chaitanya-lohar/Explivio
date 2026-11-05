# Explivio — Project context

Last reconciled: 2026-11-05. This file holds the facts and rules that don't change from one session to the next. For current status see [progress_status.md](progress_status.md), for future phases [ROADMAP.md](ROADMAP.md), and for the reasons behind choices [DECISIONS.md](DECISIONS.md).

## 1. Product

Explivio turns a topic prompt into a narrated, captioned **9:16 educational MP4** of 30, 60 or 90 seconds. Signed-in users create videos, follow generation progress, play and download them, and manage a personal library and default settings.

- Repository: https://github.com/chaitanya-lohar/Explivio (private)
- Local path: `D:\Namaste AI\Project 2\Explivio`
- Owner: Chaitanya Lohar

## 2. Architecture (as implemented)

```
Browser ──► Next.js app (web/) ──────────────► MongoDB Atlas, database "explivio"
              │  pages, server actions,           users, sessions, emailTokens,
              │  /api routes, proxy.ts            videoProjects, generationAttempts,
              │                                   userSettings
              │ spawns one background process per video
              ▼
          Pipeline CLI (src/cli.ts, repo root)
              storyboard: Gemini      ─► storyboard.json
              narration:  ElevenLabs  ─► narration.mp3 + word timings
              render:     Remotion    ─► video.mp4
              all written to runs/<runId>/, progress in manifest.json
```

| Part | Where | Technology |
|---|---|---|
| Pipeline | `src/` (cli, pipeline, providers, schemas, video templates) | TypeScript run with tsx; Zod; Remotion |
| Web app | `web/src/` (app, features, services, lib, components) | Next.js 16.4 App Router (`cacheComponents`, `proxy.ts`), React 19, TypeScript strict, Tailwind 4 |
| Database | `web/src/lib/db/` | Official `mongodb` driver 7.8 (no Mongoose), one cached client |
| Auth | `web/src/lib/auth/`, `web/src/services/auth/`, `web/src/features/authentication/` | Self-managed: scrypt, hashed tokens, DB sessions |
| Video files | `runs/<runId>/video.mp4` on the local disk | Streamed by `/api/videos/[id]/file` after an owner check |
| Email | `web/src/lib/auth/email.ts` | Development outbox `data/outbox/` (default); optional Resend transport (needs a domain) |
| Object storage | `web/src/lib/storage/`, `services/pipeline/cloud-upload.ts` (F11) | Cloudflare R2, private bucket `explivio-assets`, official AWS SDK v3. New videos are uploaded and verified, then streamed or downloaded via signed links; old videos stay in `runs/`. Settings: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (optional `R2_ENDPOINT`); check with `npm run r2:check` |

### Video generation flow
1. A server action checks the session, then `services/pipeline/videos.ts` creates `runs/<runId>/` with `prompt.txt` and `request.json`, which includes `ownerUserId`.
2. Ownership is recorded in MongoDB (`videoProjects`, `generationAttempts`) **before** the process starts. If that write fails, the run folder is removed.
3. The CLI runs storyboard → narration → render and updates `manifest.json` after every stage.
4. The progress page polls `GET /api/videos/[id]`, which reads the manifest. When the status is "succeeded", the Video ready page plays and downloads the MP4.
5. Only one render runs at a time (start lock). Rendering uses about 2 GB of RAM.

### Authentication flow
- **Sign-up** stores an scrypt hash and creates a 24-hour single-use verification link (hashed in `emailTokens`), which is written to the outbox.
- **Sign-in** creates a 256-bit session token. The browser gets it in the `explivio_session` cookie (HttpOnly, SameSite=Lax, Secure); the database keeps only its SHA-256 hash in `sessions` (7 days, or 30 with Remember me).
- **Every request:**
  - `proxy.ts` redirects requests without a cookie, and API routes answer 401;
  - the dashboard layout validates the session in MongoDB;
  - all data calls are scoped to the session user, and another user's resources answer 404.
- **Reset** uses a 30-minute single-use link and deletes all of that user's sessions. **Sign-out** deletes the session record.
- Details: [auth/F10_AUTHENTICATION_IMPLEMENTATION.md](auth/F10_AUTHENTICATION_IMPLEMENTATION.md).

## 3. Non-negotiable rules

### Budget: $0
- Free tiers only. No billing, paid API calls, subscriptions, credits or trials that need a payment method.
- Stop when a free quota runs out.
- Check each provider's current limits on its official pages before building on it.

### Secrets
- Never print or commit `.env`, `web/.env.local`, `mcp.json`, keys, passwords, tokens or connection strings.
- Never ask the user to paste a secret into chat; they put credentials into local env files themselves.
- Credentials stay server-side.

### Database
- MongoDB Atlas, database `explivio`, is the **only** application database.
- No SQLite and no second database. Keep the one connection module (`web/src/lib/db/mongo.ts`).
- Change schemas only through a documented migration.

### Make My Marriage (MMM)
- Never read or modify MMM data, collections or buckets, and never copy MMM secrets.
- MMM source code may be shared by the user as a reference for patterns only.
- Explivio has its own credentials, database user and storage resources.

### Files and data
- Never move, rename or delete anything in `runs/` without explicit approval.
- No destructive or bulk migration without approval. Keep existing videos.

### UI
- Keep the five Stitch-designed auth screens' appearance; any redesign needs approval.

### Git
- Work on `dev`; after every phase update `docs/progress_status.md`, then commit and push logical groups to `dev`.
- `main` changes only through a dev→main PR that the user reviews and merges. Never merge it yourself.
- Commit messages end with the co-author line given in the session instructions.

### Provider usage
- ElevenLabs free credits are nearly spent (estimated about 270 characters left; reset 2026-11-26), so prefer silent evaluation (`--silent`).
- Gemini free tier: avoid unnecessary calls (it returned 429 on 2026-11-02); the model is `gemini-3.6-flash`.

## 4. Environment variables (names only)

| File | Variables |
|---|---|
| Root `.env` (pipeline) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, voice IDs |
| `web/.env.local` (web) | `MONGODB_URI` (required), `MONGODB_DB`, `MONGODB_TIMEOUT_MS`, `AUTH_SECRET`, `EXPLIVIO_APP_URL`, `EXPLIVIO_OUTBOX_DIR`, `EMAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `EXPLIVIO_LEGACY_OWNER_EMAIL`, `VIDEO_SERVICE=mock` (UI work only) |
| Tests | `MONGODB_URI_TEST` enables the live Atlas tests, which use throwaway databases |

Template: `web/.env.example`. Gitignored local data: `data/` (`auth-secret`, `outbox/`), `runs/`.

## 5. Everyday commands

| Task | Command |
|---|---|
| Run the web app | `cd web && npm run dev`, then open http://localhost:3000 |
| Pipeline tests | `npm test` (repo root) |
| Web tests | `cd web && npm test` |
| Checks | `npx tsc --noEmit`, `npm run lint`, `npm run build` (in `web/`) |
| Database | `npm run db:check`, `npm run db:init`, `npm run db:legacy-ownership` (dry run; `-- --apply` only after approval) |
| Silent pipeline run (no ElevenLabs) | `npx tsx src/cli.ts "<topic>" --duration 30 --silent` |

## 6. Machine constraints

- Ryzen 5 5625U with integrated Radeon (no CUDA) and 15.3 GB RAM.
- Free memory has dipped to about 1.6 GB during renders.
- `runs/` was 464 MB on 2026-11-05.

## 7. Document map

| Topic | Document |
|---|---|
| Product and design (original, Word/PDF) | `docs/AI_Educational_Video_Generator_PRD_v1.pdf`, `docs/Explivio_*_v1.docx` |
| Status and changelog | [progress_status.md](progress_status.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |
| Decisions | [DECISIONS.md](DECISIONS.md) |
| Quality (M6/M7) | [quality/](quality/), [plans/M7_VISUAL_INTELLIGENCE_PLAN.md](plans/M7_VISUAL_INTELLIGENCE_PLAN.md) |
| QA (F9) | [qa/F9_END_TO_END_QA_REPORT.md](qa/F9_END_TO_END_QA_REPORT.md) |
| Auth and database (F10) | [auth/](auth/) |
| Future phase reports | `storage/` (F11), `security/` (F12), `email/` (F13), `deployment/` (F14), `qa/` (F15) |
