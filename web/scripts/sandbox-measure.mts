// Measures one real render inside a Vercel Sandbox started from the snapshot (F14 step 3): wall time, per-stage times
// and the ACTIVE CPU it used (what the Hobby 5 h/month allowance counts). No Gemini call and no ElevenLabs: it narrates
// the fixture storyboard with the free Kokoro voice. Nothing is written to MongoDB or R2.
//   npm run sandbox:measure -- --snapshot=snap_... [--vcpus=4] [--duration=90] [--resolution=720p]
// Uses VERCEL_OIDC_TOKEN from web/.env.local. Prints no secrets.
import { readFileSync } from "node:fs";
import { Sandbox } from "@vercel/sandbox";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const snapshotId = arg("snapshot", process.env.SANDBOX_SNAPSHOT_ID ?? "");
if (!snapshotId) throw new Error("Pass --snapshot=snap_... (printed by npm run sandbox:snapshot).");
const vcpus = Number(arg("vcpus", "4"));
const duration = arg("duration", "90");
const resolution = arg("resolution", "1080p");
// Optional local storyboard to upload (e.g. one with image_query values); default: the fixture inside the snapshot.
const storyboardPath = arg("storyboard", "");

const t0 = Date.now();
const step = (label: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s] ${label}`);
const sandbox = await Sandbox.create({ source: { type: "snapshot", snapshotId }, resources: { vcpus }, timeout: 40 * 60_000, persistent: false, env: { NARRATION_PROVIDER: "kokoro", ...(process.env.PIXABAY_API_KEY ? { PIXABAY_API_KEY: process.env.PIXABAY_API_KEY } : {}) } });
step(`sandbox started from snapshot (${vcpus} vCPU)`);
try {
  if (storyboardPath) await sandbox.writeFiles([{ path: "app/measure-storyboard.json", content: readFileSync(storyboardPath) }]);
  const args = ["tsx", "src/cli.ts", `--storyboard-file=${storyboardPath ? "measure-storyboard.json" : "tests/fixtures/storyboard-90s-all-templates.json"}`, "--duration", duration, "--voice=female", "--run-id=measure1"];
  if (resolution === "720p") args.push("--resolution=720p");
  const started = Date.now();
  const result = await sandbox.runCommand({ cmd: "npx", args, cwd: "app" });
  const wall = (Date.now() - started) / 1000;
  step(`render finished: exit ${result.exitCode}, ${wall.toFixed(0)} s wall`);
  const info = await sandbox.runCommand({ cmd: "node", args: ["-e", "const m=require('./runs/measure1/manifest.json');const s=require('fs').statSync('./runs/measure1/video.mp4');console.log(JSON.stringify({status:m.status,error:m.error,actual:m.actualDurationSeconds,stages:Object.fromEntries(Object.entries(m.stages).map(([k,v])=>[k,Math.round(v.elapsedMs/100)/10])),mb:+(s.size/1e6).toFixed(1),thumbnailKB:require('fs').existsSync('./runs/measure1/thumbnail.jpg')?Math.round(require('fs').statSync('./runs/measure1/thumbnail.jpg').size/1024):(m.thumbnailError||'missing'),theme:m.theme,photos:m.images&&m.images.count,photoErrors:m.images&&m.images.errors}))"], cwd: "app" });
  console.log("        " + ((await info.stdout()).trim() || (await info.stderr()).split("\n").slice(-3).join(" ")));
  if (result.exitCode !== 0) console.log((await result.stderr()).split("\n").filter(Boolean).slice(-8).join("\n"));
} finally {
  const final = await sandbox.stop();
  const cpu = (final as { activeCpuDurationMs?: number }).activeCpuDurationMs ?? sandbox.activeCpuUsageMs;
  step(`sandbox stopped; active CPU ${cpu != null ? (cpu / 1000).toFixed(0) + " s" : "not reported"}`);
  if (cpu) console.log(`        => about ${Math.floor((5 * 3600 * 1000) / cpu)} videos like this per month on the Hobby 5 h allowance`);
}
