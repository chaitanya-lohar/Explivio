/**
 * Template guide added to the storyboard prompt (storyboard v2). Gemini picks each scene's template from the
 * educational relationship the scene explains, and fills the template's data. Shapes match schemas/visual.ts.
 */
export const VISUAL_GUIDE = `Every scene must also have a "visual" object: the animated diagram for that scene. Choose its "template" from the relationship the scene explains, not from single words:
- "flow": a one-way sequence through places or stages (a route, inputs becoming outputs). {"template":"flow","nodes":[2-6 labels in order],"edge_labels":[optional short notes between nodes]}
- "cycle": stages that repeat in a loop; only when the narration says it repeats. {"template":"cycle","stages":[3-6 labels]}
- "orbit": one body moving around another in space. "center" is the body being orbited (Earth for the Moon; the Sun for Earth and planets). "light" only when illumination matters (e.g. "Sunlight" for Moon phases). "markers": named positions in orbit order, starting from the side facing the light. {"template":"orbit","center":"Earth","orbiter":"Moon","light":"Sunlight","markers":["New moon","First quarter","Full moon","Last quarter"]}
- "layers": parts stacked or nested (atmosphere, Earth's interior, network layers, parts of a cell), listed outer/top first. "arrangement": "stack" for bands, "nested" for rings. {"template":"layers","arrangement":"nested","layers":[{"label":"Crust","note":"optional short note"}]}
- "timeline": events in chronological order. Give "when" only if this scene's narration states that date; never invent dates. {"template":"timeline","events":[{"when":"1969","label":"First message sent"},{"label":"Undated later event"}]}
- "comparison": two things contrasted ("vs"), likened ("like") or connected ("related"). {"template":"comparison","relation":"vs","left":{"title":"Prime","points":["Exactly two factors"]},"right":{"title":"Composite","points":["More than two factors"]}}
- "steps": instructions to follow in order. {"template":"steps","steps":[2-5 labels]}
- "hub": one concept and its parts or causes. {"template":"hub","center":"label","spokes":[1-4 labels]}
- "checklist": the key points of a summary. {"template":"checklist","items":[2-4 labels]}
- "focus": an opening question or a single idea. {"template":"focus","title":"short title","chips":[0-4 labels]}
Rules: every label is learner-facing, at most 5 words, and uses words the scene's narration actually says (each label appears on screen when it is spoken). Add "purpose" to each visual: one short sentence on what the scene should make the viewer understand. Use different templates where scenes explain different relationships.`;
