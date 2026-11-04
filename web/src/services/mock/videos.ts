import { existsSync } from "node:fs";
import path from "node:path";
import type { GenerationStage, VideoProject, VideoRequest } from "@/types/video";

/*
 * In-memory stand-in for the video service. A "job" walks through the real pipeline stages on a
 * short timer so the progress UI can be exercised end to end; nothing is actually rendered.
 * The store lives on globalThis so route handlers, server actions and pages share one copy.
 */

const STAGE_MS: Record<GenerationStage, number> = { plan: 3000, narration: 5000, render: 8000, finishing: 2000 };
const STAGE_ORDER: readonly GenerationStage[] = ["plan", "narration", "render", "finishing"];

// The real "How APIs work" render produced by the pipeline in the repo root, if it exists locally.
const SAMPLE_VIDEO = path.resolve(process.cwd(), "..", "runs", "2026-10-29T15-45-52-735Z-ea7e9546", "video.mp4");

interface MockRecord {
  id: string;
  title: string;
  createdAt: string;
  request: VideoRequest;
  state: { kind: "ready"; filePath?: string } | { kind: "failed"; startedAt: string; failedStage: GenerationStage } | { kind: "expired" } | { kind: "job"; startedAt: number };
}

const defaults = { voice: "female", captions: true, music: false } as const;

function seed(): MockRecord[] {
  return [
    { id: "how-apis-work", title: "How APIs work", createdAt: "2026-10-29T15:45:52Z", request: { ...defaults, prompt: "Explain how APIs work to complete beginners using a restaurant analogy: the customer, the waiter and the kitchen.", durationSeconds: 60 }, state: { kind: "ready", filePath: existsSync(SAMPLE_VIDEO) ? SAMPLE_VIDEO : undefined } },
    { id: "database-index", title: "How a database index speeds up a search", createdAt: "2026-10-27T11:20:00Z", request: { ...defaults, prompt: "Explain how a database index speeds up a search, for beginners, using a library catalog analogy.", durationSeconds: 90 }, state: { kind: "failed", startedAt: "2026-10-27T11:20:00Z", failedStage: "render" } },
    { id: "keplers-laws", title: "Kepler's laws of planetary motion", createdAt: "2026-10-20T08:00:00Z", request: { ...defaults, prompt: "Explain Kepler's three laws of planetary motion for high school students.", durationSeconds: 60 }, state: { kind: "expired" } },
  ];
}

const store = globalThis as typeof globalThis & { __explivioMockVideos?: MockRecord[] };
const records = (store.__explivioMockVideos ??= seed());

function titleFrom(prompt: string): string {
  return prompt.length > 60 ? `${prompt.slice(0, 57).trimEnd()}…` : prompt;
}

/** Converts a stored record into what the UI sees, working out a job's stage from elapsed time. */
function toProject(record: MockRecord, now: number): VideoProject {
  const base = { id: record.id, title: record.title, prompt: record.request.prompt, durationSeconds: record.request.durationSeconds, createdAt: record.createdAt, request: record.request };
  const { state } = record;
  switch (state.kind) {
    case "ready":
      return { ...base, status: "ready", videoUrl: state.filePath ? `/api/videos/${record.id}/file` : undefined };
    case "failed":
      return { ...base, status: "failed", startedAt: state.startedAt, failedStage: state.failedStage };
    case "expired":
      return { ...base, status: "expired" };
    case "job": {
      let elapsed = now - state.startedAt;
      for (const stage of STAGE_ORDER) {
        if (elapsed < STAGE_MS[stage]) return { ...base, status: "generating", stage, startedAt: new Date(state.startedAt).toISOString() };
        elapsed -= STAGE_MS[stage];
      }
      return { ...base, status: "ready" };
    }
  }
}

/** Server-only: local path of a playable file, used by the file route. */
/** Mock: sample data for UI work, shared by every account (no ownership). */
export async function getVideoFilePath(id: string): Promise<string | null> {
  const record = records.find((r) => r.id === id);
  return record?.state.kind === "ready" && record.state.filePath ? record.state.filePath : null;
}

/** Ids only, independent of time; safe for prerendering (generateStaticParams). */

/** Title only, independent of time; safe for metadata. */
export async function getVideoTitle(id: string): Promise<string | null> {
  return records.find((r) => r.id === id)?.title ?? null;
}

/** Newest first. */
export async function listVideos(): Promise<readonly VideoProject[]> {
  const now = Date.now();
  return records.map((r) => toProject(r, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVideo(id: string): Promise<VideoProject | null> {
  const record = records.find((r) => r.id === id);
  return record ? toProject(record, Date.now()) : null;
}

/** Starts a new generation job for the request. */
export async function createVideo(request: VideoRequest): Promise<VideoProject> {
  const now = Date.now();
  const record: MockRecord = { id: `video-${crypto.randomUUID().slice(0, 8)}`, title: titleFrom(request.prompt), createdAt: new Date(now).toISOString(), request, state: { kind: "job", startedAt: now } };
  records.push(record);
  return toProject(record, now);
}

/** Restarts a failed video with the same settings, keeping its id. */
export async function retryVideo(id: string): Promise<VideoProject | null> {
  const record = records.find((r) => r.id === id);
  if (!record || record.state.kind !== "failed") return null;
  record.state = { kind: "job", startedAt: Date.now() };
  return toProject(record, Date.now());
}
