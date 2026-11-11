"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { toVideoRequest } from "@/lib/video-request";
import { createVideo, GenerationLimitError, PipelineBusyError } from "@/services";
import { securityEvent } from "@/lib/security/log";
import { assistPrompt } from "@/lib/ai/prompt-assist";
import { hit, LIMITS } from "@/lib/auth/rate-limit";
import type { VideoRequest } from "@/types/video";

export type GenerateVideoResult = { ok: true; videoId: string } | { ok: false; error: string };

/** Validates the request on the server (it can be called directly by POST) and starts generation for the signed-in user. */
export async function generateVideo(input: VideoRequest): Promise<GenerateVideoResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const parsed = toVideoRequest(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const video = await createVideo(parsed.request, user.id);
    return { ok: true, videoId: video.id };
  } catch (error) {
    if (error instanceof GenerationLimitError) {
      securityEvent("generation_limited", { userId: user.id });
      return { ok: false, error: error.message };
    }
    if (error instanceof PipelineBusyError) return { ok: false, error: error.message };
    return { ok: false, error: "We couldn't start your video. Please try again." };
  }
}

export type ImprovePromptResult = { ok: true; polished: string; suggestions: string[]; note: string } | { ok: false; error: string };

/** "Improve my prompt": Gemini suggests a clearer brief and related topics. Signed-in users, 30 a day each. */
export async function improvePrompt(prompt: string): Promise<ImprovePromptResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const text = String(prompt ?? "").trim();
  if (text.length < 3) return { ok: false, error: "Type a few words about your topic first." };
  if (text.length > 600) return { ok: false, error: "Please shorten your prompt to 600 characters." };
  const limited = await hit(`assist:acct:${user.id}`, LIMITS.promptAssistPerAccount);
  if (!limited.ok) return { ok: false, error: "You've used the prompt helper a lot today. Please try again tomorrow." };
  const result = await assistPrompt(text);
  if (result.ok) return { ok: true, ...result.value };
  if (result.reason === "unsuitable") return { ok: false, error: result.note ?? "This doesn't look like a topic for an explainer video." };
  return { ok: false, error: "The prompt helper isn't available right now. You can still create your video as written." };
}
