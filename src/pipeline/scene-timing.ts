/** Timing of one spoken word, in seconds (from ElevenLabs character alignment). */
export type WordTime = {text: string; start: number; end: number};
export type SceneFrames = {from: number; duration: number};

/**
 * Start time (seconds) of each scene, taken from when its first word is actually spoken.
 * The narration is the scenes' texts joined in order, so word i of the audio belongs to the scene
 * whose cumulative word count covers i. The first scene always starts at 0.
 * Returns null if the word timings don't line up with the scene texts (then callers fall back to estimates).
 */
export function sceneStartsFromWords(sceneTexts: readonly string[], words: readonly WordTime[]): number[] | null {
  const counts = sceneTexts.map((text) => text.split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return null;
  const starts: number[] = [];
  let index = 0;
  for (const count of counts) {
    starts.push(starts.length === 0 ? 0 : (words[index]?.start ?? 0));
    index += count;
  }
  return starts;
}

/**
 * Frame ranges for scenes from their start times. Ranges are ordered, contiguous and cover the whole video
 * (integration contract: "scene ranges must be ordered and cover the intended video without unintended gaps").
 */
export function sceneFramesFromStarts(starts: readonly number[], totalSeconds: number, fps: number): SceneFrames[] {
  const totalFrames = Math.round(totalSeconds * fps);
  const fromFrames = starts.map((s) => Math.min(totalFrames - 1, Math.max(0, Math.round(s * fps))));
  fromFrames[0] = 0;
  return fromFrames.map((from, i) => {
    const next = i + 1 < fromFrames.length ? Math.max(from + 1, fromFrames[i + 1]) : totalFrames;
    return {from, duration: Math.max(1, next - from)};
  });
}

export type CaptionCue = {start: number; end: number; text: string};

/**
 * Splits caption cues that straddle a scene change, so a caption never shows the end of one scene and the start of
 * the next under the wrong diagram (M7 known issue K5). Uses the word timings: each word goes to the scene its start
 * falls in; a cue covering words from two scenes becomes two cues. Cues with no matching words are kept as they are.
 */
export function splitCuesAtScenes(cues: readonly CaptionCue[], words: readonly WordTime[], sceneStarts: readonly number[] | undefined): CaptionCue[] {
  const boundaries = (sceneStarts ?? []).slice(1);
  if (!boundaries.length || !words.length) return [...cues];
  const sceneOf = (t: number) => boundaries.filter((b) => t >= b - 1e-6).length;
  const out: CaptionCue[] = [];
  for (const cue of cues) {
    const inside = words.filter((w) => w.start >= cue.start - 0.02 && w.start <= cue.end + 0.02);
    const scenes = new Set(inside.map((w) => sceneOf(w.start)));
    if (scenes.size <= 1) { out.push({...cue}); continue; }
    let group: WordTime[] = [];
    const flush = () => { if (group.length) out.push({start: group[0].start, end: group[group.length - 1].end, text: group.map((w) => w.text).join(' ')}); group = []; };
    for (const w of inside) {
      if (group.length && sceneOf(w.start) !== sceneOf(group[0].start)) flush();
      group.push(w);
    }
    flush();
  }
  return out;
}
