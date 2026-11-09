/*
 * Runs once when the Next.js server starts. Reports a missing or malformed MongoDB, R2 or email setting immediately
 * (without the value), so a misconfiguration is visible at startup rather than on the first request, and starts the
 * email queue worker (F13).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { readMongoConfig } = await import("./lib/db/config");
  const config = readMongoConfig();
  if (!config.ok) console.warn(`[db] ${config.message}`);
  // Cloudflare R2 (F11) is optional; a partial or malformed setup is reported (variable names only, never values).
  const { readR2Config } = await import("./lib/storage/config");
  const storage = readR2Config();
  if (!storage.ok) console.warn(`[storage] ${storage.message}`);
  // Email (F13): report a broken transport setup (names only), then start the queue worker in this server process.
  // EXPLIVIO_EMAIL_WORKER=off leaves sending to a separate `npm run email:worker` process instead.
  const { readEmailConfig } = await import("./lib/email/config");
  const email = readEmailConfig();
  if (!email.ok) console.warn(`[email] ${email.message}`);
  if (config.ok && process.env.VERCEL) {
    // Serverless (F14): no resident timer. Each queued email is sent right after the response (after()), within the
    // same function invocation; the daily cron (/api/cron/email) catches anything left, e.g. retries.
    const [{ after }, { runEmailWorkerOnce }, { setQueueWakeHook }] = await Promise.all([import("next/server"), import("./lib/email/worker"), import("./lib/email/queue")]);
    setQueueWakeHook(() =>
      after(() => runEmailWorkerOnce().then(() => undefined, (error: unknown) => console.warn(`[email] send after response failed (${error instanceof Error ? error.name : "Error"})`))),
    );
    return;
  }
  if (config.ok && process.env.EXPLIVIO_EMAIL_WORKER !== "off") {
    const { startEmailWorker } = await import("./lib/email/worker");
    startEmailWorker();
  }
}
