# M7 — Visual Intelligence: implementation plan

Status: **approved, in progress** · Branch: `dev` · Prepared 2026-11-01 · Revised 2026-11-01 for the **strict $0 policy**

## 1. Goal

Make every generated video *show* what the narration explains, using reusable animated scene templates chosen and filled from the storyboard. Also tighten script quality (length, hooks, endings), and decide with evidence whether AI illustrations belong in the pipeline.

**Starting point (M6):** visual relevance averages 12.2/20 after the M6 fixes. Scenes use generic labelled layouts (steps, hub, comparison, checklist, focus) built from `key_elements` text. They're relevant and in sync, but they don't depict mechanisms: no orbiting Moon, no cycle loop, no layered structure. M6 also found weak endings (A5), path-vs-hub layout mistakes (A1, A4) and speech-rate variance (A4: 2.37 words/s).

**Target:** average visual score of at least **16/20** and total score of at least **85** on the M7 evaluation set, with no regression in script accuracy, sync or duration.

## 0. Zero-cost policy (non-negotiable for the current phase)

**Budget: $0.** Explivio is in personal/learning development, not public launch. It replaces the earlier paid illustration budget, which is withdrawn.

- No billing is enabled on Google Cloud, the Gemini API or any other provider. No credit purchases, no subscription upgrades, no paid API calls.
- Only genuinely free tiers are used, within their published quotas. A provider that needs billing or a paid plan is skipped.
- When a free quota runs out, that part of the work pauses until it resets. Free trials and promotional credits are not treated as free.
- Paid services can be reconsidered only when we explicitly decide to prepare for public launch.

**Free-tier status of the services in use:**

