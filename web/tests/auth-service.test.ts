import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashPassword, hashToken, newToken, newUserId, sign, unsign, verifyPassword } from "../src/lib/auth/crypto.ts";
import { hit, isLimited, LIMITS, memoryRateStore, resetRateLimits, setRateLimitStore } from "../src/lib/auth/rate-limit.ts";
import * as auth from "../src/services/auth/service.ts";
import { runEmailWorkerOnce } from "../src/lib/email/worker.ts";
import { closeDatabase, getDatabase } from "../src/lib/db/mongo.ts";
import { ensureSchema } from "../src/lib/db/collections.ts";

/*
 * F10 authentication service. Offline tests always run. Account-flow tests need a real MongoDB (Atlas):
 * MONGODB_URI_TEST — they use a throwaway database explivio_test_auth_<pid>, dropped afterwards. Emails go to a
 * temporary outbox that the tests read (no email is sent, no paid service is called).
 */

const outbox = mkdtempSync(path.join(tmpdir(), "explivio-outbox-"));
process.env.EXPLIVIO_OUTBOX_DIR = outbox;
process.env.EXPLIVIO_PIPELINE_ROOT = mkdtempSync(path.join(tmpdir(), "explivio-root-")); // generated secret goes here
delete process.env.EMAIL_TRANSPORT;
const live = Boolean(process.env.MONGODB_URI_TEST);
const skip = !live && "MONGODB_URI_TEST not set: no live MongoDB";
// Offline: counters in memory. Live: the real MongoDB store (F12). Minimum response times off for speed (tested in security.test.ts).
if (!live) setRateLimitStore(memoryRateStore());
auth.setResponseFloors({ signUp: 0, forgot: 0, resend: 0 });

before(async () => {
  if (!live) return;
  process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
  process.env.MONGODB_DB = `explivio_test_auth_${process.pid}`;
  await ensureSchema(await getDatabase());
});
after(async () => {
  if (live) await (await getDatabase()).dropDatabase();
  await closeDatabase();
  rmSync(outbox, { recursive: true, force: true });
});
beforeEach(async () => {
  await resetRateLimits();
  auth.setClock(null);
});

/** The newest link of a kind sent to an address (read from the development outbox). */
async function linkFor(email: string, kind: "verify-email" | "reset-password"): Promise<string | null> {
  await runEmailWorkerOnce();
  const files = readdirSync(outbox).sort().reverse();
  for (const f of files) {
    const text = readFileSync(path.join(outbox, f), "utf8");
    if (!text.startsWith(`To: ${email}\n`)) continue;
    const m = text.match(new RegExp(`/${kind}\\?token=([A-Za-z0-9_-]+)`));
    if (m) return m[1];
  }
  return null;
}
const PASSWORD = "Correct-horse-9";
let n = 0;
const freshEmail = () => `user${process.pid}-${++n}@example.test`;

async function verifiedUser(email = freshEmail()) {
  const r = await auth.signUp({ name: "Test User", email, password: PASSWORD }, "10.0.0.1");
  assert.ok(r.ok);
  const v = await auth.verifyEmail((await linkFor(email, "verify-email"))!);
  assert.ok(v.ok);
  return { email, userId: v.userId };
}

// ---- Offline ----------------------------------------------------------------------------------------------------

test("passwords: scrypt hashes with salt; right password matches, wrong doesn't; no plaintext", async () => {
  const a = await hashPassword(PASSWORD);
  const b = await hashPassword(PASSWORD);
  assert.match(a, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(a, b, "different salts");
  assert.ok(!a.includes(PASSWORD));
  assert.equal(await verifyPassword(PASSWORD, a), true);
  assert.equal(await verifyPassword("wrong-password-1", a), false);
  assert.equal(await verifyPassword(PASSWORD, "not-a-hash"), false);
});

test("tokens: 256-bit random, URL-safe; stored form is a hash", () => {
  const t = newToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newToken(), t);
  assert.notEqual(hashToken(t), t);
  assert.equal(hashToken(t), hashToken(t));
  assert.match(newUserId(), /^usr_[0-9a-f]{32}$/);
});

test("signed cookie values: tampering and expiry are rejected", () => {
  const s = sign("usr_abc", Date.now() + 60_000);
  assert.equal(unsign(s), "usr_abc");
  assert.equal(unsign(s.replace("usr_abc", "usr_xyz")), null, "tampered value");
  assert.equal(unsign(`${s}x`), null, "tampered signature");
  assert.equal(unsign(sign("usr_abc", Date.now() - 1)), null, "expired");
  assert.equal(unsign(undefined), null);
});

test("open redirects are refused: only same-site, non-auth paths", () => {
  assert.equal(auth.safeNextPath("/videos?view=list"), "/videos?view=list");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "%2F%2Fevil", "", null, "/\u0000x"]) assert.equal(auth.safeNextPath(bad), "/", String(bad));
});

