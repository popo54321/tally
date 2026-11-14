// Storage checks for the rebuilt app: first start after updating, saving, packing old months, going
// back to 8.1 and returning, a crash part-way through a save, a damaged slot, and no compression.
//   node tests/storage.mjs
import { chromium, openApp, fixture, TODAY } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// Everything in storage, with packed bundles unpacked, so tests can compare plain values.
const dump = page => page.evaluate(async () => {
  const unpack = async v => {
    if (v.startsWith('js1:')) return v.slice(4);
    const bytes = Uint8Array.from(atob(v.slice(4)), c => c.charCodeAt(0));
    return new TextDecoder().decode(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  };
  const out = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); }
  const days = [];
  for (const k of Object.keys(out).sort()) {
    try {
      if (k.startsWith('tally:half:')) days.push(...JSON.parse(await unpack(out[k])));
      if (k.startsWith('tally:month:')) days.push(...JSON.parse(out[k]));
    } catch (e) { /* a deliberately damaged slot */ }
  }
  days.sort((a, b) => a.date < b.date ? -1 : 1);
  return { raw: out, days };
});
const keysOf = (d, p) => Object.keys(d.raw).filter(k => k.startsWith(p)).sort();
const SEEN = { 'tally:aboutSeen:v1': '1' };

try {
  const fx = { ...fixture('full-male'), ...SEEN };
  const v1Days = JSON.parse(fx['tally:entries:v1']);

  // 1. First start after updating from 8.1
  let o = await openApp(browser, url, 'new', { store: fx });
  let d = await dump(o.page);
  ok(keysOf(d, 'tally:month:').join() === ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map(m => 'tally:month:' + m).join(), 'first start: one slot for each of the last 7 months (this month and the 6 before)');
  ok(keysOf(d, 'tally:half:').join() === 'tally:half:2025-H2,tally:half:2026-H1', 'first start: older days packed into half-year bundles 2025-H2 and 2026-H1');
  ok(d.raw['tally:half:2025-H2'].startsWith('gz1:'), 'bundles are compressed');
  ok(JSON.stringify(d.days) === JSON.stringify(v1Days), `every one of the ${v1Days.length} days reads back exactly`);
  ok(d.raw['tally:entries:v1'] === fx['tally:entries:v1'], 'the 8.1 copy is still there, unchanged');
  ok(!!d.raw['tally:days-format'], 'format note written after the check passed');
  const sizeOld = fx['tally:entries:v1'].length, sizeNew = keysOf(d, 'tally:').filter(k => k.startsWith('tally:month:') || k.startsWith('tally:half:')).reduce((a, k) => a + d.raw[k].length, 0);
  console.log(`     storage for days: 8.1 ${(sizeOld / 1024).toFixed(0)} KB, new layout ${(sizeNew / 1024).toFixed(0)} KB`);

  // 2. Saving a change rewrites only this month (and the 8.1 copy)
  const before = d.raw;
  await o.page.fill('#fWeight', '87.7'); await o.page.click('#saveBtn'); await o.page.waitForTimeout(400);
  d = await dump(o.page);
  const changed = Object.keys(d.raw).filter(k => d.raw[k] !== before[k]).sort();
  ok(changed.join() === 'tally:days-format,tally:entries:v1,tally:month:2026-11', 'saving today changes only this month, the 8.1 copy and the format note (' + changed.join(', ') + ')');
  ok(d.days.find(x => x.date === '2026-11-10').weight === 87.7, 'the new weight is saved');
  ok(JSON.stringify(JSON.parse(d.raw['tally:entries:v1'])) === JSON.stringify(d.days), '8.1 copy matches the new layout');
  const afterSave = d.raw;
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();

  // 3. Going back to the previous version (the baseline) shows everything, including the change just made
  o = await openApp(browser, url, 'base', { store: afterSave });
  await o.page.click('#tabs button[data-pg="body"]');
  const oldWeight = await o.page.inputValue('#fWeight');
  ok(oldWeight === '87.7', 'opening the previous version on the same data shows the latest weight (' + oldWeight + ')');
  // ... and a day logged there meanwhile
  await o.page.click('#dayPrev'); await o.page.fill('#fWeight', '88.8'); await o.page.click('#saveBtn'); await o.page.waitForTimeout(400);
  const after81 = (await dump(o.page)).raw;
  await o.ctx.close();
  o = await openApp(browser, url, 'new', { store: after81 });
  d = await dump(o.page);
  ok(d.days.find(x => x.date === '2026-11-09').weight === 88.8, 'coming back from the previous version: the day logged there is here');
  ok(JSON.stringify(d.days) === d.raw['tally:entries:v1'], 'coming back: the 8.1-format copy still matches');
  await o.ctx.close();

  // 4. Eight months later, the months past the line pack themselves into bundles
  const later = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
  await later.addInitScript(store => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k in store) localStorage.setItem(k, store[k]); sessionStorage.setItem('s', 1); } }, after81);
  let p = await later.newPage(); await p.clock.setFixedTime(new Date('2027-07-10T09:00:00'));
  await p.goto(url + '/new/index.html'); await p.waitForTimeout(800);
  d = await dump(p);
  ok(keysOf(d, 'tally:month:').length === 0 && keysOf(d, 'tally:half:').join() === 'tally:half:2025-H2,tally:half:2026-H1,tally:half:2026-H2', 'eight months on: every month older than 6 months is in a half-year bundle');
  ok(JSON.stringify(d.days) === after81['tally:entries:v1'], 'eight months on: nothing lost in packing');
  await later.close();

  // 5. A crash part-way through packing (bundle written, month slots not yet removed) loses nothing
  const crash = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
  await crash.addInitScript(store => {
    if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k in store) localStorage.setItem(k, store[k]); sessionStorage.setItem('s', 1);
      const rm = Storage.prototype.removeItem; Storage.prototype.removeItem = function () { throw new Error('simulated crash'); }; setTimeout(() => { Storage.prototype.removeItem = rm; }, 1500); }
  }, after81);
  p = await crash.newPage(); await p.clock.setFixedTime(new Date('2027-07-10T09:00:00'));
  await p.goto(url + '/new/index.html'); await p.waitForTimeout(800);
  const half = (await dump(p)).raw;
  await p.reload(); await p.waitForTimeout(800);
  d = await dump(p);
  ok(Object.keys(half).some(k => k.startsWith('tally:month:')) && Object.keys(half).some(k => k === 'tally:half:2026-H2'), 'crash test: bundle written while month slots were left behind');
  ok(JSON.stringify(d.days.filter((x, i, a) => !i || a[i - 1].date !== x.date)) === after81['tally:entries:v1'], 'crash test: after restarting, every day is intact');
  ok(keysOf(d, 'tally:month:').length === 0, 'crash test: the leftover month slots are tidied up on the next start');
  await crash.close();

  // 6. A damaged slot: the app warns and refuses to overwrite anything
  const damaged = { ...afterSave, 'tally:month:2026-10': '{not json' };
  o = await openApp(browser, url, 'new', { store: damaged });
  await o.page.fill('#fWeight', '70'); await o.page.click('#saveBtn'); await o.page.waitForTimeout(400);
  d = await dump(o.page);
  ok(d.raw['tally:month:2026-10'] === '{not json' && d.raw['tally:entries:v1'] === afterSave['tally:entries:v1'], 'damaged slot: nothing overwritten');
  ok(/failed to load|read saved data/i.test(await o.page.textContent('#savedMsg')), 'damaged slot: the app says the data failed to load and it is not saving');
  await o.ctx.close();

  // 7. A browser that cannot compress stores bundles as plain text, which a normal browser reads
  const plainCtx = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
  await plainCtx.addInitScript(store => { delete window.CompressionStream; delete window.DecompressionStream;
    if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k in store) localStorage.setItem(k, store[k]); sessionStorage.setItem('s', 1); } }, fx);
  p = await plainCtx.newPage(); await p.clock.setFixedTime(new Date(TODAY));
  await p.goto(url + '/new/index.html'); await p.waitForTimeout(800);
  const plain = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  ok(plain['tally:half:2025-H2'].startsWith('js1:'), 'no compression available: bundles stored as plain text');
  await plainCtx.close();
  o = await openApp(browser, url, 'new', { store: plain });
  d = await dump(o.page);
  ok(JSON.stringify(d.days) === JSON.stringify(v1Days) && o.errors.length === 0, 'plain bundles read back exactly in a normal browser');
  await o.ctx.close();

  // 8. Editing a day in a packed half-year rewrites just that bundle
  o = await openApp(browser, url, 'new', { store: afterSave });
  const b2 = (await dump(o.page)).raw;
  await o.page.evaluate(() => { const i = document.getElementById('fDate'); i.value = '2025-10-15'; i.dispatchEvent(new Event('change')); });
  await o.page.click('#dateBtn'); await o.page.waitForTimeout(100);
  await o.page.keyboard.press('Escape');
  await o.page.evaluate(() => { const i = document.getElementById('fDate'); i.value = '2025-10-15'; });
  await o.page.click('#dayNext'); await o.page.click('#dayPrev'); await o.page.waitForTimeout(200);
  await o.page.fill('#fKcal', '1999'); await o.page.click('#saveBtn'); await o.page.waitForTimeout(500);
  d = await dump(o.page);
  const ch = Object.keys(d.raw).filter(k => d.raw[k] !== b2[k]).sort();
  ok(d.days.find(x => x.date === '2025-10-15') && d.days.find(x => x.date === '2025-10-15').kcal === 1999, 'old day edited: the change is saved (' + ch.join(', ') + ')');
  ok(ch.includes('tally:half:2025-H2') && !ch.some(k => k.startsWith('tally:month:')), 'old day edited: only its half-year bundle (and the 8.1 copy) rewritten');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} storage check(s) FAILED` : 'all storage checks passed');
if (fails) process.exitCode = 1;
