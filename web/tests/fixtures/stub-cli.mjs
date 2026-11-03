// Stand-in for the pipeline CLI in integration tests (installed at <fixture root>/node_modules/tsx/dist/cli.mjs, the
// path the web service spawns). It writes run manifests exactly like src/cli.ts but calls no API and renders nothing.
// The scenario comes from a tag in the prompt: [ok] [slow] [fail-render] [quota-gemini] [quota-elevenlabs]
// [missing-output] [crash]. Every invocation's arguments are appended to <root>/stub-calls.log for assertions.
import {appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = process.cwd();
const runId = flag('run-id');
const prompt = readFileSync(flag('prompt-file'), 'utf8');
const seconds = Number(args[args.indexOf('--duration') + 1]);
appendFileSync(path.join(root, 'stub-calls.log'), `${JSON.stringify({runId, args: args.slice(1)})}\n`);

const dir = path.join(root, 'runs', runId);
mkdirSync(dir, {recursive: true});
const manifest = {runId, prompt, targetDurationSeconds: seconds, voice: flag('voice') ?? 'default', captions: !args.includes('--no-captions'), music: args.includes('--music'), status: 'running', startedAt: new Date().toISOString(), stages: {}};
const save = () => writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = Number(process.env.STUB_STEP_MS ?? (prompt.includes('[slow]') ? 6000 : 1200));

async function stage(name, fail) {
  manifest.stages[name] = {status: 'running'}; save();
  await sleep(step);
  if (fail) { manifest.stages[name] = {status: 'failed', error: fail}; manifest.status = 'failed'; manifest.error = fail; save(); process.exit(1); }
  manifest.stages[name] = {status: 'succeeded', elapsedMs: step}; save();
}

save();
if (prompt.includes('[crash]')) { await sleep(step); process.exit(3); }
// Same wording as the real providers (gemini.ts / elevenlabs.ts), including details the UI must not leak.
await stage('storyboard', prompt.includes('[quota-gemini]') ? 'Gemini request failed before a usable response was received (overloaded on gemini-3.6-flash: quota or rate limit (429)).' : null);
writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({title: `Stub: ${prompt.replace(/\[[^\]]+\]/g, '').trim().slice(0, 40)}`, scenes: []}));
await stage('narration', prompt.includes('[quota-elevenlabs]') ? 'ElevenLabs 401: {"detail":{"status":"quota_exceeded","message":"This request exceeds your quota of 10000. You have 12 credits remaining."}}' : null);
manifest.status = 'rendering'; save();
await stage('render', prompt.includes('[fail-render]') ? 'Command failed: D:\\Secret Folder\\node_modules\\@remotion\\cli\\remotion-cli.js render key=AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKE00000 (exit 1)\n    at ChildProcess.exithandler (node:child_process:422:12)' : null);
const sample = process.env.STUB_SAMPLE_MP4;
if (!prompt.includes('[missing-output]') && sample && existsSync(sample)) copyFileSync(sample, path.join(dir, 'video.mp4'));
manifest.status = 'succeeded'; manifest.actualDurationSeconds = seconds + 1; manifest.output = `runs/${runId}/video.mp4`; save();
