import { test } from "node:test";
import assert from "node:assert/strict";

/*
 * F11 live MongoDB check of the storage metadata (needs MONGODB_URI_TEST; uses a throwaway database it drops).
 * Proves against the real server that: the videoProjects validator accepts the R2 storage shape and the existing
 * local shape side by side; the conditional "claim" update can't be taken twice; usage totals add up; and an old
 * local record is never changed by R2 updates.
 */

const live = process.env.MONGODB_URI_TEST;

test("live Atlas: R2 storage metadata, conditional claim and usage totals (needs MONGODB_URI_TEST)", { skip: !live && "MONGODB_URI_TEST not set: no live cluster configured", timeout: 60_000 }, async () => {
  process.env.MONGODB_URI = live;
  process.env.MONGODB_DB = `explivio_test_f11_${process.pid}`;
  const { getDatabase, closeDatabase } = await import("../src/lib/db/mongo.ts");
  const { ensureSchema, COLLECTIONS } = await import("../src/lib/db/collections.ts");
  const { mongoOwnership } = await import("../src/services/pipeline/ownership.ts");
  const db = await getDatabase();
  const owner = `usr_${"1".repeat(32)}`;
  try {
    await ensureSchema(db);
    const now = new Date().toISOString();
    await mongoOwnership.record({ id: "local1", ownerUserId: owner, title: "t", prompt: "p", durationSeconds: 30, createdAt: now });
    await mongoOwnership.record({ id: "cloud1", ownerUserId: owner, title: "t", prompt: "p", durationSeconds: 30, createdAt: now, storage: { kind: "r2", runId: "cloud1", key: `users/${owner}/videos/cloud1/video.mp4`, uploadStatus: "pending", attempts: 0 } });

    const storages = await mongoOwnership.storageOf(["local1", "cloud1", "missing"]);
    assert.deepEqual(storages.get("local1"), { kind: "local-run", runId: "local1" });
    assert.equal(storages.get("cloud1")?.kind, "r2");
    assert.equal(storages.has("missing"), false);

    // Claim: only one of two concurrent claims from "pending" wins.
    const claims = await Promise.all([1, 2].map(() => mongoOwnership.updateR2Storage("cloud1", { uploadStatus: "uploading", attempts: 1, lastAttemptAt: new Date() }, ["pending"])));
    assert.deepEqual(claims.sort(), [false, true]);
    assert.equal(await mongoOwnership.updateR2Storage("local1", { uploadStatus: "uploaded" }), false, "a local record is never turned into a cloud one");
    assert.deepEqual((await mongoOwnership.storageOf(["local1"])).get("local1"), { kind: "local-run", runId: "local1" });

    await mongoOwnership.updateR2Storage("cloud1", { uploadStatus: "uploaded", size: 4831, md5: "d41d8cd98f00b204e9800998ecf8427e", contentType: "video/mp4", uploadedAt: new Date(), lastError: null });
    const stored = (await mongoOwnership.storageOf(["cloud1"])).get("cloud1");
    assert.ok(stored?.kind === "r2" && stored.uploadStatus === "uploaded" && stored.size === 4831 && stored.key.endsWith("/cloud1/video.mp4"));
    assert.deepEqual(await mongoOwnership.storageUsage(), { storedBytes: 4831, uploadsThisMonth: 1 });

    // The validator still requires an owner and storage on every record.
    await assert.rejects(db.collection(COLLECTIONS.videoProjects).insertOne({ _id: "bad", ownerUserId: owner, status: "ready", createdAt: new Date() } as never), /validation/i);
  } finally {
    await db.dropDatabase();
    await closeDatabase();
  }
});
