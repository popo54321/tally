// Compares the current build with the baseline version, picture by picture and text by text.
//   node tests/compare.mjs            (tests/out/base/ against tests/out/new/)
// Pictures count as the same when no pixel differs by more than NOISE brightness levels (out of 255)
// apart from a few faint stray pixels (see STRAY_PIXELS): the browser's own rendering wobbles that much.
// A difference listed in tests/expected-changes.mjs is reported as on purpose; any other fails (exit code 1).
// For every difference a side-by-side picture (baseline | now | changed pixels in red) goes to tests/out/diff/.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ROOT } from './harness.mjs';
import { BASE_DIR, baseline, versionOf } from './baseline.mjs';
import { expected } from './expected-changes.mjs';

const NOISE = 4;
// Where a dimmed overlay or soft shadow is blended, the browser can also be off by a few levels on a
// couple of pixels from run to run. Up to STRAY_PIXELS such pixels, none off by more than STRAY_LEVELS,
// count as noise. A real change (a 1-pixel border shift, one changed letter) touches far more pixels.
const STRAY_PIXELS = 32, STRAY_LEVELS = 60;
const A = path.join(ROOT, 'tests/out/base'), B = path.join(ROOT, 'tests/out/new'), D = path.join(ROOT, 'tests/out/diff');
const ma = JSON.parse(fs.readFileSync(path.join(A, 'manifest.json'), 'utf8'));
const mb = JSON.parse(fs.readFileSync(path.join(B, 'manifest.json'), 'utf8'));
fs.rmSync(D, { recursive: true, force: true });

// The Version & Updates card says which version you have: there only, the baseline's number may read as the
// current one. Every other word on the card must still match, and the picture is then not compared.
const VERSION_CARD = /\/settings\/\d+-cardUpdate$/;
const OLD_V = versionOf(path.join(BASE_DIR, 'index.html')), NEW_V = versionOf(path.join(ROOT, 'dist/index.html'));

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
let same = 0; const bad = [], meant = [];
for (const k of keys) {
  const x = ma[k], y = mb[k], notes = [];
  if (!x || !y) notes.push(`only in ${x ? 'the baseline' : 'the current build'}`);
  else if (x.png === 'missing' || y.png === 'missing') notes.push(`could not photograph in ${x.png === 'missing' ? 'the baseline' : 'the current build'}: ${(x.error || y.error || '').slice(0, 100)}`);
  else {
    if (VERSION_CARD.test(k) && OLD_V !== NEW_V) {
      const ta = fs.readFileSync(path.join(A, k + '.txt'), 'utf8').split(OLD_V).join(NEW_V), tb = fs.readFileSync(path.join(B, k + '.txt'), 'utf8');
      if (ta === tb) { same++; continue; }
    }
    if (x.png !== y.png) { const p = pixelDiff(k); if (p) notes.push(p); }
    if (x.txt !== y.txt) {
      const ta = fs.readFileSync(path.join(A, k + '.txt'), 'utf8').split('\n'), tb = fs.readFileSync(path.join(B, k + '.txt'), 'utf8').split('\n');
      const i = ta.findIndex((l, j) => l !== tb[j]);
      notes.push(`text differs at line ${i + 1}: "${(ta[i] || '').slice(0, 80)}" vs "${(tb[i] || '').slice(0, 80)}"`);
    }
  }
  if (!notes.length) { same++; continue; }
  const e = expected(k);
  (e ? meant : bad).push(`${k}: ${notes.join(', ')}${e ? ` [on purpose: ${e.why}]` : ''}`);
}
const b = baseline();
console.log(`${same} of ${keys.length} the same as the baseline (${b.version}, ${b.ref.slice(0, 7)})` + (meant.length ? `, ${meant.length} changed on purpose` : ''));
if (meant.length) console.log('Changed on purpose:\n  ' + meant.join('\n  '));
if (bad.length) { console.log('NOT EXPECTED:\n  ' + bad.join('\n  ') + `\nSide-by-side pictures: tests/out/diff/`); process.exitCode = 1; }
