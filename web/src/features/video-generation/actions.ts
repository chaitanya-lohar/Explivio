"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { createVideo, GenerationLimitError, getVideo, PipelineBusyError, retryVideo } from "@/services";
import { securityEvent } from "@/lib/security/log";

/** Messages users may see as-is: the busy notice and the daily limit. Anything else stays generic. */
function startError(error: unknown, userId: string, fallback: string): string {
  if (error instanceof GenerationLimitError) {
    securityEvent("generation_limited", { userId });
    return error.message;
  }
  return error instanceof PipelineBusyError ? error.message : fallback;
}

export type VideoActionResult = { ok: true; videoId: string } | { ok: false; error: string };

const SIGNED_OUT = { ok: false as const, error: "Your session has ended. Please sign in again." };

/** Restarts a failed video with its saved settings. */
export async function retryGeneration(videoId: string): Promise<VideoActionResult> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  try {
    const video = await retryVideo(String(videoId), user.id);
    if (!video) securityEvent("access_denied", { userId: user.id, reason: "retry_not_allowed" });
    return video ? { ok: true, videoId: video.id } : { ok: false, error: "This video can't be retried right now. Please refresh and try again." };
  } catch (error) {
    return { ok: false, error: startError(error, user.id, "We couldn't restart your video. Please try again.") };
  }
}

/** Creates a new video from an existing one's saved settings (used for ready and expired videos). */
export async function regenerateVideo(videoId: string): Promise<VideoActionResult> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const source = await getVideo(String(videoId), user.id);
  if (!source) {
    securityEvent("access_denied", { userId: user.id, reason: "regenerate_not_found" });
    return { ok: false, error: "We couldn't find the original video." };
  }
  try {
    const video = await createVideo(source.request, user.id);
    return { ok: true, videoId: video.id };
  } catch (error) {
    return { ok: false, error: startError(error, user.id, "We couldn't start your video. Please try again.") };
  }
}
