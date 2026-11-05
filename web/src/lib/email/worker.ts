import { randomBytes } from "node:crypto";
import { COLLECTIONS, type EmailJobDoc, type UserDoc } from "../db/collections.ts";
import { getDatabase } from "../db/mongo.ts";
import { securityEvent } from "../security/log.ts";
import { createPendingEmailToken, settleEmailToken } from "../../services/auth/service.ts";
import { appUrl } from "./config.ts";
import { emailProvider } from "./provider.ts";
import { setQueueWakeHook } from "./queue.ts";
import { closeDay, nextUtcMidnight, releaseDailySlot, reserveDailySlot } from "./quota.ts";
import { renderEmail } from "./templates.ts";
import type { SendResult } from "./types.ts";

/*
 * Email worker (F13). Takes due jobs from emailJobs and sends them through the configured provider.
 *  - Claim: one atomic findOneAndUpdate gives a job to exactly one worker, with a 60 s lease. Jobs whose lease ran out
 *    (worker crashed or restarted) can be claimed again — unless the crash happened after the provider was called
 *    (`submittingAt` set): that outcome is unknown and the job is closed as `unknown`, never resent (no duplicates).
 *  - Link tokens are created here, at send time (createPendingEmailToken): the queue never holds a token.
 *  - Daily guard: a slot is reserved before each submission (quota.ts); a job that finds the day full waits until the
 *    next UTC midnight. Definite refusals give the slot back; unknown outcomes keep it.
 *  - Retries: only definite, temporary refusals (rate limit, connection never opened), backing off 1 min, 5 min,
 *    30 min, 2 h, at most 5 submissions, and never for a job older than 48 h.
 *  - Every state change is written to MongoDB, and only by the worker holding the lease.
 *  - Finished jobs drop the address and name and are deleted after 7 days (TTL).
 * Runs inside the Next.js server (startEmailWorker, from instrumentation.ts) and as `npm run email:worker`.
 */

const LEASE_MS = 60_000;
const MAX_SUBMISSIONS = 5;
const MAX_AGE_MS = 48 * 3_600_000;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000];
const KEEP_MS = 7 * 86_400_000;
const POLL_MS = 5_000;

type Clock = () => Date;
const purposeOf = (kind: EmailJobDoc["kind"]) => (kind === "verify_email" ? "verify_email" : kind === "reset_password" ? "reset_password" : null);

async function jobs() {
  return (await getDatabase()).collection<EmailJobDoc>(COLLECTIONS.emailJobs);
}

