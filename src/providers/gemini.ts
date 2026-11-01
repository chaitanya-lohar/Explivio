import {GoogleGenAI} from '@google/genai';
import {StoryboardSchema, type Storyboard} from '../schemas/storyboard.js';

const INSTRUCTIONS = `Create a concise, accurate educational video storyboard for a beginner. Return only JSON matching this shape: {"title":string,"target_audience":string,"learning_objective":string,"scenes":[{"scene_id":number,"narration_text":string,"on_screen_text":string,"visual_type":"title|diagram|process|analogy|illustration|example|summary","visual_description":string,"key_elements":string[],"estimated_duration_seconds":number,"caption_text":string?}]}. Use 3-8 scenes, speak naturally, keep on-screen text short, ensure scene durations add up near the target duration, and flag uncertainty instead of inventing facts.`;

export async function createStoryboard(prompt: string, seconds: 30 | 60 | 90): Promise<{storyboard: Storyboard; model: string; attempts: number}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your Google AI Studio key.');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  let activeModel = model;
  let fallbackAttempted = false;
  const client = new GoogleGenAI({apiKey, httpOptions: {timeout: 30_000, retryOptions: {attempts: 1}}});
  const input = `${INSTRUCTIONS}\n\nTopic: ${prompt}\nTarget video duration: ${seconds} seconds.`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.interactions.create({model: activeModel, input: attempt === 1 ? input : `${input}\nYour previous output failed validation: ${String(lastError)}. Correct the JSON and return only the fixed object.`});
      const raw = response.output_text?.trim();
      if (!raw) throw new Error('Gemini returned an empty response.');
      if (raw.length > 100_000) throw new Error('Gemini response exceeded the 100 KB storyboard limit.');
      const json = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      return {storyboard: StoryboardSchema.parse(json), model: activeModel, attempts: attempt};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Overloaded, rate-limited or hanging models all get one switch to the fallback model.
      if (!fallbackAttempted && /(503.*high demand|429.*(?:limit|quota|rate)|timed out|timeout)/i.test(message)) {
        const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash';
        if (fallbackModel !== activeModel) {
          activeModel = fallbackModel;
          fallbackAttempted = true;
          attempt -= 1;
          continue;
        }
      }
      if (/APIError|fetch failed|timed out/i.test(message)) throw new Error(`Gemini request failed before a usable response was received: ${message}`);
      lastError = error;
    }
  }
  throw new Error(`Gemini storyboard failed validation after one repair attempt: ${String(lastError)}`);
}
