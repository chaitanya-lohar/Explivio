// Gives the videos made before accounts existed to the account named by EXPLIVIO_LEGACY_OWNER_EMAIL.
// DRY RUN by default (prints what would happen, changes nothing). Apply only after review: npm run db:legacy-ownership -- --apply
// Never moves, renames or deletes files in runs/; never reassigns a project that already has a record.
import { COLLECTIONS, type UserDoc, type VideoProjectDoc } from "../src/lib/db/collections.ts";
import { legacyProjectDoc, planLegacyOwnership, type LegacyRun } from "../src/lib/db/legacy-ownership.ts";
import { readMongoConfig } from "../src/lib/db/config.ts";
import { closeDatabase, getDatabase, safeReason } from "../src/lib/db/mongo.ts";
import { listAllRunsForMigration } from "../src/services/pipeline/videos.ts";

const apply = process.argv.includes("--apply");
const email = process.env.EXPLIVIO_LEGACY_OWNER_EMAIL?.trim().toLowerCase() || undefined;
try {
  const runs: LegacyRun[] = listAllRunsForMigration().map((v) => ({ id: v.id, title: v.title, prompt: v.prompt, durationSeconds: v.durationSeconds, status: v.status === "draft" ? "failed" : v.status, createdAt: v.createdAt, requestOwnerUserId: v.requestOwnerUserId }));
  if (!readMongoConfig().ok) {
    // Still useful before Atlas is set up: how many videos the migration would cover.
    console.log(`DRY RUN: legacy video ownership\n  runs on disk without an owner: ${runs.filter((r) => !r.requestOwnerUserId).length}\n  account lookup and the plan need MONGODB_URI (web/.env.local). Nothing changed.`);
    process.exit(0);
  }
  const db = await getDatabase();
  const recorded = new Set((await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).find({ _id: { $in: runs.map((r) => r.id) } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
  const user = email ? await db.collection<UserDoc>(COLLECTIONS.users).findOne({ emailNormalized: email }) : null;
  const plan = planLegacyOwnership(runs, recorded, email, user ? { id: user._id, emailVerified: user.emailVerified, status: user.status } : null);
  console.log(`${apply ? "APPLY" : "DRY RUN"}: legacy video ownership`);
  console.log(`  configured account: ${plan.configuredEmail ? "set" : "NOT SET (EXPLIVIO_LEGACY_OWNER_EMAIL)"}; account state: ${plan.owner}`);
  console.log(`  runs on disk: ${plan.runsOnDisk}; already recorded (left untouched): ${plan.alreadyRecorded}; owned by newer accounts: ${plan.ownedByNewerAccounts}`);
  console.log(`  would assign: ${plan.toAssign.length}`);
  if (!apply) console.log(plan.canApply ? "  Nothing changed. Re-run with --apply to write these records." : "  Nothing changed. Cannot apply until the account exists, is active and is verified.");
  else if (!plan.canApply) { console.log("  Refusing to apply (see account state above). Nothing changed."); process.exitCode = 1; }
  else {
    const now = new Date();
    const projects = db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects);
    let inserted = 0;
    for (const run of runs.filter((r) => plan.toAssign.includes(r.id))) {
      // Insert-only: an existing record (any owner) is never modified, so re-running is safe.
      const result = await projects.updateOne({ _id: run.id }, { $setOnInsert: legacyProjectDoc(run, user!._id, now) }, { upsert: true });
      inserted += result.upsertedCount;
    }
    console.log(`  inserted ${inserted} record(s); files in runs/ were not touched.`);
  }
} catch (error) {
  console.error(`db:legacy-ownership failed: ${error instanceof Error && error.name === "DatabaseConfigError" ? error.message : safeReason(error)}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
