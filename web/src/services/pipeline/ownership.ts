import { COLLECTIONS, type GenerationAttemptDoc, type R2VideoStorage, type VideoProjectDoc, type VideoStorage } from "../../lib/db/collections.ts";
import { getDatabase } from "../../lib/db/mongo.ts";
import type { StorageUsage } from "../../lib/storage/usage.ts";
import type { VideoDuration, VideoStatus } from "@/types/video";

/*
 * Who owns which video (F10) and where its file lives (F11). The source of truth is MongoDB (videoProjects); the
 * pipeline files stay in runs/<id>/, and with Cloudflare R2 configured the finished MP4 is also uploaded there.
 * The owner is recorded by the web app when a run is created — never taken from the browser or the CLI.
 * Tests can swap in an in-memory store (setOwnershipStore); the app always uses MongoDB.
 */

export type NewProject = { id: string; ownerUserId: string; title: string; prompt: string; durationSeconds: VideoDuration; createdAt: string; storage?: VideoStorage };
export type R2StoragePatch = Partial<Omit<R2VideoStorage, "kind" | "runId" | "key">>;

export interface OwnershipStore {
  /** Run ids owned by the user (newest first). */
  listIds(ownerUserId: string): Promise<string[]>;
  owns(id: string, ownerUserId: string): Promise<boolean>;
  record(project: NewProject): Promise<void>;
  /** Keeps the stored status in step with the run folder (metadata only). */
  syncStatus(id: string, status: VideoStatus): Promise<void>;
  /** Where each of these videos is stored (missing ids are left out). */
  storageOf(ids: readonly string[]): Promise<Map<string, VideoStorage>>;
  /**
   * Updates an R2 video's upload state. With `onlyIf`, the update happens only while the upload status is one of
   * those values (returns false otherwise) — used to claim an upload so two can't run for the same video.
   */
  updateR2Storage(id: string, patch: R2StoragePatch, onlyIf?: R2VideoStorage["uploadStatus"][]): Promise<boolean>;
  /** Totals for the free-tier guard. */
  storageUsage(now?: Date): Promise<StorageUsage>;
  /** New generations (renders) the user started since this time (F12 per-user limit). */
  countGenerationsSince(ownerUserId: string, since: Date): Promise<number>;
}

const projectStatus = (status: VideoStatus): VideoProjectDoc["status"] => (status === "draft" ? "generating" : status);
const attemptStatus = (status: VideoStatus): GenerationAttemptDoc["status"] => (status === "ready" ? "succeeded" : status === "failed" || status === "expired" ? "failed" : "running");
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

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
    const storage = p.storage ?? { kind: "local-run", runId: p.id };
    await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).insertOne({ _id: p.id, ownerUserId: p.ownerUserId, title: p.title, prompt: p.prompt, durationSeconds: p.durationSeconds, status: "generating", storage, createdAt, updatedAt: now });
    await db.collection<GenerationAttemptDoc>(COLLECTIONS.generationAttempts).insertOne({ _id: p.id, videoId: p.id, ownerUserId: p.ownerUserId, status: "running", stage: "plan", safeError: null, createdAt, updatedAt: now });
  },
  async syncStatus(id, status) {
    const db = await getDatabase();
    const now = new Date();
    await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).updateOne({ _id: id, status: { $ne: projectStatus(status) } }, { $set: { status: projectStatus(status), updatedAt: now } });
    await db.collection<GenerationAttemptDoc>(COLLECTIONS.generationAttempts).updateOne({ _id: id, status: { $ne: attemptStatus(status) } }, { $set: { status: attemptStatus(status), updatedAt: now } });
  },
  async storageOf(ids) {
    if (!ids.length) return new Map();
    const db = await getDatabase();
    const docs = await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).find({ _id: { $in: [...ids] } }, { projection: { storage: 1 } }).toArray();
    return new Map(docs.map((d) => [d._id, d.storage]));
  },
  async updateR2Storage(id, patch, onlyIf) {
    const db = await getDatabase();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [field, value] of Object.entries(patch)) set[`storage.${field}`] = value;
    const filter: Record<string, unknown> = { _id: id, "storage.kind": "r2" };
    if (onlyIf) filter["storage.uploadStatus"] = { $in: onlyIf };
    const result = await db.collection<VideoProjectDoc>(COLLECTIONS.videoProjects).updateOne(filter, { $set: set });
    return result.matchedCount === 1;
  },
  async storageUsage(now = new Date()) {
    const db = await getDatabase();
    const [totals] = await db
      .collection<VideoProjectDoc>(COLLECTIONS.videoProjects)
      .aggregate<{ storedBytes: number; uploadsThisMonth: number }>([
        { $match: { "storage.kind": "r2" } },
        {
          $group: {
            _id: null,
            storedBytes: { $sum: { $cond: [{ $eq: ["$storage.uploadStatus", "uploaded"] }, { $ifNull: ["$storage.size", 0] }, 0] } },
            uploadsThisMonth: { $sum: { $cond: [{ $gte: ["$storage.lastAttemptAt", monthStart(now)] }, { $ifNull: ["$storage.attempts", 0] }, 0] } },
          },
        },
      ])
      .toArray();
    return { storedBytes: totals?.storedBytes ?? 0, uploadsThisMonth: totals?.uploadsThisMonth ?? 0 };
  },
  async countGenerationsSince(ownerUserId, since) {
    const db = await getDatabase();
    // One attempt per render (upload-only retries create none); served by the owner_newest index.
    return db.collection<GenerationAttemptDoc>(COLLECTIONS.generationAttempts).countDocuments({ ownerUserId, createdAt: { $gte: since } });
  },
};

/** For tests: same behaviour, kept in memory. */
export function memoryOwnership(): OwnershipStore & { projects: Map<string, NewProject & { storage: VideoStorage }> } {
  const projects = new Map<string, NewProject & { storage: VideoStorage }>();
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
      projects.set(p.id, { ...p, storage: p.storage ?? { kind: "local-run", runId: p.id } });
    },
    async syncStatus() {},
    async storageOf(ids) {
      return new Map(ids.flatMap((id) => (projects.has(id) ? [[id, structuredClone(projects.get(id)!.storage)] as const] : [])));
    },
    async updateR2Storage(id, patch, onlyIf) {
      const project = projects.get(id);
      if (!project || project.storage.kind !== "r2") return false;
      if (onlyIf && !onlyIf.includes(project.storage.uploadStatus)) return false;
      project.storage = { ...project.storage, ...patch };
      return true;
    },
    async storageUsage(now = new Date()) {
      let storedBytes = 0;
      let uploadsThisMonth = 0;
      for (const { storage } of projects.values()) {
        if (storage.kind !== "r2") continue;
        if (storage.uploadStatus === "uploaded") storedBytes += storage.size ?? 0;
        if (storage.lastAttemptAt && storage.lastAttemptAt >= monthStart(now)) uploadsThisMonth += storage.attempts;
      }
      return { storedBytes, uploadsThisMonth };
    },
    async countGenerationsSince(ownerUserId, since) {
      return [...projects.values()].filter((p) => p.ownerUserId === ownerUserId && new Date(p.createdAt) >= since).length;
    },
  };
}

let current: OwnershipStore = mongoOwnership;
export const ownership = (): OwnershipStore => current;
export function setOwnershipStore(store: OwnershipStore | null): void {
  current = store ?? mongoOwnership;
}
