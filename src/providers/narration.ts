import {createKokoroNarration} from './kokoro';
import type {NarrationOptions} from './elevenlabs';

/*
 * Chooses the narration voice engine (NARRATION_PROVIDER in the root .env):
 *   auto (default)  ElevenLabs when a key is set and the request succeeds; on any ElevenLabs failure (e.g. the free
 *                   monthly credits are used up) the same text is spoken by Kokoro instead, so the video is still made;
 *   kokoro          always Kokoro-82M (free, offline, unlimited);
 *   elevenlabs      always ElevenLabs (fails when credits run out, as before).
 * The manifest records which engine spoke the video, and why a fallback happened (reason code only, no key or text).
 */

export type NarrationProvider = 'auto' | 'kokoro' | 'elevenlabs';

export function narrationProvider(env: Record<string, string | undefined> = process.env): NarrationProvider {
  const value = (env.NARRATION_PROVIDER ?? 'auto').trim().toLowerCase();
  return value === 'kokoro' || value === 'elevenlabs' ? value : 'auto';
}

/** A short, safe code for why ElevenLabs failed (never the response body). */
export function fallbackReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota_exceeded|exceeds your quota/i.test(message)) return 'elevenlabs_quota_exceeded';
  if (/ELEVENLABS_API_KEY is missing/.test(message)) return 'elevenlabs_not_configured';
  if (/ElevenLabs 40[13]/.test(message)) return 'elevenlabs_rejected';
  if (/ElevenLabs 429/.test(message)) return 'elevenlabs_rate_limited';
  if (/ElevenLabs 5\d\d/.test(message)) return 'elevenlabs_server_error';
  if (/timeout|aborted/i.test(message)) return 'elevenlabs_timeout';
  return 'elevenlabs_error';
}

export async function createNarration(text: string, outputPath: string, selectedGender?: string, options: NarrationOptions = {}) {
  const mode = narrationProvider();
  if (mode === 'kokoro' || (mode === 'auto' && !process.env.ELEVENLABS_API_KEY)) {
    return {...(await createKokoroNarration(text, outputPath, selectedGender, {speed: options.speed})), fallbackFrom: undefined as string | undefined, fallbackReason: undefined as string | undefined};
  }
  const {createNarration: elevenLabs} = await import('./elevenlabs.js');
  if (mode === 'elevenlabs') return {...(await elevenLabs(text, outputPath, selectedGender, options)), provider: 'elevenlabs' as const, wordTiming: 'measured' as const};
  try {
    return {...(await elevenLabs(text, outputPath, selectedGender, options)), provider: 'elevenlabs' as const, wordTiming: 'measured' as const};
  } catch (error) {
    const reason = fallbackReason(error);
    console.log(`[narration] ElevenLabs unavailable (${reason}); using the free Kokoro voice instead.`);
    return {...(await createKokoroNarration(text, outputPath, selectedGender, {speed: options.speed})), fallbackFrom: 'elevenlabs', fallbackReason: reason};
  }
}
