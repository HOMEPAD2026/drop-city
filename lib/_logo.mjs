// lib/_logo.mjs — the agent's logo when no image model is set: a neon badge with the ticker in a pixel font, drawn
// pixel by pixel and written as a PNG with node's zlib (no image library). Black, hot pink, white — the city's colours.
import { deflateSync } from "node:zlib";

// 5 × 7 pixel font, one row a number (bit 4 = the leftmost pixel)
const F = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
};
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, "ascii"); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
}
export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const mix = (a, b, t) => a + (b - a) * t;
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/// the badge for a ticker → PNG bytes (384 × 384)
export function badge(symbol, seed = symbol) {
  const N = 384, px = new Uint8ClampedArray(N * N * 4), c = N / 2, r = hash(seed);
  const hot = [255, 46, 136], white = [255, 240, 246], deep = [120, 10, 60];
  const tilt = ((r % 60) - 30) * (Math.PI / 180); // where the ring's light sits
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), i = (y * N + x) * 4;
    let col = [7, 7, 8];
    const glow = Math.max(0, 1 - d / 200) ** 2 * 0.55; col = col.map((v, k) => mix(v, deep[k], glow));
    if (d < 150) { const t = d / 150; col = [mix(22, 10, t), mix(14, 9, t), mix(20, 11, t)]; // the face
      if (((x + y + (r % 7)) % 14) < 1) col = col.map((v) => v + 6); } // fine diagonal grain
    if (d >= 150 && d < 168) { const a = Math.atan2(dy, dx) - tilt, lit = (Math.cos(a + Math.PI / 2) + 1) / 2; col = hot.map((v, k) => mix(v, white[k], lit ** 3)); } // the ring
    if (d >= 168 && d < 176) col = col.map((v, k) => mix(v, hot[k], 0.35 * (1 - (d - 168) / 8)));
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = d < 190 ? 255 : Math.max(0, 255 - (d - 190) * 40);
  }
  // the ticker in pixels, as big as fits the face
  const t = String(symbol || "?").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "?";
  const cols = t.length * 6 - 1, s = Math.max(6, Math.min(30, Math.floor(232 / cols))), w = cols * s, h = 7 * s, x0 = Math.round(c - w / 2), y0 = Math.round(c - h / 2);
  const dot = (gx, gy, colr, off = 0) => { for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const X = x0 + gx * s + xx + off, Y = y0 + gy * s + yy + off; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const i = (Y * N + X) * 4; px[i] = colr[0]; px[i + 1] = colr[1]; px[i + 2] = colr[2]; px[i + 3] = 255; } };
  [...t].forEach((ch, n) => { const g = F[ch] || F.O; for (let row = 0; row < 7; row++) for (let b = 0; b < 5; b++) if (g[row] & (16 >> b)) dot(n * 6 + b, row, [190, 18, 92], Math.max(2, s >> 2)); });
  [...t].forEach((ch, n) => { const g = F[ch] || F.O; for (let row = 0; row < 7; row++) for (let b = 0; b < 5; b++) if (g[row] & (16 >> b)) dot(n * 6 + b, row, row < 3 ? white : [255, 196, 222]); });
  // three sparkles on the ring
  for (let k = 0; k < 3; k++) { const a = tilt - Math.PI / 2 + (k - 1) * 0.5 + ((r >> (k * 3)) % 5) * 0.04, sx = Math.round(c + Math.cos(a) * 159), sy = Math.round(c + Math.sin(a) * 159), L = k === 1 ? 12 : 7;
    for (let q = -L; q <= L; q++) for (const [X, Y] of [[sx + q, sy], [sx, sy + q]]) { const i = (Y * N + X) * 4, f = 1 - Math.abs(q) / (L + 1); px[i] = mix(px[i], 255, f); px[i + 1] = mix(px[i + 1], 255, f); px[i + 2] = mix(px[i + 2], 255, f); } }
  return png(N, N, px);
}
