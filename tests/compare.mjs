// Compares two recordings picture by picture and text by text.
//   node tests/compare.mjs old new      (directories under tests/out/)
// Pictures count as the same when no pixel differs by more than NOISE brightness levels (out of 255)
// apart from a few faint stray pixels (see STRAY_PIXELS): the browser's own rendering wobbles that much.
// For every real difference a side-by-side picture (old | new | changed pixels in red) goes to tests/out/diff/.
// Exit code 1 if anything differs.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ROOT } from './harness.mjs';

const NOISE = 4;
// Where a dimmed overlay or soft shadow is blended, the browser can also be off by a few levels on a
// couple of pixels from run to run. Up to STRAY_PIXELS such pixels, none off by more than STRAY_LEVELS,
// count as noise. A real change (a 1-pixel border shift, one changed letter) touches far more pixels.
const STRAY_PIXELS = 12, STRAY_LEVELS = 60;
const [a, b] = [process.argv[2] || 'old', process.argv[3] || 'new'];
const A = path.join(ROOT, 'tests/out', a), B = path.join(ROOT, 'tests/out', b), D = path.join(ROOT, 'tests/out/diff');
const ma = JSON.parse(fs.readFileSync(path.join(A, 'manifest.json'), 'utf8'));
const mb = JSON.parse(fs.readFileSync(path.join(B, 'manifest.json'), 'utf8'));
fs.rmSync(D, { recursive: true, force: true });

// Known, intended differences go here, e.g. the version number once the rebuild has its own.
const ALLOW = [];

function pixelDiff(k) {
  const pa = PNG.sync.read(fs.readFileSync(path.join(A, k + '.png'))), pb = PNG.sync.read(fs.readFileSync(path.join(B, k + '.png')));
  if (pa.width !== pb.width || pa.height !== pb.height) { sideBySide(k, pa, pb, null); return `size ${pa.width}×${pa.height} vs ${pb.width}×${pb.height}`; }
  const mask = new Uint8Array(pa.width * pa.height); let n = 0, worst = 0;
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4, d = Math.max(Math.abs(pa.data[o] - pb.data[o]), Math.abs(pa.data[o + 1] - pb.data[o + 1]), Math.abs(pa.data[o + 2] - pb.data[o + 2]));
    if (d > NOISE) { mask[i] = 1; n++; if (d > worst) worst = d; }
  }
  if (n <= STRAY_PIXELS && worst <= STRAY_LEVELS) return '';   // a few faint stray pixels: blending noise
  sideBySide(k, pa, pb, mask);
  return `${n} pixels differ (by up to ${worst} levels)`;
}
function sideBySide(k, pa, pb, mask) {
  const w = Math.max(pa.width, pb.width), h = Math.max(pa.height, pb.height), out = new PNG({ width: w * 3 + 20, height: h });
  out.data.fill(255);
  const put = (src, x0, tint) => { for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4, d = (y * out.width + x + x0) * 4, red = tint && mask && mask[y * src.width + x];
    out.data[d] = red ? 230 : src.data[s]; out.data[d + 1] = red ? 30 : (tint ? (src.data[s + 1] + 255 * 2) / 3 : src.data[s + 1]);
    out.data[d + 2] = red ? 30 : (tint ? (src.data[s + 2] + 255 * 2) / 3 : src.data[s + 2]); out.data[d + 3] = 255; } };
  put(pa, 0, false); put(pb, w + 10, false); put(pb, 2 * w + 20, true);
  const f = path.join(D, k + '.png'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, PNG.sync.write(out));
}

const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])].sort();
let same = 0; const bad = [];
for (const k of keys) {
  if (ALLOW.some(r => r.test(k))) { same++; continue; }
  const x = ma[k], y = mb[k];
  if (!x || !y) { bad.push(`${k}: only in ${x ? a : b}`); continue; }
  const notes = [];
  if (x.png === 'missing' || y.png === 'missing') { bad.push(`${k}: could not photograph in ${x.png === 'missing' ? a : b}: ${(x.error || y.error || '').slice(0, 100)}`); continue; }
  if (x.png !== y.png) { const p = pixelDiff(k); if (p) notes.push(p); }
  if (x.txt !== y.txt) {
    const ta = fs.readFileSync(path.join(A, k + '.txt'), 'utf8').split('\n'), tb = fs.readFileSync(path.join(B, k + '.txt'), 'utf8').split('\n');
    const i = ta.findIndex((l, j) => l !== tb[j]);
    notes.push(`text differs at line ${i + 1}: "${(ta[i] || '').slice(0, 80)}" vs "${(tb[i] || '').slice(0, 80)}"`);
  }
  if (notes.length) bad.push(`${k}: ${notes.join(', ')}`); else same++;
}
console.log(`${same} of ${keys.length} the same`);
if (bad.length) { console.log(bad.join('\n') + `\nSide-by-side pictures: tests/out/diff/`); process.exitCode = 1; }