| Service | Status | Limits / notes |
|---|---|---|
| Gemini API (gemini-3.6-flash, storyboards) | Free tier **only if the Google Cloud project behind the key has no billing account linked**. Needs confirming by you in Google AI Studio (billing isn't visible to the API key). | Free-tier rate and daily limits apply. On a quota error the run fails and is retried later; it never falls back to anything paid. |
| ElevenLabs (narration) | Free plan, existing allowance only (about 1,600 characters left; resets 2026-11-26). | Narrated evaluation pauses when the allowance runs out. No upgrade. |
| Gemini image models (Nano Banana family) | **Skipped.** Free availability for image output can't be verified without billing details, and the policy says to skip unless genuinely free. | Not used. |
| Remotion, React, ffmpeg (bundled) | Local, free. Templates, rendering and checks all run locally. | — |

## 2. Decisions this plan follows

| Decision | Effect on the plan |
|---|---|
| `GEMINI_MODEL=gemini-3.6-flash` | Applied to the local `.env` (only that line). |
| M7 = Visual Intelligence | Templates first: orbit, cycle, layers, flow, timeline, comparison. |
| AI illustrations: zero-cost investigation only | Local/open-source options assessed against hardware, licences and setup first. No paid image APIs. Nothing goes into production without your review. |
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

### WS4 — Zero-cost illustration investigation (isolated, no pipeline integration)

**Question:** can illustrations be produced at **$0** that make scenes clearer than the programmatic templates?

**Options assessed:**

| Option | Cost | Assessment on this machine |
|---|---|---|
| **Programmatic SVG + Remotion** (WS1 templates, plus hand-built SVG scene art such as Moon/Earth/Sun, a leaf, a heart, network nodes) | $0 | **Primary approach.** Accurate by construction, fast, consistent style, no licensing issues. |
| **Local open-weight image models** (Stable Diffusion 1.5 / SD-Turbo-class, run through ONNX Runtime on the CPU or DirectML on the integrated GPU) | $0 | Possible but weak. **Hardware (checked 2026-11-01):** AMD Ryzen 5 5625U, integrated Radeon graphics (shared memory, no CUDA), 15.3 GB RAM (about 4.8 GB free when checked), 157 GB free on D:, 21.8 GB on C:, Python not installed. Expect very roughly 1–3 min per 512×512 image, 2–5 GB of model downloads (caches must be redirected to D:), and a new Python setup. These models are unreliable for accurate scientific diagrams. SDXL/FLUX-class models are impractical here. **Licences** must be checked per model before any download (for example SD 1.5 uses CreativeML OpenRAIL-M with use restrictions; some "turbo" variants are non-commercial only). |
| **Free-licence image libraries** (public-domain / CC0 sources, e.g. NASA imagery, Wikimedia Commons with per-file licence checks) | $0 | Useful for real photos (Moon, Earth). Each asset's licence and attribution must be recorded; no hotlinking; stored locally. |
| Paid or billing-gated image APIs (including Gemini image models) | Paid / unverifiable | **Skipped** under the $0 policy. |

**Plan:**
1. Build programmatic scene art first (part of WS1), which gives zero-cost illustrations.
2. Write the local-model assessment with licence notes (no downloads): `docs/quality/M7_ILLUSTRATION_OPTIONS.md`.
3. **Optional, only with your explicit go-ahead:** a small local trial (Python + one small open-weight model on D:, at most about 9 images for 3 topics). It measures time per image, peak RAM and disk use, and scores relevance, accuracy, artefacts and consistency against the template version of the same scene.
4. Nothing generated goes into production until you review the comparison.

**Paused:** any image-generation API experiment. No zero-cost, verifiable option is available.

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
| 7 | Zero-cost illustration options report (+ optional local trial with your go-ahead) | — (any time) | Options report + decision for you |
| 8 | 2–3 narrated validation videos, M7 report, progress update | 6 | `M7_EVALUATION.md` |

Each step is committed to `dev` separately with its tests, and `docs/progress_status.md` is updated after each.

## 5. Acceptance criteria

1. All six templates (orbit, cycle, layers, flow, timeline, comparison) render from storyboard data, with reveal-on-mention, and have gallery stills and smoke tests.
2. Storyboard v2 is backward compatible: older runs and demos still render, and invalid `visual` data falls back without failing the video.
3. In the silent evaluation set, at least 80% of scenes use a template (not the fallback), and each template is chosen at least once where appropriate.
4. Visual relevance averages **at least 16/20** on the M7 set (M6 after-fix: 12.2), with no scene contradicting its narration.
5. Script checks: 100% of storyboards within the character budget after at most one repair. Hooks and endings pass lint, or the warning is recorded.
6. No regression: M6 tests pass. Narrated videos pass every automated check (duration, sync, captions, music, blank frames).
7. Zero-cost illustration options report delivered (hardware, licences, setup, expected performance). An optional local trial runs only with your go-ahead. **No generated images in the main pipeline** unless you approve them after reviewing the comparison. Total spend $0.
8. Progress file and docs updated, and every change on `dev`.

## 6. Budget and limits

- **ElevenLabs:** about 1,600 characters left until 2026-11-26, enough for 2–3 short narrated videos. Most M7 checking uses silent mode.
- **Gemini text:** storyboards for about 15–20 silent runs, at the same usage pattern as M6.
- **Money:** $0, strictly. No billing, credits, upgrades or paid calls.
- **Gemini text:** free tier only, subject to quotas and confirming that the project has no billing linked. On a quota error, work pauses.
- **No new paid services.** Templates use Remotion and React, which are already installed. A local image-model trial (optional) needs your approval for a Python install and model download.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Gemini fills template data poorly | Examples in the prompt, Zod validation, one repair, deterministic fallback; measured as the template-vs-fallback rate. |
| Templates look repetitive across videos | Selection lint (no template on more than half the scenes), per-template motion variety, palette accents per topic. |
| Mention matching misses synonyms | Fall back to evenly spaced reveal. Matching uses normalised keywords from each label and is unit-tested. |
| Illustrations are inaccurate (for example wrong Moon phase geometry) | Programmatic scene art first (accurate by construction); any local-model output scored for accuracy; no integration without your approval. |
| Accidental spending | Paid providers skipped; Gemini billing status confirmed by you; quota errors pause work instead of switching providers. |
| Scope creep into a full animation engine | Six templates only, all data-driven, with no free-form animation authoring. |

## 8. Out of scope for M7

Real authentication (Clerk later, after a pricing/integration review), the deferred 90 s / 7-topic evaluation, new voices, web UI changes beyond what the new visuals need, and putting AI illustrations into production, and any paid service.
