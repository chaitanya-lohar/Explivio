import React from 'react';
import type {Visual} from '../../schemas/visual';
import {CARD, INK, MUTED, TEAL, TEXT, VIOLET, WARM, delayFor, useReveal, type TemplateProps, SHADOW} from './shared';

type Comparison = Extract<Visual, {template: 'comparison'}>;

// A function, not a constant: the colours follow the active theme.
const badgeFor = (relation: Comparison['relation']): {mark: string; caption: string; color: string} =>
  relation === 'vs' ? {mark: 'VS', caption: '', color: WARM} : relation === 'like' ? {mark: '≈', caption: 'is like', color: TEAL} : {mark: '↔', caption: '', color: TEAL};

/**
 * Two things side by side. Each column's title and points appear as they are mentioned; the badge between them
 * says how they relate (contrasted, likened, or simply connected).
 */
export const ComparisonTemplate: React.FC<TemplateProps<Comparison>> = ({visual, reveal}) => {
  const {left, right} = visual;
  const delay = delayFor(reveal, 6, 9);
  const rightStart = 1 + left.points.length;
  // Without timings the right column follows the left one, as in M6.
  const leftDelays = [left.title, ...left.points].map((_, i) => delay(i));
  const rightDelays = [right.title, ...right.points].map((_, i) => reveal ? delay(rightStart + i) : 24 + i * 9);
  const badge = badgeFor(visual.relation);
  const badgeIn = useReveal(rightDelays[0] - 8);
  const tall = left.points.length + right.points.length === 0;
  return <div style={{position: 'relative', display: 'flex', alignItems: 'stretch', gap: 120, width: '100%'}}>
    <Column title={left.title} points={left.points} delays={leftDelays} color={VIOLET} from={-60} tall={tall} />
    <Column title={right.title} points={right.points} delays={rightDelays} color={visual.relation === 'vs' ? WARM : TEAL} from={60} tall={tall} />
    <div style={{position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{flex: '0 0 auto', width: 108, height: 108, borderRadius: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', background: badge.color, color: INK, fontSize: badge.mark === 'VS' ? 38 : 56, fontWeight: 900, boxShadow: SHADOW, opacity: badgeIn, transform: `scale(${0.5 + badgeIn * 0.5})`}}>{badge.mark}</div>
      {badge.caption ? <div style={{flex: '0 0 auto', marginTop: 12, fontSize: 26, fontStyle: 'italic', color: MUTED, whiteSpace: 'nowrap', opacity: badgeIn}}>{badge.caption}</div> : null}
    </div>
  </div>;
};

const Column: React.FC<{title: string; points: string[]; delays: number[]; color: string; from: number; tall: boolean}> = ({title, points, delays, color, from, tall}) => {
  const reveal = useReveal(delays[0]);
  return <div style={{flex: 1, minWidth: 0, minHeight: tall ? 340 : 0, display: 'flex', flexDirection: 'column', borderRadius: 30, background: CARD, border: `3px solid ${color}`, overflow: 'hidden', opacity: reveal, transform: `translateX(${(1 - reveal) * from}px)`}}>
    <div style={{flex: tall ? 1 : '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '28px 24px', background: tall ? 'transparent' : `${color}2e`, fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: TEXT}}>{title}</div>
    {points.length ? <div style={{display: 'flex', flexDirection: 'column', gap: 18, padding: '26px 24px 30px'}}>
      {points.map((point, i) => <Point key={i} text={point} delay={delays[i + 1]} color={color} />)}
    </div> : null}
  </div>;
};

const Point: React.FC<{text: string; delay: number; color: string}> = ({text, delay, color}) => {
  const reveal = useReveal(delay);
  return <div style={{display: 'flex', gap: 14, alignItems: 'flex-start', opacity: reveal, transform: `translateY(${(1 - reveal) * 14}px)`}}>
    <div style={{flex: '0 0 auto', width: 14, height: 14, marginTop: 12, borderRadius: 7, background: color}} />
    <div style={{fontSize: 30, lineHeight: 1.25, fontWeight: 600, color: TEXT}}>{text}</div>
  </div>;
};
