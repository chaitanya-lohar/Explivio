// M7 template gallery: renders still frames of every animated template from a synthetic storyboard, locally.
// No API calls (no Gemini, no ElevenLabs): word timings are simulated from each scene's narration text.
// Usage: npm run m7:gallery [-- --only=flow,cycle]   → runs/m7-gallery/*.png (gitignored)
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const SCENE_SECONDS = 8;
const WORD_SECONDS = 0.36;
const FPS = 30;

const v1 = {visual_description: 'gallery', estimated_duration_seconds: SCENE_SECONDS};
const SCENES = [
  {name: 'flow', on_screen_text: 'How a web page reaches you', visual_type: 'process', key_elements: [], narration_text: 'Your browser sends a request through your home router, across internet cables, to a web server.',
    visual: {template: 'flow', nodes: ['Your browser', 'Home router', 'Internet cables', 'Web server'], edge_labels: ['sends a request', '', 'arrives at']}},
  {name: 'flow-6', on_screen_text: 'From field to plate', visual_type: 'process', key_elements: [], narration_text: 'Farmers grow wheat, mills grind flour, bakeries bake bread, trucks deliver loaves, shops sell them, and families eat.',
    visual: {template: 'flow', nodes: ['Farm grows wheat', 'Mill grinds flour', 'Bakery bakes bread', 'Trucks deliver', 'Shop sells loaves', 'Family eats']}},
  {name: 'cycle', on_screen_text: 'The water cycle', visual_type: 'diagram', key_elements: [], narration_text: 'Water evaporates, the vapour condenses into clouds, precipitation falls, and collection in oceans starts it again.',
    visual: {template: 'cycle', stages: ['Evaporation', 'Condensation', 'Precipitation', 'Collection']}},
  {name: 'cycle-3', on_screen_text: 'Habits form in a loop', visual_type: 'diagram', key_elements: [], narration_text: 'A cue triggers a routine, the routine brings a reward, and the reward strengthens the cue.',
    visual: {template: 'cycle', stages: ['Cue', 'Routine', 'Reward']}},
  {name: 'cycle-6', on_screen_text: 'The cell cycle', visual_type: 'diagram', key_elements: [], narration_text: 'The cell grows, copies its DNA, grows again, divides its nucleus in mitosis, splits in cytokinesis, then rests.',
    visual: {template: 'cycle', stages: ['Growth', 'DNA copied', 'More growth', 'Mitosis', 'Cytokinesis', 'Rest']}},
  {name: 'comparison-vs', on_screen_text: 'Prime or composite?', visual_type: 'analogy', key_elements: [], narration_text: 'Prime numbers have exactly two factors, like seven. Composite numbers have more factors, like twelve.',
    visual: {template: 'comparison', relation: 'vs', left: {title: 'Prime', points: ['Exactly two factors', 'Example: 7']}, right: {title: 'Composite', points: ['More than two factors', 'Example: 12']}}},
  {name: 'comparison-like', on_screen_text: 'Your heart is a pump', visual_type: 'analogy', key_elements: [], narration_text: 'Your heart works like a water pump: it squeezes to push blood, just as a pump pushes water through pipes.',
    visual: {template: 'comparison', relation: 'like', left: {title: 'Your heart', points: ['Squeezes', 'Pushes blood']}, right: {title: 'A water pump', points: ['Compresses', 'Pushes water']}}},
  {name: 'fallback-compare', on_screen_text: 'An API is a waiter', visual_type: 'analogy', key_elements: ['API', 'Restaurant waiter'], narration_text: 'An API works like a restaurant waiter who carries your order to the kitchen.'},
  {name: 'fallback-steps', on_screen_text: 'Making a cup of tea', visual_type: 'process', key_elements: ['1. Boil water', '2. Steep the tea', '3. Add milk'], narration_text: 'Boil the water, steep the tea for three minutes, then add milk.'},
  {name: 'fallback-hub', on_screen_text: 'Parts of a cell', visual_type: 'diagram', key_elements: ['Cell', 'Nucleus', 'Membrane', 'Mitochondria'], narration_text: 'A cell has a nucleus, a membrane and mitochondria.'},
  {name: 'fallback-checklist', on_screen_text: 'Remember these', visual_type: 'summary', key_elements: ['Plants need light', 'Water from roots', 'Oxygen released'], narration_text: 'Plants need light, take water from their roots, and release oxygen.'},
  {name: 'fallback-focus', on_screen_text: 'Why is the sky blue?', visual_type: 'title', key_elements: ['Sunlight', 'Scattering'], narration_text: 'Why is the sky blue? It comes down to sunlight and scattering.'}
];

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const scenes = SCENES.filter((s) => !only || only.includes(s.name));
const sceneStarts = scenes.map((_, i) => i * SCENE_SECONDS);
const wordTimes = scenes.flatMap((s, i) => s.narration_text.split(/\s+/).map((text, w) => ({text, start: sceneStarts[i] + 0.3 + w * WORD_SECONDS, end: sceneStarts[i] + 0.3 + w * WORD_SECONDS + 0.3})));
const seconds = scenes.length * SCENE_SECONDS;
const props = {
  storyboard: {title: 'Template gallery', target_audience: 'Reviewers', learning_objective: 'See every template', scenes: scenes.map(({name: _name, ...s}, i) => ({scene_id: i + 1, ...v1, ...s}))},
  audioPath: '', seconds, captionCues: [], captions: false, musicPath: '', sceneStarts, wordTimes
};

const outDir = path.resolve('runs', 'm7-gallery');
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, 'props.json'), JSON.stringify(props, null, 2));
console.log(`Bundling… (${scenes.length} scenes)`);
const serveUrl = await bundle({entryPoint: path.resolve('src/video/index.tsx')});
const composition = await selectComposition({serveUrl, id: 'ExplainerVideo', inputProps: props});
composition.durationInFrames = seconds * FPS;
for (const [i, scene] of scenes.entries()) {
  // "mid": about half the narration spoken; "end": everything revealed.
  const words = scene.narration_text.split(/\s+/).length;
  const frames = {mid: Math.round((sceneStarts[i] + 0.3 + (words / 2) * WORD_SECONDS) * FPS), end: Math.round((sceneStarts[i] + SCENE_SECONDS - 0.7) * FPS)};
  for (const [when, frame] of Object.entries(frames)) {
    const output = path.join(outDir, `${scene.name}-${when}.png`);
    await renderStill({serveUrl, composition, inputProps: props, frame, output, imageFormat: 'png'});
    console.log(`  ${path.relative(process.cwd(), output)}`);
  }
}
console.log('Done.');
