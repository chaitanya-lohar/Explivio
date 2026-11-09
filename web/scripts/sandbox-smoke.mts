// Vercel Sandbox smoke test (F14 step 3): create a sandbox, report Node, CPUs, memory and OS, then stop it.
// Uses VERCEL_OIDC_TOKEN from web/.env.local (written by `vercel link` / `vercel env pull`; valid 12 h). Prints no secrets.
import { Sandbox } from "@vercel/sandbox";

const started = Date.now();
const sandbox = await Sandbox.create({ resources: { vcpus: 4 }, timeout: 5 * 60_000 });
console.log(`sandbox created in ${((Date.now() - started) / 1000).toFixed(1)} s`);
try {
  for (const [label, cmd, args] of [
    ["node", "node", ["--version"]],
    ["os", "sh", ["-c", "grep PRETTY_NAME /etc/os-release | cut -d= -f2"]],
    ["cpus", "nproc", []],
    ["memory", "sh", ["-c", "free -m | awk '/Mem:/ {print $2\" MB\"}'"]],
    ["disk", "sh", ["-c", "df -h / | awk 'NR==2 {print $4\" free\"}'"]],
    ["ffmpeg/chrome", "sh", ["-c", "command -v ffmpeg || echo 'no ffmpeg'; command -v google-chrome chromium 2>/dev/null || echo 'no system chrome'"]],
  ] as const) {
    const result = await sandbox.runCommand(cmd, [...args]);
    console.log(`${label}: ${(await result.stdout()).trim().replace(/\n/g, " | ")}`);
  }
} finally {
  const stopped = await sandbox.stop();
  console.log(`stopped; active CPU used: ${((stopped as { activeCpuDurationMs?: number })?.activeCpuDurationMs ?? NaN) / 1000} s`);
}
