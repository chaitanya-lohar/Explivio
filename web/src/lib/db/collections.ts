import type { Db, IndexDirection, CreateIndexesOptions } from "mongodb";

/*
 * Collections and indexes (F10 foundation). Names follow docs/Explivio_Database_Design_Document_v1 (users,
 * videoProjects, generationAttempts, userSettings); sessions and emailTokens are added because authentication is
 * self-managed. Video FILES stay in runs/; MongoDB holds metadata and ownership only.
 * Document shapes below are the contract for the next phase; nothing writes them yet except the ownership migration.
 */

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  emailTokens: "emailTokens",
  videoProjects: "videoProjects",
  generationAttempts: "generationAttempts",
  userSettings: "userSettings",
  /** F12: rate-limit counters (hashed keys, TTL), shared across restarts and instances. */
  rateLimits: "rateLimits",
} as const;

/** A fixed-window counter. `_id` is the SHA-256 of the limit key (keys can contain emails; only the hash is stored). */
export interface RateLimitDoc {
  _id: string;
  count: number;
  /** End of the window; the TTL index deletes the record after it. */
  resetAt: Date;
}

/** Application user. Credentials are a scrypt hash; email is stored as entered and in normalised (lower-case) form. */
export interface UserDoc {
  _id: string; // "usr_" + 128-bit random hex
  email: string;
  emailNormalized: string; // unique
  name: string;
  passwordHash: string; // scrypt$N$r$p$salt$hash — never a plaintext password
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  status: "active" | "disabled";
  authProvider: "local"; // design doc field; allows a later move to a managed provider
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt: Date;
}

/** Server-side session; the browser cookie holds the random token, the database only its SHA-256 hash. */
export interface SessionDoc {
  _id: string; // tokenHash
  userId: string;
  createdAt: Date;
  expiresAt: Date; // TTL index removes expired sessions
  lastSeenAt: Date;
}

/** Single-use, expiring link token for email verification or password reset (hash only). */
export interface EmailTokenDoc {
  _id: string; // tokenHash
  userId: string;
  purpose: "verify_email" | "reset_password";
  createdAt: Date;
  expiresAt: Date; // TTL index removes expired tokens
  usedAt: Date | null;
}

/** User-visible video project. `_id` is the existing run id; the MP4 stays in runs/<id>/ (storage reference only). */
/** The MP4 stays in runs/<runId>/ (every video before F11, and new ones when R2 isn't configured). */
export interface LocalVideoStorage {
  kind: "local-run";
  runId: string;
}

/**
 * F11: the MP4 is rendered into runs/<runId>/ and then uploaded to Cloudflare R2. The video is ready only when
 * uploadStatus is "uploaded" (object verified: size, type and MD5). The local file is kept either way.
 */
export interface R2VideoStorage {
  kind: "r2";
  runId: string;
  /** users/<ownerUserId>/videos/<runId>/video.mp4 */
  key: string;
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
  /** Upload attempts so far (each is at most one PutObject). */
  attempts: number;
  contentType?: "video/mp4";
  size?: number;
  /** Hex MD5 of the uploaded bytes (equals R2's ETag for single-part uploads). */
  md5?: string;
  lastAttemptAt?: Date;
  uploadedAt?: Date;
  /** Safe, user-presentable reason of the last failure (no secrets or paths). */
  lastError?: string | null;
}

export type VideoStorage = LocalVideoStorage | R2VideoStorage;

export interface VideoProjectDoc {
  _id: string; // run id
  ownerUserId: string;
  title: string;
  prompt: string;
  durationSeconds: 30 | 60 | 90;
  status: "generating" | "ready" | "failed" | "expired";
  storage: VideoStorage;
  createdAt: Date;
  updatedAt: Date;
  /** Set by the legacy ownership migration for runs created before accounts existed. */
  legacyClaimedAt?: Date;
}

