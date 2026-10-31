import 'dotenv/config';
import {GoogleGenAI} from '@google/genai';

const safeError = (error, secret) => {
  let message = error instanceof Error ? error.message : String(error);
  if (secret) message = message.split(secret).join('[redacted]');
  return message.slice(0, 500);
};

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return {status: 'not_configured'};
  const client = new GoogleGenAI({apiKey: key, httpOptions: {timeout: 20_000, retryOptions: {attempts: 1}}});
  const tryModel = async (model) => {
    try {
      const response = await client.interactions.create({model, input: 'Reply with the single word OK.'});
      return response.output_text?.trim() ? {status: 'ok', model} : {status: 'failed', model, error: 'The API returned no text.'};
    } catch (error) {
      return {status: 'failed', model, error: safeError(error, key)};
    }
  };
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const primary = await tryModel(configuredModel);
  if (primary.status === 'ok' || !/(503.*high demand|429.*(?:limit|quota|rate))/i.test(primary.error || '')) return primary;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash';
  if (fallbackModel === configuredModel) return primary;
  const fallback = await tryModel(fallbackModel);
  return fallback.status === 'ok' ? {status: 'degraded', configuredModel: primary, fallback} : {status: 'failed', configuredModel: primary, fallback};
}

async function checkElevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return {status: 'not_configured'};
  const request = async (url) => fetch(url, {headers: {'xi-api-key': key}, signal: AbortSignal.timeout(20_000)});
  const result = {};
  try {
    const response = await request('https://api.elevenlabs.io/v1/user/subscription');
    if (!response.ok) result.account = {status: 'failed', statusCode: response.status, error: 'Account endpoint rejected the request.'};
    else {
      const data = await response.json();
      result.account = {status: 'ok', tier: data.tier, subscriptionStatus: data.status, charactersRemaining: Math.max(0, (data.character_limit || 0) - (data.character_count || 0))};
    }
  } catch (error) {
    result.account = {status: 'failed', error: safeError(error, key)};
  }

  const voices = [
    ['default', process.env.ELEVENLABS_VOICE_ID],
    ['male', process.env.ELEVENLABS_MALE_VOICE_ID],
    ['female', process.env.ELEVENLABS_FEMALE_VOICE_ID]
  ].filter(([, id]) => Boolean(id?.trim()));
  result.voices = await Promise.all(voices.map(async ([role, rawId]) => {
    try {
      const voiceId = rawId.trim();
      const response = await request(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`);
      if (!response.ok) return {role, status: 'failed', statusCode: response.status, error: response.status === 400 ? 'Voice ID was not found or is unavailable to this account.' : 'Voice endpoint rejected the request.'};
      const voice = await response.json();
      return {role, status: 'ok', name: voice.name || 'available', gender: voice.labels?.gender || 'unspecified'};
    } catch (error) {
      return {role, status: 'failed', error: safeError(error, key)};
    }
  }));
  return result;
}

const geminiOnly = process.argv.includes('--gemini-only');
const [gemini, elevenlabs] = await Promise.all([checkGemini(), geminiOnly ? Promise.resolve({status: 'skipped'}) : checkElevenLabs()]);
console.log(JSON.stringify({gemini, elevenlabs}, null, 2));
const failed = gemini.status === 'failed' || elevenlabs.status === 'failed' || elevenlabs.account?.status === 'failed' || elevenlabs.voices?.some((voice) => voice.status === 'failed');
if (failed) process.exitCode = 1;
