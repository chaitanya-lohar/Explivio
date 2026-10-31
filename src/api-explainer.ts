import path from 'node:path';
import {copyFile} from 'node:fs/promises';
import {createNarration} from './providers/elevenlabs.js';
import type {Storyboard} from './schemas/storyboard.js';
import type {ApiScene, ApiVideoProps} from './video/api.js';

export const apiStoryboard: Storyboard = {title: 'How Do APIs Work?', target_audience: 'Beginners with no programming knowledge', learning_objective: 'Understand that an API carries requests from one piece of software to another and brings responses back, using a restaurant analogy.', scenes: [
  {scene_id: 1, narration_text: 'Ever wondered how two apps communicate with each other?', on_screen_text: 'How Do *APIs* Work?', visual_type: 'title', visual_description: 'Two app screens slide in and a glowing connection forms between them as data packets travel both ways.', key_elements: ['shop app', 'pay app', 'connection'], estimated_duration_seconds: 5},
  {scene_id: 2, narration_text: "Imagine you're sitting in a restaurant. You choose a dish from the menu and place your order.", on_screen_text: 'You place an order', visual_type: 'analogy', visual_description: 'A customer at a restaurant table picks pasta from a menu and orders it; a ring highlights them as the one making a request.', key_elements: ['customer', 'menu', 'order'], estimated_duration_seconds: 10},
  {scene_id: 3, narration_text: 'The waiter takes your order to the kitchen. In an application, an API plays a similar role. It carries a request from one system to another.', on_screen_text: 'The waiter carries it|An *API* does the same', visual_type: 'diagram', visual_description: 'A waiter walks the order ticket to the kitchen, then the scene becomes a Client → API → Server diagram with a request travelling across.', key_elements: ['waiter', 'client', 'API', 'server', 'request'], estimated_duration_seconds: 12},
  {scene_id: 4, narration_text: 'The server processes the request and prepares a response, just like the kitchen prepares your food.', on_screen_text: 'The server prepares a response', visual_type: 'process', visual_description: 'A server processes a request with turning gears and a progress bar while a chef cooks and plates the dish below.', key_elements: ['server', 'processing', 'kitchen', 'food'], estimated_duration_seconds: 13},
  {scene_id: 5, narration_text: 'The API brings the response back to the application. The result could be weather information, a product price, or your latest messages.', on_screen_text: 'The answer comes back', visual_type: 'example', visual_description: 'A response travels Server → API → Client, then a weather card, product price and message notification appear.', key_elements: ['response', 'weather', 'price', 'messages'], estimated_duration_seconds: 12},
  {scene_id: 6, narration_text: 'So remember: an API helps different software systems communicate by sending requests and returning responses.', on_screen_text: 'Remember *this*', visual_type: 'summary', visual_description: 'Request, API and Response assemble into one flow, then "That\'s how APIs work!" lands with a check mark and confetti.', key_elements: ['request', 'API', 'response'], estimated_duration_seconds: 8}
]};

const KICKERS = ['60-SECOND EXPLAINER', 'THE ANALOGY', 'THE MESSENGER', 'BEHIND THE SCENES', 'THE RESPONSE', 'REMEMBER'];
const LEAD = 0.3;
const MIN_GAP = 0.6;
const MAX_GAP = 2.6;
const END_HOLD = 3.4;

// Voices each scene separately (with neighbouring text for natural prosody), then lays scenes out on the measured audio.
export async function buildApiVideo(storyboard: Storyboard, runDir: string, publicRunDir: string, runId: string, seconds: number, voiceGender?: string) {
  const narrations: (Awaited<ReturnType<typeof createNarration>> & {audioPath: string})[] = [];
  for (const [index, scene] of storyboard.scenes.entries()) {
    const file = `scene-${scene.scene_id}.mp3`;
    const result = await createNarration(scene.narration_text, path.join(runDir, file), voiceGender, {
      voiceId: process.env.ELEVENLABS_NARRATOR_VOICE_ID || undefined,
      previousText: storyboard.scenes[index - 1]?.narration_text,
      nextText: storyboard.scenes[index + 1]?.narration_text,
      speed: 0.92
    });
    await copyFile(path.join(runDir, file), path.join(publicRunDir, file));
    narrations.push({...result, audioPath: `runs/${runId}/${file}`});
  }
  const planned = storyboard.scenes.map((scene) => scene.estimated_duration_seconds);
  const speech = narrations.map((n) => n.durationSeconds);
  // Give each scene breathing room toward its planned length without leaving long silences.
  const gaps = speech.map((s, i) => i === speech.length - 1 ? END_HOLD : Math.min(MAX_GAP, Math.max(MIN_GAP, planned[i] - LEAD - s)));
  let cursor = 0;
  const scenes: ApiScene[] = storyboard.scenes.map((scene, i) => {
    const start = cursor;
    const speechStart = start + LEAD;
    const speechEnd = speechStart + speech[i];
    const end = speechEnd + gaps[i];
    cursor = end;
    return {id: scene.scene_id, kicker: KICKERS[i] || '', headline: scene.on_screen_text, narration: scene.narration_text, start, end, speechStart, speechEnd, audioPath: narrations[i].audioPath, words: narrations[i].words.map((w) => ({text: w.text, start: w.start + speechStart, end: w.end + speechStart}))};
  });
  const props: ApiVideoProps = {scenes, musicPath: 'assets/soft-pad.wav', seconds: Math.ceil(cursor * 10) / 10};
  const meta = {voiceId: narrations[0]?.voiceId, modelId: narrations[0]?.modelId, perScene: narrations.map((n, i) => ({scene: i + 1, seconds: n.durationSeconds, bytes: n.bytes})), targetSeconds: seconds};
  return {props, meta};
}
