"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { toVideoRequest } from "@/lib/video-request";
import { createVideo, PipelineBusyError } from "@/services";
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
    if (error instanceof PipelineBusyError) return { ok: false, error: error.message };
    return { ok: false, error: "We couldn't start your video. Please try again." };
  }
}
