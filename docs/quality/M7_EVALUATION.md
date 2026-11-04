# M7 — Visual Intelligence: evaluation report

Date: 2026-11-02. Spend: **$0**. Plan: [M7_VISUAL_INTELLIGENCE_PLAN.md](../plans/M7_VISUAL_INTELLIGENCE_PLAN.md). Raw data: [m7-silent-runs.json](m7-silent-runs.json), [m7-narrated-runs.json](m7-narrated-runs.json), [m7-scores.json](m7-scores.json).

**How to read the scores:**
- **Measured:** automated (validate-run, run manifests).
- **Review:** my (Claude's) review of the rendered frames: one frame per scene plus mid-scene spot checks. **This is not a human review.**
- **Narration:** provisional, as in M6. Levels, silence and pacing are measured, but nobody has listened yet.

## 1. Results against the targets

| Target | Result | Source |
|---|---|---|
| Visual quality ≥ 16/20 | **16.3** average over 7 silent topics; **16.5** on the 2 narrated videos (M6 after-fix: 12.2) | Review |
| Overall quality ≥ 85/100 | **88.5** average on 2 narrated videos (90, 87); M6 after-fix: 82.8 | Review + measured |
| No regression: accuracy | No scene contradicts its narration; the orbit, layer order and timeline dates are all correct | Review |
| No regression: sync | Largest scene drift **0.00 s** on both narrated videos (M6: 0.9 s) | Measured |
| No regression: captions | Valid and inside the video (16 and 15 cues) | Measured |
| No regression: duration | Narrated 31.0 s and 29.0 s for 30 s (tolerance ±5); silent 6/6 at 30 s and 1/1 at 60 s within tolerance | Measured |
| No regression: rendering | 7/7 silent and 2/2 narrated renders succeeded; no blank frames | Measured |
| ≥ 80% of scenes use a template | **96%** (27 of 28 scenes; 1 fallback) | Measured |

**Sample-size caveat:** the overall score rests on 2 narrated videos, and both are 30 s. The visual score rests on 7 topics (5 planned topics are pending; see §5). They meet the targets, but the 90 s and 7-topic narrated evaluation, deferred to after 2026-11-26, is needed before calling it settled.

## 2. Silent evaluation (real Gemini planning and render, no narration)

| # | Area | Topic | Templates (one per scene; * = fallback) | Gemini calls / repairs | Est. speech | Video | Visual /20 | Script /20 |
|---|---|---|---|---|---|---|---|---|
| S1 | Astronomy | Moon phases | focus, hub, **orbit**, checklist | 2 / 1 | 29.1 s | 30 s | 17 | 19 |
| S2 | Earth science | Seasons | focus, **comparison**, checklist | 3 / 2† | 29.2 s | 30 s | 15 | 19 |
| S3 | Earth science | Water cycle | focus, flow, flow, **cycle** | 3 / 2† | 28.7 s | 30 s | 16 | 18 |
| S4 | Earth science | Atmosphere layers | focus, **layers**, **layers**, checklist | 2 / 1 | 28.0 s | 29 s | 17 | 19 |
| S5 | Geology | Inside the Earth | focus, **layers (nested)** ×2, checklist | 2 / 1 | 27.6 s | 29 s | 17 | 19 |
| S6 | History / tech | Internet history (60 s) | focus, **timeline**, flow, hub, checklist* | 2 / 1 | 59.6 s | 61 s | 15 | 18 |
| S7 | Technology | Web page to phone | focus, **flow**, hub, checklist | 2 / 1 | 29.0 s | 30 s | 17 | 19 |
| | | **Average** | | | | | **16.3** | **18.7** |

† These two runs used two corrections, against the one-correction rule. The repaired output put a template name in `visual_type`, the schema rejected it, and a second correction followed. This was fixed (commit `2efd722`): an unknown `visual_type` now falls back to "diagram", and a second invalid output fails instead of asking again.

- **Script checks:** 7/7 storyboards passed every check after at most one repair: length, hook, ending, relevance and structure.
- **Speech estimate:** within the length budget on every run, and within 2 s of the final video length.
- **Template selection:** all six M7 templates were chosen at least once where appropriate:
  - orbit for the Moon, with Earth at the centre and sunlight as the light;
  - layers for the atmosphere and nested layers for Earth's interior;
  - a timeline for the internet's history, with dates the narration states;
  - a cycle for the water cycle;
  - flow for processes, and comparison for direct vs. indirect sunlight.
- **Lint:** it flagged 1 scene after its repair (S6's recap labels weren't spoken), and that scene correctly fell back to the M6 layout.
- **Reveal-on-mention, spot-checked on S3's cycle scene:** the Evaporation stage appears just as "evaporation" is said (24.0 s); Condensation and Precipitation appear later.

## 3. Narrated validation (real ElevenLabs narration, existing free credits)

Gemini's free-tier quota was exhausted (429) at that point, so these reuse the real Gemini storyboards of S1 and S3 (`--storyboard-file`). They made no new Gemini call.

| # | Topic | Config | Video | Speech (est.) | Max drift | Music vs. voice | Checks | Script | Visual | Narr.* | Capt. | Sync | Dur. | Edu. | Pres. | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| N1 | Moon phases | captions + music, female | 31.0 s | 30.46 s (29.1) | 0.00 s | −25.1 dB | 13/13 | 19 | 17 | 12 | 9 | 10 | 10 | 9 | 4 | **90** |
| N2 | Water cycle | captions, no music, male | 29.0 s | 28.51 s (28.7) | 0.00 s | absent (−91 dBFS) | 12/12 | 18 | 16 | 12 | 9 | 10 | 10 | 8 | 4 | **87** |

\* provisional. The speech-time estimate was within **+4.6%** and **−0.7%** of the real narration. ElevenLabs used exactly the predicted 471 + 447 characters, leaving about 705 until 2026-11-26.

## 4. Visual improvements vs. M6 (review)

- **Real relationships instead of generic boxes:**
  - orbits with correct lighting and positions;
  - layer stacks and cross-sections;
  - timelines with only stated dates;
  - cycles that close the loop;
  - flows with travelling packets;
  - comparisons with vs / like / related badges.
- **Timing:** items appear when they are spoken, not on a fixed schedule.
- **Correctness by construction plus lint:** for example, the Sun can't be the centre of the Moon's orbit, and dates must be stated in the narration and in order.
- **Readability fixes found in review:** hub spokes no longer cross the centre label, and the orbiter reaches the last mentioned position before the scene ends.

## 5. Known issues and limits

| # | Issue | Effect | Next step |
|---|---|---|---|
| K1 | Scene 1 is always a `focus` ring (7/7) | Hooks look alike | A dedicated hook template (big question plus an illustrative motif) |
| K2 | Small diagrams leave empty space (2-event timeline, 1-point comparison) | Readability 2/4 on S2 and S6 | Scale templates to their item count |
| K3 | Relationships get split across scenes (atmosphere and Earth layers in two halves) | You never see the whole structure at once | Prompt rule: show the whole structure once, then zoom |
| K4 | A flow can list a stage's name as a step (S3: "Evaporation" after "Vapor rises") | Minor confusion | Lint: a node that names the previous node's process |
| K5 | Caption cues can span a scene change (as in M6) | Captions 9/10 | Split cues at scene boundaries |
| K6 | **5 of 12 silent topics pending** (S8 prime numbers, S9 photosynthesis, S10 vaccines, S11 sky blue, S12 Roman Empire) | Mathematics and two history/biology topics untested | Resume with `npm run m7:silent` after the Gemini free-tier daily reset |
| K7 | Narrated sample is 2 short videos | The overall score is indicative | Full narrated evaluation after 2026-11-26 (with the deferred 90 s / 7-topic cases) |
| K8 | Narration not listened to by a person | Narration scores provisional | Human listen-through |

## 6. Resource usage (free tiers only)

| Item | Value |
|---|---|
| Gemini model | `gemini-3.6-flash` (free tier) |
| Gemini calls, successful silent runs | 16 calls, mean 28.1 s, max 41.7 s; 1 repair per run (2 in S2/S3 before the fix) |
| Gemini, failed attempts | S8, 3 attempts: "overloaded", then confirmed **quota or rate limit (429)**; the batch paused itself each time |
| ElevenLabs | 918 characters for N1 + N2 (exact); about 705 left until 2026-11-26 |
| Render time | Silent 53–134 s (first pass), 37–80 s (re-render); narrated 47 s and 60 s |
| Output size | 2.4–6.0 MB, or 34 MB with the photo background (water cycle theme) |
| Paid services | None. No billing enabled or changed. |

## 7. How to reproduce

- `npm run m7:gallery`: stills of all 10 templates (18 scenes), with a non-blank check.
- `npm run m7:silent [S8,…]`: the silent topics (stops on a Gemini quota error).
- `node scripts/m7/rerender.mjs m7-silent/<id>`: re-render from saved props with no API calls.
- `node scripts/m7/contact-sheet.mjs <run>`: one frame per scene, for review.
- `node scripts/m6/validate-run.mjs <run>`: automated checks; silent runs skip the audio checks.
- `npx tsx scripts/m7/speech-model-check.mjs`: speech-time estimate vs. real narration.
