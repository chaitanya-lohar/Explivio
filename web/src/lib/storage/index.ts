import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readR2Config } from "./config.ts";
import { createR2Store } from "./r2.ts";
import type { ObjectStore } from "./types.ts";

/*
 * The object store the app uses: Cloudflare R2 when web/.env.local configures it, otherwise none (videos stay local,
 * as before F11). Created once per server process. Tests swap in an in-memory store with setObjectStore().
 */

const holder = globalThis as typeof globalThis & { __explivioObjectStore?: ObjectStore | null; __explivioObjectStoreOverride?: boolean };

export function objectStore(): ObjectStore | null {
  if (holder.__explivioObjectStoreOverride) return holder.__explivioObjectStore ?? null;
  if (holder.__explivioObjectStore === undefined) {
    const config = readR2Config();
    holder.__explivioObjectStore = config.ok ? createR2Store(config) : null;
  }
  return holder.__explivioObjectStore;
}

/** For tests: use this store (null = no cloud storage). Call with undefined to go back to the configured one. */
export function setObjectStore(store: ObjectStore | null | undefined): void {
  holder.__explivioObjectStoreOverride = store !== undefined;
  holder.__explivioObjectStore = store === undefined ? undefined : store;
}

/** MD5 of a file, streamed (base64 for Content-MD5, hex to compare with R2's ETag). */
export async function fileMd5(filePath: string): Promise<{ base64: string; hex: string }> {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(/* turbopackIgnore: true */ filePath)) hash.update(chunk as Buffer);
  const digest = hash.digest();
  return { base64: digest.toString("base64"), hex: digest.toString("hex") };
}

export * from "./types.ts";
export { videoObjectKey, checkObjectKey } from "./keys.ts";
export { quotaProblem, R2_FREE_TIER, type StorageUsage } from "./usage.ts";
