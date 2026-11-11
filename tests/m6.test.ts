import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {budgetProblem, narrationWords, wordBudget} from '../src/pipeline/word-budget.js';
import {sceneFramesFromStarts, sceneStartsFromWords} from '../src/pipeline/scene-timing.js';
import {afterTransientFailure, classify, isRecentlyUnhealthy, modelChain} from '../src/providers/gemini.js';
import {label, layoutFor} from '../src/video/concept-visual.js';
// @ts-expect-error plain JS validator module without type declarations
import {captionIssues, decodeGrayPng, durationCheck} from '../scripts/m6/validate-run.mjs';
import type {Storyboard} from '../src/schemas/storyboard.js';

const scene = (words: number, extra: Partial<Storyboard['scenes'][number]> = {}): Storyboard['scenes'][number] => ({
  scene_id: 1, narration_text: Array.from({length: words}, (_, i) => `w${i}`).join(' '), on_screen_text: 'Title', visual_type: 'diagram',
  visual_description: 'desc', key_elements: ['a', 'b'], estimated_duration_seconds: 10, ...extra,
});
const board = (...words: number[]): Storyboard => ({title: 't', target_audience: 'a', learning_objective: 'o', scenes: words.map((w) => scene(w))});

// Fix 1: duration — the storyboard must carry enough words for the requested length.
test('word budget scales with requested duration', () => {
  assert.deepEqual(wordBudget(30, 2.75), {target: 83, min: 73, max: 93});
  assert.ok(wordBudget(90, 2.75).target > wordBudget(60, 2.75).target);
});
test('regression: a 64-word storyboard for 30 s (the F4 Moon video, rendered at 22 s) is flagged', () => {
  const problem = budgetProblem(board(16, 16, 16, 16), 30);
  assert.equal(narrationWords(board(16, 16, 16, 16)), 64);
  assert.match(problem ?? '', /64 words.*Expand/);
});
test('a storyboard inside the budget passes', () => {
  assert.equal(budgetProblem(board(20, 20, 20, 20), 30), null);
});

// Fix 2: sync — scene changes follow the spoken words, not Gemini's estimates.
const words = (n: number, step = 0.4) => Array.from({length: n}, (_, i) => ({text: `w${i}`, start: i * step, end: i * step + 0.3}));
test('scene starts come from the first spoken word of each scene', () => {
  assert.deepEqual(sceneStartsFromWords(['a b c', 'd e', 'f g h i'], words(9))?.map((s) => +s.toFixed(3)), [0, 1.2, 2.0]);
});
test('scene starts fall back (null) when timings do not line up with the text', () => {
  assert.equal(sceneStartsFromWords(['a b c', 'd e'], words(4)), null);
});
test('scene frame ranges are ordered, contiguous and cover the whole video', () => {
  const frames = sceneFramesFromStarts([0, 1.2, 2.0], 4, 30);
  assert.equal(frames[0].from, 0);
  for (let i = 1; i < frames.length; i++) assert.equal(frames[i].from, frames[i - 1].from + frames[i - 1].duration);
  assert.equal(frames.at(-1)!.from + frames.at(-1)!.duration, 120);
});

// Fix 3: Gemini — don't wait again on a model that just hung; classify failures without keeping their text.
test('a model that failed recently is skipped; an old failure is not', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const health = {'gemini-3.8-flash': {failedAt: '2026-11-01T11:50:00Z', reason: 'timeout'}};
  assert.equal(isRecentlyUnhealthy(health, 'gemini-3.8-flash', now, 30), true);
  assert.equal(isRecentlyUnhealthy(health, 'gemini-3.8-flash', now + 60 * 60_000, 30), false);
  assert.equal(isRecentlyUnhealthy(health, 'gemini-3.6-flash', now, 30), false);
});
test('gemini errors are classified', () => {
  assert.equal(classify('Gemini request timed out after 30000 ms'), 'timeout');
  assert.equal(classify('503 high demand'), 'overloaded');
  assert.equal(classify('Unexpected token < in JSON'), 'invalid_output');
});

// Fix 4: visuals — every storyboard visual type maps to an explanatory layout built from the scene itself.
test('visual layout follows the storyboard visual type', () => {
  assert.equal(layoutFor({visual_type: 'process', key_elements: ['a', 'b', 'c']}), 'process');
  assert.equal(layoutFor({visual_type: 'diagram', key_elements: ['a', 'b']}), 'hub');
  assert.equal(layoutFor({visual_type: 'analogy', key_elements: ['a', 'b']}), 'compare');
  assert.equal(layoutFor({visual_type: 'summary', key_elements: ['a', 'b']}), 'checklist');
  assert.equal(layoutFor({visual_type: 'process', key_elements: ['only one']}), 'focus');
  assert.equal(label('x'.repeat(50), 34).length, 34);
  assert.equal(label('1. Moon orbits Earth'), 'Moon orbits Earth');
  assert.equal(label('Step 1: Input data'), 'Input data');
  assert.equal(label('Axis tilted 23.5°'), 'Axis tilted 23.5°');
});

