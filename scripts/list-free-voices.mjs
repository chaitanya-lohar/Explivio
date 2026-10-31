import 'dotenv/config';

const key = process.env.ELEVENLABS_API_KEY?.trim();
if (!key) {
  console.error('ELEVENLABS_API_KEY is not configured.');
  process.exit(1);
}

const url = new URL('https://api.elevenlabs.io/v2/voices');
url.searchParams.set('voice_type', 'default');
url.searchParams.set('page_size', '100');
const response = await fetch(url, {headers: {'xi-api-key': key}, signal: AbortSignal.timeout(20_000)});
if (!response.ok) {
  console.error(`ElevenLabs voice list request failed (${response.status}).`);
  process.exit(1);
}

const data = await response.json();
const voices = data.voices || [];
const pick = (gender) => voices.find((voice) => (voice.labels?.gender || '').toLowerCase() === gender);
const output = {};
for (const gender of ['male', 'female']) {
  const voice = pick(gender);
  output[gender] = voice ? {name: voice.name, voiceId: voice.voice_id, gender: voice.labels?.gender} : null;
}

const replacements = {
  male: {name: 'Darian - Warm Grounded Storyteller', voiceId: 'gOupLcAkjEnguROwi4oS'},
  female: {name: 'Talia - Warm Soft Guide', voiceId: 'OZ0L6eISlOejga3XjDFt'}
};
for (const [gender, candidate] of Object.entries(replacements)) {
  try {
    const check = await fetch(`https://api.elevenlabs.io/v1/voices/${candidate.voiceId}`, {headers: {'xi-api-key': key}, signal: AbortSignal.timeout(20_000)});
    if (check.ok) {
      const voice = await check.json();
      candidate.available = true;
      candidate.name = voice.name || candidate.name;
      candidate.gender = voice.labels?.gender || gender;
    } else candidate.available = false;
  } catch {
    candidate.available = false;
  }
}
for (const voice of Object.values(output)) {
  if (!voice) continue;
  try {
    const check = await fetch(`https://api.elevenlabs.io/v1/voices/${voice.voiceId}`, {headers: {'xi-api-key': key}, signal: AbortSignal.timeout(20_000)});
    voice.apiAccessible = check.ok;
  } catch {
    voice.apiAccessible = false;
  }
}
console.log(JSON.stringify({accessibleDefaultVoiceCount: voices.length, defaultVoices: output, newerReplacementVoices: replacements}, null, 2));
