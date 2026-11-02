import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const VIOLET = '#8b7cff';
export const TEAL = '#4dd6c8';
export const WARM = '#f5c77a';
export const TEXT = '#f4f5fa';
export const MUTED = 'rgba(244,245,250,.62)';
export const CARD = 'rgba(29,33,48,.86)';
export const BORDER = 'rgba(244,245,250,.16)';
export const INK = '#10121a';

/** The middle of the frame that every template draws into (px, inside the 1080×1920 video). */
export const AREA = {width: 940, height: 820};

/**
 * Props every template gets. `reveal` holds the frame (relative to the scene's Sequence) at which each label
 * appears, in `revealLabels()` order; without it a template uses its own fixed stagger.
 */
export type TemplateProps<V> = {visual: V; durationInFrames: number; reveal?: number[]};

/** Frame at which label i appears: the narration-timed frame if there is one, otherwise base + i·step. */
export const delayFor = (reveal: number[] | undefined, base: number, step: number) => (i: number) => reveal?.[i] ?? base + i * step;

export const useReveal = (delayFrames: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delayFrames, fps, config: {damping: 18, stiffness: 120, mass: 0.7}});
};

/** Index of the last item that has appeared (−1 before the first). */
export const lastRevealed = (frame: number, delays: number[]) => delays.reduce((last, d, i) => (frame >= d ? i : last), -1);
