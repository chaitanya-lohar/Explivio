// Synthesizes a soft, royalty-free instrumental bed (warm pad + gentle arpeggio) as a mono WAV.
import {writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

const rate = 22050;
const seconds = 72;
const bpm = 84;
const beat = 60 / bpm;
const bar = beat * 4;
const out = new Float32Array(rate * seconds);
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Cmaj9 – Am9 – Fmaj7 – G6/sus, one chord per bar.
const chords = [[48, 55, 64, 71, 74], [45, 52, 60, 67, 71], [41, 53, 57, 64, 69], [43, 50, 59, 64, 67]];

const add = (start, length, fn) => {
  const from = Math.max(0, Math.floor(start * rate));
  const to = Math.min(out.length, Math.floor((start + length) * rate));
  for (let i = from; i < to; i++) out[i] += fn((i - from) / rate);
};

for (let b = 0; b * bar < seconds; b++) {
  const chord = chords[b % chords.length];
  const start = b * bar;
  // Pad: detuned sines with slow attack and release that overlaps the next bar.
  for (const note of chord) {
    const f = hz(note);
    add(start, bar + 1.6, (t) => {
      const env = Math.min(1, t / 1.4) * Math.min(1, Math.max(0, (bar + 1.6 - t) / 1.6));
      const tone = Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t + 1.1) + 0.12 * Math.sin(4 * Math.PI * f * t);
      return 0.045 * env * tone;
    });
  }
  // Soft bass on the root.
  const root = hz(chord[0] - 12);
  add(start, bar, (t) => 0.09 * Math.min(1, t / 0.08) * Math.exp(-t * 0.9) * Math.sin(2 * Math.PI * root * t));
  // Gentle plucked arpeggio in eighth notes.
  const pattern = [2, 3, 4, 3, 1, 3, 4, 2];
  pattern.forEach((idx, step) => {
    const f = hz(chord[idx] + 12);
    add(start + step * beat / 2, 1.6, (t) => 0.05 * Math.min(1, t / 0.01) * Math.exp(-t * 3.2) * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)));
  });
}

// Fade the whole bed in and out, then normalize to a quiet peak.
let peak = 0;
for (let i = 0; i < out.length; i++) {
  const t = i / rate;
  out[i] *= Math.min(1, t / 2) * Math.min(1, (seconds - t) / 3);
  peak = Math.max(peak, Math.abs(out[i]));
}
const gain = 0.5 / peak;
const data = Buffer.alloc(out.length * 2);
for (let i = 0; i < out.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), i * 2);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
const target = path.resolve('public', 'assets', 'soft-pad.wav');
await mkdir(path.dirname(target), {recursive: true});
await writeFile(target, Buffer.concat([header, data]));
console.log(`Music bed written: ${target}`);
