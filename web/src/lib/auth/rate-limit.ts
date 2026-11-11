import { createHash } from "node:crypto";
import { COLLECTIONS, type RateLimitDoc } from "../db/collections.ts";
import { getDatabase } from "../db/mongo.ts";

/*
 * Fixed-window rate limits (F10, made durable in F12). The counters live in MongoDB (collection rateLimits, TTL on
 * resetAt), so they survive restarts and are shared by every app instance; an atomic update counts each attempt.
 * Keys look like "login:acct:<email>" but are stored only as SHA-256 hashes — no email or IP is written to the
 * database. Tests can use the in-memory store (setRateLimitStore(memoryRateStore())).
 *
 * F12 policy: the sign-in limit is per ACCOUNT, independent of the client address (the address comes from a header a
 * client can forge — see clientIp()), so changing addresses no longer gives extra password guesses. Per-address limits
 * stay as a best-effort first line; global limits back up sign-up.
 */

export type Rule = { limit: number; windowMs: number };

export const LIMITS = {
  /** Failed sign-ins per account, whatever the address: 10 per 15 minutes (then wait, or reset the password). */
  loginPerAccount: { limit: 10, windowMs: 15 * 60_000 },
  /** Failed sign-ins per client address (best effort: the address can be forged without a trusted proxy). */
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  signupPerIp: { limit: 5, windowMs: 60 * 60_000 },
  /** New accounts across the whole app, as a backstop when addresses are forged. */
  signupGlobal: { limit: 100, windowMs: 60 * 60_000 },
  emailPerAccount: { limit: 3, windowMs: 60 * 60_000 },
  emailCooldown: { limit: 1, windowMs: 60_000 },
  resetPerIp: { limit: 10, windowMs: 60 * 60_000 },
  /** "Improve my prompt" (Gemini) per account per day: protects the shared free Gemini quota. */
  promptAssistPerAccount: { limit: 30, windowMs: 24 * 60 * 60_000 },
} as const satisfies Record<string, Rule>;

export type HitResult = { ok: boolean; count: number; retryAfterMs: number };

export interface RateLimitStore {
  /** Counts one attempt atomically and returns the window's new count. */
  hit(key: string, rule: Rule, now: number): Promise<HitResult>;
  /** The current window's count (0 when there is none or it has expired). */
  count(key: string, now: number): Promise<number>;
  clear(key: string): Promise<void>;
  /** Tests only. */
  reset(): Promise<void>;
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("base64url");

export function memoryRateStore(): RateLimitStore {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key, rule, now) {
      const current = windows.get(key);
      const window = current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };
      window.count += 1;
      windows.set(key, window);
      if (windows.size > 10_000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      return { ok: window.count <= rule.limit, count: window.count, retryAfterMs: Math.max(0, window.resetAt - now) };
    },
    async count(key, now) {
      const current = windows.get(key);
      return current && current.resetAt > now ? current.count : 0;
    },
    async clear(key) {
      windows.delete(key);
    },
    async reset() {
      windows.clear();
    },
  };
}

export const mongoRateStore: RateLimitStore = {
  async hit(key, rule, now) {
    const db = await getDatabase();
    const at = new Date(now);
    const fresh = new Date(now + rule.windowMs);
    // One atomic pipeline update (with upsert): continue the open window, or start a new one.
    const doc = await db.collection<RateLimitDoc>(COLLECTIONS.rateLimits).findOneAndUpdate(
      { _id: hashKey(key) },
      [
        {
          $set: {
            count: { $cond: [{ $gt: ["$resetAt", at] }, { $add: ["$count", 1] }, 1] },
            resetAt: { $cond: [{ $gt: ["$resetAt", at] }, "$resetAt", fresh] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
    const count = doc?.count ?? 1;
    const resetAt = doc?.resetAt?.getTime() ?? now + rule.windowMs;
    return { ok: count <= rule.limit, count, retryAfterMs: Math.max(0, resetAt - now) };
  },
  async count(key, now) {
    const db = await getDatabase();
    const doc = await db.collection<RateLimitDoc>(COLLECTIONS.rateLimits).findOne({ _id: hashKey(key), resetAt: { $gt: new Date(now) } });
    return doc?.count ?? 0;
  },
  async clear(key) {
    const db = await getDatabase();
    await db.collection<RateLimitDoc>(COLLECTIONS.rateLimits).deleteOne({ _id: hashKey(key) });
  },
  async reset() {
    const db = await getDatabase();
    await db.collection<RateLimitDoc>(COLLECTIONS.rateLimits).deleteMany({});
  },
};

let current: RateLimitStore = mongoRateStore;
export function setRateLimitStore(store: RateLimitStore | null): void {
  current = store ?? mongoRateStore;
}

/** Counts one attempt; `ok: false` once the window's limit is exceeded. */
export function hit(key: string, rule: Rule, now = Date.now()): Promise<HitResult> {
  return current.hit(key, rule, now);
}

/** Whether the key is already at its limit, without counting. */
export async function isLimited(key: string, rule: { limit: number }, now = Date.now()): Promise<boolean> {
  return (await current.count(key, now)) >= rule.limit;
}

export function clearLimit(key: string): Promise<void> {
  return current.clear(key);
}

/** Tests only: forget every counter in the current store. */
export function resetRateLimits(): Promise<void> {
  return current.reset();
}
