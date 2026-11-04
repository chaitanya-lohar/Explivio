import {z} from 'zod';

export const SceneSchema = z.object({
  scene_id: z.number().int().positive(),
  narration_text: z.string().min(1),
  on_screen_text: z.string().min(1).max(100),
  // Only picks the fallback layout when a scene has no usable `visual`; an unknown value (models sometimes put a
  // template name here) becomes "diagram" instead of rejecting the whole storyboard (M7 silent runs S2, S3).
  visual_type: z.enum(['title', 'diagram', 'process', 'analogy', 'illustration', 'example', 'summary']).catch('diagram'),
  visual_description: z.string().min(1),
  key_elements: z.array(z.string()).default([]),
  estimated_duration_seconds: z.number().positive(),
  caption_text: z.string().optional(),
  // Storyboard v2 (optional): template + data, validated separately in pipeline/visual-plan so a bad scene falls back.
  visual: z.unknown().optional()
});

export const StoryboardSchema = z.object({
  title: z.string().min(1),
  target_audience: z.string().min(1),
  learning_objective: z.string().min(1),
  scenes: z.array(SceneSchema).min(3).max(12)
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoryboardScene = z.infer<typeof SceneSchema>;
