import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StoryboardSchema} from '../src/schemas/storyboard.js';
import type {Visual} from '../src/schemas/visual.js';
import {dropFlaggedVisuals, lintVisualPlan, parseYear, sceneVisualProblems, visualRepairNote} from '../src/pipeline/visual-lint.js';
import {resolveVisual} from '../src/pipeline/visual-plan.js';
import {VISUAL_GUIDE} from '../src/pipeline/visual-guide.js';

// M7 step 4 — template selection follows the educational relationship; plans that contradict their narration are caught.
const scene = (id: number, narration: string, visual?: unknown) => ({scene_id: id, narration_text: narration, on_screen_text: 'Title', visual_type: 'diagram', visual_description: 'd', key_elements: ['First idea', 'Second idea'], estimated_duration_seconds: 8, ...(visual ? {visual} : {})});
const board = (...scenes: ReturnType<typeof scene>[]) => StoryboardSchema.parse({title: 't', target_audience: 'a', learning_objective: 'o', scenes});
const problems = (visual: Visual, narration: string) => sceneVisualProblems(visual, narration);

test('a correct orbit plan passes', () => {
  assert.deepEqual(problems({template: 'orbit', center: 'Earth', orbiter: 'Moon', light: 'Sunlight', markers: ['New moon', 'Full moon']}, 'The Moon orbits Earth while sunlight lights half of it, from new moon to full moon.'), []);
});
test('orbit: the Sun at the centre of a Moon orbit is rejected', () => {
  const p = problems({template: 'orbit', center: 'Sun', orbiter: 'Moon', markers: []}, 'The Moon orbits around us while the Sun lights it.');
  assert.ok(p.some((x) => /Moon orbits Earth, not the Sun/.test(x)), p.join(' | '));
});
test('orbit: planets orbit the Sun, not the Moon or Earth', () => {
  assert.ok(problems({template: 'orbit', center: 'Moon', orbiter: 'Earth', markers: []}, 'Earth goes around the Moon.').some((x) => /planets orbit the Sun/.test(x)));
});
test('orbit: a road route is not an orbit (no motion around a body)', () => {
  const p = problems({template: 'orbit', center: 'Warehouse', orbiter: 'Delivery truck', markers: ['Depot', 'Customer']}, 'The delivery truck drives from the warehouse to the depot, then on to the customer.');
  assert.ok(p.some((x) => /describes no such motion/.test(x)), p.join(' | '));
});
test('cycle: a one-way history is not a cycle', () => {
  const p = problems({template: 'cycle', stages: ['Stone tools', 'Bronze tools', 'Iron tools']}, 'People first used stone tools, then bronze tools, and later iron tools.');
  assert.ok(p.some((x) => /never says it repeats/.test(x)));
  assert.deepEqual(problems({template: 'cycle', stages: ['Evaporation', 'Condensation', 'Precipitation']}, 'Water evaporates, condenses into clouds and falls as precipitation, then the cycle starts again.'), []);
});
test('timeline: dates must be chronological and stated in the narration', () => {
  const narration = 'In 1991 the web went public, after networks adopted TCP/IP in 1983.';
  assert.ok(problems({template: 'timeline', events: [{when: '1991', label: 'Web went public'}, {when: '1983', label: 'Networks adopted TCP/IP'}]}, narration).some((x) => /chronological/.test(x)));
  assert.deepEqual(problems({template: 'timeline', events: [{when: '1983', label: 'Networks adopted TCP/IP'}, {when: '1991', label: 'Web went public'}]}, narration), []);
  const invented = problems({template: 'timeline', events: [{when: '1983', label: 'Networks adopted TCP/IP'}, {when: '1993', label: 'Web went public'}]}, narration);
  assert.ok(invented.some((x) => /not stated in the narration.*1993/.test(x)), invented.join(' | '));
  assert.deepEqual(problems({template: 'timeline', events: [{label: 'Networks adopted TCP/IP'}, {label: 'Web went public'}]}, narration), [], 'undated events are fine');
});
test('parseYear handles years, decades, BC and centuries', () => {
  assert.equal(parseYear('1969'), 1969);
  assert.equal(parseYear('1990s'), 1990);
  assert.equal(parseYear('300 BC'), -300);
  assert.equal(parseYear('c. 1450'), 1450);
  assert.equal(parseYear('18th century'), 1750);
  assert.equal(parseYear('Later'), null);
});
test('comparison: both sides must be named; labels must be spoken', () => {
  assert.ok(problems({template: 'comparison', relation: 'vs', left: {title: 'Prime', points: []}, right: {title: 'Composite', points: []}}, 'Prime numbers have two factors.').some((x) => /both sides/.test(x)));
  assert.ok(problems({template: 'flow', nodes: ['Alpha node', 'Beta node', 'Gamma node']}, 'Data moves through the system.').some((x) => /never said/.test(x)));
});
test('one template for most scenes is flagged', () => {
  const steps = {template: 'steps', steps: ['First idea', 'Second idea']};
  const report = lintVisualPlan(board(...[1, 2, 3, 4].map((i) => scene(i, 'The first idea leads to the second idea.', steps))));
  assert.ok(report.problems.some((x) => /used for 4 of 4/.test(x)));
});
test('older storyboards (no visual) still parse; the lint reports them as fallback, not as an error', () => {
  const report = lintVisualPlan(board(scene(1, 'a b c'), scene(2, 'd e f'), scene(3, 'g h i')));
  assert.ok(report.scenes.every((s) => s.source === 'fallback' && s.problems[0] === 'missing "visual"'));
});
test('after the one repair, scenes still wrong fall back to the M6 layout; good scenes keep their template', () => {
  const sb = board(
    scene(1, 'The Moon orbits Earth.', {template: 'orbit', center: 'Sun', orbiter: 'Moon', markers: []}),
    scene(2, 'Water evaporates and condenses, then the cycle repeats.', {template: 'cycle', stages: ['Water evaporates', 'Condenses', 'Repeats']}),
    scene(3, 'Thanks for watching.')
  );
  const report = lintVisualPlan(sb);
  assert.match(visualRepairNote(report) ?? '', /scene 1 \(orbit\)/);
  const fixed = dropFlaggedVisuals(sb, report);
  assert.equal(resolveVisual(fixed.scenes[0]).source, 'fallback', 'wrong orbit dropped');
  assert.equal(resolveVisual(fixed.scenes[1]).visual.template, 'cycle', 'good scene untouched');
});
test('a fully consistent plan needs no repair', () => {
  const sb = board(
    scene(1, 'The Moon orbits Earth while sunlight lights it.', {template: 'orbit', center: 'Earth', orbiter: 'Moon', light: 'Sunlight', markers: []}),
    scene(2, 'Earth has a crust, a mantle and a core.', {template: 'layers', arrangement: 'nested', layers: [{label: 'Crust'}, {label: 'Mantle'}, {label: 'Core'}]}),
    scene(3, 'Water evaporates, condenses and falls, then repeats.', {template: 'cycle', stages: ['Evaporates', 'Condenses', 'Falls']})
  );
  assert.equal(visualRepairNote(lintVisualPlan(sb)), null);
});
test('the prompt guide describes every template and the key relationship rules', () => {
  for (const t of ['flow', 'cycle', 'orbit', 'layers', 'timeline', 'comparison', 'steps', 'hub', 'checklist', 'focus']) assert.ok(VISUAL_GUIDE.includes(`"${t}"`), t);
  assert.match(VISUAL_GUIDE, /Earth for the Moon/);
  assert.match(VISUAL_GUIDE, /never invent dates/);
  assert.match(VISUAL_GUIDE, /only when the narration says it repeats/);
});

test('an unknown visual_type no longer rejects the storyboard (it only picks the fallback layout)', () => {
  const sb = board(scene(1, 'a b c'), {...scene(2, 'd e f'), visual_type: 'comparison'} as never, scene(3, 'g h i'));
  assert.equal(sb.scenes[1].visual_type, 'diagram');
});
test('the storyboard request allows at most one correction', async () => {
  const {readFileSync} = await import('node:fs');
  const src = readFileSync('src/providers/gemini.ts', 'utf8');
  assert.match(src, /if \(repairNote\) throw new Error\(`Gemini storyboard still failed validation after its one correction/);
  assert.match(src, /\(problem \|\| visualProblem\) && !repairNote/);
});
