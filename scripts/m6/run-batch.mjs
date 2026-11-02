// Runs M6 test cases through the real pipeline CLI (the same entry point the web app uses), one at a time.
// Records each run and the ACTUAL ElevenLabs characters used (account usage before/after), and stops before the credit reserve.
// Usage: node scripts/m6/run-batch.mjs <phase|caseId,...>
import 'dotenv/config';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const RESERVE_CHARS = 700; // keep a buffer for one failed/retried short video
const CHARS_PER_SECOND = 17.5; // measured: ~2.9 words/s × ~6 characters per word (estimate, used only for the guard)
const matrix = JSON.parse(readFileSync('scripts/m6/matrix.json', 'utf8'));
const resultsFile = path.resolve('docs', 'quality', 'm6-runs.json');
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : {};
const save = () => writeFileSync(resultsFile, JSON.stringify(results, null, 2) + '\n');

const selector = process.argv[2] ?? '';
const cases = matrix.cases.filter((c) => c.phase !== 'pending' && (c.phase === selector || selector.split(',').includes(c.id)));
if (!cases.length) { console.error('No matching runnable cases.'); process.exit(1); }

async function remainingChars() {
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY.trim()}, signal: AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error(`ElevenLabs subscription check failed (${r.status})`);
  const d = await r.json();
  return {used: d.character_count, remaining: d.character_limit - d.character_count};
}

for (const testCase of cases) {
  if (results[testCase.id]?.ok) { console.log(`${testCase.id}: already done (${results[testCase.id].runId}), skipping`); continue; }
  const before = await remainingChars();
  const estimate = Math.ceil(testCase.durationSeconds * CHARS_PER_SECOND * 1.15);
  if (before.remaining - estimate < RESERVE_CHARS) { console.log(`${testCase.id}: stopping, ${before.remaining} characters left (needs ~${estimate} + ${RESERVE_CHARS} reserve)`); break; }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const dir = path.resolve('runs', runId);
  mkdirSync(dir, {recursive: true});
  const request = {prompt: testCase.prompt, durationSeconds: testCase.durationSeconds, voice: testCase.voice, captions: testCase.captions, music: testCase.music, createdAt: new Date().toISOString()};
  writeFileSync(path.join(dir, 'request.json'), JSON.stringify(request, null, 2));
  writeFileSync(path.join(dir, 'prompt.txt'), testCase.prompt);
  const args = [path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/cli.ts', `--prompt-file=${path.join(dir, 'prompt.txt')}`, '--duration', String(testCase.durationSeconds), `--voice=${testCase.voice}`, `--run-id=${runId}`];
  if (!testCase.captions) args.push('--no-captions');
  if (testCase.music) args.push('--music');

  console.log(`${testCase.id}: ${testCase.topic} (${testCase.durationSeconds}s, ${testCase.voice}, captions ${testCase.captions ? 'on' : 'off'}, music ${testCase.music ? 'on' : 'off'}) -> ${runId}`);
  const started = Date.now();
  const log = openSync(path.join(dir, 'pipeline.log'), 'a');
  const code = await new Promise((resolve) => spawn(process.execPath, args, {stdio: ['ignore', log, log], windowsHide: true}).on('exit', resolve));
  closeSync(log);
  const after = await remainingChars();
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  // Keep earlier failed attempts: they are part of the evaluation (reliability), not something to overwrite.
  const previous = results[testCase.id];
  const failedAttempts = [...(previous?.failedAttempts ?? []), ...(previous && !previous.ok ? [{runId: previous.runId, error: previous.error, elevenLabsCharsUsedActual: previous.elevenLabsCharsUsedActual}] : [])];
  results[testCase.id] = {runId, phase: testCase.phase, config: testCase.config, ok: code === 0 && manifest.status === 'succeeded', totalMs: Date.now() - started, elevenLabsCharsUsedActual: after.used - before.used, error: manifest.error ?? null, ...(failedAttempts.length ? {failedAttempts} : {})};
  save();
  console.log(`  -> ${results[testCase.id].ok ? 'OK' : 'FAILED'} in ${Math.round(results[testCase.id].totalMs / 1000)}s, ElevenLabs used ${results[testCase.id].elevenLabsCharsUsedActual} chars${manifest.error ? `, error: ${String(manifest.error).slice(0, 160)}` : ''}`);
}
console.log('Batch finished.');
