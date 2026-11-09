# Free narration voice (Kokoro-82M): implementation and feasibility

Date: 2026-11-08 · Status: **implemented and tested; feasible for Explivio.** · Cost: **$0** · Research: [VOICE_FALLBACK_RESEARCH.md](VOICE_FALLBACK_RESEARCH.md)

## Verdict
**Yes, it's feasible.**
- **What it is:** a free, offline voice with no usage limit, female (`af_heart`) and male (`am_michael`).
- **Pipeline:** it now narrates complete videos through the real pipeline, with scene changes synced to the measured speech.
- **Validator:** every automated video check passes.
- **When it's used:** automatically whenever ElevenLabs can't speak (credits used up, no key, errors), or always if you set `NARRATION_PROVIDER=kokoro`.
- **Trade-offs:** the voice is a little less natural than ElevenLabs (the male voice especially). It adds about 30–40 s per 90 s video and about 1 GB of temporary memory while it speaks. Captions are timed per sentence (measured) and estimated per word.

## How it works
```
cli.ts ─► providers/narration.ts (NARRATION_PROVIDER: auto | kokoro | elevenlabs)
            auto: ElevenLabs ─(fails, e.g. quota)─► Kokoro (reason recorded in the manifest)
          providers/kokoro.ts
            1. split narration into sentences (words kept exactly; curly quotes understood)
            2. run kokoro-worker.mjs in its OWN process → speaks each sentence, measures where speech starts/ends
               (the ~1 GB model is freed before rendering starts)
            3. word times spread inside each measured sentence (letters and pauses, M7 speech model)
            4. captions (≤ 6 words, ≤ 34 characters, never across a sentence end)
            5. WAV → MP3 with Remotion's bundled ffmpeg (same file the ElevenLabs path writes)
```

| Setting | Value |
|---|---|
| Voices | Female `af_heart` (speed 1.0); male `am_michael` (speed **1.13**, calibrated because it speaks 13% slower than the script budget) |
| Model | `onnx-community/Kokoro-82M-v1.0-ONNX`, fp32 (3.5× faster than q8 on this CPU), cached in `models/kokoro` (311 MB, gitignored) |
| Packages | `kokoro-js` 1.2.1 (pinned; brings `@huggingface/transformers` 3.8.1 and `onnxruntime-node` 1.21.0), about 400 MB in `node_modules` |
| Settings (root `.env`) | `NARRATION_PROVIDER` (default `auto`); optional `KOKORO_FEMALE_VOICE`, `KOKORO_MALE_VOICE`, `KOKORO_FEMALE_SPEED`, `KOKORO_MALE_SPEED`, `KOKORO_MODEL_DIR` |
| Manifest | `narration.provider`, `voiceId`, `speed`, `wordTiming: "sentence-measured"`, `performance`, plus `fallbackFrom` and `fallbackReason` when auto switched |

## Test results (2026-11-08, this laptop, no Gemini calls)

| Test | Result |
|---|---|
| Full 90 s video, **female**, `NARRATION_PROVIDER=kokoro` (saved storyboard with all six templates) | ✅ Validator **13/13**. Narration: 89 s of audio in **30 s**; render 119 s; total 154 s; 89 s video; speech ends 0.7 s before the end; music 15 dB under the voice; 49 captions; scene timing aligned to the narration |
| Full 90 s video, **male**, `NARRATION_PROVIDER=auto` | ✅ ElevenLabs refused (`elevenlabs_quota_exceeded`, no credits used), so it **switched to Kokoro automatically**. First attempt: 101 s (+11 s, failed the ±10 s check) → speed calibrated to 1.13 → **13/13**, 93 s (+3 s), narration 36 s |
| Pipeline tests | **69/69** with the real model (`KOKORO_TEST=1`); offline 68 pass, 1 skipped (the opt-in real-model test) |
| New unit tests (`tests/kokoro.test.ts`) | Sentence splitting (including curly quotes; a real bug found and fixed), word timing inside measured sentences, caption limits, voice and speed selection, provider choice, fallback reason codes (never the response body), real-model MP3 |
| Typecheck (pipeline and web) | Pass |

**Test videos to watch:**
- `runs/kokoro-test-female/video.mp4`
- `runs/kokoro-test-male-auto/video.mp4`

**Bugs found and fixed:**
1. The male voice made videos too long (fixed by the speed calibration).
2. Sentences ending in a curly closing quote weren't split.
3. An older source-code test expected the CLI to load ElevenLabs directly; updated to expect the selector.

## In the app
- **No screen changes:** the female and male choices map to the Kokoro voices.
- **When the voice is used:** with `auto`, any video that ElevenLabs can't narrate is now narrated by Kokoro instead of failing. **Try again** on the failed video will work; it makes a new run, which calls Gemini once for the script.

## Deployment (Vercel, later)
The voice runs where rendering runs. On Vercel, rendering needs a Vercel Sandbox (8 GB RAM), and Kokoro runs there too, before the render. On Hobby, the sandbox's monthly CPU allowance limits rendering overall, and the voice adds about 30–40 s of CPU per video. On your own computer or server there's no limit.

## Known limitations
- **Captions:** timed per sentence (measured), with words estimated inside each sentence; very close, but not word-exact like ElevenLabs.
- **Male voice quality:** below ElevenLabs. Other voices can be tried with `KOKORO_MALE_VOICE`, for example `am_fenrir`, `am_puck` or `bm_george` (UK).
- **`kokoro-js` maintenance:** not updated since May 2025, so versions are pinned. `sherpa-onnx-node` can run the same model if ever needed.
- **`npm audit`:** 3 "high" findings, all in `sharp` (image decoding), pulled in by the AI toolkit. Explivio never passes images to it (speech only); no fix is available yet. Accepted and documented.
- **GPL code:** the phonemizer used by `kokoro-js` contains GPL code (eSpeak NG). That's fine for a server or website; re-check before ever shipping a desktop app (not legal advice).
