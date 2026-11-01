# Explivio — Progress Status

Last updated: 2026-11-01

Tracks progress against the milestones in [Explivio_Prototype_Implementation_Plan_v1.docx](Explivio_Prototype_Implementation_Plan_v1.docx). Newest entries go at the top of the changelog.

## At a glance

- **Video pipeline (repo root):** generates real narrated, captioned 9:16 MP4s. The "How APIs work" video is complete.
- **Web app (`web/`):** connected to the real pipeline (F4). A prompt typed in the browser generates a real narrated, captioned MP4 with real progress, real errors and retry. It plays and downloads on the Video ready page. Generation takes about 2–5 minutes.
- **Login and sign-up:** screens and form behaviour only. No real accounts, sign-in, sessions or emails, and the dashboard opens without logging in.
- **Run the web app:** `cd web`, `npm install`, `npm run dev`, then open http://localhost:3000 (login at /login, sign-up at /signup).
- **Git:** work is committed to `dev` (ahead of `main`). `main` changes only through a pull request: https://github.com/chaitanya-lohar/Explivio/compare/main...dev

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
| M7 — Visual Intelligence | 🟡 In progress (step 1/8 done) | Reusable animated templates (orbit, cycle, layers, flow, timeline, comparison) chosen and filled from a backward-compatible storyboard v2; reveal-on-mention timing; script quality (character budget, hooks, endings); a 3-topic AI illustration experiment before any integration; silent evaluation mode to save ElevenLabs credits. Plan: [docs/plans/M7_VISUAL_INTELLIGENCE_PLAN.md](plans/M7_VISUAL_INTELLIGENCE_PLAN.md). |
| Dashboard design (Stitch) | 🟡 Mostly fixed | 11 screens reviewed against [the design doc](Explivio_Dashboard_Design_Document_v1.docx). Two Stitch edit passes (2026-10-31) removed invented credits, quotas, plans, expiry periods and unsupported options, added mobile layouts, and fixed contrast and labels. Stitch keeps each edit as a new screen version. QA: 6 of 11 screens pass every check. Outstanding: Progress screen still contains "Synthesizing frame…" text, List view scrolls sideways by 188px at phone width, three secondary labels at 4.30–4.46:1 contrast (target 4.5). |
| Dashboard frontend — F1 foundation | ✅ Done | `web/`: Next.js 16, React 19, TypeScript strict, Tailwind 4. Design tokens, 13 UI primitives, app shell (desktop sidebar, tablet icon sidebar, mobile drawer), 7 placeholder routes, mock service layer. `lint`, `tsc` and `build` pass. Live QA at 1440/820/390px: no overflow, contrast, label or small-text issues. See [web/README.md](../web/README.md). |
| Dashboard frontend — F2 Home + creation flow | ✅ Done | Home dashboard (prompt composer, ideas, recent videos), Create (step 1) and Settings (step 2) with a summary panel. Generate runs a server action against the mock service, then moves to `/generating`. Prompt and settings travel in the URL. Functional test 19/19 (validation, idea fill, URL hand-off, defaults, summary updates, loading state, server action, edge cases). Layout QA 6 pages × 3 widths clean. Generation progress itself is F3. |
| Dashboard frontend — F3 progress, failure, video ready | ✅ Done | `/generating` follows real status from `GET /api/videos/[id]` every 2s: four pipeline stages (plan, narration, render, finishing), an indeterminate bar (no fake percentages), a failure view with saved settings, Try again and Edit settings. When the video is ready it opens `/videos/[id]`: native 9:16 player and Download MP4 (streamed with HTTP Range support), plus Regenerate. Expired videos show saved settings and Regenerate. The mock service steps jobs through stages on a timer; the "How APIs work" sample streams the real MP4 from `runs/`. Tests: file route (200/206/416, download header, bytes identical, no path leak), browser flow 18/18. |
| Dashboard frontend — F4 real pipeline | ✅ Done | Generate starts the CLI (`src/cli.ts`) for each video, in its own process, with a web-chosen run id. Status comes from the run's `manifest.json` (real stages: storyboard → narration → render). The MP4 streams from `runs/<id>/video.mp4`. Voice, captions and music reach the render (new CLI flags `--prompt-file`, `--run-id`, `--no-captions`, `--music`). One video at a time, with a clear message if busy. Failures show the real reason (cleaned of paths and keys) with Try again. Existing CLI runs appear in My Videos. `VIDEO_SERVICE=mock` keeps the sample data for UI work. Real test 2026-11-01: "Why the Moon has phases" (30s, male voice, music) rendered end to end in 272s, via Try again on a run that had failed on a Gemini timeout. |
| Authentication UI (screens only) | ✅ Done | `(auth)` route group with its own layout (no sidebar): `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/reset-password`, built from the 5 Stitch auth screens after removing invented claims and QA leftovers. Forms validate on client and server and call `services/mock/auth.ts`, which checks nothing, stores nothing and sends no email; every success says so. Sign-up goes to verify-email (masked address only); reset goes to login with a confirmation. Tests: 26/26 browser checks; layout clean at 1440/1280/768/375. **No real authentication, sessions or route protection yet.** |
| Real authentication | ⬜ Not started (decision needed) | Choose how accounts work: a hosted service (e.g. Clerk, Auth0, Supabase Auth) or our own backend and database. Then add real sign-up/sign-in, email verification and reset emails, sessions, sign-out, protection for the dashboard routes, and Terms/Privacy pages. The screens are ready: only `services/mock/auth.ts` needs replacing. |

