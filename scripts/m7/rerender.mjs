// Re-renders runs from their saved render-props.json with the CURRENT renderer (no Gemini, no ElevenLabs).
// Used so every evaluated video reflects the same, final template code. Updates the run's manifest render timing.
// Usage: node scripts/m7/rerender.mjs <runDir under runs/> [...]
import {execFileSync} from 'node:child_process';
import {readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

export function rerender(runRel) {
  const dir = path.resolve('runs', runRel);
  const propsPath = path.join(dir, 'render-props.json');
  const props = JSON.parse(readFileSync(propsPath, 'utf8'));
  const output = path.join(dir, 'video.mp4');
  const started = Date.now();
  const cli = path.resolve('node_modules', '@remotion', 'cli', 'remotion-cli.js');
  execFileSync(process.execPath, [cli, 'render', 'src/video/index.tsx', 'ExplainerVideo', output, `--props=${propsPath}`, `--duration=${props.seconds * 30}`, '--codec=h264', '--crf=18', '--log=error'], {windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.rerenders = [...(manifest.rerenders ?? []), {at: new Date().toISOString(), ms: Date.now() - started, reason: 'final M7 template code'}];
  manifest.metrics = {...manifest.metrics, outputBytes: statSync(output).size};
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return Date.now() - started;
}

if (process.argv[1]?.endsWith('rerender.mjs')) {
  for (const run of process.argv.slice(2)) console.log(`${run}: re-rendered in ${Math.round(rerender(run) / 1000)}s`);
}
