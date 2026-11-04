import { MongoClient, type Db } from "mongodb";
import { readMongoConfig, redact } from "./config.ts";

/*
 * The one MongoDB connection for the web app (F10). A single MongoClient (with its own connection pool) is created per
 * server process and reused by every request; in development it survives hot reloads via globalThis. Atlas free
 * clusters allow 500 connections, so the pool is kept small.
 */

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

/** Connection failed (network, DNS, authentication, IP access list). The message never contains the URI. */
export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

type Cached = { uri: string; dbName: string; client: MongoClient; connecting: Promise<MongoClient> | null };
const store = globalThis as typeof globalThis & { __explivioMongo?: Cached };

const TIMEOUT_MS = Number(process.env.MONGODB_TIMEOUT_MS) || 5000;

/** The shared client (created on first use, not yet connected). Throws DatabaseConfigError if settings are wrong. */
export function getMongoClient(): MongoClient {
  const config = readMongoConfig();
  if (!config.ok) throw new DatabaseConfigError(config.message);
  const cached = store.__explivioMongo;
  if (cached && cached.uri === config.uri && cached.dbName === config.dbName) return cached.client;
  if (cached) void cached.client.close().catch(() => {});
  let client: MongoClient;
  try {
    client = new MongoClient(config.uri, { appName: "explivio-web", maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: TIMEOUT_MS, connectTimeoutMS: TIMEOUT_MS, retryWrites: true });
  } catch (error) {
    // Parse errors can quote the string: only a redacted, generic reason leaves this module.
    throw new DatabaseConfigError(`MONGODB_URI could not be parsed (${redact(error instanceof Error ? error.message : String(error)).slice(0, 120)}).`);
  }
  store.__explivioMongo = { uri: config.uri, dbName: config.dbName, client, connecting: null };
  return client;
}

/** The application database, connecting on first use. Concurrent callers share one connection attempt. */
export async function getDatabase(): Promise<Db> {
  const client = getMongoClient();
  const cached = store.__explivioMongo!;
  cached.connecting ??= client.connect().catch((error: unknown) => {
    cached.connecting = null; // allow a later retry
    throw new DatabaseUnavailableError(safeReason(error));
  });
  await cached.connecting;
  return client.db(cached.dbName);
}

/** Closes the shared client (scripts and tests). */
export async function closeDatabase(): Promise<void> {
  const cached = store.__explivioMongo;
  store.__explivioMongo = undefined;
  if (cached) await cached.client.close().catch(() => {});
}

/** A short, credential-free reason suitable for logs; users get an even more generic message. */
export function safeReason(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  const hint = /auth|SCRAM|credential/i.test(message)
    ? "authentication failed (check the database user and password)"
    : /ENOTFOUND|querySrv|getaddrinfo/i.test(message)
      ? "host not found (check the cluster address)"
      : /Server selection timed out|ECONNREFUSED|timed out|ETIMEDOUT/i.test(message)
        ? "could not reach the cluster (network or Atlas IP access list)"
        : "connection failed";
  return redact(`${name}: ${hint}`);
}
