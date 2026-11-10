import { test, before } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { memoryOwnership, setOwnershipStore } from "../src/services/pipeline/ownership.ts";
import { memoryStore, type MemoryStore } from "../src/lib/storage/memory.ts";
import { setObjectStore } from "../src/lib/storage/index.ts";
import { startUpload } from "../src/services/pipeline/cloud-upload.ts";

/*
 * Integration tests for the REAL pipeline video service (services/pipeline/videos.ts): spawning, run ids, status
 * mapping, failures, retry, duplicate prevention. The CLI it spawns is replaced by tests/fixtures/stub-cli.mjs in a
 * temporary pipeline root, so no Gemini or ElevenLabs request is ever made. Ownership (F10) uses the in-memory store
 * instead of MongoDB; two users (A and B) check that nobody can see or touch another user's videos.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "explivio-f9-"));
mkdirSync(path.join(root, "node_modules", "tsx", "dist"), { recursive: true });
cpSync(path.join(here, "fixtures", "stub-cli.mjs"), path.join(root, "node_modules", "tsx", "dist", "cli.mjs"));
mkdirSync(path.join(root, "runs"));
process.env.EXPLIVIO_PIPELINE_ROOT = root;
process.env.STUB_STEP_MS = "150";
process.env.STUB_SAMPLE_MP4 = path.join(here, "fixtures", "tiny.mp4");
// These tests start many videos as one user; the F12 per-user daily limit is exercised by its own test below.
process.env.EXPLIVIO_DAILY_GENERATIONS = "1000";

type Service = typeof import("../src/services/pipeline/videos.ts");
let service: Service;
const A = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const owners = memoryOwnership();
before(async () => {
  setOwnershipStore(owners);
  service = await import("../src/services/pipeline/videos.ts");
});
/** Runs created by hand in these tests belong to user A. */
const own = (id: string, owner = A) => owners.record({ id, ownerUserId: owner, title: id, prompt: "p", durationSeconds: 30, createdAt: new Date().toISOString() });

