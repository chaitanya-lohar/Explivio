# Vercel deployment notes (decided 2026-11-07, deployment later)

You decided to deploy Explivio on **Vercel**, later, in F14. These are the constraints from Vercel's official docs (read 2026-11-06), and what each means for the current code. Nothing has been changed yet.

## Vercel Hobby (free) plan: facts
| Topic | Official wording / limit | Source |
|---|---|---|
| **Commercial use** | "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan." (Taking payments counts as commercial.) | vercel.com/docs/limits/fair-use-guidelines; vercel.com/legal/terms §4 |
| Functions | Up to **300 s** per request; **2 GB RAM / 1 vCPU**; 250 MB unzipped bundle; 4.5 MB request and response bodies | vercel.com/docs/functions/limitations |
| Filesystem | "read-only filesystem with writable /tmp scratch space up to 500 MB" | vercel.com/docs/functions/runtimes |
| Cron jobs | Hobby: **once per day**, timing within the hour | vercel.com/docs/cron-jobs/usage-and-pricing |
| Background work | `after()` / `waitUntil` run after the response, within the same 300 s limit | vercel.com/docs/functions/functions-api-reference/vercel-functions-package |
| Video rendering | Remotion's documented option: render inside **Vercel Sandbox** (an ephemeral Linux VM). Hobby: 5 h of active CPU a month, 8 GB RAM, 45-minute sessions; creation pauses when the quota is used, never billed | remotion.dev/docs/miscellaneous/vercel; vercel.com/docs/sandbox/pricing |

## What must change in Explivio for Vercel (F14 work)
| Part of Explivio today | Problem on Vercel | Planned change |
|---|---|---|
| **Rendering:** the web server spawns the pipeline CLI and writes to `runs/` on disk | No long-running process, read-only disk, 1 vCPU and a 300 s limit | Render in **Vercel Sandbox** (Remotion's documented path) or on a separate worker host. The finished MP4 already goes to R2 (F11) |
| **Video status:** read from `runs/<id>/manifest.json` | That disk isn't shared or kept | Keep run status and stages in MongoDB (`generationAttempts` already exists) |
| **Email worker:** a `setInterval` loop inside the server | No resident process; Hobby cron runs only once a day | Send queued email in `after()` right after the request (within 300 s), plus a once-a-day cron as a safety net. The MongoDB queue (F13) already makes this safe |
| **Atlas network access:** your home IP only | Vercel uses changing IP addresses | Allow access from anywhere (0.0.0.0/0) with a strong, least-privilege database user (reduce the `atlasAdmin` role first) |
| **Secrets:** `web/.env.local` | — | Vercel project environment variables (never committed) |
| **Client IP for rate limits** | Vercel sets `x-forwarded-for` | Trust Vercel's forwarded IP (`EXPLIVIO_TRUST_PROXY`), as planned in F12 |
| **Free voice (Kokoro, implemented 2026-11-08)** | About 1 GB RAM and a 311 MB model won't fit a normal function | Runs inside the same Vercel Sandbox as the render (8 GB), just before it; the model is downloaded or cached in the sandbox. Gemini TTS remains an API alternative |
| **Email links** | — | Set `EXPLIVIO_APP_URL` to the Vercel URL |

## Points to decide later
1. **Hobby is personal and non-commercial only.** It's fine for a personal project or demo. If Explivio earns money, Vercel requires Pro (paid), which isn't $0.
2. **Render capacity:** Sandbox's 5 h of active CPU a month on Hobby limits how many videos can render each month. This will be measured in F14.
