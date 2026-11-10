import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {label as shortLabel} from '../../pipeline/visual-plan';
import {AREA, BORDER, CARD, TEAL, TEXT, VIOLET, WARM, delayFor, lastRevealed, useReveal, type TemplateProps, primaryAlpha, SHADOW, HILITE} from './shared';

type Timeline = Extract<Visual, {template: 'timeline'}>;

const AXIS_X = 46;

/**
 * Events in order down a vertical time axis (vertical suits the 9:16 frame). The axis grows to each event as it is
 * mentioned; the event being explained is highlighted. Dates are shown only when the storyboard gives them.
 */
export const TimelineTemplate: React.FC<TemplateProps<Timeline>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const n = visual.events.length;
  const delay = delayFor(reveal, 6, 14);
  const delays = visual.events.map((_, i) => delay(i));
  const active = lastRevealed(frame, delays);
  const gap = 18;
  const rowH = Math.min(150, (AREA.height - gap * (n - 1)) / n);
  const centerY = (i: number) => i * (rowH + gap) + rowH / 2;
  // The axis line grows from the first event to the latest one mentioned.
  const reach = active < 0 ? 0 : centerY(active) + interpolate(frame - delays[active], [0, 12], [-(rowH + gap), 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) * (active > 0 ? 1 : 0);
  const totalH = n * rowH + (n - 1) * gap;
  return <div style={{position: 'relative', width: AREA.width, height: totalH}}>
    <div style={{position: 'absolute', left: AXIS_X - 3, top: centerY(0), width: 6, height: centerY(n - 1) - centerY(0), borderRadius: 3, background: BORDER}} />
    <div style={{position: 'absolute', left: AXIS_X - 3, top: centerY(0), width: 6, height: Math.max(0, reach - centerY(0)), borderRadius: 3, background: `linear-gradient(${TEAL}, ${VIOLET})`}} />
    {visual.events.map((event, i) => <Event key={i} top={i * (rowH + gap)} height={rowH} when={event.when} text={event.label} delay={delays[i]} active={i === active} done={i < active} />)}
  </div>;
};

const Event: React.FC<{top: number; height: number; when?: string; text: string; delay: number; active: boolean; done: boolean}> = ({top, height, when, text, delay, active, done}) => {
  const reveal = useReveal(delay);
  return <div style={{position: 'absolute', top, left: 0, right: 0, height, display: 'flex', alignItems: 'center'}}>
    <div style={{position: 'absolute', left: AXIS_X - 17, width: 34, height: 34, borderRadius: 17, background: active ? VIOLET : done ? TEAL : CARD, border: `4px solid ${active ? HILITE : done ? TEAL : BORDER}`, boxShadow: active ? `0 0 30px ${primaryAlpha(.6)}` : SHADOW, transform: `scale(${0.6 + 0.4 * reveal})`}} />
    <div style={{marginLeft: AXIS_X + 44, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, height: height - 8, padding: '0 26px', borderRadius: 22, background: active ? `${primaryAlpha(.2)}` : CARD, border: `2px solid ${active ? VIOLET : BORDER}`, opacity: reveal, transform: `translateX(${(1 - reveal) * 40}px)`}}>
      {when ? <div style={{fontSize: 28, fontWeight: 800, letterSpacing: 1, color: WARM}}>{when}</div> : null}
      <div style={{fontSize: height > 120 ? 38 : 32, fontWeight: 700, lineHeight: 1.15, color: TEXT}}>{shortLabel(text, 40)}</div>
    </div>
  </div>;
};