const request = (prompt: string) => ({ prompt, durationSeconds: 30 as const, voice: "male" as const, captions: false, music: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(id: string, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const video = (await service.getVideo(id, A)) ?? (await service.getVideo(id, B));
    if (video && video.status !== "generating") return video;
    if (Date.now() > end) throw new Error(`still generating: ${id}`);
    await sleep(100);
  }
}
const calls = () => (existsSync(path.join(root, "stub-calls.log")) ? readFileSync(path.join(root, "stub-calls.log"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

test("two simultaneous requests start exactly one run (the other gets the busy message)", async () => {
  const results = await Promise.allSettled([service.createVideo(request("Explain tides [ok]"), A), service.createVideo(request("Explain tides again [ok]"), A)]);
  const started = results.filter((r) => r.status === "fulfilled");
  const busy = results.filter((r) => r.status === "rejected" && (r.reason as Error).name === "PipelineBusyError");
  assert.equal(started.length, 1, `started ${started.length}`);
  assert.equal(busy.length, 1);
  await settle((started[0] as PromiseFulfilledResult<{ id: string }>).value.id);
});

test("success: the request reaches the CLI unchanged, stages advance, the video becomes ready with a file", async () => {
  const video = await service.createVideo(request("Explain volcanoes [ok]"), A);
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
  assert.ok((await service.getVideoFilePath(video.id, A)));
});

test("a render failure is a failed video (never ready), with a detail that hides paths and keys", async () => {
  const video = await service.createVideo(request("Explain glaciers [fail-render]"), A);
  const done = await settle(video.id);
  assert.equal(done.status, "failed");
  assert.equal(done.failedStage, "render");
  assert.equal(done.videoUrl, undefined);
  assert.equal((await service.getVideoFilePath(video.id, A)), null, "no file is served for a failed run");
  assert.doesNotMatch(done.errorDetail ?? "", /Secret Folder|AIza|exithandler|node_modules/);
  assert.match(done.errorDetail ?? "", /\[path\]/);
});

test("quota errors from Gemini and ElevenLabs fail at the right stage with a readable reason", async () => {
  const gemini = await settle((await service.createVideo(request("Explain rainbows [quota-gemini]"), A)).id);
  assert.equal(gemini.failedStage, "plan");
  assert.match(gemini.errorDetail ?? "", /quota or rate limit \(429\)/);
  const eleven = await settle((await service.createVideo(request("Explain rainbows [quota-elevenlabs]"), A)).id);
  assert.equal(eleven.failedStage, "narration");
  assert.match(eleven.errorDetail ?? "", /quota/);
});

test("finished without an output file, or a crashed process, is failed rather than ready", async () => {
  const missing = await settle((await service.createVideo(request("Explain clouds [missing-output]"), A)).id);
  assert.equal(missing.status, "failed");
  assert.match(missing.errorDetail ?? "", /video file is missing/);
  const crash = await settle((await service.createVideo(request("Explain clouds [crash]"), A)).id);
  assert.equal(crash.status, "failed");
  assert.match(crash.errorDetail ?? "", /exited unexpectedly \(code 3\)/);
});

test("retry starts a new run with the same saved settings; ready videos can't be retried", async () => {
  const failed = await settle((await service.createVideo(request("Explain comets [fail-render]"), A)).id);
  const retried = await service.retryVideo(failed.id, A);
  assert.ok(retried && retried.id !== failed.id);
  assert.deepEqual(retried.request, failed.request);
  await settle(retried.id);
  const ok = await settle((await service.createVideo(request("Explain comets [ok]"), A)).id);
  assert.equal(await service.retryVideo(ok.id, A), null);
});

test("a run whose process vanished long ago is reported as failed, not stuck generating", async () => {
  const id = "2026-01-01T00-00-00-000Z-stale000";
  const dir = path.join(root, "runs", id);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ prompt: "Old run", targetDurationSeconds: 60, status: "running", startedAt: "2026-01-01T00:00:00.000Z", stages: { storyboard: { status: "succeeded" }, narration: { status: "running" } } }));
  const old = new Date("2026-01-01T00:00:00Z");
  utimesSync(path.join(dir, "manifest.json"), old, old);
  await own(id);
  const video = await service.getVideo(id, A);
  assert.equal(video?.status, "failed");
  assert.equal(video?.failedStage, "narration");
});

test("invalid or path-like ids are rejected without touching the filesystem outside runs/", async () => {
  for (const id of ["../package.json", "..", "a/b", "C:\\Windows", "", "x".repeat(81), "%2e%2e"]) {
    assert.equal(await service.getVideo(id, A), null, id);
    assert.equal((await service.getVideoFilePath(id, A)), null, id);
  }
});

test("the library lists every run once, newest first, and never lists a failed run as ready", async () => {
  const videos = await service.listVideos(A);
  const ids = videos.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.equal(ids.length, readdirSync(path.join(root, "runs")).length);
  assert.ok(videos.every((v, i) => i === 0 || videos[i - 1].createdAt >= v.createdAt));
  const files = await Promise.all(videos.filter((v) => v.status === "ready").map((v) => service.getVideoFilePath(v.id, A)));
  assert.ok(files.every(Boolean));
});

test("real-world error messages: paths with spaces, node.exe and POSIX paths are fully hidden", async () => {
  const dir = path.join(root, "runs", "2026-01-02T00-00-00-000Z-errpath0");
  mkdirSync(dir);
  const error = String.raw`Command failed: C:\Program Files\nodejs\node.exe D:\Namaste AI\Project 2\Explivio\node_modules\@remotion\cli\remotion-cli.js render src/video/index.tsx /home/me/My Projects/explivio/runs/x/video.mp4 --log=error`;
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ prompt: "p", targetDurationSeconds: 30, status: "failed", startedAt: "2026-01-02T00:00:00.000Z", stages: { render: { status: "failed", error } }, error }));
  await own("2026-01-02T00-00-00-000Z-errpath0");
  const video = await service.getVideo("2026-01-02T00-00-00-000Z-errpath0", A);
  assert.doesNotMatch(video?.errorDetail ?? "", /Program|nodejs|Namaste|Project 2|node_modules|remotion-cli|My Projects|explivio\/runs/, video?.errorDetail);
  // Adjacent paths may merge into one "[path]" (over-redaction is fine); the readable words stay.
  assert.match(video?.errorDetail ?? "", /^Command failed: \[path\].* render .*--log=error$/);
});

