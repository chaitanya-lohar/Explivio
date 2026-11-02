import type {Storyboard} from '../schemas/storyboard.js';

/**
 * Speech-rate policy (integration contract: "total narration word count must be plausible for the requested
 * duration; target speech-rate policy is configurable"). Measured on our ElevenLabs voices: ~2.8–2.9 words/s.
 * Slightly under the measured rate so scene pauses and the end tail still fit the requested length.
 */
export const WORDS_PER_SECOND = Number(process.env.NARRATION_WORDS_PER_SECOND) || 2.75;
const TOLERANCE = 0.12;

export type WordBudget = {target: number; min: number; max: number};

export function wordBudget(seconds: number, wordsPerSecond = WORDS_PER_SECOND): WordBudget {
  const target = Math.round(seconds * wordsPerSecond);
  return {target, min: Math.floor(target * (1 - TOLERANCE)), max: Math.ceil(target * (1 + TOLERANCE))};
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function narrationWords(storyboard: Storyboard): number {
  return storyboard.scenes.reduce((sum, scene) => sum + countWords(scene.narration_text), 0);
}

/** Instruction added to the storyboard prompt. */
export function budgetInstruction(seconds: number): string {
  const {target, min, max} = wordBudget(seconds);
  return `The narration is spoken at about ${WORDS_PER_SECOND} words per second, so the narration_text of all scenes together must total about ${target} words (between ${min} and ${max}). Spread the words across the scenes in proportion to their estimated_duration_seconds.`;
}

/** Null when the storyboard's narration fits the budget, otherwise a repair message for the model. */
export function budgetProblem(storyboard: Storyboard, seconds: number): string | null {
  const words = narrationWords(storyboard);
  const {target, min, max} = wordBudget(seconds);
  if (words >= min && words <= max) return null;
  return `The narration has ${words} words in total, but a ${seconds}-second video needs about ${target} words (between ${min} and ${max}). ${words < min ? 'Expand' : 'Shorten'} the narration_text of the scenes to fit, keeping it accurate and natural.`;
}
