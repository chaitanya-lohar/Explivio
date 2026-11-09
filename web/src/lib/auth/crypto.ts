import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/*
 * Password hashing (scrypt), random tokens and HMAC signing — Node built-ins only (F10).
 * Stored hash format: scrypt$N$r$p$saltB64$keyB64, so parameters can be raised later without breaking old hashes.
 */

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLength: 64, saltBytes: 16 } as const;
const MAXMEM = 64 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, keyLength, { N, r, p, maxmem: MAXMEM }, (error, key) => (error ? reject(error) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT.saltBytes);
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keyLength);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash of a random password: checking against it costs the same as a real account, so timing reveals nothing. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

/** 256-bit random token for cookies and email links (URL-safe). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores instead of a token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function newUserId(): string {
  return `usr_${randomBytes(16).toString("hex")}`;
}

/** Folder for local auth data (generated secret, development outbox): <pipeline root>/data, gitignored. */
export function dataDir(): string {
  const root = process.env.EXPLIVIO_PIPELINE_ROOT ? path.resolve(process.env.EXPLIVIO_PIPELINE_ROOT) : path.resolve(process.cwd(), "..");
  return path.join(root, "data");
}

/** AUTH_SECRET, or a random secret generated once into data/auth-secret (gitignored, owner-only). */
let cachedSecret: string | null = null;
function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // On Vercel the disk is read-only and every instance would generate its own secret: the setting is required (F14).
  if (process.env.VERCEL) throw new Error("AUTH_SECRET must be set on Vercel (a long random value).");
  if (cachedSecret) return cachedSecret;
  const file = path.join(dataDir(), "auth-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(file, randomBytes(48).toString("base64url"), { flag: "wx" });
      chmodSync(file, 0o600);
    } catch {
      /* created by a parallel process, or chmod unsupported (Windows) */
    }
  }
  cachedSecret = readFileSync(file, "utf8").trim();
  return cachedSecret;
}

/** A short keyed hash for log correlation (e.g. of a client address): stable per server, not reversible. */
export function anonymize(value: string): string {
  return createHmac("sha256", secret()).update(`log:${value}`).digest("base64url").slice(0, 12);
}

/** `value.expires.signature` for small, non-secret cookie payloads (e.g. which account awaits verification). */
export function sign(value: string, expiresAt: number): string {
  const body = `${value}.${expiresAt}`;
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function unsign(signed: string | undefined, now = Date.now()): string | null {
  if (!signed) return null;
  const parts = signed.split(".");
  if (parts.length !== 3) return null;
  const [value, expires, signature] = parts;
  const expected = createHmac("sha256", secret()).update(`${value}.${expires}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return Number(expires) > now ? value : null;
}
