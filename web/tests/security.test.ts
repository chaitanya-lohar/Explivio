import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hit, isLimited, LIMITS, memoryRateStore, mongoRateStore, resetRateLimits, setRateLimitStore } from "../src/lib/auth/rate-limit.ts";
import { securityEvent, setSecuritySink } from "../src/lib/security/log.ts";
import * as auth from "../src/services/auth/service.ts";
import { runEmailWorkerOnce } from "../src/lib/email/worker.ts";
import { closeDatabase, getDatabase } from "../src/lib/db/mongo.ts";
import { COLLECTIONS, ensureSchema } from "../src/lib/db/collections.ts";

/*
 * F12 security tests. Offline: log scrubbing and limiter behaviour (memory store). Live (MONGODB_URI_TEST): the durable
 * MongoDB limiter under concurrency, response-time equality (enumeration), the session lifecycle, length caps, disabled
 * accounts and secrets never reaching logs. Live tests use a throwaway database explivio_test_sec_<pid>, dropped after.
 */

const outbox = mkdtempSync(path.join(tmpdir(), "explivio-sec-outbox-"));
process.env.EXPLIVIO_OUTBOX_DIR = outbox;
process.env.EXPLIVIO_PIPELINE_ROOT = mkdtempSync(path.join(tmpdir(), "explivio-sec-root-"));
delete process.env.EMAIL_TRANSPORT;
const live = Boolean(process.env.MONGODB_URI_TEST);
const skip = !live && "MONGODB_URI_TEST not set: no live MongoDB";
const logs: string[] = [];
setSecuritySink((line) => logs.push(line));

before(async () => {
  if (!live) return setRateLimitStore(memoryRateStore());
  process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
  process.env.MONGODB_DB = `explivio_test_sec_${process.pid}`;
  await ensureSchema(await getDatabase());
});
after(async () => {
  if (live) await (await getDatabase()).dropDatabase();
  await closeDatabase();
  setSecuritySink(null);
  rmSync(outbox, { recursive: true, force: true });
});
beforeEach(async () => {
  await resetRateLimits();
  auth.setClock(null);
  auth.setResponseFloors({ signUp: 0, forgot: 0, resend: 0 });
});

const PASSWORD = "Correct-horse-9";
let n = 0;
const freshEmail = () => `sec${process.pid}-${++n}@example.test`;
async function linkFor(email: string, kind: "verify-email" | "reset-password"): Promise<string> {
  await runEmailWorkerOnce();
  for (const f of readdirSync(outbox).sort().reverse()) {
    const text = readFileSync(path.join(outbox, f), "utf8");
    const m = text.startsWith(`To: ${email}\n`) && text.match(new RegExp(`/${kind}\\?token=([A-Za-z0-9_-]+)`));
    if (m) return m[1];
  }
  throw new Error(`no ${kind} link for ${email}`);
}
async function verifiedUser(email = freshEmail()) {
  assert.ok((await auth.signUp({ name: "Sec User", email, password: PASSWORD }, "10.1.0.1")).ok);
  const v = await auth.verifyEmail(await linkFor(email, "verify-email"));
  assert.ok(v.ok);
  return { email, userId: v.userId };
}
const signIn = (email: string, password = PASSWORD, ip = "10.1.0.2") => auth.signIn({ email, password, rememberMe: false }, ip);
const elapsed = async (work: () => Promise<unknown>) => {
  const t = performance.now();
  await work();
  return performance.now() - t;
};

// ---- Offline ----------------------------------------------------------------------------------------------------

test("security log: allow-listed fields only; addresses hashed; emails, tokens and free text can't get in", () => {
  logs.length = 0;
  securityEvent("signin_failed", { userId: `usr_${"a".repeat(32)}`, ip: "203.0.113.9", count: 3, reason: "disabled" });
  securityEvent("signin_failed", { userId: "someone@example.com", ip: "203.0.113.9", reason: "token=abc123 secret", videoId: "../x" } as never);
  const [first, second] = logs.map((l) => JSON.parse(l.replace(/^\[security\] /, "")));
  assert.equal(first.userId, `usr_${"a".repeat(32)}`);
  assert.equal(first.count, 3);
  assert.match(first.ip, /^[A-Za-z0-9_-]{12}$/);
  assert.notEqual(first.ip, "203.0.113.9", "the address itself is never written");
  assert.deepEqual(Object.keys(second).sort(), ["event", "ip", "ts"], "invalid id, free-text reason and bad video id dropped");
  assert.ok(logs.every((l) => !l.includes("example.com") && !l.includes("abc123") && !l.includes("203.0.113.9")));
});

