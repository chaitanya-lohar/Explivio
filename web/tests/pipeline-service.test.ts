import { test, before } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Integration tests for the REAL pipeline video service (services/pipeline/videos.ts): spawning, run ids, status
 * mapping, failures, retry, duplicate prevention. The CLI it spawns is replaced by tests/fixtures/stub-cli.mjs in a
 * temporary pipeline root, so no Gemini or ElevenLabs request is ever made.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "explivio-f9-"));
mkdirSync(path.join(root, "node_modules", "tsx", "dist"), { recursive: true });
cpSync(path.join(here, "fixtures", "stub-cli.mjs"), path.join(root, "node_modules", "tsx", "dist", "cli.mjs"));
mkdirSync(path.join(root, "runs"));
process.env.EXPLIVIO_PIPELINE_ROOT = root;
process.env.STUB_STEP_MS = "150";
process.env.STUB_SAMPLE_MP4 = path.join(here, "fixtures", "tiny.mp4");

type Service = typeof import("../src/services/pipeline/videos.ts");
let service: Service;
before(async () => {
  service = await import("../src/services/pipeline/videos.ts");
});

const request = (prompt: string) => ({ prompt, durationSeconds: 30 as const, voice: "male" as const, captions: false, music: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(id: string, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const video = await service.getVideo(id);
    if (video && video.status !== "generating") return video;
    if (Date.now() > end) throw new Error(`still generating: ${id}`);
    await sleep(100);
  }
}
const calls = () => (existsSync(path.join(root, "stub-calls.log")) ? readFileSync(path.join(root, "stub-calls.log"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

test("two simultaneous requests start exactly one run (the other gets the busy message)", async () => {
  const results = await Promise.allSettled([service.createVideo(request("Explain tides [ok]")), service.createVideo(request("Explain tides again [ok]"))]);
  const started = results.filter((r) => r.status === "fulfilled");
  const busy = results.filter((r) => r.status === "rejected" && (r.reason as Error).name === "PipelineBusyError");
  assert.equal(started.length, 1, `started ${started.length}`);
  assert.equal(busy.length, 1);
  await settle((started[0] as PromiseFulfilledResult<{ id: string }>).value.id);
});

test("success: the request reaches the CLI unchanged, stages advance, the video becomes ready with a file", async () => {
  const video = await service.createVideo(request("Explain volcanoes [ok]"));
  assert.equal(video.status, "generating");
  assert.match(video.id, /^[A-Za-z0-9_-]+$/);
  // The spawned process logs its arguments as it starts, slightly after createVideo returns.
  let call: { runId: string; args: string[] } | undefined;
  for (let i = 0; i < 50 && !call; i++, await sleep(100)) call = calls().find((c) => c.runId === video.id);
  assert.ok(call, "stub CLI was spawned with the web-chosen run id");
  assert.deepEqual(call.args.filter((a: string) => !a.startsWith("--prompt-file")), ["--duration", "30", "--voice=male", `--run-id=${video.id}`, "--no-captions", "--music"]);
  const done = await settle(video.id);
  assert.equal(done.status, "ready");
  assert.equal(done.videoUrl, `/api/videos/${video.id}/file`);
  assert.equal(done.actualDurationSeconds, 31);
  assert.ok(service.getVideoFilePath(video.id));
});

test("a render failure is a failed video (never ready), with a detail that hides paths and keys", async () => {
  const video = await service.createVideo(request("Explain glaciers [fail-render]"));
  const done = await settle(video.id);
  assert.equal(done.status, "failed");
  assert.equal(done.failedStage, "render");
  assert.equal(done.videoUrl, undefined);
  assert.equal(service.getVideoFilePath(video.id), null, "no file is served for a failed run");
  assert.doesNotMatch(done.errorDetail ?? "", /Secret Folder|AIza|exithandler|node_modules/);
  assert.match(done.errorDetail ?? "", /\[path\]/);
});

test("quota errors from Gemini and ElevenLabs fail at the right stage with a readable reason", async () => {
  const gemini = await settle((await service.createVideo(request("Explain rainbows [quota-gemini]"))).id);
  assert.equal(gemini.failedStage, "plan");
  assert.match(gemini.errorDetail ?? "", /quota or rate limit \(429\)/);
  const eleven = await settle((await service.createVideo(request("Explain rainbows [quota-elevenlabs]"))).id);
  assert.equal(eleven.failedStage, "narration");
  assert.match(eleven.errorDetail ?? "", /quota/);
});

test("finished without an output file, or a crashed process, is failed rather than ready", async () => {
  const missing = await settle((await service.createVideo(request("Explain clouds [missing-output]"))).id);
  assert.equal(missing.status, "failed");
  assert.match(missing.errorDetail ?? "", /video file is missing/);
  const crash = await settle((await service.createVideo(request("Explain clouds [crash]"))).id);
  assert.equal(crash.status, "failed");
  assert.match(crash.errorDetail ?? "", /exited unexpectedly \(code 3\)/);
});

test("retry starts a new run with the same saved settings; ready videos can't be retried", async () => {
  const failed = await settle((await service.createVideo(request("Explain comets [fail-render]"))).id);
  const retried = await service.retryVideo(failed.id);
  assert.ok(retried && retried.id !== failed.id);
  assert.deepEqual(retried.request, failed.request);
  await settle(retried.id);
  const ok = await settle((await service.createVideo(request("Explain comets [ok]"))).id);
  assert.equal(await service.retryVideo(ok.id), null);
});

test("a run whose process vanished long ago is reported as failed, not stuck generating", async () => {
  const id = "2026-01-01T00-00-00-000Z-stale000";
  const dir = path.join(root, "runs", id);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ prompt: "Old run", targetDurationSeconds: 60, status: "running", startedAt: "2026-01-01T00:00:00.000Z", stages: { storyboard: { status: "succeeded" }, narration: { status: "running" } } }));
  const old = new Date("2026-01-01T00:00:00Z");
  utimesSync(path.join(dir, "manifest.json"), old, old);
  const video = await service.getVideo(id);
  assert.equal(video?.status, "failed");
  assert.equal(video?.failedStage, "narration");
});

test("invalid or path-like ids are rejected without touching the filesystem outside runs/", async () => {
  for (const id of ["../package.json", "..", "a/b", "C:\\Windows", "", "x".repeat(81), "%2e%2e"]) {
    assert.equal(await service.getVideo(id), null, id);
    assert.equal(service.getVideoFilePath(id), null, id);
  }
});

test("the library lists every run once, newest first, and never lists a failed run as ready", async () => {
  const videos = await service.listVideos();
  const ids = videos.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.equal(ids.length, readdirSync(path.join(root, "runs")).length);
  assert.ok(videos.every((v, i) => i === 0 || videos[i - 1].createdAt >= v.createdAt));
  assert.ok(videos.filter((v) => v.status === "ready").every((v) => service.getVideoFilePath(v.id)));
});

test("real-world error messages: paths with spaces, node.exe and POSIX paths are fully hidden", async () => {
  const dir = path.join(root, "runs", "2026-01-02T00-00-00-000Z-errpath0");
  mkdirSync(dir);
  const error = String.raw`Command failed: C:\Program Files\nodejs\node.exe D:\Namaste AI\Project 2\Explivio\node_modules\@remotion\cli\remotion-cli.js render src/video/index.tsx /home/me/My Projects/explivio/runs/x/video.mp4 --log=error`;
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ prompt: "p", targetDurationSeconds: 30, status: "failed", startedAt: "2026-01-02T00:00:00.000Z", stages: { render: { status: "failed", error } }, error }));
  const video = await service.getVideo("2026-01-02T00-00-00-000Z-errpath0");
  assert.doesNotMatch(video?.errorDetail ?? "", /Program|nodejs|Namaste|Project 2|node_modules|remotion-cli|My Projects|explivio\/runs/, video?.errorDetail);
  // Adjacent paths may merge into one "[path]" (over-redaction is fine); the readable words stay.
  assert.match(video?.errorDetail ?? "", /^Command failed: \[path\].* render .*--log=error$/);
});
