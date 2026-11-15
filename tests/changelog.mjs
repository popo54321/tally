// Checks release notes: "What's new" once after an update (and when), the Update log, and that the notes are
// kept up to date (the newest entry must be this version).   node tests/changelog.mjs
import path from 'node:path';
import fs from 'node:fs';
import * as esbuild from 'esbuild';
import { ROOT, chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };

// ---- the notes themselves ----
const out = await esbuild.build({ stdin: { contents: "export { CHANGELOG } from './data/changelog';", resolveDir: path.join(ROOT, 'src'), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node' });
const { CHANGELOG } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const V = (fs.readFileSync(path.join(ROOT, 'src/ui/shared.js'), 'utf8').match(/APP_VERSION = '([0-9.]+)'/) || [])[1];
const num = v => v.split('.').map(Number);
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
ok(CHANGELOG[0].v === V, `the newest notes are for this version (${CHANGELOG[0].v} = ${V}): add notes with every release`);
const numbered = CHANGELOG.filter(r => r.v);
ok(numbered.every((r, i) => i === 0 || newer(numbered[i - 1].v, r.v)), 'versions run newest first, each once');
ok(CHANGELOG.every((r, i) => i === 0 || r.date <= CHANGELOG[i - 1].date) && CHANGELOG.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date)), 'dates run newest first');
ok(CHANGELOG.every(r => r.notes.length && r.notes.every(n => n.trim().length > 5)), 'every version has notes');
ok(CHANGELOG[CHANGELOG.length - 1].v === '' && /first release/i.test(CHANGELOG[CHANGELOG.length - 1].notes[0]), 'it goes back to the first release');
ok(CHANGELOG.every(r => r.notes.every(n => !n.includes("'"))), 'notes use ’ like the rest of the app');

// ---- in the app ----
const { server, url } = await start();
const browser = await chromium.launch();
const SEEN = { 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
const shown = p => p.evaluate(() => document.getElementById('clWrap').classList.contains('show'));
const heads = p => p.evaluate(() => [...document.querySelectorAll('#clBody .clhead b')].map(b => b.textContent));
try {
  // updating from 9.5: every version since then
  let o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), ...SEEN, 'tally:seenVersion:v1': '9.5' } }), p = o.page;
  await p.waitForTimeout(300);
  ok(await shown(p), 'after updating, What’s new opens by itself');
  ok(await p.textContent('#clTitle') === 'What’s new since Tally 9.5', 'titled from the version you had (' + await p.textContent('#clTitle') + ')');
  let h = await heads(p);
  ok(h[0] === 'Tally ' + V && h.includes('Tally 9.6') && !h.includes('Tally 9.5'), 'lists each version since 9.5, not 9.5 itself: ' + h.join(', '));
  await p.click('#clOk');
  ok(!(await shown(p)), 'Got it closes it');
  await p.reload(); await p.waitForTimeout(500);
  ok(!(await shown(p)), 'and it does not come back');
  // the update log
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#clBtn'); await p.waitForTimeout(100);
  h = await heads(p);
  ok(await shown(p) && await p.textContent('#clTitle') === 'Update log' && h.length === CHANGELOG.length && h[h.length - 1] === 'First release', `Settings → Update log lists all ${CHANGELOG.length}, back to the first release`);
  ok(!(await p.isVisible('#clAll')), 'no “All updates” button inside the full log');
  await p.keyboard.press('Escape');
  ok(!(await shown(p)), 'Escape closes it');
  await p.click('#clBtn'); await p.evaluate(() => window.tallyBack());
  ok(!(await shown(p)), 'so does Android’s Back');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();

  // from before release notes existed: this version's notes, with a way to all of them
  {
    const st = { ...fixture('full-male'), ...SEEN }; delete st['tally:seenVersion:v1'];
    const ctx = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
    await ctx.addInitScript(s => { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('__s', '1'); } }, st);
    const q = await ctx.newPage(); await q.goto(`${url}/new/index.html`); await q.waitForTimeout(800);
    ok(await shown(q) && await q.textContent('#clTitle') === `What’s new in Tally ${V}` && (await heads(q)).length === 1, 'coming from before release notes existed: this version’s notes');
    await q.click('#clAll');
    ok((await heads(q)).length === CHANGELOG.length && await q.textContent('#clTitle') === 'Update log', '“All updates” opens the full log');
    await ctx.close();
  }
  // a brand-new user: the welcome, no release notes
  {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
    const q = await ctx.newPage(); await q.goto(`${url}/new/index.html`); await q.waitForTimeout(800);
    ok(await q.evaluate(() => document.getElementById('abWrap').classList.contains('show')) && !(await shown(q)), 'a new user gets the welcome, not release notes');
    ok(await q.evaluate(() => localStorage.getItem('tally:seenVersion:v1')) === V, 'and this version is noted as seen');
    await ctx.close();
  }
  // someone whose welcome still opens at start: notes wait until it is closed
  { const st = { ...fixture('full-male'), 'tally:tourSeen:v1': '1', 'tally:seenVersion:v1': '9.7' }; delete st['tally:aboutSeen:v1'];   // the sample data has it
    o = await openApp(browser, url, 'new', { store: st }); p = o.page; }
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('abWrap').classList.contains('show')) && !(await shown(p)), 'the welcome comes first');
  await p.click('#abOk').catch(() => p.evaluate(() => document.querySelector('#abWrap button').click()));
  await p.waitForTimeout(700);
  ok(await shown(p) && await p.textContent('#clTitle') === 'What’s new since Tally 9.7', 'then What’s new');
  await o.ctx.close();
  // going back to an older version: nothing
  o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), ...SEEN, 'tally:seenVersion:v1': '10.0' } }); p = o.page;
  await p.waitForTimeout(300);
  ok(!(await shown(p)) && await p.evaluate(() => localStorage.getItem('tally:seenVersion:v1')) === V, 'opened after a newer version: no notes');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} release-note check(s) FAILED` : 'all release-note checks passed');
if (fails) process.exitCode = 1;
