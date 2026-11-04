import type {Storyboard} from '../schemas/storyboard';
import {keywords} from './mention-timing';

/*
 * Script quality checks for the storyboard (M7 WS3). Pure functions: each returns null when fine or a short message
 * that is sent to Gemini in the single repair request. Whatever still fails after that is recorded as a warning.
 */

/**
 * Narration speech-time model, fitted on 12 real ElevenLabs runs (both voices, 21–65 s): seconds ≈ 0.0635 per letter
 * or digit + 0.65 per sentence end + 0.5 per clause break (comma, semicolon, colon, dash). Mean error ≈ 3%, worst ≈ 10%,
 * versus 4.6% / 13.6% for characters alone; long technical words are counted by their letters, not as one "word".
 */
export const SPEECH_MODEL = {
  secondsPerLetter: Number(process.env.NARRATION_SECONDS_PER_LETTER) || 0.0635,
  sentencePause: 0.65,
  clausePause: 0.5,
  /** Measured average, used only to phrase the target for the model in characters. */
  charsPerSecond: 15
};

export function speechFeatures(text: string): {letters: number; sentences: number; clauses: number; characters: number} {
  return {
    letters: (text.match(/[\p{L}\p{N}]/gu) ?? []).length,
    sentences: (text.match(/[.!?]+(?=\s|$)/g) ?? []).length,
    clauses: (text.match(/[,;:–—]/g) ?? []).length,
    characters: text.length
  };
}

export function estimateSpeechSeconds(text: string): number {
  const f = speechFeatures(text);
  return f.letters * SPEECH_MODEL.secondsPerLetter + f.sentences * SPEECH_MODEL.sentencePause + f.clauses * SPEECH_MODEL.clausePause;
}

/** The video ends ~0.4 s after the last word (rounded up), so the speech aims about a second under the requested length. */
const END_ALLOWANCE = 1;
const TOLERANCE = 0.1;

export type LengthBudget = {targetSeconds: number; minSeconds: number; maxSeconds: number; targetChars: number; minChars: number; maxChars: number};

export function lengthBudget(seconds: number): LengthBudget {
  const targetSeconds = seconds - END_ALLOWANCE;
  const chars = (s: number) => Math.round(s * SPEECH_MODEL.charsPerSecond);
  return {targetSeconds, minSeconds: +(targetSeconds * (1 - TOLERANCE)).toFixed(1), maxSeconds: +(targetSeconds * (1 + TOLERANCE)).toFixed(1), targetChars: chars(targetSeconds), minChars: chars(targetSeconds * (1 - TOLERANCE)), maxChars: chars(targetSeconds * (1 + TOLERANCE))};
}

export const narrationText = (storyboard: Storyboard) => storyboard.scenes.map((s) => s.narration_text).join('\n\n');

/** Prompt instruction for the narration length. */
export function lengthInstruction(seconds: number): string {
  const b = lengthBudget(seconds);
  return `Narration length: all narration_text together must take about ${b.targetSeconds} seconds to speak, which is about ${b.targetChars} characters including spaces (between ${b.minChars} and ${b.maxChars}). Spread it across the scenes in proportion to their estimated_duration_seconds. Do not pad with filler to reach the length.`;
}

export function lengthProblem(storyboard: Storyboard, seconds: number): string | null {
  const b = lengthBudget(seconds);
  const text = narrationText(storyboard);
  const est = estimateSpeechSeconds(text);
  if (est >= b.minSeconds && est <= b.maxSeconds) return null;
  return `The narration would take about ${est.toFixed(1)} s to speak (${text.length} characters), but a ${seconds}-second video needs about ${b.targetSeconds} s (${b.minChars}-${b.maxChars} characters). ${est < b.minSeconds ? 'Expand the explanation with useful detail' : 'Shorten it'}, keeping it accurate and natural.`;
}

const firstSentences = (text: string, n: number) => (text.match(/[^.!?]+[.!?]*/g) ?? [text]).slice(0, n).join(' ').trim();
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

