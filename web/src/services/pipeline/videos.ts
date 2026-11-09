import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import path from "node:path";
import type { VideoDuration, VideoProject, VideoRequest, VoiceId } from "@/types/video";
import type { VideoStorage } from "../../lib/db/collections.ts";
import { objectStore, videoObjectKey } from "../../lib/storage/index.ts";
import { startUpload, uploadInProgress } from "./cloud-upload.ts";
import { ownership, type RunRecord } from "./ownership.ts";
import { currentStage, PIPELINE_STAGE, readJson, safeDetail, storyboardTitle, superviseRun, type Manifest } from "./run-status.ts";

/*
 * Real video service: each video is a run of the Explivio pipeline CLI (repo root, `src/cli.ts`).
 *
 * Where the status comes from (F14): the run's progress is stored in MongoDB (generationAttempts) by a run supervisor
 * that watches the pipeline (run-status.ts) — in this server for local renders, or inside the Vercel Sandbox in
 * production, where there is no runs/ folder. Runs without stored progress (older runs, hand-made test runs) are still
 * read from their folder:
 *   runs/<id>/request.json, manifest.json, storyboard.json, video.mp4
 *
 * Ownership (F10): every public function takes the signed-in user's id and only sees that user's runs, as recorded
 * in MongoDB (ownership.ts). Another user's run id behaves exactly like an unknown id.
 * Cloud storage (F11): with Cloudflare R2 configured, the MP4 is uploaded after rendering and the video is ready only
 * once the upload is verified; until then it shows the "finishing" stage.
 * Dispatch (F14): RENDER_DISPATCH=local (default: spawn the CLI here) or sandbox (Vercel Sandbox; Step 3).
 */

const PIPELINE_ROOT = process.env.EXPLIVIO_PIPELINE_ROOT ? path.resolve(process.env.EXPLIVIO_PIPELINE_ROOT) : path.resolve(process.cwd(), "..");

