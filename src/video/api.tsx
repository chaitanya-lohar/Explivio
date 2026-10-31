import React from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export type Word = {text: string; start: number; end: number};
export type ApiScene = {id: number; kicker: string; headline: string; narration: string; start: number; end: number; speechStart: number; speechEnd: number; audioPath: string; words: Word[]};
export type ApiVideoProps = {scenes: ApiScene[]; musicPath: string; seconds: number};

const C = {bg: '#0B1020', panel: '#141C34', panel2: '#1A2442', line: '#2A3557', text: '#F5F7FF', muted: '#9AA6C8', request: '#FFB547', api: '#8B7CFF', response: '#2ED3B7', client: '#4DA3FF', server: '#FF6B8B', skin: '#F1C7A0', hair: '#2B1E1A', wood: '#C98B5B'};
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const FADE = 0.35;
const STAGE_TOP = 470;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const prog = (t: number, a: number, d = 0.5) => interpolate(t, [a, a + d], [0, 1], {...clamp, easing: ease});
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

type Ctx = {t: number; fps: number; scene: ApiScene};
const pop = ({t, fps}: Ctx, a: number, damping = 13) => t < a ? 0 : spring({frame: (t - a) * fps, fps, config: {damping, stiffness: 170, mass: 0.7}});
// Start time of the nth narration word matching `re`, with a proportional fallback if alignment is missing.
const kw = (scene: ApiScene, re: RegExp, fallback: number, nth = 0) => scene.words.filter((w) => re.test(w.text.replace(/[^\w']/g, '')))[nth]?.start ?? lerp(scene.speechStart, scene.speechEnd, fallback);

export const ApiExplainer: React.FC<ApiVideoProps> = ({scenes, musicPath}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;
  const speaking = (time: number) => scenes.some((s) => time > s.speechStart - 0.25 && time < s.speechEnd + 0.25);
  return <AbsoluteFill style={{backgroundColor: C.bg, fontFamily: FONT, color: C.text}}>
    <Backdrop t={t} />
    {scenes.map((scene, index) => {
      const isLast = index === scenes.length - 1;
      if (t < scene.start - FADE || (!isLast && t > scene.end)) return null;
      const opacity = (index === 0 ? 1 : prog(t, scene.start - FADE, FADE)) * (isLast ? 1 : 1 - prog(t, scene.end - FADE, FADE));
      const ctx = {t, fps, scene};
      const Body = SCENES[index] || SceneSummary;
      return <AbsoluteFill key={scene.id} style={{opacity}}>
        <Heading ctx={ctx} />
        <svg viewBox="0 0 1080 900" style={{position: 'absolute', top: STAGE_TOP, left: 0, width: 1080, height: 900, overflow: 'visible'}}><Body ctx={ctx} /></svg>
      </AbsoluteFill>;
    })}
    <TopBar t={t} scenes={scenes} />
    <Captions t={t} scenes={scenes} />
    <AbsoluteFill style={{backgroundColor: C.bg, opacity: prog(t, total - 0.6, 0.6), pointerEvents: 'none'}} />
    {scenes.map((scene) => scene.audioPath ? <Sequence key={scene.id} from={Math.round(scene.speechStart * fps)}><Audio src={staticFile(scene.audioPath)} /></Sequence> : null)}
    {musicPath ? <Audio src={staticFile(musicPath)} volume={(f) => {
      const time = f / fps;
      const duck = speaking(time) ? 0.055 : 0.13;
      return duck * Math.min(1, time / 1.2) * Math.min(1, Math.max(0, (total - time) / 1.5));
    }} /> : null}
  </AbsoluteFill>;
};

const Backdrop: React.FC<{t: number}> = ({t}) => <AbsoluteFill>
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #0B1020 0%, #0F1733 55%, #0B1020 100%)'}} />
  <div style={{position: 'absolute', width: 900, height: 900, left: -260 + Math.sin(t * 0.35) * 70, top: 260 + Math.cos(t * 0.3) * 60, background: 'radial-gradient(circle, rgba(139,124,255,.20) 0%, rgba(139,124,255,0) 65%)'}} />
  <div style={{position: 'absolute', width: 900, height: 900, right: -300 + Math.cos(t * 0.28) * 70, top: 980 + Math.sin(t * 0.33) * 60, background: 'radial-gradient(circle, rgba(46,211,183,.15) 0%, rgba(46,211,183,0) 65%)'}} />
  <AbsoluteFill style={{backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.07) 1.6px, transparent 1.8px)', backgroundSize: '44px 44px', backgroundPosition: `0px ${(t * 10) % 44}px`}} />
</AbsoluteFill>;

const TopBar: React.FC<{t: number; scenes: ApiScene[]}> = ({t, scenes}) => <div style={{position: 'absolute', top: 96, left: 80, right: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
  <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
    <div style={{width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.api}, ${C.response})`}} />
    <div style={{fontSize: 28, fontWeight: 800, letterSpacing: 4}}>EXPLIVIO</div>
    <div style={{fontSize: 24, color: C.muted, letterSpacing: 3, marginLeft: 6}}>· TECH BASICS</div>
  </div>
  <div style={{display: 'flex', gap: 8}}>{scenes.map((s) => <div key={s.id} style={{width: 34, height: 8, borderRadius: 4, background: C.line, overflow: 'hidden'}}><div style={{height: '100%', width: `${prog(t, s.start, Math.max(0.1, s.end - s.start)) * 100}%`, background: C.text}} /></div>)}</div>
</div>;

const Heading: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const a = prog(t, scene.start - 0.15, 0.6); const b = prog(t, scene.start, 0.7);
  const [main, alt] = scene.headline.split('|');
  const s = alt ? prog(t, kw(scene, /^In$/, 0.4) - 0.15, 0.45) : 0;
  const line = (text: string, o: number, y: number) => <div style={{position: 'absolute', left: 0, right: 0, opacity: o, transform: `translateY(${y}px)`, fontSize: 76, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1, textWrap: 'balance'}} dangerouslySetInnerHTML={{__html: text.replace(/\*(.+?)\*/g, `<span style="color:${C.api}">$1</span>`)}} />;
  return <div style={{position: 'absolute', top: 200, left: 80, right: 80, height: 240}}>
    <div style={{fontSize: 26, fontWeight: 800, letterSpacing: 5, color: C.response, opacity: a, transform: `translateY(${(1 - a) * 20}px)`}}>{scene.kicker}</div>
    <div style={{position: 'relative', marginTop: 18}}>
      {line(main, b * (1 - s), (1 - b) * 40 - s * 30)}
      {alt ? line(alt, s, (1 - s) * 40) : null}
    </div>
  </div>;
};

const Captions: React.FC<{t: number; scenes: ApiScene[]}> = ({t, scenes}) => {
  const phrases = React.useMemo(() => scenes.flatMap((scene) => {
    const groups: Word[][] = []; let group: Word[] = [];
    for (const w of scene.words) {
      group.push(w);
      const chars = group.map((g) => g.text).join(' ').length;
      if (/[.,?!:;]$/.test(w.text) || group.length >= 5 || chars >= 26) { groups.push(group); group = []; }
    }
    if (group.length) groups.push(group);
    return groups.map((g, i) => ({words: g, start: g[0].start, end: Math.min(g[g.length - 1].end + 0.35, groups[i + 1]?.[0].start ?? Infinity)}));
  }), [scenes]);
  const active = phrases.find((p) => t >= p.start - 0.05 && t < p.end);
  if (!active) return null;
  const enter = prog(t, active.start - 0.05, 0.18);
  return <div style={{position: 'absolute', top: 1420, left: 90, right: 90, display: 'flex', justifyContent: 'center'}}>
    <div style={{background: 'rgba(8,12,26,.88)', border: '2px solid rgba(255,255,255,.10)', borderRadius: 24, padding: '18px 30px', fontSize: 46, fontWeight: 800, lineHeight: 1.2, textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 12}px)`, boxShadow: '0 18px 50px rgba(0,0,0,.35)'}}>
      {active.words.map((w, i) => <span key={i} style={{color: t >= w.start - 0.02 ? (t <= w.end + 0.08 ? C.request : C.text) : 'rgba(245,247,255,.55)'}}>{w.text}{i < active.words.length - 1 ? ' ' : ''}</span>)}
    </div>
  </div>;
};

/* ---------- Shared drawing pieces ---------- */

const Glow: React.FC<{x: number; y: number; r: number; color: string; o?: number}> = ({x, y, r, color, o = 1}) => <circle cx={x} cy={y} r={r} fill={color} opacity={0.18 * o} style={{filter: `blur(${r / 3}px)`}} />;

const Person: React.FC<{x: number; y: number; s?: number; shirt: string; t: number; vest?: boolean; chef?: boolean; legs?: boolean; walk?: number; arm?: React.ReactNode}> = ({x, y, s = 1, shirt, t, vest, chef, legs, walk = 0, arm}) => {
  const blink = (t * 1.3) % 3.2 < 0.12 ? 0.15 : 1;
  const swing = Math.sin(walk) * 16;
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    {legs ? <g stroke="#1F2742" strokeWidth={26} strokeLinecap="round"><line x1={-22} y1={190} x2={-22 + swing} y2={300} /><line x1={22} y1={190} x2={22 - swing} y2={300} /></g> : null}
    <path d={legs ? 'M-62 205 L-62 125 Q-62 72 0 72 Q62 72 62 125 L62 205 Z' : 'M-74 175 Q-74 76 0 76 Q74 76 74 175 Z'} fill={shirt} />
    {vest ? <path d="M-62 205 L-62 125 Q-62 80 -30 74 L0 150 L30 74 Q62 80 62 125 L62 205 Z" fill="#232B45" /> : null}
    {vest ? <path d="M-14 82 L0 92 L14 82 L14 102 L0 92 L-14 102 Z" fill={C.server} /> : null}
    <rect x={-15} y={36} width={30} height={42} rx={10} fill={C.skin} />
    <circle r={50} fill={C.skin} />
    <path d="M-50 -4 Q-54 -60 0 -60 Q54 -60 50 -4 Q38 -32 0 -32 Q-32 -32 -50 -4Z" fill={C.hair} />
    {chef ? <g fill="#FFFFFF"><rect x={-42} y={-74} width={84} height={30} rx={8} /><circle cx={-30} cy={-92} r={26} /><circle cx={0} cy={-104} r={30} /><circle cx={30} cy={-92} r={26} /></g> : null}
    <g fill="#1B1B2F" transform={`translate(0 6) scale(1 ${blink})`}><circle cx={-17} cy={0} r={5.5} /><circle cx={17} cy={0} r={5.5} /></g>
    <circle cx={-28} cy={20} r={8} fill="#F29C9C" opacity={0.35} /><circle cx={28} cy={20} r={8} fill="#F29C9C" opacity={0.35} />
    <path d="M-13 22 Q0 33 13 22" fill="none" stroke="#7A3E2E" strokeWidth={4} strokeLinecap="round" />
    {arm}
  </g>;
};

const Ticket: React.FC<{x: number; y: number; s?: number; rot?: number; label?: string; color?: string}> = ({x, y, s = 1, rot = 0, label, color = C.request}) => <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
  <rect x={-46} y={-58} width={92} height={116} rx={10} fill="#FFF8E8" stroke={color} strokeWidth={5} />
  <g stroke="#C9BFA8" strokeWidth={6} strokeLinecap="round"><line x1={-28} y1={-30} x2={28} y2={-30} /><line x1={-28} y1={-8} x2={18} y2={-8} /><line x1={-28} y1={14} x2={24} y2={14} /></g>
  {label ? <text y={44} textAnchor="middle" fontSize={18} fontWeight={800} fill={color}>{label}</text> : null}
</g>;

const Pill: React.FC<{x: number; y: number; w: number; color: string; text: string; s?: number; o?: number; h?: number; fs?: number; dark?: boolean}> = ({x, y, w, color, text, s = 1, o = 1, h = 64, fs = 28, dark = true}) => <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={color} />
  <text y={fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={800} letterSpacing={2} fill={dark ? '#0B1020' : C.text}>{text}</text>
</g>;

const Arrow: React.FC<{x1: number; x2: number; y: number; p: number; color?: string; dir?: 1 | -1}> = ({x1, x2, y, p, color = C.muted, dir = 1}) => {
  const [a, b] = dir === 1 ? [x1, x2] : [x2, x1];
  const end = lerp(a, b, p);
  return <g opacity={p > 0 ? 1 : 0} stroke={color} strokeWidth={6} strokeLinecap="round" fill="none">
    <line x1={a} y1={y} x2={end} y2={y} />
    {p > 0.6 ? <path d={`M${end - 18 * dir} ${y - 16} L${end} ${y} L${end - 18 * dir} ${y + 16}`} strokeLinejoin="round" /> : null}
  </g>;
};

const Icon: React.FC<{kind: 'client' | 'api' | 'server' | 'bag' | 'card'; x: number; y: number; s?: number; color: string; t?: number}> = ({kind, x, y, s = 1, color, t = 0}) => <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
  {kind === 'client' ? <><rect x={-30} y={-48} width={60} height={96} rx={12} /><line x1={-8} y1={34} x2={8} y2={34} /><rect x={-18} y={-30} width={36} height={44} rx={4} fill={color} opacity={0.25} stroke="none" /></> : null}
  {kind === 'api' ? <><path d="M-38 -14 L32 -14 M18 -30 L34 -14 L18 2" /><path d="M38 16 L-32 16 M-18 0 L-34 16 L-18 32" /></> : null}
  {kind === 'server' ? <>{[-34, 0, 34].map((yy, i) => <g key={yy}><rect x={-44} y={yy - 14} width={88} height={28} rx={7} /><circle cx={-26} cy={yy} r={4} fill={(Math.floor(t * 4) + i) % 3 === 0 ? C.response : color} stroke="none" /></g>)}</> : null}
  {kind === 'bag' ? <><path d="M-34 -14 L34 -14 L28 44 L-28 44 Z" /><path d="M-16 -14 Q-16 -42 0 -42 Q16 -42 16 -14" /></> : null}
  {kind === 'card' ? <><rect x={-44} y={-30} width={88} height={60} rx={10} /><line x1={-44} y1={-10} x2={44} y2={-10} /><line x1={-28} y1={14} x2={-6} y2={14} /></> : null}
</g>;

const Node: React.FC<{x: number; y: number; size: number; kind: 'client' | 'api' | 'server'; color: string; label: string; sub?: string; on: number; appear: number; t: number}> = ({x, y, size, kind, color, label, sub, on, appear, t}) => <g transform={`translate(${x} ${y}) scale(${0.6 + appear * 0.4 + on * 0.06})`} opacity={appear}>
  <Glow x={0} y={0} r={size * 0.75} color={color} o={on} />
  <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.22} fill={C.panel} stroke={on > 0.01 ? color : C.line} strokeWidth={4 + on * 3} />
  <Icon kind={kind} x={0} y={0} s={size / 150} color={on > 0.01 ? color : C.muted} t={t} />
  <text y={size / 2 + 52} textAnchor="middle" fontSize={size * 0.19} fontWeight={800} fill={C.text}>{label}</text>
  {sub ? <text y={size / 2 + 90} textAnchor="middle" fontSize={26} fontWeight={600} fill={on > 0.01 ? color : C.muted}>{sub}</text> : null}
</g>;

const Panel: React.FC<{x: number; y: number; w: number; h: number; children?: React.ReactNode; o?: number}> = ({x, y, w, h, children, o = 1}) => <g opacity={o}>
  <rect x={x} y={y} width={w} height={h} rx={36} fill={C.panel} stroke={C.line} strokeWidth={3} />
  {children}
</g>;

/* Restaurant interior used by the analogy scenes. */
const Restaurant: React.FC<{t: number}> = ({t}) => <g>
  <defs><clipPath id="room"><rect x={40} y={20} width={1000} height={860} rx={40} /></clipPath></defs>
  <g clipPath="url(#room)">
    <rect x={40} y={20} width={1000} height={860} fill="#17203C" />
    {[230, 850].map((wx) => <g key={wx}><path d={`M${wx - 110} 400 L${wx - 110} 200 Q${wx - 110} 110 ${wx} 110 Q${wx + 110} 110 ${wx + 110} 200 L${wx + 110} 400 Z`} fill="#0E1530" stroke="#2C3962" strokeWidth={10} /><circle cx={wx + 40} cy={190} r={26} fill="#FFE7A8" opacity={0.85} />{[0, 1, 2].map((i) => <circle key={i} cx={wx - 60 + i * 40} cy={260 + (i % 2) * 40} r={3} fill="#FFFFFF" opacity={0.4 + 0.4 * Math.sin(t * 2 + i + wx)} />)}<line x1={wx} y1={110} x2={wx} y2={400} stroke="#2C3962" strokeWidth={8} /></g>)}
    {[400, 680].map((lx, i) => <g key={lx} transform={`rotate(${Math.sin(t * 1.4 + i) * 3} ${lx} 20)`}><line x1={lx} y1={20} x2={lx} y2={120} stroke="#3A466E" strokeWidth={4} /><path d={`M${lx - 40} 150 Q${lx} 100 ${lx + 40} 150 Z`} fill={C.request} /><circle cx={lx} cy={165} r={60} fill="#FFD27A" opacity={0.12} /></g>)}
    <rect x={40} y={700} width={1000} height={180} fill="#1E2848" />
    {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={40 + i * 200} y1={700} x2={i * 200 - 60} y2={880} stroke="#26315A" strokeWidth={4} />)}
  </g>
  <rect x={40} y={20} width={1000} height={860} rx={40} fill="none" stroke={C.line} strokeWidth={3} />
</g>;

const Table: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => <g>
  <rect x={x - w / 2} y={y} width={w} height={150} rx={16} fill="#E9E1D2" />
  <path d={`M${x - w / 2} ${y + 40} Q${x - w / 4} ${y + 70} ${x} ${y + 40} Q${x + w / 4} ${y + 70} ${x + w / 2} ${y + 40} L${x + w / 2} ${y + 150} L${x - w / 2} ${y + 150} Z`} fill="#D4C8B2" />
  <rect x={x - w / 2 - 14} y={y - 14} width={w + 28} height={26} rx={13} fill={C.wood} />
</g>;

/* ---------- Scenes ---------- */

const SceneHook: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const a = pop(ctx, scene.start + 0.05, 14); const b = pop(ctx, scene.start + 0.3, 14);
  const link = prog(t, kw(scene, /communicate/, 0.5) - 0.4, 0.9);
  const phone = (x: number, appear: number, from: number, color: string, kind: 'bag' | 'card', name: string) => <g transform={`translate(${lerp(from, x, appear)} 400)`} opacity={Math.min(1, appear * 1.4)}>
    <Glow x={0} y={0} r={200} color={color} o={0.5 + link * 0.5} />
    <rect x={-140} y={-260} width={280} height={520} rx={48} fill={C.panel} stroke={color} strokeWidth={5} />
    <rect x={-40} y={-244} width={80} height={14} rx={7} fill={C.line} />
    <rect x={-112} y={-200} width={224} height={170} rx={24} fill={color} opacity={0.16} />
    <Icon kind={kind} x={0} y={-115} s={1.3} color={color} />
    <text y={20} textAnchor="middle" fontSize={34} fontWeight={800} fill={C.text}>{name}</text>
    {[70, 120, 170].map((yy, i) => <rect key={yy} x={-100} y={yy} width={[200, 150, 176][i]} height={22} rx={11} fill={C.line} />)}
  </g>;
  const path = 'M 330 330 C 470 190, 610 190, 750 330';
  const len = 520;
  const packets = [0, 1, 2].map((i) => { const p = ((t * 0.55 + i / 3) % 1); return {p, color: i % 2 ? C.response : C.request}; });
  const qa = pop(ctx, scene.start + 0.6) * (1 - link);
  return <g>
    {phone(240, a, -200, C.client, 'bag', 'Shop App')}
    {phone(840, b, 1280, C.response, 'card', 'Pay App')}
    <path d={path} fill="none" stroke={C.api} strokeWidth={8} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - link)} />
    <path d={path} fill="none" stroke={C.api} strokeWidth={22} strokeLinecap="round" opacity={0.18 * link} />
    {link > 0.95 ? packets.map((pk, i) => { const u = pk.p; const x = (1 - u) ** 3 * 330 + 3 * (1 - u) ** 2 * u * 470 + 3 * (1 - u) * u * u * 610 + u ** 3 * 750; const y = (1 - u) ** 3 * 330 + 3 * (1 - u) ** 2 * u * 190 + 3 * (1 - u) * u * u * 190 + u ** 3 * 330; return <circle key={i} cx={i % 2 ? 1080 - x : x} cy={y} r={13} fill={pk.color} />; }) : null}
    <g transform={`translate(540 ${170 + Math.sin(t * 3) * 8}) scale(${qa})`}><circle r={56} fill={C.panel2} stroke={C.request} strokeWidth={5} /><text y={22} textAnchor="middle" fontSize={64} fontWeight={800} fill={C.request}>?</text></g>
    <g opacity={prog(t, kw(scene, /other/, 0.9), 0.5)}><Pill x={540} y={790} w={460} color={C.api} text="HOW DO THEY TALK?" fs={30} dark={false} /></g>
  </g>;
};

