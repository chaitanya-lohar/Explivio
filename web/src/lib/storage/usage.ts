/*
 * Free-tier safety guard (F11, $0 policy). Cloudflare R2's free tier (Standard storage, checked 2026-11-05 on
 * developers.cloudflare.com/r2/pricing): 10 GB-month storage, 1 million Class A operations (PutObject, ListObjects…)
 * and 10 million Class B operations (GetObject, HeadObject…) per month; egress is free; DeleteObject is free.
 * Usage beyond that is billed automatically with no spending cap, so new uploads stop at 80% of the storage or
 * Class A allowance. Playback (Class B) isn't counted here: 10 million reads a month is far beyond a single-user app;
 * monitor it in the Cloudflare dashboard (R2 → Metrics).
 */

export const R2_FREE_TIER = { storageBytes: 10 * 1000 ** 3, classAPerMonth: 1_000_000, classBPerMonth: 10_000_000 } as const;
export const SAFETY_FRACTION = 0.8;

export interface StorageUsage {
  /** Bytes of video objects recorded as uploaded. */
  storedBytes: number;
  /** Upload attempts started this calendar month (each costs at most one PutObject, a Class A operation). */
  uploadsThisMonth: number;
}

/** Null when the upload may go ahead, otherwise the reason it must not. */
export function quotaProblem(usage: StorageUsage, nextUploadBytes: number): string | null {
  const storageLimit = R2_FREE_TIER.storageBytes * SAFETY_FRACTION;
  if (usage.storedBytes + nextUploadBytes > storageLimit) {
    return `Cloud storage is near its free limit (${(usage.storedBytes / 1000 ** 3).toFixed(2)} GB of ${storageLimit / 1000 ** 3} GB used); uploads are paused.`;
  }
  if (usage.uploadsThisMonth + 1 > R2_FREE_TIER.classAPerMonth * SAFETY_FRACTION) {
    return "Cloud storage has reached this month's free upload limit; uploads are paused.";
  }
  return null;
}
