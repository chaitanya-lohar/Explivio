import { Sandbox } from "@vercel/sandbox";
import { getVercelOidcToken } from "@vercel/oidc";

/*
 * Sandbox dispatcher (F14 step 3): starts one Vercel Sandbox from the prepared snapshot and launches the render worker
 * in it for a run that is already recorded in MongoDB (status "queued"). It returns as soon as the worker is running,
 * so the calling request (a Vercel function) finishes in seconds; the worker reports progress to MongoDB itself.
 *
 * - One sandbox per video, never persistent (no automatic snapshots), with a hard timeout as a backstop.
 * - The worker stops its own sandbox when it finishes, using a short-lived OIDC token for this Vercel project only.
 * - Only the keys the pipeline needs are passed in (database, R2, Gemini, voice); never auth or email secrets.
 */

export class SandboxConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxConfigError";
  }
}

/** Environment variables the worker needs, by prefix or name. KOKORO_MODEL_DIR is a local path and is not passed. */
const FORWARD = [/^MONGODB_(URI|DB|TIMEOUT_MS)$/, /^R2_[A-Z0-9_]+$/, /^GEMINI_[A-Z0-9_]+$/, /^ELEVENLABS_[A-Z0-9_]+$/, /^KOKORO_(FEMALE|MALE)_(VOICE|SPEED)$/, /^KOKORO_(SPEED|VOICES)$/, /^NARRATION_[A-Z0-9_]+$/, /^RENDER_RESOLUTION$/, /^PIXABAY_API_KEY$/];

export function workerEnv(source: Record<string, string | undefined> = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) if (value && FORWARD.some((re) => re.test(key))) env[key] = value;
  return env;
}

/** Hard limit for one render's sandbox (a 90 s video takes about 3–4 min on 4 vCPU; Hobby allows 45 min). */
const TIMEOUT_MS = 20 * 60_000;

export type DispatchResult = { sandboxId: string };

/** Starts the sandbox and the worker for run `id`. Throws SandboxConfigError when this server isn't set up for it. */
export async function dispatchToSandbox(id: string, source: Record<string, string | undefined> = process.env): Promise<DispatchResult> {
  const snapshotId = source.SANDBOX_SNAPSHOT_ID;
  if (!snapshotId) throw new SandboxConfigError("SANDBOX_SNAPSHOT_ID is not set (run npm run sandbox:snapshot).");
  const env = workerEnv(source);
  for (const required of ["MONGODB_URI", "GEMINI_API_KEY", "R2_BUCKET_NAME"]) if (!env[required]) throw new SandboxConfigError(`${required} is not set, so a cloud render can't run.`);
  const vcpus = Number(source.SANDBOX_VCPUS) || 4;

  const sandbox = await Sandbox.create({ source: { type: "snapshot", snapshotId }, resources: { vcpus }, timeout: TIMEOUT_MS, persistent: false, env, tags: { app: "explivio", run: id.slice(-40) } });
  try {
    // The worker uses this token only to stop its own sandbox when it's done (it expires on its own).
    const token = await getVercelOidcToken();
    await sandbox.runCommand({ cmd: "node", args: ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/render-worker.mts", id], cwd: "app/web", env: { EXPLIVIO_SANDBOX_NAME: sandbox.name, VERCEL_OIDC_TOKEN: token }, detached: true });
  } catch (error) {
    await sandbox.stop().catch(() => {});
    throw error;
  }
  return { sandboxId: sandbox.name };
}

/** Stops a run's sandbox if it is still running (used for stuck runs). Never throws. */
export async function stopSandbox(sandboxId: string): Promise<void> {
  try {
    const sandbox = await Sandbox.get({ name: sandboxId });
    if (sandbox.status === "running") await sandbox.stop();
  } catch {
    // Already gone or not reachable: the timeout stops it anyway.
  }
}