const SceneCustomer: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const menuAt = kw(scene, /menu/, 0.45) - 0.3;
  const chooseAt = kw(scene, /dish/, 0.4);
  const orderAt = kw(scene, /place/, 0.7);
  const ringAt = scene.speechEnd - 0.2;
  const menu = pop(ctx, menuAt);
  const pick = prog(t, chooseAt, 0.4);
  const bubble = pop(ctx, orderAt);
  const ring = prog(t, ringAt, 0.5);
  const reach = prog(t, menuAt, 0.5);
  const items = [['Pasta', '₹320'], ['Pizza', '₹450'], ['Salad', '₹260']];
  return <g>
    <Restaurant t={t} />
    <g opacity={ring}><circle cx={500} cy={470} r={190 + Math.sin(t * 4) * 6} fill="none" stroke={C.request} strokeWidth={6} strokeDasharray="22 16" transform={`rotate(${t * 20} 500 470)`} /><Glow x={500} y={470} r={200} color={C.request} /></g>
    <Person x={500} y={420} t={t} shirt={C.client} arm={<path d={`M52 110 Q${90 + reach * 40} ${80 - reach * 30} ${110 + reach * 70} ${60 - reach * 50}`} stroke={C.client} strokeWidth={28} strokeLinecap="round" fill="none" />} />
    <Table x={500} y={600} w={520} />
    <g><ellipse cx={380} cy={584} rx={58} ry={14} fill="#FFFFFF" /><rect x={600} y={530} width={36} height={56} rx={8} fill="#9DD6FF" opacity={0.7} /></g>
    <g transform={`translate(800 ${330 - (1 - menu) * 40}) rotate(${-4 + (1 - menu) * 12}) scale(${menu})`}>
      <rect x={-150} y={-190} width={300} height={380} rx={22} fill="#FFF8E8" stroke={C.wood} strokeWidth={6} />
      <text y={-128} textAnchor="middle" fontSize={40} fontWeight={800} fill="#3B2A20" letterSpacing={4}>MENU</text>
      {items.map(([name, price], i) => <g key={name} transform={`translate(0 ${-50 + i * 84})`}>
        {i === 0 ? <rect x={-132} y={-36} width={264} height={60} rx={14} fill={C.request} opacity={pick * 0.9} /> : null}
        <text x={-110} y={8} fontSize={32} fontWeight={700} fill="#3B2A20">{name}</text>
        <text x={110} y={8} textAnchor="end" fontSize={28} fontWeight={600} fill="#6B5847">{price}</text>
      </g>)}
      <g opacity={pick} transform={`translate(-150 -56) scale(${pick})`}><circle r={18} fill={C.response} /><path d="M-8 0 L-2 7 L9 -7" stroke="#0B1020" strokeWidth={5} fill="none" strokeLinecap="round" /></g>
    </g>
    <g transform={`translate(250 170) scale(${bubble})`}>
      <rect x={-190} y={-62} width={380} height={124} rx={34} fill={C.text} />
      <path d="M90 56 L150 120 L40 60 Z" fill={C.text} />
      <text y={14} textAnchor="middle" fontSize={38} fontWeight={800} fill="#0B1020">One pasta, please!</text>
    </g>
    <g opacity={ring} transform={`translate(0 ${(1 - ring) * 20})`}><rect x={190} y={760} width={700} height={84} rx={42} fill={C.panel} stroke={C.request} strokeWidth={4} /><text x={540} y={815} textAnchor="middle" fontSize={34} fontWeight={800} fill={C.text}>You = the one making a <tspan fill={C.request}>REQUEST</tspan></text></g>
  </g>;
};