test("rate limits: count per key, block over the limit", async () => {
  for (let i = 0; i < LIMITS.loginPerAccount.limit; i++) assert.equal((await hit("k", LIMITS.loginPerAccount)).ok, true);
  assert.equal((await hit("k", LIMITS.loginPerAccount)).ok, false);
  assert.equal(await isLimited("k", LIMITS.loginPerAccount), true);
  assert.equal(await isLimited("other", LIMITS.loginPerAccount), false);
});

// ---- Live MongoDB ---------------------------------------------------------------------------------------------------

test("sign-up creates an unverified account with a hashed password and emails a verification link (outbox, not 'sent')", { skip }, async () => {
  const email = freshEmail();
  const r = await auth.signUp({ name: "Ada", email: email.toUpperCase(), password: PASSWORD }, "10.0.0.2");
  assert.ok(r.ok && r.pendingUserId && r.delivery === "outbox");
  const user = await (await getDatabase()).collection("users").findOne({ emailNormalized: email });
  assert.ok(user && user.emailVerified === false && /^scrypt\$/.test(user.passwordHash) && !JSON.stringify(user).includes(PASSWORD));
  assert.ok(await linkFor(email.toUpperCase(), "verify-email"), "verification link in the outbox");
});

test("duplicate sign-up: no second account, same answer, existing owner notified", { skip }, async () => {
  const { email } = await verifiedUser();
  const r = await auth.signUp({ name: "Someone", email, password: "Other-pass-1" }, "10.0.0.3");
  assert.ok(r.ok && r.pendingUserId === null, "same success shape, no pending account");
  assert.equal(await (await getDatabase()).collection("users").countDocuments({ emailNormalized: email }), 1);
  await runEmailWorkerOnce(); // F13: the notice is queued; send it before reading the outbox
  const newest = readdirSync(outbox).sort().reverse().map((f) => readFileSync(path.join(outbox, f), "utf8")).find((t) => t.startsWith(`To: ${email}`));
  assert.match(newest ?? "", /already has an account/);
});

test("weak or invalid input is rejected by the server too", { skip }, async () => {
  for (const input of [{ name: "A", email: freshEmail(), password: "short" }, { name: "A", email: "not-an-email", password: PASSWORD }, { name: " ", email: freshEmail(), password: PASSWORD }]) {
    const r = await auth.signUp(input, "10.0.0.4");
    assert.equal(r.ok, false);
  }
});

test("verification: single use, invalid token, expired token, resend replaces old links", { skip }, async () => {
  const email = freshEmail();
  const r = await auth.signUp({ name: "B", email, password: PASSWORD }, "10.0.0.5");
  assert.ok(r.ok && r.pendingUserId);
  const first = (await linkFor(email, "verify-email"))!;
  // Resend (after the cooldown) issues a new link and retires the first.
  auth.setClock(() => Date.now() + 61_000);
  await resetRateLimits();
  const again = await auth.resendVerification(r.pendingUserId);
  assert.ok(again.ok);
  const second = (await linkFor(email, "verify-email"))!;
  assert.notEqual(second, first);
  assert.deepEqual(await auth.verifyEmail(first), { ok: false, problem: "used" }, "retired link");
  assert.deepEqual(await auth.verifyEmail("not-a-real-token"), { ok: false, problem: "invalid" });
  auth.setClock(() => Date.now() + 25 * 3_600_000);
  assert.deepEqual(await auth.verifyEmail(second), { ok: false, problem: "expired" }, "after 24 h");
  auth.setClock(null);
  const ok = await auth.verifyEmail(second);
  assert.equal(ok.ok, true);
  assert.deepEqual(await auth.verifyEmail(second), { ok: false, problem: "used" }, "second use");
});

test("sign-in: verified account gets a session; wrong password and unknown email look the same; unverified needs the password", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  const good = await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "10.0.0.6");
  assert.ok(good.ok);
  assert.equal(good.user.id, userId);
  assert.equal(Math.round((good.expiresAt.getTime() - Date.now()) / 86_400_000), auth.SESSION_DAYS);
  assert.equal((await auth.userForSession(good.sessionToken))?.id, userId);
  const session = await (await getDatabase()).collection<{ _id: string; userId: string }>("sessions").findOne({ userId });
  assert.ok(session && session._id !== good.sessionToken, "only the hash is stored");
  const wrong = await auth.signIn({ email, password: "Wrong-pass-1", rememberMe: false }, "10.0.0.6");
  const unknown = await auth.signIn({ email: freshEmail(), password: PASSWORD, rememberMe: false }, "10.0.0.6");
  assert.deepEqual(wrong, unknown, "no account enumeration");
  const pendingEmail = freshEmail();
  await auth.signUp({ name: "C", email: pendingEmail, password: PASSWORD }, "10.0.0.7");
  assert.equal((await auth.signIn({ email: pendingEmail, password: "Wrong-pass-1", rememberMe: false }, "10.0.0.7")).ok, false);
  const unverified = await auth.signIn({ email: pendingEmail, password: PASSWORD, rememberMe: true }, "10.0.0.7");
  assert.ok(!unverified.ok && unverified.code === "unverified");
});

