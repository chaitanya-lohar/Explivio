// Real Cloudflare R2 check (F11). Uses only a dedicated test object under system/r2-check/ — never a user's video —
// and deletes it at the end. Prints no secrets (no keys, no signed URLs). Usage: npm run r2:check
// Cost: about 1 Class A operation (one PutObject) and ~8 Class B operations (Head/Get), all within the free tier.
import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readR2Config } from "../src/lib/storage/config.ts";
import { createR2Store } from "../src/lib/storage/r2.ts";
import { checkObjectKey, fileMd5, StorageAuthError } from "../src/lib/storage/index.ts";

const sample = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "tiny.mp4");
const results: { step: string; ok: boolean; detail: string }[] = [];
const record = (step: string, ok: boolean, detail = "") => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
};
const toBuffer = async (stream: ReadableStream<Uint8Array>) => Buffer.from(await new Response(stream).arrayBuffer());

const config = readR2Config();
if (!config.ok) {
  console.log(`R2: ${config.problem} — ${config.message}`);
  process.exit(1);
}
console.log(`R2 bucket "${config.bucket}" at account …${config.accountId.slice(-4)} (credentials not shown)`);
const store = createR2Store(config);
const key = checkObjectKey(`${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`);
const { size } = await stat(sample);
const md5 = await fileMd5(sample);
const original = await readFile(sample);
let uploaded = false;

try {
  // 1. Upload (Content-MD5 enforced by R2).
  const put = await store.put(key, { filePath: sample, size, contentType: "video/mp4", md5Base64: md5.base64 });
  uploaded = true;
  record("upload test MP4", put.etag === md5.hex, `${size} bytes, ETag matches MD5: ${put.etag === md5.hex}`);

  // 2. Exists, with the right metadata.
  const head = await store.head(key);
  record("object exists with metadata", !!head && head.size === size && head.contentType === "video/mp4" && head.etag === md5.hex, head ? `size ${head.size}, type ${head.contentType}` : "not found");

  // 3. Full download, byte-for-byte.
  const full = await toBuffer((await store.get(key)).stream);
  record("download matches the original", full.equals(original), `sha256 ${createHash("sha256").update(full).digest("hex").slice(0, 12)}…`);

  // 4. Range read (what seeking uses).
  const part = await store.get(key, { start: 100, end: 1099 });
  const partBytes = await toBuffer(part.stream);
  record("range read bytes 100-1099", part.contentLength === 1000 && partBytes.equals(original.subarray(100, 1100)), `${partBytes.length} bytes`);

  // 5. Bucket is private: the plain object URL without a signature is refused.
  const anonymous = await fetch(`${config.endpoint}/${config.bucket}/${key}`);
  record("unsigned request refused (private bucket)", anonymous.status === 400 || anonymous.status === 401 || anonymous.status === 403, `HTTP ${anonymous.status}`);

  // 6. Presigned download link works and is an attachment.
  const signed = await fetch(await store.presignGet(key, { expiresInSeconds: 60, downloadName: "r2-check.mp4" }));
  const signedBytes = Buffer.from(await signed.arrayBuffer());
  record("presigned download link", signed.status === 200 && signedBytes.equals(original) && /attachment/.test(signed.headers.get("content-disposition") ?? ""), `HTTP ${signed.status}, ${signed.headers.get("content-disposition") ?? "no disposition"}`);

  // 7. Presigned link expires.
  const shortLived = await store.presignGet(key, { expiresInSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const expired = await fetch(shortLived);
  await expired.arrayBuffer();
  record("expired presigned link refused", expired.status === 403, `HTTP ${expired.status}`);

  // 8. Missing object reports "not found" (no error).
  record("missing object reported as absent", (await store.head(`${key}.missing`)) === null);

  // 9. Wrong credentials are rejected clearly.
  const wrong = createR2Store({ ...config, secretAccessKey: "0".repeat(64) });
  try {
    await wrong.head(key);
    record("invalid credentials rejected", false, "request unexpectedly succeeded");
  } catch (error) {
    record("invalid credentials rejected", error instanceof StorageAuthError, error instanceof Error ? error.name : "error");
  }
} catch (error) {
  record("unexpected error", false, error instanceof Error ? `${error.name}: ${error.message}` : "error");
} finally {
  // 10. Delete only the dedicated test object.
  if (uploaded) {
    await store.delete(key);
    record("test object deleted", (await store.head(key)) === null, key);
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nR2 check: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