const FLOW_X = [190, 540, 890];
const FlowRow: React.FC<{ctx: Ctx; y: number; size: number; appearAt: number; on: number[]; subs?: string[]; packet?: {p: number; text: string; color: string; dir: 1 | -1}; arrows: number; arrowDir?: 1 | -1}> = ({ctx, y, size, appearAt, on, subs, packet, arrows, arrowDir = 1}) => {
  const nodes: ['client' | 'api' | 'server', string, string][] = [['client', 'Client', C.client], ['api', 'API', C.api], ['server', 'Server', C.server]];
  const half = size / 2 + 14;
  let px = 0;
  if (packet) px = packet.dir === 1 ? lerp(FLOW_X[0], FLOW_X[2], packet.p) : lerp(FLOW_X[2], FLOW_X[0], packet.p);
  return <g>
    <Arrow x1={FLOW_X[0] + half} x2={FLOW_X[1] - half} y={y} p={prog(arrows, 0, 0.5)} dir={arrowDir} color={arrowDir === 1 ? C.request : C.response} />
    <Arrow x1={FLOW_X[1] + half} x2={FLOW_X[2] - half} y={y} p={prog(arrows, 0.5, 0.5)} dir={arrowDir} color={arrowDir === 1 ? C.request : C.response} />
    {nodes.map(([kind, label, color], i) => <Node key={kind} x={FLOW_X[i]} y={y} size={size} kind={kind} color={color} label={label} sub={subs?.[i]} on={on[i]} appear={pop(ctx, appearAt + i * 0.12, 15)} t={ctx.t} />)}
    {packet && packet.p > 0 && packet.p < 1 ? <Pill x={px} y={y - size / 2 - 50} w={200} h={56} fs={24} color={packet.color} text={packet.text} /> : null}
  </g>;
};