## Latest outputs

| Date | Output | Notes |
|---|---|---|
| 2026-10-29 | `runs/2026-10-29T15-45-52-735Z-ea7e9546/video.mp4` | "How APIs Work", 57.4 s, 1080×1920, narration + captions + music. Accepted by user. |
| 2026-10-28 | `runs/2026-10-28T18-36-24-897Z-4a4ab22c/video.mp4` | Earlier render of the same video, 57.7 s. |

## Known issues and constraints

- **Visuals are diagrams, not illustrations (M6 O1):** relevant and synced now, but no real imagery. Biggest remaining quality gap.
- **ElevenLabs credits nearly used:** about 1,500 characters left until 2026-11-26 (M6 used about 5,000). 90-second videos are still untested.

- **Gemini 3.8 Flash is hanging (2026-11-01):** `gemini-3.8-flash` (and 3.7, flash-latest) didn't respond, even to a one-word prompt, while `gemini-3.6-flash` answered in about 2s. The pipeline now falls back to 3.6 on timeouts, but the wait cost about 170s per video. Recommended: set `GEMINI_MODEL=gemini-3.6-flash` in the root `.env` until 3.8 recovers.
- **Generic video visuals are basic:** topics other than the rain and photosynthesis demos get a neutral background and storyboard-based step cards. That's correct but plain, with no illustrations. Before 2026-11-01 they wrongly reused the rain photo and rain text. Reusable visual templates (M3) are the fix.
- **Captions-off and music-off renders not yet visually checked:** the flags are wired and verified in the render input; the real test used captions on and music on.
- **One video at a time:** rendering is CPU-heavy on this machine. Restarting the web server while a video renders loses its live process tracking. The render continues, and a run silent for 15 minutes is marked failed.

- **Auth is demo-only:** the auth screens don't sign anyone in, and the dashboard isn't protected. The sign-up terms checkbox refers to a Terms of Service and Privacy Policy that don't exist yet.

- **Indian-English voice unavailable:** ElevenLabs returns HTTP 402 for library voices through the API on the free plan. Set `ELEVENLABS_NARRATOR_VOICE_ID` after upgrading.
- **ElevenLabs credits:** free plan, 10,000 characters per month. Each API video render uses about 700.
- **No sound in VS Code preview:** the built-in MP4 preview may not play AAC audio. Use a regular media player.
- **Version warning:** Remotion warns that zod 4.6.7 is installed but it expects 4.5.4. Renders still succeed.
- **Plain-text API key:** `mcp.json` stores the Stitch (Google) API key in plain text. It is now gitignored, but consider moving the key into an environment variable.
- **Web: unknown video IDs return HTTP 200:** `/videos/<unknown>` renders the not-found page (with `noindex`), but streaming means the status code stays 200.
- **Web: sidebar profile text:** the F1 brief asked for "Studio Suite" and a user role in the sidebar, which the corrected Stitch screens had removed. The code follows the brief; the role is placeholder text until accounts exist.
- **Provider costs:** not yet recorded in run manifests.

