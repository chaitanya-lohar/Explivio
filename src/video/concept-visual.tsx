import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard.js';

type Scene = Storyboard['scenes'][number];
export type VisualLayout = 'process' | 'hub' | 'compare' | 'checklist' | 'focus';

const VIOLET = '#8b7cff';
const TEAL = '#4dd6c8';
const TEXT = '#f4f5fa';
const MUTED = 'rgba(244,245,250,.62)';
const CARD = 'rgba(29,33,48,.86)';
const BORDER = 'rgba(244,245,250,.16)';

/** Which programmatic layout explains a scene best, from the storyboard's visual_type and how many elements it has. */
export function layoutFor(scene: Pick<Scene, 'visual_type' | 'key_elements'>): VisualLayout {
  const n = scene.key_elements.length;
  switch (scene.visual_type) {
    case 'process': return n >= 2 ? 'process' : 'focus';
    case 'diagram':
    case 'illustration': return n >= 2 ? 'hub' : 'focus';
    case 'analogy': return n >= 2 ? 'compare' : 'focus';
    case 'example':
    case 'summary': return n >= 2 ? 'checklist' : 'focus';
    default: return 'focus';
  }
}

/** Short, readable label: storyboard elements can be long phrases. */
export function label(text: string, max = 34): string {
  // Layouts draw their own step numbers, so drop list numbering the model sometimes adds ("1. Moon orbits").
  const clean = text.replace(/\s+/g, ' ').trim().replace(/^(?:step\s*)?\(?\d+[.):]\s+/i, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const useReveal = (delayFrames: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delayFrames, fps, config: {damping: 18, stiffness: 120, mass: 0.7}});
};

/** Animated diagram for one scene, built only from that scene's own storyboard data. Fills the middle of the frame. */
export const ConceptVisual: React.FC<{scene: Scene; durationInFrames: number}> = ({scene, durationInFrames}) => {
  const items = scene.key_elements.slice(0, 4).map((t) => label(t));
  const layout = layoutFor(scene);
  return <div style={{position: 'absolute', left: 70, right: 70, top: 560, height: 820, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif'}}>
    {layout === 'process' ? <Process items={items} durationInFrames={durationInFrames} /> : null}
    {layout === 'hub' ? <Hub items={items} /> : null}
    {layout === 'compare' ? <Compare items={items} /> : null}
    {layout === 'checklist' ? <Checklist items={items} /> : null}
    {layout === 'focus' ? <Focus title={label(scene.on_screen_text.replace(/\s*->\s*/g, ' → '), 40)} items={items} /> : null}
  </div>;
};

const Process: React.FC<{items: string[]; durationInFrames: number}> = ({items, durationInFrames}) => {
  const frame = useCurrentFrame();
  // Highlight moves through the steps across the scene, so the step being explained stands out.
  const active = Math.min(items.length - 1, Math.floor(interpolate(frame, [0, durationInFrames * 0.9], [0, items.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})));
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0}}>
    {items.map((item, i) => <Step key={i} index={i} text={item} active={i === active} done={i < active} last={i === items.length - 1} />)}
  </div>;
};

