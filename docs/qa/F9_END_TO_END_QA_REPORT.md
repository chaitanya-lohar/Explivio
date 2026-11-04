# F9 — End-to-end QA, integration testing and stability

Date: 2026-11-03 · Branch: `dev` · Starting commit: `7aec576` · Spend: **$0** (0 Gemini calls, 0 ElevenLabs characters)

**Statuses used:**
- **PASS:** executed and met the expectation.
- **FAIL:** executed and did not.
- **BLOCKED:** couldn't run because of a free-tier limit.
- **NOT TESTED:** deliberately not run; the reason is given.

Every number here comes from a run executed during F9 (the result files are listed in §13).

## 1. Project audit

| Item | Finding |
|---|---|
| Git | `dev`, clean tree, HEAD `7aec576` (matched the reported F8 commit) |
| Structure | Root: pipeline CLI (`src/cli.ts`), providers (Gemini, ElevenLabs), pure pipeline modules, Remotion renderer with 10 templates (`src/video/templates/`). `web/`: Next.js 16 app, `services/pipeline` (real) and `services/mock` |
| Contract | The web app spawns the CLI with a run id it chooses, then reads `runs/<id>/request.json` and `manifest.json`. The MP4 is streamed by `/api/videos/[id]/file` |
| Tests before F9 | Root 62, web 17 (no integration tests for the real pipeline service) |
| Milestones F1–F8 | Implementation matches `progress_status.md`. F5 (demo auth) is screens-only by design |
| Reports read | `progress_status.md`, `M7_EVALUATION.md`, `M7_ILLUSTRATION_OPTIONS.md`, `M7_VISUAL_INTELLIGENCE_PLAN.md` |

**Gap found in the audit:** nothing tested the real video service (spawning, status mapping, failures, duplicates) without spending API credits. F9 added a **stub CLI** for this (`web/tests/fixtures/stub-cli.mjs`). It's installed at the path the service spawns, inside a temporary pipeline root. It writes manifests exactly like the real CLI, scripted by a tag in the prompt: success, slow, render failure, Gemini quota, ElevenLabs quota, missing output, or crash. The real service, routes and UI run unchanged on top of it, with no external call.

## 2. Areas inspected and how

| Area | Method |
|---|---|
| Full user journey (Settings → Dashboard → Create → Progress → Ready → My Videos → Details → Playback → Download) | Headless Chrome against a production build on the fixture root; a real 31 s narrated MP4 served as the stub's output |
| My Videos, Settings | F6 and F7 browser suites re-run on the new build (real, empty, unreadable and mock libraries) |
| Real pipeline service | Node integration tests with the stub CLI (`web/tests/pipeline-service.test.ts`) |
| M7 templates and selection | Unit tests, the gallery (no API calls), a 90 s fixture covering all six templates (silent render), and existing M7 runs |
| Video quality | `validate-run` over **all 27** existing videos, plus frame review |
| Responsive | 11 pages × 5 widths (1440, 1280, 768, 390, 360) |
| Security and reliability | Code review, secret scans, bundle scan, redaction tests, memory sampling during a render |

## 3. Results summary (executed)

| Suite | Result |
|---|---|
| Root unit tests (`npm test`) | **63/63 PASS** |
| Web unit and integration tests (`web: npm test`) | **27/27 PASS** (10 new pipeline-service tests) |
| F9 journey (browser) | **62/62 PASS** |
| Responsive (browser) | **64/64 PASS** after fixes. The first run was 42/64: 20 real small touch targets and 2 test-selector errors |
| F6 My Videos regression (browser) | **53/53 PASS** |
| F7 Settings regression (browser) | **41/41 PASS** |
| M7 gallery (18 scenes, non-blank check) | **PASS** |
| Video validator sweep (27 videos) | **22 PASS / 5 FAIL**: all 5 are historical, see §7 |
| Typecheck (root and web), lint, production build (35 pages) | **PASS** |

## 4. Test cases by area

### A. Settings — PASS

