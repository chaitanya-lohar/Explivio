export type VideoDuration = 30 | 60 | 90;

export type AspectRatio = "9:16";

/** The only statuses the product shows to users (see dashboard design doc §5). */
export type VideoStatus = "draft" | "generating" | "ready" | "failed" | "expired";

export interface VideoProject {
  id: string;
  title: string;
  prompt: string;
  status: VideoStatus;
  durationSeconds: VideoDuration;
  createdAt: string;
}
