import { COLLECTIONS } from "../db/collections.ts";
import { getDatabase } from "../db/mongo.ts";

/*
 * Application-wide daily email guard (F13): at most EXPLIVIO_EMAIL_DAILY_LIMIT (default 90) provider submissions per UTC
 * day, below Resend Free's 100/day (verified 2026-11-05). One counter document per UTC day in rateLimits
 * (_id "emailday:YYYY-MM-DD", deleted by the TTL index after the day ends). A slot is reserved atomically BEFORE
 * sending, so parallel workers can never oversubscribe; it is released only when the provider definitely refused the
 * message. Unknown outcomes keep their slot (conservative).
 */

type DayDoc = { _id: string; count: number; resetAt: Date };

export const dailyLimit = () => Math.max(0, Number(process.env.EXPLIVIO_EMAIL_DAILY_LIMIT) || 90);
const dayKey = (now: Date) => `emailday:${now.toISOString().slice(0, 10)}`;
export const nextUtcMidnight = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

async function days() {
  return (await getDatabase()).collection<DayDoc>(COLLECTIONS.rateLimits);
}

/** Takes one of today's slots, or returns false when the day's limit is reached. */
export async function reserveDailySlot(now = new Date()): Promise<boolean> {
  const limit = dailyLimit();
  if (limit === 0) return false;
  const collection = await days();
  // Only increments while under the limit. At the limit the filter misses and the upsert collides on _id (E11000).
  // E11000 ALSO happens when several workers create the day's counter at the same moment: then the counter exists
  // and may still have room, so look again and retry rather than reporting the day as full.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await collection.findOneAndUpdate({ _id: dayKey(now), count: { $lt: limit } }, { $inc: { count: 1 }, $setOnInsert: { resetAt: nextUtcMidnight(now) } }, { upsert: true, returnDocument: "after" });
      return Boolean(doc && doc.count <= limit);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const current = await collection.findOne({ _id: dayKey(now) });
      if (!current || current.count >= limit) return false;
    }
  }
  return false;
}

/** Gives back a slot after a definite refusal. */
export async function releaseDailySlot(now = new Date()): Promise<void> {
  await (await days()).updateOne({ _id: dayKey(now), count: { $gt: 0 } }, { $inc: { count: -1 } });
}

/** The provider says today's quota is used up: stop for the rest of the UTC day. */
export async function closeDay(now = new Date()): Promise<void> {
  await (await days()).updateOne({ _id: dayKey(now) }, { $max: { count: dailyLimit() }, $setOnInsert: { resetAt: nextUtcMidnight(now) } }, { upsert: true });
}

export async function slotsUsed(now = new Date()): Promise<number> {
  return (await (await days()).findOne({ _id: dayKey(now) }))?.count ?? 0;
}