// runs/ is runtime data outside the app. These wrappers tell the bundler not to trace the paths into the server build.
const existsSync = (p: string) => nodeFs.existsSync(/* turbopackIgnore: true */ p);
const statSync = (p: string) => nodeFs.statSync(/* turbopackIgnore: true */ p);
const readdirSync = (p: string) => nodeFs.readdirSync(/* turbopackIgnore: true */ p, { withFileTypes: true });
const openSync = (p: string) => nodeFs.openSync(/* turbopackIgnore: true */ p, "a");
const closeSync = nodeFs.closeSync;
const mkdir = (p: string) => nodeFsPromises.mkdir(/* turbopackIgnore: true */ p, { recursive: true });
const writeFile = (p: string, data: string) => nodeFsPromises.writeFile(/* turbopackIgnore: true */ p, data);
const RUNS_DIR = path.join(PIPELINE_ROOT, "runs");
const TSX_CLI = path.join(PIPELINE_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const RUN_ID = /^[A-Za-z0-9_-]{1,80}$/;
/** A run with no sign of life for this long (no heartbeat, no process we know of) is treated as interrupted. */
const STALE_MS = 15 * 60 * 1000;
/** F12: new videos (renders) one account may start in 24 hours; protects the shared Gemini and ElevenLabs free quotas. */
const dailyGenerations = () => Math.max(1, Number(process.env.EXPLIVIO_DAILY_GENERATIONS) || 10);
export const renderDispatch = (): "local" | "sandbox" => (process.env.RENDER_DISPATCH === "sandbox" ? "sandbox" : "local");

interface StoredRequest extends VideoRequest {
  createdAt: string;
  /** Owner recorded by the web app (also in MongoDB); absent on runs made before accounts existed. */
  ownerUserId?: string;
}

// Child processes started by this server, shared across route handlers, actions and pages.
const store = globalThis as typeof globalThis & { __explivioRuns?: Map<string, ChildProcess>; __explivioStarting?: boolean };
const running = (store.__explivioRuns ??= new Map());

function runDir(id: string): string | null {
  if (!RUN_ID.test(id)) return null;
  const dir = path.join(RUNS_DIR, id);
  // Defence in depth: the resolved folder must stay inside runs/.
  return path.dirname(dir) === RUNS_DIR ? dir : null;
}

function asDuration(value: unknown): VideoDuration {
  return value === 30 || value === 90 ? value : 60;
}

function asVoice(value: unknown): VoiceId {
  return value === "male" ? "male" : "female";
}

function titleFrom(prompt: string): string {
  const text = prompt.replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text || "Untitled video";
}

const localFile = (id: string) => {
  const dir = runDir(id);
  return dir ? path.join(dir, "video.mp4") : null;
};

/** The "finished rendering" part of a video's status, shared by both views: cloud upload state or the local file. */
function finishedView(base: Omit<VideoProject, "status">, storage: VideoStorage | undefined, actualDurationSeconds: number | undefined, uploadElsewhere: boolean): VideoProject {
  const ready: VideoProject = { ...base, status: "ready", videoUrl: `/api/videos/${base.id}/file`, actualDurationSeconds };
  const file = localFile(base.id);
  const failed = (detail: string): VideoProject => ({ ...base, status: "failed", failedStage: "finishing", errorDetail: safeDetail(detail) });
  if (storage?.kind === "r2") {
    if (storage.uploadStatus === "uploaded") return ready;
    if (storage.uploadStatus === "failed") return failed(storage.lastError ?? "Saving the video to cloud storage failed.");
    // Pending/uploading: the upload runs here (local) or inside the sandbox that rendered it.
    if (!uploadElsewhere && !(file && existsSync(file))) return failed("The run finished but its video file is missing.");
    return { ...base, status: "generating", stage: "finishing" };
  }
  return file && existsSync(file) ? ready : failed("The run finished but its video file is missing.");
}

/** F14 view: from MongoDB alone (works on Vercel, where there is no run folder). */
function videoFromRecord(record: RunRecord): VideoProject {
  const request: VideoRequest = { prompt: record.prompt, durationSeconds: record.durationSeconds, voice: record.request?.voice ?? "female", captions: record.request?.captions ?? true, music: record.request?.music ?? false };
  const progress = record.progress!;
  const base = { id: record.id, title: progress.title || record.title, prompt: record.prompt, durationSeconds: record.durationSeconds, createdAt: record.createdAt, request, startedAt: progress.startedAt ?? record.createdAt };
  if (progress.status === "succeeded") return finishedView(base, record.storage, progress.actualDurationSeconds ?? undefined, renderDispatch() === "sandbox");
  if (progress.status === "failed") return { ...base, status: "failed", failedStage: progress.stage === "finishing" ? "render" : progress.stage, errorDetail: progress.safeError ?? undefined };
  const alive = running.has(record.id) || Date.now() - Date.parse(progress.heartbeatAt) < STALE_MS;
  if (!alive) return { ...base, status: "failed", failedStage: progress.stage, errorDetail: "The generation process stopped before finishing." };
  return { ...base, status: "generating", stage: progress.stage };
}

/** Builds the UI's view of a run from its files (and, for cloud videos, the upload state). Null for non-runs. */
function readRun(id: string, storage?: VideoStorage): VideoProject | null {
  const dir = runDir(id);
  if (!dir || !existsSync(dir)) return null;
  const stored = readJson<StoredRequest>(path.join(dir, "request.json"));
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = readJson<Manifest>(manifestPath);
  if (!stored && !manifest) return null;

  const request: VideoRequest = stored
    ? { prompt: stored.prompt, durationSeconds: asDuration(stored.durationSeconds), voice: asVoice(stored.voice), captions: stored.captions, music: stored.music }
    : { prompt: manifest?.prompt ?? "", durationSeconds: asDuration(manifest?.targetDurationSeconds), voice: asVoice(manifest?.voice ?? manifest?.narration?.voiceGender), captions: manifest?.captions ?? true, music: manifest?.music ?? false };
  const createdAt = stored?.createdAt ?? manifest?.startedAt ?? statSync(dir).birthtime.toISOString();
  const base = { id, title: storyboardTitle(dir) ?? titleFrom(request.prompt), prompt: request.prompt, durationSeconds: request.durationSeconds, createdAt, request, startedAt: manifest?.startedAt ?? createdAt };

  const stages = manifest?.stages ?? {};
  const failedStageName = Object.keys(stages).find((name) => stages[name]?.status === "failed");
  if (manifest?.status === "succeeded") return finishedView(base, storage, manifest.actualDurationSeconds, false);
  if (manifest?.status === "failed") {
    return { ...base, status: "failed", failedStage: failedStageName ? (PIPELINE_STAGE[failedStageName] ?? "render") : "plan", errorDetail: safeDetail(manifest.error ?? (failedStageName ? stages[failedStageName]?.error : undefined)) };
  }

  // Still in progress (or the process died before writing a final status).
  const lastUpdate = existsSync(manifestPath) ? statSync(manifestPath).mtimeMs : statSync(dir).mtimeMs;
  if (!running.has(id) && Date.now() - lastUpdate > STALE_MS) return { ...base, status: "failed", failedStage: currentStage(stages, manifest), errorDetail: "The generation process stopped before finishing." };
  return { ...base, status: "generating", stage: currentStage(stages, manifest) };
}

/** The UI's view of one owned run: stored progress first, then the run folder, then "queued" (record only). */
function viewOf(id: string, record: RunRecord | undefined): VideoProject | null {
  if (record?.progress) return videoFromRecord(record);
  const fromFiles = readRun(id, record?.storage);
  if (fromFiles || !record) return fromFiles;
  // Recorded but not started yet (e.g. a sandbox still booting): queued, unless it never started at all.
  const request: VideoRequest = { prompt: record.prompt, durationSeconds: record.durationSeconds, voice: record.request?.voice ?? "female", captions: record.request?.captions ?? true, music: record.request?.music ?? false };
  const base = { id, title: record.title, prompt: record.prompt, durationSeconds: record.durationSeconds, createdAt: record.createdAt, request, startedAt: record.createdAt };
  if (Date.now() - Date.parse(record.createdAt) > STALE_MS) return { ...base, status: "failed", failedStage: "plan", errorDetail: "The video didn't start. Please try again." };
  return { ...base, status: "generating", stage: "plan" };
}

/** Cloud videos rendered on this computer whose upload isn't running in this process (e.g. after a restart). */
function resumeUploads(ids: readonly string[], records: Map<string, RunRecord>): void {
  for (const id of ids) {
    const storage = records.get(id)?.storage;
    if (storage?.kind !== "r2" || (storage.uploadStatus !== "pending" && storage.uploadStatus !== "uploading") || uploadInProgress(id)) continue;
    const dir = runDir(id);
    if (!dir || readJson<Manifest>(path.join(dir, "manifest.json"))?.status !== "succeeded") continue;
    const file = path.join(dir, "video.mp4");
    if (existsSync(file)) void startUpload(id, file);
  }
}

function listRunIds(): string[] {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter((entry) => entry.isDirectory() && RUN_ID.test(entry.name) && (existsSync(path.join(RUNS_DIR, entry.name, "manifest.json")) || existsSync(path.join(RUNS_DIR, entry.name, "request.json"))))
    .map((entry) => entry.name);
}

/** Starts a render for a request. Only one video renders at a time: rendering is CPU-heavy (and the free quota small). */
async function startRun(request: VideoRequest, ownerUserId: string): Promise<VideoProject> {
  const dispatch = renderDispatch();
  if (dispatch === "local" && !existsSync(TSX_CLI)) throw new Error("The video pipeline isn't installed. Run `npm install` in the repository root.");
  // The lock is taken before the first await: two requests arriving together (two tabs, a direct POST) used to both
  // pass the busy check before either run existed, and start two renders (F9).
  if (store.__explivioStarting || running.size > 0) throw new PipelineBusyError();
  store.__explivioStarting = true;
  try {
    // A render anywhere (this server, another instance, the sandbox) counts, via its MongoDB heartbeat (F14).
    if (await ownership().hasActiveRun(new Date(Date.now() - STALE_MS))) throw new PipelineBusyError();
    // Checked inside the lock, so two requests at once can't both pass it.
    const used = await ownership().countGenerationsSince(ownerUserId, new Date(Date.now() - 86_400_000));
    const limit = dailyGenerations();
    if (used >= limit) throw new GenerationLimitError(limit);
    if (dispatch === "sandbox") throw new Error("Cloud rendering (Vercel Sandbox) isn't set up yet.");
    return await spawnRun(request, ownerUserId);
  } finally {
    store.__explivioStarting = false;
  }
}

/** Local dispatcher: runs the pipeline CLI on this computer and supervises it (progress → MongoDB, then upload). */
async function spawnRun(request: VideoRequest, ownerUserId: string): Promise<VideoProject> {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(RUNS_DIR, id);
  await mkdir(dir);
  const stored: StoredRequest = { ...request, createdAt: new Date().toISOString(), ownerUserId };
  await writeFile(path.join(dir, "request.json"), JSON.stringify(stored, null, 2));
  await writeFile(path.join(dir, "prompt.txt"), request.prompt);
  // Record the owner before any work starts: if the database is unreachable, nothing renders and the folder goes.
  // With R2 configured the video will be uploaded after rendering; otherwise it stays local (as before F11).
  const storage: VideoStorage = objectStore() ? { kind: "r2", runId: id, key: videoObjectKey(ownerUserId, id), uploadStatus: "pending", attempts: 0 } : { kind: "local-run", runId: id };
  try {
    await ownership().record({ id, ownerUserId, title: titleFrom(request.prompt), prompt: request.prompt, durationSeconds: request.durationSeconds, createdAt: stored.createdAt, storage, request: { voice: request.voice, captions: request.captions, music: request.music }, dispatch: "local" });
  } catch (error) {
    await nodeFsPromises.rm(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
    throw error;
  }

  const args = [TSX_CLI, "src/cli.ts", "--prompt-file=" + path.join(dir, "prompt.txt"), "--duration", String(request.durationSeconds), `--voice=${request.voice}`, `--run-id=${id}`];
  if (!request.captions) args.push("--no-captions");
  if (request.music) args.push("--music");

  // No shell: arguments are passed as-is. Output goes to a log in the run folder for debugging.
  const log = openSync(path.join(dir, "pipeline.log"));
  const child = spawn(process.execPath, args, { cwd: PIPELINE_ROOT, stdio: ["ignore", log, log], windowsHide: true, detached: true });
  closeSync(log); // the child keeps its own handle
  running.set(id, child);
  void superviseRun({ dir, child, report: (progress) => ownership().recordProgress(id, progress) }).then(async (final) => {
    running.delete(id);
    const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
    // The CLI died before recording a final status (e.g. it crashed on start-up): record the failure in the folder too.
    if (manifest?.status !== "succeeded" && manifest?.status !== "failed") {
      await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ ...(manifest ?? {}), status: "failed", error: manifest?.error ?? final.safeError ?? "The generation process exited unexpectedly." }, null, 2)).catch(() => {});
    }
    // Rendered: upload it now (cloud videos only; local ones are already finished).
    const file = path.join(dir, "video.mp4");
    if (final.status === "succeeded" && storage.kind === "r2" && existsSync(file)) void startUpload(id, file);
  });
  child.unref();
  return { id, title: titleFrom(request.prompt), prompt: request.prompt, durationSeconds: request.durationSeconds, createdAt: stored.createdAt, request, status: "generating", stage: "plan", startedAt: stored.createdAt };
}

