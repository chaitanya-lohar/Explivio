import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard.js';
import type {VideoProps} from './video.js';
import {sceneFramesFromStarts} from '../pipeline/scene-timing';
import {ConceptVisual, type SceneTiming} from './concept-visual';
import {PALETTES, chooseTheme, isThemeName, tint, type Palette} from './theme';
import {setActivePalette} from './templates/shared';

type Scene = Storyboard['scenes'][number];
const TRANSITION = 16;
/** Animations of the first heading/header start this many frames "before" frame 0, so frame 0 is a finished cover. */
const COVER_SETTLED = -45;
const photosynthesisSteps = [
  {label: 'ENERGY SOURCE', title: 'Sunlight reaches the leaf', detail: 'Light is the energy that powers the reaction.'},
  {label: 'WATER IN', title: 'Water travels from the roots', detail: 'Roots absorb water and the stem carries it upward.'},
  {label: 'CARBON IN', title: 'CO₂ enters through tiny pores', detail: 'Leaf pores exchange gases with the surrounding air.'},
  {label: 'THE REACTION', title: 'Light energy rearranges the inputs', detail: 'Chloroplasts make glucose from water and carbon dioxide.'},
  {label: 'TWO OUTPUTS', title: 'Sugar stays. Oxygen leaves.', detail: 'The plant stores glucose and releases oxygen into the air.'}
];
const rainSteps = [
  {label: '01  /  EVAPORATION', title: 'Sunlight warms surface water', detail: 'Liquid water gains energy and becomes invisible vapor.'},
  {label: '02  /  RISING AIR', title: 'Warm vapor rises and cools', detail: 'As air rises, it expands and its temperature drops.'},
  {label: '03  /  CONDENSATION', title: 'Droplets gather in clouds', detail: 'Vapor condenses around tiny particles in the air.'},
  {label: '04  /  PRECIPITATION', title: 'Growing drops fall as rain', detail: 'Large droplets become heavy enough for gravity to pull them down.'},
  {label: '05  /  COLLECTION', title: 'Water returns to the surface', detail: 'Runoff and rivers carry rain back to lakes and oceans.'}
];

export type Theme = {accent: string; warm: string; image: string; section: string; themed: boolean; steps: {label: string; title: string; detail: string}[]};

/**
 * Hand-made themes exist only for the rain and photosynthesis demos. Any other topic gets no photo and no
 * pre-written step copy: its visuals come from its own storyboard (see ConceptVisual).
 */
export function themeFor(title: string): Theme {
  if (/rain|water cycle/i.test(title)) return {accent: '#a9e7f2', warm: '#f5c77a', image: 'assets/rain-hero.png', section: 'EARTH SCIENCE', themed: true, steps: rainSteps};
  if (/photosynthesis/i.test(title)) return {accent: '#c8e6a2', warm: '#f5cf7a', image: 'assets/photosynthesis-hero.png', section: 'PLANT SCIENCE', themed: true, steps: photosynthesisSteps};
  return {accent: '#a9e7f2', warm: '#f5c77a', image: '', section: 'EXPLAINER', themed: false, steps: []};
}

/** Hand-written step cards belong to the demo scripts only; generated videos get diagrams from their own storyboard. */
export function usesHandwrittenCards(theme: Theme, handwrittenSteps: boolean | undefined): boolean {
  return theme.themed && handwrittenSteps === true;
}

/**
 * The palette for this video: the requested theme, else one chosen from the topic. The photo demos keep the dark
 * look their hand-made overlays were designed for.
 */
export function paletteFor(storyboard: Storyboard, requested: unknown, photoDemo: boolean): Palette {
  if (photoDemo) return PALETTES.midnight;
  if (isThemeName(requested)) return PALETTES[requested];
  return PALETTES[chooseTheme(storyboard.title, storyboard.learning_objective)];
}