test("F10 ownership: B can't list, open, download or retry A's videos; each sees only their own", async () => {
  const a = await settle((await service.createVideo(request("Explain auroras [ok]"), A)).id);
  const failedA = await settle((await service.createVideo(request("Explain auroras again [fail-render]"), A)).id);
  const b = await settle((await service.createVideo(request("Explain lightning [ok]"), B)).id);
  assert.equal(a.status, "ready");
  const listA = (await service.listVideos(A)).map((v) => v.id);
  const listB = (await service.listVideos(B)).map((v) => v.id);
  assert.ok(listA.includes(a.id) && !listA.includes(b.id), "A sees A's, not B's");
  assert.deepEqual(listB, [b.id], "B sees only B's");
  assert.equal(await service.getVideo(a.id, B), null, "B can't open A's video (same as unknown id)");
  assert.equal(await service.getVideoFilePath(a.id, B), null, "B can't download A's file");
  assert.equal(await service.getVideoTitle(a.id, B), null);
  assert.equal(await service.retryVideo(failedA.id, B), null, "B can't retry A's failed video");
  assert.ok(await service.getVideoFilePath(a.id, A), "A still can");
});

test("F10 ownership: the owner comes from the server, is written to request.json and recorded before the render", async () => {
  const v = await service.createVideo(request("Explain volcanoes [ok]"), B);
  assert.equal(owners.projects.get(v.id)?.ownerUserId, B);
  assert.equal(JSON.parse(readFileSync(path.join(root, "runs", v.id, "request.json"), "utf8")).ownerUserId, B);
  await settle(v.id, 10_000).catch(() => null);
});

test("F10 ownership: if the owner can't be recorded, nothing renders and no run folder is left", async () => {
  const before = readdirSync(path.join(root, "runs")).length;
  const callsBefore = calls().length;
  setOwnershipStore({ ...owners, record: async () => { throw new Error("database unavailable"); } });
  try {
    await assert.rejects(service.createVideo(request("Explain tides [ok]"), A), /database unavailable/);
  } finally {
    setOwnershipStore(owners);
  }
  await sleep(500);
  assert.equal(readdirSync(path.join(root, "runs")).length, before, "folder removed");
  assert.equal(calls().length, callsBefore, "no CLI started");
});

// ---- F11: Cloudflare R2 storage (in-memory object store with the same contract; the real bucket: npm run r2:check) ----

const sampleBytes = () => readFileSync(path.join(here, "fixtures", "tiny.mp4"));
async function withStore<T>(fn: (store: MemoryStore) => Promise<T>): Promise<T> {
  const store = memoryStore();
  setObjectStore(store);
  try {
    return await fn(store);
  } finally {
    setObjectStore(null);
  }
}
const storageOf = (id: string) => owners.projects.get(id)?.storage;

test("F11: with R2, the rendered MP4 is uploaded, verified and recorded, and only then ready; the local file is kept", async () => {
  await withStore(async (store) => {
    const v = await service.createVideo(request("Explain auroras [ok]"), A);
    const recorded = storageOf(v.id);
    assert.equal(recorded?.kind, "r2");
    assert.equal(recorded?.kind === "r2" && recorded.key, `users/${A}/videos/${v.id}/video.mp4`, "key built from server ids");
    const done = await settle(v.id);
    assert.equal(done.status, "ready");
    const s = storageOf(v.id);
    assert.ok(s?.kind === "r2");
    assert.equal(s.uploadStatus, "uploaded");
    assert.equal(s.size, sampleBytes().length);
    assert.equal(s.md5, createHash("md5").update(sampleBytes()).digest("hex"));
    assert.equal(s.contentType, "video/mp4");
    assert.equal(s.attempts, 1);
    assert.ok(s.uploadedAt instanceof Date);
    assert.ok(store.objects.get(s.key)?.data.equals(sampleBytes()), "stored bytes equal the render");
    assert.ok(existsSync(path.join(root, "runs", v.id, "video.mp4")), "local MP4 kept");
    assert.deepEqual(await service.getVideoSource(v.id, A), { kind: "r2", key: s.key, size: s.size });
    assert.equal(await service.getVideoSource(v.id, B), null, "B gets nothing for A's cloud video");
    assert.ok((await service.listVideos(A)).some((x) => x.id === v.id && x.status === "ready"), "appears in My Videos");
  });
});

