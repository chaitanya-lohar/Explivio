import 'dotenv/config';
import {mkdir, writeFile, copyFile, readFile, stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createStoryboard} from './providers/gemini.js';
import {StoryboardSchema, type Storyboard} from './schemas/storyboard.js';
import {apiStoryboard, buildApiVideo} from './api-explainer.js';
import {sceneStartsFromWords, splitCuesAtScenes} from './pipeline/scene-timing.js';
import {silentTiming} from './pipeline/silent-timing.js';

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const demo = args.includes('--demo');
const demoWithSpeech = args.includes('--speak');
const voiceGender = args.find((arg) => arg.startsWith('--voice='))?.split('=')[1];
const flagValue = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
// Used by the web app: a caller-chosen run id (so it knows the folder up front), the prompt in a file
// (no quoting or length issues, and it can't be mistaken for a flag), and the captions/music choices.
const requestedRunId = flagValue('run-id');
const promptFile = flagValue('prompt-file');
const captionsEnabled = !args.includes('--no-captions');
const musicEnabled = args.includes('--music');
// Development only (never used by the web app): SILENT EVALUATION renders the real storyboard and templates without
// narration, so visuals can be reviewed without ElevenLabs credits. Runs go to runs/m7-silent/, outside My Videos.
const silent = args.includes('--silent');
// Development only: narrate an already generated, validated storyboard (e.g. from a silent run) without calling Gemini.
const storyboardFile = flagValue('storyboard-file');
// Tests only: stop before the (slow) render.
const skipRender = args.includes('--skip-render');
const demoName = args.find((arg) => ['photosynthesis', 'rain', 'api'].includes(arg.toLowerCase()))?.toLowerCase();
const durationIndex = args.indexOf('--duration');
const positionalArgs = args.filter((arg, index) => !arg.startsWith('--') && index !== durationIndex + 1 && arg.toLowerCase() !== demoName);
const promptFromFile = promptFile ? (await readFile(promptFile, 'utf8')).trim() : '';
const topic = promptFromFile || (demoName === 'photosynthesis' ? 'How photosynthesis works' : demoName === 'rain' ? 'How rain forms' : demoName === 'api' ? 'How APIs work' : positionalArgs[0] || 'How a database index makes searches faster');
const durationArg = Number(args[args.indexOf('--duration') + 1]);
const seconds = ([30, 60, 90].includes(durationArg) ? durationArg : 60) as 30 | 60 | 90;
if (requestedRunId && !/^[A-Za-z0-9_-]{1,80}$/.test(requestedRunId)) throw new Error('--run-id may only contain letters, numbers, - and _.');
const runId = requestedRunId || `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
if (silent && demoName === 'api') throw new Error('--silent does not apply to the API demo, which has its own narration.');
const runDir = silent ? path.resolve('runs', 'm7-silent', runId) : path.resolve('runs', runId);
const publicRunDir = path.resolve('public', 'runs', runId);
await mkdir(runDir, {recursive: true}); if (!silent) await mkdir(publicRunDir, {recursive: true});
const started = Date.now();
const manifest: Record<string, unknown> = {runId, mode: silent ? 'silent-evaluation' : 'standard', prompt: topic, targetDurationSeconds: seconds, voice: voiceGender || 'default', captions: captionsEnabled, music: musicEnabled, language: 'English', aspectRatio: '9:16', status: 'running', startedAt: new Date().toISOString(), stages: {}};
const saveManifest = async () => writeFile(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const stage = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
  const begin = Date.now(); const stages = manifest.stages as Record<string, unknown>;
  stages[name] = {status: 'running', startedAt: new Date().toISOString()}; await saveManifest();
  try { const output = await fn(); stages[name] = {status: 'succeeded', elapsedMs: Date.now() - begin}; await saveManifest(); return output; }
  catch (error) { stages[name] = {status: 'failed', elapsedMs: Date.now() - begin, error: error instanceof Error ? error.message : String(error)}; await saveManifest(); throw error; }
};

try {
  let storyboard: Storyboard;
  let scriptMeta: unknown;
  if (demo) {
    const scienceStories: Record<string, unknown> = {
      api: apiStoryboard,
      photosynthesis: {title: 'How Photosynthesis Works', target_audience: 'Curious beginners', learning_objective: 'Explain how plants use light, water, and carbon dioxide to make sugar and release oxygen.', scenes: [
        {scene_id: 1, narration_text: 'Photosynthesis is how plants capture sunlight and store its energy as food. It happens mostly in the leaves.', on_screen_text: 'A leaf catches sunlight', visual_type: 'analogy', visual_description: 'Sunlight streams onto a green leaf, where the process begins.', key_elements: ['sunlight', 'leaf', 'chlorophyll'], estimated_duration_seconds: 5},
        {scene_id: 2, narration_text: 'Roots absorb water from the soil. Tiny tubes carry that water upward through the stem to the leaves.', on_screen_text: 'Water travels up', visual_type: 'process', visual_description: 'Blue water droplets travel from the roots into the leaf.', key_elements: ['water', 'roots', 'stem'], estimated_duration_seconds: 5},
        {scene_id: 3, narration_text: 'Leaves also take in carbon dioxide, or CO2, from the air through tiny openings on their surface.', on_screen_text: 'CO2 enters the leaf', visual_type: 'diagram', visual_description: 'Carbon dioxide bubbles drift through leaf pores toward the green cells.', key_elements: ['CO2', 'air', 'leaf pores'], estimated_duration_seconds: 6},
        {scene_id: 4, narration_text: 'Inside leaf cells, chlorophyll helps convert light energy, water, and carbon dioxide into glucose, a sugar the plant can use.', on_screen_text: 'Light becomes stored energy', visual_type: 'diagram', visual_description: 'Inputs meet inside the leaf and become a simple sugar molecule.', key_elements: ['light', 'water', 'CO2', 'glucose'], estimated_duration_seconds: 8},
        {scene_id: 5, narration_text: 'Oxygen is released into the air. The plant uses glucose to grow and to power its life processes.', on_screen_text: 'Sugar stays, oxygen leaves', visual_type: 'summary', visual_description: 'Glucose remains with the plant while oxygen bubbles float away.', key_elements: ['glucose', 'oxygen', 'growth'], estimated_duration_seconds: 6}
      ]},
      rain: {title: 'How Rain Forms', target_audience: 'Curious beginners', learning_objective: 'Explain evaporation, condensation, precipitation, and how water returns to the surface.', scenes: [
        {scene_id: 1, narration_text: 'The Sun warms water in oceans, lakes, and rivers. Some of that liquid water changes into invisible water vapor.', on_screen_text: 'The Sun warms water', visual_type: 'process', visual_description: 'Warm sunlight reaches the ocean as water begins to rise.', key_elements: ['Sun', 'ocean', 'heat'], estimated_duration_seconds: 5},
        {scene_id: 2, narration_text: 'The water vapor rises through the air. Higher up, the air is cooler, so the vapor cools too.', on_screen_text: 'Water vapor rises', visual_type: 'process', visual_description: 'Tiny vapor particles rise from the ocean toward cooler air.', key_elements: ['water vapor', 'rising air', 'cooling'], estimated_duration_seconds: 6},
        {scene_id: 3, narration_text: 'As the vapor cools, it condenses onto tiny particles in the air and forms little liquid droplets in clouds.', on_screen_text: 'Droplets gather in clouds', visual_type: 'diagram', visual_description: 'A cloud forms as many small droplets collect together.', key_elements: ['cooling', 'droplets', 'cloud'], estimated_duration_seconds: 6},
        {scene_id: 4, narration_text: 'Droplets bump together and grow. When they become large and heavy enough, gravity pulls them down as rain.', on_screen_text: 'Heavy drops fall', visual_type: 'process', visual_description: 'Growing blue raindrops fall from a cloud toward the ground.', key_elements: ['growing drops', 'gravity', 'rain'], estimated_duration_seconds: 7},
        {scene_id: 5, narration_text: 'Rain flows into soil, streams, and lakes, and eventually returns to the ocean. Then the cycle can begin again.', on_screen_text: 'Water returns to the cycle', visual_type: 'summary', visual_description: 'Rainwater collects and flows back into the ocean beneath the cloud.', key_elements: ['runoff', 'rivers', 'ocean'], estimated_duration_seconds: 6}
      ]}
    };
    storyboard = StoryboardSchema.parse(scienceStories[demoName || ''] || {title: 'How database indexes speed up searches', target_audience: 'Curious beginners', learning_objective: 'Understand how an index helps a database find rows without checking every row.', scenes: [
      {scene_id: 1, narration_text: 'Imagine a library with thousands of books. Finding one by scanning every shelf would take a long time.', on_screen_text: 'Finding one book', visual_type: 'analogy', visual_description: 'A huge library stretches into the distance, with one highlighted book far away.', key_elements: ['library', 'shelves', 'highlighted book'], estimated_duration_seconds: 12},
      {scene_id: 2, narration_text: 'A database index works like the catalog at the front desk. It maps a value, such as a title, to the place where the matching row is stored.', on_screen_text: 'The index is a catalog', visual_type: 'diagram', visual_description: 'A catalog card points through a simple arrow to one highlighted row in a table.', key_elements: ['catalog card', 'arrow', 'table row'], estimated_duration_seconds: 20},
      {scene_id: 3, narration_text: 'Without an index, the database may check rows one by one. With a suitable index, it can jump toward matching rows much faster.', on_screen_text: 'Scan or jump', visual_type: 'process', visual_description: 'Two paths compare many table rows being scanned against a quick arrow to the matching record.', key_elements: ['many rows', 'fast path', 'matching record'], estimated_duration_seconds: 18},
      {scene_id: 4, narration_text: 'Indexes take extra storage and can slow down updates because the index must also be maintained. They are useful when faster lookups are worth that tradeoff.', on_screen_text: 'Faster reads, extra work', visual_type: 'summary', visual_description: 'A balanced scale weighs quicker searches against storage and update work.', key_elements: ['search speed', 'storage', 'updates'], estimated_duration_seconds: 10}
    ]});
    scriptMeta = {provider: 'demo', attempts: 0};
  } else if (storyboardFile) {
    storyboard = StoryboardSchema.parse(JSON.parse(await readFile(storyboardFile, 'utf8')));
    scriptMeta = {provider: 'file', source: path.relative(process.cwd(), path.resolve(storyboardFile)), note: 'Storyboard reused from an earlier Gemini run; no Gemini call in this run.'};
  } else {
    const result = await stage('storyboard', () => createStoryboard(topic, seconds)); storyboard = result.storyboard; scriptMeta = result;
  }
  await writeFile(path.join(runDir, 'storyboard.json'), JSON.stringify(storyboard, null, 2));
  manifest.storyboard = scriptMeta;
  const narrationText = storyboard.scenes.map((scene) => scene.narration_text).join('\n\n');
  // ElevenLabs bills by characters of submitted text.
  manifest.metrics = {narrationCharacters: narrationText.length, narrationWords: narrationText.split(/\s+/).filter(Boolean).length};
  let audioPath = '';
  let captionCues: {start: number; end: number; text: string}[] = [];
  let actualSeconds: number = seconds;
  let composition = 'ExplainerVideo';
  let renderProps: unknown;
  let sceneStarts: number[] | undefined;
  let wordTimes: {text: string; start: number; end: number}[] | undefined;
  if (demoName === 'api') {
    const {props, meta} = await stage('narration', () => buildApiVideo(storyboard, runDir, publicRunDir, runId, seconds, voiceGender));
    manifest.narration = meta; composition = 'ApiExplainer'; renderProps = props; actualSeconds = props.seconds;
  } else if (silent) {
    // No narration call at all. Timings are estimated from the text and labelled as such (see pipeline/silent-timing).
    const timing = silentTiming(storyboard.scenes.map((scene) => scene.narration_text));
    captionCues = splitCuesAtScenes(timing.captionCues, timing.words, timing.sceneStarts); sceneStarts = timing.sceneStarts; wordTimes = timing.words; actualSeconds = timing.seconds;
    manifest.narration = {provider: 'none', mode: 'silent-evaluation', sceneTiming: 'estimated', wordTiming: 'estimated', note: 'No narration audio. Scene and word timings are estimated from the text with the M7 speech model, not measured.'};
  } else if (demo && !demoWithSpeech) {
    audioPath = '';
    manifest.narration = {provider: 'none', note: 'Demo render contains captions and visuals only.'};
  } else {
    const localAudio = path.join(runDir, 'narration.mp3');
    // Loaded only on this path, so silent and demo runs never touch the narration provider.
    const {createNarration} = await import('./providers/elevenlabs.js');
    const audio = await stage('narration', () => createNarration(narrationText, localAudio, voiceGender));
    await copyFile(localAudio, path.join(publicRunDir, 'narration.mp3'));
    // Keep at least 0.4 s after the last word so speech never ends exactly on the final frame.
    audioPath = `runs/${runId}/narration.mp3`; captionCues = audio.captionCues; actualSeconds = Math.max(1, Math.ceil(audio.durationSeconds + 0.4));
    // Scene changes follow when each scene's first word is actually spoken (falls back to estimates if timings don't line up).
    sceneStarts = sceneStartsFromWords(storyboard.scenes.map((scene) => scene.narration_text), audio.words) ?? undefined;
    wordTimes = audio.words;
    // A caption never spans a scene change (it would show the next scene's words under the previous diagram).
    captionCues = splitCuesAtScenes(captionCues, audio.words, sceneStarts);
    const {captionCues: _cues, words: _words, ...audioMeta} = audio; manifest.narration = {...audioMeta, sceneTiming: sceneStarts ? 'narration-aligned' : 'estimated'};
  }
  manifest.actualDurationSeconds = actualSeconds;
  manifest.durationDifferenceSeconds = actualSeconds - seconds;
  manifest.status = 'rendering'; await saveManifest();
  const outputPath = path.join(runDir, 'video.mp4');
  const propsPath = path.join(runDir, 'render-props.json');
  await writeFile(propsPath, JSON.stringify(renderProps ?? {storyboard, audioPath, seconds: actualSeconds, captionCues, sceneStarts, wordTimes, handwrittenSteps: demo, captions: captionsEnabled, musicPath: musicEnabled ? 'assets/soft-pad.wav' : '', ...(silent ? {badge: 'SILENT EVALUATION · estimated timing'} : {})}));
  if (skipRender) {
    manifest.renderSkipped = true; manifest.status = 'succeeded'; manifest.elapsedMs = Date.now() - started; manifest.finishedAt = new Date().toISOString(); await saveManifest();
    console.log(`
