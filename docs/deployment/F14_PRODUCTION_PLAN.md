# F14 — Production deployment plan (Vercel)

Date: 2026-11-09 · Status: **PLAN ONLY, waiting for your approval. Nothing is implemented or deployed.** · Budget: **$0**

Sources: [VERCEL_NOTES.md](VERCEL_NOTES.md) (Vercel limits, checked 2026-11-06) and the cloud-render research of 2026-11-09 (summarised in §2).

## 1. Goal
Explivio is public on the internet and announced on LinkedIn: anyone can sign up, verify their email, create a narrated video, watch and download it. It must keep working with your laptop off, cost $0, and never bill automatically.

**Out of scope:**
- paid plans, a paid domain;
- payments or ads (Vercel Hobby is non-commercial only);
- moving the old local videos (they were deleted).

## 2. Decisions you need to make first
| # | Decision | Options | My recommendation |
|---|---|---|---|
| **A** | Where videos render | (a) **Vercel Sandbox only**: no card, never billed, about 8–15 videos a month at 1080p. (b) Sandbox plus an **Oracle Cloud** free server as overflow (card for verification; slow, 10–20 min a video). (c) Oracle only. Also checked: **Hugging Face** free compute ended, **GitHub Actions'** terms forbid this use, **Cloud Run** bills automatically. Render, Koyeb, Fly and Railway are too small or not free | **(a) to launch**; add (b) only if demand needs it |
| **B** | Public video quality | 1080×1920 (now) or **720×1280** (about half the CPU, so roughly 15–30 videos a month on the Sandbox) | **720p** public, 1080p locally |
| **C** | How emails reach every user | (a) **Gmail SMTP with an App Password** (no domain; Google's limits to be verified). (b) A **free subdomain** verified in Resend (e.g. is-a.dev; needs approval and DNS). (c) **Reuse Make My Marriage's approach**: share its email code without secrets | (c) if MMM already does this, otherwise (a) |
| **D** | App address | `explivio.vercel.app` (free) or a custom domain (paid, out of scope) | `*.vercel.app` |
| **E** | Atlas network access | Vercel and the Sandbox use changing IPs, so `0.0.0.0/0` is needed | `0.0.0.0/0` **plus** a readWrite-only user and a long random password (no Atlas IP allowlist is possible on Hobby) |

## 3. Target architecture
```
Browser ──► Vercel (Next.js, root dir: web/)
              pages, server actions, /api/*            ──► MongoDB Atlas "explivio"
              ├─ create video → renderJobs (queue)          users, sessions, videoProjects,
              │      └─ dispatch: start a Vercel Sandbox    renderJobs (NEW), emailJobs, rateLimits…
              ├─ progress page reads job status from MongoDB (not runs/ files)
              ├─ playback/download → R2 (owner-checked, as F11)
              └─ email: after() drains emailJobs; daily cron as a safety net
Vercel Sandbox (from a snapshot: node_modules, Chrome, ffmpeg, Kokoro model)
   reads the job → Gemini → voice (ElevenLabs → Kokoro) → Remotion render (720p)
   → upload MP4 to R2 → write status/stages to MongoDB → stop
```

**Local development keeps working as today:** a `local` dispatcher spawns the CLI on your laptop, and the outbox stays available.

## 4. Work plan (in order; each step tested before the next)

### Step 1: Run status in MongoDB (needed on Vercel's read-only disk)
- **New `renderJobs` collection** (or an extension of `generationAttempts`): `jobId` (= video id), owner, request, status (`queued`/`running`/`succeeded`/`failed`), stage, safe error, timestamps, attempt, lease, and the sandbox id.
- **Pipeline:** reports each stage change to MongoDB (as well as `manifest.json` locally).
- **Web app:** reads status from MongoDB. `runs/` is used only by the local dispatcher.
- **Kept:** the F9 start lock (no double renders), the F12 limit of 10 renders per user per day, ownership checks, retry and regenerate, and the F11 upload retry.
- **Tests:** status mapping, a migration-free fallback for local runs, ownership, stale-job detection.

### Step 2: Render dispatcher
- **Interface:** `dispatch(job)` with **LocalDispatcher** (today's spawn) and **SandboxDispatcher** (Vercel).
- **Chosen by:** `RENDER_DISPATCH=local|sandbox`.
- **Guards before dispatching:**
  - a site-wide **daily render cap** (`EXPLIVIO_DAILY_RENDERS`);
  - a **monthly Sandbox CPU budget** (estimated from measured vCPU-seconds per video);
  - when either is reached, a friendly *"Video creation is paused until <date>"* message instead of a failure;
  - a `paused` state that **never auto-bills** (Hobby can't bill anyway).

### Step 3: Sandbox render worker
- **Snapshot build script:** creates the Sandbox snapshot once, with Node, the pipeline's `node_modules`, Remotion's Chrome headless shell, ffmpeg and the Kokoro model. Snapshots stay within Hobby's 15 GB and never expire.
- **Worker entry inside the Sandbox:** `node worker.mjs <jobId>`:
  - load the job from MongoDB;
  - run the existing pipeline (`--prompt-file`, voice, captions, music, **resolution**);
  - upload to R2 (moving the F11 upload code into the worker);
  - set the status; stop.
- **Secrets:** passed only as Sandbox environment variables, never in files or logs.
- **Limits:** started **detached** (Vercel functions max out at 300 s); 45-minute Sandbox limit; 4 vCPU / 8 GB.
- **Measured** on a preview deployment: wall time and vCPU-seconds per 30, 60 and 90 s video, which give the real monthly capacity.

### Step 4: Pipeline changes
- **Resolution:** a `--resolution 720p` option (composition size; text, diagrams and captions scale).
- **Work folder:** the Sandbox's disk.
- **Voice:** the Kokoro model loads from the snapshot.
- **Unchanged:** templates, script checks, timing.
- **Validation:** the existing video validator (13 checks) on 720p output.

### Step 5: Email on serverless
- **Sending without a resident worker:** drain due `emailJobs` with `after()` right after queuing (within 300 s), plus a **daily Vercel cron** and an authenticated `/api/cron/email`. The in-process `setInterval` worker is only used outside Vercel.
- **New provider for Decision C**, behind the existing interface:
  - (a) Gmail SMTP using `nodemailer`, an App Password and TLS, after checking Google's current limits; or
  - (c) MMM's approach.

  The queue, daily guard and templates are unchanged; only the provider is added.
- **Production must not use the outbox** (it writes files). The app refuses to start with `EMAIL_TRANSPORT=outbox` on Vercel.

### Step 6: Production configuration and security
- **`AUTH_SECRET` is required in production.** Today the app *writes* a generated secret to `data/`, which fails on Vercel; production will fail clearly if the setting is missing.
- **Client IP:** trust Vercel's `x-forwarded-for` behind `EXPLIVIO_TRUST_PROXY=vercel` (F12 noted this; per-address limits become meaningful).
- **Headers:** HSTS added; a CSP with nonces for scripts (or a reviewed allow-list), keeping F12's frame and nosniff headers.
- **`EXPLIVIO_APP_URL`** = the Vercel URL, so email links never use the request's Host header (unchanged rule).
- **Startup check** listing every required variable by name (never values).

### Step 7: Public-launch pages and polish
- **Terms of Service and Privacy Policy pages:** the sign-up checkbox already asks people to accept them, but **they don't exist**. Plain, honest pages: what's stored (account, videos in R2, emails), what's sent to Google (Gemini) and ElevenLabs, deletion requests, non-commercial use.
- **Account deletion** (privacy basics): delete the user, sessions, settings, video records and R2 objects. *Optional; recommended before a public launch.*
- **"Paused until" and capacity messages** on Create and the dashboard.

### Step 8: Operations (all free)
- **Logs:** Vercel's built-in logs. The F12 `[security]` lines already avoid secrets.
- **Health:** `/api/health/db` exists; add `/api/health` (database, R2, email config, render capacity).
- **Backups:** Atlas M0 has **no automatic backups**. Add an `npm run db:backup` that exports the collections (except sessions and tokens) to R2, to run by hand or monthly.
- **Rollback:** Vercel's instant rollback to the previous deployment; database changes stay additive.
- **Cleanup:** the Sandbox is temporary (nothing to clean); local `runs/` is only for development.

### Step 9: Your setup actions (I'll give a click-by-click guide)
1. **Vercel:** create a free **Hobby** account and import `chaitanya-lohar/Explivio` from GitHub.
   - **Root directory: `web`**.
   - Enable Sandbox for the project.
2. **Environment variables:** add them in Vercel **yourself** (I'll provide the exact list of names):
   - MongoDB, R2, Resend or Gmail, `AUTH_SECRET`;
   - Gemini and ElevenLabs keys (for the Sandbox).
3. **Atlas:**
   - Network Access: `0.0.0.0/0`;
   - **reduce the database user to readWrite on `explivio`**;
   - **rotate to a long random password** and update Vercel and `web/.env.local`.
4. **Email (Decision C):** a Google App Password (needs 2-step verification), or the free subdomain's DNS records, or MMM's details.

### Step 10: Testing and launch
1. **Local "Vercel mode":** `RENDER_DISPATCH=sandbox` against a real Sandbox from your laptop; full suite (web live, pipeline, browser regression).
2. **Vercel preview deployment** (free; private URL):
   - the full journey with **two accounts**: sign-up → **email arrives at a non-owner address** → verify → create → progress → watch, seek, download → sign-out → reset;
   - the "paused" path, the security headers, the cron.
3. **Measure** Sandbox CPU per video and set the daily and monthly caps from real numbers.
4. **Your approval**, then promote to production. **Your LinkedIn post comes after this.**

## 5. Estimated effort (my estimate, for planning)
| Step | Size |
|---|---|
| 1 Status in MongoDB, 2 dispatcher | Medium |
| 3 Sandbox worker and snapshot, 4 pipeline 720p | **Large** (new platform; most of the risk) |
| 5 Email on serverless and new provider | Small–medium |
| 6 Production configuration and security | Small |
| 7 Terms, Privacy and deletion | Small–medium |
| 8 Operations | Small |
| 10 Testing and preview | Medium |

## 6. Risks
| Risk | Effect | Mitigation |
|---|---|---|
| **The Sandbox allowance runs out quickly** (about 8–15 videos a month at 1080p, more at 720p) | A LinkedIn spike pauses video creation for the rest of the 30-day window | 720p, daily and monthly caps, a clear paused message, optional Oracle overflow |
| The Sandbox is new to us | Unknowns in snapshot size, start-up time, ffmpeg or Chrome | Remotion's official template as the reference; prove it on a preview before anything else |
| Email to other users | Sign-ups can't verify without a working provider | Decision C must be in place before launch |
| Atlas open to `0.0.0.0/0` | Only the password protects the database | readWrite-only user, long random password, no admin role |
| Hobby is non-commercial | Can't earn money on it | Showcase only; Pro needed later if commercial |
| Gemini and ElevenLabs free quotas | Scripts may hit Gemini 429s; ElevenLabs runs out monthly | The Kokoro fallback already covers the voice; a Gemini quota error shows a "try later" message |
| Atlas M0 0.5 GB, no backups | Growth and data loss | Video files are in R2, not MongoDB; manual backups to R2 |
| Kokoro and `sharp` audit items | Accepted (images are never processed) | Documented |

## 7. Cost
| Service | Plan | Cost |
|---|---|---|
| Vercel (website, functions, cron, Sandbox) | Hobby | $0; Sandbox paused, never billed, when the quota is used |
| MongoDB Atlas | M0 | $0 |
| Cloudflare R2 | Free tier (80% guard) | $0 |
| Email | Resend Free / Gmail SMTP | $0 |
| Gemini, ElevenLabs | Free tiers | $0 (Kokoro when ElevenLabs is used up) |
| Domain | `*.vercel.app` | $0 |

## 8. Approval checklist
Reply with:
1. **A** render host, **B** resolution, **C** email approach.
2. **"approve F14 plan"** (optionally with changes, for example skip account deletion for now).

I'll then build step by step, report after each step, and deploy only to a **preview** until you approve production.
