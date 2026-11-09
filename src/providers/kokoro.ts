import {execFile} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {mkdtemp, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {wordSeconds} from '../pipeline/silent-timing';
import type {CaptionCue, WordTiming} from './elevenlabs';

/*
 * Free narration with Kokoro-82M (Apache-2.0): runs offline on the CPU, no account, no API key, no quota.
 * Same contract as providers/elevenlabs.ts (audio file + word timings + caption cues), so the rest of the pipeline is
 * unchanged.
 *
 * Timing: the text is spoken sentence by sentence in a separate process (kokoro-worker.mjs), and each sentence's real
 * speech start/end is MEASURED from the audio. Scene changes therefore follow the actual speech. Inside a sentence,
 * word times are spread over the measured speech span by letters and pauses (the M7 speech model), so captions are
 * close but not word-exact (ElevenLabs returns exact character timings).
 *
 * Voices: female → af_heart (Kokoro's best-graded voice), male → am_michael. Override with KOKORO_FEMALE_VOICE /
 * KOKORO_MALE_VOICE. The model (~326 MB, fp32) downloads once into models/kokoro (gitignored) or KOKORO_MODEL_DIR.
 */

export const KOKORO_VOICES = {female: 'af_heart', male: 'am_michael'} as const;
const MODEL_ID = 'kokoro-82m-v1.0-fp32';
const MAX_SENTENCE_CHARS = 300;
const WORKER_TIMEOUT_MS = 10 * 60_000;

// Sentence / clause ends, allowing closing quotes and brackets after the mark — straight or curly (“…” ‘…’ «…»),
// since Gemini's scripts can use either.
const CLOSERS = `["'”’»)\\]]*`;
const SENTENCE_END = new RegExp(`[.!?]${CLOSERS}$`);
const CLAUSE_END = new RegExp(`[,;:–—]${CLOSERS}$`);

export type SentenceTiming = {text: string; start: number; end: number; speechStart: number; speechEnd: number};
export type SentencePlan = {text: string; tokens: string[]};

/** Splits narration into sentences (whitespace tokens kept exactly); very long sentences break at clause punctuation. */
export function planSentences(text: string): SentencePlan[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const plans: SentencePlan[] = [];
  let current: string[] = [];
  const flush = () => { if (current.length) plans.push({text: current.join(' '), tokens: current}); current = []; };
  for (const token of tokens) {
    current.push(token);
    const length = current.join(' ').length;
    if (SENTENCE_END.test(token)) flush();
    else if (length > MAX_SENTENCE_CHARS && CLAUSE_END.test(token)) flush();
  }
  flush();
  return plans;
}

/** Word times inside each measured sentence, weighted by letters and pauses, scaled to the measured speech span. */
export function wordsFromSentences(plans: readonly SentencePlan[], timings: readonly SentenceTiming[]): WordTiming[] {
  const words: WordTiming[] = [];
  plans.forEach((plan, i) => {
    const t = timings[i];
    if (!t) return;
    const weights = plan.tokens.map((token) => Math.max(0.02, wordSeconds(token)));
    const total = weights.reduce((a, b) => a + b, 0);
    const span = Math.max(0.05, t.speechEnd - t.speechStart);
    let cursor = t.speechStart;
    plan.tokens.forEach((token, j) => {
      const slot = (weights[j] / total) * span;
      // The pause after a sentence/clause end belongs to the gap, not the spoken word.
      const spoken = SENTENCE_END.test(token) || CLAUSE_END.test(token) ? slot * 0.75 : slot;
      words.push({text: token, start: +cursor.toFixed(3), end: +(cursor + Math.max(0.05, spoken)).toFixed(3)});
      cursor += slot;
    });
  });
  return words;
}

/** Caption groups like the ElevenLabs path: up to 6 words and 34 characters, never across a sentence end. */
export function cuesFromWords(words: readonly WordTiming[]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let group: WordTiming[] = [];
  const flush = () => { if (group.length) cues.push({start: group[0].start, end: group[group.length - 1].end, text: group.map((w) => w.text).join(' ')}); group = []; };
  for (const word of words) {
    const length = group.map((w) => w.text).join(' ').length;
    if (group.length && (group.length >= 6 || length + word.text.length + 1 > 34)) flush();
    group.push(word);
    if (SENTENCE_END.test(word.text)) flush();
  }
  flush();
  return cues;
}

/*
 * Speaking speed per voice, calibrated so narration matches the script length budget (the M7 speech model, about
 * 15 characters per second, fitted on ElevenLabs). Measured on the 90 s fixture: af_heart at 1.0 → 89 s (on target);
 * am_michael at 1.0 → 101 s (+11 s), i.e. 1.13× slower, so the male voice runs at 1.13. Override per voice with
 * KOKORO_FEMALE_SPEED / KOKORO_MALE_SPEED.
 */
export const KOKORO_SPEED = {female: 1.0, male: 1.13} as const;

const speedFrom = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0.5 && n <= 2 ? n : fallback;
};