test("limiter: blocks over the limit, then works normally again once the window has passed", async () => {
  const store = memoryRateStore();
  const rule = { limit: 3, windowMs: 1000 };
  for (let i = 0; i < 3; i++) assert.ok((await store.hit("k", rule, 0)).ok);
  const over = await store.hit("k", rule, 10);
  assert.equal(over.ok, false);
  assert.equal(over.retryAfterMs, 990, "tells the caller when to retry");
  assert.ok((await store.hit("k", rule, 1001)).ok, "a new window starts after expiry");
});

// ---- Live MongoDB ---------------------------------------------------------------------------------------------------

test("durable limiter: atomic under 25 concurrent attempts, keys stored only as hashes, TTL cleanup index present", { skip }, async () => {
  setRateLimitStore(mongoRateStore);
  const key = "login:acct:victim@example.test";
  const results = await Promise.all(Array.from({ length: 25 }, () => hit(key, LIMITS.loginPerAccount)));
  assert.equal(results.filter((r) => r.ok).length, LIMITS.loginPerAccount.limit, "exactly the limit gets through");
  assert.equal(await isLimited(key, LIMITS.loginPerAccount), true);
  const db = await getDatabase();
  const docs = await db.collection(COLLECTIONS.rateLimits).find().toArray();
  assert.ok(docs.length >= 1 && docs.every((d) => !String(d._id).includes("@") && /^[A-Za-z0-9_-]{43}$/.test(String(d._id))), "no email in the database");
  const ttl = (await db.collection(COLLECTIONS.rateLimits).indexes()).find((i) => i.name === "expiry_ttl");
  assert.equal(ttl?.expireAfterSeconds, 0);
  assert.equal(await isLimited(key, LIMITS.loginPerAccount, Date.now() + 16 * 60_000), false, "expired window no longer limits");
});

test("enumeration (F2/F3): sign-up and forgot-password take the same time for registered and unknown emails", { skip, timeout: 120_000 }, async () => {
  const taken = (await verifiedUser()).email;
  // Unprotected cost difference (floors off), for the report.
  const raw = { newEmail: await elapsed(() => auth.signUp({ name: "T", email: freshEmail(), password: PASSWORD }, "10.2.0.1")), existing: await elapsed(() => auth.signUp({ name: "T", email: taken, password: PASSWORD }, "10.2.0.2")) };
  auth.setResponseFloors(null); // the real minimum times
  const signUpNew: number[] = [];
  const signUpTaken: number[] = [];
  const forgotKnown: number[] = [];
  const forgotUnknown: number[] = [];
  for (let i = 0; i < 3; i++) {
    await resetRateLimits();
    signUpNew.push(await elapsed(() => auth.signUp({ name: "T", email: freshEmail(), password: PASSWORD }, `10.3.${i}.1`)));
    signUpTaken.push(await elapsed(() => auth.signUp({ name: "T", email: taken, password: PASSWORD }, `10.3.${i}.2`)));
    forgotKnown.push(await elapsed(() => auth.requestPasswordReset(taken, `10.4.${i}.1`)));
    forgotUnknown.push(await elapsed(() => auth.requestPasswordReset(freshEmail(), `10.4.${i}.2`)));
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const report = { rawNewMs: Math.round(raw.newEmail), rawExistingMs: Math.round(raw.existing), signUpNew: Math.round(mean(signUpNew)), signUpTaken: Math.round(mean(signUpTaken)), forgotKnown: Math.round(mean(forgotKnown)), forgotUnknown: Math.round(mean(forgotUnknown)), maxSignUp: Math.round(Math.max(...signUpNew, ...signUpTaken)), maxForgot: Math.round(Math.max(...forgotKnown, ...forgotUnknown)) };
  console.log(`timing ${JSON.stringify(report)}`);
  assert.ok(Math.abs(mean(signUpNew) - mean(signUpTaken)) < 60, `sign-up difference ${report.signUpNew} vs ${report.signUpTaken} ms`);
  assert.ok(Math.abs(mean(forgotKnown) - mean(forgotUnknown)) < 60, `forgot difference ${report.forgotKnown} vs ${report.forgotUnknown} ms`);
  assert.ok(Math.min(...signUpNew, ...signUpTaken) >= 1495 && Math.min(...forgotKnown, ...forgotUnknown) >= 1195, "the floors apply");
  assert.ok(report.maxSignUp < 1700 && report.maxForgot < 1400, "the slow path stays inside the floor (otherwise the floor must be raised)");
});

test("sessions: concurrent sessions are independent; replacing one revokes only it; reset revokes all and lifts a lockout", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  const laptop = await signIn(email);
  const phone = await signIn(email);
  assert.ok(laptop.ok && phone.ok && laptop.sessionToken !== phone.sessionToken, "a fresh token for every sign-in");
  assert.equal((await auth.userForSession(laptop.sessionToken))?.id, userId);
  assert.equal((await auth.userForSession(phone.sessionToken))?.id, userId);

  // Signing in again in the laptop's browser replaces the laptop session (signInAction calls signOut(previous, "replaced")).
  const again = await signIn(email);
  assert.ok(again.ok);
  await auth.signOut(laptop.sessionToken, "replaced");
  assert.equal(await auth.userForSession(laptop.sessionToken), null, "old browser session revoked");
  assert.equal((await auth.userForSession(phone.sessionToken))?.id, userId, "the other device is unaffected");

  // Lock the account, then reset the password: every session ends and the lockout is lifted.
  for (let i = 0; i < LIMITS.loginPerAccount.limit; i++) await signIn(email, `Wrong-${i}-x`, `192.0.2.${i}`);
  assert.equal((await signIn(email)).ok, false, "locked");
  await auth.requestPasswordReset(email, "10.5.0.1");
  assert.deepEqual(await auth.resetPassword(await linkFor(email, "reset-password"), "Brand-new-pass-7", "10.5.0.1"), { ok: true });
  for (const s of [phone, again]) assert.equal(await auth.userForSession(s.ok ? s.sessionToken : ""), null, "all sessions revoked");
  assert.equal((await signIn(email, "Brand-new-pass-7")).ok, true, "the owner can sign in right after resetting");
});

