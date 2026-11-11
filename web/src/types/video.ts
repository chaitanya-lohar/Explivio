export type VideoDuration = 30 | 60 | 90;

export type AspectRatio = "9:16";

/** Narrator choices the pipeline supports (maps to its male/female voice settings). */
export type VoiceId = "female" | "male";

/** The only statuses the product shows to users (see dashboard design doc §5). */
export type VideoStatus = "draft" | "generating" | "ready" | "failed" | "expired";

/** Real pipeline stages: storyboard, narration, render, then saving the output. */
export type GenerationStage = "plan" | "narration" | "render" | "finishing";

/** Everything the user chooses before generating a video. */
export interface VideoRequest {
  prompt: string;
  durationSeconds: VideoDuration;
  voice: VoiceId;
  captions: boolean;
  music: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  prompt: string;
  status: VideoStatus;
  durationSeconds: VideoDuration;
  createdAt: string;
  /** Settings used to create the video, reused by retry and regenerate. */
  request: VideoRequest;
  /** When the current generation attempt started (generating/failed only). */
  startedAt?: string;
  /** Current stage while generating. */
  stage?: GenerationStage;
  /** Stage that failed, when status is "failed". */
  failedStage?: GenerationStage;
  /** Present only when a rendered MP4 can actually be played and downloaded. */
  videoUrl?: string;
  /** A still image of the video (My Videos, player poster); videos made before 2026-11-11 have none. */
  thumbnailUrl?: string;
  /** Measured length of the rendered video, when known. */
  actualDurationSeconds?: number;
  /** Short technical reason for a failure, safe to show (no secrets or paths). */
  errorDetail?: string;
}
