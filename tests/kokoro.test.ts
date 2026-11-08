import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, rmSync, statSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createKokoroNarration, cuesFromWords, KOKORO_SPEED, KOKORO_VOICES, kokoroVoice, planSentences, wordsFromSentences, type SentenceTiming} from '../src/providers/kokoro';
import {fallbackReason, narrationProvider} from '../src/providers/narration';

/*
 * Free narration voice (Kokoro-82M) and provider choice. Pure logic runs offline; the real-model test runs only with
 * KOKORO_TEST=1 (it needs the ~311 MB model in models/kokoro). No ElevenLabs or Gemini call is made here.
 */

const text = 'Why is the sky blue? Sunlight is made of many colours, all mixed together. Blue light scatters the most!';

test('sentences: split at sentence ends, tokens kept exactly; very long sentences break at a clause', () => {
  const plans = planSentences(text);
  assert.deepEqual(plans.map((p) => p.text), ['Why is the sky blue?', 'Sunlight is made of many colours, all mixed together.', 'Blue light scatters the most!']);
  assert.deepEqual(plans.flatMap((p) => p.tokens), text.split(/\s+/), 'every word kept, in order');
  const long = `${'word '.repeat(70).trim()}, ${'more '.repeat(10).trim()}.`;
  assert.equal(planSentences(long).length, 2, 'a 350+ character sentence is split at its comma');
  assert.deepEqual(planSentences('   '), []);
  assert.deepEqual(planSentences('“Quoted end.” Next one').map((p) => p.text), ['“Quoted end.”', 'Next one']);
});

test('word timings fit inside each measured sentence, in order, weighted by length', () => {
  const plans = planSentences(text);
  const timings: SentenceTiming[] = [
    {text: plans[0].text, start: 0, end: 1.6, speechStart: 0.2, speechEnd: 1.4},
    {text: plans[1].text, start: 1.6, end: 5.0, speechStart: 1.8, speechEnd: 4.7},
    {text: plans[2].text, start: 5.0, end: 7.0, speechStart: 5.1, speechEnd: 6.8},
  ];
  const words = wordsFromSentences(plans, timings);
  assert.equal(words.length, text.split(/\s+/).length);
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].start, 'monotonic');
  assert.equal(words[0].start, 0.2, 'first word starts where speech is measured to start');
  assert.ok(words[4].end <= 1.4 + 1e-6, 'sentence 1 ends inside its measured speech');
  assert.equal(words[5].start, 1.8, 'sentence 2 starts at its measured speech start');
  const sky = words.find((w) => w.text === 'Sunlight')!;
  const is = words.find((w) => w.text === 'is' && w.start > 1.7)!;
  assert.ok(sky.end - sky.start > is.end - is.start, 'longer words get more time');
});

test('captions: at most 6 words and 34 characters, never across a sentence end', () => {
  const plans = planSentences(text);
  const timings: SentenceTiming[] = plans.map((p, i) => ({text: p.text, start: i * 3, end: i * 3 + 3, speechStart: i * 3 + 0.1, speechEnd: i * 3 + 2.8}));
  const cues = cuesFromWords(wordsFromSentences(plans, timings));
  assert.ok(cues.every((c) => c.text.split(' ').length <= 6 && c.text.length <= 34), JSON.stringify(cues));
  assert.ok(cues.some((c) => c.text === 'Why is the sky blue?'), 'a sentence end closes the cue');
  assert.ok(cues.every((c) => c.end > c.start));
});

test('voices: female af_heart at 1.0, male am_michael at 1.13 (calibrated); env overrides, out-of-range speeds ignored', () => {
  const saved = {...process.env};
  try {
    for (const k of ['KOKORO_FEMALE_VOICE', 'KOKORO_MALE_VOICE', 'KOKORO_FEMALE_SPEED', 'KOKORO_MALE_SPEED', 'ELEVENLABS_VOICE_GENDER']) delete process.env[k];
    assert.deepEqual(kokoroVoice('female'), {voice: KOKORO_VOICES.female, gender: 'female', speed: KOKORO_SPEED.female});
    assert.deepEqual(kokoroVoice('male'), {voice: 'am_michael', gender: 'male', speed: 1.13});
    assert.equal(kokoroVoice(undefined).voice, 'af_heart', 'default is the female voice');
    process.env.KOKORO_MALE_VOICE = 'bm_george';
    process.env.KOKORO_MALE_SPEED = '1.2';
    assert.deepEqual(kokoroVoice('male'), {voice: 'bm_george', gender: 'male', speed: 1.2});
    process.env.KOKORO_MALE_SPEED = '9';
    assert.equal(kokoroVoice('male').speed, 1.13, 'nonsense speed falls back');
  } finally {
    process.env = saved;
  }
});

test('provider choice: auto by default; kokoro / elevenlabs explicit; fallback reasons are short codes, never the body', () => {
  assert.equal(narrationProvider({}), 'auto');
  assert.equal(narrationProvider({NARRATION_PROVIDER: ' Kokoro '}), 'kokoro');
  assert.equal(narrationProvider({NARRATION_PROVIDER: 'elevenlabs'}), 'elevenlabs');
  assert.equal(narrationProvider({NARRATION_PROVIDER: 'something'}), 'auto');
  const quota = new Error('ElevenLabs 401: {"detail":{"type":"invalid_request","code":"quota_exceeded","message":"This request exceeds your quota of 10000. You have 267 credits remaining"}}');
  assert.equal(fallbackReason(quota), 'elevenlabs_quota_exceeded');
  assert.equal(fallbackReason(new Error('ELEVENLABS_API_KEY is missing. Add your ElevenLabs key to .env.')), 'elevenlabs_not_configured');
  assert.equal(fallbackReason(new Error('ElevenLabs 503: busy')), 'elevenlabs_server_error');
  assert.equal(fallbackReason(new Error('The operation was aborted due to timeout')), 'elevenlabs_timeout');
  assert.match(fallbackReason(new Error('weird')), /^elevenlabs_[a-z_]+$/);
});

test('real Kokoro model: speaks two sentences to MP3 with measured, ordered timings (KOKORO_TEST=1)', {skip: process.env.KOKORO_TEST !== '1' && 'set KOKORO_TEST=1 to run the real model (needs models/kokoro)', timeout: 300_000}, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kokoro-test-'));
  try {
    const out = path.join(dir, 'narration.mp3');
    const r = await createKokoroNarration('Tides rise twice a day. The Moon pulls on the oceans.', out, 'male');
    assert.ok(existsSync(out) && statSync(out).size > 10_000, 'an MP3 was written');
    assert.equal(r.provider, 'kokoro');
    assert.equal(r.voiceId, 'am_michael');
    assert.equal(r.words.length, 11); // 5 + 6 words
    assert.ok(r.durationSeconds > 2 && r.durationSeconds < 10, `duration ${r.durationSeconds}`);
    assert.ok(r.words.every((w, i) => i === 0 || w.start >= r.words[i - 1].start));
    assert.ok(r.captionCues.length >= 2);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
