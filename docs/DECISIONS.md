# Explivio — Decision log

Important architectural and process decisions, newest first. Each has a status:
- **Active:** in force now.
- **Superseded:** replaced by a later decision; kept for history.
- **Planned:** agreed but not yet built.

Detailed reasoning lives in the linked reports.

| # | Date | Decision | Why | Status |
|---|---|---|---|---|
| D18 | 2026-11-05 | Next phases run in order: F11 R2 → F12 auth hardening → F13 Gmail → F14 production → F15 validation. The optional backlog stays separate | One concern at a time; storage before security review, so the review covers R2 objects too | Active ([ROADMAP.md](ROADMAP.md)) |
| D17 | 2026-11-05 | Real email via **Gmail SMTP with an App Password**; Gmail API with OAuth as the fallback | $0, and it reaches a Gmail inbox without owning a domain. Resend needs a verified domain | Planned (F13) |
| D22 | 2026-11-05 | 10 new renders per account per 24 h (`EXPLIVIO_DAILY_GENERATIONS`), counted from `generationAttempts` | Protects the shared Gemini and ElevenLabs free quotas from one account | Active (F12) |
| D21 | 2026-11-05 | Rate limits stored in MongoDB (`rateLimits`, hashed keys, TTL) rather than memory or Redis | Survive restarts and work across instances; no new service; $0 | Active (F12) |
| D20 | 2026-11-05 | Sign-in limited **per account** (10 failures per 15 min from any address); per-address limits are best effort because the client address can be forged; the lockout-as-DoS trade-off is accepted (a reset lifts it) | Fixes the High finding F1 without a paid service | Active (F12) |
| D19 | 2026-11-05 | You activated R2 knowingly: a payment method is required and overages bill automatically with no cap. Uploads stop at 80% of the free tier; a Budget Alert is recommended | The $0 rule kept by a hard guard instead of a card-free provider | Active |
| D16 | 2026-11-05 | Video files go to **Cloudflare R2** (`explivio-assets`, dedicated scoped token). Delivery is private (presigned URLs or the authenticated route), with no public URLs and no automatic bulk migration | Cloud-backed and multi-user without depending on the laptop's disk; R2 has a free tier and no egress fees; the user already knows it from MMM | Active (F11 done) |
| D15 | 2026-11-04 | Existing ownerless videos are assigned to the user's account by `db:legacy-ownership`. The dry run is the default; `--apply` needs approval and is insert-only | Old videos are visible again without moving any `runs/` files | Active, not yet applied |
| D14 | 2026-11-04 | Video ownership is recorded in MongoDB **before** the render starts; other users' videos answer 404, not 403 | No ownerless renders, and an id's existence is never revealed | Active |
| D13 | 2026-11-04 | Settings moved from browser `localStorage` to the account (`userSettings`) | Per user, and they follow the user to any device | Active (replaces F7's storage) |
| D12 | 2026-11-04 | Email goes to a **development outbox** (`data/outbox/`), and the UI says no email was sent; Resend is optional | No free sender without a domain; the app must never claim delivery | Active until F13 |
| D11 | 2026-11-03 | **Self-managed auth** in the Next.js server: scrypt, hashed single-use tokens, database sessions in an HttpOnly cookie, in-memory rate limits | $0, a single database, keeps the Stitch link-based verification, and fits the `users` / `ownerUserId` design. Clerk needs a domain for production; Supabase adds a second database and limits email | Active ([architecture](auth/F10_AUTHENTICATION_ARCHITECTURE.md)) |
| D10 | 2026-11-03 | **MongoDB Atlas, database `explivio`, is the only database**; official driver, no Mongoose; dedicated least-privilege user; separate from MMM | User decision; free M0 cluster; matches the design documents | Active |
| D9 | 2026-11-03 | SQLite for accounts | Proposed for $0 local storage | **Superseded by D10** (never committed) |
| D8 | 2026-11-01 | Clerk as the preferred future auth provider | Early preference, pending review | **Superseded by D11** |
| D7 | 2026-11-02 | Programmatic SVG templates rather than AI images; the local image-model trial waits for approval | Accurate by construction; no suitable free GPU path on this hardware | Active ([M7_ILLUSTRATION_OPTIONS](quality/M7_ILLUSTRATION_OPTIONS.md)) |
| D6 | 2026-11-02 | Silent evaluation mode (`--silent`) for pipeline evaluation | Saves ElevenLabs credits; silent runs never appear in My Videos | Active |
| D5 | 2026-11-01 | **Strict $0 policy:** free tiers only; the paid illustration budget withdrawn | User decision | Active |
| D4 | 2026-11-01 | `GEMINI_MODEL=gemini-3.6-flash`, with fallback on timeout | Gemini 3.8 Flash was hanging | Active |
| D3 | 2026-11-01 | The web app runs the pipeline CLI as a separate process per video, one at a time, with status read from `manifest.json` | Reuses the proven CLI; rendering is CPU- and memory-heavy | Active (worker design reviewed in F14) |
| D2 | 2026-10-31 | Git flow: work on `dev`; `main` only through PRs the user merges | Reviewable history | Active |
| D1 | 2026-10-26 | Pipeline: Gemini → ElevenLabs → Remotion, 9:16 MP4 | Free tiers available; Remotion gives code-driven, accurate visuals | Active |
