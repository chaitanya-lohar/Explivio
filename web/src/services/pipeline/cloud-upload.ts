import { stat } from "node:fs/promises";
import path from "node:path";
import { fileMd5, objectStore, type ObjectStore, quotaProblem, StorageAuthError, StorageQuotaError, StorageVerificationError } from "../../lib/storage/index.ts";
import { ownership } from "./ownership.ts";

/*
 * F11 upload lifecycle: after the pipeline renders runs/<id>/video.mp4, the finished file is uploaded to Cloudflare
 * R2, verified (size, content type, MD5 = ETag) and only then recorded as "uploaded" — which is what makes the video
 * ready. The local file is never deleted or moved. A failed upload is recorded with a safe reason; retrying uploads the
 * same file again (no new render, no Gemini or ElevenLabs calls). Uploads are idempotent: if the object is already
 * there with the same size and checksum, nothing is uploaded twice.
 */

const CONTENT_TYPE = "video/mp4";
const holder = globalThis as typeof globalThis & { __explivioUploads?: Map<string, Promise<void>> };
const inFlight = (holder.__explivioUploads ??= new Map());

export const uploadInProgress = (id: string): boolean => inFlight.has(id);

/** Starts (or joins) the upload of a run's video. Never rejects: the outcome is recorded in MongoDB. */
export function startUpload(id: string, filePath: string): Promise<void> {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const upload = runUpload(id, filePath)
    .catch(() => {})
    .finally(() => inFlight.delete(id));
  inFlight.set(id, upload);
  return upload;
}

function failureReason(error: unknown): string {
  if (error instanceof StorageQuotaError || error instanceof StorageVerificationError) return error.message;
  if (error instanceof StorageAuthError) return "Cloud storage rejected the upload credentials. The video is kept on this computer.";
  const message = error instanceof Error ? error.message : String(error);
  return `Saving the video to cloud storage failed (${message.replace(/\.$/, "")}). The video is kept on this computer.`;
}

async function runUpload(id: string, filePath: string): Promise<void> {
  const store = ownership();
  const storage = (await store.storageOf([id])).get(id);
  // Only pending (new or retried) and interrupted uploads are taken over. A failed upload stays failed until the user
  // retries it (retryVideo sets it back to pending): a late automatic start must never overwrite a recorded outcome.
  if (!storage || storage.kind !== "r2" || (storage.uploadStatus !== "pending" && storage.uploadStatus !== "uploading")) return;

  const objects = objectStore();
  if (!objects) {
    await store.updateR2Storage(id, { uploadStatus: "failed", lastError: "Cloud storage isn't configured on this server, so the video couldn't be saved there. It is kept on this computer." }, ["pending", "uploading"]);
    await store.syncStatus(id, "failed");
    return;
  }

  // Claim the upload (another request may be resuming the same video).
  const claimed = await store.updateR2Storage(id, { uploadStatus: "uploading", attempts: storage.attempts + 1, lastAttemptAt: new Date(), lastError: null }, ["pending", "uploading"]);
  if (!claimed) return;

  try {
    const { size } = await stat(/* turbopackIgnore: true */ filePath);
    if (size <= 0) throw new StorageVerificationError("The rendered video file is empty, so it wasn't uploaded.");
    const problem = quotaProblem(await store.storageUsage(), size);
    if (problem) throw new StorageQuotaError(`${problem} The video is kept on this computer.`);
    const md5 = await fileMd5(filePath);

    const before = await objects.head(storage.key);
    if (!(before && before.size === size && before.etag === md5.hex)) {
      await objects.put(storage.key, { filePath, size, contentType: CONTENT_TYPE, md5Base64: md5.base64 });
    }
    const after = await objects.head(storage.key);
    if (!after) throw new StorageVerificationError("The upload finished but the video couldn't be found in cloud storage.");
    if (after.size !== size || (after.etag !== undefined && after.etag !== md5.hex) || after.contentType !== CONTENT_TYPE) {
      throw new StorageVerificationError("The uploaded video doesn't match the rendered file, so it wasn't marked as saved.");
    }

    const thumbnailKey = await uploadThumbnail(objects, storage.key, path.join(path.dirname(filePath), "thumbnail.jpg"));
    await store.updateR2Storage(id, { uploadStatus: "uploaded", size, md5: md5.hex, contentType: CONTENT_TYPE, uploadedAt: new Date(), lastError: null, ...(thumbnailKey ? { thumbnailKey } : {}) });
    await store.syncStatus(id, "ready").catch(() => {});
  } catch (error) {
    await store.updateR2Storage(id, { uploadStatus: "failed", lastError: failureReason(error) });
    await store.syncStatus(id, "failed").catch(() => {});
  }
}

/** Uploads the run's thumbnail next to the video (best effort: a missing or failed thumbnail never fails the video). */
async function uploadThumbnail(objects: ObjectStore, videoKey: string, file: string): Promise<string | null> {
  try {
    const { size } = await stat(/* turbopackIgnore: true */ file);
    if (size <= 0 || size > 2_000_000) return null;
    const key = videoKey.replace(/video.mp4$/, "thumbnail.jpg");
    const md5 = await fileMd5(file);
    await objects.put(key, { filePath: file, size, contentType: "image/jpeg", md5Base64: md5.base64 });
    return key;
  } catch {
    return null;
  }
}
