import {z} from 'zod';

/*
 * Storyboard v2: an optional, structured `visual` per scene that picks an animated template and gives
 * it the data to draw. Every label is shown to the viewer, so it must be short and learner-facing.
 * Parsed separately from the storyboard (see pipeline/visual-plan) so one bad scene can fall back
 * without rejecting the whole storyboard.
 */

const Label = z.string().trim().min(1).max(60);
const Note = z.string().trim().max(80);
/** Optional on every template: what this scene should make the viewer understand (kept in the run record, not drawn). */
const purpose = Note.optional();

export const VisualSchema = z.discriminatedUnion('template', [
  /** Places or stages connected in order (a route, an input → output chain). */
  z.object({template: z.literal('flow'), purpose, nodes: z.array(Label).min(2).max(6), edge_labels: z.array(Note).max(5).optional()}),
  /** Stages that repeat in a loop. */
  z.object({template: z.literal('cycle'), purpose, stages: z.array(Label).min(3).max(6)}),
  /** Two things side by side: contrasted ("vs"), likened ("like"), or simply related. */
  z.object({
    template: z.literal('comparison'),
    purpose,
    left: z.object({title: Label, points: z.array(Label).max(3).default([])}),
    right: z.object({title: Label, points: z.array(Label).max(3).default([])}),
    relation: z.enum(['vs', 'like', 'related']).default('related')
  }),
  /**
   * A body moving around another (the center is what it orbits: Earth for the Moon, the Sun for Earth), optionally
   * lit from one side by `light`. Markers are positions in orbit order, starting from the side facing the light.
   */
  z.object({template: z.literal('orbit'), purpose, center: Label, orbiter: Label, light: Label.optional(), markers: z.array(Label).max(8).default([])}),
  /** Layers listed outermost/top first: stacked bands (atmosphere, network layers) or nested rings (Earth's interior, a cell). */
  z.object({template: z.literal('layers'), purpose, arrangement: z.enum(['stack', 'nested']).default('stack'), layers: z.array(z.object({label: Label, note: Note.optional()})).min(2).max(6)}),
  /** Events in chronological order. `when` only if the narration states it (never invented). */
  z.object({template: z.literal('timeline'), purpose, events: z.array(z.object({when: z.string().trim().min(1).max(20).optional(), label: Label})).min(2).max(6)}),
  /** Numbered steps (M6 layout). */
  z.object({template: z.literal('steps'), purpose, steps: z.array(Label).min(2).max(5)}),
  /** A central idea with connected parts (M6 layout). */
  z.object({template: z.literal('hub'), purpose, center: Label, spokes: z.array(Label).min(1).max(4)}),
  /** Points that tick in one by one (M6 layout). */
  z.object({template: z.literal('checklist'), purpose, items: z.array(Label).min(2).max(4)}),
  /** One emphasised idea with supporting chips (M6 layout). */
  z.object({template: z.literal('focus'), purpose, title: Label, chips: z.array(Label).max(4).default([])})
]);

export type Visual = z.infer<typeof VisualSchema>;
export type TemplateName = Visual['template'];
export const TEMPLATE_NAMES = VisualSchema.options.map((o) => o.shape.template.value) as TemplateName[];
