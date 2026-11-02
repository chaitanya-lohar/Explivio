import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Storyboard} from '../src/schemas/storyboard.js';
import {checkScript, consistencyProblem, endingProblem, estimateSpeechSeconds, hookProblem, lengthBudget, lengthInstruction, lengthProblem, relevanceProblem, scriptProblems, speechFeatures, topicTerms} from '../src/pipeline/script-checks.js';

// M7 step 5 — script quality: length by estimated speech time, hooks, endings, relevance, scene structure.
const words = (n: number, word = 'photosynthesis') => Array.from({length: n}, () => word).join(' ');
// Built directly (not schema-parsed) so single-scene fixtures can isolate one rule.
const sb = (narrations: string[], title = 'How Photosynthesis Works', est?: number[]): Storyboard => ({
  title, target_audience: 'Beginners', learning_objective: 'o',
  scenes: narrations.map((n, i) => ({scene_id: i + 1, narration_text: n, on_screen_text: 't', visual_type: 'diagram', visual_description: 'd', key_elements: [], estimated_duration_seconds: est?.[i] ?? 10}))
});

test('speech time counts letters and pauses, so punctuation and long technical words matter', () => {
  assert.deepEqual(speechFeatures('Hi, there. Ok?'), {letters: 9, sentences: 2, clauses: 1, characters: 14});
  const plain = estimateSpeechSeconds('cats sat on mats and dogs ran far away now');
  const punctuated = estimateSpeechSeconds('Cats sat. On mats, and dogs ran. Far away, now.');
  assert.ok(punctuated > plain + 1.5, 'pauses add time');
  // Same word count, very different length: the old word budget treated these as equal.
  assert.ok(estimateSpeechSeconds('Chlorophyll photosynthesizes electromagnetic radiation') > 2 * estimateSpeechSeconds('The cat sat on it now'));
});

test('length budgets for 30, 60 and 90 s aim just under the requested length, ±10%', () => {
  for (const s of [30, 60, 90] as const) {
    const b = lengthBudget(s);
    assert.equal(b.targetSeconds, s - 1);
    assert.ok(b.minChars < b.targetChars && b.targetChars < b.maxChars);
    assert.match(lengthInstruction(s), new RegExp(`about ${b.targetChars} characters`));
  }
  assert.equal(lengthBudget(60).targetChars, 885, '59 s × 15 characters/s');
});

test('length check: a script that fits passes; too short or too long gives a repair message', () => {
  const sized = (chars: number) => sb([`Why do leaves look green? ${'Leaves use light to make food. '.repeat(Math.ceil(chars / 31))}`.slice(0, chars)]);
  assert.equal(lengthProblem(sized(420), 30), null, `~29 s: ${estimateSpeechSeconds(sized(420).scenes[0].narration_text).toFixed(1)}`);
  assert.match(lengthProblem(sized(150), 30) ?? '', /Expand/);
  assert.match(lengthProblem(sized(900), 30) ?? '', /Shorten/);
});

test('hook: generic openings are rejected', () => {
  for (const opening of ['Welcome to this video about photosynthesis.', 'Today we are going to discuss photosynthesis.', 'In this video, we will learn how plants make food.', "Let's dive into photosynthesis.", 'Hi everyone! Plants are cool.']) {
    assert.ok(hookProblem(opening), opening);
  }
});
test('hook: a concrete question or a specific fact passes', () => {
  assert.equal(hookProblem('Why are most leaves green and not black? The answer is in how they catch light.'), null);
  assert.equal(hookProblem('A single oak tree makes enough oxygen in a day for two people.'), null);
  assert.match(hookProblem('Plants are interesting living things. They grow.') ?? '', /concrete question or a specific fact/);
});

test('ending: one clear takeaway that names the topic; no filler, not abrupt', () => {
  assert.equal(endingProblem('So photosynthesis turns light, water and carbon dioxide into the sugar every plant runs on.', 'How Photosynthesis Works'), null);
  assert.match(endingProblem('Thanks for watching, and don\'t forget to subscribe for more plant videos!', 'How Photosynthesis Works') ?? '', /sign-off/);
  assert.match(endingProblem('That is it.', 'How Photosynthesis Works') ?? '', /too short/);
  assert.match(endingProblem('Remember that leaves turn sunlight into food for the whole plant and', 'How Photosynthesis Works') ?? '', /abruptly/);
  assert.match(endingProblem('Remember that leaves turn sunlight into food that keeps the whole plant alive.', 'Why the Sky Is Blue') ?? '', /restate the main idea/);
});

test('relevance: request words are ignored; the topic itself must appear', () => {
  assert.deepEqual(topicTerms('Explain photosynthesis for complete beginners with a simple example'), ['photo']);
  assert.equal(relevanceProblem('Explain photosynthesis to beginners', sb([words(10)])), null);
  assert.match(relevanceProblem('Explain black holes to beginners', sb(['Plants use sunlight to make sugar from water and air.'], 'How Plants Eat')) ?? '', /does not mention the requested topic/);
});

test('scene consistency: numbering, empty or repeated scenes, and duration estimates', () => {
  assert.equal(consistencyProblem(sb(['One two three four five six.', 'Seven eight nine ten eleven twelve.', 'Thirteen fourteen fifteen sixteen seventeen.']), 30), null);
  assert.match(consistencyProblem(sb(['Too short.', 'Seven eight nine ten eleven twelve.', 'Thirteen fourteen fifteen sixteen seventeen.']), 30) ?? '', /too short/);
  assert.match(consistencyProblem(sb(['One two three four five six.', 'One two three four five six.', 'Thirteen fourteen fifteen sixteen seventeen.']), 30) ?? '', /repeats/);
  assert.match(consistencyProblem(sb(['One two three four five six.', 'Seven eight nine ten eleven twelve.', 'Thirteen fourteen fifteen sixteen seventeen.'], 'T', [30, 30, 30]), 30) ?? '', /add up to 90 s/);
});

test('checkScript gathers every rule; scriptProblems lists only failures for the one repair', () => {
  const good = sb([
    'Why are most leaves green? Inside every leaf, a pigment called chlorophyll catches sunlight and turns it into chemical energy.',
    'Roots pull water up from the soil, and tiny pores on the leaf let carbon dioxide in from the air around the plant.',
    'Inside the leaf cells, light energy rearranges water and carbon dioxide into glucose, a sugar the plant uses to grow and repair itself.',
    'Photosynthesis is how plants turn light, water and air into the food that powers almost every living thing on Earth.'
  ], 'How Photosynthesis Works', [8, 7, 8, 7]);
  const checks = checkScript(good, 'Explain photosynthesis to beginners', 30);
  assert.equal(checks.hook, null);
  assert.equal(checks.ending, null);
  assert.equal(checks.relevance, null);
  assert.equal(checks.consistency, null);
  assert.equal(checks.length.pass, true, `estimated ${checks.length.estimatedSeconds}s for 29s target`);
  assert.deepEqual(scriptProblems(checks, good, 30), []);
  const bad = sb(['Welcome to this video.', 'Plants make food from sunlight and water every day.', 'Thanks for watching!']);
  assert.ok(scriptProblems(checkScript(bad, 'Explain photosynthesis', 30), bad, 30).length >= 3);
});