export function kokoroVoice(gender?: string): {voice: string; gender: string; speed: number} {
  const g = (gender || process.env.ELEVENLABS_VOICE_GENDER || 'female').toLowerCase();
  if (g === 'male') return {voice: process.env.KOKORO_MALE_VOICE || KOKORO_VOICES.male, gender: 'male', speed: speedFrom(process.env.KOKORO_MALE_SPEED, KOKORO_SPEED.male)};
  return {voice: process.env.KOKORO_FEMALE_VOICE || KOKORO_VOICES.female, gender: 'female', speed: speedFrom(process.env.KOKORO_FEMALE_SPEED, KOKORO_SPEED.female)};
}

/** Remotion's bundled ffmpeg (no system install needed). */
function ffmpegPath(): string {
  const base = path.resolve('node_modules', '@remotion');
  const dir = existsSync(base) ? readdirSync(base).find((d) => d.startsWith('compositor-')) : undefined;
  const file = dir ? path.join(base, dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') : '';
  if (!file || !existsSync(file)) throw new Error('Kokoro narration needs Remotion\'s bundled ffmpeg (run npm install).');
  return file;
}

function run(file: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, {timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true}, (error, stdout, stderr) => {
      if (error) reject(new Error(`${path.basename(file)} failed: ${String(stderr || error.message).split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300)}`));
      else resolve(stdout);
    });
  });
}

export async function createKokoroNarration(text: string, outputPath: string, selectedGender?: string, options: {speed?: number} = {}) {
  const plans = planSentences(text);
  if (!plans.length) throw new Error('Kokoro narration: the narration text is empty.');
  const {voice, gender, speed} = kokoroVoice(selectedGender);
  const work = await mkdtemp(path.join(os.tmpdir(), 'explivio-kokoro-'));
  try {
    const wavPath = path.join(work, 'narration.wav');
    const jobPath = path.join(work, 'job.json');
    const modelDir = path.resolve(process.env.KOKORO_MODEL_DIR || path.join('models', 'kokoro'));
    await writeFile(jobPath, JSON.stringify({sentences: plans.map((p) => p.text), voice, speed: options.speed ?? speed, wavPath, modelDir}));
    const worker = fileURLToPath(new URL('./kokoro-worker.mjs', import.meta.url));
    const stdout = await run(process.execPath, [worker, jobPath], WORKER_TIMEOUT_MS);
    const line = stdout.trim().split('\n').filter(Boolean).at(-1) ?? '';
    const result = JSON.parse(line) as {ok: boolean; seconds: number; loadSeconds: number; generateSeconds: number; sentences: SentenceTiming[]};
    if (!result.ok || result.sentences.length !== plans.length) throw new Error('Kokoro narration: the speech worker returned an incomplete result.');

    // MP3 at the requested path (same file the ElevenLabs path writes), via Remotion's bundled ffmpeg.
    await run(ffmpegPath(), ['-v', 'error', '-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '128k', outputPath], 120_000);
    const bytes = (await stat(outputPath)).size;
    const words = wordsFromSentences(plans, result.sentences);
    const captionCues = cuesFromWords(words);
    const durationSeconds = result.sentences.at(-1)!.speechEnd;
    return {
      provider: 'kokoro' as const,
      voiceId: voice,
      voiceGender: gender,
      speed: options.speed ?? speed,
      modelId: MODEL_ID,
      bytes,
      durationSeconds: +durationSeconds.toFixed(3),
      captionCues,
      words,
      wordTiming: 'sentence-measured' as const,
      performance: {loadSeconds: +result.loadSeconds.toFixed(1), generateSeconds: +result.generateSeconds.toFixed(1), audioSeconds: +result.seconds.toFixed(1)},
    };
  } finally {
    await rm(work, {recursive: true, force: true});
  }
}
