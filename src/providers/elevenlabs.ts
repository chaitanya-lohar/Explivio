import {writeFile} from 'node:fs/promises';

export type CaptionCue = {start: number; end: number; text: string};
export type WordTiming = {text: string; start: number; end: number};
export type NarrationOptions = {voiceId?: string; previousText?: string; nextText?: string; speed?: number};

export async function createNarration(text: string, outputPath: string, selectedGender?: string, options: NarrationOptions = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is missing. Add your ElevenLabs key to .env.');
  const gender = (selectedGender || process.env.ELEVENLABS_VOICE_GENDER || 'default').toLowerCase();
  const genderVoiceId = gender === 'male' ? process.env.ELEVENLABS_MALE_VOICE_ID : gender === 'female' ? process.env.ELEVENLABS_FEMALE_VOICE_ID : undefined;
  const voiceId = options.voiceId || genderVoiceId || process.env.ELEVENLABS_VOICE_ID || 'bajNon13EdhNMndG3z05';
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST', headers: {'xi-api-key': apiKey, 'Content-Type': 'application/json'},
    body: JSON.stringify({text, model_id: modelId, previous_text: options.previousText, next_text: options.nextText, voice_settings: {stability: 0.5, similarity_boost: 0.75, ...(options.speed ? {speed: options.speed} : {})}}),
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const result = await response.json() as {audio_base64: string; alignment?: {characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[]}};
  const audio = Buffer.from(result.audio_base64, 'base64');
  await writeFile(outputPath, audio);
  const alignment = result.alignment;
  const captionCues: CaptionCue[] = [];
  const wordTimings: WordTiming[] = [];
  if (alignment) {
    for (const word of text.matchAll(/\S+/g)) {
      const first = word.index ?? 0;
      const start = alignment.character_start_times_seconds[first];
      const end = alignment.character_end_times_seconds[first + word[0].length - 1];
      if (Number.isFinite(start) && Number.isFinite(end)) wordTimings.push({text: word[0], start, end});
    }
    const words = [...text.matchAll(/\S+/g)];
    for (let index = 0; index < words.length;) {
      const group = [];
      let groupLength = 0;
      while (index + group.length < words.length && group.length < 6) {
        const word: RegExpMatchArray = words[index + group.length];
        if (group.length > 0 && groupLength + word[0].length + 1 > 34) break;
        group.push(word);
        groupLength += word[0].length + (group.length > 1 ? 1 : 0);
      }
      if (group.length === 0) group.push(words[index]);
      const first = group[0]; const last = group[group.length - 1];
      const firstChar = first.index ?? 0; const lastChar = (last.index ?? 0) + last[0].length - 1;
      const start = alignment.character_start_times_seconds[firstChar];
      const end = alignment.character_end_times_seconds[lastChar];
      if (Number.isFinite(start) && Number.isFinite(end)) captionCues.push({start, end, text: group.map((word) => word[0]).join(' ')});
      index += group.length;
    }
  }
  const durationSeconds = alignment?.character_end_times_seconds.at(-1) ?? 0;
  return {voiceId, voiceGender: gender, modelId, bytes: audio.length, durationSeconds, captionCues, words: wordTimings};
}
