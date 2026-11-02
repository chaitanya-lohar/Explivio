import {GoogleGenAI} from '@google/genai';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {StoryboardSchema, type Storyboard} from '../schemas/storyboard.js';
import {budgetInstruction, budgetProblem, narrationWords, wordBudget} from '../pipeline/word-budget.js';
import {VISUAL_GUIDE} from '../pipeline/visual-guide.js';
import {dropFlaggedVisuals, lintVisualPlan, visualRepairNote, type SceneVisualReport} from '../pipeline/visual-lint.js';

const INSTRUCTIONS = `Create a concise, accurate educational video storyboard for a beginner. Return only JSON matching this shape: {"title":string,"target_audience":string,"learning_objective":string,"scenes":[{"scene_id":number,"narration_text":string,"on_screen_text":string,"visual_type":"title|diagram|process|analogy|illustration|example|summary","visual_description":string,"key_elements":string[],"estimated_duration_seconds":number,"caption_text":string?,"visual":object}]}. Use 3-8 scenes, speak naturally, keep on-screen text short, ensure scene durations add up near the target duration, and flag uncertainty instead of inventing facts. key_elements are shown to the viewer as labels in an animated diagram: give 2-4 short learner-facing concept labels (max 5 words each, e.g. "Axis tilted 23.5°", "Direct sunlight = summer"), never descriptions of graphics or production notes. For process scenes list the steps in order.

${VISUAL_GUIDE}`;

/** One request to Gemini, as recorded in the run manifest (no prompt text, no keys). */
export type GeminiCall = {model: string; ms: number; outcome: 'ok' | 'timeout' | 'overloaded' | 'invalid_output' | 'error'; note?: string};
export type StoryboardResult = {storyboard: Storyboard; model: string; attempts: number; calls: GeminiCall[]; skippedModel?: string; wordBudget: {target: number; min: number; max: number; actual: number; withinBudget: boolean}; visualPlan: {scenes: SceneVisualReport[]; problems: string[]; templateScenes: number; fallbackScenes: number}};

// Storyboards for 60–90 s videos took up to ~30 s in M6 testing, so 30 s was too tight (run A4).
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45_000;
const SKIP_MINUTES = Number(process.env.GEMINI_SKIP_FAILED_MODEL_MINUTES) || 30;
const MAX_CALLS = 3; // primary/fallback + one repair: bounded, never open-ended
const HEALTH_FILE = path.resolve('runs', '.gemini-health.json');

type Health = Record<string, {failedAt: string; reason: string}>;

function readHealth(): Health {
  try { return JSON.parse(readFileSync(HEALTH_FILE, 'utf8')) as Health; } catch { return {}; }
}

/** True when the model failed (timeout/overload) recently enough that waiting on it again is pointless. */
export function isRecentlyUnhealthy(health: Health, model: string, now = Date.now(), skipMinutes = SKIP_MINUTES): boolean {
  const record = health[model];
  return Boolean(record && now - Date.parse(record.failedAt) < skipMinutes * 60_000);
}

function markHealth(model: string, failed: boolean, reason = ''): void {
  const health = readHealth();
  if (failed) health[model] = {failedAt: new Date().toISOString(), reason};
  else delete health[model];
  try { mkdirSync(path.dirname(HEALTH_FILE), {recursive: true}); writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2)); } catch { /* health tracking is best-effort */ }
}

