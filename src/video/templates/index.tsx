import React from 'react';
import type {TemplateName, Visual} from '../../schemas/visual';
import {Checklist, Focus, Hub, Steps} from './classic';
import {ComparisonTemplate} from './comparison';
import {CycleTemplate} from './cycle';
import {FlowTemplate} from './flow';
import {LayersTemplate} from './layers';
import {OrbitTemplate} from './orbit';
import {TimelineTemplate} from './timeline';

/** Every template in the schema can be drawn. Kept as a list so a future template can be added before it has a renderer. */
export const RENDERED_TEMPLATES: readonly TemplateName[] = ['orbit', 'cycle', 'layers', 'flow', 'timeline', 'comparison', 'steps', 'hub', 'checklist', 'focus'];

/** Draws one scene's visual. `reveal`: per-label frames from narration timing (see revealLabels). */
export const TemplateVisual: React.FC<{visual: Visual; durationInFrames: number; reveal?: number[]}> = ({visual, durationInFrames, reveal}) => {
  switch (visual.template) {
    case 'flow': return <FlowTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'cycle': return <CycleTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'orbit': return <OrbitTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'layers': return <LayersTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'timeline': return <TimelineTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'comparison': return <ComparisonTemplate visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'steps': return <Steps visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'hub': return <Hub visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'checklist': return <Checklist visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    case 'focus': return <Focus visual={visual} durationInFrames={durationInFrames} reveal={reveal} />;
    default: return null;
  }
};
