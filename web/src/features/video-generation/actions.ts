"use server";

import { createVideo, getVideo, retryVideo } from "@/services";

export type VideoActionResult = { ok: true; videoId: string } | { ok: false; error: string };

/** Restarts a failed video with its saved settings. */
export async function retryGeneration(videoId: string): Promise<VideoActionResult> {
  const video = await retryVideo(String(videoId));
  return video ? { ok: true, videoId: video.id } : { ok: false, error: "This video can't be retried right now. Please refresh and try again." };
}

/** Creates a new video from an existing one's saved settings (used for ready and expired videos). */
export async function regenerateVideo(videoId: string): Promise<VideoActionResult> {
  const source = await getVideo(String(videoId));
  if (!source) return { ok: false, error: "We couldn't find the original video." };
  try {
    const video = await createVideo(source.request);
    return { ok: true, videoId: video.id };
  } catch {
    return { ok: false, error: "We couldn't start your video. Please try again." };
  }
}
