import { COLLECTIONS, type GenerationAttemptDoc, type VideoProjectDoc } from "../../lib/db/collections.ts";
import { getDatabase } from "../../lib/db/mongo.ts";
import type { VideoDuration, VideoStatus } from "@/types/video";

/*
 * Who owns which video (F10). The source of truth is MongoDB (videoProjects); the MP4 and pipeline files stay in
 * runs/<id>/. The owner is recorded by the web app when a run is created — never taken from the browser or the CLI.
 * Tests can swap in an in-memory store (setOwnershipStore); the app always uses MongoDB.
 */

export type NewProject = { id: string; ownerUserId: string; title: string; prompt: string; durationSeconds: VideoDuration; createdAt: string };

export interface OwnershipStore {
  /** Run ids owned by the user (newest first). */
  listIds(ownerUserId: string): Promise<string[]>;
  owns(id: string, ownerUserId: string): Promise<boolean>;
  record(project: NewProject): Promise<void>;
  /** Keeps the stored status in step with the run folder (metadata only). */
  syncStatus(id: string, status: VideoStatus): Promise<void>;
}

const projectStatus = (status: VideoStatus): VideoProjectDoc["status"] => (status === "draft" ? "generating" : status);
const attemptStatus = (status: VideoStatus): GenerationAttemptDoc["status"] => (status === "ready" ? "succeeded" : status === "failed" || status === "expired" ? "failed" : "running");

export const mongoOwnership: OwnershipStore = {
  async listIds(ownerUserId) {
    const db = await getDatabase();
    const docs = await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).find({ ownerUserId }, { projection: { _id: 1 }, sort: { createdAt: -1 } }).toArray();
    return docs.map((d) => d._id);
  },
  async owns(id, ownerUserId) {
    const db = await getDatabase();
    return (await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).countDocuments({ _id: id, ownerUserId }, { limit: 1 })) === 1;
  },
  async record(p) {
    const db = await getDatabase();
    const now = new Date();
    const createdAt = new Date(p.createdAt);
    await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).insertOne({ _id: p.id, ownerUserId: p.ownerUserId, title: p.title, prompt: p.prompt, durationSeconds: p.durationSeconds, status: "generating", storage: { kind: "local-run", runId: p.id }, createdAt, updatedAt: now });
    await db.collection<GenerationAttemptDoc>(COLLECTIONS.generationAttempts).insertOne({ _id: p.id, videoId: p.id, ownerUserId: p.ownerUserId, status: "running", stage: "plan", safeError: null, createdAt, updatedAt: now });
  },
  async syncStatus(id, status) {
    const db = await getDatabase();
    const now = new Date();
    await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).updateOne({ _id: id, status: { $ne: projectStatus(status) } }, { $set: { status: projectStatus(status), updatedAt: now } });
    await db.collection<GenerationAttemptDoc>(COLLECTIONS.generationAttempts).updateOne({ _id: id, status: { $ne: attemptStatus(status) } }, { $set: { status: attemptStatus(status), updatedAt: now } });
  },
};

/** For tests: same behaviour, kept in memory. */
export function memoryOwnership(): OwnershipStore & { projects: Map<string, NewProject> } {
  const projects = new Map<string, NewProject>();
  return {
    projects,
    async listIds(ownerUserId) {
      return [...projects.values()].filter((p) => p.ownerUserId === ownerUserId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => p.id);
    },
    async owns(id, ownerUserId) {
      return projects.get(id)?.ownerUserId === ownerUserId;
    },
    async record(p) {
      if (projects.has(p.id)) throw new Error("duplicate project");
      projects.set(p.id, p);
    },
    async syncStatus() {},
  };
}

let current: OwnershipStore = mongoOwnership;
export const ownership = (): OwnershipStore => current;
export function setOwnershipStore(store: OwnershipStore | null): void {
  current = store ?? mongoOwnership;
}
