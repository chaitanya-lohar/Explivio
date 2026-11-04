// Minimal PNG decoder (8-bit greyscale, RGB or RGBA, non-interlaced: what Remotion and ffmpeg write). No dependencies.
import {deflateSync, inflateSync} from 'node:zlib';

const CHANNELS = {0: 1, 2: 3, 6: 4};

/** Returns {width, height, channels, pixels} where pixels is the unfiltered byte data, row by row. */
export function decodePng(buf) {
  let pos = 8, width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0 || !(data[9] in CHANNELS)) throw new Error('unsupported PNG (need 8-bit, non-interlaced grey/RGB/RGBA)');
      channels = CHANNELS[data[9]];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      pixels[y * stride + x] = v & 255;
    }
  }
  return {width, height, channels, pixels};
}

/** Share of pixels in a rectangle that are clearly lit (luminance > threshold): ~0 means the area is empty. */
export function litShare(png, {x0, y0, x1, y1}, threshold = 110) {
  const {width, channels, pixels} = png;
  let lit = 0, total = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * width + x) * channels;
    const lum = channels === 1 ? pixels[i] : 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    total++;
    if (lum > threshold) lit++;
  }
  return lit / total;
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };

/** Encodes 8-bit RGB pixel data (row by row) as a PNG. */
export function encodeRgbPng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Places decoded images side by side (same height), with a gap, as one RGB PNG. */
export function hstackPngs(pngs, gap = 8) {
  const height = Math.max(...pngs.map((p) => p.height));
  const width = pngs.reduce((w, p) => w + p.width, 0) + gap * (pngs.length - 1);
  const out = Buffer.alloc(width * height * 3, 40);
  let x0 = 0;
  for (const p of pngs) {
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const i = (y * p.width + x) * p.channels;
      const o = (y * width + x0 + x) * 3;
      if (p.channels === 1) { out[o] = out[o + 1] = out[o + 2] = p.pixels[i]; } else { out[o] = p.pixels[i]; out[o + 1] = p.pixels[i + 1]; out[o + 2] = p.pixels[i + 2]; }
    }
    x0 += p.width + gap;
  }
  return encodeRgbPng(width, height, out);
}