const GENERIC_OPENING = /^\s*(?:welcome|hi|hello|hey|greetings|so,?|okay,?|ok,?)\b|\bin (?:this|today's) (?:video|lesson|explainer)\b|\btoday,? (?:we|we're|we are|we'll|i'll|i will|let's)\b|\blet's (?:dive|break (?:it|this) down|talk about|explore|learn|get started|take a look|find out)\b|\bwe(?:'re| are) going to (?:learn|discuss|explore|talk|look)\b/i;
const FACT_SIGNAL = /\d|\b(?:most|least|largest|smallest|biggest|fastest|slowest|longest|oldest|every|never|always|only|billion|million|thousand|hundred|dozen|percent|than|twice|half|nearly|almost|single|enough|two|three|four|five|six|seven|eight|nine|ten)\b/i;

/** Scene 1 must open with a concrete question or a concrete, interesting fact; no generic greeting or agenda. */
export function hookProblem(opening: string): string | null {
  const start = firstSentences(opening, 2);
  if (GENERIC_OPENING.test(start)) return 'The opening uses a generic phrase (a greeting, "in this video", "today we will", "let\'s dive in"). Start scene 1 directly with a concrete question or a surprising fact about the topic.';
  if (!start.includes('?') && !FACT_SIGNAL.test(start)) return 'The opening does not start with a concrete question or a specific fact. Make the first sentence of scene 1 a question the viewer wants answered, or a concrete surprising fact (a number, a comparison).';
  if (countWords(firstSentences(opening, 1)) > 28) return 'The first sentence of scene 1 is too long for a hook. Keep it under about 25 words.';
  return null;
}

const FILLER_ENDING = /\b(?:subscribe|like (?:and|this video)|follow (?:us|for more)|thanks? (?:you )?for watching|see you (?:next time|soon)|that'?s (?:all|it) for (?:today|now)|stay tuned|don'?t forget to|comment below|hope you (?:enjoyed|learned))\b/i;

/** The final scene gives one clear takeaway about the topic: complete, specific, no sign-off filler. */
export function endingProblem(ending: string, title: string): string | null {
  if (FILLER_ENDING.test(ending)) return 'The final scene uses sign-off filler (subscribe, thanks for watching, see you next time). End with one clear takeaway about the topic instead.';
  if (countWords(ending) < 10) return 'The final scene is too short to land a takeaway. Give one clear sentence that sums up the key idea (at least 10 words).';
  if (!/[.!?]["')\]]?\s*$/.test(ending.trim())) return 'The final scene ends abruptly. Finish with a complete sentence that states the takeaway.';
  const titleTerms = new Set(keywords(title));
  if (titleTerms.size && !keywords(ending).some((w) => titleTerms.has(w))) return `The final scene does not restate the main idea. Make the takeaway name the topic (${[...titleTerms].slice(0, 3).join(', ')}) and what the viewer should remember.`;
  return null;
}

/** Words in a request that say nothing about the topic itself. */
const REQUEST_WORDS = new Set(['expla', 'begin', 'compl', 'simpl', 'examp', 'video', 'minut', 'secon', 'kid', 'kids', 'stude', 'under', 'basic', 'work', 'using', 'short', 'quick', 'clear', 'teach', 'learn', 'peopl', 'adult', 'child', 'like', 'young', 'about', 'some', 'does', 'make']);

export function topicTerms(prompt: string): string[] {
  return [...new Set(keywords(prompt).filter((w) => !REQUEST_WORDS.has(w)))];
}

/** The script must be about what the user asked for: at least one topic term appears in the title or narration. */
export function relevanceProblem(prompt: string, storyboard: Storyboard): string | null {
  const terms = topicTerms(prompt);
  if (!terms.length) return null;
  const said = new Set(keywords(`${storyboard.title} ${narrationText(storyboard)}`));
  return terms.some((t) => said.has(t)) ? null : `The script does not mention the requested topic (${terms.slice(0, 4).join(', ')}). Rewrite it about exactly that topic.`;
}

/** Scenes are numbered 1..n, each says something real, nothing is repeated, and estimates roughly match the length. */
export function consistencyProblem(storyboard: Storyboard, seconds: number): string | null {
  const problems: string[] = [];
  storyboard.scenes.forEach((s, i) => {
    if (s.scene_id !== i + 1) problems.push(`scene_id ${s.scene_id} should be ${i + 1}`);
    if (countWords(s.narration_text) < 5) problems.push(`scene ${s.scene_id} narration is too short`);
  });
  const seen = new Set<string>();
  for (const s of storyboard.scenes) {
    const key = s.narration_text.trim().toLowerCase();
    if (seen.has(key)) problems.push(`scene ${s.scene_id} repeats an earlier scene`);
    seen.add(key);
  }
  const total = storyboard.scenes.reduce((sum, s) => sum + s.estimated_duration_seconds, 0);
  if (total < seconds * 0.7 || total > seconds * 1.3) problems.push(`estimated_duration_seconds add up to ${Math.round(total)} s instead of about ${seconds} s`);
  return problems.length ? `Fix the scene structure: ${problems.join('; ')}.` : null;
}

export type ScriptChecks = {
  length: {estimatedSeconds: number; characters: number} & LengthBudget & {pass: boolean};
  hook: string | null;
  ending: string | null;
  relevance: string | null;
  consistency: string | null;
};

export function checkScript(storyboard: Storyboard, prompt: string, seconds: number): ScriptChecks {
  const text = narrationText(storyboard);
  const scenes = storyboard.scenes;
  return {
    length: {...lengthBudget(seconds), estimatedSeconds: +estimateSpeechSeconds(text).toFixed(1), characters: text.length, pass: lengthProblem(storyboard, seconds) === null},
    hook: hookProblem(scenes[0]?.narration_text ?? ''),
    ending: endingProblem(scenes[scenes.length - 1]?.narration_text ?? '', storyboard.title),
    relevance: relevanceProblem(prompt, storyboard),
    consistency: consistencyProblem(storyboard, seconds)
  };
}

/** Messages for the repair request (empty when the script passes every check). */
export function scriptProblems(checks: ScriptChecks, storyboard: Storyboard, seconds: number): string[] {
  return [checks.length.pass ? null : lengthProblem(storyboard, seconds), checks.hook, checks.ending, checks.relevance, checks.consistency].filter((p): p is string => Boolean(p));
}
