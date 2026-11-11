import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {AREA, CARD, MUTED, TEAL, TEXT, VIOLET, delayFor, lastRevealed, useReveal, type TemplateProps, primaryAlpha, SHADOW, ItemIcon} from './shared';

type Cycle = Extract<Visual, {template: 'cycle'}>;

const CX = AREA.width / 2;
const CY = 410;
const R = 290;

/**
 * Stages that repeat: placed clockwise from the top of a ring. Each arc draws in as its stage is mentioned and the
 * closing arc completes the loop; after that the highlight keeps travelling round so the repetition is visible.
 */
export const CycleTemplate: React.FC<TemplateProps<Cycle>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = visual.stages.length;
  const delay = delayFor(reveal, 6, 14);
  const delays = visual.stages.map((_, i) => delay(i));
  const closeAt = delays[n - 1] + 14;
  const nodeR = n <= 4 ? 118 : 98;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  // Highlight the stage being explained; once the loop has closed, step round it every 1.2 s.
  const active = frame < closeAt + 20 ? lastRevealed(frame, delays) : Math.floor((frame - closeAt - 20) / (fps * 1.2)) % n;
  const spin = useReveal(delays[0]);
  return <div style={{position: 'relative', width: AREA.width, height: AREA.height}}>
    <svg width={AREA.width} height={AREA.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {visual.stages.map((_, i) => <Arc key={i} from={angle(i)} to={angle(i) + (2 * Math.PI) / n} gap={(nodeR + 16) / R} delay={i === n - 1 ? closeAt : delays[i + 1] - 8} />)}
    </svg>
    <div style={{position: 'absolute', left: CX - 70, top: CY - 70, width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96, color: MUTED, opacity: spin * 0.7, transform: `rotate(${frame * 1.5}deg)`}}>↻</div>
    {visual.stages.map((stage, i) => <Stage key={i} text={stage} x={CX + R * Math.cos(angle(i))} y={CY + R * Math.sin(angle(i))} r={nodeR} delay={delays[i]} active={i === active} />)}
  </div>;
};

const Stage: React.FC<{text: string; x: number; y: number; r: number; delay: number; active: boolean}> = ({text, x, y, r, delay, active}) => {
  const reveal = useReveal(delay);
  return <div style={{position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, boxSizing: 'border-box', borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 22, background: active ? `${primaryAlpha(.30)}` : CARD, border: `3px solid ${active ? VIOLET : TEAL}`, boxShadow: active ? `0 0 50px ${primaryAlpha(.45)}` : SHADOW, fontSize: r > 100 ? 32 : 27, fontWeight: 700, lineHeight: 1.15, color: TEXT, flexDirection: 'column', gap: 8, opacity: reveal, transform: `scale(${(0.8 + reveal * 0.2) * (active ? 1.05 : 1)})`}}><ItemIcon label={text} size={r > 100 ? 48 : 40} color={active ? VIOLET : TEAL} reveal={reveal} />{text}</div>;
};

/** Clockwise arc of the ring between two stages, drawn progressively, with an arrowhead once complete. */
const Arc: React.FC<{from: number; to: number; gap: number; delay: number}> = ({from, to, gap, delay}) => {
  const draw = useReveal(delay);
  const a = from + gap;
  const b = to - gap;
  const length = R * (b - a);
  const point = (t: number) => [CX + R * Math.cos(t), CY + R * Math.sin(t)];
  const [x1, y1] = point(a);
  const [x2, y2] = point(b);
  // Arrowhead at the end, pointing along the clockwise tangent.
  const [tx, ty] = [-Math.sin(b), Math.cos(b)];
  const [nx, ny] = [Math.cos(b), Math.sin(b)];
  const head = `${x2 + tx * 8},${y2 + ty * 8} ${x2 - tx * 14 + nx * 13},${y2 - ty * 14 + ny * 13} ${x2 - tx * 14 - nx * 13},${y2 - ty * 14 - ny * 13}`;
  return <g>
    <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={TEAL} strokeWidth={6} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - Math.min(1, draw))} opacity={0.9} />
    <polygon points={head} fill={TEAL} opacity={draw > 0.9 ? 1 : 0} />
  </g>;
};