Render skipped. Run manifest: ${path.join(runDir, 'manifest.json')}`);
    process.exit(0);
  }
  await stage('render', async () => {
    const cli = path.resolve('node_modules', '@remotion', 'cli', 'remotion-cli.js');
    await execFileAsync(process.execPath, [cli, 'render', 'src/video/index.tsx', composition, outputPath, `--props=${propsPath}`, ...(renderProps ? [] : [`--duration=${actualSeconds * 30}`]), '--codec=h264', '--crf=18', '--log=error'], {windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  });
  manifest.metrics = {...(manifest.metrics as object), outputBytes: (await stat(outputPath)).size};
  manifest.status = 'succeeded'; manifest.output = path.relative(process.cwd(), outputPath); manifest.elapsedMs = Date.now() - started; manifest.finishedAt = new Date().toISOString();
  await saveManifest();
  console.log(`\nVideo saved: ${outputPath}\nRun manifest: ${path.join(runDir, 'manifest.json')}`);
} catch (error) {
  manifest.status = 'failed'; manifest.elapsedMs = Date.now() - started; manifest.finishedAt = new Date().toISOString(); manifest.error = error instanceof Error ? error.message : String(error); await saveManifest();
  console.error(`\nRun failed: ${String(error)}\nArtifacts: ${runDir}`); process.exitCode = 1;
}
