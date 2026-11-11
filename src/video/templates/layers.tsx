import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {label as shortLabel} from '../../pipeline/visual-plan';
import {AREA, INK, MUTED, TEAL, TEXT, VIOLET, delayFor, lastRevealed, useReveal, type TemplateProps, CARD, SHADOW, HILITE, ItemIcon} from './shared';

type Layers = Extract<Visual, {template: 'layers'}>;

/** Band colours from the outer/top layer (the theme's secondary colour) to the inner/bottom one (its primary). */
export function layerColor(i: number, n: number, from: string = TEAL, to: string = VIOLET): string {
  const t = n <= 1 ? 0 : i / (n - 1);
  const rgb = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) : [128, 128, 128];
  const [a, b] = [rgb(from), rgb(to)];
  // Hex (#rrggbb) so callers can append an alpha suffix such as `${color}55`.
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Layers listed outermost/top first. "stack": horizontal bands top to bottom (atmosphere, network layers).
 * "nested": concentric rings, outermost first (Earth's interior, a cell). Each layer appears as it is mentioned and
 * the one being explained is highlighted.
 */
export const LayersTemplate: React.FC<TemplateProps<Layers>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const delay = delayFor(reveal, 6, 12);
  const delays = visual.layers.map((_, i) => delay(i));
  const active = lastRevealed(frame, delays);
  return visual.arrangement === 'nested'
    ? <Nested layers={visual.layers} delays={delays} active={active} />
    : <Stack layers={visual.layers} delays={delays} active={active} />;
};

type LayerProps = {layers: Layers['layers']; delays: number[]; active: number};

const Stack: React.FC<LayerProps> = ({layers, delays, active}) => {
  const n = layers.length;
  const gap = 14;
  const height = Math.min(150, (AREA.height - gap * (n - 1)) / n);
  return <div style={{display: 'flex', flexDirection: 'column', gap, width: '100%'}}>
    {layers.map((layer, i) => <Band key={i} index={i} count={n} text={layer.label} note={layer.note} height={height} delay={delays[i]} active={i === active} />)}
  </div>;
};

const Band: React.FC<{index: number; count: number; text: string; note?: string; height: number; delay: number; active: boolean}> = ({index, count, text, note, height, delay, active}) => {
  const reveal = useReveal(delay);
  const color = layerColor(index, count);
  return <div style={{position: 'relative', height, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', borderRadius: 22, overflow: 'hidden', background: `linear-gradient(90deg, ${color}55, ${color}22)`, border: `3px solid ${active ? HILITE : color}`, boxShadow: active ? `0 0 44px ${color}88` : SHADOW, opacity: reveal, transform: `translateX(${(1 - reveal) * (index % 2 ? 60 : -60)}px) scale(${active ? 1.02 : 1})`}}>
    <div style={{flex: '0 0 auto', width: 14, alignSelf: 'stretch', margin: '18px 0', borderRadius: 7, background: color}} />
    <ItemIcon label={text} size={height > 110 ? 48 : 40} color={color} reveal={reveal} />
    <div style={{minWidth: 0}}>
      <div style={{fontSize: height > 110 ? 40 : 34, fontWeight: 800, lineHeight: 1.1, color: TEXT}}>{shortLabel(text, 30)}</div>
      {note && height > 96 ? <div style={{marginTop: 6, fontSize: 26, lineHeight: 1.2, color: MUTED}}>{shortLabel(note, 48)}</div> : null}
    </div>
  </div>;
};

const Nested: React.FC<LayerProps> = ({layers, delays, active}) => {
  const n = layers.length;
  const outer = 395;
  const cx = AREA.width / 2;
  const cy = AREA.height / 2;
  const step = outer / n;
  return <div style={{position: 'relative', width: AREA.width, height: AREA.height}}>
    {layers.map((layer, i) => <Ring key={i} index={i} count={n} radius={outer - i * step} cx={cx} cy={cy} delay={delays[i]} active={i === active} />)}
    {/* Labels sit in each ring's band along the vertical axis (innermost in the middle), so they never overlap. */}
    {layers.map((layer, i) => <RingLabel key={i} text={layer.label} y={i === n - 1 ? cy : cy - (outer - (i + 0.5) * step)} delay={delays[i]} active={i === active} small={step < 80} />)}
  </div>;
};

const Ring: React.FC<{index: number; count: number; radius: number; cx: number; cy: number; delay: number; active: boolean}> = ({index, count, radius, cx, cy, delay, active}) => {
  const reveal = useReveal(delay);
  const color = layerColor(index, count);
  return <div style={{position: 'absolute', left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius, background: `radial-gradient(circle, ${color}66, ${color}33)`, border: `3px solid ${active ? HILITE : color}`, boxShadow: active ? `0 0 40px ${color}99` : SHADOW, opacity: reveal, transform: `scale(${0.85 + 0.15 * reveal})`}} />;
};

const RingLabel: React.FC<{text: string; y: number; delay: number; active: boolean; small: boolean}> = ({text, y, delay, active, small}) => {
  const reveal = useReveal(delay + 4);
  return <div style={{position: 'absolute', left: 0, right: 0, top: y - 22, display: 'flex', justifyContent: 'center', opacity: reveal}}>
    <div style={{padding: '4px 16px', borderRadius: 999, background: active ? VIOLET : CARD, fontSize: small ? 26 : 32, fontWeight: 800, color: active ? INK : TEXT, whiteSpace: 'nowrap'}}>{shortLabel(text, 26)}</div>
  </div>;
};
