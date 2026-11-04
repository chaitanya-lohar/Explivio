import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VisualSchema, TEMPLATE_NAMES} from '../src/schemas/visual.js';
import {StoryboardSchema} from '../src/schemas/storyboard.js';
import {fallbackVisual, resolveVisual, revealLabels} from '../src/pipeline/visual-plan.js';
import {keywords, mentionTimes, stem} from '../src/pipeline/mention-timing.js';
import {bodyKind, forwardTo, markerAngle, orbitPoint, orbiterAngle} from '../src/pipeline/orbit-geometry.js';

const scene = (extra: Record<string, unknown> = {}) => ({scene_id: 1, narration_text: 'n', on_screen_text: 'Title', visual_type: 'process', visual_description: 'd', key_elements: ['First', 'Second', 'Third'], estimated_duration_seconds: 5, ...extra});

// WS2 — scene-planning format.
test('all six M7 templates and the four M6 layouts are in the schema', () => {
  for (const name of ['orbit', 'cycle', 'layers', 'flow', 'timeline', 'comparison', 'steps', 'hub', 'checklist', 'focus']) assert.ok(TEMPLATE_NAMES.includes(name as never), name);
});
test('valid template data is accepted; defaults fill in', () => {
  const v = VisualSchema.parse({template: 'comparison', left: {title: 'Prime'}, right: {title: 'Composite'}, relation: 'vs'});
  assert.equal(v.template, 'comparison');
  assert.deepEqual(v.template === 'comparison' && v.left.points, []);
  assert.equal(VisualSchema.safeParse({template: 'cycle', stages: ['a', 'b']}).success, false, 'cycle needs 3+ stages');
  assert.equal(VisualSchema.safeParse({template: 'flow', nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g']}).success, false, 'flow max 6 nodes');
});
test('backward compatibility: v1 storyboards (no visual) still parse', () => {
  const board = {title: 't', target_audience: 'a', learning_objective: 'o', scenes: [scene(), scene({scene_id: 2}), scene({scene_id: 3})]};
  assert.equal(StoryboardSchema.parse(board).scenes.length, 3);
});
test('one malformed visual does not reject the storyboard; that scene falls back', () => {
  const board = StoryboardSchema.parse({title: 't', target_audience: 'a', learning_objective: 'o', scenes: [scene({visual: {template: 'cycle', stages: ['only one']}}), scene({scene_id: 2}), scene({scene_id: 3, visual: {template: 'flow', nodes: ['Router', 'Cables', 'Server']}})]});
  const first = resolveVisual(board.scenes[0]);
  assert.equal(first.source, 'fallback');
  assert.match(first.problem ?? '', /stages/);
  assert.equal(first.visual.template, 'steps');
  const third = resolveVisual(board.scenes[2]);
  assert.equal(third.source, 'template');
  assert.equal(third.visual.template, 'flow');
});
test('fallback reproduces the M6 layouts in the v2 format', () => {
  assert.deepEqual(fallbackVisual(scene({visual_type: 'process', key_elements: ['1. A', '2. B']})), {template: 'steps', steps: ['A', 'B']});
  assert.equal(fallbackVisual(scene({visual_type: 'diagram'})).template, 'hub');
  assert.equal(fallbackVisual(scene({visual_type: 'analogy', key_elements: ['A', 'B']})).template, 'comparison');
  assert.equal(fallbackVisual(scene({visual_type: 'summary'})).template, 'checklist');
  assert.equal(fallbackVisual(scene({visual_type: 'title', key_elements: []})).template, 'focus');
  assert.equal(resolveVisual(scene()).problem, 'no visual');
});

// WS1 — reveal-on-mention timing.
const spoken = (text: string, start = 10, step = 0.4) => text.split(' ').map((w, i) => ({text: w, start: start + i * step, end: start + i * step + 0.3}));
test('label keywords skip short words and stopwords and are stemmed', () => {
  assert.deepEqual(keywords('The Moon orbits Earth'), ['moon', 'orbit', 'earth']);
});
test('items reveal when first mentioned in the scene', () => {
  const words = spoken('First water evaporates then vapour condenses into clouds and rain falls');
  const t = mentionTimes(['Evaporation', 'Condensation', 'Rain'], words, 10, 16);
  assert.deepEqual(t.map((x) => +x.toFixed(1)), [10.8, 12, 13.6]); // evaporates = word 2, condenses = word 5, rain = word 9
});
test('unmentioned items are spaced evenly; ordered reveals never go backwards', () => {
  const words = spoken('servers reply after the router forwards packets');
  const t = mentionTimes(['Router', 'Unrelated label', 'Server'], words, 10, 20);
  assert.ok(t[0] < t[1] && t[1] <= t[2], `ordered: ${t}`);
  assert.equal(+t[0].toFixed(1), 11.6, 'router mentioned at word 5');
  const unordered = mentionTimes(['Router', 'Server'], words, 10, 20, false);
  assert.ok(unordered[1] < unordered[0], 'server is spoken before router');
});
test('mentions outside the scene are ignored', () => {
  const t = mentionTimes(['Moon'], spoken('the moon', 30), 10, 20);
  assert.ok(t[0] >= 10 && t[0] <= 20);
});

test('reveal labels follow each template, with order only where it matters', () => {
  assert.deepEqual(revealLabels({template: 'flow', nodes: ['A', 'B']}), {labels: ['A', 'B'], ordered: true});
  assert.deepEqual(revealLabels({template: 'comparison', left: {title: 'L', points: ['l1']}, right: {title: 'R', points: []}, relation: 'vs'}), {labels: ['L', 'l1', 'R'], ordered: false});
  assert.equal(revealLabels({template: 'cycle', stages: ['a', 'b', 'c']}).ordered, true);
});
test('stems match short words and their plural or verb forms', () => {
  for (const [a, b] of [['rests', 'Rest'], ['cables', 'Cable'], ['growing', 'grow'], ['batteries', 'battery'], ['orbits', 'orbit'], ['pushes', 'push'], ['boxes', 'box']]) assert.equal(stem(a), stem(b), `${a} ~ ${b}`);
  assert.notEqual(stem('bus'), stem('bud'));
});
test('a label is timed where most of its words are said together', () => {
  const words = spoken('it squeezes to push blood just as a pump pushes water through pipes');
  const [blood, water] = mentionTimes(['Pushes blood', 'Pushes water'], words, 10, 20, false);
  assert.equal(+blood.toFixed(1), 11.2, 'push blood = words 3-4');
  assert.equal(+water.toFixed(1), 13.6, 'pushes water = words 9-10, not the earlier lone "push"');
});

// WS1 step 3 — orbit, layers, timeline.
test('all six M7 templates (and the M6 layouts) have a renderer', async () => {
  const {RENDERED_TEMPLATES} = await import('../src/video/templates/index.js');
  for (const name of TEMPLATE_NAMES) assert.ok(RENDERED_TEMPLATES.includes(name), name);
});
test('orbit: with a light source, marker 1 faces it (new moon between Earth and Sun); markers go counterclockwise', () => {
  assert.equal(markerAngle(0, 4, true), Math.PI, 'first marker on the lit (left) side');
  assert.equal(+markerAngle(2, 4, true).toFixed(4), +(2 * Math.PI).toFixed(4), 'full moon opposite the light (right)');
  const firstQuarter = orbitPoint(markerAngle(1, 4, true), 0, 0, 10, 10);
  assert.ok(firstQuarter.y > 9, 'counterclockwise from the left goes down on screen');
  assert.equal(markerAngle(0, 2, false), Math.PI / 2, 'unlit orbits start at the top');
});
test('orbit: the orbiter glides forward to each mentioned marker and never moves backwards', () => {
  const opts = {startFrame: 10, startAngle: 0, turnFrames: 240, markerFrames: [60, 120], markerAngles: [Math.PI, Math.PI / 2], glideFrames: 20, holdFrames: 30};
  let previous = -Infinity;
  for (let f = 0; f < 260; f++) { const a = orbiterAngle(f, opts); assert.ok(a >= previous - 1e-9, `frame ${f}`); previous = a; }
  assert.equal(+(orbiterAngle(85, opts) % (2 * Math.PI)).toFixed(4), +Math.PI.toFixed(4), 'waits at marker 1 after gliding');
  assert.equal(+(orbiterAngle(145, opts) % (2 * Math.PI)).toFixed(4), +(Math.PI / 2).toFixed(4), 'then at marker 2 (forward, a full lap if needed)');
  assert.equal(orbiterAngle(5, opts), 0, 'still before it appears');
  assert.equal(forwardTo(3, 1), 1 + 2 * Math.PI);
});
test('orbit: body colours come from the label only', () => {
  assert.equal(bodyKind('The Sun'), 'star');
  assert.equal(bodyKind('Earth'), 'earth');
  assert.equal(bodyKind('Moon'), 'moon');
  assert.equal(bodyKind('Jupiter'), 'planet');
  assert.equal(bodyKind('Electron'), 'other');
});
test('layers: stack is the default, nested is accepted; colours are hex (alpha suffix safe)', async () => {
  const stack = VisualSchema.parse({template: 'layers', layers: [{label: 'Crust'}, {label: 'Mantle'}]});
  assert.equal(stack.template === 'layers' && stack.arrangement, 'stack');
  assert.equal(VisualSchema.safeParse({template: 'layers', arrangement: 'nested', layers: [{label: 'A'}, {label: 'B'}]}).success, true);
  assert.equal(VisualSchema.safeParse({template: 'layers', arrangement: 'spiral', layers: [{label: 'A'}, {label: 'B'}]}).success, false);
  const {layerColor} = await import('../src/video/templates/layers.js');
  for (let i = 0; i < 6; i++) assert.match(layerColor(i, 6), /^#[0-9a-f]{6}$/);
});
test('timeline: dates are optional (never forced); reveal labels include a date only when given', () => {
  const v = VisualSchema.parse({template: 'timeline', events: [{label: 'Gas cloud collapses'}, {when: '1991', label: 'Web goes public'}]});
  assert.deepEqual(revealLabels(v), {labels: ['Gas cloud collapses', 'Web goes public 1991'], ordered: true});
});

// F9 — known issue K5: captions must not span a scene change.
test('caption cues that straddle a scene change are split at it; others are untouched', async () => {
  const {splitCuesAtScenes} = await import('../src/pipeline/scene-timing.js');
  const words = [{text: 'night', start: 0, end: 0.3}, {text: 'sky?', start: 0.4, end: 0.8}, {text: 'The', start: 1.2, end: 1.3}, {text: 'Moon', start: 1.4, end: 1.7}, {text: 'shines.', start: 1.8, end: 2.2}];
  const cues = [{start: 0, end: 1.7, text: 'night sky? The Moon'}, {start: 1.8, end: 2.2, text: 'shines.'}];
  assert.deepEqual(splitCuesAtScenes(cues, words, [0, 1.2]), [{start: 0, end: 0.8, text: 'night sky?'}, {start: 1.2, end: 1.7, text: 'The Moon'}, {start: 1.8, end: 2.2, text: 'shines.'}]);
  assert.deepEqual(splitCuesAtScenes(cues, words, undefined), cues, 'no scene timing: unchanged');
  assert.deepEqual(splitCuesAtScenes(cues, words, [0, 5]), cues, 'no straddling cue: unchanged');
});
