import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTES, tint, type Palette} from '../theme';

/*
 * Colours every template uses. They follow the video's theme: the root composition calls setActivePalette() once
 * per render, before any scene is drawn, and these live bindings update (one video = one theme per render).
 */
export let VIOLET = PALETTES.midnight.primary;
export let TEAL = PALETTES.midnight.secondary;
export let WARM = PALETTES.midnight.warm;
export let TEXT = PALETTES.midnight.text;
export let MUTED = PALETTES.midnight.muted;
export let CARD = PALETTES.midnight.card;
export let BORDER = PALETTES.midnight.border;
export let INK = PALETTES.midnight.ink;
/** Outline of the item being explained (white on dark themes, ink on light ones). */
export let HILITE = PALETTES.midnight.hilite;
/** Card shadow for the active theme. */
export let SHADOW = PALETTES.midnight.shadow;
export let FONT = PALETTES.midnight.bodyFont;
/** Shadow behind labels drawn straight on the background (needed on dark and gradient themes, not on light ones). */
export let TEXT_SHADOW = '0 2px 12px rgba(0,0,0,.8)';
let active: Palette = PALETTES.midnight;

export function setActivePalette(palette: Palette): void {
  if (active === palette) return;
  active = palette;
  ({primary: VIOLET, secondary: TEAL, warm: WARM, text: TEXT, muted: MUTED, card: CARD, border: BORDER, ink: INK, hilite: HILITE, shadow: SHADOW, bodyFont: FONT} = palette);
  TEXT_SHADOW = palette.name === 'midnight' ? '0 2px 12px rgba(0,0,0,.8)' : palette.name === 'vibrant' ? '0 2px 10px rgba(42,18,89,.35)' : 'none';
}

export const activePalette = (): Palette => active;

/** The theme's primary colour at an alpha (glows and highlighted fills). */
export const primaryAlpha = (alpha: number) => tint(VIOLET, alpha);
export const secondaryAlpha = (alpha: number) => tint(TEAL, alpha);

/** The middle of the frame that every template draws into (px, inside the 1080×1920 video). */
export const AREA = {width: 940, height: 820};

/**
 * Props every template gets. `reveal` holds the frame (relative to the scene's Sequence) at which each label
 * appears, in `revealLabels()` order; without it a template uses its own fixed stagger.
 */
export type TemplateProps<V> = {visual: V; durationInFrames: number; reveal?: number[]};

/** Frame at which label i appears: the narration-timed frame if there is one, otherwise base + i·step. */
export const delayFor = (reveal: number[] | undefined, base: number, step: number) => (i: number) => reveal?.[i] ?? base + i * step;

/** 0 → 1 with a small overshoot, so items "pop" in rather than slide flatly. */
export const useReveal = (delayFrames: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delayFrames, fps, config: {damping: 13, stiffness: 140, mass: 0.7}});
};

/** Index of the last item that has appeared (−1 before the first). */
export const lastRevealed = (frame: number, delays: number[]) => delays.reduce((last, d, i) => (frame >= d ? i : last), -1);
