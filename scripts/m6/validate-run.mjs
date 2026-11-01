// M6 automated checks for one pipeline run: file, streams, duration tolerance, audio, music presence, captions, blank frames.
// Usage: node scripts/m6/validate-run.mjs <runId> [--json]
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, statSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {inflateSync} from 'node:zlib';

const BIN = path.resolve('node_modules', '@remotion', 'compositor-win32-x64-msvc');
const FFPROBE = path.join(BIN, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
const FFMPEG = path.join(BIN, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
/** Initial M6 duration tolerance (seconds) per requested length. */
export const TOLERANCE = {30: 5, 60: 8, 90: 10};

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const db = (rms) => 20 * Math.log10(Math.max(rms, 1e-9));

/** Pure: caption cue problems (ordering, positive length, inside the video). Exported for tests. */
export function captionIssues(cues, videoSeconds) {
  const issues = [];
  cues.forEach((cue, i) => {
    if (!(cue.end > cue.start)) issues.push(`cue ${i} has non-positive length`);
    if (cue.start < 0) issues.push(`cue ${i} starts before 0`);
    if (cue.end > videoSeconds + 0.1) issues.push(`cue ${i} ends after the video (${cue.end.toFixed(2)}s > ${videoSeconds.toFixed(2)}s)`);
    if (i > 0 && cue.start < cues[i - 1].start) issues.push(`cue ${i} is out of order`);
    if (!cue.text?.trim()) issues.push(`cue ${i} is empty`);
  });
  return issues;
}

/** Pure: does a requested/actual pair meet the tolerance? */
export function durationCheck(requested, actual) {
  const tolerance = TOLERANCE[requested] ?? 8;
  return {requested, actual, tolerance, diff: +(actual - requested).toFixed(2), pass: Math.abs(actual - requested) <= tolerance};
}

/** Decodes mono 16 kHz PCM and returns RMS per window. */
function audioWindows(file, windowSec) {
  const dir = mkdtempSync(path.join(tmpdir(), 'm6-'));
  try {
    const wav = path.join(dir, 'a.wav');
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const pcm = readFileSync(wav).subarray(44);
    const size = Math.round(16000 * windowSec);
    const out = [];
    for (let start = 0; start + size <= pcm.length / 2; start += size) {
      let sum = 0;
      for (let i = start; i < start + size; i++) { const v = pcm.readInt16LE(i * 2) / 32768; sum += v * v; }
      out.push({t: start / 16000, rms: Math.sqrt(sum / size)});
    }
    return out;
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

/** Minimal decoder for 8-bit greyscale, non-interlaced PNG (what ffmpeg writes for format=gray). */
export function decodeGrayPng(buf) {
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    for (let x = 0; x < width; x++) {
      const cur = raw[y * (width + 1) + 1 + x];
      const left = x ? out[y * width + x - 1] : 0, up = y ? out[(y - 1) * width + x] : 0, ul = x && y ? out[(y - 1) * width + x - 1] : 0;
      const paeth = () => { const p0 = left + up - ul; const pa = Math.abs(p0 - left), pb = Math.abs(p0 - up), pc = Math.abs(p0 - ul); return pa <= pb && pa <= pc ? left : pb <= pc ? up : ul; };
      out[y * width + x] = (cur + [0, left, up, (left + up) >> 1, paeth()][filter]) & 0xff;
    }
  }
  return out;
}

/** Luminance spread of small sampled frames; a near-zero spread means a blank frame. */
function frameSpreads(file, seconds) {
  const out = [];
  const dir = mkdtempSync(path.join(tmpdir(), 'm6f-'));
  try {
  for (let t = 1; t < seconds - 0.5; t += 3) {
    const png = path.join(dir, 'f.png');
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=27:48,format=gray', png]);
    const values = [...decodeGrayPng(readFileSync(png))];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    out.push({t, spread: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)});
  }
  } finally { rmSync(dir, {recursive: true, force: true}); }
  return out;
}

export function validateRun(runId) {
  const dir = path.resolve('runs', runId);
  const manifest = readJson(path.join(dir, 'manifest.json')) ?? {};
  const request = readJson(path.join(dir, 'request.json'));
  const props = readJson(path.join(dir, 'render-props.json')) ?? {};
  const video = path.join(dir, 'video.mp4');
  const checks = [];
  const add = (name, pass, detail = '') => checks.push({name, pass, detail});

  add('mp4 exists and is non-empty', existsSync(video) && statSync(video).size > 0, existsSync(video) ? `${(statSync(video).size / 1e6).toFixed(1)} MB` : 'missing');
  if (!existsSync(video)) return {runId, checks, manifest};

  const probe = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]).toString());
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  const seconds = Number(probe.format.duration);
  add('video codec h264', v?.codec_name === 'h264', v?.codec_name);
  add('resolution 1080x1920 (9:16)', v?.width === 1080 && v?.height === 1920, `${v?.width}x${v?.height}`);
  add('audio stream present', Boolean(a), a?.codec_name ?? 'none');

  const requested = Number(request?.durationSeconds ?? manifest.targetDurationSeconds);
  const duration = durationCheck(requested, seconds);
  add(`duration within ±${duration.tolerance}s of ${requested}s`, duration.pass, `${seconds.toFixed(1)}s (${duration.diff >= 0 ? '+' : ''}${duration.diff}s)`);

  // ExplainerVideo runs store captionCues; the hand-built ApiExplainer stores per-scene word timings.
  const cues = props.captionCues ?? (props.scenes ?? []).flatMap((scene) => scene.words ?? []);
  const narrationEnd = cues.length ? cues[cues.length - 1].end : null;
  if (narrationEnd !== null) add('narration ends before the video does', narrationEnd <= seconds + 0.05, `speech ends ${narrationEnd.toFixed(2)}s, video ${seconds.toFixed(2)}s, tail ${(seconds - narrationEnd).toFixed(2)}s`);

  const windows = audioWindows(video, 0.1);
  const speechish = windows.filter((w) => cues.some((c) => w.t + 0.05 >= c.start && w.t + 0.05 <= c.end));
  const speechDb = speechish.length ? db(Math.sqrt(speechish.reduce((s, w) => s + w.rms ** 2, 0) / speechish.length)) : null;
  add('narration is audible (mean level > -40 dBFS)', speechDb !== null && speechDb > -40, speechDb !== null ? `${speechDb.toFixed(1)} dBFS` : 'no cues');
  const silentSpeech = speechish.filter((w) => db(w.rms) < -60).length / Math.max(1, speechish.length);
  add('no long silence inside narration (<15% silent windows)', silentSpeech < 0.15, `${(silentSpeech * 100).toFixed(0)}% silent`);

  // Music presence: look at gaps at least 0.15s away from any caption cue.
  let gaps = windows.filter((w) => w.t > 0.5 && w.t < seconds - 1 && !cues.some((c) => w.t + 0.05 >= c.start - 0.15 && w.t + 0.05 <= c.end + 0.15));
  // Continuous narration leaves no pauses: fall back to the tail after the last word (music is fading but still audible there).
  if (!gaps.length && narrationEnd !== null) gaps = windows.filter((w) => w.t >= narrationEnd + 0.15 && w.t <= seconds - 0.2);
  const gapDb = gaps.length ? db(Math.sqrt(gaps.reduce((s, w) => s + w.rms ** 2, 0) / gaps.length)) : null;
  const musicExpected = Boolean(props.musicPath);
  if (gapDb === null) add(`music ${musicExpected ? 'present' : 'absent'} in pauses`, null, 'no measurable pauses');
  else add(`music ${musicExpected ? 'present' : 'absent'} in pauses`, musicExpected ? gapDb > -60 : gapDb < -60, `${gapDb.toFixed(1)} dBFS over ${gaps.length} pause windows`);
  if (musicExpected && speechDb !== null && gapDb !== null) add('music stays well below narration (>10 dB)', speechDb - gapDb > 10, `${(speechDb - gapDb).toFixed(1)} dB`);

  const captionsOn = props.captions !== false;
  add('caption setting recorded in render input', props.captions !== undefined || !request, `captions ${captionsOn ? 'on' : 'off'}`);
  if (captionsOn) {
    const issues = captionIssues(cues, seconds);
    add('caption cues valid and inside the video', cues.length > 0 && issues.length === 0, issues.slice(0, 3).join('; ') || `${cues.length} cues`);
  }

  const blanks = frameSpreads(video, seconds).filter((f) => f.spread < 2);
  add('no blank frames in samples', blanks.length === 0, blanks.length ? `blank at ${blanks.map((b) => b.t + 's').join(', ')}` : 'ok');

  return {runId, seconds: +seconds.toFixed(2), requested, speechDb, gapDb, checks, manifest};
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('validate-run.mjs')) {
  const runId = process.argv[2];
  if (!runId) { console.error('Usage: node scripts/m6/validate-run.mjs <runId> [--json]'); process.exit(1); }
  const result = validateRun(runId);
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else for (const c of result.checks) console.log(c.pass === null ? 'SKIP' : c.pass ? 'PASS' : 'FAIL', c.name, c.detail ? `(${c.detail})` : '');
}
