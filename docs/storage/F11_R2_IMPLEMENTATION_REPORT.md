# F11 — Cloudflare R2 implementation report

Date: 2026-11-05 · Branch: `dev` · Commits: `0760ca5` (storage service), `71c5e8e` (pipeline, playback, download), `f2b6ea9` (docs), and this verification update · Spend: **$0**

## Status at a glance

| Item | Status |
|---|---|
| Code: storage service, upload lifecycle, playback, download, retry, guard | ✅ Implemented |
| Offline tests (memory store, SDK against a local fake S3 endpoint) | ✅ Pass |
| R2 subscription ($0 plan), private bucket `explivio-assets`, scoped token, `web/.env.local` | ✅ Configured by you on 2026-11-05 (billable usage $0.00) |
| Real-bucket check (`npm run r2:check`) | ✅ **10/10** on real R2 |
| Live Atlas tests (including the F11 metadata test) | ✅ Pass. Atlas had refused this machine; fixed by adding its IPv4 address to Network Access (the browser had added the IPv6 one) |
| Browser end-to-end on real R2 and real Atlas | ✅ **39/39** |
| **F11 done?** | **Yes**, every definition-of-done item verified (§6). Open items are listed in §8 |

## 1. Reused, not recreated

- **MongoDB:** `lib/db/mongo.ts` (single client) and `config.ts`, `videoProjects` and its validator, and the ownership store. No second connection or new collection.
- **Pipeline:** spawn and render unchanged; the CLI isn't modified.
- **Playback:** the existing `/api/videos/[id]/file` route and UI addresses, so the UI is unchanged. The existing "finishing" stage is used for the upload, and the existing Try again for upload retries.

## 2. New and changed files

| File | What |
|---|---|
| `web/src/lib/storage/config.ts` | R2 settings: validation, endpoint (including jurisdictions), redaction |
| `web/src/lib/storage/types.ts` | `ObjectStore` contract and error types |
| `web/src/lib/storage/r2.ts` | Official AWS SDK v3 adapter (path style, Content-MD5, CRC32 defaults off, 3 attempts, timeouts) |
| `web/src/lib/storage/memory.ts` | Test store with failure and corruption injection and call counts |
| `web/src/lib/storage/keys.ts`, `usage.ts`, `index.ts` | Keys from validated ids; free-tier guard; store selection; streamed MD5 |
| `web/src/lib/http-range.ts` | Range parsing shared by local and cloud playback |
| `web/src/services/pipeline/cloud-upload.ts` | Upload lifecycle (claim, guard, HEAD, PUT, verify, record) |
| `web/src/services/pipeline/videos.ts` | R2 storage at creation; upload after render; "finishing" state; resume; upload-only retry; `getVideoSource` |
| `web/src/services/pipeline/ownership.ts` | `storageOf`, conditional `updateR2Storage`, `storageUsage` (MongoDB and memory) |
| `web/src/lib/db/collections.ts` | `VideoStorage` = `local-run` or `r2` (backward compatible) |
| `web/src/app/api/videos/[id]/file/route.ts` | R2 streaming with Range; signed-link download; local path unchanged |
| `web/src/services/videos.ts`, `index.ts` | `getVideoSource` wrapper (the mock keeps working) |
| `web/src/instrumentation.ts` | Startup warning for a partial or invalid R2 setup (names only) |
| `web/scripts/r2-check.mts` (`npm run r2:check`) | Real-bucket check on a dedicated test object |
| `web/.env.example` | R2 placeholders |
| Tests | `tests/storage.test.ts` (10), 9 F11 tests in `tests/pipeline-service.test.ts`, `tests/storage-mongo.test.ts` (live) |

## 3. Dependencies

- `@aws-sdk/client-s3` 3.1162.0 and `@aws-sdk/s3-request-presigner` 3.1162.0 (exact versions).
- These are the official SDK and are named in Cloudflare's R2 documentation. `npm audit`: 0 vulnerabilities.
- **Considered:** `aws4fetch` (smaller), but it has no built-in retries or streaming-upload helpers.

