import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ObjectNotFoundError, StorageUnavailableError, type ObjectStore } from "./types.ts";

/*
 * In-memory object store for tests: same contract as R2, plus failure injection and operation counts so tests can
 * prove that retries don't re-upload and that playback reads ranges.
 */

export type MemoryStore = ObjectStore & {
  objects: Map<string, { data: Buffer; contentType: string; etag: string }>;
  calls: { put: number; head: number; get: number; presign: number; delete: number };
  /** Number of upcoming put() calls that fail. */
  failNextPuts: number;
  /** When set, put() stores these bytes instead of the file (simulates corruption in transit). */
  corruptNextPut: boolean;
};

export function memoryStore(): MemoryStore {
  const store: MemoryStore = {
    name: "memory",
    objects: new Map(),
    calls: { put: 0, head: 0, get: 0, presign: 0, delete: 0 },
    failNextPuts: 0,
    corruptNextPut: false,
    async put(key, input) {
      store.calls.put++;
      if (store.failNextPuts > 0) {
        store.failNextPuts--;
        throw new StorageUnavailableError("Cloud storage could not be reached: simulated network failure.");
      }
      let data = await readFile(input.filePath);
      if (store.corruptNextPut) {
        store.corruptNextPut = false;
        data = data.subarray(0, Math.max(0, data.length - 1));
      } else if (createHash("md5").update(data).digest("base64") !== input.md5Base64) {
        throw new StorageUnavailableError("Cloud storage error (BadDigest 400).");
      }
      const etag = createHash("md5").update(data).digest("hex");
      store.objects.set(key, { data, contentType: input.contentType, etag });
      return { etag };
    },
    async head(key) {
      store.calls.head++;
      const object = store.objects.get(key);
      return object ? { size: object.data.length, contentType: object.contentType, etag: object.etag } : null;
    },
    async get(key, range) {
      store.calls.get++;
      const object = store.objects.get(key);
      if (!object) throw new ObjectNotFoundError();
      const bytes = range ? object.data.subarray(range.start, range.end + 1) : object.data;
      return { stream: new Blob([new Uint8Array(bytes)]).stream(), contentLength: bytes.length };
    },
    async presignGet(key, { expiresInSeconds }) {
      store.calls.presign++;
      return `https://memory.invalid/${encodeURIComponent(key)}?expires=${Date.now() + expiresInSeconds * 1000}`;
    },
    async delete(key) {
      store.calls.delete++;
      store.objects.delete(key);
    },
  };
  return store;
}
