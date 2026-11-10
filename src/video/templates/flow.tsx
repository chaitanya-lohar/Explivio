import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {AREA, BORDER, CARD, MUTED, TEAL, TEXT, VIOLET, delayFor, lastRevealed, useReveal, type TemplateProps, primaryAlpha, SHADOW} from './shared';

type Flow = Extract<Visual, {template: 'flow'}>;

/**
 * Places or stages joined in order: each link draws in as its next node is mentioned, then a small packet keeps
 * travelling along it so the direction of the flow stays visible.
 */
export const FlowTemplate: React.FC<TemplateProps<Flow>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const n = visual.nodes.length;
  const delay = delayFor(reveal, 6, 14);
  const delays = visual.nodes.map((_, i) => delay(i));
  const active = lastRevealed(frame, delays);
  const nodeH = n <= 4 ? 124 : 98;
  const gap = Math.min(120, (AREA.height - n * nodeH) / (n - 1));
  const top = (AREA.height - (n * nodeH + (n - 1) * gap)) / 2;
  const y = (i: number) => top + i * (nodeH + gap);
  return <div style={{position: 'relative', width: AREA.width, height: AREA.height}}>
    <svg width={AREA.width} height={AREA.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {visual.nodes.slice(1).map((_, i) => <Link key={i} from={y(i) + nodeH + 6} to={y(i + 1) - 8} delay={delays[i + 1] - 8} />)}
    </svg>
    {visual.nodes.map((node, i) => <Node key={i} text={node} index={i} count={n} top={y(i)} height={nodeH} delay={delays[i]} active={i === active} />)}
    {(visual.edge_labels ?? []).slice(0, n - 1).map((note, i) => note ? <EdgeNote key={i} text={note} centerY={y(i) + nodeH + gap / 2} delay={delays[i + 1]} /> : null)}
  </div>;
};

const Node: React.FC<{text: string; index: number; count: number; top: number; height: number; delay: number; active: boolean}> = ({text, index, count, top, height, delay, active}) => {
  const reveal = useReveal(delay);
  const edge = index === 0 ? VIOLET : index === count - 1 ? TEAL : BORDER;
  return <div style={{position: 'absolute', left: 150, width: 640, top, height, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 22, padding: '0 34px', borderRadius: height / 2, background: active ? `${primaryAlpha(.22)}` : CARD, border: `3px solid ${active ? VIOLET : edge}`, boxShadow: active ? `0 0 46px ${primaryAlpha(.38)}` : SHADOW, opacity: reveal, transform: `scale(${0.88 + reveal * 0.12})`}}>
    <div style={{flex: '0 0 auto', width: 22, height: 22, borderRadius: 11, background: index === count - 1 ? TEAL : VIOLET}} />
    <div style={{fontSize: height > 100 ? 38 : 32, lineHeight: 1.15, fontWeight: 700, color: TEXT}}>{text}</div>
  </div>;
};

/** Vertical arrow between two nodes, at the centre line of the frame. */
const Link: React.FC<{from: number; to: number; delay: number}> = ({from, to, delay}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = useReveal(delay);
  const x = AREA.width / 2;
  const end = from + (to - from) * Math.min(1, draw);
  // Once drawn, a packet loops down the link (one trip per second).
  const loop = ((frame - delay - 12) / fps) % 1;
  const packet = draw > 0.95 && frame > delay + 12 ? from + (to - from - 14) * loop : null;
  const head = interpolate(draw, [0.8, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <g>
    <line x1={x} y1={from} x2={x} y2={end} stroke={TEAL} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
    <polygon points={`${x - 16},${to - 16} ${x + 16},${to - 16} ${x},${to + 4}`} fill={TEAL} opacity={head} />
    {packet === null ? null : <circle cx={x} cy={packet} r={9} fill={VIOLET} opacity={Math.sin(Math.PI * loop)} />}
  </g>;
};

const EdgeNote: React.FC<{text: string; centerY: number; delay: number}> = ({text, centerY, delay}) => {
  const reveal = useReveal(delay);
  return <div style={{position: 'absolute', left: AREA.width / 2 + 34, right: 0, top: centerY - 20, fontSize: 26, lineHeight: 1.2, color: MUTED, fontStyle: 'italic', opacity: reveal}}>{text}</div>;
};
