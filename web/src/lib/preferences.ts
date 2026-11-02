import type { VideoDuration, VoiceId } from "@/types/video";

/*
 * Defaults for new videos, chosen on the Settings page. Only options the pipeline actually honours are here;
 * language (English) and format (9:16) are fixed by the product. Saved per browser (see features/settings),
 * never sent anywhere, and never applied to videos that already exist.
 */

export interface VideoPreferences {
  durationSeconds: VideoDuration;
  voice: VoiceId;
  captions: boolean;
  music: boolean;
}

/** Bump when the shape changes; older stored data is then read field by field, keeping what is still valid. */
export const PREFERENCES_VERSION = 1;

/** Product defaults (match appConfig.video). Duplicated as plain values so this module stays dependency-free and testable. */
export const DEFAULT_PREFERENCES: Readonly<VideoPreferences> = Object.freeze({ durationSeconds: 60, voice: "female", captions: true, music: false });

const DURATIONS: readonly VideoDuration[] = [30, 60, 90];
const VOICES: readonly VoiceId[] = ["female", "male"];

/**
 * Turns whatever is stored (possibly missing, corrupt, hand-edited or from an older version) into valid preferences.
 * Each field falls back to its default on its own, so one bad value doesn't discard the rest. Never throws.
 */
export function parsePreferences(raw: string | null | undefined): VideoPreferences {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return {
    durationSeconds: DURATIONS.includes(record.durationSeconds as VideoDuration) ? (record.durationSeconds as VideoDuration) : DEFAULT_PREFERENCES.durationSeconds,
    voice: VOICES.includes(record.voice as VoiceId) ? (record.voice as VoiceId) : DEFAULT_PREFERENCES.voice,
    captions: typeof record.captions === "boolean" ? record.captions : DEFAULT_PREFERENCES.captions,
    music: typeof record.music === "boolean" ? record.music : DEFAULT_PREFERENCES.music,
  };
}

export function serializePreferences(preferences: VideoPreferences): string {
  const { durationSeconds, voice, captions, music } = preferences;
  return JSON.stringify({ version: PREFERENCES_VERSION, durationSeconds, voice, captions, music });
}

export const isDefaultPreferences = (preferences: VideoPreferences) =>
  (Object.keys(DEFAULT_PREFERENCES) as (keyof VideoPreferences)[]).every((key) => preferences[key] === DEFAULT_PREFERENCES[key]);

/** The value a form should use: the user's explicit choice for this video if they made one, otherwise the saved default. */
export const chosenOr = <T>(explicit: T | null | undefined, fallback: T): T => explicit ?? fallback;
