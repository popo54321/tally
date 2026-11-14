// Checks for folding cards on Body, Workout, Guide and My Gym.   node tests/fold.mjs [--shots]
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openApp, fixture, ROOT } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const PAGES = { body: 8, workout: 9, guide: 5, gym: 1 };
const cardsOf = (p, pg) => p.evaluate(pg => [...document.querySelectorAll(`#pg-${pg} > .card`)].map(c => ({ id: c.id || c.querySelector('.lbl').textContent.trim().slice(0, 24), fold: !!c.querySelector('.foldbtn'), folded: c.classList.contains('folded'), h: Math.round(c.getBoundingClientRect().height) })), pg);

try {
  const fx = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1' };
  let o = await openApp(browser, url, 'new', { store: fx }); let p = o.page;
  for (const [pg, n] of Object.entries(PAGES)) {
    await p.click(`#tabs button[data-pg="${pg}"]`);
    const cs = await cardsOf(p, pg);
    ok(cs.filter(c => c.fold).length === n && cs.every(c => c.fold), `${pg}: all ${n} cards have a fold button`);
  }
  // Fold a Body card by its corner button, then by tapping its heading
  await p.click('#tabs button[data-pg="body"]');
  const before = (await cardsOf(p, 'body')).find(c => c.id === 'cardBody');
  await p.click('#cardBody .foldbtn'); await p.waitForTimeout(150);
  let c = (await cardsOf(p, 'body')).find(x => x.id === 'cardBody');
  ok(c.folded && c.h < 90, `the corner button folds Body & food to its heading (${before.h} px -> ${c.h} px)`);
  ok(await p.isVisible('#cardBody .foldlbl') && !(await p.isVisible('#fWeight')) && (await p.$$('#cardBody > .lbl')).length > 1 && (await p.evaluate(() => [...document.querySelectorAll('#cardBody > .lbl:not(.foldlbl)')].every(l => l.offsetParent === null))), 'the heading stays; the form and the sub-headings inside the card are hidden');
  ok((await p.getAttribute('#cardBody .foldbtn', 'aria-expanded')) === 'false' && /Show this section/.test(await p.getAttribute('#cardBody .foldbtn', 'title')), 'the button says it is folded and offers to show it');
  await p.click('#cardBody .foldlbl'); await p.waitForTimeout(150);
  ok(!(await cardsOf(p, 'body')).find(x => x.id === 'cardBody').folded && await p.isVisible('#fWeight'), 'tapping the heading opens it again');
  // Remembered across a restart, and only the folded ones
  await p.click('#cardBody .foldbtn'); await p.click('#tabs button[data-pg="workout"]'); await p.click('#cardPlates .foldbtn'); await p.click('#tabs button[data-pg="guide"]'); await p.click('#cardVol .lbl');
  await p.click('#tabs button[data-pg="gym"]'); await p.click('#cardGym .foldbtn'); await p.waitForTimeout(200);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('tally:settings:v1')).chartFold);
  ok(saved.cardBody && saved.cardPlates && saved.cardVol && saved.cardGym, 'folded cards are saved in settings (' + Object.keys(saved).join(', ') + ')');
  const store = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  await o.ctx.close();
  o = await openApp(browser, url, 'new', { store }); p = o.page;
  const got = {};
  for (const pg of Object.keys(PAGES)) { await p.click(`#tabs button[data-pg="${pg}"]`); (await cardsOf(p, pg)).forEach(c => { if (c.folded) got[c.id] = 1; }); }
  ok(Object.keys(got).sort().join() === ['cardBody', 'cardGym', 'cardPlates', 'cardVol'].sort().join(), 'after a restart exactly those four are still folded (' + Object.keys(got).join(', ') + ')');
  // A folded chart card draws correctly once opened
  await p.click('#tabs button[data-pg="body"]');
  await p.click('.foldbtn[data-fold="chart_weight"]'); await p.waitForTimeout(150);
  await p.click('.foldbtn[data-fold="chart_weight"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const s = document.getElementById('wChart'); return s.clientWidth > 100 && /^0 0 \d+ \d+$/.test(s.getAttribute('viewBox')) && +s.getAttribute('viewBox').split(' ')[2] === Math.round(s.clientWidth); }), 'a chart folded and opened again is drawn at the right width');
  // The trend charts keep their own behaviour (folded while empty)
  await p.click('#tabs button[data-pg="workout"]');
  ok((await p.getAttribute('.foldbtn[data-fold="str"]', 'title')) === 'Hide this chart', 'trend charts keep their "chart" wording');
  // Tour opens folded cards while it points at them, and puts them back
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#tourBtn'); await p.waitForTimeout(300);
  let steps = 0, shown = true;
  while (await p.evaluate(() => !!document.querySelector('.tour')) && steps < 30) {
    shown = shown && await p.evaluate(() => { const r = document.querySelector('.tour-ring').getBoundingClientRect(); return r.width > 10 && r.height > 10; });
    await p.click('#tourNext'); await p.waitForTimeout(100); steps++;
  }
  ok(steps >= 14 && shown, `the tour still shows every step with four cards folded (${steps} steps)`);
  const stillFolded = {};
  for (const pg of Object.keys(PAGES)) { await p.click(`#tabs button[data-pg="${pg}"]`); (await cardsOf(p, pg)).forEach(c => { if (c.folded) stillFolded[c.id] = 1; }); }
  ok(Object.keys(stillFolded).sort().join() === ['cardBody', 'cardGym', 'cardPlates', 'cardVol'].sort().join(), 'after the tour the same four cards are folded again');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  if (process.argv.includes('--shots')) {
    const D = path.join(ROOT, 'tests/out/fold'); fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
    for (const pg of ['body', 'workout', 'guide']) { await p.click(`#tabs button[data-pg="${pg}"]`);
      await p.evaluate(() => document.querySelectorAll('.foldbtn').forEach(b => { const c = b.closest('.card'); if (b.offsetParent && !c.classList.contains('folded') && c.id !== 'cardLog') b.click(); })); await p.waitForTimeout(400);
      await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(D, pg + '-folded.png'), fullPage: true }); }
  }
  await o.ctx.close();
  // 150% text on a small phone: the button never covers the heading
  o = await openApp(browser, url, 'new', { store: fx, viewport: { width: 360, height: 700 }, scale: 1.5 }); p = o.page;
  let clash = [];
  for (const pg of Object.keys(PAGES)) { await p.click(`#tabs button[data-pg="${pg}"]`);
    clash.push(...await p.evaluate(pg => [...document.querySelectorAll(`#pg-${pg} > .card`)].filter(c => c.querySelector('.foldbtn.corner')).flatMap(c => {
      const b = c.querySelector('.foldbtn').getBoundingClientRect(), l = c.querySelector('.lbl'), r = document.createRange(); r.selectNodeContents(l);
      return [...r.getClientRects()].some(q => q.right > b.left && q.bottom > b.top && q.top < b.bottom) ? [c.id || l.textContent.slice(0, 20)] : []; }), pg)); }
  ok(!clash.length, 'at 150% text the heading text never runs under the fold button' + (clash.length ? ': ' + clash.join(', ') : ''));
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} fold check(s) FAILED` : 'all fold checks passed');
if (fails) process.exitCode = 1;
