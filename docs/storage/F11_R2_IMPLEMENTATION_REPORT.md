# F11 — Cloudflare R2 implementation report

Date: 2026-11-05 · Branch: `dev` · Commits: `0760ca5` (storage service), `71c5e8e` (pipeline, playback, download) · Spend: **$0**

## Status at a glance

| Item | Status |
|---|---|
| Code: storage service, upload lifecycle, playback, download, retry, guard | ✅ Implemented |
| Offline tests (memory store, SDK against a local fake S3 endpoint) | ✅ Pass |
| R2 account checkout, bucket, scoped token, `web/.env.local` values | ⏳ **You** (guide in the session; summary in §4) |
| Real-bucket check (`npm run r2:check`) | ⏳ Pending R2 setup |
| Live Atlas metadata test (`tests/storage-mongo.test.ts`) | ⏳ Pending: Atlas refused the connection on 2026-11-05 (likely the IP access list) |
| Browser end-to-end on real R2 (playback, seek, download, cross-user) | ⏳ Pending both of the above |
| **F11 done?** | **No.** Definition-of-done items 2–11 and 16 need the real bucket |

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
| Web `npm test` | **75 tests: 65 pass, 0 fail, 10 skipped** (the skipped ones are live-Atlas tests that need `MONGODB_URI_TEST`) | Offline |
| … `storage.test.ts` | 10/10: config, redaction, keys, ranges, guard, memory contract, **real SDK requests** checked against a local fake S3 server (Content-MD5 sent, no CRC32 headers, SigV4, path style, Range forwarded, 404/403/unreachable mapping, presign without a network call) | SDK real, endpoint fake |
| … `pipeline-service.test.ts` | 22/22, stable over 5 consecutive runs; F11: upload → verify → ready, failure keeps the MP4, retry without re-render, corruption detected, idempotent, resume after restart, late start can't overwrite a failure, guard, historical local untouched, local mode unchanged | Memory store, stub CLI |
| `storage-mongo.test.ts` (live) | Not run: Atlas unreachable from this machine on 2026-11-05 | Real Atlas (pending) |
| Pipeline (root) `npm test` | 63/63 | — |
| Typecheck, lint, production build | Pass | — |
| `npm run r2:check` | Reports `not_configured` (no credentials yet) | Real R2 (pending) |

**Found and fixed during testing:** if a page view resumed an upload before the render process exited, the exit handler could start a second upload that overwrote a recorded failure. Automatic starts now only take over `pending` or `uploading` uploads; a regression test covers this.

## 6. Real R2 evidence

None yet. When the bucket exists, `npm run r2:check` runs 10 checks against it:
- upload, metadata, byte-exact download, range read;
- the unsigned request is refused (private bucket);
- a signed download works, and an expired signed link is refused;
- a missing object is reported as absent, and bad credentials are rejected;
- the test object is deleted.

Then a browser test runs on a production build with real Atlas and real R2: two accounts, play, seek, download, and cross-user denial. It uses the stub pipeline with a synthetic MP4, so no Gemini or ElevenLabs calls are made.

## 7. Free tier and cost

**Free tier (checked 2026-11-05 on developers.cloudflare.com/r2/pricing):**
- 10 GB-month of storage;
- 1 million Class A and 10 million Class B operations per month;
- free egress and free DeleteObject;
- Standard storage only; Infrequent Access has no free tier.

**Per video:** 1 PutObject (Class A), 2 HeadObject (Class B), and Class B GetObject calls for each playback range request.

**Guard:** new uploads stop at 80% of storage or Class A. Monitor usage in Cloudflare (R2 → Metrics, and Billing → Billable usage).

**Spend so far:** $0. Nothing has been uploaded.

## 8. Remaining limitations

- Uploads run in the web server process: a restart mid-upload is resumed when the video is next viewed, not immediately.
- Class B operations (playback) aren't counted by the guard. 10 million a month is far beyond a single-user app; watch the dashboard.
- Rendering still needs local disk, and local files are kept (no cleanup until F14).
- Historical videos stay local: the [migration plan](F11_HISTORICAL_VIDEO_MIGRATION_PLAN.md) has not been executed.
- A signed download link is a bearer link for 5 minutes. It is made only for the owner and never stored.