// Validator — measurable requirements.
test('caption cues outside the video or out of order are reported', () => {
  assert.deepEqual(captionIssues([{start: 0, end: 1, text: 'a'}, {start: 1, end: 2, text: 'b'}], 2), []);
  const issues = captionIssues([{start: 1, end: 0.5, text: 'a'}, {start: 0.2, end: 9, text: ''}], 5);
  assert.ok(issues.some((i: string) => /non-positive/.test(i)) && issues.some((i: string) => /after the video/.test(i)) && issues.some((i: string) => /out of order/.test(i)) && issues.some((i: string) => /empty/.test(i)));
});
test('duration tolerance per requested length', () => {
  assert.equal(durationCheck(30, 22).pass, false);
  assert.equal(durationCheck(30, 27.5).pass, true);
  assert.equal(durationCheck(60, 52.5).pass, true);
  assert.equal(durationCheck(90, 78).pass, false);
});
test('grey PNG decoder reads pixel values (used for blank-frame detection)', () => {
  // 2x1 greyscale PNG with filter 0 and pixels [10, 200].
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 10, 200]))), chunk('IEND', Buffer.alloc(0))]);
  assert.deepEqual([...decodeGrayPng(png)], [10, 200]);
});

// Regression (F4 finding): unrelated topics must not reuse the rain demo's photo or step text.
test('only the rain/photosynthesis demos get hand-made themes; other topics get none', async () => {
  const {themeFor} = await import('../src/video/editorial.js');
  const moon = themeFor('Why Does the Moon Have Phases?');
  assert.equal(moon.themed, false);
  assert.equal(moon.image, '');
  assert.deepEqual(moon.steps, []);
  assert.equal(themeFor('How Rain Forms').themed, true);
});

// Regression (M6 run A2): a schema error must be repaired, not treated as fatal. (Since M7 an unknown visual_type is
// coerced to "diagram", so this uses another invalid field.)
test('schema validation errors are repairable (invalid_output)', async () => {
  const {StoryboardSchema} = await import('../src/schemas/storyboard.js');
  const bad = {title: 't', target_audience: 'a', learning_objective: 'o', scenes: [1, 2, 3].map((i) => ({scene_id: i, narration_text: '', on_screen_text: 'y', visual_type: 'diagram', visual_description: 'z', key_elements: [], estimated_duration_seconds: 5}))};
  let caught: unknown;
  try { StoryboardSchema.parse(bad); } catch (error) { caught = error; }
  assert.ok(caught);
  assert.equal(classify((caught as Error).message, caught), 'invalid_output');
  assert.equal(classify('Unexpected token } in JSON at position 4', new SyntaxError('x')), 'invalid_output');
});

// Regression (M6 run A4): a single timeout on the only usable model must get one retry, not fail the video.
test('after a timeout: switch to fallback once, then retry the same model once, then fail (bounded)', () => {
  const none = new Set<string>();
  const chain = ['a', 'b', 'c'];
  assert.deepEqual(afterTransientFailure({model: 'a', chain, tried: new Set(['a']), retriedModels: none, callsLeft: 3}), {action: 'switch', model: 'b'});
  assert.deepEqual(afterTransientFailure({model: 'b', chain, tried: new Set(['a', 'b']), retriedModels: none, callsLeft: 2}), {action: 'switch', model: 'c'});
  assert.deepEqual(afterTransientFailure({model: 'c', chain, tried: new Set(chain), retriedModels: none, callsLeft: 2}), {action: 'retry'}, 'all tried: retry once');
  assert.deepEqual(afterTransientFailure({model: 'c', chain, tried: new Set(chain), retriedModels: new Set(['c']), callsLeft: 1}), {action: 'fail'});
  assert.deepEqual(afterTransientFailure({model: 'a', chain, tried: new Set(['a']), retriedModels: none, callsLeft: 0}), {action: 'fail'});
});

// Regression (M6 run A3): a generated video whose title matches a demo theme must not get the demo's hand-written cards.
test('hand-written step cards only for demo scripts', async () => {
  const {themeFor, usesHandwrittenCards} = await import('../src/video/editorial.js');
  const photo = themeFor('How Photosynthesis Works for Beginners');
  assert.equal(photo.themed, true);
  assert.equal(usesHandwrittenCards(photo, undefined), false);
  assert.equal(usesHandwrittenCards(photo, true), true);
  assert.equal(usesHandwrittenCards(themeFor('What is AI?'), true), false);
});

test('model chain (2026-11-11): Groq first when its key is set, then Gemini models (20 free requests/day each)', () => {
  assert.deepEqual(modelChain({}), ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(modelChain({GROQ_API_KEY: 'k'}), ['groq:openai/gpt-oss-120b', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(modelChain({GEMINI_MODEL: 'a', GEMINI_FALLBACK_MODEL: 'a', GEMINI_EXTRA_MODELS: 'b, c', GROQ_API_KEY: 'k', GROQ_MODEL: 'm'}), ['groq:m', 'a', 'b', 'c'], 'duplicates removed, order kept');
  assert.equal(classify('Groq request failed (HTTP 429, rate limit)'), 'overloaded');
});
