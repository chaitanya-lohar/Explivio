import { spawn, type ChildProcess } from "node:child_process";
import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import path from "node:path";
import type { VideoRequest } from "@/types/video";
import type { VideoStorage } from "../../lib/db/collections.ts";
import { startUpload } from "./cloud-upload.ts";
import { ownership, type RunProgress } from "./ownership.ts";
import { readJson, superviseRun, type Manifest } from "./run-status.ts";

/*
 * Runs one video through the pipeline CLI and supervises it (F14). Used by the local dispatcher (this server) and by
 * the render worker inside the Vercel Sandbox, so both follow the same path:
 *   write prompt → spawn `src/cli.ts` → progress to MongoDB (run supervisor) → on success upload the MP4 to R2
 *   (cloud videos) → resolve with the final progress.
 * The prompt goes to a file (no shell, no quoting issues); arguments are passed as-is.
 */

const existsSync = (p: string) => nodeFs.existsSync(/* turbopackIgnore: true */ p);
const openSync = (p: string) => nodeFs.openSync(/* turbopackIgnore: true */ p, "a");

export type ExecuteOptions = {
  id: string;
  /** Repository root that contains src/cli.ts and node_modules/tsx. */
  pipelineRoot: string;
  request: VideoRequest;
  storage: VideoStorage;
  /** 1080p (default) or 720p (RENDER_RESOLUTION). */
  resolution?: "1080p" | "720p";
  /** Extra environment for the pipeline (the sandbox passes its keys here). */
  env?: NodeJS.ProcessEnv;
};

export function pipelineArgs(o: { tsxCli: string; promptFile: string; id: string; request: VideoRequest; resolution?: "1080p" | "720p" }): string[] {
  const args = [o.tsxCli, "src/cli.ts", `--prompt-file=${o.promptFile}`, "--duration", String(o.request.durationSeconds), `--voice=${o.request.voice}`, `--run-id=${o.id}`];
  if (!o.request.captions) args.push("--no-captions");
  if (o.request.music) args.push("--music");
  if (o.resolution === "720p") args.push("--resolution=720p");
  return args;
}

/** Starts the run; `done` resolves after the pipeline exits and (for cloud videos) the upload has finished. */
export async function executeRun(o: ExecuteOptions): Promise<{ child: ChildProcess; done: Promise<RunProgress> }> {
  const dir = path.join(o.pipelineRoot, "runs", o.id);
  await nodeFsPromises.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  const promptFile = path.join(dir, "prompt.txt");
  if (!existsSync(promptFile)) await nodeFsPromises.writeFile(/* turbopackIgnore: true */ promptFile, o.request.prompt);
  const tsxCli = path.join(o.pipelineRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const log = openSync(path.join(dir, "pipeline.log"));
  const child = spawn(process.execPath, pipelineArgs({ tsxCli, promptFile, id: o.id, request: o.request, resolution: o.resolution }), { cwd: o.pipelineRoot, stdio: ["ignore", log, log], windowsHide: true, detached: true, env: { ...process.env, ...o.env } });
  nodeFs.closeSync(log); // the child keeps its own handle

  const done = superviseRun({ dir, child, report: (progress) => ownership().recordProgress(o.id, progress) }).then(async (final) => {
    const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
    // The CLI died before recording a final status (e.g. it crashed on start-up): record the failure in the folder too.
    if (manifest?.status !== "succeeded" && manifest?.status !== "failed") {
      await nodeFsPromises.writeFile(/* turbopackIgnore: true */ path.join(dir, "manifest.json"), JSON.stringify({ ...(manifest ?? {}), status: "failed", error: manifest?.error ?? final.safeError ?? "The generation process exited unexpectedly." }, null, 2)).catch(() => {});
    }
    const file = path.join(dir, "video.mp4");
    if (final.status === "succeeded" && o.storage.kind === "r2" && existsSync(file)) await startUpload(o.id, file);
    return final;
  });
  return { child, done };
}
