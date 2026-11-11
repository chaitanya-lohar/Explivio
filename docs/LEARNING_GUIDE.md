# Explivio: how it works (learning guide)

Written 2026-11-11. This guide explains every model and service Explivio uses, why each one was chosen, what we tried before and why we moved on, and the complete path of a video from the moment someone types a prompt to the moment they download the MP4. File paths point to where each part lives in the code.

---

## 1. What Explivio does

You type a topic ("how photosynthesis works"). Explivio writes a short script and a visual plan, narrates it, animates diagrams that appear as they are spoken, and delivers a vertical (9:16) explainer video of 30, 60 or 90 seconds.

It is a **pilot**. It runs entirely on free tiers (**$0**), and other people can sign up and try it. Paid services are only for later, if we decide to scale.

---

## 2. The big picture

```
 Browser (you)
    │  sign in, type prompt, "Improve my prompt", Generate
    ▼
 Website: Next.js on Vercel  (web/)
    │  checks: signed in? daily limit? another video rendering?
    │  saves the job in MongoDB Atlas  ──────────────►  MongoDB Atlas (accounts, videos, progress, email queue)
    │  starts one Vercel Sandbox for this video
    ▼
 Vercel Sandbox: a temporary Linux machine  (our "render worker")
    │  1. Video plan     ── Groq (gpt-oss-120b); Gemini as backup
    │  2. Narration      ── Kokoro voice model (runs inside the sandbox)
    │  3. Timing         ── scenes and captions follow the spoken words
    │  4. Render         ── Remotion (React → MP4), Clean theme, icons, emoji
    │  5. Thumbnail      ── one still frame (JPEG)
    │  6. Upload         ── MP4 + thumbnail ──────────────►  Cloudflare R2 (private video storage)
    │  reports progress to MongoDB every few seconds, then stops itself
    ▼
 Browser polls the website every 2 s ── shows the stages, then the player
    │  play / download: the website checks you own it, then streams from R2
```

Emails (verify, reset password) go from MongoDB's email queue → the website → **Brevo** → the user's inbox.

---

## 3. Every model and service, and why

### 3.1 AI language models (writing the video plan, improving prompts)

| Model | Who makes it / runs it | Used for | Free limit | Why |
|---|---|---|---|---|
| **`openai/gpt-oss-120b`** | Made by **OpenAI** (an "open-weight" model anyone may run); **hosted by Groq** | **First choice** for video plans and "Improve my prompt" | Groq free tier (third-party reports suggest around 1,000 requests a day; check the Groq console) | Very fast (a full plan in about 6 s), large limit, free. The closest free option to "ChatGPT". |
| `gemini-3.6-flash` | Google | Backup 1 for video plans | **20 requests a day** for this model | Good quality, but slow (30–50 s per plan) and a tiny daily limit |
| `gemini-3.5-flash` | Google | Backup 2 | 20 a day (its own allowance) | Same family, separate quota |
| `gemini-3.5-flash-lite` | Google | Backup 3; prompt helper backup | 20 a day | Cheap and fast, lower quality |
| `gemini-3.1-flash-lite` | Google | Prompt helper backup | 20 a day | |

**How the chain works** (`src/providers/gemini.ts`, `modelChain()`):
- The models are tried **in order**, and each at most once per video (plus one "please fix this" repair request), so a video makes only a few requests.
- If one model is busy, rate-limited, retired or failing, the next one takes over.
- Whatever model answers, the result must pass the same checks (section 5, step D1).

**Why the order changed over time:**
1. **Gemini only, at first.** Google's free tier looked enough.
2. On 2026-11-11 videos failed with HTTP 429. Google's error named the real limit: **`GenerateRequestsPerDayPerProjectPerModel-FreeTier limit=20`**, meaning only 20 requests a day **per model**. Testing alone used it up. The backup was the same model, so it was no real backup.
3. **Fix 1:** the backup became a *different* Gemini model, because quota is counted per model.
4. **Fix 2:** you asked about the ChatGPT API. **OpenAI's API has no free tier** (it needs prepaid credit), so it breaks the $0 rule. **Groq** offers free hosted models instead.
5. We first chose Llama 3.3 70B on Groq, but Groq had **retired it** (HTTP 404). The best available model was OpenAI's open **gpt-oss-120b**.
6. **Groq is now first** (your choice), and Gemini is the backup chain. Any error moves on to the next model; before, one Groq 404 ended the attempt.

