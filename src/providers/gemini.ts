import {GoogleGenAI} from '@google/genai';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {StoryboardSchema, type Storyboard} from '../schemas/storyboard.js';
import {narrationWords, wordBudget} from '../pipeline/word-budget.js';
import {checkScript, lengthInstruction, scriptProblems, type ScriptChecks} from '../pipeline/script-checks.js';
import {VISUAL_GUIDE} from '../pipeline/visual-guide.js';
import {dropFlaggedVisuals, lintVisualPlan, visualRepairNote, type SceneVisualReport} from '../pipeline/visual-lint.js';

const INSTRUCTIONS = `Create a concise, accurate educational video storyboard for a beginner. Return only JSON matching this shape: {"title":string,"target_audience":string,"learning_objective":string,"scenes":[{"scene_id":number,"narration_text":string,"on_screen_text":string,"visual_type":"title|diagram|process|analogy|illustration|example|summary","visual_description":string,"key_elements":string[],"estimated_duration_seconds":number,"caption_text":string?,"image_query":string,"visual":object}]}. Use 3-8 scenes, speak naturally, keep on-screen text short, ensure scene durations add up near the target duration, and flag uncertainty instead of inventing facts. key_elements are shown to the viewer as labels in an animated diagram: give 2-4 short learner-facing concept labels (max 5 words each, e.g. "Axis tilted 23.5°", "Direct sunlight = summer"), never descriptions of graphics or production notes. For process scenes list the steps in order. image_query: 2-4 plain English words naming a real photo that fits the scene, something a stock-photo site would have (e.g. "storm clouds over sea", "server room", "ancient roman ruins"): concrete scenery or objects, no text, no diagrams, no named people, nothing abstract. Scene 1 must open with a concrete question or a specific surprising fact about the topic: no greeting, no "in this video", no "today we will", no "let's dive in". The final scene gives one clear takeaway that names the topic and what to remember: no new facts, no sign-off or call to action.

${VISUAL_GUIDE}`;

/** One request to Gemini, as recorded in the run manifest (no prompt text, no keys). */
export type GeminiCall = {model: string; ms: number; outcome: 'ok' | 'timeout' | 'overloaded' | 'invalid_output' | 'error'; note?: string};
export type StoryboardResult = {storyboard: Storyboard; model: string; attempts: number; calls: GeminiCall[]; skippedModel?: string; wordBudget: {target: number; min: number; max: number; actual: number; withinBudget: boolean}; scriptChecks: ScriptChecks; visualPlan: {scenes: SceneVisualReport[]; problems: string[]; templateScenes: number; fallbackScenes: number}};

// Storyboards for 60–90 s videos took up to ~30 s in M6 testing (30 s was too tight, run A4); in F14 testing Gemini often
// needed 30–50 s, so 45 s timed out repeatedly. 90 s per call (at most 3 calls).
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90_000;
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

/** The script was valid JSON but unusable (e.g. off-topic) even after the one repair. */
export class ScriptRejectedError extends Error {
  constructor(message: string) { super(message); this.name = 'ScriptRejectedError'; }
}

export async function createStoryboard(prompt: string, seconds: 30 | 60 | 90): Promise<StoryboardResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your Google AI Studio key.');
  const primary = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash';
  const client = new GoogleGenAI({apiKey, httpOptions: {timeout: TIMEOUT_MS, retryOptions: {attempts: 1}}});
  const input = `${INSTRUCTIONS}\n${lengthInstruction(seconds)}\n\nTopic: ${prompt}\nTarget video duration: ${seconds} seconds.`;

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
      const scriptChecks = checkScript(storyboard, prompt, seconds);
      const problem = scriptProblems(scriptChecks, storyboard, seconds).join(' ') || null;
      // Word count kept in the record for comparison with M6 runs; length is now judged by estimated speech time.
      const words = wordBudget(seconds);
      const spokenWords = narrationWords(storyboard);
      const budget = {...words, actual: spokenWords, withinBudget: spokenWords >= words.min && spokenWords <= words.max};
      const visualReport = lintVisualPlan(storyboard);
      const visualProblem = visualRepairNote(visualReport);
      if ((problem || visualProblem) && !repairNote && calls.length + 1 < MAX_CALLS) {
        calls.push({model, ms: Date.now() - started, outcome: 'invalid_output', note: [problem ? `script checks: ${[!scriptChecks.length.pass && 'length', scriptChecks.hook && 'hook', scriptChecks.ending && 'ending', scriptChecks.relevance && 'relevance', scriptChecks.consistency && 'structure'].filter(Boolean).join(', ')}` : '', visualProblem ? `visual plan: ${visualReport.scenes.filter((x) => x.problems.length).length} scene(s)` : ''].filter(Boolean).join('; ')});
        repairNote = `${[problem, visualProblem].filter(Boolean).join(' ')} Return the complete corrected JSON.`;
        continue;
      }
      // An off-topic script is not worth rendering; other leftovers are accepted and recorded as warnings.
      if (scriptChecks.relevance) {
        calls.push({model, ms: Date.now() - started, outcome: 'invalid_output', note: 'off-topic after repair'});
        throw new ScriptRejectedError('The generated script did not stay on the requested topic, even after one correction. Try rephrasing the prompt.');
      }
      calls.push({model, ms: Date.now() - started, outcome: 'ok', note: [problem ? `accepted with script warnings: ${problem.slice(0, 200)}` : '', visualProblem ? 'visual problems left after repair: those scenes use the fallback layout' : ''].filter(Boolean).join('; ') || undefined});
      // Scenes whose plan is still wrong render the M6 fallback; the record keeps why.
      const accepted = dropFlaggedVisuals(storyboard, visualReport);
      const scenes = lintVisualPlan(accepted).scenes.map((scene, i) => ({...scene, problems: visualReport.scenes[i].problems}));
      const templateScenes = scenes.filter((x) => x.source === 'template').length;
      return {storyboard: accepted, model, attempts: calls.length, calls, skippedModel, wordBudget: budget, scriptChecks, visualPlan: {scenes, problems: visualReport.problems, templateScenes, fallbackScenes: scenes.length - templateScenes}};
    } catch (error) {
      if (error instanceof ScriptRejectedError) throw error; // already recorded; a clear message for the user
      const message = error instanceof Error ? error.message : String(error);
      const outcome = classify(message, error);
      // For "overloaded", record which kind (free-tier quota vs. temporary server load) without the raw error text.
      const note = outcome === 'invalid_output' ? message.slice(0, 160) : outcome === 'overloaded' ? (/429|quota|rate.?limit|exhaust/i.test(message) ? 'quota or rate limit (429)' : 'server busy (503)') : undefined;
      calls.push({model, ms: Date.now() - started, outcome, note});
      if (outcome === 'timeout' || outcome === 'overloaded') {
        markHealth(model, true, outcome);
        const next = afterTransientFailure({model, fallback, switched, retriedModels, callsLeft: MAX_CALLS - calls.length});
        if (next.action === 'switch') { model = next.model; switched = true; continue; }
        if (next.action === 'retry') { retriedModels.add(model); continue; }
        throw new Error(`Gemini request failed before a usable response was received (${outcome} on ${model}${note ? `: ${note}` : ''}).`);
      }
      if (outcome === 'invalid_output') {
        // At most one correction per storyboard: if it was already used, stop instead of asking again.
        if (repairNote) throw new Error(`Gemini storyboard still failed validation after its one correction: ${message.slice(0, 200)}`);
        repairNote = message.slice(0, 500);
        continue;
      }
      throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
    }
  }
  throw new Error(`Gemini storyboard failed validation after ${MAX_CALLS} attempts.`);
}
