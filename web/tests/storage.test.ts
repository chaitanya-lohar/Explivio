import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readR2Config, redactStorage } from "../src/lib/storage/config.ts";
import { checkObjectKey, videoObjectKey } from "../src/lib/storage/keys.ts";
import { quotaProblem, R2_FREE_TIER } from "../src/lib/storage/usage.ts";
import { memoryStore } from "../src/lib/storage/memory.ts";
import { createR2Store } from "../src/lib/storage/r2.ts";
import { fileMd5, ObjectNotFoundError, StorageAuthError, StorageUnavailableError } from "../src/lib/storage/index.ts";
import { parseRange } from "../src/lib/http-range.ts";

/*
 * F11 storage unit tests. Offline: the R2 adapter is exercised against a local fake S3 endpoint that records the exact
 * requests the official SDK sends (so integrity headers and ranges are verified, not assumed). The real bucket is
 * checked separately by `npm run r2:check`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(here, "fixtures", "tiny.mp4");
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const full = { R2_ACCOUNT_ID: ACCOUNT, R2_ACCESS_KEY_ID: "a".repeat(32), R2_SECRET_ACCESS_KEY: "s".repeat(64), R2_BUCKET_NAME: "explivio-assets" };

test("config: unset is 'not configured'; partial or malformed is 'invalid' and names variables, never values", () => {
  assert.equal((readR2Config({}) as { problem: string }).problem, "not_configured");
  const partial = readR2Config({ R2_ACCOUNT_ID: ACCOUNT, R2_SECRET_ACCESS_KEY: "TOPSECRETVALUE" });
  assert.equal(partial.ok, false);
  assert.match((partial as { message: string }).message, /R2_ACCESS_KEY_ID, R2_BUCKET_NAME missing/);
  assert.doesNotMatch((partial as { message: string }).message, /TOPSECRETVALUE/);
  assert.equal(readR2Config({ ...full, R2_ACCOUNT_ID: "not-an-account" }).ok, false);
  assert.equal(readR2Config({ ...full, R2_BUCKET_NAME: "Bad_Bucket" }).ok, false);
  assert.equal(readR2Config({ ...full, R2_ENDPOINT: "https://evil.example.com" }).ok, false);
  assert.equal(readR2Config({ ...full, R2_ENDPOINT: `https://${"f".repeat(32)}.r2.cloudflarestorage.com` }).ok, false, "endpoint must match the account");
});

test("config: endpoint is derived from the account id, or taken from R2_ENDPOINT (jurisdictions allowed)", () => {
  const derived = readR2Config(full);
  assert.ok(derived.ok);
  assert.equal(derived.endpoint, `https://${ACCOUNT}.r2.cloudflarestorage.com`);
  const eu = readR2Config({ ...full, R2_ENDPOINT: `https://${ACCOUNT}.eu.r2.cloudflarestorage.com/` });
  assert.ok(eu.ok);
  assert.equal(eu.endpoint, `https://${ACCOUNT}.eu.r2.cloudflarestorage.com`);
});

test("redaction removes signed URLs, signatures and long key-like strings", () => {
  const text = `failed GET https://${ACCOUNT}.r2.cloudflarestorage.com/b/k?X-Amz-Signature=abc123 with key ${"k".repeat(40)} X-Amz-Credential=AKIDEXAMPLE`;
  const clean = redactStorage(text);
  assert.doesNotMatch(clean, /abc123|AKIDEXAMPLE|kkkkkkkk|cloudflarestorage/);
});

test("object keys come only from validated server ids", () => {
  const user = `usr_${"a".repeat(32)}`;
  assert.equal(videoObjectKey(user, "2026-11-05T10-00-00-000Z-abcd1234"), `users/${user}/videos/2026-11-05T10-00-00-000Z-abcd1234/video.mp4`);
  assert.throws(() => videoObjectKey(user, "../other/video"));
  assert.throws(() => videoObjectKey("usr_../../x", "id"));
  assert.throws(() => videoObjectKey(user, "a/b"));
  assert.match(checkObjectKey("stamp-1"), /^system\/r2-check\/stamp-1\.mp4$/);
});

test("range parsing: full, start-end, open-ended, suffix, clamped end and unsatisfiable", () => {
  assert.deepEqual(parseRange(null, 100), { kind: "full" });
  assert.deepEqual(parseRange("bytes=0-9", 100), { kind: "partial", start: 0, end: 9 });
  assert.deepEqual(parseRange("bytes=90-", 100), { kind: "partial", start: 90, end: 99 });
  assert.deepEqual(parseRange("bytes=-10", 100), { kind: "partial", start: 90, end: 99 });
  assert.deepEqual(parseRange("bytes=50-500", 100), { kind: "partial", start: 50, end: 99 });
  assert.deepEqual(parseRange("bytes=100-", 100), { kind: "unsatisfiable" });
  assert.deepEqual(parseRange("bytes=9-3", 100), { kind: "unsatisfiable" });
  assert.deepEqual(parseRange("bytes=-0", 100), { kind: "unsatisfiable" });
  assert.deepEqual(parseRange("items=0-1", 100), { kind: "full" }, "unknown units are ignored");
});

test("free-tier guard: uploads stop at 80% of storage or of monthly Class A operations", () => {
  assert.equal(quotaProblem({ storedBytes: 0, uploadsThisMonth: 0 }, 20e6), null);
  assert.match(quotaProblem({ storedBytes: 7.99e9, uploadsThisMonth: 0 }, 20e6) ?? "", /near its free limit/);
  assert.match(quotaProblem({ storedBytes: 0, uploadsThisMonth: R2_FREE_TIER.classAPerMonth * 0.8 }, 1) ?? "", /monthly|month's/);
});

test("memory store honours the contract: Content-MD5 check, ranges, missing objects, free delete", async () => {
  const store = memoryStore();
  const md5 = await fileMd5(SAMPLE);
  const bytes = readFileSync(SAMPLE);
  await store.put("k", { filePath: SAMPLE, size: bytes.length, contentType: "video/mp4", md5Base64: md5.base64 });
  assert.deepEqual(await store.head("k"), { size: bytes.length, contentType: "video/mp4", etag: md5.hex });
  const part = await store.get("k", { start: 10, end: 19 });
  assert.equal(part.contentLength, 10);
  assert.deepEqual(Buffer.from(await new Response(part.stream).arrayBuffer()), bytes.subarray(10, 20));
  await assert.rejects(store.put("bad", { filePath: SAMPLE, size: bytes.length, contentType: "video/mp4", md5Base64: "AAAAAAAAAAAAAAAAAAAAAA==" }), StorageUnavailableError);
  await assert.rejects(store.get("nope"), ObjectNotFoundError);
  assert.equal(await store.head("nope"), null);
  await store.delete("k");
  await store.delete("k");
  assert.equal(await store.head("k"), null);
});

// ---- The real R2 adapter (official SDK) against a local fake S3 endpoint ----

type Seen = { method: string; url: string; headers: IncomingMessage["headers"] };
const seen: Seen[] = [];
const objects = new Map<string, { data: Buffer; type: string }>();
let denyAuth = false;
const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    const key = decodeURIComponent((req.url ?? "").split("?")[0]);
    const error = (status: number, code: string) => {
      res.writeHead(status, { "Content-Type": "application/xml" });
      res.end(req.method === "HEAD" ? undefined : `<?xml version="1.0"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`);
    };
    if (denyAuth) return error(403, "InvalidAccessKeyId");
    const object = objects.get(key);
    if (req.method === "PUT") {
      const body = Buffer.concat(chunks);
      if (createHash("md5").update(body).digest("base64") !== req.headers["content-md5"]) return error(400, "BadDigest");
      objects.set(key, { data: body, type: String(req.headers["content-type"]) });
      res.writeHead(200, { ETag: `"${createHash("md5").update(body).digest("hex")}"` });
      return res.end();
    }
    if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204);
      return res.end();
    }
    if (!object) return error(404, "NoSuchKey");
    const etag = `"${createHash("md5").update(object.data).digest("hex")}"`;
    const range = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
    const body = range ? object.data.subarray(Number(range[1]), Number(range[2]) + 1) : object.data;
    const headers: Record<string, string> = { "Content-Type": object.type, "Content-Length": String(body.length), ETag: etag };
    if (range) headers["Content-Range"] = `bytes ${range[1]}-${range[2]}/${object.data.length}`;
    res.writeHead(range ? 206 : 200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
after(() => server.close());
const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const adapter = () => createR2Store({ ok: true, accountId: ACCOUNT, accessKeyId: "a".repeat(32), secretAccessKey: "s".repeat(64), bucket: "explivio-assets", endpoint });

test("R2 adapter: upload sends Content-MD5, no extra CRC32 checksum, path-style key; HEAD and ranged GET work", async () => {
  const store = adapter();
  const md5 = await fileMd5(SAMPLE);
  const bytes = readFileSync(SAMPLE);
  const put = await store.put("users/u/videos/v/video.mp4", { filePath: SAMPLE, size: bytes.length, contentType: "video/mp4", md5Base64: md5.base64 });
  assert.equal(put.etag, md5.hex);
  const putRequest = seen.find((s) => s.method === "PUT")!;
  assert.equal(putRequest.url.split("?")[0], "/explivio-assets/users/u/videos/v/video.mp4");
  assert.equal(putRequest.headers["content-md5"], md5.base64);
  assert.equal(putRequest.headers["content-type"], "video/mp4");
  assert.ok(!Object.keys(putRequest.headers).some((h) => h.startsWith("x-amz-checksum-") || h === "x-amz-sdk-checksum-algorithm"), "no default CRC32 checksum headers");
  assert.match(String(putRequest.headers.authorization), /^AWS4-HMAC-SHA256 /, "signed with SigV4");

  assert.deepEqual(await store.head("users/u/videos/v/video.mp4"), { size: bytes.length, contentType: "video/mp4", etag: md5.hex });
  const part = await store.get("users/u/videos/v/video.mp4", { start: 0, end: 99 });
  assert.equal(seen.at(-1)?.headers.range, "bytes=0-99", "range forwarded to storage");
  assert.deepEqual(Buffer.from(await new Response(part.stream).arrayBuffer()), bytes.subarray(0, 100));
});

test("R2 adapter: missing object, rejected credentials and unreachable endpoint map to clear errors without secrets", async () => {
  const store = adapter();
  assert.equal(await store.head("missing.mp4"), null);
  await assert.rejects(store.get("missing.mp4"), ObjectNotFoundError);
  denyAuth = true;
  try {
    await assert.rejects(store.head("users/u/videos/v/video.mp4"), StorageAuthError);
  } finally {
    denyAuth = false;
  }
  const offline = createR2Store({ ok: true, accountId: ACCOUNT, accessKeyId: "a".repeat(32), secretAccessKey: "s".repeat(64), bucket: "explivio-assets", endpoint: "http://127.0.0.1:1" });
  const error = await offline.head("x").catch((e: Error) => e);
  assert.ok(error instanceof StorageUnavailableError);
  assert.doesNotMatch(error.message, /s{20}|a{20}/);
});

test("R2 adapter: presigned link is signed, short-lived and carries the download disposition; signing makes no request", async () => {
  const store = adapter();
  const before = seen.length;
  const url = new URL(await store.presignGet("users/u/videos/v/video.mp4", { expiresInSeconds: 300, downloadName: "my video.mp4" }));
  assert.equal(seen.length, before, "no request to storage");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.equal(url.searchParams.get("response-content-disposition"), 'attachment; filename="my-video.mp4"');
  assert.ok(!url.toString().includes("s".repeat(64)), "secret never in the URL");
});
