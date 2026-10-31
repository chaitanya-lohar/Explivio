import type { GenerationStage } from "@/types/video";

export interface StageInfo {
  id: GenerationStage;
  label: string;
  description: string;
}

/** User-facing names for the pipeline's real stages, in order. */
export const generationStages: readonly StageInfo[] = [
  { id: "plan", label: "Preparing the video plan", description: "Writing the script and storyboard" },
  { id: "narration", label: "Creating narration", description: "Recording the voice-over" },
  { id: "render", label: "Rendering your video", description: "Animating scenes and adding captions" },
  { id: "finishing", label: "Finishing up", description: "Saving your video file" },
];

/** How often the progress screen asks the server for status. */
export const STATUS_POLL_MS = 2000;
