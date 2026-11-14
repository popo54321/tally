// Checks that tapping a movement on a full strength chart (eight shown) swaps out the one trained longest ago,
// instead of refusing with a message the user cannot see.   node tests/chartpick.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
// what the chips show: key -> colour, for those switched on
const chips = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#strPick .exchip.on')].map(b => [b.dataset.k, b.querySelector('.sw').style.background])));
const tap = (p, k) => p.evaluate(k => document.querySelector(`#strPick .exchip[data-k="${k}"]`).click(), k);

try {
  // eight shown, the three leg-day movements last trained 4 Nov, the rest 6 or 9 Nov; pull-up and curl not shown
  const eight = ['cx_barbellbenchpress', 'cx_overheadpress', 'cx_dumbbelllateralraise', 'cx_deadlift', 'cx_barbellrow', 'cx_backsquat', 'cx_legpress', 'cx_plank'];
  const store = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
  const st = JSON.parse(store['tally:settings:v1']); st.chartEx = eight; store['tally:settings:v1'] = JSON.stringify(st);
  const o = await openApp(browser, url, 'new', { store });
  const p = o.page;
  await p.click('#tabs button[data-pg="workout"]'); await p.waitForTimeout(200);
  const before = await chips(p);
  ok(Object.keys(before).length === 8 && eight.every(k => k in before), 'starts with the eight picked movements shown');
  await tap(p, 'cx_pullup'); await p.waitForTimeout(250);
  let now = await chips(p);
  ok(Object.keys(now).length === 8 && 'cx_pullup' in now, 'tapping a ninth movement shows it (no longer refused)');
  ok(!('cx_backsquat' in now), 'the one trained longest ago (back squat, 4 Nov) made way');
  ok(now.cx_pullup === before.cx_backsquat, 'the new one takes its colour');
  ok(eight.filter(k => k !== 'cx_backsquat').every(k => now[k] === before[k]), 'every other line keeps its colour');
  ok(/Back squat made way/.test(await p.textContent('body')), 'a message says which movement made way');
  await tap(p, 'cx_dumbbellcurl'); await p.waitForTimeout(250);
  now = await chips(p);
  ok('cx_dumbbellcurl' in now && !('cx_legpress' in now) && Object.keys(now).length === 8, 'again: leg press (also 4 Nov) makes way for the curl');
  await tap(p, 'cx_plank'); await p.waitForTimeout(250);
  ok(Object.keys(await chips(p)).length === 7, 'untapping still works (seven shown)');
  await tap(p, 'cx_backsquat'); await p.waitForTimeout(250);
  now = await chips(p);
  ok(Object.keys(now).length === 8 && 'cx_backsquat' in now && 'cx_dumbbellcurl' in now, 'with room free, tapping just adds');
  const lines = await p.evaluate(() => document.querySelectorAll('#strChart polyline, #strChart path.ln, #strChart .ser').length);
  ok(lines > 0, 'the chart draws lines');
  await p.reload(); await p.waitForTimeout(600); await p.click('#tabs button[data-pg="workout"]'); await p.waitForTimeout(200);
  const kept = await chips(p);
  ok(JSON.stringify(Object.keys(kept).sort()) === JSON.stringify(Object.keys(now).sort()), 'the choice is kept after a restart');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} chart-pick check(s) FAILED` : 'all chart-pick checks passed');
if (fails) process.exitCode = 1;
