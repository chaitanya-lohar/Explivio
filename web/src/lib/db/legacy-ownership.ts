import type { VideoProjectDoc } from "./collections.ts";

/*
 * Plan for giving the videos created before accounts existed to ONE configured account (EXPLIVIO_LEGACY_OWNER_EMAIL).
 * Pure: it only decides; the db:legacy-ownership script prints the plan (dry run by default) and applies it only with
 * --apply. Safety rules:
 *  - nothing is assigned unless the configured account exists, is active and has a verified email;
 *  - a project that already has a record in MongoDB is never touched (no reassignment, idempotent);
 *  - runs created after accounts existed (their request.json names an owner) are left alone;
 *  - files in runs/ are never moved, renamed or deleted: the record only references the run id.
 */

export type LegacyRun = { id: string; title: string; prompt: string; durationSeconds: 30 | 60 | 90; status: VideoProjectDoc["status"]; createdAt: string; requestOwnerUserId?: string };
export type OwnerCandidate = { id: string; emailVerified: boolean; status: "active" | "disabled" } | null;

export type LegacyPlan = {
  configuredEmail: boolean;
  owner: "not_configured" | "not_found" | "not_verified" | "disabled" | "ok";
  runsOnDisk: number;
  alreadyRecorded: number;
  ownedByNewerAccounts: number;
  toAssign: string[];
  canApply: boolean;
};

export function planLegacyOwnership(runs: readonly LegacyRun[], recordedIds: ReadonlySet<string>, configuredEmail: string | undefined, owner: OwnerCandidate): LegacyPlan {
  const ownerState: LegacyPlan["owner"] = !configuredEmail ? "not_configured" : !owner ? "not_found" : owner.status !== "active" ? "disabled" : !owner.emailVerified ? "not_verified" : "ok";
  const ownedByNewerAccounts = runs.filter((r) => r.requestOwnerUserId).length;
  const alreadyRecorded = runs.filter((r) => !r.requestOwnerUserId && recordedIds.has(r.id)).length;
  const toAssign = runs.filter((r) => !r.requestOwnerUserId && !recordedIds.has(r.id)).map((r) => r.id);
  return { configuredEmail: Boolean(configuredEmail), owner: ownerState, runsOnDisk: runs.length, alreadyRecorded, ownedByNewerAccounts, toAssign, canApply: ownerState === "ok" && toAssign.length > 0 };
}

/** The record inserted for one legacy run (insert-only: existing records are never modified). */
export function legacyProjectDoc(run: LegacyRun, ownerUserId: string, now: Date): VideoProjectDoc {
  return {
    _id: run.id,
    ownerUserId,
    title: run.title,
    prompt: run.prompt,
    durationSeconds: run.durationSeconds,
    status: run.status,
    storage: { kind: "local-run", runId: run.id },
    createdAt: new Date(run.createdAt),
    updatedAt: now,
    legacyClaimedAt: now,
  };
}