export class GenerationLimitError extends Error {
  constructor(limit: number) {
    super(`You've reached the limit of ${limit} new videos in 24 hours. Please try again later.`);
    this.name = "GenerationLimitError";
  }
}

export class PipelineBusyError extends Error {
  constructor() {
    super("Another video is being created right now. Please wait for it to finish, then try again.");
    this.name = "PipelineBusyError";
  }
}

/** Where a playable video's bytes are. Only for the owner, and only when the video is ready. */
export type VideoSource = { kind: "local"; path: string } | { kind: "r2"; key: string; size: number };

async function ownedRecord(id: string, ownerUserId: string): Promise<RunRecord | null> {
  if (!runDir(id) || !(await ownership().owns(id, ownerUserId))) return null;
  return (await ownership().runsOf([id])).get(id) ?? null;
}

/** Server-only: the source of the user's playable file, used by the file route. */
export async function getVideoSource(id: string, ownerUserId: string): Promise<VideoSource | null> {
  const record = await ownedRecord(id, ownerUserId);
  if (!record || viewOf(id, record)?.status !== "ready") return null;
  if (record.storage.kind === "r2") return record.storage.size ? { kind: "r2", key: record.storage.key, size: record.storage.size } : null;
  const file = localFile(id);
  return file && existsSync(file) ? { kind: "local", path: file } : null;
}

