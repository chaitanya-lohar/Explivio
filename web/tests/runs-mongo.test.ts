import { test } from "node:test";
import assert from "node:assert/strict";

/*
 * F14 live MongoDB check of run progress (needs MONGODB_URI_TEST; throwaway database explivio_test_runs_<pid>, dropped).
 * Proves the real store: request settings are saved; a dispatched run is active from the first moment; progress is
 * recorded and read back (title, stage, safe error, heartbeat); untracked runs have no progress; stale runs don't count.
 */

const live = process.env.MONGODB_URI_TEST;

test("live Atlas: run progress and request settings round-trip; active-run detection uses the heartbeat", { skip: !live && "MONGODB_URI_TEST not set: no live cluster configured", timeout: 60_000 }, async () => {
  process.env.MONGODB_URI = live;
  process.env.MONGODB_DB = `explivio_test_runs_${process.pid}`;
  const { getDatabase, closeDatabase } = await import("../src/lib/db/mongo.ts");
  const { ensureSchema, COLLECTIONS } = await import("../src/lib/db/collections.ts");
  const { mongoOwnership } = await import("../src/services/pipeline/ownership.ts");
  const db = await getDatabase();
  const owner = `usr_${"2".repeat(32)}`;
  try {
    await ensureSchema(db);
    const now = new Date().toISOString();
    await mongoOwnership.record({ id: "run1", ownerUserId: owner, title: "Prompt title", prompt: "Explain tides", durationSeconds: 60, createdAt: now, request: { voice: "male", captions: false, music: true }, dispatch: "sandbox" });
    await mongoOwnership.record({ id: "hand1", ownerUserId: owner, title: "Hand made", prompt: "p", durationSeconds: 30, createdAt: now });

    assert.equal(await mongoOwnership.hasActiveRun(new Date(Date.now() - 60_000)), true, "a dispatched run is active at once");
    let records = await mongoOwnership.runsOf(["run1", "hand1", "missing"]);
    assert.deepEqual(records.get("run1")?.request, { voice: "male", captions: false, music: true });
    assert.equal(records.get("run1")?.progress, undefined, "no progress until the supervisor reports");
    assert.equal(records.has("missing"), false);

    await mongoOwnership.recordProgress("run1", { status: "running", stage: "narration", safeError: null, title: "How Tides Work" });
    records = await mongoOwnership.runsOf(["run1"]);
    const p = records.get("run1")!.progress!;
    assert.equal(p.status, "running");
    assert.equal(p.stage, "narration");
    assert.equal(p.title, "How Tides Work");
    assert.ok(Date.now() - Date.parse(p.heartbeatAt) < 30_000 && p.startedAt);
    assert.equal((await db.collection(COLLECTIONS.videoProjects).findOne({ _id: "run1" as never }))?.title, "How Tides Work", "title mirrored to the project");

    await mongoOwnership.recordProgress("run1", { status: "failed", stage: "render", safeError: "Rendering failed.", actualDurationSeconds: null });
    const failed = (await mongoOwnership.runsOf(["run1"])).get("run1")!.progress!;
    assert.equal(failed.status, "failed");
    assert.equal(failed.safeError, "Rendering failed.");
    assert.equal(failed.title, "How Tides Work", "an earlier title is kept");
    assert.equal(await mongoOwnership.hasActiveRun(new Date(Date.now() - 60_000)), false, "a finished run is not active");

    await mongoOwnership.record({ id: "old1", ownerUserId: owner, title: "Old", prompt: "p", durationSeconds: 30, createdAt: now, dispatch: "local" });
    await db.collection(COLLECTIONS.generationAttempts).updateOne({ _id: "old1" as never }, { $set: { heartbeatAt: new Date(Date.now() - 20 * 60_000) } });
    assert.equal(await mongoOwnership.hasActiveRun(new Date(Date.now() - 15 * 60_000)), false, "a run silent for 20 minutes doesn't block new ones");
  } finally {
    await db.dropDatabase();
    await closeDatabase();
  }
});
