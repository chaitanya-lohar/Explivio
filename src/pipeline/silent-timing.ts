import {SPEECH_MODEL, estimateSpeechSeconds} from './script-checks';
import type {WordTime} from './scene-timing';

/*
 * Timing for SILENT EVALUATION runs (no narration audio, no ElevenLabs). Deterministic and documented, and always
 * labelled as estimated, never presented as measured:
 *   - each scene lasts its estimated speech time (the M7 speech model: letters + sentence and clause pauses);
 *   - inside a scene, each word gets time for its letters, plus the pause after it when it ends a sentence or clause;
 *   - a short lead-in before the first word and a tail after the last, like the narrated pipeline.
 * This lets the real templates, reveal-on-mention and captions be reviewed without spending narration credits.
 */

export const SILENT_LEAD_IN = 0.3;
export const SILENT_TAIL = 0.4;

export type SilentTiming = {sceneStarts: number[]; words: WordTime[]; captionCues: {start: number; end: number; text: string}[]; seconds: number; timing: 'estimated'};

export function wordSeconds(word: string): number {
  const letters = (word.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const pause = /[.!?]["')\]]?$/.test(word) ? SPEECH_MODEL.sentencePause : /[,;:–—]$/.test(word) ? SPEECH_MODEL.clausePause : 0;
  return letters * SPEECH_MODEL.secondsPerLetter + pause;
}

/** Captions in groups of up to 5 words, breaking after sentence ends, like the narrated captions. */
function cuesFrom(words: WordTime[]): SilentTiming['captionCues'] {
  const cues: SilentTiming['captionCues'] = [];
  let group: WordTime[] = [];
  const flush = () => { if (group.length) cues.push({start: group[0].start, end: group[group.length - 1].end, text: group.map((w) => w.text).join(' ')}); group = []; };
  for (const w of words) {
    group.push(w);
    if (group.length >= 5 || /[.!?]$/.test(w.text)) flush();
  }
  flush();
  return cues;
}

export function silentTiming(sceneTexts: readonly string[]): SilentTiming {
  const sceneStarts: number[] = [];
  const words: WordTime[] = [];
  let t = SILENT_LEAD_IN;
  sceneTexts.forEach((text, i) => {
    sceneStarts.push(i === 0 ? 0 : t);
    const sceneEnd = t + estimateSpeechSeconds(text);
    const parts = text.split(/\s+/).filter(Boolean);
    const raw = parts.map(wordSeconds);
    // Scale word slots so the scene matches its estimate exactly (the per-word split and the scene estimate agree).
    const scale = (sceneEnd - t) / Math.max(1e-6, raw.reduce((a, b) => a + b, 0));
    parts.forEach((part, j) => {
      const slot = raw[j] * scale;
      const speak = slot - (/[.!?,;:]["')\]]?$/.test(part) ? Math.min(slot * 0.5, SPEECH_MODEL.clausePause * scale) : 0);
      words.push({text: part, start: +t.toFixed(3), end: +(t + Math.max(0.05, speak)).toFixed(3)});
      t += slot;
    });
    t = sceneEnd;
  });
  return {sceneStarts, words, captionCues: cuesFrom(words), seconds: Math.max(1, Math.ceil(t + SILENT_TAIL)), timing: 'estimated'};
}