/** Server-only: local path of a ready video that is served from runs/ (null for cloud videos). */
export async function getVideoFilePath(id: string, ownerUserId: string): Promise<string | null> {
  const source = await getVideoSource(id, ownerUserId);
  return source?.kind === "local" ? source.path : null;
}

export async function getVideoTitle(id: string, ownerUserId: string): Promise<string | null> {
  const record = await ownedRecord(id, ownerUserId);
  if (!record) return null;
  if (record.progress?.title) return record.progress.title;
  const dir = runDir(id);
  return (dir && storyboardTitle(dir)) ?? record.title;
}

/** The user's videos, newest first. The stored status is kept in step (best effort). */
export async function listVideos(ownerUserId: string): Promise<readonly VideoProject[]> {
  const ids = await ownership().listIds(ownerUserId);
  const records = await ownership().runsOf(ids);
  resumeUploads(ids, records);
  const videos = ids
    .map((id) => viewOf(id, records.get(id)))
    .filter((v): v is VideoProject => v !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await Promise.all(videos.map((v) => ownership().syncStatus(v.id, v.status).catch(() => {})));
  return videos;
}

export async function getVideo(id: string, ownerUserId: string): Promise<VideoProject | null> {
  const record = await ownedRecord(id, ownerUserId);
  if (!record) return null;
  resumeUploads([id], new Map([[id, record]]));
  return viewOf(id, record);
}

export async function createVideo(request: VideoRequest, ownerUserId: string): Promise<VideoProject> {
  return startRun(request, ownerUserId);
}

/**
 * Retries one of the user's failed videos. If only the cloud upload failed and the rendered file is still on this
 * computer, the same file is uploaded again (same video id; no new render, no Gemini or ElevenLabs calls). Otherwise a
 * new run starts with the same settings (it has a new id).
 */
export async function retryVideo(id: string, ownerUserId: string): Promise<VideoProject | null> {
  const record = await ownedRecord(id, ownerUserId);
  const video = record ? viewOf(id, record) : null;
  if (!record || !video || video.status !== "failed") return null;
  const file = localFile(id);
  const storage = record.storage;
  if (storage.kind === "r2" && storage.uploadStatus === "failed" && video.failedStage === "finishing" && file && existsSync(file)) {
    if (await ownership().updateR2Storage(id, { uploadStatus: "pending", lastError: null }, ["failed"])) void startUpload(id, file);
    return viewOf(id, { ...record, storage: { ...storage, uploadStatus: "pending" } });
  }
  return startRun(video.request, ownerUserId);
}

/** ALL runs on disk with the owner written in request.json, if any. Only for the legacy-ownership migration script. */
export function listAllRunsForMigration(): (VideoProject & { requestOwnerUserId?: string })[] {
  return listRunIds().flatMap((id) => {
    const video = readRun(id);
    const dir = runDir(id);
    return video && dir ? [{ ...video, requestOwnerUserId: readJson<StoredRequest>(path.join(dir, "request.json"))?.ownerUserId }] : [];
  });
}
