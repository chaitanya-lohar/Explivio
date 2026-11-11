import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {BORDER, CARD, INK, TEAL, TEXT, VIOLET, delayFor, lastRevealed, useReveal, type TemplateProps, primaryAlpha, secondaryAlpha, MUTED, SHADOW, ItemIcon} from './shared';

/* The four M6 layouts, now fed by the v2 format. Without narration timings they animate exactly as in M6. */

type Of<T extends Visual['template']> = Extract<Visual, {template: T}>;

export const Steps: React.FC<TemplateProps<Of<'steps'>>> = ({visual, durationInFrames, reveal}) => {
  const frame = useCurrentFrame();
  const items = visual.steps;
  const delay = delayFor(reveal, 6, 9);
  // Highlight the step being explained: the last one mentioned, or (no timings) a sweep across the scene.
  const active = reveal
    ? Math.max(0, lastRevealed(frame, items.map((_, i) => delay(i))))
    : Math.min(items.length - 1, Math.floor(interpolate(frame, [0, durationInFrames * 0.9], [0, items.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})));
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0}}>
    {items.map((item, i) => <Step key={i} index={i} delay={delay(i)} text={item} active={i === active} done={i < active} last={i === items.length - 1} />)}
  </div>;
};

const Step: React.FC<{index: number; delay: number; text: string; active: boolean; done: boolean; last: boolean}> = ({index, delay, text, active, done, last}) => {
  const reveal = useReveal(delay);
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)`}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 26, width: '100%', padding: '24px 30px', borderRadius: 26, background: active ? `${primaryAlpha(.22)}` : CARD, border: `2px solid ${active ? VIOLET : BORDER}`, boxShadow: active ? `0 0 50px ${primaryAlpha(.35)}` : SHADOW}}>
      <div style={{flex: '0 0 auto', width: 64, height: 64, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: INK, background: done ? TEAL : active ? VIOLET : MUTED}}>{done ? '✓' : index + 1}</div>
      <ItemIcon label={text} size={44} color={active ? VIOLET : TEAL} reveal={reveal} />
      <div style={{fontSize: 38, lineHeight: 1.2, fontWeight: 700, color: TEXT}}>{text}</div>
    </div>
    {last ? null : <div style={{width: 6, height: 46, background: `linear-gradient(${done || active ? VIOLET : BORDER}, ${done ? TEAL : BORDER})`, borderRadius: 3}} />}
  </div>;
};

export const Hub: React.FC<TemplateProps<Of<'hub'>>> = ({visual, reveal}) => {
  const {center, spokes} = visual;
  const centerDelay = reveal?.[0] ?? 4;
  const centerReveal = useReveal(centerDelay);
  const positions = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, spokes.length);
  // Spoke i is label i + 1 in reveal order; its line starts drawing a little before its card.
  const at = (i: number) => reveal?.[i + 1] ?? 20 + i * 8;
  return <div style={{position: 'relative', width: 940, height: 760}}>
    <svg width={940} height={760} style={{position: 'absolute', inset: 0}}>
      {positions.map(([x, y], i) => <Spoke key={i} delay={at(i) - 6} x2={470 + x * 300} y2={380 + y * 250} />)}
    </svg>
    <div style={{position: 'absolute', left: 470 - 170, top: 380 - 170, width: 340, height: 340, borderRadius: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 34, boxSizing: 'border-box', background: `radial-gradient(circle, ${primaryAlpha(.45)}, ${primaryAlpha(.15)})`, border: `3px solid ${VIOLET}`, fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: TEXT, transform: `scale(${0.7 + centerReveal * 0.3})`, opacity: centerReveal}}>{center}</div>
    {spokes.map((item, i) => <Satellite key={i} delay={at(i)} text={item} x={470 + positions[i][0] * 300} y={380 + positions[i][1] * 250} />)}
  </div>;
};

const Spoke: React.FC<{delay: number; x2: number; y2: number}> = ({delay, x2, y2}) => {
  const reveal = useReveal(delay);
  // Starts at the centre circle's edge (radius 170), so the line never crosses the centre label.
  const length = Math.hypot(x2 - 470, y2 - 380);
  const x1 = 470 + ((x2 - 470) / length) * 172;
  const y1 = 380 + ((y2 - 380) / length) * 172;
  return <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * Math.min(1, reveal)} y2={y1 + (y2 - y1) * Math.min(1, reveal)} stroke={TEAL} strokeWidth={5} strokeLinecap="round" opacity={0.85} />;
};

const Satellite: React.FC<{delay: number; text: string; x: number; y: number}> = ({delay, text, x, y}) => {
  const reveal = useReveal(delay);
  return <div style={{position: 'absolute', left: x - 170, top: y - 70, width: 340, minHeight: 140, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '18px 22px', boxSizing: 'border-box', borderRadius: 24, background: CARD, border: `2px solid ${TEAL}`, fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: TEXT, opacity: reveal, transform: `scale(${0.8 + reveal * 0.2})`}}><ItemIcon label={text} size={46} color={TEAL} reveal={reveal} />{text}</div>;
};

export const Checklist: React.FC<TemplateProps<Of<'checklist'>>> = ({visual, reveal}) => {
  const delay = delayFor(reveal, 8, 12);
  return <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: '100%'}}>
    {visual.items.map((item, i) => <CheckRow key={i} delay={delay(i)} text={item} />)}
  </div>;
};

const CheckRow: React.FC<{delay: number; text: string}> = ({delay, text}) => {
  const reveal = useReveal(delay);
  const tick = useReveal(delay + 8);
  return <div style={{display: 'flex', alignItems: 'center', gap: 28, padding: '26px 32px', borderRadius: 26, background: CARD, border: `2px solid ${BORDER}`, opacity: reveal, transform: `translateX(${(1 - reveal) * -40}px)`}}>
    <div style={{flex: '0 0 auto', width: 62, height: 62, borderRadius: 31, background: TEAL, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, transform: `scale(${tick})`}}>✓</div>
    <ItemIcon label={text} size={42} color={VIOLET} reveal={reveal} />
    <div style={{fontSize: 38, lineHeight: 1.2, fontWeight: 700, color: TEXT}}>{text}</div>
  </div>;
};

export const Focus: React.FC<TemplateProps<Of<'focus'>>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const ring = useReveal(reveal?.[0] ?? 4);
  const pulse = 1 + Math.sin(frame / 14) * 0.03;
  const chipAt = (i: number) => reveal?.[i + 1] ?? 14 + i * 7;
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46, width: '100%'}}>
    <div style={{width: 380, height: 380, borderRadius: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 46, boxSizing: 'border-box', border: `4px solid ${VIOLET}`, boxShadow: `0 0 ${60 * ring}px ${primaryAlpha(.45)}, inset 0 0 60px ${secondaryAlpha(.18)}`, fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: TEXT, opacity: ring, transform: `scale(${(0.75 + ring * 0.25) * pulse})`}}>{visual.title}</div>
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16}}>
      {visual.chips.map((item, i) => <Chip key={i} delay={chipAt(i)} text={item} />)}
    </div>
  </div>;
};

const Chip: React.FC<{delay: number; text: string}> = ({delay, text}) => {
  const reveal = useReveal(delay);
  return <div style={{padding: '14px 24px', borderRadius: 999, background: `${secondaryAlpha(.14)}`, border: `2px solid ${TEAL}`, fontSize: 30, fontWeight: 700, color: TEXT, display: 'flex', alignItems: 'center', gap: 10, opacity: reveal, transform: `translateY(${(1 - reveal) * 16}px)`}}><ItemIcon label={text} size={30} color={TEAL} reveal={reveal} />{text}</div>;
};
