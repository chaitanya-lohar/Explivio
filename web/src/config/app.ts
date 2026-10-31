import type { AspectRatio, VideoDuration } from "@/types/video";

export interface VideoConfig {
  durations: readonly VideoDuration[];
  defaultDuration: VideoDuration;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  language: "en";
  captionsEnabled: boolean;
  musicEnabled: boolean;
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
    durations: [30, 60, 90],
    defaultDuration: 60,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    language: "en",
    captionsEnabled: true,
    musicEnabled: false,
  },
} as const satisfies AppConfig;
