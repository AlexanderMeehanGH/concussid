// Minimal WAV (RIFF) reader/writer: PCM 8/16/24/32-bit integer and 32/64-bit float, mixed to mono.
import { readFileSync, writeFileSync } from 'node:fs';

export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path}: not a WAV file (convert to WAV first)`);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(off + 8), ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') data = { start: off + 8, size: Math.min(size, b.length - off - 8) };
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: missing fmt or data chunk`);
  let { format, ch, sr, bits } = fmt;
  if (format === 0xfffe) format = bits === 32 || bits === 64 ? (bits === 64 ? 3 : null) : 1; // WAVE_FORMAT_EXTENSIBLE: guess from bits
  const bps = bits / 8, n = Math.floor(data.size / (bps * ch));
  const out = new Float32Array(n);
  const read = (p) => {
    if (format === 3) return bits === 64 ? b.readDoubleLE(p) : b.readFloatLE(p);
    if (bits === 8) return (b.readUInt8(p) - 128) / 128;
    if (bits === 16) return b.readInt16LE(p) / 32768;
    if (bits === 24) return b.readIntLE(p, 3) / 8388608;
    if (bits === 32) return format === null ? b.readFloatLE(p) : b.readInt32LE(p) / 2147483648;
    throw new Error(`${path}: unsupported ${bits}-bit format`);
  };
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += read(data.start + (i * ch + c) * bps);
    out[i] = s / ch;
  }
  return { samples: out, sr };
}

export function writeWav(path, samples, sr) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}
