import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SILENT_LEAD_IN, SILENT_TAIL, silentTiming} from '../src/pipeline/silent-timing.js';
import {estimateSpeechSeconds} from '../src/pipeline/script-checks.js';

// M7 step 6 — silent evaluation mode.
const scenes = ['Why is the sky blue? Sunlight holds every colour.', 'Air molecules scatter blue light, more than red, in every direction.', 'So the sky looks blue: scattered sunlight reaches your eyes from all over.'];

test('silent timing is deterministic, labelled estimated, and follows the speech model', () => {
  const a = silentTiming(scenes);
  assert.deepEqual(a, silentTiming(scenes), 'same input, same timings');
  assert.equal(a.timing, 'estimated');
  assert.equal(a.sceneStarts[0], 0);
  assert.ok(a.sceneStarts.every((s, i) => i === 0 || s > a.sceneStarts[i - 1]), 'scenes in order');
  const speech = scenes.reduce((sum, s) => sum + estimateSpeechSeconds(s), 0);
  assert.equal(a.seconds, Math.ceil(SILENT_LEAD_IN + speech + SILENT_TAIL));
  assert.equal(a.words.length, scenes.join(' ').split(/\s+/).length, 'one timing per word');
  assert.ok(a.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= a.words[i - 1].start)), 'words in order, positive length');
  // Scene k starts exactly when its first word is "spoken", like narration-aligned scenes.
  const firstWordIndex = [0, scenes[0].split(' ').length, scenes[0].split(' ').length + scenes[1].split(' ').length];
  for (const k of [1, 2]) assert.equal(a.sceneStarts[k].toFixed(3), a.words[firstWordIndex[k]].start.toFixed(3));
  assert.ok(a.captionCues.length > 0 && a.captionCues.every((c) => c.text.split(' ').length <= 5));
});

test('sentence and clause ends get pauses (punctuation changes the timing)', () => {
  const plain = silentTiming(['one two three four five six seven eight nine ten']).words;
  const punct = silentTiming(['one two three. four five, six seven eight nine ten']).words;
  assert.ok(punct[3].start - punct[2].start > plain[3].start - plain[2].start, 'pause after a sentence end');
});

test('silent CLI run: real pipeline path, no ElevenLabs request, outside My Videos, clearly labelled', {timeout: 120_000}, () => {
  const runId = `test-silent-${process.pid}`;
  const runDir = path.resolve('runs', 'm7-silent', runId);
  const log = path.join(mkdtempSync(path.join(tmpdir(), 'm7s-')), 'fetch.log');
  try {
    // The demo storyboard avoids Gemini too, so the test is free and offline; --skip-render stops before the render.
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(path.resolve('tests/helpers/fetch-guard.mjs')).href, 'src/cli.ts', '--demo', 'rain', '--silent', '--skip-render', `--run-id=${runId}`], {env: {...process.env, FETCH_LOG: log}, encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const fetched = existsSync(log) ? readFileSync(log, 'utf8') : '';
    assert.doesNotMatch(fetched, /elevenlabs/i, 'no ElevenLabs request');
    const manifest = JSON.parse(readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.mode, 'silent-evaluation');
    assert.equal(manifest.narration.provider, 'none');
    assert.equal(manifest.narration.wordTiming, 'estimated');
    assert.equal(manifest.stages.narration, undefined, 'no narration stage ran');
    const props = JSON.parse(readFileSync(path.join(runDir, 'render-props.json'), 'utf8'));
    assert.match(props.badge, /SILENT EVALUATION/);
    assert.equal(props.audioPath, '');
    assert.equal(props.sceneStarts.length, props.storyboard.scenes.length);
    assert.ok(props.wordTimes.length > 20);
    // My Videos lists only runs/<id> folders with a manifest: the silent folder is one level down.
    assert.equal(existsSync(path.resolve('runs', runId)), false);
    assert.equal(existsSync(path.resolve('public', 'runs', runId)), false, 'no public audio folder');
  } finally {
    rmSync(runDir, {recursive: true, force: true});
  }
});

test('normal runs are unaffected: no badge, standard mode, narration provider still used', () => {
  const cli = readFileSync('src/cli.ts', 'utf8');
  assert.match(cli, /mode: silent \? 'silent-evaluation' : 'standard'/);
  assert.match(cli, /\.\.\.\(silent \? \{badge:/, 'badge only in silent runs');
  assert.match(cli, /const runDir = silent \? path\.resolve\('runs', 'm7-silent', runId\) : path\.resolve\('runs', runId\);/);
  assert.match(cli, /await import\('\.\/providers\/elevenlabs\.js'\)/, 'narrated path still calls the provider');
  // The web app never passes --silent.
  const web = readFileSync('web/src/services/pipeline/videos.ts', 'utf8');
  assert.doesNotMatch(web, /--silent/);
});
