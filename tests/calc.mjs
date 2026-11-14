// Runs each calculation in the baseline version (tests/baseline.json) and in the current src/ on thousands of
// random inputs, and fails on the first answer that differs, unless tests/expected-changes.mjs lists it.
//   node tests/calc.mjs [name-filter]
import path from 'node:path';
import * as esbuild from 'esbuild';
import { chromium, ROOT } from './harness.mjs';
import { ensureBaseline, baseline } from './baseline.mjs';
import { expected } from './expected-changes.mjs';
import { CASES } from './calc-cases.mjs';

const RUNS = 3000;
const filter = process.argv[2] || '';
const ENTRY = "export * from './core/index'; export * from './i18n/index'; export { EN } from './i18n/en'; export * from './store/schema';";
// All of core, wording and storage rules as one script that puts its functions on window[name].
const bundle = async (srcDir, name) => (await esbuild.build({ stdin: { contents: ENTRY, resolveDir: srcDir, loader: 'ts' },
  bundle: true, write: false, format: 'iife', globalName: name, target: ['chrome90'], logLevel: 'silent' })).outputFiles[0].text;
const baseSrc = path.join(ensureBaseline(), 'src');
const [baseJs, nowJs] = await Promise.all([bundle(baseSrc, 'BaseCore'), bundle(path.join(ROOT, 'src'), 'NowCore')]);

const browser = await chromium.launch();
let failed = 0, checked = 0; const meant = [];
try {
  // the same clock zone and language as the app tests, on an empty page
  const ctx = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<!doctype html><title>calc</title>');
  await page.evaluate(([a, b]) => { (0, eval)(a); (0, eval)(b); }, [baseJs, nowJs]);
  for (const c of CASES) {
    if (filter && !c.name.includes(filter)) continue;
    let s = c.seed || 1;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const inputs = Array.from({ length: c.runs || RUNS }, () => c.gen(rnd));
    const res = await page.evaluate(({ fn, inputs, perKey }) => {
      const make = Core => new Function('Core', 'return (' + fn + ')')(Core);
      const baseFn = make(window.BaseCore), nowFn = make(window.NowCore);
      const show = v => JSON.stringify(v, (k, x) => (typeof x === 'number' && !isFinite(x)) ? String(x) : x);
      if (perKey) {   // one object, compared key by key
        const a = baseFn(...inputs[0]), b = nowFn(...inputs[0]);
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        return { keys: keys.filter(k => show(a[k]) !== show(b[k])).map(k => ({ k, base: a[k], now: b[k] })) };
      }
      for (let i = 0; i < inputs.length; i++) {
        let a, b;
        try { a = show(baseFn(...inputs[i])); } catch (e) { a = 'threw ' + e.message; }
        try { b = show(nowFn(...inputs[i])); } catch (e) { b = 'threw ' + e.message; }
        if (a !== b) return { i, input: show(inputs[i]), base: a, now: b };
      }
      return null;
    }, { fn: c.fn, inputs, perKey: !!c.perKey });
    checked++;
    if (res && res.keys) {
      const off = res.keys.filter(x => !expected(`${c.perKey}:${x.k}`));
      res.keys.filter(x => expected(`${c.perKey}:${x.k}`)).forEach(x => meant.push(`${c.perKey}:${x.k}`));
      if (off.length) { failed++; console.log(`DIFFERS ${c.name}: ${off.length} key(s)\n` + off.slice(0, 20).map(x => `  ${x.k}\n    baseline: ${JSON.stringify(x.base)}\n    now:      ${JSON.stringify(x.now)}`).join('\n')); }
      else console.log(`same    ${c.name}` + (res.keys.length ? ` (${res.keys.length} changed on purpose)` : ''));
    } else if (res) {
      if (expected('calc:' + c.name)) { meant.push('calc:' + c.name); console.log(`changed ${c.name} (on purpose: ${expected('calc:' + c.name).why})`); }
      else { failed++; console.log(`DIFFERS ${c.name}: input ${res.input}\n  baseline: ${res.base}\n  now:      ${res.now}`); }
    } else console.log(`same    ${c.name} (${inputs.length} inputs)`);
  }
  if (errors.length) { console.log('PAGE ERRORS: ' + errors.join(' | ')); failed++; }
  await ctx.close();
} finally { await browser.close(); }
const b = baseline();
console.log(`${checked - failed} of ${checked} calculations give the same answers as the baseline (${b.version}, ${b.ref.slice(0, 7)})` + (meant.length ? `; changed on purpose: ${meant.join(', ')}` : ''));
if (failed) process.exitCode = 1;
