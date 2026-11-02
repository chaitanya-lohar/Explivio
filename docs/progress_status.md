# Explivio — Progress Status

Last updated: 2026-11-02

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

1. **Finish the M7 evaluation:** run the 5 pending silent topics (S8 prime numbers, S9 photosynthesis, S10 vaccines, S11 sky blue, S12 Roman Empire) with `npm run m7:silent S8,S9,S10,S11,S12` after the Gemini free-tier daily reset. It stops by itself on a quota error. Then fix the known issues K1–K5 in [M7_EVALUATION.md](quality/M7_EVALUATION.md): hook template, scaling small diagrams, the whole structure in one scene, a flow naming lint, and captions split at scene changes.
2. **Illustrations (decision needed):** the report recommends programmatic visuals. The optional local image-model trial (at most 9 images, about 3 GB on D:) waits for your yes/no. See [M7_ILLUSTRATION_OPTIONS.md](quality/M7_ILLUSTRATION_OPTIONS.md).
3. **After 2026-11-26 (ElevenLabs reset):** the deferred 90 s and 7-topic evaluation, plus a human listen-through of the narration.
4. **Real authentication with Clerk**, after a pricing and integration review.
5. **Merge `dev` into `main`** through a pull request once you've reviewed it.
6. Remaining UI: the leftover Stitch fixes.

## Changelog

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
