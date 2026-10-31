import type { VideoProject } from "@/types/video";

/** Progress / failure screen for a video. */
export function progressHref(videoId: string): string {
  return `/generating?video=${encodeURIComponent(videoId)}`;
}

/** Where a video card should lead: progress while generating or failed, otherwise the details page. */
export function videoHref(video: Pick<VideoProject, "id" | "status">): string {
  return video.status === "generating" || video.status === "failed" ? progressHref(video.id) : `/videos/${video.id}`;
}