### 3.2 Voice (narration)

| Service | Used for | Limit | Status |
|---|---|---|---|
| **Kokoro-82M** (open model, Apache-2.0) | **All narration now** (`NARRATION_PROVIDER=kokoro`) | None: it runs inside our renderer, with no account or key | Voices: female `af_heart`, male `am_michael` (speed 1.13 to match the target length). Model about 311 MB, stored in the renderer snapshot. |
| ElevenLabs | Original narration provider | Free plan **10,000 characters a month** (about 14 videos) | Ran out on 2026-11-07. Kept as an option (`auto` mode tries it first when a key exists), but production uses Kokoro. |

**Why we moved:** ElevenLabs sounds excellent, but its free credits ran out in days, and videos stopped. Kokoro is free with no limits and runs offline. ElevenLabs returns exact timings per character. Kokoro speaks sentence by sentence, we **measure** each sentence's real start and end from the audio, and spread the words inside it, so captions are close but not word-exact (`src/providers/kokoro.ts`).

### 3.3 Hosting and rendering

| Service | Used for | Free limit | Why |
|---|---|---|---|
| **Vercel (Hobby plan)** | The website (Next.js 16, Node 24) | Non-commercial use; functions up to 300 s; no billing (features pause at limits) | Free, simple. Shares the team with Make My Marriage. |
| **Vercel Sandbox** | A temporary Linux machine **per video** that runs the whole pipeline | **5 hours of active CPU a month**; 15 GB of snapshots; 45 min per session | Rendering a video needs minutes of CPU and Chrome; a normal web function (300 s, 2 GB, read-only disk) can't do that. |
| **Snapshot** | A frozen copy of a prepared sandbox (our code, npm packages, Chrome, fonts, the Kokoro model), about 2.3 GB | Counts towards the 15 GB | A new sandbox starts in about 1 s instead of installing everything (about 80 s) each time. **We keep only one**: when storage filled up (7 snapshots, 16.3 GB), new builds were blocked until old ones were deleted. |
| **Remotion** | Turns React components into video frames, then an MP4 (H.264) | Free licence for individuals and small teams | Lets us build animations with code: diagrams, timing, captions. |

**Why not render on the laptop?** At first the website ran the pipeline on your laptop. That meant the site only worked while your laptop was on, so nobody else could use it. On Vercel, each video gets its own cloud machine instead.

**Why 720p?** Measured in the cloud, 720p used about 20% less CPU than 1080p, so more videos fit in the 5 h. 720p files use compression quality 23 (we tested that the image stays sharp).

### 3.4 Data and storage

| Service | Used for | Free limit | Why |
|---|---|---|---|
| **MongoDB Atlas (M0)** | Accounts, sessions, videos, **progress of each render**, email queue, rate limits | 512 MB | One database for everything. Progress lives here (not in files) because Vercel's disk is read-only and the renderer is a separate machine. |
| **Cloudflare R2** | The MP4s and thumbnails (private bucket) | 10 GB storage, 1M uploads/month (an overage is billed, so the app stops uploading at 80%) | Cheap, S3-compatible storage with no download fees. Videos used to sit in `runs/` on the laptop. |

### 3.5 Email

| Service | Status | Why |
|---|---|---|
| Local "outbox" (files) | Development only | Nothing is sent; good for testing |
| Resend | Replaced | Free, but without a **verified domain** it delivers only to the account owner. Other testers got nothing. |
| DigitalPlat free domain `explivio.dpdns.org` + Cloudflare DNS | Tried | Resend refuses free public domains, and Brevo couldn't add it either |
| **Brevo (SMTP)** | **In use** | Free plan (about 300 a day; the app caps itself at 250) with **one verified sender address**, no domain needed. Brevo shows the sender as `explivio <…@brevosend.com>` so the email passes Gmail's anti-spoofing checks. Emails may land in spam. |

Email is never sent during the request: it's put in a **queue** in MongoDB. On Vercel it's sent right after the response (Next.js `after()`), and a daily cron job sends anything left over. Link tokens are created only at send time (`web/src/lib/email/`).

### 3.6 Visual assets (all free, all inside the renderer)