## 4. Configuration

**Environment variables (names only, all in `web/.env.local`):**

| Variable | Notes |
|---|---|
| `R2_ACCOUNT_ID` | Required |
| `R2_ACCESS_KEY_ID` | Required |
| `R2_SECRET_ACCESS_KEY` | Required |
| `R2_BUCKET_NAME` | Required (`explivio-assets`) |
| `R2_ENDPOINT` | Optional; derived from the account id |

**Cloudflare steps (yours):**
1. Complete the R2 checkout (the free tier is included; a payment method is required; you accepted this knowingly).
2. Create the bucket `explivio-assets`: Standard storage, no jurisdiction, public access off.
3. Create an Account API token with Object Read & Write, limited to that bucket.
4. Optional but recommended: a Usage Based Billing notification for R2.
5. Put the values into `web/.env.local`, then run `npm run r2:check`.

## 5. Test results (2026-11-05)

| Suite | Result | Real or mocked |
|---|---|---|
| Web `npm test` with `MONGODB_URI_TEST` | **76/76 pass, 0 skipped**, including both live-Atlas tests | Live Atlas and offline |
| Web `npm test` without `MONGODB_URI_TEST` | 65 pass, 10 skipped (the live tests) | Offline |
| … `storage.test.ts` | 10/10: config, redaction, keys, ranges, guard, memory contract, **real SDK requests** checked against a local fake S3 server (Content-MD5 sent, no CRC32 headers, SigV4, path style, Range forwarded, 404/403/unreachable mapping, presign without a network call) | SDK real, endpoint fake |
| … `pipeline-service.test.ts` | 22/22, stable over 5 consecutive runs; F11: upload → verify → ready, failure keeps the MP4, retry without re-render, corruption detected, idempotent, resume after restart, late start can't overwrite a failure, guard, historical local untouched, local mode unchanged | Memory store, stub CLI |
| `storage-mongo.test.ts` (live) | Pass: the R2 shape is accepted by the validator; of two simultaneous claims only one wins; usage totals add up; local records can't be turned into cloud ones | **Real Atlas** (throwaway database, dropped) |
| Pipeline (root) `npm test` | 63/63 | — |
| Typecheck, lint, production build | Pass | — |
| `npm run r2:check` | **10/10** | **Real R2** |
| Browser end-to-end | **39/39** | **Real R2, real Atlas** (`explivio_e2e`, dropped), production build, headless Chrome, stub pipeline |

**Mocked:** upload failure injection, corruption in transit, the free-tier guard, and resume after a restart. These use the in-memory store, because forcing them on real R2 isn't practical. The retry path itself was also run on real R2 (below).

**Found and fixed during testing:** if a page view resumed an upload before the render process exited, the exit handler could start a second upload that overwrote a recorded failure. Automatic starts now only take over `pending` or `uploading` uploads; a regression test covers this.

## 6. Real R2 evidence

### `npm run r2:check` (2026-11-05): 10/10
- Uploaded a 4,831-byte synthetic test MP4; the ETag matches the MD5.
- Metadata is correct (size, `video/mp4`), the download is byte-exact, and a 1,000-byte range read is exact.
- An unsigned request gets **HTTP 400** (the bucket is private).
- The signed link returns 200 as an attachment; an expired link gets **403**.
- A missing object reports as absent; bad credentials raise `StorageAuthError`.
- **The test object was deleted.**

### Browser end-to-end (2026-11-05): 39/39
Setup: two fresh verified accounts (A, B); a 16.8 MB, 40-second synthetic MP4 from random noise (no user video was used); the stub pipeline (no AI calls).

