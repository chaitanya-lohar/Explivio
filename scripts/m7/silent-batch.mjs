// M7 silent evaluation batch: real Gemini storyboards + templates + render, NO narration (no ElevenLabs credits).
// One topic at a time; stops at the first Gemini quota / rate-limit error so the free tier is never exceeded.
// Usage: node scripts/m7/silent-batch.mjs [S1,S2,…]   → runs/m7-silent/<id>/, results in docs/quality/m7-silent-runs.json
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {validateRun} from '../m6/validate-run.mjs';

export const TOPICS = [
  {id: 'S1', area: 'Astronomy', expect: 'orbit', seconds: 30, prompt: 'Why does the Moon have phases? Explain it for complete beginners.'},
  {id: 'S2', area: 'Earth science', expect: 'orbit or comparison', seconds: 30, prompt: 'Why do we have seasons? Explain it for complete beginners.'},
  {id: 'S3', area: 'Earth science', expect: 'cycle', seconds: 30, prompt: 'How does the water cycle work? Explain it for complete beginners.'},
  {id: 'S4', area: 'Earth science', expect: 'layers (stack)', seconds: 30, prompt: "What are the layers of Earth's atmosphere? Explain them for complete beginners."},
  {id: 'S5', area: 'Geology', expect: 'layers (nested)', seconds: 30, prompt: 'What is inside the Earth? Explain its layers for complete beginners.'},
  {id: 'S6', area: 'History / technology', expect: 'timeline', seconds: 60, prompt: 'Give a short history of the internet, from its beginnings to smartphones, for complete beginners.'},
  {id: 'S7', area: 'Technology', expect: 'flow', seconds: 30, prompt: 'How does a web page get from a server to your phone? Explain it for complete beginners.'},
  {id: 'S8', area: 'Mathematics', expect: 'comparison', seconds: 30, prompt: 'What is a prime number? Explain it for complete beginners with a simple example.'},
  {id: 'S9', area: 'Biology', expect: 'flow', seconds: 30, prompt: 'How does photosynthesis work? Explain it for complete beginners.'},
  {id: 'S10', area: 'Biology', expect: 'flow or steps', seconds: 30, prompt: 'How do vaccines train the immune system? Explain it for complete beginners.'},
  {id: 'S11', area: 'Physics', expect: 'flow or hub', seconds: 30, prompt: 'Why is the sky blue? Explain it for complete beginners.'},
  {id: 'S12', area: 'History', expect: 'timeline', seconds: 60, prompt: 'Explain the rise and fall of the Roman Empire for complete beginners, with its key dates.'}
];

const resultsFile = path.resolve('docs', 'quality', 'm7-silent-runs.json');
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : {};
const save = () => writeFileSync(resultsFile, JSON.stringify(results, null, 2) + '\n');
const QUOTA = /429|quota|rate.?limit|resource.?exhausted|overloaded/i;

const isMain = process.argv[1]?.endsWith('silent-batch.mjs');
if (isMain) {
  const only = process.argv[2]?.split(',');
  for (const topic of TOPICS.filter((t) => !only || only.includes(t.id))) {
    if (results[topic.id]?.ok) { console.log(`${topic.id}: done already (${results[topic.id].runId})`); continue; }
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const dir = path.resolve('runs', 'm7-silent', runId);
    mkdirSync(dir, {recursive: true});
    writeFileSync(path.join(dir, 'prompt.txt'), topic.prompt);
    console.log(`${topic.id} ${topic.area}: ${topic.prompt} (${topic.seconds}s) -> ${runId}`);
    const started = Date.now();
    const log = openSync(path.join(dir, 'pipeline.log'), 'a');
    const code = await new Promise((resolve) => spawn(process.execPath, [path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/cli.ts', `--prompt-file=${path.join(dir, 'prompt.txt')}`, '--duration', String(topic.seconds), '--silent', `--run-id=${runId}`], {stdio: ['ignore', log, log], windowsHide: true}).on('exit', resolve));
    closeSync(log);
    const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    const sb = manifest.storyboard ?? {};
    const plan = sb.visualPlan;
    const checks = sb.scriptChecks;
    const validation = manifest.status === 'succeeded' ? validateRun(`m7-silent/${runId}`) : null;
    results[topic.id] = {
      runId, area: topic.area, prompt: topic.prompt, expect: topic.expect, seconds: topic.seconds, mode: manifest.mode,
      ok: code === 0 && manifest.status === 'succeeded', error: manifest.error ?? null, totalMs: Date.now() - started,
      gemini: sb.calls ? {model: sb.model, calls: sb.calls.length, repairs: sb.calls.filter((c) => c.outcome === 'invalid_output').length, ms: sb.calls.map((c) => c.ms), outcomes: sb.calls.map((c) => c.outcome)} : null,
      scenes: plan?.scenes.length ?? null,
      templates: plan?.scenes.map((s) => `${s.template}${s.source === 'fallback' ? '*' : ''}`) ?? null,
      fallbackScenes: plan?.fallbackScenes ?? null,
      visualProblems: plan?.scenes.filter((s) => s.problems.length && !(s.source === 'fallback' && s.problems[0] === 'missing "visual"')).map((s) => `scene ${s.scene_id}: ${s.problems.join('; ')}`) ?? null,
      scriptChecks: checks ? {estimatedSeconds: checks.length.estimatedSeconds, lengthPass: checks.length.pass, hook: !checks.hook, ending: !checks.ending, relevance: !checks.relevance, structure: !checks.consistency} : null,
      renderMs: manifest.stages?.render?.elapsedMs ?? null,
      videoSeconds: validation?.seconds ?? null,
      outputBytes: manifest.metrics?.outputBytes ?? null,
      checks: validation?.checks.map((c) => ({name: c.name, pass: c.pass, detail: c.detail})) ?? null
    };
    save();
    console.log(`  -> ${results[topic.id].ok ? 'OK' : 'FAILED'} in ${Math.round(results[topic.id].totalMs / 1000)}s; templates ${results[topic.id].templates?.join(', ') ?? '-'}${manifest.error ? `; error: ${String(manifest.error).slice(0, 160)}` : ''}`);
    if (!results[topic.id].ok && QUOTA.test(String(manifest.error ?? ''))) { console.log('Stopping: Gemini quota or rate limit reached (free tier). Resume later.'); break; }
  }
  console.log('Batch finished.');
}
