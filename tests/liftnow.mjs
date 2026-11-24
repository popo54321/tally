// Checks "Today so far: … kg lifted" above Save entry: it adds up as you type, compares with something about as
// heavy, counts body weight for bodyweight movements, says "This day" for other days, and Save says the total.
//   node tests/liftnow.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const line = p => p.evaluate(() => { const e = document.getElementById('liftNow'); return e && e.offsetParent !== null ? e.textContent : null; });
const reps = async (p, key, i, n, kg) => { const row = `#sets-${key} .setrow:nth-child(${i})`; if (kg != null) await p.fill(row + ' .kg', String(kg)); await p.fill(row + ' .rp', String(n)); await p.waitForTimeout(80); };

try {
  const o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' } });
  const p = o.page;
  await p.click('#tabs button[data-pg="workout"]'); await p.waitForTimeout(200);
  ok(await line(p) === null, 'nothing logged yet: no line');
  await p.selectOption('#fDay', 'mon'); await p.waitForTimeout(200);
  ok(await line(p) === null, 'a session with weights but no reps typed: still no line');
  await reps(p, 'cx_barbellbenchpress', 1, 10, 75);
  ok(await line(p) === 'Today so far: 750 kg lifted · 1 set · ≈ 1.5 grand pianos', 'first set typed (75 kg × 10): ' + await line(p));
  for (const i of [2, 3, 4]) await reps(p, 'cx_barbellbenchpress', i, 10, 75);
  ok(await line(p) === 'Today so far: 3,000 kg lifted · 4 sets · ≈ a hippo', 'four sets: ' + await line(p));
  await p.click('#sets-cx_barbellbenchpress .setrow:nth-child(4) .rmset'); await p.waitForTimeout(120);
  ok(/^Today so far: 2,250 kg lifted · 3 sets/.test(await line(p) || ''), 'removing a set takes it off: ' + await line(p));
  // a bodyweight movement counts body weight too
  await p.click('#tabs button[data-pg="body"]'); await p.fill('#fWeight', '80'); await p.click('#tabs button[data-pg="workout"]'); await p.waitForTimeout(120);
  await p.click('#addMoveBtn'); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('#shList [data-add="cx_pullup"]').click()); await p.waitForTimeout(200);
  await reps(p, 'cx_pullup', 1, 10, 0);
  ok(/^Today so far: 3,050 kg lifted · 4 sets/.test(await line(p) || ''), 'pull-ups at 80 kg body weight add 800 kg: ' + await line(p));
  // Save says it too
  await p.click('#saveBtn2'); await p.waitForTimeout(300);
  ok(/3,050 kg lifted/.test(await p.textContent('#savedMsg2')), 'the Save message says how much: ' + await p.textContent('#savedMsg2'));
  // another day
  await p.click('#dayPrev'); await p.waitForTimeout(300);
  ok(/^This day: [\d,]+ kg lifted/.test(await line(p) || '') || await line(p) === null, 'another day says “This day” (' + await line(p) + ')');
  await p.click('#dayNext').catch(() => {}); await p.waitForTimeout(300);
  ok(/^Today so far: 3,050 kg lifted/.test(await line(p) || ''), 'back on today, the saved total is there: ' + await line(p));
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
  // small totals have no comparison
  const o2 = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' } });
  await o2.page.click('#tabs button[data-pg="workout"]'); await o2.page.selectOption('#fDay', 'fri'); await o2.page.waitForTimeout(200);
  await reps(o2.page, 'cx_dumbbellcurl', 1, 2, 5);
  ok(await line(o2.page) === 'Today so far: 10 kg lifted · 1 set', 'under 25 kg: just the number (' + await line(o2.page) + ')');
  await o2.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} lifted-today check(s) FAILED` : 'all lifted-today checks passed');
if (fails) process.exitCode = 1;