test("F11: an upload failure keeps the MP4 and fails at 'finishing'; Try again re-uploads the same file without rendering", async () => {
  await withStore(async (store) => {
    store.failNextPuts = 1;
    const v = await service.createVideo(request("Explain monsoons [ok]"), A);
    const failed = await settle(v.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.failedStage, "finishing");
    assert.match(failed.errorDetail ?? "", /cloud storage/i);
    assert.doesNotMatch(failed.errorDetail ?? "", /[A-Za-z]:\\|\/tmp\//, "no paths");
    assert.ok(existsSync(path.join(root, "runs", v.id, "video.mp4")), "local MP4 kept after a failed upload");
    assert.equal(await service.getVideoSource(v.id, A), null, "not playable until stored");

    const cliRuns = calls().length;
    assert.equal(await service.retryVideo(v.id, B), null, "B can't retry A's upload");
    const retried = await service.retryVideo(v.id, A);
    assert.equal(retried?.id, v.id, "same video, not a new run");
    assert.equal(retried?.status, "generating");
    assert.equal(retried?.stage, "finishing");
    const done = await settle(v.id);
    assert.equal(done.status, "ready");
    assert.equal(calls().length, cliRuns, "no new render: no Gemini or ElevenLabs calls");
    assert.equal(store.calls.put, 2);
    const s = storageOf(v.id);
    assert.ok(s?.kind === "r2" && s.attempts === 2 && s.lastError === null);
  });
});

test("F11: a corrupted upload is detected by verification and never marked ready", async () => {
  await withStore(async (store) => {
    store.corruptNextPut = true;
    const v = await service.createVideo(request("Explain comets [ok]"), A);
    const done = await settle(v.id);
    assert.equal(done.status, "failed");
    assert.match(done.errorDetail ?? "", /doesn't match/);
  });
});

test("F11: a late automatic upload start (e.g. the render process exiting) never overwrites a recorded failure", async () => {
  await withStore(async (store) => {
    store.corruptNextPut = true;
    const v = await service.createVideo(request("Explain meteors [ok]"), A);
    assert.equal((await settle(v.id)).status, "failed");
    const puts = store.calls.put;
    await startUpload(v.id, path.join(root, "runs", v.id, "video.mp4"));
    assert.equal((await service.getVideo(v.id, A))?.status, "failed", "still failed: only Try again restarts it");
    assert.equal(store.calls.put, puts, "no automatic re-upload");
  });
});

test("F11: uploads are idempotent; an object already stored with the same checksum is not uploaded again", async () => {
  await withStore(async (store) => {
    const v = await service.createVideo(request("Explain eclipses [ok]"), A);
    await settle(v.id);
    assert.equal(store.calls.put, 1);
    await owners.updateR2Storage(v.id, { uploadStatus: "pending" });
    assert.equal((await service.getVideo(v.id, A))?.stage, "finishing", "looking at it resumes the pending upload");
    assert.equal((await settle(v.id)).status, "ready");
    assert.equal(store.calls.put, 1, "no second PutObject");
  });
});

test("F11: an upload interrupted by a server restart resumes the next time the video is looked at", async () => {
  await withStore(async (store) => {
    const id = "2026-11-05T09-00-00-000Z-restart1";
    const dir = path.join(root, "runs", id);
    mkdirSync(dir);
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ status: "succeeded", prompt: "Explain tides", targetDurationSeconds: 30 }));
    writeFileSync(path.join(dir, "video.mp4"), sampleBytes());
    await owners.record({ id, ownerUserId: A, title: id, prompt: "p", durationSeconds: 30, createdAt: new Date().toISOString(), storage: { kind: "r2", runId: id, key: `users/${A}/videos/${id}/video.mp4`, uploadStatus: "uploading", attempts: 1, lastAttemptAt: new Date() } });
    assert.equal((await service.getVideo(id, A))?.status, "generating");
    assert.equal((await settle(id)).status, "ready");
    assert.equal(store.calls.put, 1);
  });
});

