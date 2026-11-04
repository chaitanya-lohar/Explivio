import type {Storyboard} from '../schemas/storyboard';
import type {Visual} from '../schemas/visual';
import {keywords, stem} from './mention-timing';
import {bodyKind} from './orbit-geometry';
import {resolveVisual, revealLabels} from './visual-plan';

/*
 * Checks that each scene's visual plan matches what its narration actually explains. These are consistency checks,
 * not keyword-based template picking: Gemini chooses the template from the educational relationship; this catches
 * plans that contradict their own narration (an "orbit" for a road trip, the Sun at the centre of the Moon's orbit,
 * a "cycle" that never repeats, invented or out-of-order dates). Pure functions, no I/O.
 */

export type SceneVisualReport = {
  scene_id: number;
  template: Visual['template'];
  source: 'template' | 'fallback';
  purpose?: string;
  /** Labels in the order they animate in (the animation sequence). */
  sequence: string[];
  /** Whether each label is spoken in the scene's narration (its narration timing reference). */
  mentioned: boolean[];
  problems: string[];
};

const ORBIT_MOTION = /\b(orbit\w*|revolv\w*|circl\w*|around)\b/i;
const REPEATS = /\b(again|repeat\w*|cycle\w*|loop\w*|over and over|continu\w*|back (?:to|into)|return\w*|restart\w*|round and round|endless\w*|never.?ending)\b/i;
const MIN_MENTIONED = 0.5;

function spokenStems(text: string): Set<string> {
  return new Set(text.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3).map(stem));
}

/** True when any meaningful word of the label is spoken. */
export function isMentioned(labelText: string, spoken: Set<string>): boolean {
  const words = keywords(labelText);
  return words.length === 0 || words.some((w) => spoken.has(w));
}

/**
 * Year for a timeline `when`, for ordering checks: "1969" → 1969, "1990s" → 1990, "300 BC"/"BCE" → -300,
 * "c. 1450" → 1450, "18th century" → 1750. Null when it isn't a recognisable date (then it isn't order-checked).
 */
export function parseYear(when: string): number | null {
  const text = when.toLowerCase();
  const century = text.match(/(\d{1,2})(?:st|nd|rd|th)\s+century/);
  if (century) return (Number(century[1]) - 1) * 100 + 50;
  const year = text.match(/(\d{1,4})\s*s?\b/);
  if (!year) return null;
  const n = Number(year[1]);
  return /\b(bc|bce)\b/.test(text) ? -n : n;
}

/** Problems with one scene's visual (empty when the plan fits the narration). */
export function sceneVisualProblems(visual: Visual, narration: string): string[] {
  const problems: string[] = [];
  const spoken = spokenStems(narration);
  const {labels} = revealLabels(visual);
  const mentioned = labels.map((l) => isMentioned(l, spoken));
  if (labels.length && mentioned.filter(Boolean).length / labels.length < MIN_MENTIONED) {
    problems.push(`most labels are never said in this scene's narration (${labels.filter((_, i) => !mentioned[i]).slice(0, 3).map((l) => `"${l}"`).join(', ')}); use the words the narration uses`);
  }
  switch (visual.template) {
    case 'orbit': {
      if (!ORBIT_MOTION.test(narration)) problems.push('"orbit" is for one body moving around another, but the narration describes no such motion; use flow for routes or sequences');
      const center = bodyKind(visual.center);
      const orbiter = bodyKind(visual.orbiter);
      if (stem(visual.center) === stem(visual.orbiter)) problems.push('orbit center and orbiter are the same body');
      if (orbiter === 'moon' && center === 'star') problems.push(`the Moon orbits Earth, not the Sun: put "Earth" as the center (sunlight can be the "light")`);
      if ((orbiter === 'earth' || orbiter === 'planet') && (center === 'moon' || center === 'earth')) problems.push(`planets orbit the Sun: "${visual.orbiter}" cannot orbit "${visual.center}"`);
      break;
    }
    case 'cycle':
      if (!REPEATS.test(narration)) problems.push('"cycle" is for stages that repeat, but the narration never says it repeats; use flow or steps for a one-way sequence, timeline for history');
      break;
    case 'timeline': {
      const years = visual.events.map((e) => (e.when ? parseYear(e.when) : null));
      const dated = years.filter((y): y is number => y !== null);
      if (dated.some((y, i) => i > 0 && y < dated[i - 1])) problems.push('timeline events are not in chronological order');
      const lower = narration.toLowerCase();
      const unstated = visual.events.filter((e) => e.when && /\d/.test(e.when) && !lower.includes(e.when.toLowerCase().replace(/^c\.\s*/, '')));
      if (unstated.length) problems.push(`dates not stated in the narration (${unstated.map((e) => `"${e.when}"`).join(', ')}): only show dates the narration says, otherwise leave "when" out`);
      break;
    }
    case 'comparison':
      if (!isMentioned(visual.left.title, spoken) || !isMentioned(visual.right.title, spoken)) problems.push('both sides of a comparison must be named in the narration');
      break;
    default:
      break;
  }
  return problems;
}

/** Per-scene report plus storyboard-level problems (e.g. one template everywhere). */
export function lintVisualPlan(storyboard: Storyboard): {scenes: SceneVisualReport[]; problems: string[]} {
  const scenes = storyboard.scenes.map((scene): SceneVisualReport => {
    const resolved = resolveVisual(scene);
    const narration = `${scene.narration_text} ${scene.on_screen_text}`;
    const {labels} = revealLabels(resolved.visual);
    const spoken = spokenStems(narration);
    const problems = resolved.source === 'template' ? sceneVisualProblems(resolved.visual, narration) : [resolved.problem === 'no visual' ? 'missing "visual"' : `invalid "visual": ${resolved.problem}`];
    return {scene_id: scene.scene_id, template: resolved.visual.template, source: resolved.source, purpose: resolved.visual.purpose, sequence: labels, mentioned: labels.map((l) => isMentioned(l, spoken)), problems};
  });
  const problems: string[] = [];
  const counts = new Map<string, number>();
  for (const s of scenes) if (s.source === 'template') counts.set(s.template, (counts.get(s.template) ?? 0) + 1);
  for (const [template, count] of counts) {
    if (scenes.length >= 4 && count / scenes.length > 0.6) problems.push(`"${template}" is used for ${count} of ${scenes.length} scenes; pick the template that fits each scene's relationship`);
  }
  return {scenes, problems};
}

/** Repair message for the model, or null when the plan is fine. */
export function visualRepairNote(report: {scenes: SceneVisualReport[]; problems: string[]}): string | null {
  const lines = [
    ...report.scenes.filter((s) => s.problems.length).map((s) => `scene ${s.scene_id} (${s.template}): ${s.problems.join('; ')}`),
    ...report.problems
  ];
  return lines.length ? `Fix these "visual" problems: ${lines.join(' | ')}.` : null;
}

/** After the one repair: scenes whose plan still has problems drop their visual, so they render the M6 fallback layout. */
export function dropFlaggedVisuals(storyboard: Storyboard, report: {scenes: SceneVisualReport[]}): Storyboard {
  const flagged = new Set(report.scenes.filter((s) => s.source === 'template' && s.problems.length).map((s) => s.scene_id));
  if (!flagged.size) return storyboard;
  return {...storyboard, scenes: storyboard.scenes.map((scene) => (flagged.has(scene.scene_id) ? {...scene, visual: undefined} : scene))};
}