// Travel with a short stop at the API node in the middle.
const relay = (t: number, a: number, d: number) => {
  const leg = d * 0.42; const hold = d * 0.16;
  return t < a + leg ? prog(t, a, leg) * 0.5 : t < a + leg + hold ? 0.5 : 0.5 + prog(t, a + leg + hold, leg) * 0.5;
};

const SceneWaiter: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const split = kw(scene, /^In$/, 0.4) - 0.15;
  const room = 1 - prog(t, split, 0.45);
  const walk = prog(t, scene.start + 0.2, Math.max(1, split - scene.start - 0.6));
  const wx = lerp(300, 650, walk);
  const door = prog(t, split - 0.6, 0.4);
  const diagram = prog(t, split, 0.4);
  const hi = (re: RegExp, f: number) => prog(t, kw(scene, re, f) - 0.1, 0.3);
  const carries = kw(scene, /carries/, 0.75);
  const packetP = relay(t, carries, Math.max(1.6, scene.speechEnd - carries + 0.2));
  return <g>
    <g opacity={room} transform={`translate(540 450) scale(${0.94 + room * 0.06}) translate(-540 -450)`}>
      <Restaurant t={t} />
      <g transform="translate(30 140) scale(.8)"><Person x={200} y={420} t={t} shirt={C.client} /><Table x={200} y={600} w={300} /></g>
      <g><rect x={760} y={280} width={220} height={420} rx={14} fill="#2A2F48" stroke="#3A466E" strokeWidth={6} />
        <g transform={`translate(760 0) scale(${1 - door * 0.55} 1)`}><rect x={0} y={280} width={220} height={420} rx={14} fill="#8A5A3B" /><circle cx={110} cy={400} r={48} fill="#FFE2A3" stroke="#5E3C27" strokeWidth={10} /><circle cx={190} cy={500} r={9} fill="#E9C46A" /></g>
        <rect x={765} y={210} width={210} height={56} rx={14} fill={C.request} /><text x={870} y={250} textAnchor="middle" fontSize={30} fontWeight={800} fill="#0B1020" letterSpacing={3}>KITCHEN</text>
        <rect x={760} y={694} width={220} height={10} fill="#FFD27A" opacity={0.6} /></g>
      <Person x={wx} y={340} s={0.9} t={t} shirt="#F5F7FF" vest legs walk={t * 9 * (walk > 0 && walk < 1 ? 1 : 0)} arm={<g><path d="M50 100 Q100 70 112 20" stroke="#232B45" strokeWidth={26} strokeLinecap="round" fill="none" /><Ticket x={122} y={-34} s={0.75} rot={8} /></g>} />
    </g>
    <g opacity={diagram}>
      <FlowRow ctx={ctx} y={330} size={220} appearAt={split} on={[hi(/application/, 0.45), hi(/^API$/, 0.55), hi(/another/, 0.95)]} subs={['≈ the customer', '≈ the waiter', '≈ the kitchen']} arrows={prog(t, carries - 0.2, 1.4)} packet={{p: packetP, text: 'REQUEST', color: C.request, dir: 1}} />
      <g opacity={prog(t, carries, 0.5)}><rect x={190} y={700} width={700} height={84} rx={42} fill={C.panel} stroke={C.api} strokeWidth={4} /><text x={540} y={755} textAnchor="middle" fontSize={34} fontWeight={800} fill={C.text}>API = the <tspan fill={C.api}>messenger</tspan> in between</text></g>
    </g>
  </g>;
};

