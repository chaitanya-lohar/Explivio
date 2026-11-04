import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Visual} from '../../schemas/visual';
import {bodyKind, markerAngle, orbitPoint, orbiterAngle} from '../../pipeline/orbit-geometry';
import {label as shortLabel} from '../../pipeline/visual-plan';
import {AREA, CARD, MUTED, TEAL, TEXT, VIOLET, WARM, delayFor, lastRevealed, useReveal, type TemplateProps} from './shared';

type Orbit = Extract<Visual, {template: 'orbit'}>;

const CX = AREA.width / 2 + 40;
const CY = 300;
const RX = 330;
const RY = 215;

const BODY: Record<ReturnType<typeof bodyKind>, {fill: string; glow: string}> = {
  star: {fill: 'radial-gradient(circle at 40% 38%, #fff3c4, #f5c77a 55%, #e0943a)', glow: 'rgba(245,199,122,.65)'},
  earth: {fill: 'radial-gradient(circle at 38% 35%, #9fe3ff, #3a8fd8 55%, #1f6f5c)', glow: 'rgba(77,170,230,.45)'},
  moon: {fill: 'radial-gradient(circle at 38% 35%, #f1f1f4, #b9bcc8 60%, #8a8e9c)', glow: 'rgba(220,222,235,.35)'},
  planet: {fill: 'radial-gradient(circle at 38% 35%, #f0c8a0, #c47a52 60%, #8c4a32)', glow: 'rgba(200,130,90,.4)'},
  other: {fill: 'radial-gradient(circle at 38% 35%, #c9c1ff, #8b7cff 60%, #5a4cc8)', glow: 'rgba(139,124,255,.45)'}
};

/**
 * One body circling another. The center is drawn large in the middle and the orbiter travels the path; with a light
 * source, light comes from the left and the orbiter's lit half faces it (so Moon phases read correctly). Markers are
 * positions on the path, listed in a legend below; when the narration mentions one, the orbiter glides there.
 */