/** Classifies an error without keeping its full text (which can echo request details). */
export function classify(message: string, error?: unknown): GeminiCall['outcome'] {
  // Schema (Zod) and JSON parse failures are the model's output being wrong: repairable, whatever their message format.
  if (error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError')) return 'invalid_output';
  if (/timed out|timeout|aborted due to timeout/i.test(message)) return 'timeout';
  if (/503|high demand|overloaded|429|quota|rate.?limit/i.test(message)) return 'overloaded';
  if (/JSON|Unexpected token|ZodError|invalid_type|invalid_value|invalid option|validation|empty response|exceeded/i.test(message)) return 'invalid_output';
  return 'error';
}

/**
 * After a timeout or overload: switch to the fallback once; otherwise retry the same model once
 * (a single slow response shouldn't fail the video); otherwise give up. Always bounded by callsLeft.
 */
export function afterTransientFailure(state: {model: string; fallback: string; switched: boolean; retriedModels: ReadonlySet<string>; callsLeft: number}): {action: 'switch'; model: string} | {action: 'retry'} | {action: 'fail'} {
  if (state.callsLeft <= 0) return {action: 'fail'};
  if (!state.switched && state.fallback !== state.model) return {action: 'switch', model: state.fallback};
  if (!state.retriedModels.has(state.model)) return {action: 'retry'};
  return {action: 'fail'};
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms} ms`)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function createStoryboard(prompt: string, seconds: 30 | 60 | 90): Promise<StoryboardResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your Google AI Studio key.');
  const primary = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash';
  const client = new GoogleGenAI({apiKey, httpOptions: {timeout: TIMEOUT_MS, retryOptions: {attempts: 1}}});
  const input = `${INSTRUCTIONS}\n${budgetInstruction(seconds)}\n\nTopic: ${prompt}\nTarget video duration: ${seconds} seconds.`;

  // Skip a model that hung or was overloaded in the last few minutes instead of waiting on it again.
  const skippedModel = primary !== fallback && isRecentlyUnhealthy(readHealth(), primary) ? primary : undefined;
  let model = skippedModel ? fallback : primary;
  let switched = Boolean(skippedModel);
  const retriedModels = new Set<string>();
  const calls: GeminiCall[] = [];
  let repairNote: string | null = null;

  while (calls.length < MAX_CALLS) {
    const started = Date.now();
    try {
      const response = await withTimeout(client.interactions.create({model, input: repairNote ? `${input}\nYour previous output failed validation: ${repairNote}. Correct the JSON and return only the fixed object.` : input}), TIMEOUT_MS);
      const raw = response.output_text?.trim();
      if (!raw) throw new Error('Gemini returned an empty response.');
      if (raw.length > 100_000) throw new Error('Gemini response exceeded the 100 KB storyboard limit.');
      const storyboard = StoryboardSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
      markHealth(model, false);
      // Narration length decides video length; the visual plan must fit what each scene says. Everything found goes
      // into ONE repair request; whatever is still wrong after it is accepted with warnings (never an open loop).
      const problem = budgetProblem(storyboard, seconds);
      const budget = {...wordBudget(seconds), actual: narrationWords(storyboard), withinBudget: !problem};
      const visualReport = lintVisualPlan(storyboard);
      const visualProblem = visualRepairNote(visualReport);
      if ((problem || visualProblem) && !repairNote && calls.length + 1 < MAX_CALLS) {
        calls.push({model, ms: Date.now() - started, outcome: 'invalid_output', note: [problem ? `word budget: ${budget.actual} words (target ${budget.target})` : '', visualProblem ? `visual plan: ${visualReport.scenes.filter((x) => x.problems.length).length} scene(s)` : ''].filter(Boolean).join('; ')});
        repairNote = `${[problem, visualProblem].filter(Boolean).join(' ')} Return the complete corrected JSON.`;
        continue;
      }
      calls.push({model, ms: Date.now() - started, outcome: 'ok', note: [problem ? `accepted outside word budget: ${budget.actual} words` : '', visualProblem ? 'visual problems left after repair: those scenes use the fallback layout' : ''].filter(Boolean).join('; ') || undefined});
      // Scenes whose plan is still wrong render the M6 fallback; the record keeps why.
      const accepted = dropFlaggedVisuals(storyboard, visualReport);
      const scenes = lintVisualPlan(accepted).scenes.map((scene, i) => ({...scene, problems: visualReport.scenes[i].problems}));
      const templateScenes = scenes.filter((x) => x.source === 'template').length;
      return {storyboard: accepted, model, attempts: calls.length, calls, skippedModel, wordBudget: budget, visualPlan: {scenes, problems: visualReport.problems, templateScenes, fallbackScenes: scenes.length - templateScenes}};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const outcome = classify(message, error);
      calls.push({model, ms: Date.now() - started, outcome, note: outcome === 'invalid_output' ? message.slice(0, 160) : undefined});
      if (outcome === 'timeout' || outcome === 'overloaded') {
        markHealth(model, true, outcome);
        const next = afterTransientFailure({model, fallback, switched, retriedModels, callsLeft: MAX_CALLS - calls.length});
        if (next.action === 'switch') { model = next.model; switched = true; continue; }
        if (next.action === 'retry') { retriedModels.add(model); continue; }
        throw new Error(`Gemini request failed before a usable response was received (${outcome} on ${model}).`);
      }
      if (outcome === 'invalid_output') { repairNote = message.slice(0, 500); continue; }
      throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
    }
  }
  throw new Error(`Gemini storyboard failed validation after ${MAX_CALLS} attempts.`);
}
