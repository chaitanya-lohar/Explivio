# F11 — Cloudflare R2 storage architecture

Date: 2026-11-05 · Status: implemented and tested offline; real-bucket verification pending (see the [implementation report](F11_R2_IMPLEMENTATION_REPORT.md)).

## 1. Overview

```
Browser ──► Next.js server (web/) ─────────────────────────► MongoDB Atlas "explivio"
              │                                               videoProjects.storage = metadata + object key
              │ 1. spawn CLI (unchanged)
              ▼
          Pipeline CLI ─► runs/<id>/video.mp4 (local render, kept)
              │ 2. process exits "succeeded"
              ▼
          cloud-upload.ts ──PUT (Content-MD5)──► Cloudflare R2, private bucket "explivio-assets"
                          ──HEAD (verify)──────►   users/<userId>/videos/<videoId>/video.mp4
              │ 3. verified → storage.uploadStatus = "uploaded" → video is ready
              ▼
Browser ◄── /api/videos/<id>/file ◄──GET + Range── R2   (owner check first; streamed, never buffered whole)
Browser ──► /api/videos/<id>/file?download=1 ──302──► 5-minute signed R2 link (attachment)
```

**Code layers:**
- **Video logic:** `services/pipeline/videos.ts` and `cloud-upload.ts`.
- **Storage contract:** `lib/storage/types.ts`, implemented by `r2.ts` (official AWS SDK v3) and `memory.ts` (tests).
- **No storage settings:** with no R2 settings the app behaves exactly as before F11.

## 2. Upload lifecycle

| State (`storage.uploadStatus`) | Meaning | What the user sees |
|---|---|---|
| (record created) `pending` | R2 was configured when the video was created; the render hasn't finished or the upload hasn't started yet | Pipeline stages, then **finishing** |
| `uploading` | Claimed by one upload (a conditional update, so never two at once) | **finishing** |
| `uploaded` | Object verified: size, `video/mp4`, ETag = MD5 of the local file | **Ready**: play and download |
| `failed` | Upload or verification failed, or the free-tier guard stopped it; `lastError` holds a safe reason | **Failed at "finishing"**, with Try again |

**Steps:**
1. When the CLI process exits with `succeeded` (or, after a server restart, the next time the video is looked at), the upload starts.
2. **Free-tier guard:** stop if stored bytes plus this file would exceed 8 GB (80% of 10 GB), or if this month's uploads would exceed 800,000 (80% of the 1 million Class A operations).
3. Compute the MD5 by streaming the file.
4. **HEAD:** if the object already exists with the same size and ETag, skip the PUT (idempotent).
5. **PUT** with `Content-MD5`; R2 rejects corrupted bytes. The body is streamed from disk, never loaded whole.
6. **HEAD again to verify:** size, content type and ETag.
7. Record `uploaded` with the size, MD5, type and time; the video becomes ready.

## 3. Failure and retry

- **Failure:** the local MP4 is never deleted or moved. The video is failed at `finishing`, with a readable reason that contains no paths or keys.
- **Try again on an upload failure:** the state goes back to `pending` and the **same file** is uploaded again. The video id stays the same, the CLI isn't run again, and Gemini and ElevenLabs aren't called.
- **Try again on any other failure:** a new run starts, as before.
- **A late automatic start** (for example the process exit after a page already resumed the upload) only takes over `pending` or `uploading` uploads, so it never overwrites a recorded failure.
- **Interrupted upload** (server restart): the record says `uploading` but no upload runs in this process, so viewing the video resumes it.
- **Retries:** the SDK retries network errors and throttling (3 attempts, 30 s request timeout).

## 4. Playback and download

- **Owner check first:** `GET /api/videos/<id>/file` requires a session and ownership. Another user's id, or a guessed one, gets 404, exactly like an unknown id.
- **Cloud videos:**
  - **Playback:** the browser's `Range` header is parsed against the stored size and the same byte range is requested from R2. The response is 206 with `Content-Range`, 200 for full requests, or 416 for impossible ranges, with `Content-Type: video/mp4` and `Accept-Ranges: bytes`.
  - Bodies are streamed. Seeking works and no CORS setup is needed.
- **Downloads:** after the owner check, a **302 to a signed GET link valid for 5 minutes** with `Content-Disposition: attachment`. Signing happens locally (no request to R2), and the link is never stored or logged.
- **Local videos** (from before F11, or with R2 off) are streamed from disk with the same Range logic.

## 5. MongoDB metadata (`videoProjects`)

The existing `storage` field was extended; no new collection or index was needed (the claim and usage queries are small).

```ts
storage:
  | { kind: "local-run"; runId }                      // unchanged: every video before F11
  | { kind: "r2"; runId; key; uploadStatus; attempts;   // F11
      contentType?; size?; md5?; lastAttemptAt?; uploadedAt?; lastError? }
```

The `$jsonSchema` validator still requires `ownerUserId` and `storage`; it already accepts both shapes.

## 6. Object keys

`users/<userId>/videos/<videoId>/video.mp4`
- Built only from the server's validated ids (`usr_` + 32 hex characters, run-id pattern), never from file names or browser input.
- The connectivity check uses `system/r2-check/<stamp>.mp4` and deletes it.

## 7. Security controls

| Area | Control |
|---|---|
| Bucket | Private (no r2.dev URL, no custom domain) |
| Credentials | A token limited to `explivio-assets` with Object Read & Write; kept server-side in `web/.env.local`; validated at startup with variable names only; never in responses or logs. Error messages are redacted (signed URLs, signatures, long keys) |
| Access | Authorisation happens before every byte or link. Signed links last 5 minutes and are made only for the owner |
| Free tier | The guard above stops uploads before 80% of the free limits; Cloudflare billing alerts are recommended |
