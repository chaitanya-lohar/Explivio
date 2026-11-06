# Free narration voice: research and trial (parked)

Date: 2026-11-07 · Status: **parked at your request.** Nothing was added to the app; research and a local trial only. $0.

## Problem
Narration uses ElevenLabs. On 2026-11-06 a 60 s video failed at the narration stage: the free plan had 267 characters left and the video needed 858. Credits reset on 2026-11-26, and the free plan's 10,000 characters a month is about 10 narrated videos.

## Options (official sources checked 2026-11-06)
| Option | $0 without a card | Runs where | Verdict |
|---|---|---|---|
| **Kokoro-82M** (Apache-2.0, `kokoro-js` 1.2.1) | Yes, unlimited | On the server (CPU) | Best self-hosted option; trial below |
| **Gemini TTS** (existing Gemini key, free tier) | Yes | Google's API | Best API option. Free daily limit unpublished (forum reports 10–100 requests a day); free-tier data used by Google; free tier not allowed for EU/UK/Swiss users; no word timings. Limits are per model, so it doesn't share the script model's quota (not verified for your account) |
| Piper | Yes | Server | More robotic; several voices are non-commercial |
| Google Cloud TTS, Azure, Polly | Need a billing card | API | Excluded ($0 rule) |
| OpenAI TTS | Paid | API | Excluded |
| Deepgram, Cartesia, PlayHT | One-time or tiny credits | API | Not sustainable |
| Edge "Read aloud" | Unofficial | API | Not allowed commercially; can break |
| XTTS-v2, F5-TTS | Non-commercial licenses | — | Excluded |

## Kokoro trial on this laptop (2026-11-07)
- **Script:** a ~60 s educational script (805 characters), generated sentence by sentence.
- **Samples:** `data/voice-trial/kokoro-female-af_heart.mp3` and `kokoro-male-am_michael.mp3` (gitignored).

| Setting | Speed (seconds of work per second of audio) | Notes |
|---|---|---|
| q8 (compressed) | 2.06 | 60 s of audio took about 2 minutes |
| **fp32 (full precision)** | **0.58–0.62** | 50 s of audio in 31 s (female), 58 s in 34 s (male); load 2.3 s; peak memory about 970 MB |

**Timing:** each sentence's length is measured (0.057–0.081 s per character), so scene changes can stay exact. Word timings inside a sentence would be estimated, or aligned later with whisper.cpp (MIT, offline).

**Size:** about 410 MB of npm packages plus a 326 MB model (the trial packages were removed again; only the samples were kept).

## Deployment answer
A self-hosted voice runs on the same server that renders videos. Rendering already needs a long-running server with about 2 GB of RAM; the voice adds about 1 GB and about 35 s per video. An API such as Gemini TTS needs no server resources but has a small quota and the terms above.

## Suggested plan when resumed
1. Put voice providers behind one interface, with an automatic chain: ElevenLabs (while credits last) → Gemini TTS (after checking its real free limit: in AI Studio, or with 2 test requests) → Kokoro on the server (decided in F14, together with server memory).
2. Measure each scene's real audio length so scene changes stay in sync, and record which voice each video used.
