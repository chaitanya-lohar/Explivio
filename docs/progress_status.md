# Explivio — Progress Status

Last updated: 2026-10-31

Tracks progress against the milestones in [Explivio_Prototype_Implementation_Plan_v1.docx](Explivio_Prototype_Implementation_Plan_v1.docx). Newest entries go at the top of the changelog.

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

## Latest outputs

| Date | Output | Notes |
|---|---|---|
| 2026-10-29 | `runs/2026-10-29T15-45-52-735Z-ea7e9546/video.mp4` | "How APIs Work", 57.4 s, 1080×1920, narration + captions + music. Accepted by user. |
| 2026-10-28 | `runs/2026-10-28T18-36-24-897Z-4a4ab22c/video.mp4` | Earlier render of the same video, 57.7 s. |

## Known issues and constraints

- **Indian-English voice unavailable:** ElevenLabs returns HTTP 402 for library voices through the API on the free plan. Set `ELEVENLABS_NARRATOR_VOICE_ID` after upgrading.
- **ElevenLabs credits:** free plan, 10,000 characters per month. Each API video render uses about 700.
- **No sound in VS Code preview:** the built-in MP4 preview may not play AAC audio. Use a regular media player.
- **Version warning:** Remotion warns that zod 4.6.7 is installed but it expects 4.5.4. Renders still succeed.
- **Plain-text API key:** `mcp.json` stores the Stitch (Google) API key in plain text. It is now gitignored, but consider moving the key into an environment variable.
- **Web: unknown video IDs return HTTP 200:** `/videos/<unknown>` renders the not-found page (with `noindex`), but streaming means the status code stays 200.
- **Web: sidebar profile text:** the F1 brief asked for "Studio Suite" and a user role in the sidebar, which the corrected Stitch screens had removed. The code follows the brief; the role is placeholder text until accounts exist.
- **Provider costs:** not yet recorded in run manifests.

## Next steps

1. **F2 — Home dashboard and Create/Configure flow** in `web/`, built from the corrected Stitch screens.
2. Finish the remaining Stitch fixes (Progress "frame" text, List view at phone width, three contrast misses).
3. Run the M1/M5 acceptance tests on the 6 starter prompts, and record the results.
4. Integrate the director prompt and update the storyboard schema to match.
5. Turn the API video's animated scenes into reusable templates (title, analogy, flow diagram, process, examples, summary).
6. Use per-scene narration timing in the generic `generate` path.
7. Start the M6 evaluation scorecard (`evaluations/`).

## Changelog

- **2026-10-31** — Created the `dev` branch. Work is committed to `dev`; `main` changes only through pull requests from `dev`.

- **2026-10-31** — Set up git (remote: github.com/chaitanya-lohar/Explivio, private). Built frontend milestone F1 in `web/`: Next.js foundation, design tokens, UI components, app shell, routes. Ran two Stitch fix passes and an automated QA pass (desktop + 390px) on the dashboard screens.

- **2026-10-31** — Reviewed the 11 Stitch dashboard screens against the dashboard design doc. Main issues: fabricated usage, quotas and expiry periods; untruthful progress; unsupported options; no responsive layouts; weak accessibility labels.
- **2026-10-29** — Moved the PRD, plans and design docs into `docs/`. Created this file. Re-rendered the API video and confirmed its audio track contains the narration.
- **2026-10-28** — Built the animated "How APIs Work" explainer: `src/video/api.tsx`, `src/api-explainer.ts`, `npm run render:api`. Added per-scene ElevenLabs narration with word timings and a synthesized music bed (`npm run make:music`).
- **2026-10-26** — Prototype pipeline: Gemini storyboard, ElevenLabs narration, Remotion render, demo videos (database index, photosynthesis, rain).
