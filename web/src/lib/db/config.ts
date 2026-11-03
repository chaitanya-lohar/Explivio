/*
 * MongoDB Atlas settings (server-only). Read from the environment (web/.env.local in development); never exposed
 * through NEXT_PUBLIC_*. Nothing here ever prints the connection string: use redact() on any text that might
 * contain one (driver errors can echo it).
 */

export type MongoConfig = { ok: true; uri: string; dbName: string } | { ok: false; problem: "missing" | "invalid"; message: string };

const DB_NAME = /^[A-Za-z0-9_-]{1,38}$/; // Atlas: database names up to 38 bytes, no special characters

export function readMongoConfig(env: Record<string, string | undefined> = process.env): MongoConfig {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) return { ok: false, problem: "missing", message: "MONGODB_URI is not set. Add it to web/.env.local (see web/.env.example)." };
  if (!/^mongodb(\+srv)?:\/\/[^/\s]+/.test(uri)) return { ok: false, problem: "invalid", message: "MONGODB_URI must start with mongodb+srv:// or mongodb:// followed by a host." };
  const dbName = env.MONGODB_DB?.trim() || "explivio";
  if (!DB_NAME.test(dbName)) return { ok: false, problem: "invalid", message: "MONGODB_DB may only contain letters, numbers, - and _ (max 38)." };
  return { ok: true, uri, dbName };
}

/** Removes credentials from any text: user:password@ in connection strings and password-like query values. */
export function redact(text: string): string {
  return text
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]*@/gi, "$1***@")
    .replace(/((?:password|pwd|secret|token)=)[^&\s]+/gi, "$1***");
}
