# M6 — Known issues and limitations

Status after the M6 fixes (2026-11-01). Severity: **Critical** = misleads learners or breaks output · **Major** = clearly lowers quality · **Minor** = polish.

## Fixed in M6

| # | Issue | Stage | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| F1 | Videos shorter than requested (F4 Moon 22 s and B4 Gravity 24 s for 30 s requests) | Storyboard | Gemini controlled scene *duration estimates*, but nothing controlled narration *word count*, and video length follows the narration. Short storyboards (64–67 words) gave short videos; 70+ words landed within tolerance. | Speech-rate word budget (2.75 words/s, ±12%) in the prompt, plus one targeted repair if the script is outside it (`src/pipeline/word-budget.ts`). | `tests/m6.test.ts`: word budget, 64-word regression |
| F2 | Scene visuals change up to 4.0 s away from the narration (B3 4.0 s, B2 3.4 s) | Timing / render | Scene ranges came from Gemini's estimated scene lengths; the narration has its own real timing. | Scene starts come from when each scene's first word is actually spoken, using ElevenLabs word timings (`src/pipeline/scene-timing.ts`); contiguous frame ranges cover the whole video. Older runs fall back to estimates. | scene starts, fallback, contiguous ranges |
| F3 | Generic videos had an empty middle and showed production notes to learners ("Branching Graphic", "An animated globe showing…") | Render | No visual system for topics without a hand-made theme; the step card printed the storyboard's internal `visual_description` and graphic names. | Animated concept diagrams chosen from the storyboard's `visual_type` (steps, hub, comparison, checklist, focus) (`src/video/concept-visual.tsx`). The prompt now asks for learner-facing labels. Production notes are no longer rendered. | layout mapping; no rain theme for other topics |
| F4 | Up to ~170 s (F4), then 30 s (M6 baseline B1) lost waiting on a hanging Gemini model | Storyboard | `gemini-3.8-flash` stops responding; the pipeline waited on it for every video. | Hard per-request timeout, and a recently failed model is skipped for 30 minutes (`runs/.gemini-health.json`). Calls, models and times are recorded in the manifest. | skip logic, error classification |
| F5 | Speech could end on the last frame | Render | Video length was `ceil(narration)`, sometimes leaving under 0.1 s of tail. | At least 0.4 s of tail after the last word. | covered by the validator check "narration ends before the video does" |
| F6 | (F4) Rain photo and rain explanations shown for unrelated topics | Render | Fallback theme reused the rain demo. | Only the rain and photosynthesis demos have themes. | theme test |
| F7 | Demo step cards in a generated video (run A3: "Water travels from the roots" over "The 3 Ingredients") | Render | A title containing "photosynthesis" picked the demo theme *including* its hand-written cards for a different 5-scene script. | Hand-written cards only for the built-in demo scripts (`handwrittenSteps`). Generated videos keep the matching photo and get diagrams from their own storyboard. Verified by re-rendering A3 stills. | hand-written cards only for demos |
| F8 | Fatal failure on a repairable schema error (run A2's first attempt) | Storyboard | The rewritten error classifier didn't recognise Zod's `invalid_value` message, so an invalid `visual_type` failed the video instead of being repaired. Introduced in M6; caught by the test batch. | Any Zod or JSON-parse error is classified as repairable. | schema errors are repairable |
| F9 | Timeout on the only available model (run A4's first attempt) | Storyboard | A 60 s storyboard took over 30 s; the timeout was 30 s and, with 3.8 being skipped, there was nothing left to try. The rerun took 28.2 s. | Timeout 45 s, plus one retry on the same model; still bounded at 3 calls. | switch, retry once, then fail |
| F10 | Step numbers shown twice ("1 · 1. Moon orbits Earth", "Step 1: Input data") | Render | The model numbers its process labels; the layout draws its own numbers. | Leading "1." / "Step 1:" stripped from labels. | label tests |

## Open issues

| # | Severity | Issue | Notes / next step |
|---|---|---|---|
| O1 | Major | Visuals are diagrams of labels, not illustrations | The new layouts explain structure (steps, relations, comparisons), but there's no real imagery: no Moon/Earth/Sun geometry, no light-wave drawing. Next: topic-specific programmatic scenes for common patterns (orbits, cycles, layered systems), then selective AI illustrations after a cost/quality trial. |
| O2 | Major | Narration quality not human-reviewed | Levels, silence and pacing are measured automatically. Pronunciation and naturalness need a person to listen; scores in this area are provisional. |
| O3 | Major | Facts are only reviewed, not verified against sources | Scripts were checked by reading them. Claims I wasn't sure about are flagged in the results. A fact-check step (second model pass or source grounding) is not built. |
| O4 | Minor | `gemini-3.8-flash` is configured in the local `.env` but unresponsive | Recommended one-line change in the root `.env`: `GEMINI_MODEL=gemini-3.6-flash`. The pipeline skips 3.8 after the first timeout, but each new 30-minute window costs one 30 s wait. |
| O5 | Minor | Analogy vs. contrast | Gemini uses `visual_type: analogy` for both "A is like B" and "A versus B", so the comparison layout uses a neutral ↔. A `relation` field in the storyboard schema would allow "≈" vs "vs". |
| O6 | Minor | 90-second videos not tested | Not run because of the ElevenLabs credit budget; duration behaviour at 90 s is unmeasured. |
| O7 | Minor | One video at a time; validator assumes local ffmpeg | Acceptable for the prototype. |
| O8 | Minor | Speech rate varies by content | A4 spoke 2.37 words/s (technical words) vs. 2.75–2.9 elsewhere, giving 66 s for 60 s (still in tolerance). A character-based budget (about 17.5 characters/s measured) would be steadier than words. |
| O9 | Minor | Layout choice can misrepresent structure | The hub layout draws a path (A4: router → cables → server) as a star, and put "Sunlight source" at the centre of a Moon diagram (A1). A per-scene relation hint (sequence, hub, comparison) in the storyboard would fix it. |
| O10 | Minor | Weak endings | A5 ended with an 8-word summary. The prompt could require a concrete takeaway in the last scene. |
