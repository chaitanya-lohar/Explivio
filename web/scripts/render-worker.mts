// Cloud render worker (F14 step 3). Runs INSIDE the Vercel Sandbox, started by the sandbox dispatcher:
//   node scripts/render-worker.mts <runId>        (cwd: app/web; the keys arrive as sandbox environment variables)
// Loads the job (prompt and settings) from MongoDB, runs the pipeline through the same executor as local renders
// (progress and heartbeat → MongoDB, MP4 → R2), then exits. The sandbox is stopped by the dispatcher afterwards.
// Prints no secrets and no prompt text.
import path from "node:path";
import { closeDatabase } from "../src/lib/db/mongo.ts";
import { ownership } from "../src/services/pipeline/ownership.ts";
import { executeRun } from "../src/services/pipeline/run-executor.ts";
import { stopSandbox } from "../src/services/pipeline/sandbox-dispatch.ts";

const id = process.argv[2] ?? "";
if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
  console.error("Usage: node scripts/render-worker.mts <runId>");
  process.exit(2);
}

let code = 1;
try {
  const record = (await ownership().runsOf([id])).get(id);
  if (!record?.request) {
    console.error(`run ${id}: no job in the database`);
    if (record) await ownership().recordProgress(id, { status: "failed", stage: "plan", safeError: "The video's settings were missing, so it couldn't be created." });
  } else {
    const resolution = process.env.RENDER_RESOLUTION === "720p" ? "720p" : "1080p";
    const pipelineRoot = path.resolve(process.env.EXPLIVIO_PIPELINE_ROOT ?? "..");
    console.log(`run ${id}: rendering ${record.durationSeconds}s at ${resolution}`);
    const { done } = await executeRun({ id, pipelineRoot, storage: record.storage, resolution, request: { prompt: record.prompt, durationSeconds: record.durationSeconds, ...record.request } });
    const final = await done;
    const storage = (await ownership().storageOf([id])).get(id);
    console.log(`run ${id}: ${final.status}${final.safeError ? ` (${final.safeError})` : ""}; storage ${storage?.kind === "r2" ? storage.uploadStatus : storage?.kind}`);
    code = final.status === "succeeded" && (storage?.kind !== "r2" || storage.uploadStatus === "uploaded") ? 0 : 1;
  }
} catch (error) {
  console.error(`run ${id}: worker error: ${error instanceof Error ? error.message : String(error)}`);
  await ownership().recordProgress(id, { status: "failed", stage: "plan", safeError: "The cloud renderer stopped unexpectedly." }).catch(() => {});
} finally {
  await closeDatabase().catch(() => {});
}
// In the cloud: stop this sandbox now instead of idling until its timeout (this ends the worker too).
const sandboxName = process.env.EXPLIVIO_SANDBOX_NAME;
if (sandboxName) {
  console.log(`run ${id}: stopping sandbox`);
  await stopSandbox(sandboxName);
}
process.exit(code);
