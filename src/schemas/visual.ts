import {z} from 'zod';

/*
 * Storyboard v2: an optional, structured `visual` per scene that picks an animated template and gives
 * it the data to draw. Every label is shown to the viewer, so it must be short and learner-facing.
 * Parsed separately from the storyboard (see pipeline/visual-plan) so one bad scene can fall back
 * without rejecting the whole storyboard.
 */

const Label = z.string().trim().min(1).max(60);
const Note = z.string().trim().max(80);

export const VisualSchema = z.discriminatedUnion('template', [
  /** Places or stages connected in order (a route, an input → output chain). */
  z.object({template: z.literal('flow'), nodes: z.array(Label).min(2).max(6), edge_labels: z.array(Note).max(5).optional()}),
  /** Stages that repeat in a loop. */
  z.object({template: z.literal('cycle'), stages: z.array(Label).min(3).max(6)}),
  /** Two things side by side: contrasted ("vs"), likened ("like"), or simply related. */
  z.object({
    template: z.literal('comparison'),
    left: z.object({title: Label, points: z.array(Label).max(3).default([])}),
    right: z.object({title: Label, points: z.array(Label).max(3).default([])}),
    relation: z.enum(['vs', 'like', 'related']).default('related')
  }),
  /** A body moving around another, optionally lit by a light source, with labelled positions. */
  z.object({template: z.literal('orbit'), center: Label, orbiter: Label, light: Label.optional(), markers: z.array(Label).max(8).default([])}),
  /** Stacked bands, listed top to bottom. */
  z.object({template: z.literal('layers'), layers: z.array(z.object({label: Label, note: Note.optional()})).min(2).max(6)}),
  /** Dated or ordered events on a time axis. */
  z.object({template: z.literal('timeline'), events: z.array(z.object({when: z.string().trim().min(1).max(20), label: Label})).min(2).max(6)}),
  /** Numbered steps (M6 layout). */
  z.object({template: z.literal('steps'), steps: z.array(Label).min(2).max(5)}),
  /** A central idea with connected parts (M6 layout). */
  z.object({template: z.literal('hub'), center: Label, spokes: z.array(Label).min(1).max(4)}),
  /** Points that tick in one by one (M6 layout). */
  z.object({template: z.literal('checklist'), items: z.array(Label).min(2).max(4)}),
  /** One emphasised idea with supporting chips (M6 layout). */
  z.object({template: z.literal('focus'), title: Label, chips: z.array(Label).max(4).default([])})
]);

export type Visual = z.infer<typeof VisualSchema>;
export type TemplateName = Visual['template'];
export const TEMPLATE_NAMES = VisualSchema.options.map((o) => o.shape.template.value) as TemplateName[];