| Asset | Licence | Used for |
|---|---|---|
| **Lucide** icons | MIT | An icon on each diagram item (cloud, server, landmark…), matched from about 90 concepts (`src/video/concepts.ts`) |
| **Noto Color Emoji** | OFL | The big illustration beside each scene's heading (Gemini or Groq picks one per scene) |
| DejaVu and Liberation fonts | Free | Text and symbols (✓ ↻ ≈); the renderer is Linux and had no symbol font at first, so ✓ showed as a box |

**Images we tried and dropped:** Pexels had **paused new API keys**. Pixabay worked (relevance checks, retries), but you decided real photos weren't needed, so the code was removed before it went live.

---

## 4. The video look (and how it evolved)

1. **Dark only** (the app's own colours): every video looked the same.
2. **Four themes chosen by topic** (Midnight, Clean, Vibrant, Paper). The first rules matched "clouds" as tech, and a single "planet" outweighed "water" and "weather".
3. **Clean only** (your decision): bright white and soft blue, indigo and teal. `DEFAULT_THEME = 'clean'` in `src/video/theme.ts`.

**Motion today** (`src/video/editorial.tsx`, `src/video/templates/`):
- a moving backdrop (drifting colour blobs, floating particles);
- headings that appear word by word;
- scene changes that vary: circle reveal, zoom, wipe, slide;
- diagram items that "pop" in as the narration mentions them, each with an icon;
- an emoji illustration that bounces in and floats;
- captions that highlight the word being spoken, and a progress bar along the top;
- frame 1 is a finished cover, and a thumbnail is saved for My Videos.

---

## 5. Complete flow of one video

### A. Sign in
- Accounts live in MongoDB. Passwords are hashed with **scrypt** (never stored as text).
- Sessions are HttpOnly cookies with a record on the server.
- Sign-in is limited per account (10 failed attempts per 15 minutes).
- Code: `web/src/lib/auth/`, `web/src/services/auth/service.ts`.

### B. Write the prompt (optional: "Improve my prompt")
- You type a topic (10–600 characters).
- **Improve my prompt** sends your text to Groq first, then the lite Gemini models. It comes back as "Explain … to complete beginners, using …" plus 3 related ideas.
- Nothing changes until you choose "Use this" or tap an idea.
- Limits: 30 a day per account. Your text is passed as quoted data, so instructions hidden in it are ignored.
- Code: `web/src/lib/ai/prompt-assist.ts`, `web/src/features/video-creation/prompt-assist.tsx`.

### C. Press Generate (the website, a few seconds)
`web/src/features/video-creation/actions.ts` → `web/src/services/pipeline/videos.ts`
1. **Checks:** signed in; **one video renders at a time** across the whole app (MongoDB heartbeat); your **daily limit** (10 a day per account, and deleted videos still count).
2. **Saves the job** in MongoDB (`videoProjects` + `generationAttempts`, status *queued*), with your settings: voice, captions, music, duration.
3. **Starts a Vercel Sandbox** from the snapshot (`sandbox-dispatch.ts`). It passes only the keys the pipeline needs (database, R2, AI, voice), never login or email secrets, then launches the worker and returns.

### D. Inside the sandbox (2–4 minutes)
`web/scripts/render-worker.mts` loads the job from MongoDB and runs the pipeline CLI (`src/cli.ts`) through the shared executor (`run-executor.ts`). A supervisor copies progress into MongoDB every few seconds (`run-status.ts`).

**D1. Video plan (storyboard).** `src/providers/gemini.ts`
- The AI chain (Groq first) gets your topic, the target length and strict instructions. It returns JSON: title, scenes, the narration for each scene, on-screen text, a **visual plan** (which animated template and its labels), and an **emoji** per scene.
- The answer is checked with a **schema** (Zod). The script must also be the right length for the duration, open with a hook, end with a clear takeaway, and stay on topic.
- If something is wrong, the model gets **one** correction request. An off-topic script is rejected.

**D2. Narration.** `src/providers/narration.ts` → `kokoro.ts`
- Kokoro speaks each sentence in a separate process and saves `narration.mp3`, with measured timings.

**D3. Timing.**
- Each scene starts when its first word is actually spoken (`scene-timing.ts`).
- Captions are split so they never cross a scene change.
- Diagram items appear just before their word is spoken (`mention-timing.ts`).

**D4. Render.** Remotion renders `src/video/index.tsx` → `EditorialVideo`.
- Clean theme, a template per scene (orbit, cycle, layers, flow, timeline, comparison, steps…), icons, emoji, transitions, captions and optional music.
- Output is 720p MP4 (`--scale=2/3`, compression quality 23).

**D5. Thumbnail.** One still frame late in scene 1 (heading and diagram visible), saved as `thumbnail.jpg` (about 23 KB).

**D6. Upload.** `cloud-upload.ts`
- The MP4 is uploaded to R2 at `users/<you>/videos/<id>/video.mp4`, then **verified** (size, type, MD5 checksum) before the video is marked ready.
- The thumbnail goes next to it.

**D7. Stop.** The worker stops its own sandbox, so it doesn't sit idle. A 20-minute hard limit is the backstop.

### E. Watching the progress
- The progress page asks the website every **2 seconds** (`/api/videos/[id]`). The website reads the status from MongoDB: *queued → plan → narration → render → finishing → ready*, or *failed* with a safe reason.
- A run that stops reporting for 15 minutes is marked failed. **Try again** reuses your saved settings.

### F. Watch, download, delete
- **Play:** `/api/videos/[id]/file` checks that you own it, then streams from R2 with seeking. The bucket stays private.
- **Download:** a signed R2 link valid for 5 minutes.
- **Thumbnail:** `/api/videos/[id]/thumbnail`, for the owner only.
- **Delete:** removes the R2 files, then the record (`deleteVideo`).

---

## 6. Limits and capacity (free tiers)

| What | Limit | What it means |
|---|---|---|
| Rendering (Vercel Sandbox) | 5 h active CPU a month | About **34–48 ninety-second videos a month** (373–533 s CPU each); more if shorter. When used up, rendering pauses until next month (never billed). |
| AI | Groq free tier first; then 20 a day per Gemini model | Plenty for a pilot; failed videos can be retried |
| Email (Brevo) | about 300 a day (app cap 250) | |
| Storage (R2) | 10 GB | About 800 videos at about 12 MB |
| Database (Atlas M0) | 512 MB | Under 1 MB used |
| Per user | 10 videos a day; 30 prompt improvements a day | Protects the shared free limits |
| Snapshots | 15 GB | Keep only the one in use |

---

## 7. Security in short
- **Secrets** live only in `.env`, `web/.env.local` (laptop) and Vercel's environment variables (hidden). They are never in code or Git.
- **Only you can see your videos:** another user's video id answers as "not found".
- **Defences:**
  - HTTPS-only (HSTS);
  - the site can't be framed by other sites;
  - client addresses come from Vercel's trusted header;
  - rate limits on sign-in, sign-up and email.
- The database user can only read and write the `explivio` database.

---

## 8. Glossary
- **Storyboard:** the AI's plan for the video: scenes, narration, on-screen text, visuals.
- **Template:** a reusable animated diagram (cycle, flow, timeline…) that the plan fills with labels.
- **Snapshot:** a saved, ready-to-run copy of the render machine.
- **Sandbox:** a temporary cloud computer created for one video and then thrown away.
- **Rate limit / 429:** a service saying "too many requests, slow down"; a free quota is used up.
- **Open-weight model:** a model whose trained files are published, so other companies (like Groq) can run it.
- **SMTP:** the standard protocol mail servers use to send email.
- **R2 / S3:** "object storage": files stored by a key, like `users/…/video.mp4`.

---

## 9. Where to look in the code
| Part | Files |
|---|---|
| AI chain and video plan | `src/providers/gemini.ts` (`modelChain`, `createStoryboard`) |
| Prompt helper | `web/src/lib/ai/prompt-assist.ts` |
| Voice | `src/providers/narration.ts`, `kokoro.ts`, `elevenlabs.ts` |
| Pipeline steps | `src/cli.ts` |
| Video look | `src/video/editorial.tsx`, `theme.ts`, `concepts.ts`, `templates/` |
| Website ↔ renderer | `web/src/services/pipeline/videos.ts`, `sandbox-dispatch.ts`, `run-executor.ts`, `run-status.ts` |
| Render worker and snapshot | `web/scripts/render-worker.mts`, `sandbox-snapshot.mts`, `sandbox-measure.mts` |
| Storage | `web/src/lib/storage/`, `web/src/services/pipeline/cloud-upload.ts` |
| Email | `web/src/lib/email/` |
| History of every change | `docs/progress_status.md` (changelog) |
