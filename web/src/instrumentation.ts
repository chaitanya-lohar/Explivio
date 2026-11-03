/*
 * Runs once when the Next.js server starts. Reports a missing or malformed MongoDB setting immediately (without the
 * value), so a misconfiguration is visible at startup rather than on the first database request. The app still
 * starts: until authentication is switched on, pages that don't need the database keep working.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { readMongoConfig } = await import("./lib/db/config");
  const config = readMongoConfig();
  if (!config.ok) console.warn(`[db] ${config.message}`);
}
