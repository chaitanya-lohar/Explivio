import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import path from "node:path";
import type { GenerationStage, VideoDuration, VideoProject, VideoRequest, VoiceId } from "@/types/video";

/*
 * Real video service: each video is a run of the Explivio pipeline CLI (repo root, `src/cli.ts`).
 * The web app starts the CLI with a run id it chooses, then reads the run folder:
 *   runs/<id>/request.json   — written here: the user's settings (the web app's record of the video)
 *   runs/<id>/manifest.json  — written by the CLI: status, per-stage progress, errors, output
 *   runs/<id>/video.mp4      — the rendered file
 * Runs created directly from the command line (no request.json) are listed too, using the manifest.
 */

const PIPELINE_ROOT = process.env.EXPLIVIO_PIPELINE_ROOT ? path.resolve(process.env.EXPLIVIO_PIPELINE_ROOT) : path.resolve(process.cwd(), "..");

// runs/ is runtime data outside the app. These wrappers tell the bundler not to trace the paths into the server build.
const existsSync = (p: string) => nodeFs.existsSync(/* turbopackIgnore: true */ p);
const statSync = (p: string) => nodeFs.statSync(/* turbopackIgnore: true */ p);
const readFileSync = (p: string) => nodeFs.readFileSync(/* turbopackIgnore: true */ p, "utf8");
const readdirSync = (p: string) => nodeFs.readdirSync(/* turbopackIgnore: true */ p, { withFileTypes: true });
const openSync = (p: string) => nodeFs.openSync(/* turbopackIgnore: true */ p, "a");
const closeSync = nodeFs.closeSync;
const mkdir = (p: string) => nodeFsPromises.mkdir(/* turbopackIgnore: true */ p, { recursive: true });
const writeFile = (p: string, data: string) => nodeFsPromises.writeFile(/* turbopackIgnore: true */ p, data);
const RUNS_DIR = path.join(PIPELINE_ROOT, "runs");
const TSX_CLI = path.join(PIPELINE_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const RUN_ID = /^[A-Za-z0-9_-]{1,80}$/;
/** A run still marked "running" whose manifest hasn't changed for this long, with no process we know of, is treated as interrupted. */
const STALE_MS = 15 * 60 * 1000;

interface StoredRequest extends VideoRequest {
  createdAt: string;
}

interface Manifest {
  prompt?: string;
  targetDurationSeconds?: number;
  voice?: string;
  captions?: boolean;
  music?: boolean;
  status?: "running" | "rendering" | "succeeded" | "failed";
  startedAt?: string;
  stages?: Record<string, { status?: "running" | "succeeded" | "failed"; error?: string }>;
  narration?: { voiceGender?: string };
  actualDurationSeconds?: number;
  error?: string;
}

// Child processes started by this server, shared across route handlers, actions and pages.
const store = globalThis as typeof globalThis & { __explivioRuns?: Map<string, ChildProcess>; __explivioStarting?: boolean };
const running = (store.__explivioRuns ??= new Map());

const PIPELINE_STAGE: Record<string, GenerationStage> = { storyboard: "plan", narration: "narration", render: "render" };

function runDir(id: string): string | null {
  if (!RUN_ID.test(id)) return null;
  const dir = path.join(RUNS_DIR, id);
  // Defence in depth: the resolved folder must stay inside runs/.
  return path.dirname(dir) === RUNS_DIR ? dir : null;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file)) as T;
  } catch {
    return null;
  }
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