const Step: React.FC<{index: number; text: string; active: boolean; done: boolean; last: boolean}> = ({index, text, active, done, last}) => {
  const reveal = useReveal(6 + index * 9);
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)`}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 26, width: '100%', padding: '24px 30px', borderRadius: 26, background: active ? 'rgba(139,124,255,.22)' : CARD, border: `2px solid ${active ? VIOLET : BORDER}`, boxShadow: active ? '0 0 50px rgba(139,124,255,.35)' : 'none'}}>
      <div style={{flex: '0 0 auto', width: 64, height: 64, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#10121a', background: done ? TEAL : active ? VIOLET : 'rgba(244,245,250,.75)'}}>{done ? '✓' : index + 1}</div>
      <div style={{fontSize: 38, lineHeight: 1.2, fontWeight: 700, color: TEXT}}>{text}</div>
    </div>
    {last ? null : <div style={{width: 6, height: 46, background: `linear-gradient(${done || active ? VIOLET : BORDER}, ${done ? TEAL : BORDER})`, borderRadius: 3}} />}
  </div>;
};

const Hub: React.FC<{items: string[]}> = ({items}) => {
  const [center, ...spokes] = items;
  const centerReveal = useReveal(4);
  const positions = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, spokes.length);
  return <div style={{position: 'relative', width: 940, height: 760}}>
    <svg width={940} height={760} style={{position: 'absolute', inset: 0}}>
      {positions.map(([x, y], i) => <Spoke key={i} index={i} x2={470 + x * 300} y2={380 + y * 250} />)}
    </svg>
    <div style={{position: 'absolute', left: 470 - 170, top: 380 - 170, width: 340, height: 340, borderRadius: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 34, boxSizing: 'border-box', background: 'radial-gradient(circle, rgba(139,124,255,.45), rgba(139,124,255,.15))', border: `3px solid ${VIOLET}`, fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: TEXT, transform: `scale(${0.7 + centerReveal * 0.3})`, opacity: centerReveal}}>{center}</div>
    {spokes.map((item, i) => <Satellite key={i} index={i} text={item} x={470 + positions[i][0] * 300} y={380 + positions[i][1] * 250} />)}
  </div>;
};

const Spoke: React.FC<{index: number; x2: number; y2: number}> = ({index, x2, y2}) => {
  const reveal = useReveal(14 + index * 8);
  return <line x1={470} y1={380} x2={470 + (x2 - 470) * reveal} y2={380 + (y2 - 380) * reveal} stroke={TEAL} strokeWidth={5} strokeLinecap="round" opacity={0.85} />;
};

const Satellite: React.FC<{index: number; text: string; x: number; y: number}> = ({index, text, x, y}) => {
  const reveal = useReveal(20 + index * 8);
  return <div style={{position: 'absolute', left: x - 170, top: y - 70, width: 340, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '18px 22px', boxSizing: 'border-box', borderRadius: 24, background: CARD, border: `2px solid ${TEAL}`, fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: TEXT, opacity: reveal, transform: `scale(${0.8 + reveal * 0.2})`}}>{text}</div>;
};

const Compare: React.FC<{items: string[]}> = ({items}) => {
  const [a, b, note] = items;
  const left = useReveal(6);
  const mid = useReveal(16);
  const right = useReveal(24);
  const box = (text: string, color: string, reveal: number, from: number): React.CSSProperties => ({flex: 1, minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 30, borderRadius: 30, background: CARD, border: `3px solid ${color}`, fontSize: 40, fontWeight: 800, lineHeight: 1.2, color: TEXT, opacity: reveal, transform: `translateX(${(1 - reveal) * from}px)`});
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, width: '100%'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 24, width: '100%'}}>
      <div style={box(a, VIOLET, left, -60)}>{a}</div>
      <div style={{fontSize: 72, fontWeight: 800, color: TEAL, opacity: mid, transform: `scale(${0.6 + mid * 0.4})`}}>↔</div>
      <div style={box(b, TEAL, right, 60)}>{b}</div>
    </div>
    {note ? <div style={{fontSize: 32, color: MUTED, opacity: right, textAlign: 'center'}}>{note}</div> : null}
  </div>;
};

const Checklist: React.FC<{items: string[]}> = ({items}) => <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: '100%'}}>
  {items.map((item, i) => <CheckRow key={i} index={i} text={item} />)}
</div>;

const CheckRow: React.FC<{index: number; text: string}> = ({index, text}) => {
  const reveal = useReveal(8 + index * 12);
  const tick = useReveal(16 + index * 12);
  return <div style={{display: 'flex', alignItems: 'center', gap: 28, padding: '26px 32px', borderRadius: 26, background: CARD, border: `2px solid ${BORDER}`, opacity: reveal, transform: `translateX(${(1 - reveal) * -40}px)`}}>
    <div style={{flex: '0 0 auto', width: 62, height: 62, borderRadius: 31, background: TEAL, color: '#10121a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, transform: `scale(${tick})`}}>✓</div>
    <div style={{fontSize: 38, lineHeight: 1.2, fontWeight: 700, color: TEXT}}>{text}</div>
  </div>;
};

const Focus: React.FC<{title: string; items: string[]}> = ({title, items}) => {
  const frame = useCurrentFrame();
  const ring = useReveal(4);
  const pulse = 1 + Math.sin(frame / 14) * 0.03;
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46, width: '100%'}}>
    <div style={{width: 380, height: 380, borderRadius: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 46, boxSizing: 'border-box', border: `4px solid ${VIOLET}`, boxShadow: `0 0 ${60 * ring}px rgba(139,124,255,.45), inset 0 0 60px rgba(77,214,200,.18)`, fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: TEXT, opacity: ring, transform: `scale(${(0.75 + ring * 0.25) * pulse})`}}>{title}</div>
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16}}>
      {items.map((item, i) => <Chip key={i} index={i} text={item} />)}
    </div>
  </div>;
};

const Chip: React.FC<{index: number; text: string}> = ({index, text}) => {
  const reveal = useReveal(14 + index * 7);
  return <div style={{padding: '14px 24px', borderRadius: 999, background: 'rgba(77,214,200,.14)', border: `2px solid ${TEAL}`, fontSize: 30, fontWeight: 700, color: TEXT, opacity: reveal, transform: `translateY(${(1 - reveal) * 16}px)`}}>{text}</div>;
};
