export type VideoDuration = 30 | 60 | 90;

export type AspectRatio = "9:16";

/** Narrator choices the pipeline supports (maps to its male/female voice settings). */
export type VoiceId = "female" | "male";

/** The only statuses the product shows to users (see dashboard design doc §5). */
export type VideoStatus = "draft" | "generating" | "ready" | "failed" | "expired";

export interface VideoProject {
  id: string;
  title: string;
  prompt: string;
  status: VideoStatus;
  durationSeconds: VideoDuration;
  createdAt: string;
  /** Present only when a rendered MP4 can actually be downloaded. */
  downloadUrl?: string;
}

/** Everything the user chooses before generating a video. */
export interface VideoRequest {
  prompt: string;
  durationSeconds: VideoDuration;
  voice: VoiceId;
  captions: boolean;
  music: boolean;
}