| Area | Evidence |
|---|---|
| Upload | **Lifecycle:** A clicked Generate in the UI. The record was created as `r2/pending` with key `users/<A>/videos/<id>/video.mp4`. The progress screen showed **finishing** while uploading and moved to Video ready about 7 s later. **Verified state:** MongoDB has `uploaded`, the size, MD5, `video/mp4`, `uploadedAt` and status ready. An R2 HeadObject matches the size, type and ETag. The local MP4 was kept |
| Playback | The `<video>` element loaded (40.00 s) and played. **Seeks to 30 s, 5 s and 38 s** all landed (±0.4 s) with no errors, and the browser received **206** responses |
| HTTP | Ranges `0-99`, a middle range and the last 500 bytes all returned **206** with exact bytes; an impossible range returned **416** with `bytes */16795579`. A full request returned **200**, byte-identical (SHA-256). The server's working set went **135 → 140 MB** while streaming 16.8 MB, so the file isn't buffered |
| Download | **302** to `*.r2.cloudflarestorage.com` with `X-Amz-Expires=300` and `Cache-Control: no-store`. Following the link gave 200, the exact bytes, and `attachment; filename="…ocean-tides-work.mp4"` |
| Security | Signed out: **401**. Account B requesting A's video status, file and download: **404 / 404 / 404**, with no redirect or link. B's My Videos doesn't include it, and B's page shows no player. Guessed or invalid ids: 404. The R2 object URL without a signature: **400**. No secret appears in the signed link |
| Library | A's My Videos links to the cloud video |
| Retry on real R2 | The record was marked as a failed upload. The screen showed "Something went wrong while finishing up", the reason under Technical details, and Try again. Clicking it kept the **same id**, made **0 new renders**, and left the R2 **LastModified unchanged**, so the identical object wasn't uploaded again. The video became ready (attempts 2) |
| Historical | A local-run video still streams from `runs/` (206) and was never uploaded |
| Console | No errors |

**Cleanup:** the run's R2 objects were deleted (0 left) and `explivio_e2e` was dropped. Only `explivio`, `admin` and `local` remain in the cluster.

**Fixed during this run:** three test-script bugs, none in the app:
- the filename pattern didn't expect the stub's `stub-` prefix;
- the failure-reason check read only visible text, but the reason sits under the collapsed Technical details;
- the first memory reading used a parser that returned 0. It was replaced, and the run now aborts if memory can't be read.

## 7. Free tier and cost

**Free tier (checked 2026-11-05 on developers.cloudflare.com/r2/pricing):**
- 10 GB-month of storage;
- 1 million Class A and 10 million Class B operations per month;
- free egress and free DeleteObject;
- Standard storage only; Infrequent Access has no free tier.

**Per video:** 1 PutObject (Class A), 2 HeadObject (Class B), and Class B GetObject calls for each playback range request.

**Guard:** new uploads stop at 80% of storage or Class A. Monitor usage in Cloudflare (R2 → Metrics, and Billing → Billable usage).

**Spend so far:** $0.
- Activation was a $0/month plan. The dashboard showed "Billable usage $0.00, no billable usage incurred yet".
- **Testing used:** about 3 PutObject calls (r2:check and two e2e runs), a few dozen Head and Get calls, and dashboard listing. That's tiny against 1M and 10M, and all test objects were deleted, so storage is 0 B.
- **Billing alert:** a Budget Alert in the Cloudflare Billing Dashboard is recommended (the "Notifications" route wasn't available on your account).

## 8. Remaining limitations

- **Atlas IP:** your connection's IPv4 address changes from time to time. When it does, Atlas refuses this computer again (TLS alert 80), and you'll need to add the new IP in Network Access.
- **Not yet done with a real narrated render:** the end-to-end run used the stub pipeline to save Gemini and ElevenLabs quota. The upload path is the same for real renders.

- Uploads run in the web server process: a restart mid-upload is resumed when the video is next viewed, not immediately.
- Class B operations (playback) aren't counted by the guard. 10 million a month is far beyond a single-user app; watch the dashboard.
- Rendering still needs local disk, and local files are kept (no cleanup until F14).
- Historical videos stay local: the [migration plan](F11_HISTORICAL_VIDEO_MIGRATION_PLAN.md) has not been executed.
- A signed download link is a bearer link for 5 minutes. It is made only for the owner and never stored.