test("F11: the free-tier guard stops uploads near the limit (video kept locally, clear reason)", async () => {
  await withStore(async (store) => {
    setOwnershipStore({ ...owners, storageUsage: async () => ({ storedBytes: 8e9 - 100, uploadsThisMonth: 0 }) }); // 100 bytes under the 80% line; the MP4 is ~4.8 KB
    try {
      const v = await service.createVideo(request("Explain glaciers melting [ok]"), A);
      const done = await settle(v.id);
      assert.equal(done.status, "failed");
      assert.match(done.errorDetail ?? "", /free limit/);
      assert.equal(store.calls.put, 0, "nothing uploaded");
      assert.ok(existsSync(path.join(root, "runs", v.id, "video.mp4")));
    } finally {
      setOwnershipStore(owners);
    }
  });
});

test("F11: videos stored locally before R2 keep playing from runs/ when R2 is configured", async () => {
  const id = "2026-10-01T09-00-00-000Z-histor01";
  const dir = path.join(root, "runs", id);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ status: "succeeded", prompt: "Old video", targetDurationSeconds: 30 }));
  writeFileSync(path.join(dir, "video.mp4"), sampleBytes());
  await own(id);
  await withStore(async (store) => {
    assert.equal((await service.getVideo(id, A))?.status, "ready");
    assert.deepEqual(await service.getVideoSource(id, A), { kind: "local", path: path.join(dir, "video.mp4") });
    assert.equal(store.calls.put + store.calls.head, 0, "historical videos are not touched or uploaded");
  });
});

test("F11: without R2 configured, new videos are stored locally exactly as before", async () => {
  const v = await service.createVideo(request("Explain rainbows [ok]"), A);
  assert.deepEqual(storageOf(v.id), { kind: "local-run", runId: v.id });
  assert.equal((await settle(v.id)).status, "ready");
  assert.equal((await service.getVideoSource(v.id, A))?.kind, "local");
});

test("F12: per-user generation limit: after the daily allowance the next render is refused; other users are unaffected", async () => {
  const C = "usr_cccccccccccccccccccccccccccccccc";
  const D = "usr_dddddddddddddddddddddddddddddddd";
  const settleAs = async (id: string, owner: string) => {
    for (let i = 0; i < 100; i++, await sleep(100)) {
      const v = await service.getVideo(id, owner);
      if (v && v.status !== "generating") return v;
    }
    throw new Error("still generating: " + id);
  };
  process.env.EXPLIVIO_DAILY_GENERATIONS = "2";
  try {
    for (const prompt of ["Explain gravity [ok]", "Explain magnets [fail-render]"]) await settleAs((await service.createVideo(request(prompt), C)).id, C);
    const runsBefore = calls().length;
    await assert.rejects(service.createVideo(request("Explain friction [ok]"), C), (e: Error) => e.name === "GenerationLimitError" && /limit of 2 new videos/.test(e.message));
    const failed = (await service.listVideos(C)).find((v) => v.status === "failed")!;
    await assert.rejects(service.retryVideo(failed.id, C), (e: Error) => e.name === "GenerationLimitError", "a re-render retry counts as a new render");
    assert.equal(calls().length, runsBefore, "nothing was started");
    const other = await service.createVideo(request("Explain inertia [ok]"), D);
    assert.equal((await settleAs(other.id, D)).status, "ready", "another user isn't affected");
  } finally {
    process.env.EXPLIVIO_DAILY_GENERATIONS = "1000";
  }
});

