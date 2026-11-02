// Contact sheet for human visual review: one frame near the end of each scene (everything revealed), side by side.
// Usage: node scripts/m7/contact-sheet.mjs <runDir relative to runs/, e.g. m7-silent/<id>>  → <runDir>/contact-sheet.png
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {decodePng, hstackPngs} from './png.mjs';

const BIN = path.resolve('node_modules', '@remotion', 'compositor-win32-x64-msvc');
const FFMPEG = path.join(BIN, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

export function contactSheet(runRel) {
  const dir = path.resolve('runs', runRel);
  const props = JSON.parse(readFileSync(path.join(dir, 'render-props.json'), 'utf8'));
  const starts = props.sceneStarts ?? [];
  const n = props.storyboard.scenes.length;
  const ends = starts.map((s, i) => (i + 1 < n ? starts[i + 1] : props.seconds));
  // 0.6 s before the scene changes: all items revealed, before the cross-fade (16 frames) begins.
  const times = starts.map((s, i) => Math.max(s + 0.5, ends[i] - 0.6 - (i + 1 < n ? 0.55 : 0)));
  const tmp = mkdtempSync(path.join(tmpdir(), 'm7cs-'));
  try {
    const frames = times.map((t, i) => {
      const out = path.join(tmp, `f${i}.png`);
      execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', t.toFixed(2), '-i', path.join(dir, 'video.mp4'), '-frames:v', '1', '-vf', 'scale=360:640', out]);
      return out;
    });
    const sheet = path.join(dir, 'contact-sheet.png');
    // The bundled ffmpeg is a minimal build without hstack: join the frames in Node instead.
    writeFileSync(sheet, hstackPngs(frames.map((f) => decodePng(readFileSync(f)))));
    return {sheet, times};
  } finally { rmSync(tmp, {recursive: true, force: true}); }
}

if (process.argv[1]?.endsWith('contact-sheet.mjs')) {
  const run = process.argv[2];
  if (!run) { console.error('Usage: node scripts/m7/contact-sheet.mjs <runDir under runs/>'); process.exit(1); }
  const {sheet, times} = contactSheet(run);
  console.log(`${sheet} (frames at ${times.map((t) => t.toFixed(1)).join(', ')} s)`);
}
