# Explivio prototype

A local prototype that turns an educational topic into a vertical narrated video. The pipeline uses Gemini for a validated storyboard, ElevenLabs for narration, and Remotion for the 1080 × 1920 MP4 render. Generated run artifacts stay in `runs/<run-id>/` and are ignored by Git.

## Repository layout

- `src/`, `scripts/`, `public/`: the video pipeline (this README).
- `web/`: the Explivio dashboard frontend (Next.js). See [web/README.md](web/README.md).
- `docs/`: PRD, plans, design documents and [progress status](docs/progress_status.md).

## Requirements

- Node.js 20 or newer
- npm
- Gemini API key from Google AI Studio
- ElevenLabs API key with access to the supplied voice ID

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Add your keys and voice IDs to `.env`. The local environment is set to two account-verified Free-tier defaults: Roger (male) and Bella (female). Set `ELEVENLABS_VOICE_GENDER=male` or `female` to choose one. ElevenLabs currently plans to retire its old Default voices on December 31, 2026, so recheck available replacements before that date. Keep API keys private and do not commit `.env`.

## Generate a video

```powershell
npm run generate -- "Explain how a database index speeds up a query" --duration 60
```

Duration can be 30, 60, or 90 seconds. The command stores the storyboard, narration audio, render properties, MP4, and stage manifest in a unique local run folder. For a visuals-only sample that does not call providers:

```powershell
npm run render:demo
```

Two science samples use animated diagrams and short captions without provider keys:

```powershell
npm run render:photosynthesis
npm run render:rain
```

A fully animated "How APIs work" explainer (restaurant analogy) uses ElevenLabs narration per scene, so scene cuts, highlights, and captions follow the measured speech. It also uses a soft synthesized music bed (`npm run make:music` regenerates `public/assets/soft-pad.wav`):

```powershell
npm run render:api
```

Set `ELEVENLABS_NARRATOR_VOICE_ID` to use a specific narrator, such as an Indian-English library voice. ElevenLabs only allows library voices through the API on paid plans.

Run `npm run dev` to open Remotion Studio. Use `npm run typecheck` for a static type check.

## Current prototype notes

- Provider calls are isolated in `src/providers` and use the official Google GenAI SDK and ElevenLabs HTTP API.
- A malformed Gemini response gets one bounded repair attempt; Zod validates the accepted storyboard.
- ElevenLabs character alignment is grouped into short caption cues and used for caption timing. Scene changes still use the storyboard's estimated scene lengths, so inspect samples and adjust scenes if a transition feels out of sync.
- The current renderer uses reusable programmatic graphics; no image generation, cloud storage, database, or web application is included.
- Stage timing, provider/model metadata, errors, and output paths are written to the manifest. Provider charges are not yet calculated because pricing and usage data are not available from these calls.
