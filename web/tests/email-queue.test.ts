import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as auth from "../src/services/auth/service.ts";
import { closeDatabase, getDatabase } from "../src/lib/db/mongo.ts";
import { COLLECTIONS, ensureSchema, type EmailJobDoc } from "../src/lib/db/collections.ts";
import { resetRateLimits } from "../src/lib/auth/rate-limit.ts";
import { setEmailProvider } from "../src/lib/email/provider.ts";
import { testProvider, type TestProvider } from "../src/lib/email/providers/test.ts";
import { enqueueEmail } from "../src/lib/email/queue.ts";
import { nextUtcMidnight, reserveDailySlot, slotsUsed } from "../src/lib/email/quota.ts";
import { runEmailWorkerOnce } from "../src/lib/email/worker.ts";
import { setSecuritySink } from "../src/lib/security/log.ts";

/*
 * F13 durable email queue, live MongoDB (MONGODB_URI_TEST; throwaway database explivio_test_mail_<pid>, dropped after).
 * The in-memory test provider stands in for Resend, so no real email is sent and no quota is used.
 */

const live = Boolean(process.env.MONGODB_URI_TEST);
const skip = !live && "MONGODB_URI_TEST not set: no live MongoDB";
process.env.EXPLIVIO_PIPELINE_ROOT = mkdtempSync(path.join(tmpdir(), "explivio-mail-root-"));
process.env.EXPLIVIO_APP_URL = "https://app.example.test";
let provider: TestProvider;
const logs: string[] = [];
setSecuritySink((line) => logs.push(line));

before(async () => {
  if (!live) return;
  process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
  process.env.MONGODB_DB = `explivio_test_mail_${process.pid}`;
  await ensureSchema(await getDatabase());
});
after(async () => {
  if (live) await (await getDatabase()).dropDatabase();
  await closeDatabase();
  setSecuritySink(null);
});
beforeEach(async () => {
  if (!live) return;
  provider = testProvider();
  setEmailProvider(provider);
  auth.setResponseFloors({ signUp: 0, forgot: 0, resend: 0 });
  delete process.env.EXPLIVIO_EMAIL_DAILY_LIMIT;
  const db = await getDatabase();
  await db.collection(COLLECTIONS.emailJobs).deleteMany({});
  await resetRateLimits();
});

const PASSWORD = "Correct-horse-9";
let n = 0;
const freshEmail = () => `mail${process.pid}-${++n}@example.test`;
const jobsOf = async (userId?: string) => (await getDatabase()).collection<EmailJobDoc>(COLLECTIONS.emailJobs).find(userId ? { userId } : {}).sort({ createdAt: 1 }).toArray();
const tokenIn = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
async function verifiedUser() {
  const email = freshEmail();
  assert.ok((await auth.signUp({ name: "Mail User", email, password: PASSWORD }, "10.8.0.1")).ok);
  await runEmailWorkerOnce();
  const v = await auth.verifyEmail(tokenIn(provider.sent.at(-1)!.email.text));
  assert.ok(v.ok);
  return { email, userId: v.userId };
}

test("sign-up queues a job with no token; the worker sends a verification email whose link (configured URL) verifies the account", { skip }, async () => {
  const email = freshEmail();
  await auth.signUp({ name: "Ana <b>", email, password: PASSWORD }, "10.8.0.2");
  const [job] = await jobsOf();
  assert.equal(job.kind, "verify_email");
  assert.equal(job.status, "pending");
  assert.ok(!/token/i.test(JSON.stringify(job)), "the queue never holds a token");
  assert.equal(provider.sent.length, 0, "nothing sent during the request");
  assert.equal(await runEmailWorkerOnce(), 1);
  const sent = provider.sent[0];
  assert.equal(sent.email.to, email);
  assert.match(sent.email.text, /^Confirm your email address/);
  assert.ok(sent.email.text.includes("https://app.example.test/verify-email?token="), "link built from EXPLIVIO_APP_URL");
  assert.ok(sent.email.html.includes("Ana &lt;b&gt;"));
  assert.equal(sent.idempotencyKey, `${job._id}:1`);
  const [done] = await jobsOf();
  assert.equal(done.status, "accepted");
  assert.equal(done.to, null, "address erased once the job ends");
  assert.equal(done.name, null);
  assert.ok(done.expireAt && done.providerMessageId);
  assert.equal((await auth.verifyEmail(tokenIn(sent.email.text))).ok, true);
});

test("three workers at once: every job is sent exactly once", { skip }, async () => {
  const { userId, email } = await verifiedUser();
  provider.sent.length = 0;
  for (let i = 0; i < 6; i++) await enqueueEmail("password_changed", { id: userId, email, name: "Mail User" });
  const counts = await Promise.all([1, 2, 3].map((w) => runEmailWorkerOnce({ workerId: `w${w}` })));
  assert.equal(counts.reduce((a, b) => a + b, 0), 6);
  assert.equal(provider.sent.length, 6);
  assert.equal(new Set(provider.sent.map((s) => s.idempotencyKey)).size, 6, "no job sent twice");
});