test("sessions: forged, expired and disabled-account sessions get nothing; a session never outlives its absolute expiry", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  const s = await auth.signIn({ email, password: PASSWORD, rememberMe: true }, "10.6.0.1");
  assert.ok(s.ok);
  for (const forged of ["", "x", s.sessionToken.slice(0, -1) + (s.sessionToken.endsWith("A") ? "B" : "A"), "a".repeat(201)]) assert.equal(await auth.userForSession(forged), null);
  auth.setClock(() => Date.now() + (auth.REMEMBER_DAYS * 86_400_000 + 60_000));
  assert.equal(await auth.userForSession(s.sessionToken), null, "Remember me ends after 30 days");
  auth.setClock(null);
  const t = await signIn(email);
  assert.ok(t.ok);
  await (await getDatabase()).collection(COLLECTIONS.users).updateOne({ _id: userId as never }, { $set: { status: "disabled" } });
  assert.equal(await auth.userForSession(t.sessionToken), null, "a disabled account's sessions stop working at once");
  const blocked = await signIn(email);
  assert.ok(!blocked.ok && blocked.code === "disabled");
});

test("input caps: over-long passwords are refused on sign-up and reset, and are simply wrong on sign-in", { skip }, async () => {
  const long = `Aa1-${"x".repeat(auth.MAX_PASSWORD_LENGTH)}`;
  assert.deepEqual((await auth.signUp({ name: "L", email: freshEmail(), password: long }, "10.7.0.1")).ok, false);
  const { email } = await verifiedUser();
  const r = await signIn(email, long);
  assert.ok(!r.ok && r.code === "invalid_credentials");
  await auth.requestPasswordReset(email, "10.7.0.2");
  const reset = await auth.resetPassword(await linkFor(email, "reset-password"), long, "10.7.0.2");
  assert.ok(!reset.ok && reset.code === "validation");
  assert.deepEqual(await auth.checkResetToken(await linkFor(email, "reset-password")), { ok: true }, "the link isn't used up by a rejected password");
});

test("a whole account lifecycle logs the security events, and no log line contains a password, email, token or address", { skip }, async () => {
  logs.length = 0;
  const email = freshEmail();
  await auth.signUp({ name: "Log", email, password: PASSWORD }, "198.51.100.10");
  const verifyToken = await linkFor(email, "verify-email");
  await auth.verifyEmail(verifyToken);
  await signIn(email, "Wrong-pass-1", "198.51.100.10");
  const s = await signIn(email, PASSWORD, "198.51.100.10");
  await auth.requestPasswordReset(email, "198.51.100.10");
  const resetToken = await linkFor(email, "reset-password");
  await auth.resetPassword(resetToken, "Changed-pass-2", "198.51.100.10");
  await auth.signOut(s.ok ? s.sessionToken : undefined);
  const events = logs.map((l) => JSON.parse(l.replace(/^\[security\] /, "")).event);
  for (const e of ["signup_created", "verify_success", "signin_failed", "signin_success", "reset_requested", "reset_completed"]) assert.ok(events.includes(e), `${e} logged`);
  const secrets = [PASSWORD, "Wrong-pass-1", "Changed-pass-2", email, email.split("@")[0], verifyToken, resetToken, s.ok ? s.sessionToken : "-", "198.51.100.10"];
  for (const line of logs) for (const secret of secrets) assert.ok(!line.includes(secret), `log line leaks a secret: ${line.slice(0, 80)}`);
});