| Case | Status |
|---|---|
| Defaults: 60 s, English, 9:16, captions on, music off, female voice | PASS |
| Change each option; save feedback; persists after refresh | PASS |
| Home, Create and Configure use the saved preferences; explicit choices win for that video | PASS |
| Saved defaults reach the pipeline: CLI received `--duration 30 --voice=male --no-captions --music` | PASS |
| Reset asks for confirmation (cancel and confirm both work) | PASS |
| Corrupt, partly invalid and old-version stored data handled; cross-tab sync | PASS |

### B. Dashboard and Create — PASS

| Case | Status |
|---|---|
| Dashboard loads (prompt, ideas, recent videos) | PASS |
| Empty prompt rejected; under 10 characters rejected; 650 characters rejected | PASS |
| A 700-character prompt in the URL can't reach Generate | PASS |
| Suggested idea fills the prompt | PASS |
| Duration, voice, captions and music selection | PASS |
| Duplicate submit: triple-clicking Generate starts exactly one job | PASS |

### C. Generation progress — PASS

| Case | Status |
|---|---|
| Request submitted; the job id in the URL equals the run folder and the CLI `--run-id` | PASS |
| Stages shown in real order: plan → narration → render | PASS |
| Refresh during generation: same job, no new run | PASS |
| Success opens Video Ready for the same id | PASS |
| Render failure: failed view, never success, never opens Video Ready | PASS |
| Retry: new job with the same saved settings | PASS |
| Gemini quota (429): fails at "preparing the video plan" with a readable reason | PASS (simulated) |
| ElevenLabs quota: fails at "creating narration" | PASS (simulated) |
| Finished without an output file: failed, not ready | PASS |
| Crashed process: failed with the exit code | PASS (integration test) |
| Process vanished long ago (stale run): failed, not stuck generating | PASS (integration test) |
| Network loss while polling: "Connection lost. Trying again…", no false success or failure, then recovers | PASS |
| Gemini *timeout* | PASS via existing unit tests (`classify`, `afterTransientFailure`); a live timeout was not reproduced |

### D. Video Ready — PASS

| Case | Status |
|---|---|
| Video loads and plays (1080×1920, 31.0 s) | PASS |
| Measured length shown with the target ("0:31 (target 30s)") | PASS |
| Download: HTTP 200, attachment, byte-identical (4,516,989 bytes), valid `ftyp` | PASS |
| Still accessible after refresh | PASS |
| Captions in sync, music follows the setting | PASS (validator on narrated runs: music −25 dB under voice when on, −91 dBFS when off) |

### E. My Videos — PASS

Grid and list views, search (title and prompt), status filters, sort, the combinations of these, URL state, preview dialog, open and download, and the empty, error, unavailable and loading states were all re-run: 53/53. The journey also confirmed that a new video appears first, with no duplicate records, and that a failed job is never listed as ready.

### F. Navigation — PASS

