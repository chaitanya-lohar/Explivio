// Builds the Vercel Sandbox snapshot used for cloud renders (F14 step 3). Run once (and after pipeline changes):
//   npm run sandbox:snapshot
// It packs an ALLOW-LIST of project files (never .env*, data/, runs/, models/, mcp.json or other local files), starts a
// 4-vCPU sandbox, installs Chrome's Linux libraries, both projects' npm packages, Remotion's headless Chrome and the
// Kokoro voice model, checks that a narration works, then saves a snapshot that never expires and prints its id.
// Uses VERCEL_OIDC_TOKEN from web/.env.local. Prints no secrets.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Sandbox } from "@vercel/sandbox";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const INCLUDE = [
  "package.json", "package-lock.json", "tsconfig.json", "src", "public/assets", "tests/fixtures/storyboard-90s-all-templates.json",
  "web/package.json", "web/package-lock.json", "web/tsconfig.json", "web/src", "web/scripts",
];
// Chrome headless shell needs these on Ubuntu (Remotion's documented list; 24.04+ renamed libasound2 to libasound2t64).
const APT = "libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-liberation";

const t0 = Date.now();
const step = (label: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s] ${label}`);

step("packing allow-listed project files");
const tmp = mkdtempSync(path.join(os.tmpdir(), "explivio-snap-"));
const tarPath = path.join(tmp, "explivio.tgz");
// Relative archive name (cwd = tmp): GNU tar on Windows reads "C:\..." as a remote host "C".
execFileSync("tar", ["-czf", "explivio.tgz", "-C", ROOT, ...INCLUDE], { stdio: "inherit", cwd: tmp });
const tarball = readFileSync(tarPath);
rmSync(tmp, { recursive: true, force: true });
step(`packed ${(tarball.length / 1e6).toFixed(1)} MB`);

const sandbox = await Sandbox.create({ resources: { vcpus: 4 }, timeout: 45 * 60_000, persistent: false });
step("sandbox created");
const run = async (label: string, cmd: string, args: string[], options: { sudo?: boolean; cwd?: string } = {}) => {
  step(label);
  const result = await sandbox.runCommand({ cmd, args, sudo: options.sudo, cwd: options.cwd });
  if (result.exitCode !== 0) {
    const err = (await result.stderr()).split("\n").filter(Boolean).slice(-8).join("\n");
    throw new Error(`${label} failed (exit ${result.exitCode}):\n${err}`);
  }
  return (await result.stdout()).trim();
};

try {
  await sandbox.writeFiles([{ path: "explivio.tgz", content: tarball }]);
  await run("extracting into ~/app", "sh", ["-c", "mkdir -p app && tar -xzf explivio.tgz -C app && rm explivio.tgz && ls app"]);
  await run("installing Chrome's Linux libraries (apt)", "sh", ["-c", `apt-get update -qq && (apt-get install -y -qq ${APT} libasound2t64 || apt-get install -y -qq ${APT} libasound2) >/dev/null`], { sudo: true });
  await run("npm ci (pipeline: Remotion, Kokoro, Gemini…)", "npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: "app" });
  await run("npm ci (web worker: MongoDB, R2, email…)", "npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: "app/web" });
  await run("downloading Remotion's headless Chrome", "npx", ["remotion", "browser", "ensure"], { cwd: "app" });
  await sandbox.writeFiles([{ path: "app/.warm.ts", content: Buffer.from("import {createKokoroNarration} from './src/providers/kokoro';\nconst r = await createKokoroNarration('Hello from Explivio.', '/tmp/warm.mp3', 'female');\nconsole.log(`kokoro ok: ${r.durationSeconds}s of speech, model load ${r.performance.loadSeconds}s`);\n") }]);
  console.log("        " + (await run("downloading + testing the Kokoro voice model (~311 MB)", "npx", ["tsx", ".warm.ts"], { cwd: "app" })).split("\n").at(-1));
  await run("cleaning up", "sh", ["-c", "rm -f app/.warm.ts /tmp/warm.mp3 && du -sh app app/node_modules app/web/node_modules app/models 2>/dev/null | tr '\\n' ' '"]);
  const sizes = await run("measuring", "sh", ["-c", "du -sh app app/node_modules app/web/node_modules app/models 2>/dev/null | tr '\\t' ' ' | tr '\\n' ';'"]);
  console.log(`        sizes: ${sizes}`);
  step("saving snapshot (never expires)");
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  step("done");
  console.log(`\nSANDBOX_SNAPSHOT_ID=${(snapshot as { snapshotId?: string; id?: string }).snapshotId ?? (snapshot as { id?: string }).id}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await sandbox.stop().catch(() => {});
  process.exit(1);
}
