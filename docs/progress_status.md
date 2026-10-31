# Explivio — Progress Status

Last updated: 2026-10-31

Tracks progress against the milestones in [Explivio_Prototype_Implementation_Plan_v1.docx](Explivio_Prototype_Implementation_Plan_v1.docx). Newest entries go at the top of the changelog.

## At a glance

- **Video pipeline (repo root):** generates real narrated, captioned 9:16 MP4s. The "How APIs work" video is complete.
- **Web app (`web/`):** the full dashboard journey works in the browser on mock data: Home → Create → Settings → Generate → progress → Video ready (plays and downloads the real sample MP4). It isn't connected to the real pipeline yet.
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
| M6 — Evaluation | ⬜ Not started | No `evaluations/` scorecard yet. Starter prompts are listed in the implementation plan. |
| Dashboard design (Stitch) | 🟡 Mostly fixed | 11 screens reviewed against [the design doc](Explivio_Dashboard_Design_Document_v1.docx). Two Stitch edit passes (2026-10-31) removed invented credits, quotas, plans, expiry periods and unsupported options, added mobile layouts, and fixed contrast and labels. Stitch keeps each edit as a new screen version. QA: 6 of 11 screens pass every check. Outstanding: Progress screen still contains "Synthesizing frame…" text, List view scrolls sideways by 188px at phone width, three secondary labels at 4.30–4.46:1 contrast (target 4.5). |
| Dashboard frontend — F1 foundation | ✅ Done | `web/`: Next.js 16, React 19, TypeScript strict, Tailwind 4. Design tokens, 13 UI primitives, app shell (desktop sidebar, tablet icon sidebar, mobile drawer), 7 placeholder routes, mock service layer. `lint`, `tsc` and `build` pass. Live QA at 1440/820/390px: no overflow, contrast, label or small-text issues. See [web/README.md](../web/README.md). |
| Dashboard frontend — F2 Home + creation flow | ✅ Done | Home dashboard (prompt composer, ideas, recent videos), Create (step 1) and Settings (step 2) with a summary panel. Generate runs a server action against the mock service, then moves to `/generating`. Prompt and settings travel in the URL. Functional test 19/19 (validation, idea fill, URL hand-off, defaults, summary updates, loading state, server action, edge cases). Layout QA 6 pages × 3 widths clean. Generation progress itself is F3. |
| Dashboard frontend — F3 progress, failure, video ready | ✅ Done | `/generating` follows real status from `GET /api/videos/[id]` every 2s: four pipeline stages (plan, narration, render, finishing), an indeterminate bar (no fake percentages), a failure view with saved settings, Try again and Edit settings. When the video is ready it opens `/videos/[id]`: native 9:16 player and Download MP4 (streamed with HTTP Range support), plus Regenerate. Expired videos show saved settings and Regenerate. The mock service steps jobs through stages on a timer; the "How APIs work" sample streams the real MP4 from `runs/`. Tests: file route (200/206/416, download header, bytes identical, no path leak), browser flow 18/18. |
| Authentication UI (screens only) | ✅ Done | `(auth)` route group with its own layout (no sidebar): `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/reset-password`, built from the 5 Stitch auth screens after removing invented claims and QA leftovers. Forms validate on client and server and call `services/mock/auth.ts`, which checks nothing, stores nothing and sends no email; every success says so. Sign-up goes to verify-email (masked address only); reset goes to login with a confirmation. Tests: 26/26 browser checks; layout clean at 1440/1280/768/375. **No real authentication, sessions or route protection yet.** |
| Real authentication | ⬜ Not started (decision needed) | Choose how accounts work: a hosted service (e.g. Clerk, Auth0, Supabase Auth) or our own backend and database. Then add real sign-up/sign-in, email verification and reset emails, sessions, sign-out, protection for the dashboard routes, and Terms/Privacy pages. The screens are ready: only `services/mock/auth.ts` needs replacing. |

## Latest outputs

| Date | Output | Notes |
|---|---|---|
| 2026-10-29 | `runs/2026-10-29T15-45-52-735Z-ea7e9546/video.mp4` | "How APIs Work", 57.4 s, 1080×1920, narration + captions + music. Accepted by user. |
| 2026-10-28 | `runs/2026-10-28T18-36-24-897Z-4a4ab22c/video.mp4` | Earlier render of the same video, 57.7 s. |

## Known issues and constraints

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

**Phase F4 — Connect the web app to the real video pipeline** (recommended next).

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

## Next steps

1. **F4 — Connect the real pipeline** (see Next phase above).
2. **Decide the authentication approach** (hosted service or own backend), then implement real auth and protect the dashboard.
3. **Merge `dev` into `main`** through a pull request once you've reviewed it.
4. Finish the remaining Stitch fixes (Progress "frame" text, List view at phone width, three contrast misses).
5. Run the M1/M5 acceptance tests on the 6 starter prompts, and record the results.
6. Integrate the director prompt and update the storyboard schema to match.
7. Turn the API video's animated scenes into reusable templates (title, analogy, flow diagram, process, examples, summary).
8. Use per-scene narration timing in the generic `generate` path.
9. Start the M6 evaluation scorecard (`evaluations/`).

## Changelog

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
