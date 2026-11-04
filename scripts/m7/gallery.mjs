// M7 template gallery: renders still frames of every animated template from a synthetic storyboard, locally.
// No API calls (no Gemini, no ElevenLabs): word timings are simulated from each scene's narration text.
// Usage: npm run m7:gallery [-- --only=flow,cycle]   → runs/m7-gallery/*.png (gitignored)
// Also a render smoke test: every "end" still must show content in the diagram area, otherwise the command fails.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {decodePng, litShare} from './png.mjs';

const SCENE_SECONDS = 9;
const WORD_SECONDS = 0.36;
const FPS = 30;

const v1 = {visual_description: 'gallery', estimated_duration_seconds: SCENE_SECONDS};
const SCENES = [
  {name: 'orbit-moon-phases', on_screen_text: 'Why the Moon has phases', visual_type: 'diagram', key_elements: [], narration_text: 'The Moon orbits Earth while sunlight always lights half of it. At new moon we see the dark side, at first quarter half, at full moon all of it, then last quarter.',
    visual: {template: 'orbit', center: 'Earth', orbiter: 'Moon', light: 'Sunlight', markers: ['New moon', 'First quarter', 'Full moon', 'Last quarter']}},
  {name: 'orbit-earth-sun', on_screen_text: 'One trip around the Sun', visual_type: 'diagram', key_elements: [], narration_text: 'Earth travels around the Sun once a year. In the north, June brings summer and December brings winter.',
    visual: {template: 'orbit', center: 'Sun', orbiter: 'Earth', markers: ['June: northern summer', 'December: northern winter']}},
  {name: 'layers-atmosphere', on_screen_text: 'Layers of the atmosphere', visual_type: 'diagram', key_elements: [], narration_text: 'From the top down: the exosphere fades into space, the thermosphere holds auroras, the mesosphere burns up meteors, the stratosphere holds the ozone layer, and the troposphere is where weather happens.',
    visual: {template: 'layers', layers: [{label: 'Exosphere', note: 'Fades into space'}, {label: 'Thermosphere', note: 'Auroras'}, {label: 'Mesosphere', note: 'Meteors burn up'}, {label: 'Stratosphere', note: 'Ozone layer'}, {label: 'Troposphere', note: 'Weather happens here'}]}},
  {name: 'layers-earth-nested', on_screen_text: 'Inside the Earth', visual_type: 'diagram', key_elements: [], narration_text: 'Earth has a thin rocky crust, a thick hot mantle, a liquid outer core and a solid inner core.',
    visual: {template: 'layers', arrangement: 'nested', layers: [{label: 'Crust'}, {label: 'Mantle'}, {label: 'Outer core'}, {label: 'Inner core'}]}},
  {name: 'timeline-internet', on_screen_text: 'How the internet grew', visual_type: 'process', key_elements: [], narration_text: 'In 1969 ARPANET sent its first message. In 1983 networks adopted TCP/IP. In 1991 the World Wide Web went public, and in 2007 smartphones put it in our pockets.',
    visual: {template: 'timeline', events: [{when: '1969', label: 'ARPANET sends first message'}, {when: '1983', label: 'Networks adopt TCP/IP'}, {when: '1991', label: 'World Wide Web goes public'}, {when: '2007', label: 'Smartphones go mainstream'}]}},
  {name: 'timeline-undated', on_screen_text: 'How a star is born', visual_type: 'process', key_elements: [], narration_text: 'A cloud of gas collapses, a protostar forms, fusion ignites, and a main-sequence star shines for billions of years.',
    visual: {template: 'timeline', events: [{label: 'Gas cloud collapses'}, {label: 'Protostar forms'}, {label: 'Fusion ignites'}, {label: 'Main-sequence star'}]}},
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
const failures = [];
for (const [i, scene] of scenes.entries()) {
  // "mid": about half the narration spoken; "end": everything revealed.
  const words = scene.narration_text.split(/\s+/).length;
  const frames = {mid: Math.round((sceneStarts[i] + 0.3 + (words / 2) * WORD_SECONDS) * FPS), end: Math.round((sceneStarts[i] + SCENE_SECONDS - 0.7) * FPS)};
  for (const [when, frame] of Object.entries(frames)) {
    const output = path.join(outDir, `${scene.name}-${when}.png`);
    await renderStill({serveUrl, composition, inputProps: props, frame, output, imageFormat: 'png'});
    // Diagram area (below the headline, above the footer): must not be empty once everything is revealed.
    const share = litShare(decodePng(await readFile(output)), {x0: 70, y0: 560, x1: 1010, y1: 1380});
    const blank = when === 'end' && share < 0.01;
    if (blank) failures.push(scene.name);
    console.log(`  ${path.relative(process.cwd(), output)}  diagram content ${(share * 100).toFixed(1)}%${blank ? '  ← BLANK' : ''}`);
  }
}
if (failures.length) { console.error(`Blank diagram in: ${failures.join(', ')}`); process.exit(1); }
console.log(`Done: ${scenes.length} scenes, none blank.`);
