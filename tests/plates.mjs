// Checks for the plate calculator's "Plates go on: Both sides / One side" choice.   node tests/plates.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const out = p => p.evaluate(() => ({ head: document.querySelector('#plOut .plhead')?.textContent, list: document.querySelector('#plOut .pllist')?.textContent, tot: document.querySelector('#plOut .pltot')?.textContent }));

try {
  const o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), 'tally:aboutSeen:v1': '1' } });
  const p = o.page;
  await p.click('#tabs button[data-pg="workout"]');
  ok(await p.isVisible('#plSides') && await p.evaluate(() => document.querySelector('#plSides .on').dataset.s === '2'), 'the choice is there, starting on Both sides (as before)');
  // the case from the screenshot: 27.5 kg on a machine with no bar
  await p.click('#plBar .exchip[data-id="none"]'); await p.fill('#plGoal', '27.5'); await p.waitForTimeout(150);
  let r = await out(p);
  ok(/^Each side/.test(r.head) && r.list === '10 kg + 2.5 kg + 1.25 kg' && /= 2 × 13.75 kg/.test(r.tot), 'Both sides, no bar: 13.75 kg each side (' + r.list + ')');
  await p.click('#plSides button[data-s="1"]'); await p.waitForTimeout(150);
  r = await out(p);
  ok(/^One side/.test(r.head) && r.list === '25 kg + 2.5 kg' && /Total 27.5 kg .*all on one side/.test(r.tot), 'One side, no bar: all 27.5 kg on one side (' + r.list + ' · ' + r.tot + ')');
  // with a 20 kg bar or sled: 60 kg total, one side carries 40 kg
  await p.click('#plBar .exchip[data-id="kg20"]'); await p.fill('#plGoal', '60'); await p.waitForTimeout(150);
  r = await out(p);
  ok(r.list === '25 kg + 15 kg' && /= bar 20 kg \+ 40 kg on one side/.test(r.tot), 'One side with a 20 kg bar: 40 kg on the one side (' + r.tot + ')');
  // when the goal cannot be made exactly, the alternative is right too
  await p.fill('#plGoal', '61'); await p.waitForTimeout(150);
  ok(/closest below/.test(await p.textContent('#plOut')) && /Closest above: 61.25 kg/.test(await p.textContent('#plOut')), 'One side: closest weights step by a single plate (61 kg -> 60 or 61.25 kg)');
  // remembered
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('tally:settings:v1')).plates.sides);
  ok(saved === 1, 'the choice is saved');
  await p.reload(); await p.waitForTimeout(600); await p.click('#tabs button[data-pg="workout"]');
  ok(await p.evaluate(() => document.querySelector('#plSides .on').dataset.s === '1'), 'and still One side after a restart');
  await p.click('#plSides button[data-s="2"]'); await p.fill('#plGoal', '100'); await p.waitForTimeout(150);
  r = await out(p);
  ok(/^Each side/.test(r.head) && r.list === '25 kg + 15 kg' && /bar 20 kg \+ 2 × 40 kg/.test(r.tot), 'back on Both sides it splits evenly again (' + r.tot + ')');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} plate check(s) FAILED` : 'all plate checks passed');
if (fails) process.exitCode = 1;