export const EditorialVideo: React.FC<VideoProps> = ({storyboard, audioPath, seconds, captionCues, captions = true, musicPath = '', sceneStarts, handwrittenSteps, wordTimes, badge, theme: requestedTheme}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const scenes = storyboard.scenes;
  const theme = themeFor(storyboard.title);
  const photoDemo = usesHandwrittenCards(theme, handwrittenSteps);
  const palette = paletteFor(storyboard, requestedTheme, photoDemo);
  // One palette per render: set before any scene or template draws (see templates/shared.tsx).
  setActivePalette(palette);
  const accent = photoDemo ? theme.accent : palette.primary;
  const timelineFrames = Math.round(seconds * fps);
  // Prefer narration-aligned scene times; older runs (no sceneStarts) fall back to the storyboard's estimates.
  const totalEstimated = scenes.reduce((sum, scene) => sum + scene.estimated_duration_seconds, 0) || scenes.length;
  let cursor = 0;
  const cores = sceneStarts?.length === scenes.length
    ? sceneFramesFromStarts(sceneStarts, seconds, fps)
    : scenes.map((scene) => { const duration = Math.max(1, Math.round((scene.estimated_duration_seconds / totalEstimated) * timelineFrames)); const from = cursor; cursor += duration; return {from, duration}; });
  const aligned = sceneStarts?.length === scenes.length;
  const sequences = scenes.map((scene, index) => {
    const from = Math.max(0, cores[index].from - (index > 0 ? TRANSITION : 0));
    const duration = cores[index].duration + (index > 0 ? TRANSITION : 0) + (index < scenes.length - 1 ? TRANSITION : 0);
    // Mention-timed reveals need both word timings and narration-aligned scene windows.
    const timing: SceneTiming | undefined = aligned && wordTimes?.length ? {words: wordTimes, start: sceneStarts[index], end: sceneStarts[index + 1] ?? seconds, sequenceFrom: from} : undefined;
    return <Sequence key={scene.scene_id} from={from} durationInFrames={duration} premountFor={fps}>
      <EditorialScene scene={scene} index={index} total={scenes.length} duration={duration} topic={storyboard.title} section={theme.section} palette={palette} accent={accent} warm={photoDemo ? theme.warm : palette.warm} image={photoDemo ? theme.image : ''} themed={photoDemo} timing={timing} step={theme.steps[index] || theme.steps[theme.steps.length - 1] || {label: '', title: '', detail: ''}} />
    </Sequence>;
  });
  return <AbsoluteFill style={{background: palette.base, fontFamily: palette.bodyFont}}>
    {photoDemo ? null : <Backdrop palette={palette} />}
    {sequences}
    {photoDemo ? null : <FixedHeader section={theme.section} topic={storyboard.title} accent={accent} color={palette.text} />}
    {photoDemo ? null : <FixedFooter starts={cores.map((c) => c.from)} accent={accent} palette={palette} />}
    <ProgressBar color={accent} track={tint(palette.text, 0.12)} />
    {audioPath ? <Audio src={staticFile(audioPath)} /> : null}
    {musicPath ? <Audio src={staticFile(musicPath)} volume={(f) => {
      // Soft bed: quieter while a caption cue (speech) is active, fading in and out at the ends.
      const time = f / fps; const total = durationInFrames / fps;
      const speaking = captionCues.some((cue) => time > cue.start - 0.25 && time < cue.end + 0.25);
      return (speaking ? 0.055 : 0.13) * Math.min(1, time / 1.2) * Math.min(1, Math.max(0, (total - time) / 1.5));
    }} /> : null}
    {captions ? <Captions scenes={scenes} seconds={seconds} cues={captionCues} words={wordTimes} palette={palette} /> : null}
    {badge ? <div style={{position: 'absolute', top: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <div style={{padding: '8px 18px', borderRadius: 999, background: 'rgba(245,199,122,.16)', border: '2px solid #f5c77a', color: '#f5c77a', fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: 2}}>{badge}</div>
    </div> : null}
  </AbsoluteFill>;
};

/** Continuous moving background behind every scene: two drifting colour blobs and slow floating particles. */
const PARTICLES = Array.from({length: 18}, (_, i) => ({x: (i * 61 + 13) % 100, y: (i * 37 + 29) % 100, size: 4 + ((i * 7) % 6), speed: 0.35 + ((i * 13) % 10) / 20, phase: i * 1.7}));
const Backdrop: React.FC<{palette: Palette}> = ({palette}) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const ax = 28 + Math.sin(t * 0.21) * 14;
  const ay = 24 + Math.cos(t * 0.17) * 10;
  const bx = 72 + Math.cos(t * 0.19) * 14;
  const by = 76 + Math.sin(t * 0.23) * 10;
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <AbsoluteFill style={{background: `radial-gradient(circle at ${ax}% ${ay}%, ${palette.blobA}, transparent 52%), radial-gradient(circle at ${bx}% ${by}%, ${palette.blobB}, transparent 50%)`}} />
    {PARTICLES.map((p, i) => {
      const y = (p.y - t * p.speed * 2 + 200) % 110 - 5;
      const x = p.x + Math.sin(t * 0.6 + p.phase) * 1.5;
      return <div key={i} style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: p.size, height: p.size, borderRadius: p.size, background: palette.particle, opacity: 0.35 + 0.35 * Math.sin(t + p.phase) ** 2}} />;
    })}
  </AbsoluteFill>;
};