| Case | Status |
|---|---|
| Sidebar: Home, Create Video, My Videos, Settings | PASS |
| Browser Back and Forward | PASS |
| Direct routes and refresh | PASS |
| All 21 internal links on 11 pages resolve; no dead links (`#`, missing href) | PASS |
| Unknown video id: progress says "couldn't find", the details page shows not-found | PASS |
| API rejects path-like ids (`../`, `..\`, over-long) with 404 | PASS |
| Console: no unexpected errors over the whole journey (only the 2 intentional ones: offline, invalid id) | PASS |

### M7 — Visual Intelligence validation

| Case | Status |
|---|---|
| All six templates render in one real video (90 s fixture: orbit, layers, cycle, flow, timeline, comparison) | PASS |
| Gallery: 18 scenes, none blank, no API calls | PASS |
| Educational checks: Sun at the centre of a Moon orbit rejected; a cycle that never repeats rejected; dates not stated in the narration or out of order rejected; road route as orbit rejected | PASS (unit tests) |
| At most one correction per storyboard | PASS (unit and source tests) |
| Fallback to the M6 layout for invalid or missing plans; old storyboards still render | PASS |
| Narration sync: scene drift 0.00 s (N1, N2); reveal-on-mention spot check | PASS |
| Captions don't cross scene changes | **FAIL → fixed** (K5, see §8) |
| Silent mode never calls ElevenLabs (network-guarded CLI test) | PASS |

## 5. BLOCKED

| Case | Reason |
|---|---|
| New narrated videos (especially 60 s / 90 s narrated) | ElevenLabs credits preserved (705 left, reset 2026-11-26). A 90 s video needs about 1,300. Covered instead by the silent 90 s fixture and existing narrated 30/60 s runs |
| 5 pending M7 silent topics (S8–S12) | Gemini free tier hit 429 on 2026-11-02. Not retried in F9 under the "no unnecessary Gemini requests" rule |

## 6. NOT TESTED

| Case | Why |
|---|---|
| A fresh real end-to-end generation (Gemini + ElevenLabs) | To preserve quota and credits; the real path was last exercised by F4/M6/M7 runs, and F9 exercises everything around it with the stub CLI |
| Narration naturalness and pronunciation | Needs a person to listen (M7 K8) |
| Other browsers (Firefox, Safari/iOS) | Only Chrome is available here |
| Screen-reader walkthrough | Needs assistive-technology testing; ARIA roles and labels were checked in code and by the suites |

## 7. Video quality (existing outputs)

| Group | Videos | Result |
|---|---|---|
| Narrated, 30 s and 60 s (M6/M7 runs plus 3 API-demo renders) | 13 | **13/13 PASS**: duration in tolerance (28.0–34.0 s for 30 s; 55.1–66.0 s for 60 s), narration not cut off, no long silence, captions valid, music as set, no blank frames, valid H.264 1080×1920 |
| M7 silent runs (30 s, 60 s) and 90 s fixture | 8 | **8/8 PASS** (90 s fixture: 87.0 s) |
| K5 re-render of N1 | 1 | PASS |
| Historical | 5 | **FAIL, expected:** two Oct-26 demo renders (37 s hand-written scripts with `--duration 30`), the F4 reference and M6 baseline B4 (22 s, 24 s: the problems M6 fixed), and an F8 smoke test run without `--duration`. None is a regression |

Frame review (90 s fixture and M7 runs): text stays inside safe margins, there are no overlapping elements, and diagrams match their narration. The remaining visual weakness is K2 (empty space around small diagrams).

## 8. Bugs found and fixed

| # | Severity | Bug | Fix | Commit |
|---|---|---|---|---|
| B1 | **High** | Two simultaneous Generate requests (two tabs, or a direct POST) both passed the busy check before either run folder existed, starting two renders. Reproduced: "started 2" | A start lock taken synchronously before the first `await` | `d9f6904` |
| B2 | **Medium (security)** | Error details leaked the tail of paths containing spaces (`D:\Namaste AI\…`, `C:\Program Files\…`). This project's own path has spaces | Redaction matches whole Windows and POSIX paths | `d9f6904` |
| B3 | Low (accessibility) | Under-44 px touch targets on phones: header brand link, breadcrumbs, home duration buttons (36 px), "Forgot password?" | Phone-only sizing; desktop unchanged | `44340ba` |
| B4 | Low (captions) | K5: 2–3 caption cues per video spanned a scene change | `splitCuesAtScenes()` on narrated and silent runs; N1 re-render went from 16 cues (3 crossing) to 19 (0 crossing) | `ac8214b` |

Test-harness errors (not product bugs) were found and fixed along the way: two timing races and one selector, so each "pass" reflects real behaviour.

## 9. M7 known issues K1–K8

| # | Issue | Still present? | Effect on understanding | Fix complexity / risk | Decision |
|---|---|---|---|---|---|
| K1 | Every video opens with a `focus` ring | Yes (7/7 M7 runs) | Low: repetitive, not misleading | Needs a new hook template (a feature) | **DEFER** |
| K2 | Small diagrams leave empty space | Yes (seen in the 90 s fixture comparison scene) | Low–medium readability; accuracy unaffected | Layout change across several templates; needs a design pass | **DEFER** |
| K3 | Structures split across scenes | Yes (S4, S5) | Medium: you never see the whole structure | A prompt change can only be verified with Gemini calls; merging in code can't know the order safely | **DEFER** (validate with Gemini later) |
| K4 | A flow lists a stage's name as a step | Yes (S3) | Low | A reliable lint isn't cheap; risk of false positives | **DEFER** |
| K5 | Caption cues span scene changes | Yes, in every narrated video | Medium (words under the wrong diagram) | Small, pure, testable | **FIXED** (`ac8214b`) |
| K6 | 5 silent topics pending | Yes | Coverage of maths and two biology/history topics | Needs Gemini quota | **BLOCKED** (Gemini quota) |
| K7 | Narrated sample is only 2 videos | Yes | Overall score indicative | Needs ElevenLabs credits | **BLOCKED** (credits) |
| K8 | Narration not listened to by a person | Yes | Narration scores provisional | Needs a person | **NOT TESTED** |

## 10. Security and reliability review

| Area | Finding | Status |
|---|---|---|
| API keys | Only `.env.example` templates tracked (empty values); `.env` and `mcp.json` gitignored; no key-like strings in tracked files or the browser bundle | PASS |
| Environment | The web app reads only `EXPLIVIO_PIPELINE_ROOT` and `VIDEO_SERVICE`, server-side; no `NEXT_PUBLIC_*` | PASS |
| Input validation | Prompt 10–600 characters on client and server; duration and voice whitelisted; run ids `^[A-Za-z0-9_-]{1,80}$` plus a containment check | PASS |
| File paths | No path from the user reaches the filesystem; the prompt is passed by file; `spawn` without a shell | PASS |
| Downloads | Served only for ready runs with a file; Range support; filename sanitised to `[a-z0-9-]` | PASS |
| Error leakage | Paths, key-like tokens and stack lines removed (B2 fixed); Next.js hides server errors in production | PASS after fix |
| Duplicate jobs | One render at a time, now race-free (B1) | PASS after fix |
| Temporary files | Validator and contact-sheet temp folders are removed. `public/runs/<id>/narration.mp3` copies are kept (9.4 MB, 33 runs) because re-renders need them | Risk (low), documented |
| Memory | A 30 s render peaked at about 3.1 GB for all render-related processes, including 5 test servers (about 2 GB for the render). Free RAM dipped to 1.6 GB | Risk (medium on 15 GB with other apps open) |
| Unnecessary API calls | The web app calls no external API. Generation is the only paid-capable path, and it's guarded (one at a time, explicit action). Thumbnails and polling are local | PASS |

## 11. Remaining risks

1. **Memory headroom** during renders on this laptop: don't run other heavy apps while generating.
2. **Disk growth:** `runs/` is 447 MB with no retention policy (most of it from the water-cycle photo theme at about 34 MB per video).
3. **Free-tier throughput:** Gemini allowed about 20 storyboard calls before a 429 on 2026-11-02, and ElevenLabs has 705 characters until 2026-11-26. Heavier use pauses until the resets.
4. **Coverage:** only Chrome was tested, with no screen-reader or human listening pass.
5. **Visual polish:** K1–K4 remain (none is an accuracy problem).
6. **Auth:** demo screens only, out of scope until F10.
7. **Tooling noise:** Remotion warns about the zod version on every render. It's harmless so far, but a future Remotion upgrade should align the versions.

## 12. API usage and zero cost

- **Gemini:** **0** calls in F9.
- **ElevenLabs:** **0** characters (balance 705 before and after, read-only check).
- **Paid services, billing, trials, downloads:** none. The optional local image model was not downloaded.
- **How external calls were avoided:** the stub CLI, the mock service, existing outputs, a deterministic fixture rendered in silent mode, and re-renders from saved props.

## 13. Readiness assessment

**Explivio is stable enough to proceed to F10** (authentication and production preparation) as a single-user application:
- Every user-facing path passed on the final build.
- The two integration defects with real impact (B1 duplicate renders, B2 path leaks) are fixed and covered by tests.
- No failed job can appear as a completed video.

**Conditions to carry into F10:**
- a fresh real narrated end-to-end run after the ElevenLabs reset;
- the deferred visual issues K1–K4;
- a human listen-through;
- a retention or cleanup policy for `runs/` before any multi-user use.

**F9 completion: about 95%.** Everything except the BLOCKED and NOT TESTED items in §5–§6 was executed.

**Evidence:** the browser suites and their results (JSON plus screenshots) live in the session scratchpad. The automated tests that matter for regression are committed: `web/tests/pipeline-service.test.ts`, the `tests/*.test.ts` files and the 90 s fixture.