const Gear: React.FC<{x: number; y: number; r: number; angle: number; color: string}> = ({x, y, r, angle, color}) => <g transform={`translate(${x} ${y}) rotate(${angle})`}>
  {Array.from({length: 8}, (_, i) => <rect key={i} x={-r * 0.16} y={-r * 1.2} width={r * 0.32} height={r * 0.4} rx={4} fill={color} transform={`rotate(${i * 45})`} />)}
  <circle r={r} fill={color} /><circle r={r * 0.4} fill={C.panel} />
</g>;

const SceneKitchen: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const responseAt = kw(scene, /response/, 0.45);
  const likeAt = kw(scene, /just/, 0.55);
  const foodAt = kw(scene, /food/, 0.95);
  const ticketIn = prog(t, scene.start, 0.9);
  const work = prog(t, scene.speechStart, Math.max(0.5, responseAt - scene.speechStart));
  const ready = pop(ctx, responseAt);
  const gearsOn = 1 - prog(t, responseAt - 0.1, 0.3);
  const bottom = prog(t, likeAt - 0.25, 0.5);
  const plate = pop(ctx, foodAt);
  const stir = Math.sin(t * 6) * 18;
  return <g>
    <Panel x={60} y={0} w={960} h={400}>
      <Pill x={190} y={52} w={180} h={50} fs={24} color={C.server} text="SERVER" />
      <Icon kind="server" x={230} y={230} s={1.7} color={C.server} t={t} />
      <g opacity={1 - prog(t, scene.start + 0.9, 0.2)}><Ticket x={lerp(-80, 230, ticketIn)} y={230} s={0.8} label="REQ" /></g>
      <g opacity={gearsOn}><Gear x={600} y={190} r={52} angle={t * 120} color={C.api} /><Gear x={700} y={250} r={36} angle={-t * 170 + 20} color={C.request} /></g>
      <g transform={`translate(720 215) scale(${ready})`}><rect x={-230} y={-56} width={460} height={112} rx={56} fill={C.response} /><text y={14} textAnchor="middle" fontSize={36} fontWeight={800} fill="#0B1020">Response ready ✓</text></g>
      <text x={430} y={334} fontSize={26} fontWeight={700} fill={C.muted}>{ready > 0.5 ? 'Done' : 'Processing…'}</text>
      <rect x={430} y={350} width={540} height={16} rx={8} fill={C.line} /><rect x={430} y={350} width={540 * work} height={16} rx={8} fill={work >= 1 ? C.response : C.api} />
    </Panel>
    <g opacity={bottom}><line x1={540} y1={404} x2={540} y2={476} stroke={C.muted} strokeWidth={4} strokeDasharray="8 10" /><Pill x={540} y={440} w={230} h={54} fs={24} color={C.panel2} text="JUST LIKE…" dark={false} /></g>
    <g opacity={bottom} transform={`translate(0 ${(1 - bottom) * 40})`}>
      <Panel x={60} y={480} w={960} h={400}>
        <Pill x={200} y={532} w={200} h={50} fs={24} color={C.request} text="KITCHEN" />
        <rect x={130} y={760} width={360} height={100} rx={16} fill="#2E3757" /><circle cx={230} cy={810} r={18} fill={C.server} opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 3))} /><circle cx={390} cy={810} r={18} fill={C.server} opacity={0.5 + 0.5 * Math.abs(Math.cos(t * 3))} />
        <rect x={210} y={680} width={200} height={84} rx={18} fill="#9AA6C8" /><rect x={196} y={666 - Math.abs(Math.sin(t * 7)) * 8} width={228} height={20} rx={10} fill="#C4CCE4" />
        {[0, 1, 2].map((i) => { const ph = (t * 0.7 + i / 3) % 1; return <path key={i} d={`M${260 + i * 50} ${640 - ph * 70} q -14 -20 0 -40 q 14 -20 0 -40`} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={(1 - ph) * 0.5} />; })}
        <Person x={620} y={650} s={0.8} t={t} shirt="#F5F7FF" chef arm={<path d={`M-55 110 Q${-110 + stir} 90 ${-150 + stir} 70`} stroke="#F5F7FF" strokeWidth={26} strokeLinecap="round" fill="none" />} />
        <g transform={`translate(860 760) scale(${plate})`}><Glow x={0} y={0} r={110} color={C.request} /><ellipse rx={100} ry={30} fill="#FFFFFF" /><ellipse rx={70} ry={18} fill="#F3E9D2" /><path d="M-50 -6 q 15 -20 30 0 t 30 0 t 30 0 t 25 -4" fill="none" stroke={C.request} strokeWidth={8} strokeLinecap="round" /><circle cx={-10} cy={-10} r={8} fill={C.server} /><circle cx={20} cy={-8} r={6} fill="#5BC06B" />
          {[0, 1, 2, 3].map((i) => <path key={i} d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#FFE7A8" transform={`translate(${[-90, 80, -40, 100][i]} ${[-70, -80, -110, -30][i]}) scale(${0.6 + 0.4 * Math.abs(Math.sin(t * 4 + i))})`} />)}
        </g>
      </Panel>
    </g>
  </g>;
};

const SceneResponse: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const depart = scene.start + 0.1;
  const arrive = Math.max(depart + 1.8, kw(scene, /application/, 0.3) + 0.3);
  const p = relay(t, depart, arrive - depart);
  const node = (i: number) => prog(t, lerp(depart, arrive, [1, 0.5, 0][i]) - 0.15, 0.3) * (i === 0 ? 1 : 1 - prog(t, arrive + 0.6, 0.5));
  const cardAt = [kw(scene, /weather/, 0.55), kw(scene, /price/, 0.75), kw(scene, /messages/, 0.95)];
  const cards = [
    {color: C.client, title: 'Weather', value: '28°C · Sunny', icon: <g><circle cx={-8} cy={-10} r={24} fill={C.request} /><path d="M-30 26 Q-34 4 -12 4 Q-6 -12 12 -8 Q34 -6 32 14 Q42 18 38 28 Z" fill="#E6ECFF" /></g>},
    {color: C.request, title: 'Product price', value: 'Headphones · ₹1,999', icon: <g><path d="M-28 -30 L10 -30 L34 -6 L-4 32 L-28 8 Z" fill={C.request} /><circle cx={-12} cy={-14} r={7} fill={C.panel} /></g>},
    {color: C.response, title: 'New message', value: '“See you at 7?”', icon: <g><path d="M-34 -26 H34 Q40 -26 40 -20 V14 Q40 20 34 20 H-6 L-24 36 V20 H-34 Q-40 20 -40 14 V-20 Q-40 -26 -34 -26 Z" fill={C.response} /><circle cx={-16} cy={-3} r={5} fill={C.panel} /><circle cx={0} cy={-3} r={5} fill={C.panel} /><circle cx={16} cy={-3} r={5} fill={C.panel} /></g>}
  ];
  return <g>
    <FlowRow ctx={ctx} y={150} size={170} appearAt={scene.start - 0.3} on={[node(0), node(1), node(2)]} arrows={prog(t, depart, 0.8)} arrowDir={-1} packet={{p, text: 'RESPONSE', color: C.response, dir: -1}} />
    <g opacity={prog(t, arrive, 0.4)}><Pill x={190} y={20} w={190} h={46} fs={22} color={C.response} text="RECEIVED" /></g>
    {cards.map((card, i) => { const s = pop(ctx, cardAt[i] - 0.1, 14); const y = 420 + i * 160; return <g key={card.title} opacity={Math.min(1, s * 1.5)} transform={`translate(${(1 - s) * -120} 0)`}>
      <rect x={110} y={y - 64} width={860} height={128} rx={30} fill={C.panel} stroke={card.color} strokeWidth={4} />
      <rect x={110} y={y - 64} width={16} height={128} rx={8} fill={card.color} />
      <g transform={`translate(205 ${y})`}>{card.icon}</g>
      <text x={290} y={y - 10} fontSize={28} fontWeight={700} fill={C.muted}>{card.title}</text>
      <text x={290} y={y + 34} fontSize={40} fontWeight={800} fill={C.text}>{card.value}</text>
    </g>; })}
  </g>;
};

