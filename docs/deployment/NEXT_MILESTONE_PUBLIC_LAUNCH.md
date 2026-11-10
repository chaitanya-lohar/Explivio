# Next milestone: public launch (finish F14, then F15)

Written 2026-11-10. Explivio is live at https://explivio.vercel.app and works end to end for the owner's account. This milestone makes it ready for **other people** (the LinkedIn post), then validates the whole product (F15). Budget stays **$0**. Each step is tested before the next one starts.

Owner: **You** = the user (dashboards and decisions), **Claude** = code, configuration and testing.

## Part A: launch blockers (F14 completion)

### Step 1: email to every user (You + Claude, about 1 h plus DNS wait)
1. **You:** register a free domain at DigitalPlat (e.g. `explivio.dpdns.org`; one per account; check the spelling and that there's no charge).
2. **You:** add it to Cloudflare (Free plan) and set Cloudflare's two nameservers at DigitalPlat. Wait for **Active**.
3. **You:** add the domain in Resend, then copy its 3 records into Cloudflare DNS:
   - MX on `send`;
   - SPF TXT on `send`;
   - DKIM TXT on `resend._domainkey`.

   Then click **Verify**.
4. **You:** set `EMAIL_FROM=Explivio <no-reply@<your domain>>` in Vercel (Production + Preview) and `web/.env.local`.
5. **Claude:** redeploy production, then queue a test email to a second address. The job must be `accepted`.
6. **You:** sign up with a second Gmail address. The verification email arrives (check spam), the link works, sign-in works.

**Done when:** a brand-new account on a different address can verify and sign in.

### Step 2: Terms of Service and Privacy pages (Claude, about 1 h)
- `/terms` and `/privacy`: plain, honest pages, linked from sign-up and the footer.
  - **What's stored:** account details, prompts, videos in R2, email logs.
  - **What's sent to Google Gemini:** the prompt.
  - **Free and non-commercial;** no guarantees.
  - **How to ask for deletion:** your contact address.
- **You:** approve the wording and the contact email to show.

**Done when:** both pages load signed out, and the sign-up checkbox links to them.

### Step 3: monthly render cap with a clear message (Claude, about 1–2 h)
- Count cloud renders and their measured CPU per month in MongoDB. Stop new videos before the free 5 h Sandbox allowance runs out (e.g. at 4.5 h).
- Show "Video creation is paused until <date>: this month's free capacity is used up" on Create and the dashboard, instead of a failure.
- The existing daily per-account limit stays.

**Done when:** tests show the cap blocks new videos and the message appears; normal creation is unaffected.

### Step 4: health check and backup (Claude, about 1 h)
- `/api/health`: database, R2 and email configuration, and render capacity left this month. Status words only, no secrets.
- `npm run db:backup`: exports the collections (not sessions or tokens) to a private R2 file. Run it by hand monthly.

**Done when:** health answers `ok` in production, and one backup is created and listed.

### Step 5: security tidy-up (You, about 15 min)
- **Atlas:** rotate the `explivio_app` password to a long random one. Update `MONGODB_URI` in Vercel (Production + Preview) and `web/.env.local`.
- **Atlas:** add a separate **test user** with access only to `explivio_test_*` databases, so the 27 live tests can run again. Claude supplies the exact role.
- **Decide** whether to delete the 3 leftover test snapshots now or let them expire.

**Done when:** production still works after the rotation; the live tests pass with the test user.

### Step 6: merge and release (You + Claude)
1. **Claude:** full checks (web live suite, pipeline, typecheck, lint, build), then redeploy production.
2. **You:** merge `dev` into `main`: https://github.com/chaitanya-lohar/Explivio/compare/main...dev
3. **Claude:** update `progress_status.md` and the F14 plan to "complete".

## Part B: F15, final product validation (Claude tests, You confirm)

Run on **production**, with **two independent accounts** (A and B). Results go in `docs/qa/F15_FINAL_PRODUCT_VALIDATION.md`.

### Step 7: full journey, both accounts
Sign-up → email → verify → sign-in → dashboard → create a 30 s video → progress → R2 upload → Video ready → My Videos → playback with seeking → download → sign-out → forgot or reset password.

### Step 8: isolation and security
- B can't see, play, download or retry A's videos (404s, including direct URLs and API calls).
- Signed-out users are redirected; download links expire after 5 minutes.
- Security headers present; the cron rejects unauthenticated calls; no secrets in pages or logs.

### Step 9: failure and recovery
- A Gemini timeout or failure shows a clear error, and **Try again** works.
- Two videos at once: the second gets the "busy" message.
- Daily per-account limit and monthly cap messages.
- An upload failure can be retried without re-rendering.

### Step 10: devices, browsers and performance
- **Phone width** (375 px) and tablet: no sideways scrolling; buttons easy to tap.
- **Browsers:** Chrome, Edge and Firefox (desktop), plus a phone browser.
- **Record:** page load times, time per 30/60/90 s video, and CPU per video against the monthly allowance.

### Step 11: data integrity
MongoDB records match the R2 objects (no orphans, sizes and checksums match); deleted or failed runs leave nothing half-written.

### Step 12: launch decision
- **Claude:** the F15 report, with pass/fail per check, open issues and recommendations.
- **You:** approve. Then the LinkedIn post.

## Order and timing
- **Today:** Step 1 (email).
- **Next:** Steps 2–4 (Claude; about half a day together), then Step 5 (you, 15 min) and Step 6.
- **After that:** F15, Steps 7–12, about half a day of testing.
- **Not in this milestone** (optional backlog): image generation, more voices, ElevenLabs re-evaluation after 2026-11-26, account self-deletion.