export const OrbitTemplate: React.FC<TemplateProps<Orbit>> = ({visual, reveal}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lit = Boolean(visual.light);
  // Reveal order (see revealLabels): center, orbiter, [light], markers…
  const delay = delayFor(reveal, 4, 10);
  const centerAt = delay(0);
  const orbiterAt = delay(1);
  const lightAt = lit ? delay(2) : 0;
  const markerBase = lit ? 3 : 2;
  // Legend: one full-width column up to 3 markers, two columns beyond, so labels get the room they need.
  const markers = visual.markers.map((m, i) => ({text: shortLabel(m, visual.markers.length > 3 ? 22 : 36), at: delay(markerBase + i), angle: markerAngle(i, visual.markers.length, lit)}));
  const markerFrames = markers.map((m) => m.at);
  const active = lastRevealed(frame, markerFrames);
  const angle = orbiterAngle(frame, {startFrame: orbiterAt, startAngle: lit ? Math.PI * 0.75 : Math.PI / 2 + 0.6, turnFrames: fps * 8, markerFrames, markerAngles: markers.map((m) => m.angle), glideFrames: 14});
  const pos = orbitPoint(angle, CX, CY, RX, RY);
  const centerIn = useReveal(centerAt);
  const orbiterIn = useReveal(orbiterAt);
  const pathIn = useReveal(orbiterAt - 6);
  const lightIn = useReveal(lightAt);
  const center = BODY[bodyKind(visual.center)];
  const orbiter = BODY[bodyKind(visual.orbiter)];
  // Behind the center when on the far (upper) half of the path, for a little depth.
  const behind = Math.sin(angle) > 0.15 && Math.abs(pos.x - CX) < 110;
  const orbiterNode = <OrbiterBody x={pos.x} y={pos.y} fill={orbiter.fill} lit={lit} opacity={orbiterIn} />;
  return <div style={{position: 'relative', width: AREA.width, height: AREA.height}}>
    {lit ? <Light label={shortLabel(visual.light ?? '', 18)} reveal={lightIn} /> : null}
    <svg width={AREA.width} height={AREA.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke={TEAL} strokeWidth={3} strokeDasharray="10 12" opacity={0.75 * pathIn} />
      {markers.map((m, i) => {
        const p = orbitPoint(m.angle, CX, CY, RX, RY);
        const on = frame >= m.at;
        return <g key={i} opacity={on ? 1 : 0.25}>
          <circle cx={p.x} cy={p.y} r={i === active ? 15 : 11} fill={i === active ? VIOLET : CARD} stroke={i === active ? '#fff' : TEAL} strokeWidth={3} />
          <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize={18} fontWeight={800} fill={TEXT} fontFamily="Arial, sans-serif">{i + 1}</text>
        </g>;
      })}
    </svg>
    {behind ? orbiterNode : null}
    <div style={{position: 'absolute', left: CX - 92, top: CY - 92, width: 184, height: 184, borderRadius: 92, background: center.fill, boxShadow: `0 0 ${70 * centerIn}px ${center.glow}`, opacity: centerIn, transform: `scale(${0.7 + 0.3 * centerIn})`}} />
    <div style={{position: 'absolute', left: CX - 160, width: 320, top: CY + 100, textAlign: 'center', fontSize: 34, fontWeight: 800, color: TEXT, textShadow: '0 2px 12px rgba(0,0,0,.8)', opacity: centerIn}}>{shortLabel(visual.center, 24)}</div>
    {behind ? null : orbiterNode}
    <div style={{position: 'absolute', left: pos.x - 120, width: 240, top: pos.y - 78, textAlign: 'center', fontSize: 28, fontWeight: 700, color: TEXT, textShadow: '0 2px 10px rgba(0,0,0,.9)', opacity: orbiterIn}}>{shortLabel(visual.orbiter, 20)}</div>
    {markers.length ? <div style={{position: 'absolute', left: 30, right: 30, top: CY + RY + 70, display: 'grid', gridTemplateColumns: markers.length > 3 ? '1fr 1fr' : '1fr', gap: '12px 24px'}}>
      {markers.map((m, i) => <Marker key={i} index={i} text={m.text} delay={m.at} active={i === active} />)}
    </div> : null}
  </div>;
};

const OrbiterBody: React.FC<{x: number; y: number; fill: string; lit: boolean; opacity: number}> = ({x, y, fill, lit, opacity}) => <div style={{position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: 36, overflow: 'hidden', background: fill, opacity, boxShadow: '0 0 22px rgba(0,0,0,.6)'}}>
  {/* Light comes from the left: the right half is in shadow. */}
  {lit ? <div style={{position: 'absolute', left: 36, top: 0, width: 36, height: 72, background: 'rgba(8,10,20,.82)'}} /> : null}
</div>;

const Light: React.FC<{label: string; reveal: number}> = ({label, reveal}) => <div style={{position: 'absolute', left: -40, top: CY - 150, width: 150, height: 300, opacity: reveal}}>
  {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{position: 'absolute', left: 0, top: 30 + i * 58, width: 120 * reveal, height: 4, borderRadius: 2, background: `linear-gradient(90deg, rgba(245,199,122,0), ${WARM})`}} />)}
  <div style={{position: 'absolute', left: 6, top: -48, fontSize: 26, fontWeight: 800, color: WARM, whiteSpace: 'nowrap'}}>{label} →</div>
</div>;

const Marker: React.FC<{index: number; text: string; delay: number; active: boolean}> = ({index, text, delay, active}) => {
  const reveal = useReveal(delay);
  return <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderRadius: 18, background: active ? 'rgba(139,124,255,.22)' : CARD, border: `2px solid ${active ? VIOLET : 'rgba(244,245,250,.14)'}`, opacity: 0.35 + 0.65 * reveal}}>
    <div style={{flex: '0 0 auto', width: 38, height: 38, borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#10121a', background: active ? VIOLET : TEAL}}>{index + 1}</div>
    <div style={{fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: reveal > 0.5 ? TEXT : MUTED}}>{text}</div>
  </div>;
};
