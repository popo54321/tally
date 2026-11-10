// Runs each calculation in the frozen 8.1 app and its rebuilt copy in src/core/ on thousands of
// random inputs and fails on the first answer that differs.   node tests/equiv.mjs [name-filter]
import path from 'node:path';
import * as esbuild from 'esbuild';
import { chromium, openApp, ROOT } from './harness.mjs';
import { start } from './serve.mjs';
import { CASES } from './equiv-cases.mjs';

const RUNS = 3000;
const filter = process.argv[2] || '';

// All of src/core as one script that puts its functions on window.Core.
const core = await esbuild.build({ stdin: { contents: "export * from './core/index'; export * from './i18n/index'; export { EN } from './i18n/en'; export * from './store/schema';", resolveDir: path.join(ROOT, 'src'), loader: 'ts' },
  bundle: true, write: false, format: 'iife', globalName: 'Core', target: ['chrome90'] });

const { server, url } = await start();
const browser = await chromium.launch();
let failed = 0, checked = 0;
try {
  const ctxOpts = { store: { 'tally:aboutSeen:v1': '1' }, bypassCSP: true };   // so the test can add its own script
  const o = await openApp(browser, url, 'old', ctxOpts);
  await o.page.evaluate(src => { (0, eval)(src); }, core.outputFiles[0].text);
  for (const c of CASES) {
    if (filter && !c.name.includes(filter)) continue;
    let s = c.seed || 1;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const inputs = Array.from({ length: c.runs || RUNS }, () => c.gen(rnd));
    const res = await o.page.evaluate(({ oldExpr, newExpr, inputs, setup }) => {
      const g = (0, eval);
      if (setup) g(setup);
      const oldFn = g(oldExpr), newFn = g(newExpr);
      const show = v => JSON.stringify(v, (k, x) => (typeof x === 'number' && !isFinite(x)) ? String(x) : x);
      for (let i = 0; i < inputs.length; i++) {
        let a, b;
        try { a = show(oldFn(...inputs[i])); } catch (e) { a = 'threw ' + e.message; }
        try { b = show(newFn(...inputs[i])); } catch (e) { b = 'threw ' + e.message; }
        if (a !== b) return { i, input: show(inputs[i]), old: a, new: b };
      }
      return null;
    }, { oldExpr: c.old, newExpr: c.new, inputs, setup: c.setup || '' });
    checked++;
    if (res) { failed++; console.log(`DIFFERS ${c.name}: input ${res.input}\n  8.1:     ${res.old}\n  rebuild: ${res.new}`); }
    else console.log(`same    ${c.name} (${inputs.length} inputs)`);
  }
  if (o.errors.length) { console.log('PAGE ERRORS: ' + o.errors.join(' | ')); failed++; }
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(`${checked - failed} of ${checked} calculations give identical answers`);
if (failed) process.exitCode = 1;
