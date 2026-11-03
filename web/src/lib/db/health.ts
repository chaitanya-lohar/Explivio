import { readMongoConfig } from "./config.ts";
import { DatabaseConfigError, getDatabase, safeReason } from "./mongo.ts";

/*
 * Database health check. The public answer is only a status word and a latency: no host, user, database name or
 * error text, so it can't leak configuration. Details go to the server log, redacted.
 */

export type DatabaseHealth = { status: "ok" | "not_configured" | "unavailable"; latencyMs: number | null };

export async function checkDatabase(ping: () => Promise<unknown> = defaultPing, log: (line: string) => void = (line) => console.warn(line)): Promise<DatabaseHealth> {
  if (!readMongoConfig().ok) return { status: "not_configured", latencyMs: null };
  const started = Date.now();
  try {
    await ping();
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    log(`[db] health check failed: ${error instanceof DatabaseConfigError ? error.message : safeReason(error)}`);
    return { status: error instanceof DatabaseConfigError ? "not_configured" : "unavailable", latencyMs: null };
  }
}

async function defaultPing(): Promise<unknown> {
  const db = await getDatabase();
  return db.command({ ping: 1 });
}
