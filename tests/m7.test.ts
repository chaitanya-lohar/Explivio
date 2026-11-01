import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VisualSchema, TEMPLATE_NAMES} from '../src/schemas/visual.js';
import {StoryboardSchema} from '../src/schemas/storyboard.js';
import {fallbackVisual, resolveVisual} from '../src/pipeline/visual-plan.js';
import {keywords, mentionTimes} from '../src/pipeline/mention-timing.js';

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
