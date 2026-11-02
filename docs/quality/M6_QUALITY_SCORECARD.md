# M6 — Quality scorecard

Scoring rubric and pass rule: [M6_EVALUATION_PLAN.md](M6_EVALUATION_PLAN.md). Raw per-video data: [M6_TEST_RESULTS.md](M6_TEST_RESULTS.md).

**Pass** = 70+ points and no critical issue. Narration scores are **provisional** (levels, silence and pacing measured automatically; nobody has listened for pronunciation or naturalness yet).

## Scoring rules used

| Area | Rule |
|---|---|
| Duration (10) | 10 within tolerance (30 s ±5, 60 s ±8, 90 s ±10); otherwise 10 − 2 × seconds beyond tolerance, minimum 0. |
| Sync (10) | 10 − 2 × (largest scene drift − 0.5 s), minimum 0; −2 if music is less than 10 dB under the narration. Drift = time between a scene's visual change and the start of its narration. |
| Captions (10) | Valid cues, matching narration, readable placement. When captions are off: 10 if the MP4 correctly has none. |
| Visual relevance (20) | Baseline layout (headline, empty middle, production notes on the step card) scored 5: relevant headline, nothing explanatory, confusing card text. |

## Results

| Test | Topic | Phase | Script /20 | Visual /20 | Narr. /15* | Capt. /10 | Sync /10 | Dur. /10 | Edu. /10 | Pres. /5 | Total /100 | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F4 | Why the Moon Has Phases (F4 reference) | baseline | 18 | 5 | 12 | 9 | 9 | 4 | 7 | 2 | **66** | Fail |
| B1 | Why Do We Have Seasons? | baseline | 19 | 5 | 12 | 9 | 9 | 10 | 8 | 2 | **74** | Pass |
| B2 | What Is a Prime Number? | baseline | 19 | 5 | 12 | 10 | 4 | 10 | 8 | 2 | **70** | Pass |
| B3 | Why Is the Sky Blue? | baseline | 18 | 5 | 12 | 9 | 3 | 10 | 8 | 2 | **67** | Fail |
| B4 | How Does Gravity Work? | baseline | 17 | 5 | 12 | 10 | 8 | 8 | 7 | 2 | **69** | Fail |
| A1 | Why the Moon Has Phases | after | 19 | 13 | 12 | 9 | 10 | 10 | 8 | 3 | **84** | Pass |
| A2 | Why Do We Have Seasons? | after | 19 | 15 | 12 | 9 | 10 | 10 | 9 | 4 | **88** | Pass |
| A3 | How Does Photosynthesis Work? | after | 18 | 8 | 12 | 9 | 10 | 10 | 9 | 3 | **79** | Pass |
| A4 | How the Internet Works | after | 18 | 12 | 12 | 9 | 9 | 10 | 9 | 3 | **82** | Pass |
| A5 | What Is Artificial Intelligence? | after | 17 | 13 | 12 | 9 | 10 | 10 | 7 | 3 | **81** | Pass |

\* provisional

## Summary

- **Baseline:** average **69.2**, 2/5 pass. The main loss is visual relevance (5/20 on every video) and, for some videos, duration and scene sync.
- **After fixes:** average **82.8**, 5/5 pass. Visual relevance more than doubled (5.0 → 12.2 of 20), every video is within duration tolerance, scene sync is near full marks (largest drift 0.9 s, was 4.0 s), and scripts stay accurate.
- **All 10 evaluated:** average **76.0**.
- **Not yet at "publishable" quality:** visuals are labelled diagrams, not illustrations (see M6_KNOWN_ISSUES.md, O1), and narration hasn't been human-reviewed.
