// Kokoro-82M speech worker (free, offline, Apache-2.0). Runs in its own short-lived process so the model's ~1 GB of
// memory is released before rendering starts. Input: one JSON argument file. Output: a 16-bit mono WAV plus, on
// stdout, one JSON line with per-sentence timing (where speech starts/ends inside each sentence's audio).
//   node kokoro-worker.mjs <job.json>
//   job = { sentences: string[], voice: string, speed?: number, wavPath: string, modelDir: string, dtype?: string }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { env } = await import("@huggingface/transformers");
mkdirSync(job.modelDir, { recursive: true });
env.cacheDir = job.modelDir; // keep the downloaded model inside the project (gitignored), not in node_modules
const { KokoroTTS } = await import("kokoro-js");

const started = performance.now();
// fp32 measured 3.5x faster than q8 on this CPU (real-time factor 0.6 vs 2.1).
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: job.dtype ?? "fp32", device: "cpu" });
const loadSeconds = (performance.now() - started) / 1000;

const THRESHOLD = 0.012; // amplitude treated as speech
const sentences = [];
const chunks = [];
let rate = 24000;
let offset = 0;
for (const text of job.sentences) {
  const audio = await tts.generate(text, { voice: job.voice, speed: job.speed ?? 1 });
  rate = audio.sampling_rate;
  const samples = audio.audio;
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]) < THRESHOLD) first++;
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) < THRESHOLD) last--;
  sentences.push({
    text,
    start: offset / rate,
    end: (offset + samples.length) / rate,
    speechStart: (offset + Math.min(first, samples.length - 1)) / rate,
    speechEnd: (offset + Math.max(last, first)) / rate,
  });
  chunks.push(samples);
  offset += samples.length;
}

const pcm = Buffer.alloc(44 + offset * 2);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + offset * 2, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(rate, 24);
pcm.writeUInt32LE(rate * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(offset * 2, 40);
let at = 44;
for (const chunk of chunks) for (let i = 0; i < chunk.length; i++, at += 2) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chunk[i] * 32767))), at);
mkdirSync(path.dirname(job.wavPath), { recursive: true });
writeFileSync(job.wavPath, pcm);

process.stdout.write(JSON.stringify({ ok: true, rate, seconds: offset / rate, loadSeconds, generateSeconds: (performance.now() - started) / 1000 - loadSeconds, sentences }) + "\n");
