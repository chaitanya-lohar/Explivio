import React from 'react';
import {useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard.js';
import type {WordTime} from '../pipeline/scene-timing';
import {fallbackVisual, resolveVisual, revealLabels} from '../pipeline/visual-plan';
import {mentionTimes} from '../pipeline/mention-timing';
import {RENDERED_TEMPLATES, TemplateVisual} from './templates';

// Kept here for existing callers; the logic now lives in pipeline/visual-plan.
export {label, layoutFor} from '../pipeline/visual-plan';
export type VisualLayout = 'process' | 'hub' | 'compare' | 'checklist' | 'focus';

type Scene = Storyboard['scenes'][number];

/** Narration timing for one scene: spoken words, the scene's spoken window (s), and where its Sequence starts (frame). */
export type SceneTiming = {words: readonly WordTime[]; start: number; end: number; sequenceFrom: number};

/** Items start appearing this many frames before their word, so they are settled as it is spoken. */
const LEAD_FRAMES = 6;

/** Frames (relative to the scene's Sequence) at which each label appears: when the narration mentions it. */
export function revealFrames(labels: readonly string[], ordered: boolean, timing: SceneTiming, fps: number): number[] {
  return mentionTimes(labels, timing.words, timing.start, timing.end, ordered).map((t) => Math.max(0, Math.round(t * fps) - timing.sequenceFrom - LEAD_FRAMES));
}

/**
 * Animated diagram for one scene, built only from that scene's own storyboard data: its v2 `visual` when valid
 * (and drawable), otherwise the M6 layout. With narration timing, items appear as they are mentioned.
 */
export const ConceptVisual: React.FC<{scene: Scene; durationInFrames: number; timing?: SceneTiming}> = ({scene, durationInFrames, timing}) => {
  const {fps} = useVideoConfig();
  const resolved = resolveVisual(scene).visual;
  const visual = RENDERED_TEMPLATES.includes(resolved.template) ? resolved : fallbackVisual(scene);
  const {labels, ordered} = revealLabels(visual);
  const reveal = timing?.words.length ? revealFrames(labels, ordered, timing, fps) : undefined;
  return <div style={{position: 'absolute', left: 70, right: 70, top: 560, height: 820, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif'}}>
    <TemplateVisual visual={visual} durationInFrames={durationInFrames} reveal={reveal} />
  </div>;
};
