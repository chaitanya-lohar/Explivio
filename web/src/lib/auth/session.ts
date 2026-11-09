import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sign, unsign } from "./crypto";
import { safeNextPath, userForSession, type User } from "@/services/auth/service";

/*
 * Session cookies for the Next.js side (F10). The cookie holds a random token; the database holds only its hash.
 * HttpOnly (no JavaScript access), SameSite=Lax (no cross-site posts), Secure (browsers allow it on localhost).
 * Server-only.
 */

export const SESSION_COOKIE = "explivio_session";
const PENDING_COOKIE = "explivio_pending";
/** Set by proxy.ts so a server-side redirect to sign-in can come back to the same page. */
export const PATH_HEADER = "x-explivio-path";

const base = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

/** The signed-in user for this request (one database lookup per request), or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // The session is checked in MongoDB at request time only, never inside a (runtime-prefetch) prerender: the driver
  // timestamps its connection-pool events with `new Date()`, which Next.js rejects while prerendering, and a sign-in
  // state must never be prerendered or cached anyway (revocation takes effect on the next request).
  await connection();
  return userForSession(token);
});

/** For protected pages: the user, or a redirect to sign-in that returns here afterwards. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (user) return user;
  const next = safeNextPath((await headers()).get(PATH_HEADER));
  redirect(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
}

/** "Remember me" keeps the cookie across browser restarts until the session expires; otherwise it ends with the browser. */
export async function setSessionCookie(token: string, expiresAt: Date, remember: boolean): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, remember ? { ...base, expires: expiresAt } : base);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/" });
}

/** Remembers which account is waiting for email verification (signed, 1 day), so "Resend" works without asking again. */
export async function setPendingVerification(userId: string): Promise<void> {
  const expires = Date.now() + 86_400_000;
  (await cookies()).set(PENDING_COOKIE, sign(userId, expires), { ...base, expires: new Date(expires) });
}

export async function pendingVerification(): Promise<string | null> {
  return unsign((await cookies()).get(PENDING_COOKIE)?.value);
}

export async function clearPendingVerification(): Promise<void> {
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/" });
}

/**
 * Best-effort client address, used ONLY for per-address rate limits and (hashed) security logs.
 * Next.js fills x-forwarded-for with the socket address when the client sent none, but keeps a client-supplied value,
 * so without a trusted proxy that overwrites it (F14) the value can be forged. Security therefore never depends on it:
 * sign-in is limited per account and sign-up globally (F12). The value is bounded so it can't bloat keys or logs.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel the edge network sets x-real-ip itself (a client can't forge it), so per-address limits are meaningful.
  if (process.env.VERCEL) {
    const ip = h.get("x-real-ip")?.trim() ?? "";
    return /^[0-9A-Fa-f:.]{1,45}$/.test(ip) ? ip : "invalid";
  }
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
  return /^[0-9A-Fa-f:.]{1,45}$/.test(raw) ? raw : "invalid";
}