## Next phase

**Phase F4 — Connect the web app to the real video pipeline** — ✅ done 2026-11-01. Next: M6 evaluation, then real authentication (see below).

Why this comes first: the prototype plan defers authentication until the core question is answered: can a prompt reliably become a useful video? Today the web app runs on mock data, so connecting it to the real pipeline is the step that proves the product.

Scope:
1. **Video service:** replace `web/src/services/mock/videos.ts` with a real implementation that starts the pipeline (`npm run generate` in the repo root) for a request (prompt, duration, voice, captions, music) and tracks the run folder.
2. **Real progress:** report the stages the pipeline actually writes to its run manifest (storyboard → narration → render) instead of the timer-based mock.
3. **Real results:** stream and download the rendered MP4 from `runs/`, using the same file route already built in F3. Show real failures and allow retry.
4. **Pipeline options:** pass the user's voice, captions and music choices through to the CLI. Today the CLI takes only the topic and duration.
5. **Run storage:** decide where run metadata lives for the prototype (for example, a JSON file per run), since there's no database yet.

Done when: a prompt entered in the browser produces a real MP4 that plays and downloads in the Video ready screen, progress reflects real stages, and failures show the real error with a working retry.

Then:
- **M6 evaluation:** generate 10–20 videos from the starter prompts, score them with the plan's scorecard, and record time and cost.
- **Real authentication:** once the approach is decided (hosted service or own backend). The screens are ready; it needs accounts, sessions, sign-out, dashboard protection and Terms/Privacy pages.

Decisions needed from you:
- Confirm F4 as the next phase, or tell me to do authentication first.
- For authentication later: a hosted service (Clerk, Auth0, Supabase Auth) or our own backend.

## Zero-cost policy (2026-11-01, non-negotiable for now)

**Budget: $0.** No billing on any provider, no credit purchases, no upgrades, no paid API calls. Only free tiers within their quotas; when a quota runs out, that work pauses. Paid services are reconsidered only when we decide to prepare for public launch.

- **Gemini:** free tier only. The billing status of the Google Cloud project behind the key **must be confirmed by you** in AI Studio (it isn't visible to the API key).
- **ElevenLabs:** existing free allowance only (about 1,600 characters until 2026-11-26).
- **Paused / skipped:** Gemini image-generation experiments (free availability can't be verified). A local image-model trial needs your go-ahead (Python install + model download).

## Decisions (2026-11-01)

- **Gemini model:** `GEMINI_MODEL=gemini-3.6-flash` applied to the local `.env` (only that line changed).
- **Next milestone:** M7 Visual Intelligence: six programmatic templates first, then planning, script quality and silent evaluation. Illustrations are investigated at zero cost only (the earlier paid budget was withdrawn); no generated images in production until you review.
- **Deferred:** the 90 s and remaining 7-topic evaluation, until ElevenLabs credits reset on 2026-11-26 (unless more credits are added).
- **Authentication:** Clerk is the preferred direction for future real authentication, subject to a pricing and integration review.

## Next steps

1. **M7 — Visual Intelligence** (approved; plan ready for review): storyboard v2 schema → six animated templates → template selection in the prompt → script-quality checks → silent evaluation → 2–3 narrated validation videos. See [the M7 plan](plans/M7_VISUAL_INTELLIGENCE_PLAN.md).
2. **Zero-cost illustration investigation:** programmatic scene art plus an options report on local/open-source models (hardware and licences checked). Optional local trial only with your go-ahead.
3. **After 2026-11-26 (ElevenLabs reset):** the deferred 90 s and 7-topic evaluation, plus a human listen-through of the narration.
4. **Real authentication with Clerk**, after a pricing and integration review.
5. **Merge `dev` into `main`** through a pull request once you've reviewed it.
6. Remaining UI: My Videos search, filters and list view; the Settings page; the leftover Stitch fixes.

## Changelog

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
