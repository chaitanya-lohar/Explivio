import { randomBytes } from "node:crypto";
import { COLLECTIONS, type EmailJobDoc } from "../db/collections.ts";
import { getDatabase } from "../db/mongo.ts";
import { securityEvent } from "../security/log.ts";
import type { EmailKind } from "./types.ts";

/*
 * Durable email queue (F13) in MongoDB (emailJobs). A request only inserts a job and returns; the worker (worker.ts)
 * sends it later, so provider latency never affects response times (F12 enumeration protection) and a restart never
 * loses an email. Jobs hold no tokens: links are created by the worker at send time.
 */

let wake: (() => void) | null = null;
/** The in-process worker registers itself here so a new job is picked up at once rather than at the next poll. */
export function setQueueWakeHook(fn: (() => void) | null): void {
  wake = fn;
}

export async function enqueueEmail(kind: EmailKind, user: { id: string; email: string; name: string }): Promise<string> {
  const db = await getDatabase();
  const now = new Date();
  const id = `ej_${randomBytes(12).toString("hex")}`;
  await db.collection<EmailJobDoc>(COLLECTIONS.emailJobs).insertOne({ _id: id, kind, userId: user.id, to: user.email, name: user.name, status: "pending", attemptCount: 0, nextAttemptAt: now, createdAt: now, updatedAt: now });
  securityEvent("email_queued", { userId: user.id, reason: kind });
  wake?.();
  return id;
}
