import type { AspectRatio, VideoDuration, VoiceId } from "@/types/video";

export interface DurationOption {
  value: VideoDuration;
  label: string;
}

export interface VoiceOption {
  value: VoiceId;
  label: string;
  description: string;
}

export interface VideoConfig {
  durations: readonly DurationOption[];
  defaultDuration: VideoDuration;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  language: "en";
  voices: readonly VoiceOption[];
  defaultVoice: VoiceId;
  visualStyle: { name: string; description: string };
  captionsEnabled: boolean;
  musicEnabled: boolean;
  prompt: { minLength: number; maxLength: number };
}

export interface AppConfig {
  name: string;
  tagline: string;
  description: string;
  video: VideoConfig;
}

export const appConfig = {
  name: "Explivio",
  tagline: "Turn Ideas Into Videos",
  description: "Turn an educational idea into a narrated, captioned vertical video.",
  video: {
    durations: [
      { value: 30, label: "Quick overview" },
      { value: 60, label: "Balanced explainer" },
      { value: 90, label: "More detail" },
    ],
    defaultDuration: 60,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    language: "en",
    voices: [
      { value: "female", label: "Female voice", description: "Clear, friendly English narration" },
      { value: "male", label: "Male voice", description: "Clear, friendly English narration" },
    ],
    defaultVoice: "female",
    visualStyle: { name: "Clean motion graphics", description: "Animated diagrams, icons and text" },
    captionsEnabled: true,
    musicEnabled: false,
    prompt: { minLength: 10, maxLength: 600 },
  },
} as const satisfies AppConfig;

/** Human-readable output format, e.g. "9:16 vertical (1080 × 1920 MP4)". */
export const formatLabel = `${appConfig.video.aspectRatio} vertical (${appConfig.video.width} × ${appConfig.video.height} MP4)`;
