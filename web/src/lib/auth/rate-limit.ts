/*
 * Fixed-window rate limits in memory (F10). One server process, so memory is enough; limits reset on restart
 * (documented). Keys look like "login:ip:1.2.3.4" and never contain passwords or tokens.
 */

type Window = { count: number; resetAt: number };
const store = globalThis as typeof globalThis & { __explivioRate?: Map<string, Window> };
const windows = (store.__explivioRate ??= new Map());

export const LIMITS = {
  loginPerAccount: { limit: 5, windowMs: 15 * 60_000 },
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  signupPerIp: { limit: 5, windowMs: 60 * 60_000 },
  emailPerAccount: { limit: 3, windowMs: 60 * 60_000 },
  emailCooldown: { limit: 1, windowMs: 60_000 },
  resetPerIp: { limit: 10, windowMs: 60 * 60_000 },
} as const;

/** Counts one attempt; `ok: false` once the window's limit is exceeded. */
export function hit(key: string, rule: { limit: number; windowMs: number }, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const current = windows.get(key);
  const window = current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };
  window.count += 1;
  windows.set(key, window);
  if (windows.size > 10_000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  return { ok: window.count <= rule.limit, retryAfterMs: Math.max(0, window.resetAt - now) };
}

/** Whether the key is already at its limit, without counting. */
export function isLimited(key: string, rule: { limit: number }, now = Date.now()): boolean {
  const current = windows.get(key);
  return Boolean(current && current.resetAt > now && current.count >= rule.limit);
}

export function clearLimit(key: string): void {
  windows.delete(key);
}

/** Tests only. */
export function resetRateLimits(): void {
  windows.clear();
}
