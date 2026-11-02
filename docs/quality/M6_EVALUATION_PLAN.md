# M6 — Evaluation plan

Goal: measure whether Explivio produces accurate, visually relevant, well-timed educational videos, fix the most important weaknesses, and set measurable quality standards.

## Method

1. **Baseline.** Generate videos with the pipeline as it was after F4 (only measurement added). Cover all four caption/music configurations.
2. **Measure.** Run automated checks on every video, and review the script, frames and timing by hand.
3. **Fix.** Fix the top problems at their root cause, with a regression test for each.
4. **After.** Generate a second set with the fixes, including repeats of baseline topics for a direct before/after comparison.

All videos are real: Gemini storyboard, ElevenLabs narration, Remotion render. They run through the same CLI entry point the web app uses (`src/cli.ts`, via `scripts/m6/run-batch.mjs`), and each run folder includes a `request.json`, so it also appears in the web app's My Videos.

## Test matrix

Defined in [`scripts/m6/matrix.json`](../../scripts/m6/matrix.json). Results are in [`m6-runs.json`](m6-runs.json) and [M6_TEST_RESULTS.md](M6_TEST_RESULTS.md).

| Phase | Cases | Purpose |
|---|---|---|
| F4 reference | Moon phases (30 s, male voice, captions on, music on), generated 2026-11-01 during F4 | Existing real video, scored as part of the baseline |
| Baseline | B1–B4, 4 × 30 s, configurations A–D | Current quality, plus the captions/music settings |
| After fixes | A1–A5: 3 × 30 s and 2 × 60 s. A1 repeats the Moon topic and A2 repeats B1 (Seasons) | Effect of the fixes |
| Pending | P1–P7 (CPU, history of the internet, heart, blockchain, black holes, electricity, vaccines; 60–90 s) | Not run: ElevenLabs credit budget |

**Configurations:** A captions on + music on · B captions off + music on · C captions on + music off · D both off.

## Budget

ElevenLabs free plan: 6,629 characters left at the start of M6 (resets 2026-11-26). Speech uses about 17.5 characters per second, so a 30 s video uses about 520 characters, 60 s about 1,040 and 90 s about 1,560. The full 15-topic matrix would need about 13,000 characters, so M6 runs an affordable subset (9 new videos plus the F4 reference), keeping a 700-character reserve. The batch runner records the **actual** characters used per video from the account usage before and after.

## Scoring (100 points)

| Area | Points | How it is judged |
|---|---|---|
| Script accuracy | 20 | Read the full storyboard narration. Check facts, relevance, logic and misleading simplifications. Claims I can't verify confidently are flagged for human review, not marked correct. |
| Visual relevance | 20 | Frames sampled across the video. Do visuals show the topic, support the narration, avoid contradicting it, and avoid repetition? |
| Narration quality | 15 | **Partly automated:** level, silence and pacing (words per second) are measured. Pronunciation and naturalness need a human listener (the reviewer here can't hear audio), so this area is provisional and flagged for human review. |
| Caption accuracy | 10 | Cue text compared with narration, cue validity and timing (automated), placement and readability in frames. |
| Audio sync | 10 | Scene changes vs. spoken words, music level vs. narration (automated, in dB), clean ending (speech ends before the video does). |
| Duration accuracy | 10 | Rendered length vs. request: 10 points within tolerance, scaled down beyond it. |
| Educational value | 10 | Clear intro, logical steps, useful content, sensible density, meaningful conclusion. |
| Presentation | 5 | Polish, typography, composition, pacing in frames. |

**Pass:** 70+ total with no critical issue (a factual error, or visuals that contradict the narration).

## Duration tolerance (initial targets)

| Requested | Tolerance |
|---|---|
| 30 s | ±5 s |
| 60 s | ±8 s |
| 90 s | ±10 s |

Videos are never padded with silence or empty scenes to reach the target. The length comes from the narration, so the fix is at the script stage.

## Automated checks

[`scripts/m6/validate-run.mjs`](../../scripts/m6/validate-run.mjs), using the ffmpeg/ffprobe bundled with Remotion:

- **File:** MP4 exists and isn't empty; H.264; 1080×1920.
- **Audio:** an audio stream exists, and the duration is within tolerance.
- **Narration:** ends before the video does; is audible (mean level above −40 dBFS); has no long silence (under 15% silent windows).
- **Music:** present in speech pauses when on, absent when off; when on, at least 10 dB below the narration.
- **Captions:** the setting is recorded in the render input; cues are valid, ordered, non-empty and inside the video.
- **Frames:** no blank frames in samples taken every 3 s.

Automated checks can't judge factual accuracy or teaching quality; those are reviewed by hand.

## Performance and usage tracked per video

- **Gemini:** model, per-call response time, outcome and retries (`manifest.storyboard.calls`).
- **Narration:** characters and words (`manifest.metrics`), plus actual ElevenLabs characters used (`m6-runs.json`).
- **Timing:** each stage's duration, total time, and output file size.