test("restart recovery: an expired lease before submission is retried; after submission it becomes 'unknown' and is never resent", { skip }, async () => {
  const { userId } = await verifiedUser();
  provider.sent.length = 0;
  const jobs = (await getDatabase()).collection<EmailJobDoc>(COLLECTIONS.emailJobs);
  const past = new Date(Date.now() - 120_000);
  const base = { kind: "password_changed" as const, userId, to: "x@example.test", name: "X", attemptCount: 0, nextAttemptAt: past, createdAt: past, updatedAt: past, leaseOwner: "crashed", leaseExpiresAt: past };
  await jobs.insertMany([{ _id: "ej_before", ...base, status: "processing", submittingAt: null }, { _id: "ej_after", ...base, status: "processing", submittingAt: past, attemptCount: 1 }]);
  await runEmailWorkerOnce();
  assert.equal(provider.sent.length, 1, "only the job that never reached the provider is sent");
  assert.equal((await jobs.findOne({ _id: "ej_before" }))?.status, "accepted");
  const unknown = await jobs.findOne({ _id: "ej_after" });
  assert.equal(unknown?.status, "unknown");
  assert.equal(unknown?.lastErrorCode, "interrupted_after_submit");
  await runEmailWorkerOnce();
  assert.equal(provider.sent.length, 1, "never resent");
});

test("a definite refusal deletes the unsent link and keeps the earlier link working; temporary refusals back off; 5 submissions at most", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  await auth.requestPasswordReset(email, "10.8.1.1");
  await runEmailWorkerOnce();
  const first = tokenIn(provider.sent.at(-1)!.email.text);
  assert.deepEqual(await auth.checkResetToken(first), { ok: true });

  await resetRateLimits();
  provider.script.push({ status: "rejected", code: "validation_error", retryable: false });
  await auth.requestPasswordReset(email, "10.8.1.2");
  await runEmailWorkerOnce();
  const refused = (await jobsOf(userId)).at(-1)!;
  assert.equal(refused.status, "failed");
  assert.equal(refused.lastErrorCode, "validation_error");
  assert.deepEqual(await auth.checkResetToken(first), { ok: true }, "the delivered link still works");
  const unused = await (await getDatabase()).collection(COLLECTIONS.emailTokens).countDocuments({ userId, purpose: "reset_password", usedAt: null });
  assert.equal(unused, 1, "the never-delivered link was deleted");

  // Temporary refusals: retry_wait with backoff, then success.
  await enqueueEmail("password_changed", { id: userId, email, name: "Mail User" });
  provider.script.push({ status: "rejected", code: "rate_limit_exceeded", retryable: true });
  const t0 = new Date();
  await runEmailWorkerOnce({ now: () => t0 });
  const waiting = (await jobsOf(userId)).at(-1)!;
  assert.equal(waiting.status, "retry_wait");
  assert.equal(waiting.nextAttemptAt.getTime() - t0.getTime(), 60_000, "first backoff 1 minute");
  assert.equal(await runEmailWorkerOnce({ now: () => t0 }), 0, "not due yet");
  await runEmailWorkerOnce({ now: () => new Date(t0.getTime() + 61_000) });
  assert.equal((await jobsOf(userId)).at(-1)!.status, "accepted");

  // Five temporary refusals in a row: the job fails instead of retrying forever.
  await enqueueEmail("password_changed", { id: userId, email, name: "Mail User" });
  for (let i = 0; i < 5; i++) provider.script.push({ status: "rejected", code: "network_unreachable", retryable: true });
  let clock = Date.now();
  for (let i = 0; i < 6; i++) {
    await runEmailWorkerOnce({ now: () => new Date(clock) });
    clock += 3 * 3_600_000;
  }
  const gaveUp = (await jobsOf(userId)).at(-1)!;
  assert.equal(gaveUp.status, "failed");
  assert.equal(gaveUp.attemptCount, 5);
});

test("an unknown outcome is never resent, and both links stay valid (it may have arrived)", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  await auth.requestPasswordReset(email, "10.8.2.1");
  await runEmailWorkerOnce();
  const first = tokenIn(provider.sent.at(-1)!.email.text);
  await resetRateLimits();
  provider.script.push({ status: "unknown", code: "timeout" });
  await auth.requestPasswordReset(email, "10.8.2.2");
  await runEmailWorkerOnce();
  const maybe = tokenIn(provider.sent.at(-1)!.email.text);
  assert.equal((await jobsOf(userId)).at(-1)!.status, "unknown");
  const before = provider.sent.length;
  await runEmailWorkerOnce({ now: () => new Date(Date.now() + 3_600_000) });
  assert.equal(provider.sent.length, before, "not resent");
  assert.deepEqual(await auth.checkResetToken(first), { ok: true });
  assert.deepEqual(await auth.checkResetToken(maybe), { ok: true });
});