// ---- F14 step 1: status from MongoDB (works without a run folder, as on Vercel) ----

test("F14: the supervisor stores progress in MongoDB (title, stage, safe error) and the request settings are saved", async () => {
  const ok = await service.createVideo(request("Explain auroras again [ok]"), A);
  assert.deepEqual(owners.projects.get(ok.id)?.request, { voice: "male", captions: false, music: true }, "settings saved with the project");
  assert.equal(owners.projects.get(ok.id)?.dispatch, "local");
  assert.equal((await settle(ok.id)).status, "ready");
  const okProgress = owners.attempts.get(ok.id)?.progress;
  assert.equal(okProgress?.status, "succeeded");
  assert.equal(okProgress?.title, "Stub: Explain auroras again", "storyboard title stored");
  const bad = await service.createVideo(request("Explain glaciers again [fail-render]"), A);
  await settle(bad.id);
  const badProgress = owners.attempts.get(bad.id)?.progress;
  assert.equal(badProgress?.status, "failed");
  assert.equal(badProgress?.stage, "render");
  assert.doesNotMatch(badProgress?.safeError ?? "", /Secret Folder|AIza|[A-Za-z]:\\/, "stored error is already safe");
});

test("F14: a tracked video keeps its status, title and request without its run folder (as on Vercel)", async () => {
  await withStore(async () => {
    const v = await service.createVideo(request("Explain volcano types [ok]"), A);
    const done = await settle(v.id);
    assert.equal(done.status, "ready");
    rmSync(path.join(root, "runs", v.id), { recursive: true, force: true });
    const again = await service.getVideo(v.id, A);
    assert.equal(again?.status, "ready", "status from MongoDB, not the folder");
    assert.equal(again?.title, "Stub: Explain volcano types");
    assert.deepEqual(again?.request, { prompt: "Explain volcano types [ok]", durationSeconds: 30, voice: "male", captions: false, music: true });
    assert.equal((await service.getVideoSource(v.id, A))?.kind, "r2", "playable from R2 with no local file");
    assert.equal(await service.getVideoTitle(v.id, A), "Stub: Explain volcano types");
  });
});

