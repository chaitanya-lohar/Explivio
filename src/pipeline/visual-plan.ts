// Files reachable from the renderer use extensionless imports (Remotion's bundler doesn't map .js to .ts).
import {VisualSchema, type Visual} from '../schemas/visual';

/** The fields of a storyboard scene that visual planning reads (v1 fields plus the optional v2 `visual`). */
export type VisualInput = {visual_type: string; key_elements: string[]; on_screen_text: string; visual?: unknown};
export type ResolvedVisual = {visual: Visual; source: 'template' | 'fallback'; problem?: string};

/** Short, readable label: drops list numbering the model sometimes adds ("1.", "Step 1:") and trims long text. */
export function label(text: string, max = 34): string {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/^(?:step\s*)?\(?\d+[.):]\s+/i, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** M6 layout choice from visual_type and element count; used when a scene has no valid v2 `visual`. */
export function layoutFor(scene: Pick<VisualInput, 'visual_type' | 'key_elements'>): 'process' | 'hub' | 'compare' | 'checklist' | 'focus' {
  const n = scene.key_elements.length;
  switch (scene.visual_type) {
    case 'process': return n >= 2 ? 'process' : 'focus';
    case 'diagram':
    case 'illustration': return n >= 2 ? 'hub' : 'focus';
    case 'analogy': return n >= 2 ? 'compare' : 'focus';
    case 'example':
    case 'summary': return n >= 2 ? 'checklist' : 'focus';
    default: return 'focus';
  }
}

/** Deterministic visual from v1 fields (the M6 behaviour), expressed in the v2 format. */
export function fallbackVisual(scene: VisualInput): Visual {
  const items = scene.key_elements.map((t) => label(t)).filter(Boolean).slice(0, 4);
  switch (layoutFor(scene)) {
    case 'process': return {template: 'steps', steps: items};
    case 'hub': return {template: 'hub', center: items[0], spokes: items.slice(1)};
    case 'compare': return {template: 'comparison', left: {title: items[0], points: []}, right: {title: items[1], points: items.slice(2, 3)}, relation: 'related'};
    case 'checklist': return {template: 'checklist', items};
    default: return {template: 'focus', title: label(scene.on_screen_text.replace(/\s*->\s*/g, ' → '), 40), chips: items};
  }
}

/** Uses the scene's v2 `visual` when it is valid, otherwise the fallback (and says why). Never throws. */
export function resolveVisual(scene: VisualInput): ResolvedVisual {
  if (scene.visual === undefined || scene.visual === null) return {visual: fallbackVisual(scene), source: 'fallback', problem: 'no visual'};
  const parsed = VisualSchema.safeParse(scene.visual);
  if (parsed.success) return {visual: parsed.data, source: 'template'};
  const issue = parsed.error.issues[0];
  return {visual: fallbackVisual(scene), source: 'fallback', problem: `${issue?.path.join('.') || 'visual'}: ${issue?.message ?? 'invalid'}`};
}