test("brute force (F12 F1): after 10 wrong passwords the account is locked for every address, even if the next one is right", { skip }, async () => {
  const { email } = await verifiedUser();
  // A different (forged) address on every attempt: F10 keyed the limit on email+address, so this never locked.
  for (let i = 0; i < LIMITS.loginPerAccount.limit; i++) {
    const r = await auth.signIn({ email, password: `Wrong-pass-${i}`, rememberMe: false }, `203.0.113.${i + 1}`);
    assert.ok(!r.ok && r.code === "invalid_credentials", `attempt ${i + 1}`);
  }
  const blocked = await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "198.51.100.77");
  assert.ok(!blocked.ok && blocked.code === "rate_limited", "a fresh address doesn't reset the account limit");
  auth.setClock(() => Date.now() + 16 * 60_000);
  assert.equal((await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "198.51.100.78")).ok, true, "normal sign-in works once the window has passed");
});

test("sessions: expiry, logout and remember-me length", { skip }, async () => {
  const { email } = await verifiedUser();
  const s = await auth.signIn({ email, password: PASSWORD, rememberMe: true }, "10.0.0.9");
  assert.ok(s.ok);
  assert.equal(Math.round((s.expiresAt.getTime() - Date.now()) / 86_400_000), auth.REMEMBER_DAYS);
  auth.setClock(() => Date.now() + 31 * 86_400_000);
  assert.equal(await auth.userForSession(s.sessionToken), null, "expired");
  auth.setClock(null);
  const t = await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "10.0.0.9");
  assert.ok(t.ok);
  await auth.signOut(t.sessionToken);
  assert.equal(await auth.userForSession(t.sessionToken), null, "logged out");
  assert.equal(await auth.userForSession("garbage"), null);
});

test("password reset: same answer for unknown email; link single use and expiring; all sessions revoked", { skip }, async () => {
  const { email } = await verifiedUser();
  const s1 = await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "10.0.1.1");
  assert.ok(s1.ok);
  const unknown = await auth.requestPasswordReset(freshEmail(), "10.0.1.1");
  const known = await auth.requestPasswordReset(email, "10.0.1.1");
  assert.deepEqual(unknown, known, "no account enumeration");
  const token = (await linkFor(email, "reset-password"))!;
  assert.deepEqual(await auth.checkResetToken(token), { ok: true });
  assert.equal((await auth.resetPassword(token, "weak", "10.0.1.1")).ok, false, "password rules apply");
  const done = await auth.resetPassword(token, "New-password-2", "10.0.1.1");
  assert.deepEqual(done, { ok: true });
  assert.equal(await auth.userForSession(s1.sessionToken), null, "old sessions revoked");
  assert.deepEqual(await auth.resetPassword(token, "Another-pass-3", "10.0.1.1"), { ok: false, code: "token", problem: "used" }, "single use");
  assert.equal((await auth.signIn({ email, password: PASSWORD, rememberMe: false }, "10.0.1.2")).ok, false, "old password gone");
  assert.equal((await auth.signIn({ email, password: "New-password-2", rememberMe: false }, "10.0.1.2")).ok, true);
  await resetRateLimits();
  auth.setClock(() => Date.now() + 61_000);
  await auth.requestPasswordReset(email, "10.0.1.3");
  const late = (await linkFor(email, "reset-password"))!;
  auth.setClock(() => Date.now() + 31 * 60_000 + 61_000);
  assert.deepEqual(await auth.checkResetToken(late), { ok: false, problem: "expired" });
});

test("settings are per user and validated", { skip }, async () => {
  const a = await verifiedUser();
  const b = await verifiedUser();
  await auth.savePreferences(a.userId, { durationSeconds: 30, voice: "male", captions: false, music: true, extra: "dropped" });
  assert.deepEqual(await auth.getPreferences(a.userId), { durationSeconds: 30, voice: "male", captions: false, music: true });
  assert.deepEqual(await auth.getPreferences(b.userId), { durationSeconds: 60, voice: "female", captions: true, music: false }, "b keeps defaults");
  await auth.savePreferences(b.userId, { durationSeconds: 45, voice: "robot" });
  assert.deepEqual(await auth.getPreferences(b.userId), { durationSeconds: 60, voice: "female", captions: true, music: false }, "invalid values fall back");
});
