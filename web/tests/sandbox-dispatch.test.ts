import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { memoryOwnership, setOwnershipStore } from "../src/services/pipeline/ownership.ts";
import { memoryStore } from "../src/lib/storage/memory.ts";
import { setObjectStore } from "../src/lib/storage/index.ts";
import { workerEnv, dispatchToSandbox, SandboxConfigError } from "../src/services/pipeline/sandbox-dispatch.ts";

/*
 * F14 step 3: the sandbox dispatcher, without starting a sandbox (no network). Checks which keys reach the worker,
 * that a server that isn't set up refuses before creating anything, and how videos.ts records a failed cloud start.
 */

const root = mkdtempSync(path.join(tmpdir(), "explivio-sbx-"));
process.env.EXPLIVIO_PIPELINE_ROOT = root;
process.env.EXPLIVIO_DAILY_GENERATIONS = "1000";
const owners = memoryOwnership();
type Service = typeof import("../src/services/pipeline/videos.ts");
let service: Service;
before(async () => {
  setOwnershipStore(owners);
  service = await import("../src/services/pipeline/videos.ts");
});
const A = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const request = { prompt: "Explain tides", durationSeconds: 30 as const, voice: "female" as const, captions: true, music: false };

test("only the pipeline's keys are forwarded to the sandbox (never auth, email or Vercel secrets)", () => {
  const env = workerEnv({
    MONGODB_URI: "m", MONGODB_DB: "d", R2_ACCOUNT_ID: "a", R2_SECRET_ACCESS_KEY: "s", GEMINI_API_KEY: "g", ELEVENLABS_API_KEY: "e", NARRATION_PROVIDER: "kokoro", KOKORO_MALE_SPEED: "1.13", RENDER_RESOLUTION: "720p", PIXABAY_API_KEY: "p",
    AUTH_SECRET: "x", RESEND_API_KEY: "x", EMAIL_FROM: "x", VERCEL_OIDC_TOKEN: "x", KOKORO_MODEL_DIR: "C:/models", MONGODB_URI_TEST: "x", PATH: "x", SANDBOX_SNAPSHOT_ID: "x", EMPTY_OK: "",
  });
  assert.deepEqual(Object.keys(env).sort(), ["ELEVENLABS_API_KEY", "GEMINI_API_KEY", "KOKORO_MALE_SPEED", "MONGODB_DB", "MONGODB_URI", "NARRATION_PROVIDER", "PIXABAY_API_KEY", "R2_ACCOUNT_ID", "R2_SECRET_ACCESS_KEY", "RENDER_RESOLUTION"]);
});

test("a server without a snapshot or keys refuses before creating a sandbox", async () => {
  await assert.rejects(dispatchToSandbox("run1", {}), (e: Error) => e instanceof SandboxConfigError && /SANDBOX_SNAPSHOT_ID/.test(e.message));
  await assert.rejects(dispatchToSandbox("run1", { SANDBOX_SNAPSHOT_ID: "snap_x", MONGODB_URI: "m", R2_BUCKET_NAME: "b" }), (e: Error) => e instanceof SandboxConfigError && /GEMINI_API_KEY/.test(e.message));
});

test("sandbox mode: without R2 nothing is recorded; a failed start is recorded as failed and doesn't block the next video", async () => {
  process.env.RENDER_DISPATCH = "sandbox";
  delete process.env.SANDBOX_SNAPSHOT_ID;
  try {
    setObjectStore(null);
    await assert.rejects(service.createVideo(request, A), /needs Cloudflare R2/);
    assert.equal(owners.projects.size, 0);

    setObjectStore(memoryStore());
    await assert.rejects(service.createVideo(request, A), /cloud renderer couldn't be started/);
    assert.equal(owners.projects.size, 1);
    const [id] = owners.projects.keys();
    const video = await service.getVideo(id, A);
    assert.equal(video?.status, "failed");
    assert.match(video?.errorDetail ?? "", /cloud renderer couldn't be started/);
    assert.equal(owners.projects.get(id)?.storage.kind, "r2");
    assert.equal(readdirSync(root).length, 0, "nothing is written to this server's disk");
    assert.equal(await owners.hasActiveRun(new Date(Date.now() - 60_000)), false, "the failed start isn't an active run");
    await assert.rejects(service.createVideo(request, A), /cloud renderer couldn't be started/, "the next request is not 'busy'");
  } finally {
    delete process.env.RENDER_DISPATCH;
    setObjectStore(undefined);
  }
});