test("F14: a run that exists only in MongoDB shows as queued, and as failed if it never started", async () => {
  const fresh = "2026-11-09T10-00-00-000Z-queued01";
  await owners.record({ id: fresh, ownerUserId: A, title: "Queued video", prompt: "Explain wind", durationSeconds: 60, createdAt: new Date().toISOString(), request: { voice: "female", captions: true, music: false }, dispatch: "sandbox" });
  const queued = await service.getVideo(fresh, A);
  assert.equal(queued?.status, "generating");
  assert.equal(queued?.stage, "plan");
  const old = "2026-11-09T10-00-00-000Z-neverst1";
  await owners.record({ id: old, ownerUserId: A, title: "Never started", prompt: "Explain wind", durationSeconds: 60, createdAt: new Date(Date.now() - 20 * 60_000).toISOString(), request: { voice: "female", captions: true, music: false } });
  const never = await service.getVideo(old, A);
  assert.equal(never?.status, "failed");
  assert.match(never?.errorDetail ?? "", /didn't start/);
  owners.attempts.delete(fresh); // not an active run for later tests
});

test("F14: a running video whose heartbeat stopped 15 minutes ago is reported as stopped", async () => {
  const id = "2026-11-09T10-00-00-000Z-silent01";
  await owners.record({ id, ownerUserId: A, title: "Silent", prompt: "Explain tides", durationSeconds: 30, createdAt: new Date().toISOString() });
  await owners.recordProgress(id, { status: "running", stage: "render", safeError: null });
  assert.equal((await service.getVideo(id, A))?.status, "generating");
  const attempt = owners.attempts.get(id)!;
  attempt.progress!.heartbeatAt = new Date(Date.now() - 16 * 60_000).toISOString();
  attempt.heartbeatAt = new Date(Date.now() - 16 * 60_000);
  const stopped = await service.getVideo(id, A);
  assert.equal(stopped?.status, "failed");
  assert.equal(stopped?.failedStage, "render");
  assert.match(stopped?.errorDetail ?? "", /stopped before finishing/);
});

test("F14: a render active elsewhere (another instance or the sandbox) makes new requests wait", async () => {
  const id = "2026-11-09T10-00-00-000Z-elsewhr1";
  await owners.record({ id, ownerUserId: B, title: "Elsewhere", prompt: "p", durationSeconds: 30, createdAt: new Date().toISOString(), dispatch: "sandbox" });
  try {
    await assert.rejects(service.createVideo(request("Explain clouds [ok]"), A), (e: Error) => e.name === "PipelineBusyError");
  } finally {
    owners.attempts.delete(id);
  }
});

test("F14: Try again works from MongoDB alone (no run folder) and reuses the saved settings", async () => {
  const id = "2026-11-09T10-00-00-000Z-failedr1";
  await owners.record({ id, ownerUserId: A, title: "Failed one", prompt: "Explain thunder [ok]", durationSeconds: 60, createdAt: new Date().toISOString(), request: { voice: "female", captions: true, music: false } });
  await owners.recordProgress(id, { status: "failed", stage: "narration", safeError: "Narration failed." });
  const before = calls().length;
  const retried = await service.retryVideo(id, A);
  assert.ok(retried && retried.id !== id, "a new run");
  let call: { args: string[] } | undefined;
  for (let i = 0; i < 50 && !call; i++, await sleep(100)) call = calls().slice(before).find((c) => c.runId === retried!.id);
  assert.deepEqual(call?.args.filter((a: string) => !a.startsWith("--prompt-file")), ["--duration", "60", "--voice=female", `--run-id=${retried!.id}`]);
  await settle(retried!.id);
});

// ---- Delete (2026-11-10): owner only, not while generating, file (R2 / local) and record removed, limit unaffected ----

test("delete: a failed video is removed with its run folder; another user can't delete it; the daily count is unchanged", async () => {
  const v = await service.createVideo(request("Explain glaciers [fail-render]"), A);
  assert.equal((await settle(v.id)).status, "failed");
  const countBefore = await owners.countGenerationsSince(A, new Date(Date.now() - 86_400_000));
  assert.equal(await service.deleteVideo(v.id, B), "not_found", "B can't delete A's video");
  assert.equal(await service.deleteVideo(v.id, A), "deleted");
  assert.equal(existsSync(path.join(root, "runs", v.id)), false, "run folder removed");
  assert.equal(await service.getVideo(v.id, A), null);
  assert.ok(!(await service.listVideos(A)).some((x) => x.id === v.id), "gone from My Videos");
  assert.equal(await owners.countGenerationsSince(A, new Date(Date.now() - 86_400_000)), countBefore, "deleting doesn't give extra renders");
  assert.equal(await service.deleteVideo(v.id, A), "not_found", "deleting twice is harmless");
});

test("delete: refused while the video is still being made", async () => {
  const v = await service.createVideo(request("Explain volcanoes [ok]"), A);
  assert.equal(await service.deleteVideo(v.id, A), "busy");
  assert.equal((await settle(v.id)).status, "ready");
  assert.equal(await service.deleteVideo(v.id, A), "deleted");
});

test("delete: a cloud video's R2 object is deleted too", async () => {
  await withStore(async (store) => {
    const v = await service.createVideo(request("Explain comets [ok]"), A);
    assert.equal((await settle(v.id)).status, "ready");
    const s = storageOf(v.id);
    assert.ok(s?.kind === "r2" && store.objects.has(s.key));
    assert.equal(await service.deleteVideo(v.id, A), "deleted");
    assert.equal(s.kind === "r2" && store.objects.has(s.key), false, "R2 object deleted");
    assert.equal(await service.getVideoSource(v.id, A), null);
  });
});
