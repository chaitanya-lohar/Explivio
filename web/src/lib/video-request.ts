import { appConfig } from "@/config/app";
import type { VideoDuration, VideoRequest, VoiceId } from "@/types/video";

const { video } = appConfig;

/** Returns a user-facing error for the prompt, or null when it is valid. Shared by the forms and the server action. */
export function validatePrompt(prompt: string): string | null {
  const text = prompt.trim();
  if (!text) return "Please describe your topic before continuing.";
  if (text.length < video.prompt.minLength) return `Add a little more detail (at least ${video.prompt.minLength} characters).`;
  if (text.length > video.prompt.maxLength) return `Please keep your prompt under ${video.prompt.maxLength} characters.`;
  return null;
}

export function parseDuration(value: unknown): VideoDuration {
  const n = Number(value);
  return video.durations.find((d) => d.value === n)?.value ?? video.defaultDuration;
}

export function parseVoice(value: unknown): VoiceId {
  return video.voices.find((v) => v.value === value)?.value ?? video.defaultVoice;
}

/** URL for a creation step, carrying the prompt and duration between pages. */
export function creationHref(path: "/create" | "/configure", draft: { prompt?: string; durationSeconds?: VideoDuration }): string {
  const params = new URLSearchParams();
  if (draft.prompt?.trim()) params.set("prompt", draft.prompt.trim());
  if (draft.durationSeconds && draft.durationSeconds !== video.defaultDuration) params.set("duration", String(draft.durationSeconds));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Normalises untrusted input (e.g. from a server action) into a request, or returns the prompt error. */
export function toVideoRequest(input: Partial<Record<keyof VideoRequest, unknown>>): { request: VideoRequest } | { error: string } {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const error = validatePrompt(prompt);
  if (error) return { error };
  return {
    request: {
      prompt,
      durationSeconds: parseDuration(input.durationSeconds),
      voice: parseVoice(input.voice),
      captions: input.captions === undefined ? video.captionsEnabled : Boolean(input.captions),
      music: input.music === undefined ? video.musicEnabled : Boolean(input.music),
    },
  };
}
