# Explivio — Roadmap

Last updated: 2026-11-05.

**Goal:** turn Explivio from a single-machine app with local video files into a secure, multi-user, cloud-backed application, at $0. Rules: [PROJECT_CONTEXT.md §3](PROJECT_CONTEXT.md#3-non-negotiable-rules).

Phases run **one after another**. Each phase starts only when the user asks for it, and it ends with tests, a report, a `progress_status.md` update and a push to `dev`.

```
F10 closeout ─► F11 R2 storage ─► F12 auth hardening ─► F13 Gmail email ─► F14 production readiness ─► F15 final validation
```

## Done

| Phase | Summary | Evidence |
|---|---|---|
| M1–M7 | Pipeline: storyboard, narration, Remotion render, captions, music, six animated templates (M7 is also called F8) | [quality/](quality/) |
| F1–F4 | Web foundation, creation flow, progress / failure / Video ready, real pipeline | progress_status milestones |
| Auth UI | The five Stitch auth screens | progress_status |
| F6, F7 | My Videos library, Settings | progress_status |
| F9 | End-to-end QA, 4 bugs fixed | [qa/F9_END_TO_END_QA_REPORT.md](qa/F9_END_TO_END_QA_REPORT.md) |
| F10 | MongoDB Atlas plus self-managed authentication and per-user ownership | [auth/](auth/) |

There is no separate "F5": the auth screens were built between F3 and F4 and are recorded under "Authentication UI".

## F10 operational closeout (user actions; next before F11)

| # | Task | Owner | Status |
|---|---|---|---|
| 1 | Create an account with the intended email | User | Appears done: an account was created on 2026-11-04 (outbox entry) and a video was generated under it. Not re-checked in the database (no external calls in the reconciliation task) |
| 2 | Verify the account through the outbox link | User | Appears done (a video was created, which needs sign-in); not re-checked in the database |
| 3 | Set `EXPLIVIO_LEGACY_OWNER_EMAIL` in `web/.env.local` | — | **Not needed:** old videos deleted on 2026-11-05 |
| 4 | `npm run db:legacy-ownership` dry run | — | Not needed |
| 5 | Review the count of ownerless runs | — | Not needed (0 runs left) |
| 6 | Approval, then `-- --apply` | — | Not needed |
| 7 | Reduce the Atlas user from `atlasAdmin` to `readWrite` on `explivio` | User (Atlas UI) | Not verified; can't be checked from the repo |
| 8 | Remove `NODE_ENV` and `APP_ENV` from `web/.env.local` | Claude | ✅ Done 2026-11-05 |
| 9 | Re-run the F6, F7 and F9 browser suites with a sign-in step | Claude | Not done |

## F11 — Cloudflare R2 video storage ✅ done 2026-11-05 ([report](storage/F11_R2_IMPLEMENTATION_REPORT.md))

- **Objective:** completed MP4s are stored in R2 and served securely; MongoDB holds the metadata.
- **Current state:** no R2 or S3 code and no SDK dependency in the repository; videos exist only in `runs/`.
- **Target flow:** Gemini → ElevenLabs → Remotion → local MP4 → upload to R2 → integrity check → MongoDB update → Video ready.

| Area | Scope |
|---|---|
| Configuration | Bucket `explivio-assets`; a dedicated token scoped to that bucket; server-side env vars only; S3-compatible API; reuse MMM's pattern (code shared without secrets); add one SDK only if needed |
| Metadata (`videoProjects`) | Object key, provider, content type, size, checksum, upload status. Existing fields kept; any schema change goes through a documented migration |
| Delivery | No public bucket URLs. Short-lived presigned URLs or the existing authenticated `/api/videos/[id]/file` route, with an owner check first |
| Safety | Upload, then verify, then mark ready. Local files are kept until the upload is verified. Upload failures can be retried. **No automatic bulk migration** of old videos and no `runs/` deletion |
| Tests | Connectivity, upload, existence, download, presigned expiry, invalid credentials, missing object, interrupted upload, retry, ownership, cross-user denial, large file |
| Prerequisites (user) | Create the bucket and token; put the credentials in `web/.env.local`; share MMM's R2 code with secrets removed |
| Check first | Current R2 free-tier limits (storage, operations, egress) on Cloudflare's official pages |
| Docs | `docs/storage/F11_R2_STORAGE_ARCHITECTURE.md`, `docs/storage/F11_R2_IMPLEMENTATION_REPORT.md` |

## F12 — Authentication and authorisation hardening ✅ done 2026-11-05 ([report](security/F12_SECURITY_IMPLEMENTATION_REPORT.md))

- **Objective:** review and strengthen the existing self-managed auth. Keep it unless there's a documented reason to change.
- **Review:** session lifecycle, expiry, revocation and logout; password policy; rate limits (currently in memory); verification and reset tokens; cookies; CSRF; server-side authorisation; ownership of videos, generation attempts, settings and R2 objects.
- **Permission model:** `user` and `admin` only. Admin is granted out of band (a script or the database) and can never be self-assigned. Client-supplied user ids are never trusted.
- **Tests:** IDOR, privilege escalation, session fixation and replay, cross-user R2 access.
- **Doc:** `docs/security/F12_AUTHORIZATION_SECURITY_REVIEW.md`.

## F13 — Real Gmail email delivery

- **Objective:** verification and reset emails reach a real Gmail inbox.
- **Current state:** outbox transport (default) plus an optional Resend transport that needs a verified domain. No SMTP or Gmail code.
- **Approach:** Gmail SMTP with an **App Password** first (needs 2-Step Verification on the Google account). Fall back to the Gmail API with OAuth if SMTP isn't suitable. No paid email service, and never the normal Gmail password.
- **Emails:** verification, resend, password reset, welcome, security notice (password changed).
- **Rules:**
  - Branded templates; the Stitch screens unchanged.
  - Delivery failures handled, and delivery never claimed when sending failed.
  - Tokens and passwords never logged.
  - The outbox stays available for tests.
  - Sender and recipient settings kept separate.
- **Check first:** Gmail sending limits on Google's official pages.
- **Doc:** `docs/email/F13_GMAIL_EMAIL_DELIVERY.md`.

## F14 — Production readiness and deployment

- **Starts only** after F11–F13 are reviewed and stable.
- **Review:**
  - hosting, and splitting the Next.js app from a render worker;
  - Atlas network access, R2 access, Gmail configuration, secrets;
  - memory (renders need about 2 GB; free memory has dipped to 1.6 GB) and render concurrency;
  - temp-file cleanup and the `runs/` retention policy (emptied on 2026-11-05; no automatic cleanup yet);
  - logging, error monitoring, backups and restore;
  - security headers, rate limits, health checks, rollback.
- **Rules:** no free hosting tier is assumed to be permanent, and nothing is deployed or billed without approval.
- **Doc:** `docs/deployment/F14_PRODUCTION_READINESS.md`.

## F15 — Final product validation

- **Journey:** sign-up → email → login → dashboard → create → progress → R2 upload → Video ready → My Videos → secure playback and download → logout.
- **Accounts:** at least two independent accounts.
- **Verify:** isolation, storage security, email, failure recovery, mobile, browsers beyond Chrome, performance and data integrity.
- **Doc:** `docs/qa/F15_FINAL_PRODUCT_VALIDATION.md`.

## Optional backlog (kept separate; must not delay F11–F15)

- M7 silent topics S8–S12 (when the Gemini free quota allows).
- Narrated evaluation after the ElevenLabs reset on 2026-11-26.
- Image generation, only if there's a free and hardware-compatible option (the local model trial is still unapproved).
- Human listen-through of the narration.
- Screen-reader accessibility review.
- Leftover Stitch dashboard fixes; M7 known issues K1–K4.
