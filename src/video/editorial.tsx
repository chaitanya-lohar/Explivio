import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard.js';
import type {VideoProps} from './video.js';
import {sceneFramesFromStarts} from '../pipeline/scene-timing';
import {ConceptVisual} from './concept-visual';

type Scene = Storyboard['scenes'][number];
const TRANSITION = 16;
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

export const EditorialVideo: React.FC<VideoProps> = ({storyboard, audioPath, seconds, captionCues, captions = true, musicPath = '', sceneStarts, handwrittenSteps}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const scenes = storyboard.scenes;
  const theme = themeFor(storyboard.title);
  const timelineFrames = Math.round(seconds * fps);
  // Prefer narration-aligned scene times; older runs (no sceneStarts) fall back to the storyboard's estimates.
  const totalEstimated = scenes.reduce((sum, scene) => sum + scene.estimated_duration_seconds, 0) || scenes.length;
  let cursor = 0;
  const cores = sceneStarts?.length === scenes.length
    ? sceneFramesFromStarts(sceneStarts, seconds, fps)
    : scenes.map((scene) => { const duration = Math.max(1, Math.round((scene.estimated_duration_seconds / totalEstimated) * timelineFrames)); const from = cursor; cursor += duration; return {from, duration}; });
  const sequences = scenes.map((scene, index) => {
    const from = Math.max(0, cores[index].from - (index > 0 ? TRANSITION : 0));
    const duration = cores[index].duration + (index > 0 ? TRANSITION : 0) + (index < scenes.length - 1 ? TRANSITION : 0);
    return <Sequence key={scene.scene_id} from={from} durationInFrames={duration} premountFor={fps}>
      <EditorialScene scene={scene} index={index} total={scenes.length} duration={duration} topic={storyboard.title} section={theme.section} accent={theme.accent} warm={theme.warm} image={theme.image} themed={usesHandwrittenCards(theme, handwrittenSteps)} step={theme.steps[index] || theme.steps[theme.steps.length - 1] || {label: '', title: '', detail: ''}} />
    </Sequence>;
  });
  return <AbsoluteFill style={{backgroundColor: '#071017'}}>
    {sequences}
    {audioPath ? <Audio src={staticFile(audioPath)} /> : null}
    {musicPath ? <Audio src={staticFile(musicPath)} volume={(f) => {
      // Soft bed: quieter while a caption cue (speech) is active, fading in and out at the ends.
      const time = f / fps; const total = durationInFrames / fps;
      const speaking = captionCues.some((cue) => time > cue.start - 0.25 && time < cue.end + 0.25);
      return (speaking ? 0.055 : 0.13) * Math.min(1, time / 1.2) * Math.min(1, Math.max(0, (total - time) / 1.5));
    }} /> : null}
    {captions ? <EditorialCaptions scenes={scenes} seconds={seconds} cues={captionCues} accent={theme.accent} /> : null}
  </AbsoluteFill>;
};

