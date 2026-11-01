# M7 — Visual Intelligence: implementation plan

Status: **plan, awaiting approval** · Branch: `dev` · Prepared 2026-11-01

## 1. Goal

Make every generated video *show* what the narration explains, using reusable animated scene templates chosen and filled from the storyboard. Also tighten script quality (length, hooks, endings), and decide with evidence whether AI illustrations belong in the pipeline.

**Starting point (M6):** visual relevance averages 12.2/20 after the M6 fixes. Scenes use generic labelled layouts (steps, hub, comparison, checklist, focus) built from `key_elements` text. They're relevant and in sync, but they don't depict mechanisms: no orbiting Moon, no cycle loop, no layered structure. M6 also found weak endings (A5), path-vs-hub layout mistakes (A1, A4) and speech-rate variance (A4: 2.37 words/s).

**Target:** average visual score of at least **16/20** and total score of at least **85** on the M7 evaluation set, with no regression in script accuracy, sync or duration.

## 2. Decisions this plan follows

| Decision | Effect on the plan |
|---|---|
| `GEMINI_MODEL=gemini-3.6-flash` | Applied to the local `.env` (only that line). |
| M7 = Visual Intelligence | Templates first: orbit, cycle, layers, flow, timeline, comparison. |
| Limited AI illustration experiment (3 topics) | Separate script, outside the pipeline. Integration only after the results are reviewed. |
| Script quality | Character-based length control, hook rules, ending rules, better template selection. |
| 90 s / 7-topic evaluation deferred to after 2026-11-26 | M7 evaluation uses a credit-free silent mode plus at most 2–3 narrated videos. |
| Clerk preferred for future authentication | Recorded only; not part of M7. |
| Keep architecture and workflow | Additive changes, all backward compatible. Older runs still render; `dev` branch; progress file updated. |

## 3. Workstreams

### WS1 — Animated scene template library

New folder `src/video/templates/`, one Remotion component per template, all data-driven and sharing one visual language (palette, typography, motion timing).

| Template | Shows | Data it needs | Example scene |
|---|---|---|---|
| **orbit** | One body circling another; optional light source; phase/position markers | `center`, `orbiter`, optional `light`, `markers[]` (2–8 labels around the path) | Moon around Earth, Earth around Sun (seasons), electrons |
| **cycle** | Stages in a loop with arrows; active stage highlighted | `stages[]` (3–6) | Water cycle, carbon cycle, heartbeat |
| **layers** | Stacked bands, top to bottom, labelled; zoom to the active layer | `layers[]` (2–6, each label + optional note) | Atmosphere, Earth's interior, network layers, leaf cross-section |
| **flow** | Nodes connected left→right or top→bottom; a token travels the path | `nodes[]` (2–6), optional `edgeLabels[]` | Internet packet route, photosynthesis inputs → outputs, blood flow |
| **timeline** | Points on a time axis, revealed in order | `events[]` (2–6, each `when` + `label`) | History of the internet, stages of development |
| **comparison** | Two columns with a relation marker | `left {title, points[]}`, `right {title, points[]}`, `relation: "vs" \| "like"` | Prime vs composite, analogy pairs ("API is like a waiter") |

The existing M6 layouts (**steps**, **hub**, **checklist**, **focus**) stay as general-purpose templates and as the fallback.

**Reveal-on-mention:** each item (stage, layer, node, event) appears and highlights when it's first mentioned in the narration. Mention times come from the ElevenLabs word timings already returned by the narration step. Items not mentioned are spaced evenly through the scene. This replaces the M6 rule of evenly spacing the highlight across the scene.

**Quality rules:**
- **Text size:** at least 30 px on the 1080×1920 frame.
- **Label length:** at most 5 words per label (longer labels are trimmed).
- **Item count:** each template has a maximum (extra items are dropped and recorded in the manifest).
- **Safe area:** stays clear of the caption area.
- **Motion:** respects the motion timing already used.

### WS2 — Storyboard v2: template choice and structured data

