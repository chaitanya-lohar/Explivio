import * as nodeFs from "node:fs";
import path from "node:path";
import type { GenerationStage } from "@/types/video";
import type { RunProgress } from "./ownership.ts";

/*
 * Turning the pipeline's run folder (manifest.json, storyboard.json) into progress (F14). Shared by the run supervisor
 * (which reports it to MongoDB, locally or inside the Vercel Sandbox) and by the file-based view used for runs that have
 * no MongoDB progress (development and older runs).
 */

export interface Manifest {
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

export const PIPELINE_STAGE: Record<string, GenerationStage> = { storyboard: "plan", narration: "narration", render: "render" };

const readFileSync = (p: string) => nodeFs.readFileSync(/* turbopackIgnore: true */ p, "utf8");

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file)) as T;
  } catch {
    return null;
  }
}

/** Keeps failure details useful but safe to display: first line, no file paths or key-like strings, bounded length. */
export function safeDetail(message: string | undefined): string | undefined {
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

export function currentStage(stages: NonNullable<Manifest["stages"]>, manifest: Manifest | null): GenerationStage {
  if (stages.render?.status === "succeeded") return "finishing";
  if (stages.render || manifest?.status === "rendering") return "render";
  if (stages.narration) return stages.narration.status === "succeeded" ? "render" : "narration";
  if (stages.storyboard?.status === "succeeded") return "narration";
  return "plan";
}

export function storyboardTitle(dir: string): string | undefined {
  const storyboard = readJson<{ title?: string }>(path.join(dir, "storyboard.json"));
  return typeof storyboard?.title === "string" && storyboard.title.trim() ? storyboard.title.trim().slice(0, 120) : undefined;
}

/**
 * Pure: the progress a manifest describes. `exit` is set once the pipeline process has ended: a manifest that is not
 * final by then means the process died early, which is a failure.
 */
export function progressFromManifest(manifest: Manifest | null, title: string | undefined, exit?: { code: number | null }): RunProgress {
  const stages = manifest?.stages ?? {};
  const base = { title: title ?? null, actualDurationSeconds: manifest?.actualDurationSeconds ?? null };
  if (manifest?.status === "succeeded") return { ...base, status: "succeeded", stage: "finishing", safeError: null };
  const failedStageName = Object.keys(stages).find((name) => stages[name]?.status === "failed");
  if (manifest?.status === "failed") {
    return { ...base, status: "failed", stage: failedStageName ? (PIPELINE_STAGE[failedStageName] ?? "render") : "plan", safeError: safeDetail(manifest.error ?? (failedStageName ? stages[failedStageName]?.error : undefined)) ?? null };
  }
  if (exit) return { ...base, status: "failed", stage: currentStage(stages, manifest), safeError: `The generation process exited unexpectedly (code ${exit.code ?? "unknown"}).` };
  return { ...base, status: "running", stage: currentStage(stages, manifest), safeError: null };
}

type Exitable = { once(event: "exit", listener: (code: number | null) => void): unknown; exitCode: number | null };

/**
 * Watches a running pipeline process and reports its progress (status, stage, title, safe error) whenever it changes,
 * plus a heartbeat every 30 s so a vanished run can be detected. Resolves with the final progress when the process
 * exits. Reporting failures are swallowed (the next report retries); the pipeline is never affected.
 */
export function superviseRun(options: { dir: string; child: Exitable; report: (progress: RunProgress) => Promise<void>; intervalMs?: number; heartbeatMs?: number }): Promise<RunProgress> {
  const interval = options.intervalMs ?? 1000;
  const heartbeat = options.heartbeatMs ?? 30_000;
  const manifestPath = path.join(options.dir, "manifest.json");
  let last = "";
  let lastSent = 0;
  let busy = Promise.resolve();
  const send = (progress: RunProgress, force = false) => {
    const key = JSON.stringify(progress);
    if (!force && key === last && Date.now() - lastSent < heartbeat) return busy;
    last = key;
    lastSent = Date.now();
    busy = busy.then(() => options.report(progress).catch(() => {}));
    return busy;
  };
  const tick = () => send(progressFromManifest(readJson<Manifest>(manifestPath), storyboardTitle(options.dir)));
  void tick();
  const timer = setInterval(() => void tick(), interval);
  timer.unref?.();
  return new Promise((resolve) => {
    const finish = async (code: number | null) => {
      clearInterval(timer);
      const final = progressFromManifest(readJson<Manifest>(manifestPath), storyboardTitle(options.dir), { code });
      await send(final, true);
      resolve(final);
    };
    if (options.child.exitCode !== null) void finish(options.child.exitCode);
    else options.child.once("exit", (code) => void finish(code));
  });
}