/** Keeps failure details useful but safe to display: first line, no file paths or key-like strings, bounded length. */
function safeDetail(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const firstLine = message.split("\n")[0];
  const cleaned = firstLine
    // Folder names may contain spaces ("D:\Namaste AI\Project 2\…", "C:\Program Files\…"): match whole paths, not up
    // to the first space (F9: the tail of such paths leaked). Over-redacting a few words is acceptable; leaking isn't.
    .replace(/[A-Za-z]:\\(?:[^\\\n"'<>|]*\\)*[^\s\\"'<>|]*|\/(?:[^/\s"'<>|]+(?: [^/\s"'<>|]+)*\/)+[^\s/"'<>|]*/g, "[path]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .trim();
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}…` : cleaned;
}

function storyboardTitle(dir: string): string | undefined {
  const storyboard = readJson<{ title?: string }>(path.join(dir, "storyboard.json"));
  return typeof storyboard?.title === "string" && storyboard.title.trim() ? storyboard.title.trim() : undefined;
}

/** Builds the UI's view of a run from its files. Returns null for folders that aren't runs. */
function readRun(id: string): VideoProject | null {
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
  const failed = (failedStage: GenerationStage, detail?: string): VideoProject => ({ ...base, status: "failed", failedStage, errorDetail: safeDetail(detail) });

  if (manifest?.status === "succeeded") {
    const file = path.join(dir, "video.mp4");
    return existsSync(file)
      ? { ...base, status: "ready", videoUrl: `/api/videos/${id}/file`, actualDurationSeconds: manifest.actualDurationSeconds }
      : failed("finishing", "The run finished but its video file is missing.");
  }
  if (manifest?.status === "failed") {
    return failed(failedStageName ? (PIPELINE_STAGE[failedStageName] ?? "render") : "plan", manifest.error ?? (failedStageName ? stages[failedStageName]?.error : undefined));
  }

  // Still in progress (or the process died before writing a final status).
  const child = running.get(id);
  const lastUpdate = existsSync(manifestPath) ? statSync(manifestPath).mtimeMs : statSync(dir).mtimeMs;
  if (!child && Date.now() - lastUpdate > STALE_MS) return failed(currentStage(stages, manifest), "The generation process stopped before finishing.");
  return { ...base, status: "generating", stage: currentStage(stages, manifest) };
}

function currentStage(stages: NonNullable<Manifest["stages"]>, manifest: Manifest | null): GenerationStage {
  if (stages.render?.status === "succeeded") return "finishing";
  if (stages.render || manifest?.status === "rendering") return "render";
  if (stages.narration) return stages.narration.status === "succeeded" ? "render" : "narration";
  if (stages.storyboard?.status === "succeeded") return "narration";
  return "plan";
}

function listRunIds(): string[] {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter((entry) => entry.isDirectory() && RUN_ID.test(entry.name) && (existsSync(path.join(RUNS_DIR, entry.name, "manifest.json")) || existsSync(path.join(RUNS_DIR, entry.name, "request.json"))))
    .map((entry) => entry.name);
}

/** Starts the CLI for a request. Only one video renders at a time: rendering is CPU-heavy on a single machine. */
async function startRun(request: VideoRequest): Promise<VideoProject> {
  if (!existsSync(TSX_CLI)) throw new Error("The video pipeline isn't installed. Run `npm install` in the repository root.");
  // The lock is taken before the first await: two requests arriving together (two tabs, a direct POST) used to both
  // pass the busy check before either run folder existed, and start two renders (F9).
  if (store.__explivioStarting || listRunIds().some((id) => readRun(id)?.status === "generating")) throw new PipelineBusyError();
  store.__explivioStarting = true;
  try {
    return await spawnRun(request);
  } finally {
    // From here the new run folder (request.json) exists, so the busy check above sees it as generating.
    store.__explivioStarting = false;
  }
}

async function spawnRun(request: VideoRequest): Promise<VideoProject> {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(RUNS_DIR, id);
  await mkdir(dir);
  const stored: StoredRequest = { ...request, createdAt: new Date().toISOString() };
  await writeFile(path.join(dir, "request.json"), JSON.stringify(stored, null, 2));
  await writeFile(path.join(dir, "prompt.txt"), request.prompt);

  const args = [TSX_CLI, "src/cli.ts", "--prompt-file=" + path.join(dir, "prompt.txt"), "--duration", String(request.durationSeconds), `--voice=${request.voice}`, `--run-id=${id}`];
  if (!request.captions) args.push("--no-captions");
  if (request.music) args.push("--music");

  // No shell: arguments are passed as-is. Output goes to a log in the run folder for debugging.
  const log = openSync(path.join(dir, "pipeline.log"));
  const child = spawn(process.execPath, args, { cwd: PIPELINE_ROOT, stdio: ["ignore", log, log], windowsHide: true, detached: true });
  closeSync(log); // the child keeps its own handle
  running.set(id, child);
  child.on("exit", async (code) => {
    running.delete(id);
    // If the CLI died before recording a final status (e.g. it crashed on start-up), record the failure ourselves.
    const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
    if (manifest?.status !== "succeeded" && manifest?.status !== "failed") {
      await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ ...(manifest ?? {}), status: "failed", error: manifest?.error ?? `The generation process exited unexpectedly (code ${code ?? "unknown"}).` }, null, 2));
    }
  });
  child.unref();
  return readRun(id) ?? { id, title: titleFrom(request.prompt), prompt: request.prompt, durationSeconds: request.durationSeconds, createdAt: stored.createdAt, request, status: "generating", stage: "plan", startedAt: stored.createdAt };
}

export class PipelineBusyError extends Error {
  constructor() {
    super("Another video is being created right now. Please wait for it to finish, then try again.");
    this.name = "PipelineBusyError";
  }
}

/** Server-only: local path of a playable file, used by the file route. */
export function getVideoFilePath(id: string): string | null {
  const dir = runDir(id);
  if (!dir) return null;
  const file = path.join(dir, "video.mp4");
  return readRun(id)?.status === "ready" && existsSync(file) ? file : null;
}

/** Ids only; safe for prerendering. */
export async function listVideoIds(): Promise<readonly string[]> {
  return listRunIds();
}

export async function getVideoTitle(id: string): Promise<string | null> {
  const dir = runDir(id);
  if (!dir || !existsSync(dir)) return null;
  const stored = readJson<StoredRequest>(path.join(dir, "request.json"));
  const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
  return storyboardTitle(dir) ?? titleFrom(stored?.prompt ?? manifest?.prompt ?? "");
}

/** Newest first. */
export async function listVideos(): Promise<readonly VideoProject[]> {
  return listRunIds()
    .map(readRun)
    .filter((v): v is VideoProject => v !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVideo(id: string): Promise<VideoProject | null> {
  return readRun(id);
}

export async function createVideo(request: VideoRequest): Promise<VideoProject> {
  return startRun(request);
}

/** Starts a new run with a failed video's settings. Returns the new video (it has a new id). */
export async function retryVideo(id: string): Promise<VideoProject | null> {
  const video = readRun(id);
  if (!video || video.status !== "failed") return null;
  return startRun(video.request);
}
