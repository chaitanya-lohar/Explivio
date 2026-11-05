// Standalone email queue worker (F13). Usage:
//   npm run email:worker            keep sending queued emails (polls every 5 s) until stopped with Ctrl+C
//   npm run email:worker -- --once  send everything that is due now, then exit
// Safe alongside the in-process worker of a running Next.js server: jobs are claimed atomically. Prints counts only.
import { closeDatabase } from "../src/lib/db/mongo.ts";
import { readEmailConfig } from "../src/lib/email/config.ts";
import { runEmailWorkerOnce } from "../src/lib/email/worker.ts";

const config = readEmailConfig();
console.log(`Email transport: ${config.ok ? config.transport : `invalid — ${config.message}`}`);
if (process.argv.includes("--once")) {
  console.log(`Processed ${await runEmailWorkerOnce()} job(s).`);
  await closeDatabase();
} else {
  let stop = false;
  process.on("SIGINT", () => (stop = true));
  while (!stop) {
    const handled = await runEmailWorkerOnce();
    if (handled) console.log(`${new Date().toISOString()} processed ${handled} job(s)`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  await closeDatabase();
}