/** Thin bar along the top showing how far into the video we are (common in short-form video). */
const ProgressBar: React.FC<{color: string; track: string}> = ({color, track}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: track}}>
    <div style={{width: `${(100 * frame) / Math.max(1, durationInFrames - 1)}%`, height: '100%', background: color, borderRadius: '0 4px 4px 0'}} />
  </div>;
};

const EditorialScene: React.FC<{scene: Scene; index: number; total: number; duration: number; topic: string; section: string; palette: Palette; accent: string; warm: string; image: string; themed: boolean; timing?: SceneTiming; step: {label: string; title: string; detail: string}}> = ({scene, index, total, duration, topic, section, palette, accent, warm, image, themed, timing, step}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  // Springy entrance from alternating sides; the outgoing scene drifts up, grows slightly and fades.
  const enter = isFirst ? 1 : spring({frame, fps, config: {damping: 16, stiffness: 120, mass: 0.8}, durationInFrames: TRANSITION + 6});
  // Neighbouring scenes overlap for 2 × TRANSITION frames. The outgoing one is gone by the middle of that overlap and
  // the incoming heading starts after it, so two headings never show at once.
  const leave = isLast ? 1 : interpolate(frame, [duration - 2 * TRANSITION, duration - TRANSITION], [1, 0], {easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fromSide = index % 2 === 0 ? 1 : -1;
  const frameProgress = interpolate(frame, [0, Math.max(1, duration)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const intro = spring({frame, fps, config: {damping: 22, stiffness: 110, mass: 0.8}});
  const xShift = index % 2 === 0 ? -1.6 : 1.6;
  const opacity = Math.min(1, enter) * leave;
  const sceneTransform = `translateX(${(1 - Math.min(1, enter)) * 90 * fromSide}px) translateY(${(1 - leave) * -18}px) scale(${(0.94 + 0.06 * Math.min(1, enter)) * (1 + (1 - leave) * 0.03)})`;
  // A slow camera push-in on the diagram for the whole scene.
  const camera = 1 + frameProgress * 0.035;
  const calloutDelay = Math.round(fps * 0.2);
  const callout = spring({frame: frame - calloutDelay, fps, config: {damping: 19, stiffness: 120, mass: 0.75}});
  const text = themed ? '#f8f5ec' : palette.text;
  const muted = themed ? 'rgba(248,245,236,.64)' : palette.muted;
  const heading = scene.on_screen_text.replace(/\s*->\s*/g, ' → ');
  const bar = spring({frame: frame - (isFirst ? COVER_SETTLED : TRANSITION + 8), fps, config: {damping: 20, stiffness: 90}});
  return <AbsoluteFill style={{opacity, overflow: 'hidden', color: text, transform: sceneTransform}}>
    {image ? <>
      <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${xShift * frameProgress}%) scale(${1.035 + frameProgress * 0.055})`, filter: 'saturate(0.91) contrast(1.04)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(4,12,19,.74) 0%, rgba(4,12,19,.30) 28%, rgba(4,12,19,.10) 46%, rgba(4,12,19,.50) 70%, rgba(3,9,14,.94) 100%)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(4,11,15,.40), transparent 76%)'}} />
    </> : null}

    {themed ? <Header section={section} topic={topic} accent={accent} color={text} reveal={intro} /> : null}
    <div style={{position: 'absolute', top: 155, left: 78, right: 78}}>
      <div style={{height: 23}} />
      <KineticHeading startFrame={isFirst ? COVER_SETTLED : TRANSITION + 2} text={heading} font={themed ? 'Georgia, serif' : palette.headingFont} color={text} shadow={themed || palette.name === 'midnight' ? '0 3px 32px rgba(0,0,0,.42)' : 'none'} />
      <div style={{width: 120 * Math.min(1, bar), height: 6, marginTop: 26, background: warm, borderRadius: 4}} />
    </div>

    {/* Topics without a hand-made theme: an animated diagram built from this scene's storyboard (no production notes on screen). */}
    {themed ? null : <AbsoluteFill style={{transform: `scale(${camera})`, transformOrigin: '50% 58%'}}><ConceptVisual scene={scene} durationInFrames={duration} timing={timing} /></AbsoluteFill>}
    {themed ? <div style={{position: 'absolute', left: 76, right: 76, bottom: 513, transform: `translateY(${(1 - callout) * 22}px) scale(${0.985 + callout * 0.015})`, opacity: callout}}>
      <div style={{borderRadius: 18, padding: '24px 31px 24px', background: 'rgba(5,13,18,.86)', border: '1px solid rgba(247,245,236,.24)', boxShadow: '0 22px 65px rgba(0,0,0,.32)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14}}>
          <div style={{fontSize: 17, fontWeight: 700, color: accent, letterSpacing: 2.8}}>{step.label}</div>
          <div style={{fontSize: 16, color: 'rgba(248,245,236,.72)', letterSpacing: 2}}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
        </div>
        <div style={{display: 'flex', gap: 8, marginBottom: 20}}>{Array.from({length: total}, (_, i) => <div key={i} style={{height: 3, flex: 1, borderRadius: 4, background: i <= index ? accent : 'rgba(248,245,236,.22)'}} />)}</div>
        {index === 3 && /photosynthesis/i.test(topic) ? <Equation accent={accent} progress={callout} /> : <>
          <div style={{fontFamily: 'Georgia, serif', fontSize: 34, lineHeight: 1.14, color: '#fffdf7'}}>{step.title}</div>
          <div style={{fontSize: 22, lineHeight: 1.35, color: 'rgba(248,245,236,.82)', marginTop: 9}}>{step.detail}</div>
        </>}
      </div>
      <div style={{fontSize: 20, lineHeight: 1.35, color: 'rgba(248,245,236,.84)', marginTop: 18, textShadow: '0 2px 15px rgba(0,0,0,.7)', maxWidth: 850}}>{scene.visual_description}</div>
    </div> : null}

    {themed ? <Footer label="A SHORT SCIENCE FILM" index={index} total={total} accent={accent} color={muted} dot="rgba(248,245,236,.35)" /> : null}
  </AbsoluteFill>;
};

/** Brand, section and topic along the top. */
const Header: React.FC<{section: string; topic: string; accent: string; color: string; reveal: number}> = ({section, topic, accent, color, reveal}) => <>
  <div style={{position: 'absolute', top: 84, left: 76, right: 76, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: reveal}}>
    <div style={{fontSize: 22, fontWeight: 800, letterSpacing: 5, color}}>EXPLIVIO</div>
    <div style={{fontSize: 19, letterSpacing: 2.5, color: accent, fontWeight: 800}}>{section.toUpperCase()}</div>
  </div>
  <div style={{position: 'absolute', top: 155, left: 78, right: 78, fontSize: 19, color: accent, letterSpacing: 3.4, fontWeight: 800, textTransform: 'uppercase', opacity: reveal, transform: `translateY(${(1 - reveal) * 16}px)`}}>{topic}</div>
</>;

/** The header for generated videos: drawn once above all scenes, so it stays still while scenes change. */
const FixedHeader: React.FC<{section: string; topic: string; accent: string; color: string}> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <Header {...props} reveal={spring({frame: frame - COVER_SETTLED, fps, config: {damping: 22, stiffness: 110, mass: 0.8}})} />;
};

/** Footer: label and one dot per scene, the current one long. */
const Footer: React.FC<{label: string; index: number; total: number; accent: string; color: string; dot: string}> = ({label, index, total, accent, color, dot}) => <div style={{position: 'absolute', left: 76, right: 76, bottom: 124, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
  <div style={{fontSize: 16, letterSpacing: 2.8, color}}>{label}</div>
  <div style={{display: 'flex', gap: 8}}>{Array.from({length: total}, (_, i) => <div key={i} style={{width: i === index ? 26 : 6, height: 6, borderRadius: 8, background: i === index ? accent : dot}} />)}</div>
</div>;

/** The footer for generated videos, drawn once; the current scene is the last one whose window has started. */
const FixedFooter: React.FC<{starts: number[]; accent: string; palette: Palette}> = ({starts, accent, palette}) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, starts.reduce((last, from, i) => (frame >= from ? i : last), 0));
  return <Footer label="A SHORT EXPLAINER" index={index} total={starts.length} accent={accent} color={palette.muted} dot={tint(palette.text, 0.35)} />;
};

/** The scene heading, word by word: each word springs up into place a moment after the previous one. */
const KineticHeading: React.FC<{startFrame: number; text: string; font: string; color: string; shadow: string}> = ({startFrame, text, font, color, shadow}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return <div style={{fontFamily: font, fontSize: text.length > 48 ? 58 : 72, lineHeight: 1.08, fontWeight: 800, marginTop: 22, maxWidth: 920, color, textShadow: shadow, display: 'flex', flexWrap: 'wrap', columnGap: '0.26em'}}>
    {words.map((word, i) => {
      const s = spring({frame: frame - startFrame - i * 3, fps, config: {damping: 14, stiffness: 150, mass: 0.6}});
      return <span key={i} style={{display: 'inline-block', opacity: Math.min(1, s), transform: `translateY(${(1 - s) * 34}px)`}}>{word}</span>;
    })}
  </div>;
};

const Equation: React.FC<{accent: string; progress: number}> = ({accent, progress}) => <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: progress}}>
  {[['6 CO₂', 'rgba(119,195,213,.20)'], ['+', 'transparent'], ['6 H₂O', 'rgba(119,195,213,.20)'], ['+', 'transparent'], ['LIGHT', 'rgba(242,197,111,.20)'], ['→', 'transparent'], ['C₆H₁₂O₆', 'rgba(176,212,140,.24)'], ['+', 'transparent'], ['6 O₂', 'rgba(176,212,140,.24)']].map(([label, fill], i) => <div key={i} style={{padding: label === '+' || label === '→' ? '4px 0' : '10px 13px', borderRadius: 8, background: fill, color: label === 'LIGHT' ? '#f5d18b' : label === '+' || label === '→' ? accent : '#fffdf7', fontSize: label === '→' ? 31 : 23, fontWeight: 700, letterSpacing: 0.7, lineHeight: 1}}>{label}</div>)}
</div>;

/** Which caption text is on screen now, and when it started (frame). */
function currentCue(frame: number, fps: number, scenes: Scene[], seconds: number, cues: VideoProps['captionCues']): {text: string; start: number; end: number} {
  if (cues.length) {
    const time = frame / fps;
    const cue = cues.find((item) => time >= item.start && time < item.end);
    return cue ? {text: cue.text, start: cue.start, end: cue.end} : {text: '', start: 0, end: 0};
  }
  const total = scenes.reduce((sum, scene) => sum + scene.estimated_duration_seconds, 0) || scenes.length;
  let cursor = 0;
  let sceneStart = 0;
  const scene = scenes.find((item) => { const length = item.estimated_duration_seconds / total * seconds * fps; const active = frame >= cursor && frame < cursor + length; if (active) sceneStart = cursor; cursor += length; return active; });
  const words = (scene?.caption_text || scene?.narration_text || '').trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '));
  const length = scene ? scene.estimated_duration_seconds / total * seconds * fps : 1;
  const chunk = Math.min(chunks.length - 1, Math.floor((frame - sceneStart) / length * chunks.length));
  const start = (sceneStart + (chunk / Math.max(1, chunks.length)) * length) / fps;
  return {text: chunks[chunk] || '', start, end: start + length / Math.max(1, chunks.length) / fps};
}

/**
 * Bold captions; with word timings the word being spoken lights up (karaoke style). Without timings (older runs)
 * the cue simply appears.
 */
const Captions: React.FC<{scenes: Scene[]; seconds: number; cues: VideoProps['captionCues']; words?: VideoProps['wordTimes']; palette: Palette}> = ({scenes, seconds, cues, words, palette}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cue = currentCue(frame, fps, scenes, seconds, cues);
  const time = frame / fps;
  const reveal = cue.text ? spring({frame: frame - Math.round(cue.start * fps), fps, config: {damping: 16, stiffness: 180, mass: 0.6}}) : 0;
  const tokens = cue.text.split(/\s+/).filter(Boolean);
  // Spoken words inside this cue's window, in order: the i-th one started → the i-th caption word is active.
  const spoken = words?.length ? words.filter((w) => w.start >= cue.start - 0.05 && w.start < cue.end + 0.05) : [];
  const activeIndex = spoken.length ? Math.min(tokens.length - 1, spoken.filter((w) => w.start <= time).length - 1) : -1;
  return <div style={{position: 'absolute', left: 60, right: 60, bottom: 236, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: Math.min(1, reveal), transform: `translateY(${(1 - Math.min(1, reveal)) * 14}px) scale(${0.96 + 0.04 * reveal})`}}>
    {cue.text ? <div style={{maxWidth: 940, padding: '18px 30px 20px', borderRadius: 24, background: palette.captionBg, boxShadow: '0 12px 34px rgba(0,0,0,.28)', color: palette.captionText, fontFamily: palette.bodyFont, fontWeight: 800, fontSize: 44, lineHeight: 1.22, textAlign: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.28em'}}>
      {tokens.map((token, i) => <span key={i} style={{display: 'inline-block', color: i === activeIndex ? palette.captionActive : palette.captionText, transform: `scale(${i === activeIndex ? 1.08 : 1})`}}>{token}</span>)}
    </div> : null}
  </div>;
};
