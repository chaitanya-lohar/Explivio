import React from 'react';
import type {TemplateName, Visual} from '../../schemas/visual';
import {Checklist, Focus, Hub, Steps} from './classic';
import {ComparisonTemplate} from './comparison';
import {CycleTemplate} from './cycle';
import {FlowTemplate} from './flow';

/** Templates that can be drawn today; a scene asking for any other one falls back to its M6 layout. */
export const RENDERED_TEMPLATES: readonly TemplateName[] = ['flow', 'cycle', 'comparison', 'steps', 'hub', 'checklist', 'focus'];

/** Draws one scene's visual. `reveal`: per-label frames from narration timing (see revealLabels). */
export const TemplateVisual: React.FC<{visual: Visual; durationInFrames: number; reveal?: number[]}> = ({visual, durationInFrames, reveal}) => {
  switch (visual.template) {
    case 'flow': return <FlowTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'cycle': return <CycleTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'comparison': return <ComparisonTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'steps': return <Steps visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'hub': return <Hub visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'checklist': return <Checklist visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'focus': return <Focus visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    default: return null;
  }
};
