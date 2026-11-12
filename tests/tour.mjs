// Checks for "How to use Tally": starts after a new user's welcome, every step rings something on screen,
// it is remembered once finished, Settings replays it, and Back, Escape and Skip close it.
//   node tests/tour.mjs [--shots]   (--shots saves a picture of every step to tests/out/tour/)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openApp, fixture, ROOT } from './harness.mjs';
import { start } from './serve.mjs';

const shots = process.argv.includes('--shots'), DIR = path.join(ROOT, 'tests/out/tour');
if (shots) { fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true }); }
const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
const tourUp = p => p.evaluate(() => !!document.querySelector('.tour'));

try {
  // 1. A brand-new user: welcome first, then the tour.
  let o = await openApp(browser, url, 'new', { store: {} });
  let p = o.page;
  ok(await p.isVisible('#abWrap .sh') && !(await tourUp(p)), 'new user: the welcome statement shows first, no tour yet');
  await p.click('#abOk'); await p.waitForTimeout(300);
  ok(await tourUp(p), 'closing the welcome starts the tour');
  const total = +(await p.textContent('#tourCount')).match(/of (\d+)/)[1];
  ok(total >= 14, `the tour has ${total} steps for an empty, uninstalled app`);
  let n = 0, bad = [];
  while (await tourUp(p) && n < 30) {
    n++;
    const info = await p.evaluate(() => {
      const r = document.querySelector('.tour-ring').getBoundingClientRect(), c = document.querySelector('.tour-card').getBoundingClientRect();
      const page = document.querySelector('.page.on').id;
      return { title: document.getElementById('tourTitle').textContent, count: document.getElementById('tourCount').textContent,
        ring: r.width > 10 && r.height > 10 && r.top >= 0 && r.bottom <= innerHeight + 1, cardIn: c.top >= 0 && c.bottom <= innerHeight + 1, page,
        overlap: !(c.bottom <= r.top || c.top >= r.bottom) && (r.height < innerHeight * 0.6) };
    });
    if (!info.ring || !info.cardIn || info.overlap) bad.push(`${info.count} ${info.title}: ring ${info.ring} card ${info.cardIn} overlap ${info.overlap}`);
    if (shots) await p.screenshot({ path: path.join(DIR, String(n).padStart(2, '0') + '.png') });
    await p.click('#tourNext'); await p.waitForTimeout(200);
  }
  ok(n === total, `Next walks through all ${total} steps and then closes`);
  ok(!bad.length, 'every step rings something on screen and the explanation does not cover a small target' + (bad.length ? ': ' + bad.join(' | ') : ''));
  ok(await p.evaluate(() => document.querySelector('.page.on').id === 'pg-body'), 'finishing returns to the Body page');
  ok(await p.evaluate(() => localStorage.getItem('tally:tourSeen:v1') === '1'), 'finishing is remembered');
  await p.reload(); await p.waitForTimeout(600);
  if (await p.isVisible('#abWrap .sh')) { await p.click('#abOk'); await p.waitForTimeout(300); }
  ok(!(await tourUp(p)), 'after a restart the tour does not start again');

  // 2. Settings replays it; Back, Escape and Skip close it.
  await p.click('#tabs button[data-pg="settings"]');
  ok(await p.isVisible('#tourBtn'), 'Settings has a How to use Tally button');
  await p.click('#tourBtn'); await p.waitForTimeout(300);
  ok(await tourUp(p) && /Step 1 of/.test(await p.textContent('#tourCount')), 'the button starts the tour from step 1');
  await p.click('#tourNext'); await p.click('#tourBack'); await p.waitForTimeout(150);
  ok(/Step 1 of/.test(await p.textContent('#tourCount')) && await p.isDisabled('#tourBack'), 'Back goes to the previous step (and is off on the first)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await tourUp(p)), 'Escape closes the tour');
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#tourBtn'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.tallyBack() === true) && !(await tourUp(p)), 'the Android Back button closes the tour');
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#tourBtn'); await p.waitForTimeout(200);
  await p.click('#tourSkip'); await p.waitForTimeout(200);
  ok(!(await tourUp(p)), 'Skip closes the tour');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();

  // 3. An existing user (welcome already seen) never gets it by itself; with data, the tour still works.
  o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), 'tally:aboutSeen:v1': '1' } });
  ok(!(await tourUp(o.page)), 'existing users are not interrupted by the tour');
  await o.page.click('#tabs button[data-pg="settings"]'); await o.page.click('#tourBtn'); await o.page.waitForTimeout(300);
  let k = 0; while (await tourUp(o.page) && k < 30) { await o.page.click('#tourNext'); await o.page.waitForTimeout(120); k++; }
  ok(k >= 14 && o.errors.length === 0, `with 14 months of data the tour runs through (${k} steps) without errors`);
  await o.ctx.close();

  // 4. Large text on a small phone: the explanation still fits.
  o = await openApp(browser, url, 'new', { store: { 'tally:aboutSeen:v1': '1' }, viewport: { width: 360, height: 700 }, scale: 1.5 });
  await o.page.click('#tabs button[data-pg="settings"]'); await o.page.click('#tourBtn'); await o.page.waitForTimeout(300);
  let fit = true; k = 0;
  while (await tourUp(o.page) && k < 30) { fit = fit && await o.page.evaluate(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(); return c.top >= 0 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1; }); await o.page.click('#tourNext'); await o.page.waitForTimeout(120); k++; }
  ok(fit, 'at 150% text on a small phone every explanation fits on screen');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} tour check(s) FAILED` : 'all tour checks passed');
if (fails) process.exitCode = 1;
