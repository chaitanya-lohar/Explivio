import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard.js';

export type VideoProps = {storyboard: Storyboard; audioPath: string; seconds: number; captionCues: {start: number; end: number; text: string}[]; captions?: boolean; musicPath?: string; /** Narration-aligned scene start times (s); absent in older runs. */ sceneStarts?: number[]; /** True only for the built-in demo scripts, whose themes include hand-written step cards. */ handwrittenSteps?: boolean; /** Spoken word timings (s), so diagram items appear as they are mentioned; absent in older runs. */ wordTimes?: {text: string; start: number; end: number}[]; /** Shown on every frame, e.g. "SILENT EVALUATION · estimated timing" for review renders. */ badge?: string; /** Visual theme (midnight, clean, vibrant, paper); absent = chosen from the topic. */ theme?: string; /** One photo per scene (path under public/, or null); absent in older runs. */ images?: (string | null)[]; /** Shown in the footer when photos are used, e.g. "Pixabay". */ imageCredit?: string};

const SceneCard: React.FC<{storyboard: Storyboard; title: string; body: string; index: number}> = ({storyboard, title, body, index}) => {
  const frame = useCurrentFrame();
  const reveal = Math.min(1, frame / 15);
  const lesson = storyboard.title.toLowerCase();
  const visual = lesson.includes('photosynthesis') ? <PhotosynthesisDiagram step={index} /> : lesson.includes('rain') || lesson.includes('water cycle') ? <WaterCycleDiagram step={index} /> : <ConceptDiagram scene={storyboard.scenes[index]} index={index} />;
  return <AbsoluteFill style={{background: 'radial-gradient(ellipse at 72% 34%, #143d59 0%, #071a2f 58%, #04101d 100%)', color: '#f5fbff', fontFamily: 'Arial, sans-serif', padding: '95px 76px 140px', opacity: reveal}}>
    <div style={{fontSize: 23, color: '#70e4e7', letterSpacing: 5, fontWeight: 700}}>EXPLIVIO  /  SHORT SCIENCE</div>
    <div style={{fontSize: 64, fontWeight: 800, lineHeight: 1.06, marginTop: 28, maxWidth: 920}}>{title}</div>
    <div style={{fontSize: 29, color: '#bfdbeb', lineHeight: 1.28, marginTop: 18, minHeight: 74}}>{body}</div>
    <div style={{marginTop: 8, height: 505, borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(18,52,76,.88), rgba(6,23,39,.92))', border: '1px solid rgba(118,211,225,.26)', boxShadow: '0 30px 90px rgba(0,0,0,.26)'}}>{visual}</div>
    <div style={{position: 'absolute', bottom: 123, left: 76, fontSize: 22, color: '#85aabe', letterSpacing: 2}}>ONE IDEA AT A TIME</div>
  </AbsoluteFill>;
};

const PhotosynthesisDiagram: React.FC<{step: number}> = ({step}) => {
  const frame = useCurrentFrame();
  const offset = (frame * 2) % 72;
  const op = (i: number) => step === i ? 1 : 0.82;
  return <svg width="100%" height="100%" viewBox="0 0 900 505" role="img" aria-label="Animated photosynthesis diagram">
    <defs>
      <linearGradient id="leafFill" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#9ce85b"/><stop offset="1" stopColor="#1a9b78"/></linearGradient>
      <linearGradient id="sunFill" x1="0" x2="1"><stop stopColor="#fff1a1"/><stop offset="1" stopColor="#ffad43"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="119" cy="92" r="66" fill="#ffd95e" opacity=".12" filter="url(#glow)"/>
    <g transform={`rotate(${frame * 0.35},119,92)`} opacity={op(0)}>
      {Array.from({length: 12}, (_, i) => <line key={i} x1="119" y1="14" x2="119" y2="-1" transform={`rotate(${i * 30},119,92)`} stroke="#ffd95e" strokeWidth="7" strokeLinecap="round"/>)}
      <circle cx="119" cy="92" r="43" fill="url(#sunFill)"/>
    </g>
    <text x="65" y="190" fill="#ffe9a7" fontSize="20" fontWeight="700">SUNLIGHT</text>
    <path d="M174 126 C260 115 290 170 354 208" fill="none" stroke="#ffd95e" strokeWidth="5" strokeDasharray="12 10" strokeDashoffset={-offset} opacity={op(0)} />
    <path d="M515 270 C625 238 676 188 746 172" fill="none" stroke="#75e2df" strokeWidth="4" strokeDasharray="9 10" strokeDashoffset={offset} opacity={op(4)} />
    <path d="M505 300 C620 326 674 344 751 346" fill="none" stroke="#8ce978" strokeWidth="4" strokeDasharray="9 10" strokeDashoffset={-offset} opacity={op(4)} />
    <g opacity={op(2)}>
      <circle cx={215 + (frame % 90) * 1.6} cy={258 + Math.sin(frame / 9) * 14} r="15" fill="#9ad8ff" opacity=".94"/><circle cx={263 + (frame % 90) * 1.1} cy={300 + Math.cos(frame / 12) * 9} r="10" fill="#9ad8ff" opacity=".78"/>
      <text x="66" y="267" fill="#bde9ff" fontSize="20" fontWeight="700">CO2</text>
    </g>
    <g opacity={op(1)}><path d="M448 357 C443 400 421 425 398 461 M450 357 C466 400 488 429 512 461 M448 360 C448 405 450 433 450 477" fill="none" stroke="#c98e59" strokeWidth="12" strokeLinecap="round"/><path d="M446 356 C446 288 446 234 448 185" fill="none" stroke="#72cb61" strokeWidth="16" strokeLinecap="round"/><path d="M448 294 C364 286 342 227 358 176 C419 174 451 217 448 294Z" fill="url(#leafFill)" stroke="#b6f48b" strokeWidth="3"/><path d="M450 267 C505 194 568 203 594 238 C575 296 518 318 450 294Z" fill="url(#leafFill)" stroke="#b6f48b" strokeWidth="3"/><path d="M376 188 Q415 226 444 280 M575 242 Q526 255 464 286" fill="none" stroke="#e3ffb0" strokeWidth="3" opacity=".8"/><text x="368" y="119" fill="#d7ffc0" fontSize="21" fontWeight="700">LEAF</text></g>
    <g opacity={op(1)}><path d="M356 431 C390 414 407 398 428 368" fill="none" stroke="#64c9ff" strokeWidth="5" strokeDasharray="9 9" strokeDashoffset={offset}/><text x="298" y="467" fill="#bde9ff" fontSize="18" fontWeight="700">WATER FROM ROOTS</text></g>
    <g opacity={op(3)}><rect x="635" y="219" width="218" height="78" rx="24" fill="#153d4d" stroke="#64d9d4" strokeWidth="2"/><text x="744" y="267" textAnchor="middle" fill="#a7f1e4" fontSize="23" fontWeight="700">SUGAR  C6H12O6</text><rect x="665" y="324" width="154" height="66" rx="22" fill="#203d39" stroke="#8ce978" strokeWidth="2"/><text x="742" y="365" textAnchor="middle" fill="#c4ff9d" fontSize="25" fontWeight="700">OXYGEN O2</text><circle cx={618 + (frame % 100)} cy={344 - Math.sin(frame / 8) * 10} r="8" fill="#c6ffe6"/><circle cx={635 + (frame % 100)} cy={357 + Math.sin(frame / 8) * 10} r="6" fill="#c6ffe6"/></g>
    <text x="450" y="496" textAnchor="middle" fill="#87acb9" fontSize="17" letterSpacing="2">LIGHT + WATER + CO2  →  SUGAR + O2</text>
  </svg>;
};

const WaterCycleDiagram: React.FC<{step: number}> = ({step}) => {
  const frame = useCurrentFrame();
  const phase = (frame % 100) / 100;
  const active = (i: number) => step === i ? 1 : .82;
  return <svg width="100%" height="100%" viewBox="0 0 900 505" role="img" aria-label="Animated water cycle diagram">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#173d5a"/><stop offset="1" stopColor="#0a263e"/></linearGradient><linearGradient id="sea" x1="0" x2="0" y2="1"><stop stopColor="#50c6dd"/><stop offset="1" stopColor="#126589"/></linearGradient><filter id="sunGlow"><feGaussianBlur stdDeviation="15"/></filter></defs>
    <rect width="900" height="505" fill="url(#sky)"/>
    <circle cx="146" cy="100" r="62" fill="#ffd86a" opacity=".13" filter="url(#sunGlow)"/><circle cx="146" cy="100" r="39" fill="#ffd66b"/><text x="103" y="160" fill="#ffedb2" fontSize="17" fontWeight="700">SUN HEAT</text>
    <path d="M0 376 Q90 352 180 376 T360 376 T540 376 T720 376 T900 376 V505 H0Z" fill="url(#sea)"/>
    <path d={`M0 ${391 + Math.sin(frame / 8) * 5} Q90 ${370 + Math.sin(frame / 8) * 5} 180 ${391 + Math.sin(frame / 8) * 5} T360 ${391 + Math.sin(frame / 8) * 5} T540 ${391 + Math.sin(frame / 8) * 5} T720 ${391 + Math.sin(frame / 8) * 5} T900 ${391 + Math.sin(frame / 8) * 5}`} fill="none" stroke="#9ef0f3" strokeWidth="5" opacity=".8"/>
    <text x="405" y="466" fill="#d0f7ff" fontSize="20" fontWeight="700">OCEAN / LAKES</text>
    <g opacity={active(0)}><path d="M245 355 C260 305 278 256 302 218" fill="none" stroke="#65dbef" strokeWidth="4" strokeDasharray="10 12"/><path d="M287 227 l15 -14 9 19" fill="none" stroke="#65dbef" strokeWidth="4"/><text x="183" y="300" fill="#b5f6ff" fontSize="18" fontWeight="700">EVAPORATION</text>{[0,1,2,3].map(i => <circle key={i} cx={262 + i * 28} cy={350 - ((phase * 160 + i * 43) % 170)} r={6 + (i % 2) * 2} fill="#9cecff" opacity=".85"/>)}</g>
    <g opacity={active(1)}><path d="M338 162 C370 112 450 107 492 151" fill="none" stroke="#a8e4f4" strokeWidth="4" strokeDasharray="9 10"/><path d="M477 135 l16 16 -22 3" fill="none" stroke="#a8e4f4" strokeWidth="4"/></g>
    <g><ellipse cx="535" cy="171" rx="122" ry="62" fill="#e5f6fb"/><circle cx="465" cy="151" r="55" fill="#edfaff"/><circle cx="575" cy="143" r="66" fill="#eaf8fd"/><circle cx="620" cy="174" r="47" fill="#eaf8fd"/><text x="474" y="183" fill="#39718a" fontSize="19" fontWeight="700">CLOUD</text></g>
    <g opacity={active(2)}><text x="604" y="251" fill="#b5f6ff" fontSize="17" fontWeight="700">CONDENSATION</text><path d="M596 211 L650 242" fill="none" stroke="#95e7f1" strokeWidth="3" strokeDasharray="6 8"/></g>
    <g opacity={active(3)}>{[0,1,2,3,4,5,6].map(i => { const x = 442 + i * 30; const y = 238 + ((frame * 5 + i * 37) % 125); return <path key={i} d={`M${x} ${y} C${x - 8} ${y + 12} ${x - 6} ${y + 20} ${x} ${y + 22} C${x + 7} ${y + 19} ${x + 7} ${y + 12} ${x} ${y}Z`} fill="#79e1f3" opacity=".9"/>;})}<text x="641" y="306" fill="#b5f6ff" fontSize="17" fontWeight="700">PRECIPITATION</text></g>
    <path d="M729 249 C805 292 804 348 737 374" fill="none" stroke="#7edff0" strokeWidth="4" strokeDasharray="9 10"/><path d="M742 360 l-11 16 21 -1" fill="none" stroke="#7edff0" strokeWidth="4"/><text x="721" y="422" fill="#b5f6ff" fontSize="17" fontWeight="700">COLLECTION</text>
  </svg>;
};

const ConceptDiagram: React.FC<{scene: Storyboard['scenes'][number]; index: number}> = ({scene, index}) => {
  const frame = useCurrentFrame();
  const items = scene?.key_elements || [];
  return <svg width="100%" height="100%" viewBox="0 0 900 505" role="img" aria-label="Animated concept diagram">
    <defs><radialGradient id="conceptGlow"><stop stopColor="#4ad4d3" stopOpacity=".35"/><stop offset="1" stopColor="#14324b" stopOpacity="0"/></radialGradient></defs><ellipse cx="450" cy="252" rx="400" ry="230" fill="url(#conceptGlow)"/>
    {items.slice(0, 4).map((item, i) => { const x = 450 + Math.cos((i / Math.max(1, items.length)) * Math.PI * 2 + frame / 85) * 245; const y = 250 + Math.sin((i / Math.max(1, items.length)) * Math.PI * 2 + frame / 85) * 145; return <g key={`${i}-${item}`}><line x1="450" y1="250" x2={x} y2={y} stroke="#4bbbc9" strokeWidth="3" strokeDasharray="8 10"/><circle cx={x} cy={y} r="62" fill="#16475c" stroke="#63d9dc" strokeWidth="3"/><text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="17" fontWeight="700">{item.slice(0, 18)}</text></g>;})}
    <circle cx="450" cy="250" r="82" fill="#9be973" opacity=".9"/><text x="450" y="258" textAnchor="middle" fill="#082838" fontSize="22" fontWeight="800">STEP {index + 1}</text>
  </svg>;
};

export const ExplainerVideo: React.FC<VideoProps> = ({storyboard, audioPath, seconds, captionCues}) => {
  const {fps} = useVideoConfig();
  const scenes = storyboard.scenes;
  const total = scenes.reduce((sum, scene) => sum + scene.estimated_duration_seconds, 0) || scenes.length;
  let cursor = 0;
  const sequences = scenes.map((scene, index) => {
    const duration = Math.max(1, Math.round((scene.estimated_duration_seconds / total) * seconds * fps));
    const from = cursor; cursor += duration;
    return <Sequence key={scene.scene_id} from={from} durationInFrames={duration}><SceneCard storyboard={storyboard} title={scene.on_screen_text} body={scene.visual_description} index={index} /></Sequence>;
  });
  return <AbsoluteFill style={{backgroundColor: '#061321'}}>{sequences}{audioPath ? <Audio src={staticFile(audioPath)} /> : null}<Captions scenes={scenes} seconds={seconds} cues={captionCues} /></AbsoluteFill>;
};

const Captions: React.FC<{scenes: Storyboard['scenes']; seconds: number; cues: VideoProps['captionCues']}> = ({scenes, seconds, cues}) => {
  const {fps} = useVideoConfig(); const frame = useCurrentFrame();
  if (cues.length > 0) {
    const time = frame / fps;
    const cue = cues.find((item) => time >= item.start && time <= item.end);
    return <CaptionText text={cue?.text || ''} />;
  }
  const total = scenes.reduce((s, v) => s + v.estimated_duration_seconds, 0) || scenes.length;
  let cursor = 0; let sceneStart = 0;
  const active = scenes.find((scene) => { const duration = (scene.estimated_duration_seconds / total) * seconds * fps; const yes = frame >= cursor && frame < cursor + duration; if (yes) sceneStart = cursor; cursor += duration; return yes; });
  const words = (active?.caption_text || active?.narration_text || '').trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 5) chunks.push(words.slice(i, i + 5).join(' '));
  const sceneFrames = active ? (active.estimated_duration_seconds / total) * seconds * fps : 1;
  const chunkIndex = Math.min(chunks.length - 1, Math.floor(((frame - sceneStart) / sceneFrames) * chunks.length));
  return <CaptionText text={chunks[chunkIndex] || ''} />;
};

const CaptionText: React.FC<{text: string}> = ({text}) => <div style={{position: 'absolute', bottom: 273, left: 64, right: 64, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: 'white', fontWeight: 700, fontSize: 34, lineHeight: 1.28, textShadow: '0 2px 12px #000', backgroundColor: text ? 'rgba(3,13,23,.9)' : 'transparent', border: text ? '1px solid rgba(112,228,231,.75)' : 'none', padding: '19px 24px', borderRadius: 20, minHeight: 50}}>{text}</div>;