test("daily guard: parallel workers stop exactly at the limit; the rest wait for the next UTC day; refusals give the slot back", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  provider.sent.length = 0;
  process.env.EXPLIVIO_EMAIL_DAILY_LIMIT = "3";
  await resetRateLimits(); // today's counter starts at 0 (verifiedUser above used a slot)
  for (let i = 0; i < 5; i++) await enqueueEmail("password_changed", { id: userId, email, name: "Mail User" });
  const day = new Date(); // after queuing (so all 5 are due) and real time (jobs stay younger than 48 h)
  await Promise.all([1, 2, 3].map((w) => runEmailWorkerOnce({ workerId: `q${w}`, now: () => day })));
  assert.equal(provider.sent.length, 3, "never more than the limit");
  assert.equal(await slotsUsed(day), 3);
  const waiting = (await jobsOf(userId)).filter((j) => j.status === "retry_wait");
  assert.equal(waiting.length, 2);
  assert.ok(waiting.every((j) => j.nextAttemptAt.getTime() === nextUtcMidnight(day).getTime() + 60_000 && j.lastErrorCode === "app_daily_limit" && j.attemptCount === 0));

  const nextDay = new Date(nextUtcMidnight(day).getTime() + 120_000);
  provider.script.push({ status: "rejected", code: "validation_error", retryable: false });
  await runEmailWorkerOnce({ now: () => nextDay });
  assert.equal(provider.sent.length, 5, "both waiting jobs tried on the new day");
  assert.equal(await slotsUsed(nextDay), 1, "the refused one gave its slot back");

  // The provider's own daily quota closes the day for the app too.
  await enqueueEmail("password_changed", { id: userId, email, name: "Mail User" });
  provider.script.push({ status: "rejected", code: "daily_quota_exceeded", retryable: false, quota: "daily" });
  await runEmailWorkerOnce({ now: () => nextDay });
  assert.equal(await slotsUsed(nextDay), 3, "day closed at the limit");
  assert.equal((await jobsOf(userId)).at(-1)!.status, "retry_wait");
});

test("daily guard race: 10 simultaneous reservations on a brand-new day with limit 3 → exactly 3 succeed", { skip }, async () => {
  process.env.EXPLIVIO_EMAIL_DAILY_LIMIT = "3";
  const fresh = new Date(Date.UTC(2032, 5, 1, 9)); // a day with no counter yet: every caller races to create it
  const results = await Promise.all(Array.from({ length: 10 }, () => reserveDailySlot(fresh)));
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal(await slotsUsed(fresh), 3);
});

test("verification for an already-verified or disabled account is skipped; jobs older than 48 h fail", { skip }, async () => {
  const { email, userId } = await verifiedUser();
  provider.sent.length = 0;
  await enqueueEmail("verify_email", { id: userId, email, name: "Mail User" });
  await runEmailWorkerOnce();
  assert.equal((await jobsOf(userId)).at(-1)!.lastErrorCode, "already_verified");
  const old = new Date(Date.now() - 49 * 3_600_000);
  await (await getDatabase()).collection<EmailJobDoc>(COLLECTIONS.emailJobs).insertOne({ _id: "ej_old", kind: "password_changed", userId, to: email, name: "X", status: "retry_wait", attemptCount: 1, nextAttemptAt: old, createdAt: old, updatedAt: old });
  await runEmailWorkerOnce();
  assert.equal((await jobsOf(userId)).find((j) => j._id === "ej_old")?.lastErrorCode, "expired");
  assert.equal(provider.sent.length, 0);
});

test("a successful reset queues the password-changed confirmation; logs and jobs never hold tokens or addresses", { skip }, async () => {
  logs.length = 0;
  const { email, userId } = await verifiedUser();
  await auth.requestPasswordReset(email, "10.8.3.1");
  await runEmailWorkerOnce();
  const token = tokenIn(provider.sent.at(-1)!.email.text);
  assert.deepEqual(await auth.resetPassword(token, "Brand-new-pass-5", "10.8.3.1"), { ok: true });
  await runEmailWorkerOnce();
  const confirmation = provider.sent.at(-1)!.email;
  assert.equal(confirmation.subject, "Your Explivio password was changed");
  assert.ok(!/token=/.test(confirmation.text), "no link token in the confirmation");
  const jobsText = JSON.stringify(await jobsOf(userId));
  const tokens = provider.sent.map((s) => tokenIn(s.email.text)).filter(Boolean);
  for (const t of tokens) assert.ok(!jobsText.includes(t), "no token in any job");
  assert.ok(!jobsText.includes(email), "no address left in finished jobs");
  for (const line of logs) {
    assert.ok(!line.includes(email) && !line.includes(email.split("@")[0]), "no address in logs");
    for (const t of tokens) assert.ok(!line.includes(t), "no token in logs");
  }
  assert.ok(logs.some((l) => l.includes('"email_accepted"')) && logs.some((l) => l.includes('"email_queued"')));
});
