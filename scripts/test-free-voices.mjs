import 'dotenv/config';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not configured.');
  process.exit(1);
}

const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const phrase = 'Hello! This is a short voice test.';
const outputDir = path.resolve('runs', 'voice-check');
await mkdir(outputDir, {recursive: true});

const voices = [
  ['male', process.env.ELEVENLABS_MALE_VOICE_ID],
  ['female', process.env.ELEVENLABS_FEMALE_VOICE_ID]
];
const results = await Promise.all(voices.map(async ([role, voiceId]) => {
  if (!voiceId?.trim()) return {role, status: 'not_configured'};
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
      method: 'POST',
      headers: {'xi-api-key': apiKey, 'Content-Type': 'application/json'},
      body: JSON.stringify({text: phrase, model_id: modelId, voice_settings: {stability: 0.5, similarity_boost: 0.75}}),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) return {role, status: 'failed', statusCode: response.status, error: 'Speech generation request was rejected.'};
    const audio = await response.json();
    if (!audio.audio_base64) return {role, status: 'failed', error: 'No audio was returned.'};
    const outputPath = path.join(outputDir, `${role}.mp3`);
    await writeFile(outputPath, Buffer.from(audio.audio_base64, 'base64'));
    const durationSeconds = audio.alignment?.character_end_times_seconds?.at(-1);
    return {role, status: 'ok', file: path.relative(process.cwd(), outputPath), characters: phrase.length, durationSeconds};
  } catch (error) {
    return {role, status: 'failed', error: error instanceof Error ? error.message.slice(0, 250) : 'Request failed.'};
  }
}));

console.log(JSON.stringify({modelId, results}, null, 2));
if (results.some((result) => result.status !== 'ok')) process.exitCode = 1;
