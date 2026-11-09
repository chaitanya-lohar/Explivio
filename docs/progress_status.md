# Explivio — Progress Status

Last updated: 2026-11-09. **F14 (Vercel): preview deployment works end to end (sign-in, email, cloud render in Sandbox, R2, watch and download). Before production: Resend domain, Terms/Privacy, production variables. [Plan](deployment/F14_PRODUCTION_PLAN.md).**

This file is the concise current status; the newest changelog entries are at the top of the changelog. The durable context is in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), future phases in [ROADMAP.md](ROADMAP.md), and decisions in [DECISIONS.md](DECISIONS.md). Milestones follow [Explivio_Prototype_Implementation_Plan_v1.docx](Explivio_Prototype_Implementation_Plan_v1.docx).

## At a glance
| Phase | Status | On `main`? |
|---|---|---|
| M1–M7, F1–F4, auth screens, F6, F7, F9 | ✅ Done | Yes |
| F10: MongoDB Atlas and self-managed auth | ✅ Done (1 closeout item left, yours) | Yes (PR #5) |
| F11: Cloudflare R2 video storage | ✅ Done, verified on real R2 | Yes (PR #6/#7) |
| F12: auth and authorisation hardening | ✅ Done | Yes (PR #7) |
| Retest before F13 (43/43, prerender fix) | ✅ Done | Yes (PR #7) |
| F13: transactional email (Resend, durable queue) | ✅ Done; real delivery verified to your address (other recipients need a domain) | Yes (PR #8) |
| F14: production readiness | ⬜ Next | — |
| F15: final product validation | ⬜ Planned | — |

## Completed
- **M1–M7:** the pipeline (Gemini storyboard → ElevenLabs narration → Remotion render), captions, music, six animated templates. M7 is also called F8.
- **F1–F4, auth screens, F6, F7, F9:** web app, real pipeline, My Videos, Settings, end-to-end QA.
- **F10: MongoDB Atlas and authentication** (2026-11-03/04; commits `cc36dad`, `8532210`, `a47976a`, `34cb666`, `d2dce3e`, `9be6dec`).
  - Self-managed accounts in the `explivio` database, sessions, per-user ownership of videos and settings.
- **F11: Cloudflare R2 video storage** ✅ (2026-11-05; `0760ca5`, `71c5e8e`, `f2b6ea9`, `f1a35ab`).
  - New videos upload to the private bucket `explivio-assets` and are verified before they're ready.
  - Playback streams from R2 with seeking; downloads use 5-minute signed links; Try again re-uploads without re-rendering; a free-tier guard stops uploads at 80%.
  - Verified: `r2:check` 10/10; browser end-to-end 39/39.
  - Reports: [architecture](storage/F11_R2_STORAGE_ARCHITECTURE.md), [implementation](storage/F11_R2_IMPLEMENTATION_REPORT.md).
- **F12: authentication and authorisation hardening** ✅ (2026-11-05; `2cdf66f`, `7cde3d7`, `d5d98c0`, `44199cc`).
  - **Audit:** 11 findings, one High: the sign-in limit could be bypassed by forging the client address, reproduced on the old code and fixed.
  - **Fixed:** per-account sign-in limit in durable MongoDB counters; equal-time sign-up and forgot-password; old session revoked on re-sign-in; 256-character password cap; 10 new videos per account per 24 h; secret-free security log; hardening headers; keys file ignored.
  - Verified: browser end-to-end 36/36.
  - Reports: [audit](security/F12_SECURITY_AUDIT.md), [implementation](security/F12_SECURITY_IMPLEMENTATION_REPORT.md), [test matrix](security/F12_SECURITY_TEST_MATRIX.md).
- **Clean-up and retest** (2026-11-05; `8346b9c`, `e752338`).
  - Every old video deleted at your request; `NODE_ENV` and `APP_ENV` removed from `web/.env.local`.
  - Full browser regression 43/43, replacing the old F6/F7/F9 suites behind sign-in.
  - Fixed the "`new Date()` while prerendering" error logged on signed-in pages.

## In progress: F13 transactional email (Resend)
- **Code complete and tested** (2026-11-06; `907db56`, `002f950`):
  - **Queue and worker:** a durable MongoDB queue (`emailJobs`), sent by a worker inside the server or by `npm run email:worker`.
  - **Providers:** outbox (default), Resend and test.
  - **Templates:** responsive HTML and text for verification, reset, password changed and existing account.
  - **Safety:** link tokens are created at send time (never stored in the queue); uncertain sends are never repeated; at most 90 emails per UTC day (below Resend Free's 100).
- **Verified:**
  - web 102/102 with live Atlas (8 email tests, 9 live queue tests);
  - browser regression 34/34 through the in-server worker;
  - F12 timing still equal (sign-up 1511 vs 1506 ms);
  - pipeline 63/63, `r2:check` 10/10; typecheck, lint and build pass.
- **Pending:**
  1. ~~Real Resend test~~: ✅ **Real delivery verified 2026-11-06** (your Resend address only): Resend accepted 3 emails (account-exists notice, because the address already had an account; reset link; password changed), you confirmed they arrived, and the queue kept no addresses. Today's count: 3, within the approved 3.
  2. **Delivery to other users** needs a domain you own (none bought; Resend's testing domain only reaches your own address).
  3. ~~Merge F13 into `main`~~: ✅ merged through PR #8 (2026-11-06).
  4. **F14:** keeping the worker running on a production host; delivery webhooks.
- Reports: [architecture](email/F13_EMAIL_ARCHITECTURE.md), [implementation](email/F13_IMPLEMENTATION_REPORT.md), [setup guide](email/F13_SETUP_GUIDE.md).

## Your open actions
1. ~~Run the real Resend test~~: ✅ done 2026-11-06.
2. ~~Open and merge the F13 PR~~: ✅ done (PR #8).
3. In Atlas, reduce the `explivio_app` user from `atlasAdmin` to `readWrite` on `explivio` (F10 closeout).
4. ~~Delete the unused `SMTP_PORT` line~~: ✅ done (`EMAIL_TRANSPORT=resend` is now set).
5. Optional: set a Cloudflare Budget Alert for R2 if you haven't.

## Next
- **Paused at your request (2026-11-06):** the next phase, F14 production readiness, starts later, when you ask. Until then, only your open actions above remain.

## Planned
- F15: final product validation.

Scope and dependencies: [ROADMAP.md](ROADMAP.md).

## Optional backlog
- ~~Parked: free fallback narration voice~~: **done 2026-11-08**; see the changelog and [FREE_VOICE_IMPLEMENTATION.md](voice/FREE_VOICE_IMPLEMENTATION.md).
- M7 silent topics S8–S12 (Gemini quota).
- Narrated evaluation after 2026-11-26.
- Human audio review.
- Accessibility (screen-reader) review.
- Image-generation trial (unapproved); leftover Stitch fixes.

## Current test results (2026-11-06)
| Suite | Result | When / notes |
|---|---|---|
| Web (`web: npm test` with `MONGODB_URI_TEST`) | **102/102** | 2026-11-06 after F13, including live Atlas (offline: 76 pass, 26 skipped) |
| Pipeline (`npm test`, root) | **63/63** | 2026-11-06 |
| Real R2 (`npm run r2:check`) | **10/10** | 2026-11-06 |
| Typecheck, lint, production build | Pass | 2026-11-06 |
| F13 browser regression (email queue, real Atlas and R2) | **34/34** | 2026-11-06 |
| Full browser regression (before F13) | **43/43** | 2026-11-05 |
| F12 browser end-to-end | 36/36 | 2026-11-05 |
| F11 browser end-to-end | 39/39 | 2026-11-05 |
| Real Resend delivery | **3/3 accepted and received** | 2026-11-06, your Resend address |

## Risks
| Risk | Impact | Owner | Resolution |
|---|---|---|---|
| No email reaches other users until a domain you own is verified in Resend | New users can't verify by email in production | User | Verify a domain later (never bought under the $0 rule); until then the outbox or your own address only |
| The email worker needs a long-running process | Emails wait in the queue on serverless hosting | Claude (F14) | Separate worker or scheduled run; jobs are durable meanwhile |
| R2 needs an active Cloudflare subscription; overages bill automatically with no cap | Unexpected cost | User + Claude | Upload guard at 80% of the free tier; Cloudflare usage alert; monitor R2 → Metrics |
| Your public IPv4 address changes often (Jio: 157.48.111.100 → 157.48.86.69 → 157.48.221.175 in 4 days) | Atlas blocked the app ("Accounts are temporarily unavailable") | User (done) | **2026-11-09:** Atlas Network Access now allows the range `157.48.0.0/16`, so changes inside it no longer block. Before Vercel: switch to `0.0.0.0/0` together with a readWrite-only user and a long random password |
| Atlas user has `atlasAdmin` | Too much access if the URI leaks | User | Reduce to `readWrite` on `explivio` |
| A known email can be locked for 15 min by 10 wrong guesses (F12 trade-off) | The owner waits, or resets the password | User (accepted) | Password reset lifts the lockout |
| Per-address limits trust a forgeable header until there's a trusted proxy | Best effort only; per-account and global limits carry security | Claude (F14) | Proxy that overwrites `X-Forwarded-For` |
| Rendered files pile up in `runs/` (no cleanup policy) | Disk growth | Claude (F14) | New videos go to R2; retention policy in F14 |
| ElevenLabs credits used up (until 2026-11-26) | None for availability: narration falls back to the free Kokoro voice (quality a little lower, +30–40 s per video) | Claude (done) | `NARRATION_PROVIDER=auto` (default); [details](voice/FREE_VOICE_IMPLEMENTATION.md) |
| Gemini free-tier 429s | Generation fails until the quota resets | User | Retry later; no billing |
| Render about 2 GB of RAM; free memory dipped to 1.6 GB | Render failures; hosting cost | Claude (F14) | Separate worker; measured sizing |
| Only Chrome tested | Unknown issues in other browsers | Claude (F15) | Cross-browser pass |

## Git
- Work on `dev`; `main` changes only through a PR you merge: https://github.com/chaitanya-lohar/Explivio/compare/main...dev
- **2026-11-09:** `main` has the same content as `dev` (PRs #5–#9 merged; `main` also holds the PR merge commits, which change no files).

## Milestones

| Milestone | Status | Notes |
|---|---|---|
| M0 — Setup / provider validation | ✅ Done | Gemini and ElevenLabs keys work (`npm run check:apis`). `.env` is gitignored. |
| M1 — Script / storyboard | 🟡 Built, not evaluated | Gemini storyboard with Zod validation and one repair attempt (`src/providers/gemini.ts`). The "8/10 valid" acceptance test has not been run or recorded. The longer director prompt (pasted 2026-10-28) is not integrated yet. |
| M2 — Narration | ✅ Done | ElevenLabs TTS with character alignment. Durations measured. Per-scene narration with word timings added for the API video. |
| M3 — Visual renderer | 🟡 Partial | Generic renderer (`video.tsx`), editorial renderer with science themes (`editorial.tsx`), and a fully animated, hand-built API explainer (`api.tsx`). Its scenes are specific to that topic, not yet reusable templates. |
| M4 — Captions / timing | 🟡 Partial | Word-level captions and scene cuts follow measured audio in the API video. The generic `generate` path still times scene changes from storyboard estimates. |
| M5 — End-to-end | 🟡 Built, not evaluated | `npm run generate -- "<topic>" --duration 60` runs prompt → storyboard → narration → MP4 with a manifest. The "8/10 runs succeed" target has not been measured. |
| M6 — Evaluation | ✅ Done (subset) | 10 real videos evaluated (5 baseline, 5 after fixes) with automated checks and a 100-point scorecard. Average score 69.2 → **82.8**, pass rate 2/5 → **5/5**. Fixed: duration (word budget), scene sync (narration-aligned, drift 4.0 s → 0.9 s), visuals (storyboard-driven diagrams, no production notes or demo copy), Gemini timeouts/skip/retry. All four caption/music configs verified in the MP4. 16 regression tests (`npm test`). 7 longer topics (60–90 s) not run: ElevenLabs credits. Reports: [docs/quality/](quality/). |
| M7 — Visual Intelligence | ✅ Implemented (evaluation 7/12 topics; 5 pending Gemini quota) | **Results:** visual 16.3/20 on 7 silent topics and 16.5 on 2 narrated videos (M6 12.2); overall 88.5/100 on 2 narrated videos (M6 82.8); sync drift 0.00 s; every automated check passes. Scored by Claude's frame review plus measurement, not a human review. Report: [M7_EVALUATION.md](quality/M7_EVALUATION.md). | Reusable animated templates (orbit, cycle, layers, flow, timeline, comparison) chosen and filled from a backward-compatible storyboard v2; reveal-on-mention timing; script quality (character budget, hooks, endings); a 3-topic AI illustration experiment before any integration; silent evaluation mode to save ElevenLabs credits. Plan: [docs/plans/M7_VISUAL_INTELLIGENCE_PLAN.md](plans/M7_VISUAL_INTELLIGENCE_PLAN.md). |
| Dashboard design (Stitch) | 🟡 Mostly fixed | 11 screens reviewed against [the design doc](Explivio_Dashboard_Design_Document_v1.docx). Two Stitch edit passes (2026-10-31) removed invented credits, quotas, plans, expiry periods and unsupported options, added mobile layouts, and fixed contrast and labels. Stitch keeps each edit as a new screen version. QA: 6 of 11 screens pass every check. Outstanding: Progress screen still contains "Synthesizing frame…" text, List view scrolls sideways by 188px at phone width, three secondary labels at 4.30–4.46:1 contrast (target 4.5). |
| Dashboard frontend — F1 foundation | ✅ Done | `web/`: Next.js 16, React 19, TypeScript strict, Tailwind 4. Design tokens, 13 UI primitives, app shell (desktop sidebar, tablet icon sidebar, mobile drawer), 7 placeholder routes, mock service layer. `lint`, `tsc` and `build` pass. Live QA at 1440/820/390px: no overflow, contrast, label or small-text issues. See [web/README.md](../web/README.md). |
| Dashboard frontend — F2 Home + creation flow | ✅ Done | Home dashboard (prompt composer, ideas, recent videos), Create (step 1) and Settings (step 2) with a summary panel. Generate runs a server action against the mock service, then moves to `/generating`. Prompt and settings travel in the URL. Functional test 19/19 (validation, idea fill, URL hand-off, defaults, summary updates, loading state, server action, edge cases). Layout QA 6 pages × 3 widths clean. Generation progress itself is F3. |
| Dashboard frontend — F3 progress, failure, video ready | ✅ Done | `/generating` follows real status from `GET /api/videos/[id]` every 2s: four pipeline stages (plan, narration, render, finishing), an indeterminate bar (no fake percentages), a failure view with saved settings, Try again and Edit settings. When the video is ready it opens `/videos/[id]`: native 9:16 player and Download MP4 (streamed with HTTP Range support), plus Regenerate. Expired videos show saved settings and Regenerate. The mock service steps jobs through stages on a timer; the "How APIs work" sample streams the real MP4 from `runs/`. Tests: file route (200/206/416, download header, bytes identical, no path leak), browser flow 18/18. |
| Dashboard frontend — F4 real pipeline | ✅ Done | Generate starts the CLI (`src/cli.ts`) for each video, in its own process, with a web-chosen run id. Status comes from the run's `manifest.json` (real stages: storyboard → narration → render). The MP4 streams from `runs/<id>/video.mp4`. Voice, captions and music reach the render (new CLI flags `--prompt-file`, `--run-id`, `--no-captions`, `--music`). One video at a time, with a clear message if busy. Failures show the real reason (cleaned of paths and keys) with Try again. Existing CLI runs appear in My Videos. `VIDEO_SERVICE=mock` keeps the sample data for UI work. Real test 2026-11-01: "Why the Moon has phases" (30s, male voice, music) rendered end to end in 272s, via Try again on a run that had failed on a Gemini timeout. |
| Dashboard frontend — F6 My Videos | ✅ Done | `/videos` is a full library over the real run list (web and CLI runs, nothing invented). Search by title or original prompt (case-insensitive, every word must match; no separate topic field exists), status chips with counts (Ready, Generating, Failed; Expired/Draft only when such videos exist), sort (newest default, oldest, title A–Z/Z–A), grid/list toggle. All of it combines, runs in the browser (no request per keystroke) and is kept in the URL, so Back from a video restores it. Cards and rows show a real frame from the MP4, title, prompt, measured length (or target when not rendered), date and status. Preview opens the existing player in a dialog; Download MP4 uses the existing file route. Neither appears for failed, generating or unavailable videos. States: empty library, no results with Clear filters, loading skeleton, error with Retry (header stays), unavailable/expired. While a video generates the list refreshes every 5s. Tests: 9 unit tests (`web: npm test`) and 53/53 browser checks at 1440/1280/768/375 (real, empty, failing and mock libraries). |
| Dashboard frontend — F7 Settings | ✅ Done | `/settings` sets the defaults for new videos, and the creation flow really uses them.
  - **Editable:** duration (30/60/90), narration voice (Female/Male, the pipeline's two voices; IDs stay in the server `.env`), captions and background music.
  - **Fixed, shown as such:** language (English) and format (9:16).
  - **Saving:** automatic, confirmed with a toast. Reset to defaults asks for confirmation.
  - **Storage:** one versioned record in this browser's `localStorage`, read safely field by field, behind `usePreferences()`. It syncs across tabs and can later be replaced by a backend.
  - **Creation flow:** Home, Create and Configure start from the saved defaults. A choice made for one video wins for that video only. The generation request is unchanged.
  - **Tests:** 8 unit tests; 41/41 browser checks (the Generate payload verified through the mock service, so no paid calls). |
| F9 — End-to-end QA and stability | ✅ Done (about 95%) | **Full journey validated** on a production build against the real pipeline service with a stub CLI (no API calls).
  - **Results:** browser journey 62/62, responsive 64/64 (5 widths × 11 pages), My Videos 53/53, Settings 41/41; root tests 63/63, web tests 27/27; lint, both typechecks and the build pass; gallery passes; 22 of 27 existing videos pass the validator (the 5 failures are pre-fix baselines and demos).
  - **Fixed:** a duplicate-render race; path leaks in error details; under-44 px touch targets on phones; captions spanning scene changes (K5).
  - **Blocked or not tested:** new narrated runs (credits preserved), S8–S12 (Gemini quota), human listening, other browsers.
  - **Readiness:** ready for F10. Report: [F9_END_TO_END_QA_REPORT.md](qa/F9_END_TO_END_QA_REPORT.md). |
| F10 — Real authentication | ✅ Built and tested (about 90%); old-video migration awaits your approval | Self-managed accounts on MongoDB Atlas (`explivio` database). The five Stitch screens are connected: sign-up, verification link, sign-in/out, forgot/reset. Sessions are HttpOnly cookies with server-side records; protected pages and APIs; per-user ownership of videos and settings (another user's video answers 404). **Tests:** web 56/56 (incl. live Atlas), browser end-to-end 70/70 with two accounts, pipeline 63/63; typecheck, lint and build pass. **Limits:** emails go to a local outbox until there's a domain; the F6/F7/F9 browser suites still need a login step. Docs: [implementation](auth/F10_AUTHENTICATION_IMPLEMENTATION.md), [architecture](auth/F10_AUTHENTICATION_ARCHITECTURE.md). |
| Authentication UI (screens only) | ✅ Done | `(auth)` route group with its own layout (no sidebar): `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/reset-password`, built from the 5 Stitch auth screens after removing invented claims and QA leftovers. Forms validate on client and server and call `services/mock/auth.ts`, which checks nothing, stores nothing and sends no email; every success says so. Sign-up goes to verify-email (masked address only); reset goes to login with a confirmation. Tests: 26/26 browser checks; layout clean at 1440/1280/768/375. *(Since 2026-11-04 the mock is gone and these screens use the real F10 authentication.)* |
| Real authentication (historical row) | ✅ Superseded by the F10 row above | Choose how accounts work: a hosted service (e.g. Clerk, Auth0, Supabase Auth) or our own backend and database. Then add real sign-up/sign-in, email verification and reset emails, sessions, sign-out, protection for the dashboard routes, and Terms/Privacy pages. The screens are ready: only `services/mock/auth.ts` needs replacing. |

## Latest outputs

| Date | Output | Notes |
|---|---|---|
| — | none | Every earlier video, including "How APIs Work" (accepted 2026-10-29), was **deleted on 2026-11-05 at your request**. New videos are stored in Cloudflare R2. |

## Known issues and constraints

- **Visuals are diagrams, not illustrations (M6 O1):** relevant and synced now, but no real imagery. Biggest remaining quality gap.
- **ElevenLabs credits nearly used:** about 270 characters left (estimated) until 2026-11-26. The 2026-11-04 web video "How ChatGPT Answers Questions" used about 435 of the 705. 90-second narrated videos are still untested.

- **Gemini 3.8 Flash is hanging (2026-11-01):** `gemini-3.8-flash` (and 3.7, flash-latest) didn't respond, even to a one-word prompt, while `gemini-3.6-flash` answered in about 2s. The pipeline now falls back to 3.6 on timeouts, but the wait cost about 170s per video. Recommended: set `GEMINI_MODEL=gemini-3.6-flash` in the root `.env` until 3.8 recovers.
- **Generic video visuals are basic:** topics other than the rain and photosynthesis demos get a neutral background and storyboard-based step cards. That's correct but plain, with no illustrations. Before 2026-11-01 they wrongly reused the rain photo and rain text. Reusable visual templates (M3) are the fix.
- **Captions-off and music-off renders not yet visually checked:** the flags are wired and verified in the render input; the real test used captions on and music on.
- **One video at a time:** rendering is CPU-heavy on this machine. Restarting the web server while a video renders loses its live process tracking. The render continues, and a run silent for 15 minutes is marked failed.

- **Terms and Privacy pages missing:** the sign-up terms checkbox refers to a Terms of Service and Privacy Policy that don't exist yet. (Real authentication has existed since F10.)
- **Email:** the outbox stays the default. With `EMAIL_TRANSPORT=resend`, Resend Free delivers **only to your Resend account address** until a domain you own is verified (F13).
- **Video files are local only:** `runs/` on this laptop; there's no R2 integration yet (F11).

- **Indian-English voice unavailable:** ElevenLabs returns HTTP 402 for library voices through the API on the free plan. Set `ELEVENLABS_NARRATOR_VOICE_ID` after upgrading.
- **ElevenLabs credits:** free plan, 10,000 characters per month. Each API video render uses about 700.
- **No sound in VS Code preview:** the built-in MP4 preview may not play AAC audio. Use a regular media player.
- **Version warning:** Remotion warns that zod 4.6.7 is installed but it expects 4.5.4. Renders still succeed.
- **Plain-text API key:** `mcp.json` stores the Stitch (Google) API key in plain text. It is now gitignored, but consider moving the key into an environment variable.
- **Web: unknown video IDs return HTTP 200:** `/videos/<unknown>` renders the not-found page (with `noindex`), but streaming means the status code stays 200.
- **Web: sidebar profile text:** the F1 brief asked for "Studio Suite" and a user role in the sidebar, which the corrected Stitch screens had removed. Since F10 the sidebar shows the signed-in user's name and email.
- **Provider costs:** not yet recorded in run manifests.

## Earlier phase plans

The former "Next phase" plan (F4, written 2026-10-31) was completed on 2026-11-01; see the changelog. Current and future phases: [ROADMAP.md](ROADMAP.md).

## Zero-cost policy (2026-11-01, non-negotiable for now)

**Budget: $0.** No billing on any provider, no credit purchases, no upgrades, no paid API calls. Only free tiers within their quotas; when a quota runs out, that work pauses. Paid services are reconsidered only when we decide to prepare for public launch.

- **Gemini:** free tier only. The billing status of the Google Cloud project behind the key **must be confirmed by you** in AI Studio (it isn't visible to the API key).
- **ElevenLabs:** existing free allowance only (about 270 characters, estimated, until 2026-11-26).
- **Paused / skipped:** Gemini image-generation experiments (free availability can't be verified). A local image-model trial needs your go-ahead (Python install + model download).

## Decisions (2026-11-01)

- **Gemini model:** `GEMINI_MODEL=gemini-3.6-flash` applied to the local `.env` (only that line changed).
- **Next milestone:** M7 Visual Intelligence: six programmatic templates first, then planning, script quality and silent evaluation. Illustrations are investigated at zero cost only (the earlier paid budget was withdrawn); no generated images in production until you review.
- **Deferred:** the 90 s and remaining 7-topic evaluation, until ElevenLabs credits reset on 2026-11-26 (unless more credits are added).
- **Authentication:** Clerk was the preferred direction at the time. *Superseded on 2026-11-03 by self-managed authentication on MongoDB Atlas (see [DECISIONS.md](DECISIONS.md) D8–D11).*

## Next steps

1. Your open actions (top of this file): the real Resend test, the F13 PR, and the Atlas role.
2. **F14: production readiness**, paused until you ask; then F15 ([ROADMAP.md](ROADMAP.md)).
3. Optional backlog, without delaying the above.
4. Merge `dev` into `main` through a PR after each reviewed phase.

## Changelog

- **2026-11-09** — **F14 preview deployment: works end to end** (tested by the user: sign-in → create a 60 s video → cloud render in Vercel Sandbox → watch → download).
  - Fixed on the way: emails on Vercel were queued but never sent (a startup hook lives in a different module instance); now `enqueueEmail` schedules the send with `after()` itself. Confirmed in the logs (`email_accepted`).
  - `R2_ACCOUNT_ID` in Vercel failed validation (paste problem); re-set from the local file through the CLI.
  - Gemini needed 30–50 s per storyboard, so the 45 s timeout failed; now 90 s (default in code and `GEMINI_TIMEOUT_MS=90000` on Vercel).
  - Mistake: the first `vercel deploy` went to **production** (the CLI's default for a project's first deploy). `explivio.vercel.app` serves pages but has no variables, so nothing works or leaks there. Removal awaits the user's decision. Later deploys use `--environment=preview`.
  - Before production: a verified Resend domain (otherwise only the Resend account's own address receives email), Terms and Privacy pages, production variables, then promotion after approval.

- **2026-11-09** — **F14 Steps 5–6: production configuration.**
  - Email on Vercel: each queued email is sent right after the response (`after()`); a daily cron (`/api/cron/email`, `CRON_SECRET`) sends anything left. The outbox is refused on Vercel. Email links use `EXPLIVIO_APP_URL` or Vercel's own URL variables (never the Host header).
  - `AUTH_SECRET` is required on Vercel; client IP from Vercel's `x-real-ip`; HSTS on Vercel; `web/vercel.json` (Next.js, cron); Node 24.x.
  - Vercel preview variables set (non-secret): RENDER_DISPATCH=sandbox, SANDBOX_SNAPSHOT_ID, RENDER_RESOLUTION=720p, NARRATION_PROVIDER=kokoro, EMAIL_TRANSPORT=resend, MONGODB_DB. The secrets are added by the user in the dashboard.
  - Build, typecheck, lint pass; web non-live suite 85/85.
  - Not done yet: free Resend domain (until then only the Resend account's own address receives email), Terms/Privacy pages, health/backup (Steps 7–8).

- **2026-11-09** — **F14 Step 3 done: cloud rendering in Vercel Sandbox.**
  - Snapshot (`npm run sandbox:snapshot`): allow-listed code, Chrome libraries, npm packages, Remotion Chrome, Kokoro model; 2.3 GB, never expires, built in 59 s. Current id: `snap_T3Pn2bG4sk0CuQCpedP3TpLB1EUa` (set as `SANDBOX_SNAPSHOT_ID`).
  - `RENDER_DISPATCH=sandbox`: the request records the job in MongoDB, starts one non-persistent sandbox from the snapshot (20 min hard timeout) and returns. `scripts/render-worker.mts` renders, reports progress, uploads to R2 and stops its own sandbox. Only pipeline keys are passed in (no auth or email secrets).
  - Local and cloud renders share one executor (`run-executor.ts`).
  - **Measured (90 s video, 4 vCPU, Kokoro):** 1080p 186 s, **485 s active CPU** (about 37 videos/month on Hobby's 5 h); 720p 150 s, **387 s** (about 46/month, 8.3 MB vs 12.9 MB). In the cloud 720p saves about 20%.
  - Found: SDK sandboxes are persistent by default and auto-snapshot on stop; all ours are now `persistent: false`. Three throwaway auto-snapshots from tests remain (expire in about 30 days; deletion awaits approval). In-sandbox `poweroff` doesn't work, so the worker stops the sandbox through the API.
  - **Tests:** 3 new dispatcher tests; web non-live suite 85 pass / 0 fail. The 27 live-Atlas tests can't run now that the database user is limited to `readWrite@explivio` (they use throwaway `explivio_test_*` databases); they need a separate test user or role.
  - $0.

- **2026-11-09** — F14 approved: (A) Vercel Sandbox only, (B) 720p public videos, (C) email through Resend (a domain must be verified in Resend for other users; a free subdomain will be researched in Step 5), (D) plan approved.
  - **Step 1 done: video status in MongoDB.**
    - A run supervisor (`services/pipeline/run-status.ts`) mirrors the pipeline's progress (status, stage, title, safe error, length) plus a 30 s heartbeat into `generationAttempts`.
    - `videoProjects` now stores the request settings, so status, title, retry and regenerate work **without a run folder** (as on Vercel).
    - Untracked runs keep the file view. A record-only run shows as queued, or fails after 15 min if it never started.
    - The busy check uses the MongoDB heartbeat, so one render at a time across instances and the sandbox.
    - `RENDER_DISPATCH=local|sandbox`; sandbox arrives in Step 3.
  - **Tests:** web **109/109** with live Atlas (6 new pipeline tests and a new live `runs-mongo` test; all 23 earlier pipeline tests unchanged); pipeline 68 + 1 skipped; typecheck and lint pass.
  - $0.

- **2026-11-09** — F14 detailed plan written (not implemented): [deployment/F14_PRODUCTION_PLAN.md](deployment/F14_PRODUCTION_PLAN.md).
  - **Shape:** website on Vercel; rendering in Vercel Sandbox; run status in MongoDB; email via `after()` plus a daily cron; production config (`AUTH_SECRET` required: the app currently writes a secret file, which fails on Vercel); Terms and Privacy pages, which the sign-up checkbox references but don't exist; backups to R2.
  - **Decisions needed:** render host (Sandbox recommended; Hugging Face free compute ended, GitHub Actions terms forbid it, Oracle and Cloud Run need a card); 720p for public videos; email to all users (Gmail SMTP, a free subdomain, or MMM's approach).
  - Documentation only; $0.

- **2026-11-09** — PR #9 merged: the free Kokoro narration voice, F13 email verification and the voice and Vercel docs are on `main`; `main` and `dev` are identical. After pulling `main` elsewhere, run `npm install` in the repo root; the voice model (about 311 MB) downloads on first use.

- **2026-11-09** — Atlas access: your provider changed your IP again (157.48.221.175), so you allowed the range `157.48.0.0/16` in Atlas Network Access instead of single addresses. Connection confirmed (`db:check` ok, 715 ms). App servers stopped after your manual test. Documentation only; $0.

- **2026-11-08** — Free, unlimited narration voice (Kokoro-82M) implemented and tested: **feasible**.
  - **Built:**
    - `src/providers/kokoro.ts` and `kokoro-worker.mjs`: speech in its own process, measured sentence timing, captions, MP3 through the bundled ffmpeg;
    - `providers/narration.ts`: `NARRATION_PROVIDER` = auto (ElevenLabs, otherwise Kokoro), kokoro or elevenlabs;
    - the CLI uses the selector; `kokoro-js` 1.2.1 pinned; the model (311 MB) is in `models/kokoro` (gitignored).
  - **Voices:** female `af_heart` (speed 1.0), male `am_michael` (speed 1.13, calibrated).
  - **Tests (no Gemini calls):**
    - full 90 s female video 13/13 (89 s of narration in 30 s);
    - male video through automatic fallback after ElevenLabs refused (quota): 13/13 after the speed calibration (the first run was 101 s, +11 s, and failed);
    - pipeline 69/69 including the real model; typecheck passes.
  - **Bugs fixed:** the male voice ran too long; curly-quote sentence ends weren't split; one older test updated for the selector.
  - **Known:** captions are timed per sentence (words estimated within each); `npm audit` flags 3 highs in `sharp` (images, never used here).
  - $0. Report: [voice/FREE_VOICE_IMPLEMENTATION.md](voice/FREE_VOICE_IMPLEMENTATION.md).

- **2026-11-07** — Decision: deploy on **Vercel**, later.
  - **Constraints checked in Vercel's official docs:** Hobby is non-commercial only; functions are limited to 300 s, 2 GB / 1 vCPU and a read-only disk (except /tmp); cron runs once a day on Hobby; video rendering needs Vercel Sandbox (Remotion's documented path).
  - **Recorded:** what has to change for Vercel in [deployment/VERCEL_NOTES.md](deployment/VERCEL_NOTES.md). F14 is not started. $0.

- **2026-11-07** — Free narration voice researched, trialled and parked.
  - **Problem:** a 60 s video failed because ElevenLabs credits are used up (267 left, 858 needed).
  - **Research:** Kokoro-82M (Apache-2.0, local) and Gemini TTS (free API) are the only lasting $0 options. Cloud TTS from Google, Azure and Amazon needs a card; OpenAI is paid; Edge is unofficial; XTTS and F5 are non-commercial.
  - **Kokoro trial on this laptop:** fp32 is 3.5× faster than q8 (0.6 s of work per second of audio; about 970 MB RAM). Samples are in `data/voice-trial/` (gitignored); the trial packages were removed again.
  - **Your concern:** how a local voice works after deployment. Answer: it runs on the render server, which F14 needs anyway; an API voice needs no server.
  - **Decision:** parked; F14 next. Nothing was added to the app. $0. Details: [voice/VOICE_FALLBACK_RESEARCH.md](voice/VOICE_FALLBACK_RESEARCH.md).

- **2026-11-07** — F13 real delivery verified, and the ElevenLabs problem raised.
  - **Email:** **Real delivery verified 2026-11-06** (your Resend address only): Resend accepted 3 emails (account-exists notice, because the address already had an account; reset link; password changed), you confirmed they arrived, and the queue kept no addresses. Today's count: 3, within the approved 3.
  - **Setup changes:** your IP changed again (now 157.48.86.69) and was added to Atlas; `EMAIL_TRANSPORT=resend` set; `SMTP_PORT` removed.
  - **New problem:** a 60 s video failed at narration because ElevenLabs free credits are used up (267 left; 858 needed; reset 2026-11-26). You asked for a free way to stop depending on ElevenLabs for voice; research is under way.

- **2026-11-07** — PR #8 merged: F13 is on `main`, and `main` and `dev` have the same content. Still pending: the real Resend test (`EMAIL_TRANSPORT` not set yet; 0 real emails sent), the Atlas role reduction, and removing `SMTP_PORT` from `web/.env.local`. F14 is paused until you ask.

- **2026-11-06** — Status tidy-up.
  - **Restructured:** the top of this file now has "At a glance" with `main` and `dev` status, Completed, In progress (F13), Your open actions, and current test results. F10–F13 entries were moved into the right sections.
  - **Recorded:**
    - PRs #6 and #7 are merged, so F11, F12, the clean-up and the retest are on `main`;
    - only the 2 F13 commits are waiting for a PR;
    - the real Resend test is still pending (0 real emails sent);
    - the next phase (F14) is paused until you ask.
  - Documentation only; $0.

- **2026-11-06** — F13 transactional email (Resend), durable queue.
  - **Approved choices:** Resend Free (approved over Gmail SMTP); no domain owned and none bought; at most 3 real test emails to your Resend address, after you switch `EMAIL_TRANSPORT=resend` on.
  - **`907db56`:**
    - `lib/email`: queue, worker (60 s lease, restart recovery, backoff, at most 5 submissions, 48 h limit, `unknown` never resent), providers, templates, 90-a-day guard;
    - auth sends are queued; tokens are created at send time; password-changed email added;
    - `emailJobs` added to `explivio` with `db:init` (additive).
  - **Tests:**
    - web 102/102 live (email 8/8 offline against a fake Resend endpoint; queue 9/9 live, stable over 3 runs);
    - browser regression 34/34; pipeline 63/63; `r2:check` 10/10; typecheck, lint and build pass.
  - **Correction recorded:** a suspected duplicate-key race in the daily counter was **not** real (the old code passes the 10-way race). The re-check stays as harmless extra protection; the failures were test bugs.
  - **Real emails sent:** 0. $0.
- **2026-11-05** — Full application retest before F13 (your request).
  - **Automated:**
    - web 85/85 with live Atlas; pipeline 63/63; typecheck, lint and build pass;
    - `db:check` ok; `r2:check` 10/10.
  - **Browser regression 43/43** (production build, real Atlas, real R2, stub pipeline, no AI calls). It replaces the old F6/F7/F9 browser suites, now behind sign-in:
    - sign-up, verification (single use), unverified sign-in blocked, sign-in and sidebar;
    - settings saved per account and used by Configure;
    - create → progress → Video ready from R2, with playback, seeking and download;
    - failure with Try again;
    - My Videos search, status chips, sort, list/grid and preview;
    - sign-out, forgot/reset with the old password refused;
    - second-account isolation;
    - 50 screen and width checks for overflow and 44 px targets;
    - no console or page errors; server log free of secrets and errors.
  - **Bug found and fixed:** almost every signed-in page logged the Next.js error "encountered the unstable value `new Date()` while prerendering". The cause was the MongoDB driver timestamping connection-pool events during the session lookup inside Next's runtime prefetch prerender. `getCurrentUser()` now calls `await connection()` before the database lookup, so sign-in state is always checked at request time and never prerendered or cached. After the fix: 0 errors in the server log.
  - The F10 closeout item "re-run the F6/F7/F9 browser suites with sign-in" is **done**.
  - $0.

- **2026-11-05** — Clean-up at your request.
  - **Deleted permanently** (no Git copy or backup):
    - every video run in `runs/` (21 folders, including "How APIs Work" and your account's "How ChatGPT Answers Questions");
    - the M6/M7 evaluation folders (`m7-silent`, `m7-gallery`, `voice-check`, `m7-narrated.log`);
    - 34 render-input copies in `public/runs/`, about 474 MB in all;
    - the one video record and generation attempt in `explivio`.
  - **Kept:** `runs/.gemini-health.json`, your account and settings, and all reports (their sample files are gone).
  - **Effects:** the F10 legacy-ownership migration and the F11 historical migration plan no longer apply.
  - **Environment:** `NODE_ENV` and `APP_ENV` were removed from `web/.env.local`; it now holds only the MongoDB and R2 settings.
- **2026-11-05** — F12 authentication and authorisation hardening: **complete**.
  - **Audit (`2cdf66f`):** 11 findings, 1 High; `CloudFareConfKeys.txt` ignored, contents never opened.
  - **`7cde3d7`:**
    - per-account sign-in limit, with the forged-address bypass reproduced on the old code;
    - MongoDB `rateLimits` (atomic, hashed keys, TTL), with `db:init` applied to `explivio` (additive);
    - equal-time sign-up and forgot-password (measured 537 vs 298 ms → 1506 vs 1507 ms);
    - the previous session revoked on sign-in; 256-character password cap; security log.
  - **`d5d98c0`:** 10 renders per account per 24 h; access-denied logging; security headers.
  - **Tests:**
    - web 85/85 live; security 8/8; browser end-to-end 36/36 on real Atlas and R2;
    - `r2:check` 10/10; pipeline 63/63; typecheck, lint and build pass;
    - only test bugs were fixed during the runs.
  - **Data:** your `explivio` data unchanged (1 user, 1 video); test databases and R2 test objects removed.
  - $0.
- **2026-11-05** — F11 verified on real Cloudflare R2 and Atlas: **complete**.
  - **Your setup:** R2 activated on the $0 plan (billable usage $0.00); private bucket `explivio-assets`; token limited to that bucket; keys in `web/.env.local`; this machine's IPv4 address added in Atlas (the browser had added the IPv6 one).
  - **Results:**
    - `r2:check` 10/10;
    - web 76/76 including live Atlas (the F11 metadata test proves a single claim wins);
    - browser end-to-end 39/39 (details in the implementation report);
    - three test-script bugs fixed; no app bugs found.
  - **Cleanup:** all test objects were deleted from R2 and the test databases dropped; only `explivio` remains.
  - $0.
- **2026-11-05** — F11 Cloudflare R2 storage: code and offline tests.
  - **Commits:**
    - `0760ca5` storage service: config, official AWS SDK adapter with Content-MD5, keys, free-tier guard, `npm run r2:check`.
    - `71c5e8e` integration: upload after render → verify → ready; R2 streaming with Range; signed-link downloads; upload-only retry; resume after restart.
  - **Decision:** you chose R2 knowing the checkout needs a payment method and overages bill automatically. The guard stops uploads at 80% of the free tier.
  - **Verified on official pages:** R2 free tier is 10 GB, 1M Class A and 10M Class B per month, free egress (Standard only).
  - **Tests:**
    - web 65 pass / 10 skipped / 0 fail;
    - pipeline 22/22, stable across 5 runs;
    - storage 10/10, with the real SDK against a fake S3 endpoint;
    - root 63/63; typecheck, lint and build pass.
  - **Bug found and fixed:** a race where a late automatic upload could overwrite a recorded failure.
  - **Not yet real:** no bucket or credentials; Atlas unreachable (IP access list). No historical video was touched.
  - $0; no Gemini or ElevenLabs calls.
- **2026-11-05** — Project context reconciled and roadmap documented (documentation only).
  - **New:** [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [ROADMAP.md](ROADMAP.md) (F10 closeout, F11 R2, F12 auth hardening, F13 Gmail, F14 production, F15 validation), [DECISIONS.md](DECISIONS.md) (D1–D18).
  - **This file:** restructured (Completed / Closeout / Next / Planned / Backlog / Risks). Stale "auth is demo-only", F4-plan and Clerk statements are marked superseded.
  - **Verified in code:** 6 collections and 10 indexes; auth modules; no R2 code or S3 SDK; email is outbox plus optional Resend, with no SMTP or Gmail.
  - **Found locally:**
    - an account was created on 2026-11-04;
    - one video ("How ChatGPT Answers Questions", 30 s, narrated) was generated under it, using about 435 ElevenLabs characters;
    - 20 of 21 runs still have no owner;
    - `NODE_ENV` and `APP_ENV` are still in `web/.env.local`;
    - `runs/` is 464 MB;
    - `main` equals `dev` (PR #5).
  - **Tests re-run:** pipeline 63/63; web 46 pass with 10 live tests skipped (no external calls).
  - **No changes to:** application code, database data, Atlas permissions or storage. $0.
- **2026-11-04** — F10 authentication built on MongoDB Atlas.
  - **Commits:**
    - `34cb666` core: scrypt, hashed single-use tokens, DB sessions, rate limits, honest email outbox, account service; 14 tests incl. live Atlas.
    - `d2dce3e` integration: the five Stitch screens connected; proxy plus server-side session checks; sign out; per-user ownership of videos (recorded in `videoProjects` before any render; 404 for others) and of settings (moved from localStorage to the account).
  - **Tests:**
    - Web 56/56 with live Atlas (throwaway databases dropped).
    - Browser end-to-end 70/70 on a production build with two accounts (isolation, cookies, brute force, open redirect, reset revoking sessions, logout invalidation, 5 screens × 5 widths).
    - Pipeline 63/63; typecheck, lint and build pass.
  - **Pending:** the old-video migration (dry run: 20 runs) needs your account and approval.
  - $0; no Gemini or ElevenLabs calls.
- **2026-11-04** — MongoDB Atlas connected and set up.
  - **Connection:** you added the Atlas connection string to `web/.env.local`; `npm run db:check` reports ok (1.7 s), and the app uses the `explivio` database.
  - **Isolation:** the cluster held only system databases, so no Make My Marriage data is present.
  - **Setup:** `npm run db:init` created 6 collections and 10 indexes (re-run safe).
  - **Tests:** the live Atlas test passed (duplicate email and plaintext password rejected by the database; the test database was dropped). Web tests 39/39; build passes.
  - **To tighten:** the database user's role is `atlasAdmin`; reduce it to `readWrite` on `explivio`.
  - **Not printed or committed:** the connection string or password.
  - $0.
- **2026-11-03** — Database configuration attempt.
  - **Added by you:** `web/.env.local` (gitignored).
  - **Connection test:** failed safely. `MONGODB_URI` points to a local MongoDB on this laptop where nothing is running, not Atlas, so `npm run db:check` reports `unavailable` and nothing was written. The connection string was never printed.
  - **Also found:** settings copied from Make My Marriage that Explivio doesn't use (including its secrets).
  - **Next step:** the database configuration is now step 1 above. MongoDB stays marked as not verified.
- **2026-11-03** — F10 MongoDB Atlas foundation, commit `cc36dad`.
  - **Decision change:** MongoDB Atlas is the single database, replacing the SQLite proposal (withdrawn, never committed).
  - **Built:**
    - the official `mongodb` 7.8 driver (no Mongoose);
    - `lib/db`: config validation, credential redaction, one shared client, safe errors;
    - six collections with indexes (unique email, ownership, TTL) and `$jsonSchema` validators;
    - `/api/health/db` and a startup configuration warning;
    - scripts `db:check`, `db:init` and `db:legacy-ownership` (dry run: 20 runs without an owner; not executed).
  - **Tests:** 13 new (12 pass offline, 1 live-Atlas test skipped). Web suite 38 pass / 1 skipped; typecheck, lint and build pass.
  - **Atlas free tier verified on official pages:** 0.5 GB, 100 ops/s, 500 connections, paused after 30 idle days.
  - **Not done:** no cluster is configured yet (your action); the authentication flows wait for approval.
  - $0.
- **2026-11-03** — F10 phase 1–2: architecture inspection and provider evaluation, [docs/auth/F10_AUTHENTICATION_ARCHITECTURE.md](auth/F10_AUTHENTICATION_ARCHITECTURE.md).
  - **Inspected:** the five Stitch screens (backed by a demo mock), no database (run folders), no sessions or ownership, F7 settings in localStorage, and the design docs (`users` / `ownerUserId` model).
  - **Verified on official pages:**
    - Clerk free: 50k retained users, but production needs your own domain, and custom flows verify by code.
    - Supabase free: built-in email only to team members at 2/hour; projects pause after 7 idle days.
    - Resend free: needs a verified domain.
  - **Compatibility checked:** `node:sqlite` (SQLite 3.53) and scrypt work on Node 24.19; the Next.js build compiles them (type package update needed); Next.js 16 `proxy` runs on Node.
  - **Recommendation:** self-managed. Awaiting your approval before implementation. No code changed.
- **2026-11-03** — F9 end-to-end QA, integration testing and stability. Report: [docs/qa/F9_END_TO_END_QA_REPORT.md](qa/F9_END_TO_END_QA_REPORT.md).
  - **Bugs found and fixed:**
    - B1 `d9f6904`: two simultaneous Generate requests started two renders; fixed with a start lock taken before the first await.
    - B2 `d9f6904`: error details leaked parts of paths containing spaces.
    - B3 `44340ba`: touch targets under 44 px on phones.
    - B4 / K5 `ac8214b`: caption cues spanning scene changes.
  - **New tests:**
    - Integration tests for the real pipeline service using a stub CLI in a temporary root (`web/tests/pipeline-service.test.ts`; concurrency, failures, quotas, retry, stale runs, invalid ids, redaction).
    - A cue-split unit test.
    - A 90 s storyboard fixture using all six M7 templates (rendered silently to 87 s; all checks pass).
  - **Executed:** root 63/63, web 27/27, browser journey 62/62, responsive 64/64, My Videos 53/53, Settings 41/41, gallery, video validator over all 27 videos, lint, typechecks and build.
  - **Known issues:** K1–K4 deferred with reasons; K6/K7 blocked by free-tier limits; K8 needs a person.
  - **Usage:** 0 Gemini calls, 0 ElevenLabs characters (705 left). $0.
- **2026-11-02** — M7 evaluation and report, [docs/quality/M7_EVALUATION.md](quality/M7_EVALUATION.md).
  - **Silent run:** 7 of 12 topics with real Gemini planning and renders, no narration. Areas: astronomy, earth science, geology, history/technology, technology.
    - All 7 succeeded, within duration, and passed every script check.
    - 27 of 28 scenes used a template; all six M7 templates were chosen where appropriate.
    - Visual average 16.3/20 (review).
  - **Gemini quota:** the free-tier quota was hit (429) on topic S8. The batch paused itself and S8–S12 are pending.
  - **Narrated:** 2 videos (Moon phases, water cycle) reusing those real storyboards, using 918 of the remaining ElevenLabs characters.
    - Every automated check passes, scene drift is 0.00 s, and totals are 90 and 87 (average 88.5, target 85).
  - **Scoring:** Claude's review of the frames plus automated measurement; not a human review, and narration is provisional.
  - **Fixed during the evaluation:**
    - two runs had used two corrections (an unknown `visual_type` now falls back, and a second invalid output fails);
    - hub spokes crossed the centre label;
    - the orbiter glide was too slow for late mentions.
  - **Tooling:** `--storyboard-file`, `rerender.mjs`, `contact-sheet.mjs`, `npm run m7:silent`, and the batch runner's exact credit estimate.
  - **Known issues K1–K8** are listed in the report.
  - $0.
- **2026-11-02** — M7 step 7: zero-cost illustration options report, [docs/quality/M7_ILLUSTRATION_OPTIONS.md](quality/M7_ILLUSTRATION_OPTIONS.md).
  - **Hardware re-checked:** Ryzen 5 5625U, integrated Radeon (512 MB reserved, no CUDA), 15.3 GB RAM, D: 157 GB free, no real Python.
  - **Compared** on image quality, educational accuracy, hardware fit, speed, storage, licence and complexity: programmatic SVG; SD 1.5-class and few-step models (ONNX DirectML or stable-diffusion.cpp Vulkan); SDXL/FLUX (don't fit); free-licence photo libraries; paid APIs (skipped).
  - **Recommendation:** keep programmatic visuals, which are accurate by construction, and add hand-built SVG illustrations next.
  - **Paused:** the optional local model trial (at most 9 images, about 3 GB on D:) awaits your go-ahead. Nothing was downloaded or installed. Also added `npm run m7:silent`, the evaluation batch runner.
- **2026-11-02** — M7 step 6 (mode): silent evaluation.
  - **Usage:** `npx tsx src/cli.ts "<topic>" --duration 30 --silent` runs the real pipeline (Gemini storyboard, script and visual checks, templates, Remotion render) without any narration call.
  - **Timing:** deterministic and labelled `estimated` (`pipeline/silent-timing.ts`). Each scene lasts its estimated speech time; inside a scene, words are spaced by letters plus sentence and clause pauses. Captions are built from those estimates.
  - **Separation from user-facing generation:**
    - Runs go to `runs/m7-silent/<id>`, so they never appear in My Videos.
    - Every frame shows a "SILENT EVALUATION · estimated timing" badge, and the manifest records `mode: "silent-evaluation"`.
    - The web app never passes `--silent`.
  - **Provider loading:** the narration provider is now loaded only on the narrated path.
  - **Validator:** `validate-run` accepts `m7-silent/<id>` and skips the audio checks for these runs.
  - **Tests:** 4 new (60 total), including a CLI run with a network guard that proves no ElevenLabs request is made.
  - **Smoke render:** the rain demo, rendered silently in 71 s, passed the validator's video, caption and blank-frame checks.
  - $0.
- **2026-11-02** — M7 step 5: script quality checks (`pipeline/script-checks.ts`, pure).
  - **Length:** judged by estimated speech time instead of word count.
    - The model is 0.0635 s per letter + 0.65 s per sentence end + 0.5 s per clause break, fitted on 12 real ElevenLabs runs. Mean error 2.8%, worst 9.2% (`npx tsx scripts/m7/speech-model-check.mjs`); characters alone give 4.6% / 13.6%.
    - Measured speech is about 15 characters per second, not the 17.5 the plan assumed.
    - Gemini gets a character target: 30 s → about 435 characters, 60 s → 885, 90 s → 1,335, each ±10%, aiming 1 s under the requested length for the end tail.
  - **Hook:** scene 1 must open with a concrete question or a specific fact. Greetings, "in this video", "today we will" and "let's dive in / break it down" are rejected.
  - **Ending:** one clear takeaway of at least 10 words that names the topic, with no sign-off or call to action, and not cut off.
  - **Relevance and structure:** topic terms (request words like "explain" and "beginners" ignored) must appear in the script. Scenes must be numbered 1..n, not trivially short, and not repeated, and their estimates must add up to roughly the length.
  - **Repair:** all failures join the single repair together with the visual problems. Leftovers are recorded as warnings in `manifest.storyboard.scriptChecks`. A script still off-topic fails with a clear message rather than rendering.
  - **Calibration on 10 past real storyboards:** 3 length misses, 2 generic hooks ("Let's break it down simply!", which M6 flagged by hand) and 2 weak endings were caught.
  - **Tests:** 9 new (56 total). $0, no API calls.
- **2026-11-02** — M7 step 4: Gemini now plans each scene's visual, and plans that contradict their narration are caught.
  - **Prompt** (`pipeline/visual-guide.ts`): every scene gets a `visual` and a `purpose`. The template is chosen from the relationship the scene explains:
    - one-way sequence → flow; repeating loop → cycle; body around body → orbit, with the orbited body as center;
    - stacked or nested parts → layers; chronology → timeline, with dates only when stated; contrast or likeness → comparison;
    - plus steps, hub, checklist and focus. Labels must use words the narration says.
  - **Lint** (`pipeline/visual-lint.ts`, pure) catches:
    - labels that are never spoken;
    - an orbit with no orbital motion in the narration (for example a road route);
    - the Sun at the centre of a Moon orbit, or planets orbiting the Moon or Earth;
    - a cycle that never repeats;
    - timeline dates out of order or not stated in the narration;
    - comparisons that don't name both sides;
    - one template for more than 60% of scenes.
  - **Repair:** problems join the single existing repair request, alongside the length problem. Scenes still wrong afterwards render the M6 fallback.
  - **Run record:** `manifest.storyboard.visualPlan` has, per scene, the template, source, purpose, animation sequence, which labels are spoken (the timing references) and any problems.
  - **Compatibility:** older storyboards still parse and render through the fallback.
  - **Tests:** 13 new (47 total). No API calls yet; live validation happens in step 6.
- **2026-11-02** — M7 step 3: orbit, layers and timeline templates; all six M7 templates now render.
  - **Orbit** (`templates/orbit.tsx`, pure geometry in `pipeline/orbit-geometry.ts`):
    - The central body sits in the middle, and the orbiter travels a dashed path counterclockwise.
    - An optional light source comes from the left, and the orbiter's lit half faces it, so Moon phases read correctly: new moon between Earth and the Sun, full moon opposite.
    - Markers are numbered on the path and listed in a legend. When the narration mentions a marker, the orbiter glides forward to it.
    - Body colours come from the label only. Which body is central comes from the plan and is checked in step 4.
  - **Layers:** stacked bands (atmosphere, network layers) or nested rings (Earth's interior, a cell), with notes and the active layer highlighted. Concentric rings replace a side-by-side layout, which doesn't fit a 9:16 frame.
  - **Timeline:** a vertical axis that grows to each event as it's mentioned. Dates are now optional in the schema, so they're shown only when the storyboard gives them.
  - **Schema:** an optional `purpose` field (the scene's educational objective) on every template.
  - **Gallery:** `npm run m7:gallery` covers 18 scenes, including Moon phases, Earth–Sun, the atmosphere, Earth's interior, and dated and undated timelines. It now fails if any finished still has an empty diagram area (a small PNG decoder in `scripts/m7/png.mjs`, no dependency).
  - **Fixed during review:** layer fills were invisible, because an `rgb()` colour had an alpha suffix appended.
  - **Tests:** 6 new (34 total).
  - $0, no API calls.
- **2026-11-02** — F7 Settings module (web).
  - **Preferences** `{durationSeconds, voice, captions, music}`, stored as `{version: 1, ...}` under `explivio.preferences`:
    - `lib/preferences.ts`: defaults that equal `appConfig` (60s, female, captions on, music off); a parser that never throws and falls back field by field for missing, corrupt, outdated or hand-edited data; `chosenOr`.
    - `features/settings/use-preferences.ts`: a `useSyncExternalStore` hook (server-safe, cross-tab, survives blocked storage).
  - **Settings page:**
    - `settings-form.tsx`: General (fixed language and format), Narration, Video, and Saved settings (what is stored, and Reset).
    - `settings-section.tsx`, `reset-preferences-dialog.tsx` (confirmation).
    - Reuses `RadioCard`, `Switch`, `Dialog`, and `FixedOption` and `IconLabel` (both moved out of the Configure form to be shared).
  - **Creation flow:**
    - Home, Create and Configure keep "explicit choice for this video, else saved default".
    - Configure waits for the saved values before enabling Generate and links to Settings.
    - Fixed `creationHref`: it used to drop `duration=60`, which would have let a saved 30s replace an explicit 60s choice.
    - The generation request and pipeline are unchanged, and saved videos keep their own settings.
  - **Not added:** voice preview (it would need ElevenLabs calls) and more languages or formats (the pipeline can't honour them).
  - **Tests:**
    - Web unit tests 17/17 (`npm test` in `web/`).
    - Browser QA 41/41: defaults; each change; refresh; Home, Create and Configure pick up saved values; payload with defaults; explicit override; explicit 60s; existing video unchanged; reset with cancel and confirm; corrupt, partly invalid and old-version storage; cross-tab update; real-service Configure; no overflow at 1440/1280/768/375; 44px targets; keyboard.
    - `lint`, `tsc` and `build` pass; the pipeline's tests pass 28/28.
  - **Known limitations:**
    - Preferences are per browser and device (no account yet).
    - A real narrated render with the chosen settings wasn't run (paid quota); the request → CLI flags mapping it relies on is unchanged since F4.
  - $0.
- **2026-11-02** — F6 My Videos module (web).
  - **New in `web/src/features/video-library/`:**
    - `library-query.ts`: pure search, filter and sort logic, plus URL state.
    - `video-library.tsx`: toolbar, status chips, view toggle, grid/list, empty and no-results states, refresh while generating.
    - `video-list-item.tsx`, `video-preview-button.tsx` (dialog that reuses `VideoPlayer`), `video-library-skeleton.tsx`, `video-library-error.tsx` (Next 16 `catchError` with Retry).
  - **Changed:**
    - `video-card.tsx`: prompt, length, Preview and MP4 actions, unavailable note.
    - `video-thumbnail.tsx`: real frame from the MP4; the caller sets the width.
    - `video-player.tsx`: optional `autoPlay` and `className`.
    - `TextInput` and `Select`: `hideLabel` pass-through.
    - `lib/format.ts`: `formatVideoLength`.
  - **Backend:** no changes. The existing `listVideos()` already lists web and CLI runs without exposing paths.
  - **Tests:**
    - New `web/tests/library-query.test.ts`, run with `npm test` in `web/` (Node's built-in runner; no new dependency). 9/9 pass.
    - Browser QA: 53/53 checks against four production servers (real runs, empty, unreadable library, mock with an expired video).
    - `lint`, `tsc` and `build` pass; the pipeline's tests pass 28/28.
  - **Known limitations:**
    - Thumbnails load a little of each MP4 in the browser; no thumbnail images are stored.
    - Search covers title and prompt only (there is no separate topic field).
    - Live refresh while a video generates was not exercised end to end, because that needs a paid-quota generation run.
    - A ready run whose MP4 is missing appears as Failed ("video file is missing"), as before.
  - $0.
- **2026-11-02** — M7 step 2: flow, cycle and comparison templates in `src/video/templates/`. The M6 layouts (steps, hub, checklist, focus) moved there too. `ConceptVisual` now draws each scene's v2 `visual` when it is valid and drawable, and the M6 layout otherwise. New runs pass narration word timings (`wordTimes`) to the render, so diagram items appear as they are spoken; older runs keep the M6 stagger (checked by rendering a still from a saved run). Mention matching improved: simple plural and verb endings are stemmed ("rests" ~ "Rest"), and a label is timed where most of its words are said together. New `npm run m7:gallery` renders stills of every template locally, with no API calls (24 stills reviewed). 3 new tests (28 total). $0.
- **2026-11-01** — M7 step 2 (started): `revealLabels()` in `src/pipeline/visual-plan.ts` lists the labels each template reveals and whether their order matters, for reveal-on-mention timing. 1 new test (26 total). Work paused here; template rendering starts next session. $0.
- **2026-11-01** — M7 step 1: storyboard v2 scene-planning format (`src/schemas/visual.ts`): validated data for orbit, cycle, layers, flow, timeline and comparison plus the four M6 layouts. Lenient per-scene parsing with deterministic fallback (`src/pipeline/visual-plan.ts`) and the reveal-on-mention timing helper (`src/pipeline/mention-timing.ts`). 9 new tests (25 total). No API calls, $0.

- **2026-11-01** — Adopted the strict $0 policy: withdrew the earlier paid illustration budget, skipped paid/billing-gated image APIs, recorded free-tier limits, and checked hardware for local image generation (integrated AMD GPU, no CUDA, no Python).

- **2026-11-01** — Set `GEMINI_MODEL=gemini-3.6-flash` in the local `.env` (approved). Recorded decisions. Wrote the M7 Visual Intelligence implementation plan.

- **2026-11-01** — M6 evaluation: 10 real videos scored (baseline 69.2 → after fixes 82.8). Added the word budget, narration-aligned scene timing, storyboard-driven concept diagrams, Gemini timeout/skip/retry with per-call metrics, the M6 validator, batch runner and report builder, and 16 regression tests. Reports in `docs/quality/`.

- **2026-11-01** — F4: the web app now runs the real pipeline. Added `services/pipeline/videos.ts`, the CLI flags `--prompt-file`/`--run-id`/`--no-captions`/`--music`, and captions/music support in the editorial renderer. Gemini now falls back to the second model on timeouts. Fixed generic videos showing rain visuals for unrelated topics. Real end-to-end video generated from the browser.

- **2026-10-31** — Added the "Next phase" plan: F4, connecting the web app to the real video pipeline, then M6 evaluation and real authentication. Clarified status: login and sign-up are screens only (no real accounts or protection yet); added a "Real authentication" milestone, an "At a glance" summary and branch/PR status.
- **2026-10-31** — Reviewed the 5 Stitch auth screens. Implemented them in `web/` as an `(auth)` route group with shared components (AuthLayout, AuthCard, AuthHeader, AuthFooter, AuthMessage, PasswordInput, PasswordChecklist, PasswordStrengthIndicator), typed validation, server actions and a clearly labelled mock auth service.
- **2026-10-31** — Built frontend milestone F3: generation progress with real stages, failure and retry, Video ready page (player, Range-streamed download, regenerate), expired view, status API route. Home, My Videos and video details now read status per request.
- **2026-10-31** — Built frontend milestone F2: Home dashboard, Create and Settings steps, `generateVideo` server action, RadioCard / SegmentedControl / Breadcrumbs components. Fixed a design-token clash (`text-card` font size also applied the card background colour, hiding text); the size token is now `text-title`.
- **2026-10-31** — Created the `dev` branch. Work is committed to `dev`; `main` changes only through pull requests from `dev`.
- **2026-10-31** — Set up git (remote: github.com/chaitanya-lohar/Explivio, private). Built frontend milestone F1 in `web/`: Next.js foundation, design tokens, UI components, app shell, routes. Ran two Stitch fix passes and an automated QA pass (desktop + 390px) on the dashboard screens.

- **2026-10-31** — Reviewed the 11 Stitch dashboard screens against the dashboard design doc. Main issues: fabricated usage, quotas and expiry periods; untruthful progress; unsupported options; no responsive layouts; weak accessibility labels.
- **2026-10-29** — Moved the PRD, plans and design docs into `docs/`. Created this file. Re-rendered the API video and confirmed its audio track contains the narration.
- **2026-10-28** — Built the animated "How APIs Work" explainer: `src/video/api.tsx`, `src/api-explainer.ts`, `npm run render:api`. Added per-scene ElevenLabs narration with word timings and a synthesized music bed (`npm run make:music`).
- **2026-10-26** — Prototype pipeline: Gemini storyboard, ElevenLabs narration, Remotion render, demo videos (database index, photosynthesis, rain).