- **Schema:** add an optional `visual` object per scene to `src/schemas/storyboard.ts`. It's a validated, discriminated union keyed by `template`, with the data fields above (Zod). Existing fields stay, so older storyboards and runs still validate and render.
- **Prompt:** a short template guide in the storyboard prompt: when to use each template, with one example each. Selection rules include: a sequence of places → flow, not hub (fixes M6 A4); a body moving around another → orbit (fixes M6 A1's "Sunlight source" hub); a contrast → comparison with `relation: "vs"`.
- **Validation and repair:** invalid or missing `visual` data gets one targeted repair within the existing bounded Gemini call budget (max 3 calls). If it's still invalid, a deterministic fallback maps `visual_type` and `key_elements` to the M6 layouts, as today, and the manifest records `visualSource: "template" | "fallback"`.
- **Selection checks:** a lint step flags mismatches, for example a template whose labels never appear in the narration, or more than half the scenes using the same template. Flagged scenes get a repair hint.

### WS3 — Script quality

| Item | Change | Check |
|---|---|---|
| Length control | Character-based budget (≈17.5 characters/s measured in M6; configurable) replaces the word budget, which drifted for technical vocabulary (A4). | Narration characters within ±12% of target; one repair. |
| Opening hook | Scene 1: one or two sentences, a concrete question or surprising fact about the topic, under about 6 s. No filler like "Let's break it down simply". | Lint: banned phrases, sentence count, character cap. |
| Ending | Final scene: one clear takeaway that restates the key idea, at least 12 words, no new facts. | Lint: minimum length, mentions the title's key term. |
| Template selection | WS2 rules plus a lint pass. | Lint plus manual review. |

All checks are pure functions with unit tests. Violations go into the one bounded repair, never an open-ended loop. Remaining warnings are recorded in the manifest (`scriptChecks`).

### WS4 — AI illustration experiment (isolated, no pipeline integration)

**Question:** do AI-generated illustrations make educational scenes clearer, at an acceptable time and cost?

- **Script:** `scripts/m7/illustration-trial.mjs`. It isn't called by the CLI or web app. Outputs go to `runs/m7-illustration-trial/` (gitignored); results go to `docs/quality/M7_ILLUSTRATION_TRIAL.md`.
- **Topics (3):** Moon phases (spatial), photosynthesis (biological process), how the internet works (abstract/technical).
- **Images:** 3 per topic, matching storyboard scenes. Tested on the image models already available on the current Gemini key: `gemini-3.1-flash-image` (Nano Banana 2) and `gemini-3.1-flash-lite-image`. Maximum **18 images**.
- **Prompting:**
  - **Style:** consistent flat educational illustration, 9:16, dark background to match the app.
  - **No text:** no words in the image. AI images often garble text, so labels stay programmatic and are overlaid by templates.
- **What's measured for each image:**
  - **Time:** generation time in seconds.
  - **Usage:** token/usage metadata returned by the API.
  - **Cost:** estimated from Google's **official published price at the time of the trial** (with the source and date recorded; not assumed in advance).
- **Quality rubric (scored per image, 0–5 each):**
  - **Relevance:** does it show the scene's concept?
  - **Scientific accuracy:** correct geometry or anatomy, nothing misleading.
  - **Artefacts:** no garbled text or artefacts.
  - **Consistency:** consistent style across a topic.
  - **Composition:** 9:16, with room for labels.
  - **Classroom suitability.**

  Each image is also compared side by side with the template version of the same scene.
- **Decision gate (filled in with you after the trial):** integrate only if illustrations beat templates on clarity for some scene types, accuracy problems are rare and detectable, and the cost per video and added generation time are within limits you set. If yes, a follow-up milestone adds an optional `illustration` asset provider behind the existing visual-asset contract, used selectively per scene, with templates as the fallback. If no, templates remain the visual system.
- **Spend:** a few dollars at most, and the exact figure is reported. It uses no ElevenLabs credits.

### WS5 — Evaluation and regression

- **Silent evaluation mode (no ElevenLabs credits):** a CLI option that generates the storyboard (Gemini) and renders with estimated timing and no narration. Used to check template choice and visuals across many topics for free. The M6 validator skips the audio checks for these.
- **Template gallery:** one rendered still per template with sample data (`npm run m7:gallery`). It's used for visual QA and future design reviews.
- **Tests:** unit tests for schema validation, fallback mapping, mention-time matching, the character budget, and the hook and ending lint. A render smoke test for every template (renders a still; it must not be blank). The existing 16 M6 tests must still pass.
- **M7 evaluation set:**
  - **Silent mode:** 10–12 topics, including all 6 template types and the M6 topics, to compare visuals with M6.
  - **Narrated:** 2–3 videos within the remaining ~1,600 ElevenLabs characters.
  - **Scoring:** the M6 rubric and tools (`validate-run`, `build-report`), with the report at `docs/quality/M7_EVALUATION.md`.
  - **After the credit reset:** the full narrated re-evaluation, together with the deferred 90 s / 7-topic cases.

## 4. Sequence

| Step | Work | Depends on | Output |
|---|---|---|---|
| 1 | Storyboard v2 schema + fallback mapping + tests | — | Backward-compatible schema |
| 2 | Templates: flow, cycle, comparison (most common in M6 topics) + mention-timing helper | 1 | 3 templates, gallery stills |
| 3 | Templates: orbit, layers, timeline | 1 | 3 templates, gallery stills |
| 4 | Prompt template guide + selection lint + repair | 1–3 | Gemini fills `visual` data |
| 5 | Script quality: character budget, hook, ending checks | — (parallel with 2–4) | Lint + repair + tests |
| 6 | Silent evaluation mode + run 10–12 topics, fix issues found | 2–5 | Visual scores vs. M6 |
| 7 | AI illustration experiment (3 topics) + report | — (any time) | Trial report + decision gate for you |
| 8 | 2–3 narrated validation videos, M7 report, progress update | 6 | `M7_EVALUATION.md` |

Each step is committed to `dev` separately with its tests, and `docs/progress_status.md` is updated after each.

## 5. Acceptance criteria

1. All six templates (orbit, cycle, layers, flow, timeline, comparison) render from storyboard data, with reveal-on-mention, and have gallery stills and smoke tests.
2. Storyboard v2 is backward compatible: older runs and demos still render, and invalid `visual` data falls back without failing the video.
3. In the silent evaluation set, at least 80% of scenes use a template (not the fallback), and each template is chosen at least once where appropriate.
4. Visual relevance averages **at least 16/20** on the M7 set (M6 after-fix: 12.2), with no scene contradicting its narration.
5. Script checks: 100% of storyboards within the character budget after at most one repair. Hooks and endings pass lint, or the warning is recorded.
6. No regression: M6 tests pass. Narrated videos pass every automated check (duration, sync, captions, music, blank frames).
7. Illustration trial report delivered, with measured time, usage and cost per image and a filled-in rubric. **No image generation in the main pipeline** unless you approve it after the report.
8. Progress file and docs updated, and every change on `dev`.

## 6. Budget and limits

- **ElevenLabs:** about 1,600 characters left until 2026-11-26, enough for 2–3 short narrated videos. Most M7 checking uses silent mode.
- **Gemini text:** storyboards for about 15–20 silent runs, at the same usage pattern as M6.
- **Gemini image (trial):** at most 18 images. The cost is reported from official pricing and actual usage.
- **No new paid services or dependencies.** Templates use Remotion and React, which are already installed.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Gemini fills template data poorly | Examples in the prompt, Zod validation, one repair, deterministic fallback; measured as the template-vs-fallback rate. |
| Templates look repetitive across videos | Selection lint (no template on more than half the scenes), per-template motion variety, palette accents per topic. |
| Mention matching misses synonyms | Fall back to evenly spaced reveal. Matching uses normalised keywords from each label and is unit-tested. |
| Illustrations are inaccurate (for example wrong Moon phase geometry) | No text in images; an accuracy score in the rubric; templates stay the default; no integration without your approval. |
| Scope creep into a full animation engine | Six templates only, all data-driven, with no free-form animation authoring. |

## 8. Out of scope for M7

Real authentication (Clerk later, after a pricing/integration review), the deferred 90 s / 7-topic evaluation, new voices, web UI changes beyond what the new visuals need, and putting AI illustrations into production.
