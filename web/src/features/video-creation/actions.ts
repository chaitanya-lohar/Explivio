"use server";

import { toVideoRequest } from "@/lib/video-request";
import { createVideo } from "@/services";
import type { VideoRequest } from "@/types/video";

export type GenerateVideoResult = { ok: true; videoId: string } | { ok: false; error: string };

/** Validates the request on the server (it can be called directly by POST) and starts generation. */
export async function generateVideo(input: VideoRequest): Promise<GenerateVideoResult> {
  const parsed = toVideoRequest(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const video = await createVideo(parsed.request);
    return { ok: true, videoId: video.id };
  } catch {
    return { ok: false, error: "We couldn't start your video. Please try again." };
  }
}