/** One execution of the pipeline for a project (a retry is a new attempt). Errors are already safe to display. */
export interface GenerationAttemptDoc {
  _id: string; // run id of this attempt
  videoId: string;
  ownerUserId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: "plan" | "narration" | "render" | "finishing" | null;
  safeError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Per-user preferences (the F7 VideoPreferences shape, validated on write). */
export interface UserSettingsDoc {
  _id: string; // userId
  preferences: { durationSeconds: 30 | 60 | 90; voice: "female" | "male"; captions: boolean; music: boolean };
  createdAt: Date;
  updatedAt: Date;
}

type IndexSpec = { collection: string; key: Record<string, IndexDirection>; options: CreateIndexesOptions & { name: string } };

export const INDEXES: readonly IndexSpec[] = [
  { collection: COLLECTIONS.users, key: { emailNormalized: 1 }, options: { name: "email_unique", unique: true } },
  { collection: COLLECTIONS.sessions, key: { userId: 1 }, options: { name: "user" } },
  { collection: COLLECTIONS.sessions, key: { expiresAt: 1 }, options: { name: "expiry_ttl", expireAfterSeconds: 0 } },
  { collection: COLLECTIONS.emailTokens, key: { userId: 1, purpose: 1 }, options: { name: "user_purpose" } },
  { collection: COLLECTIONS.emailTokens, key: { expiresAt: 1 }, options: { name: "expiry_ttl", expireAfterSeconds: 0 } },
  { collection: COLLECTIONS.videoProjects, key: { ownerUserId: 1, createdAt: -1 }, options: { name: "owner_newest" } },
  { collection: COLLECTIONS.videoProjects, key: { ownerUserId: 1, status: 1, createdAt: -1 }, options: { name: "owner_status_newest" } },
  { collection: COLLECTIONS.generationAttempts, key: { videoId: 1, createdAt: -1 }, options: { name: "video_newest" } },
  { collection: COLLECTIONS.generationAttempts, key: { ownerUserId: 1, createdAt: -1 }, options: { name: "owner_newest" } },
  { collection: COLLECTIONS.generationAttempts, key: { status: 1, updatedAt: 1 }, options: { name: "status_updated" } },
  { collection: COLLECTIONS.rateLimits, key: { resetAt: 1 }, options: { name: "expiry_ttl", expireAfterSeconds: 0 } },
];

/** Server-side schema checks for the records that matter most for security (Atlas runs $jsonSchema validators). */
export const VALIDATORS: Record<string, object> = {
  [COLLECTIONS.users]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "email", "emailNormalized", "name", "passwordHash", "emailVerified", "status", "authProvider", "createdAt", "updatedAt"],
      properties: {
        _id: { bsonType: "string", pattern: "^usr_[0-9a-f]{32}$" },
        emailNormalized: { bsonType: "string", maxLength: 254 },
        name: { bsonType: "string", maxLength: 80 },
        passwordHash: { bsonType: "string", pattern: "^scrypt\\$" },
        emailVerified: { bsonType: "bool" },
        status: { enum: ["active", "disabled"] },
        authProvider: { enum: ["local"] },
      },
    },
  },
  [COLLECTIONS.videoProjects]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "ownerUserId", "status", "storage", "createdAt"],
      properties: { ownerUserId: { bsonType: "string", pattern: "^usr_[0-9a-f]{32}$" }, status: { enum: ["generating", "ready", "failed", "expired"] } },
    },
  },
};

/**
 * Creates missing collections (with validators) and indexes. Idempotent: running it again changes nothing.
 * Returns what it did, for the db:init report.
 */
export async function ensureSchema(db: Pick<Db, "listCollections" | "createCollection" | "collection" | "command">): Promise<{ createdCollections: string[]; indexes: string[] }> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const createdCollections: string[] = [];
  for (const name of Object.values(COLLECTIONS)) {
    const validator = VALIDATORS[name];
    if (!existing.has(name)) {
      await db.createCollection(name, validator ? { validator, validationLevel: "strict", validationAction: "error" } : {});
      createdCollections.push(name);
    } else if (validator) {
      await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    }
  }
  const indexes: string[] = [];
  for (const spec of INDEXES) {
    await db.collection(spec.collection).createIndex(spec.key, spec.options);
    indexes.push(`${spec.collection}.${spec.options.name}`);
  }
  return { createdCollections, indexes };
}