/** Atomically takes the next due job (or one whose lease expired). Returns the job as it was before the claim. */
async function claim(workerId: string, now: Date): Promise<EmailJobDoc | null> {
  return (await jobs()).findOneAndUpdate(
    { $or: [{ status: { $in: ["pending", "retry_wait"] }, nextAttemptAt: { $lte: now } }, { status: "processing", leaseExpiresAt: { $lte: now } }] },
    { $set: { status: "processing", leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "before" },
  );
}

/** Writes a state change, only if this worker still holds the lease. */
async function update(job: EmailJobDoc, workerId: string, set: Partial<EmailJobDoc>): Promise<boolean> {
  const result = await (await jobs()).updateOne({ _id: job._id, leaseOwner: workerId }, { $set: { ...set, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

async function finish(job: EmailJobDoc, workerId: string, now: Date, status: "accepted" | "failed" | "unknown" | "skipped", extra: Partial<EmailJobDoc> = {}) {
  await update(job, workerId, { status, completedAt: now, expireAt: new Date(now.getTime() + KEEP_MS), to: null, name: null, submittingAt: null, leaseOwner: null, leaseExpiresAt: null, ...extra });
  const event = status === "accepted" ? "email_accepted" : status === "skipped" ? "email_skipped" : status === "unknown" ? "email_unknown" : "email_rejected";
  securityEvent(event, { userId: job.userId, reason: extra.lastErrorCode ?? job.kind });
}

async function waitUntil(job: EmailJobDoc, workerId: string, when: Date, code: string) {
  await update(job, workerId, { status: "retry_wait", nextAttemptAt: when, submittingAt: null, leaseOwner: null, leaseExpiresAt: null, lastErrorCode: code });
  securityEvent("email_deferred", { userId: job.userId, reason: code });
}

async function handle(job: EmailJobDoc, workerId: string, now: Date): Promise<void> {
  if (job.status === "processing" && job.submittingAt) return finish(job, workerId, now, "unknown", { lastErrorCode: "interrupted_after_submit" });
  if (now.getTime() - job.createdAt.getTime() > MAX_AGE_MS) return finish(job, workerId, now, "failed", { lastErrorCode: "expired" });
  if (!job.to || !job.name) return finish(job, workerId, now, "failed", { lastErrorCode: "missing_recipient" });

  const user = await (await getDatabase()).collection<UserDoc>(COLLECTIONS.users).findOne({ _id: job.userId }, { projection: { status: 1, emailVerified: 1 } });
  if (!user || user.status !== "active") return finish(job, workerId, now, "skipped", { lastErrorCode: "account_inactive" });
  if (job.kind === "verify_email" && user.emailVerified) return finish(job, workerId, now, "skipped", { lastErrorCode: "already_verified" });

  if (!(await reserveDailySlot(now))) return waitUntil(job, workerId, new Date(nextUtcMidnight(now).getTime() + 60_000), "app_daily_limit");

  const purpose = purposeOf(job.kind);
  const pending = purpose ? await createPendingEmailToken(job.userId, purpose) : null;
  const base = appUrl();
  const link = purpose === "verify_email" ? `${base}/verify-email?token=${pending!.token}` : purpose === "reset_password" ? `${base}/reset-password?token=${pending!.token}` : undefined;
  const rendered = renderEmail(job.kind, { name: job.name, link, appUrl: base });

  const submission = job.attemptCount + 1;
  if (!(await update(job, workerId, { submittingAt: now, attemptCount: submission, lastAttemptAt: now }))) {
    // Lost the lease before sending: give everything back, another worker owns the job now.
    if (pending) await settleEmailToken(job.userId, purpose!, pending.hash, "rejected");
    await releaseDailySlot(now);
    return;
  }

  let result: SendResult;
  try {
    result = await emailProvider().send({ to: job.to, ...rendered }, `${job._id}:${submission}`);
  } catch {
    result = { status: "unknown", code: "provider_exception" };
  }

  if (result.status === "accepted") {
    if (pending) await settleEmailToken(job.userId, purpose!, pending.hash, "accepted");
    return finish(job, workerId, now, "accepted", { providerMessageId: result.messageId ?? null, acceptedAt: new Date(), lastErrorCode: null });
  }
  if (result.status === "unknown") {
    if (pending) await settleEmailToken(job.userId, purpose!, pending.hash, "unknown");
    return finish(job, workerId, now, "unknown", { lastErrorCode: result.code });
  }
  // Definitely refused: the never-delivered link is deleted (older links keep working) and the slot is returned.
  if (pending) await settleEmailToken(job.userId, purpose!, pending.hash, "rejected");
  await releaseDailySlot(now);
  if (result.quota === "daily") {
    await closeDay(now);
    return waitUntil(job, workerId, new Date(nextUtcMidnight(now).getTime() + 60_000), result.code);
  }
  if (result.retryable && submission < MAX_SUBMISSIONS) {
    const delay = Math.max(BACKOFF_MS[submission - 1] ?? BACKOFF_MS.at(-1)!, result.retryAfterMs ?? 0);
    return waitUntil(job, workerId, new Date(now.getTime() + delay), result.code);
  }
  return finish(job, workerId, now, "failed", { lastErrorCode: result.code });
}

/** Processes due jobs until none are left (or `max` were handled). Safe to run in several processes at once. */
export async function runEmailWorkerOnce(options: { max?: number; now?: Clock; workerId?: string } = {}): Promise<number> {
  const workerId = options.workerId ?? `w_${randomBytes(6).toString("hex")}`;
  const clock = options.now ?? (() => new Date());
  let handled = 0;
  for (; handled < (options.max ?? 50); handled++) {
    const now = clock();
    const job = await claim(workerId, now);
    if (!job) break;
    await handle(job, workerId, now);
  }
  return handled;
}

const holder = globalThis as typeof globalThis & { __explivioEmailWorker?: { timer: ReturnType<typeof setInterval>; running: boolean } };

/** Starts the in-process worker once per server process: polls every 5 s and runs at once when a job is queued. */
export function startEmailWorker(): void {
  if (holder.__explivioEmailWorker) return;
  const state = { timer: undefined as unknown as ReturnType<typeof setInterval>, running: false };
  let warned = false;
  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runEmailWorkerOnce();
      warned = false;
    } catch (error) {
      if (!warned) console.warn(`[email] worker pass failed (${error instanceof Error ? error.name : "Error"}); retrying`);
      warned = true;
    } finally {
      state.running = false;
    }
  };
  state.timer = setInterval(() => void tick(), POLL_MS);
  state.timer.unref?.();
  holder.__explivioEmailWorker = state;
  setQueueWakeHook(() => void setImmediate(() => void tick()));
  void tick();
}

export function stopEmailWorker(): void {
  const state = holder.__explivioEmailWorker;
  if (state) clearInterval(state.timer);
  holder.__explivioEmailWorker = undefined;
  setQueueWakeHook(null);
}