const SceneSummary: React.FC<{ctx: Ctx}> = ({ctx}) => {
  const {t, scene} = ctx;
  const apiAt = kw(scene, /^API$/, 0.25); const reqAt = kw(scene, /requests/, 0.75); const resAt = kw(scene, /responses/, 0.95);
  const api = pop(ctx, apiAt - 0.1); const req = pop(ctx, reqAt - 0.1); const res = pop(ctx, resAt - 0.1);
  const endAt = scene.speechEnd + 0.15;
  const end = pop(ctx, endAt, 12);
  const check = prog(t, endAt + 0.25, 0.5);
  const flow = prog(t, resAt + 0.3, 0.4);
  const ring = (i: number) => { const ph = (t - endAt - i * 0.35); return ph > 0 && ph < 1.6 ? ph / 1.6 : -1; };
  const rand = (n: number) => { const v = Math.sin(n * 99.13) * 10000; return v - Math.floor(v); };
  const confetti = Array.from({length: 30}, (_, i) => { const dt = t - endAt - 0.1; const vx = (rand(i) - 0.5) * 900; const vy = 520 + rand(i + 40) * 520; return {x: 540 + vx * dt, y: 520 - vy * dt + 620 * dt * dt, rot: dt * 360 * (rand(i + 80) - 0.5) * 2, color: [C.request, C.response, C.api, C.client, C.server][i % 5], show: dt > 0 && dt < 2.6}; });
  return <g>
    <g transform="translate(0 0)">
      <Pill x={185} y={170} w={260} h={84} fs={30} color={C.request} text="REQUEST" s={req} />
      <Arrow x1={325} x2={430} y={170} p={prog(t, reqAt, 0.4)} color={C.muted} />
      <g transform={`translate(540 170) scale(${api})`}><Glow x={0} y={0} r={130} color={C.api} /><circle r={92} fill={C.api} /><text y={16} textAnchor="middle" fontSize={44} fontWeight={800} fill={C.text}>API</text></g>
      <Arrow x1={650} x2={755} y={170} p={prog(t, resAt, 0.4)} color={C.muted} />
      <Pill x={895} y={170} w={290} h={84} fs={30} color={C.response} text="RESPONSE" s={res} />
      {flow > 0 ? [0, 1, 2, 3].map((i) => { const u = (t * 0.45 + i / 4) % 1; return <circle key={i} cx={lerp(70, 1010, u)} cy={290} r={10} fill={u < 0.5 ? C.request : C.response} opacity={flow * Math.sin(u * Math.PI)} />; }) : null}
      <text x={540} y={360} textAnchor="middle" fontSize={32} fontWeight={600} fill={C.muted} opacity={flow}>Requests go out. Responses come back.</text>
    </g>
    {[0, 1, 2].map((i) => { const r = ring(i); return r < 0 ? null : <circle key={i} cx={540} cy={520} r={80 + r * 340} fill="none" stroke={[C.api, C.response, C.request][i]} strokeWidth={6} opacity={(1 - r) * 0.7} />; })}
    {confetti.map((c, i) => c.show ? <rect key={i} x={-9} y={-5} width={18} height={10} rx={3} fill={c.color} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`} /> : null)}
    <g transform={`translate(540 520) scale(${end})`}>
      <circle r={78} fill={C.response} />
      <path d="M-32 2 L-8 26 L36 -24" fill="none" stroke="#0B1020" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={110} strokeDashoffset={110 * (1 - check)} />
    </g>
    <g opacity={Math.min(1, end * 1.4)} transform={`translate(540 ${720 + (1 - end) * 40})`}>
      <text textAnchor="middle" fontSize={78} fontWeight={800} fill={C.text}>That's how <tspan fill={C.api}>APIs</tspan> work!</text>
    </g>
  </g>;
};

const SCENES: React.FC<{ctx: Ctx}>[] = [SceneHook, SceneCustomer, SceneWaiter, SceneKitchen, SceneResponse, SceneSummary];
