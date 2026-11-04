// Compares the narration speech-time estimate with the real ElevenLabs durations of past runs (local files only).
// Usage: npx tsx scripts/m7/speech-model-check.mjs
import {readdirSync, readFileSync} from 'node:fs';
import {estimateSpeechSeconds} from '../../src/pipeline/script-checks.ts';

const rows = [];
for (const id of readdirSync('runs')) {
  try {
    const m = JSON.parse(readFileSync(`runs/${id}/manifest.json`, 'utf8'));
    const sb = JSON.parse(readFileSync(`runs/${id}/storyboard.json`, 'utf8'));
    if (!m.narration?.durationSeconds || m.narration.provider === 'none') continue;
    const text = sb.scenes.map((s) => s.narration_text).join('\n\n');
    const est = estimateSpeechSeconds(text);
    rows.push({run: id.slice(0, 24), actual: +m.narration.durationSeconds.toFixed(1), estimate: +est.toFixed(1), errorPct: +(((est - m.narration.durationSeconds) / m.narration.durationSeconds) * 100).toFixed(1)});
  } catch { /* not a narrated run */ }
}
console.table(rows);
const abs = rows.map((r) => Math.abs(r.errorPct));
console.log(`runs ${rows.length}, mean |error| ${(abs.reduce((a, b) => a + b, 0) / abs.length).toFixed(1)}%, worst ${Math.max(...abs).toFixed(1)}%`);