const EditorialScene: React.FC<{scene: Scene; index: number; total: number; duration: number; topic: string; section: string; accent: string; warm: string; image: string; themed: boolean; step: {label: string; title: string; detail: string}}> = ({scene, index, total, duration, topic, section, accent, warm, image, themed, step}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const enter = isFirst ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const leave = isLast ? 1 : interpolate(frame, [duration - TRANSITION, duration], [1, 0], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const frameProgress = interpolate(frame, [0, Math.max(1, duration)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const intro = spring({frame, fps, config: {damping: 22, stiffness: 110, mass: 0.8}});
  const scale = 1.035 + frameProgress * 0.055;
  const xShift = index % 2 === 0 ? -1.6 : 1.6;
  const opacity = enter * leave;
  const calloutDelay = Math.round(fps * 0.2);
  const callout = spring({frame: frame - calloutDelay, fps, config: {damping: 19, stiffness: 120, mass: 0.75}});
  return <AbsoluteFill style={{opacity, overflow: 'hidden', color: '#f8f5ec', fontFamily: 'Arial, sans-serif'}}>
    {image
      ? <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${xShift * frameProgress}%) scale(${scale})`, filter: 'saturate(0.91) contrast(1.04)'}} />
      : <AbsoluteFill style={{background: `radial-gradient(circle at ${30 + xShift * 10 * frameProgress}% 28%, rgba(139,124,255,.28), transparent 55%), radial-gradient(circle at 75% 78%, rgba(77,214,200,.18), transparent 50%), linear-gradient(180deg, #121527 0%, #0b0f1c 100%)`}} />}
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(4,12,19,.74) 0%, rgba(4,12,19,.30) 28%, rgba(4,12,19,.10) 46%, rgba(4,12,19,.50) 70%, rgba(3,9,14,.94) 100%)'}} />
    <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(4,11,15,.40), transparent 76%)'}} />

    <div style={{position: 'absolute', top: 84, left: 76, right: 76, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: intro}}>
      <div style={{fontSize: 22, fontWeight: 700, letterSpacing: 5, color: '#faf7ef'}}>EXPLIVIO</div>
      <div style={{fontSize: 19, letterSpacing: 2.5, color: accent, fontWeight: 700}}>{section.toUpperCase()}</div>
    </div>
    <div style={{position: 'absolute', top: 155, left: 78, right: 78, opacity: intro, transform: `translateY(${(1 - intro) * 22}px)`}}>
      <div style={{fontSize: 19, color: accent, letterSpacing: 3.4, fontWeight: 700, textTransform: 'uppercase'}}>{topic}</div>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 72, lineHeight: 1.05, fontWeight: 700, marginTop: 22, maxWidth: 920, textWrap: 'balance', textShadow: '0 3px 32px rgba(0,0,0,.42)'}}>{scene.on_screen_text.replace(/s*->s*/g, ' → ')}</div>
      <div style={{width: 72, height: 4, marginTop: 26, background: warm, borderRadius: 4}} />
    </div>

    {/* Topics without a hand-made theme: an animated diagram built from this scene's storyboard (no production notes on screen). */}
    {themed ? null : <ConceptVisual scene={scene} durationInFrames={duration} />}
    {themed ? <div style={{position: 'absolute', left: 76, right: 76, bottom: 513, transform: `translateY(${(1 - callout) * 22}px) scale(${0.985 + callout * 0.015})`, opacity: callout}}>
      <div style={{borderRadius: 18, padding: '24px 31px 24px', background: 'rgba(5,13,18,.76)', border: '1px solid rgba(247,245,236,.24)', boxShadow: '0 22px 65px rgba(0,0,0,.32)', backdropFilter: 'blur(18px)'}}>
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

    <div style={{position: 'absolute', left: 76, right: 76, bottom: 124, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{fontSize: 16, letterSpacing: 2.8, color: 'rgba(248,245,236,.64)'}}>{themed ? 'A SHORT SCIENCE FILM' : 'A SHORT EXPLAINER'}</div>
      <div style={{display: 'flex', gap: 8}}>{Array.from({length: total}, (_, i) => <div key={i} style={{width: i === index ? 26 : 6, height: 6, borderRadius: 8, background: i === index ? accent : 'rgba(248,245,236,.48)'}} />)}</div>
    </div>
  </AbsoluteFill>;
};

const Equation: React.FC<{accent: string; progress: number}> = ({accent, progress}) => <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: progress}}>
  {[['6 CO₂', 'rgba(119,195,213,.20)'], ['+', 'transparent'], ['6 H₂O', 'rgba(119,195,213,.20)'], ['+', 'transparent'], ['LIGHT', 'rgba(242,197,111,.20)'], ['→', 'transparent'], ['C₆H₁₂O₆', 'rgba(176,212,140,.24)'], ['+', 'transparent'], ['6 O₂', 'rgba(176,212,140,.24)']].map(([label, fill], i) => <div key={i} style={{padding: label === '+' || label === '→' ? '4px 0' : '10px 13px', borderRadius: 8, background: fill, color: label === 'LIGHT' ? '#f5d18b' : label === '+' || label === '→' ? accent : '#fffdf7', fontSize: label === '→' ? 31 : 23, fontWeight: 700, letterSpacing: 0.7, lineHeight: 1}}>{label}</div>)}
</div>;

const EditorialCaptions: React.FC<{scenes: Scene[]; seconds: number; cues: VideoProps['captionCues']; accent: string}> = ({scenes, seconds, cues, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let text = '';
  let cueStart = 0;
  if (cues.length) {
    const time = frame / fps;
    const cue = cues.find((item) => time >= item.start && time < item.end);
    if (cue) { text = cue.text; cueStart = cue.start * fps; }
  } else {
    const total = scenes.reduce((sum, scene) => sum + scene.estimated_duration_seconds, 0) || scenes.length;
    let cursor = 0;
    let sceneStart = 0;
    const scene = scenes.find((item) => { const length = item.estimated_duration_seconds / total * seconds * fps; const active = frame >= cursor && frame < cursor + length; if (active) sceneStart = cursor; cursor += length; return active; });
    const words = (scene?.caption_text || scene?.narration_text || '').trim().split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '));
    const length = scene ? scene.estimated_duration_seconds / total * seconds * fps : 1;
    const chunk = Math.min(chunks.length - 1, Math.floor((frame - sceneStart) / length * chunks.length));
    text = chunks[chunk] || '';
    cueStart = sceneStart + (chunk / Math.max(1, chunks.length)) * length;
  }
  const elapsed = frame - cueStart;
  const reveal = text ? interpolate(elapsed, [0, 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}) : 0;
  return <div style={{position: 'absolute', left: 70, right: 70, bottom: 247, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: reveal, transform: `translateY(${(1 - reveal) * 7}px)`}}>
    {text ? <div style={{maxWidth: 930, minWidth: 610, padding: '20px 30px 21px 34px', background: 'rgba(4,10,14,.86)', borderLeft: `4px solid ${accent}`, boxShadow: '0 10px 34px rgba(0,0,0,.35)', color: '#fffdf7', fontFamily: 'Arial, sans-serif', fontWeight: 600, fontSize: 37, lineHeight: 1.24, letterSpacing: 0.1, textAlign: 'left', backdropFilter: 'blur(12px)'}}>{text}</div> : null}
  </div>;
};
