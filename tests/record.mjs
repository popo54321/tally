// Photographs an app: every visible card on every page, plus the top bar and a set of
// interactions, for each sample data set, screen size and text size. Also saves each card's text.
//   node tests/record.mjs old          -> tests/out/old/
//   node tests/record.mjs new          -> tests/out/new/
//   node tests/record.mjs old --quick  -> phone, 100% text only
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openApp, fixture, ROOT, sha } from './harness.mjs';
import { start } from './serve.mjs';

const target = process.argv[2] || 'old';
const quick = process.argv.includes('--quick');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const OUT = path.join(ROOT, 'tests/out', target);
const PAGES = ['body', 'workout', 'guide', 'gym', 'settings', 'history'];
const SEEN = { 'tally:aboutSeen:v1': '1' };

const RUNS = [];
for (const scen of ['full-male', 'full-female', 'sparse'])
  for (const viewport of quick ? ['phone'] : ['phone', 'desktop'])
    for (const scale of quick ? [null] : [null, 1.5]) {
      if (viewport === 'desktop' && scale) continue;
      RUNS.push({ name: `${scen}-${viewport}${scale ? '-150' : ''}`, store: fixture(scen), viewport, scale, pages: true, acts: scen !== 'sparse' });
    }
RUNS.push({ name: 'old-shapes-phone', store: { ...fixture('old-shapes'), ...SEEN }, viewport: 'phone', pages: true });
RUNS.push({ name: 'import-v4-phone', store: SEEN, viewport: 'phone', pages: true, importFile: 'backup-v4' });
RUNS.push({ name: 'import-days-phone', store: SEEN, viewport: 'phone', pages: ['body', 'history'], importFile: 'backup-days-only' });
if (target === 'new') RUNS.push({ name: 'new-only-copyday', store: { ...fixture('full-male'), ...SEEN }, viewport: 'phone', pages: ['workout'], newOnly: true, acts: true, actList: 'copy' });
RUNS.push({ name: 'new-user-phone', store: {}, viewport: 'phone', pages: false, welcome: true });
RUNS.push({ name: 'empty-phone', store: SEEN, viewport: 'phone', pages: true });
for (const preset of ['min', 'bold', 'zen', 'cyber', 'tact']) if (!quick)
  RUNS.push({ name: `theme-${preset}`, store: { ...fixture('full-male'), 'tally:theme:v1': JSON.stringify({ font: preset, colors: {}, preset }) }, viewport: 'phone', pages: ['body', 'workout'], themePreset: preset });

// Things to do on the page before photographing; each returns the element(s) to photograph.
const COPY_ACTS = [
  { name: 'copy-dialog', page: 'workout', run: async p => { await p.selectOption('#fDay', 'mon'); await p.click('#copyDayBtn'); await p.click('#cpDays button[data-d="thu"]'); return 'viewport'; } },
  { name: 'copy-done', page: 'workout', run: async p => { await p.selectOption('#fDay', 'mon'); await p.click('#copyDayBtn'); await p.click('#cpDays button[data-d="thu"]'); await p.click('#cpDays button[data-d="sat"]'); await p.click('#cpGo'); await p.waitForTimeout(300); return '#cpWrap .sh'; } },
  { name: 'copy-replace-note', page: 'workout', run: async p => { await p.selectOption('#fDay', 'wed'); await p.click('#copyDayBtn'); await p.click('#cpMode button[data-m="replace"]'); return '#cpWrap .sh'; } },
  { name: 'copy-empty-day', page: 'workout', run: async p => { await p.selectOption('#fDay', 'sun'); await p.click('#copyDayBtn'); return '#cpWrap .sh'; } },
];
const ACTS = [
  { name: 'datepicker', page: 'body', run: async p => { await p.click('#dateBtn'); return '#dpWrap'; } },
  { name: 'kcal-typed', page: 'body', run: async p => { await p.fill('#fKcal', '480+650'); await p.fill('#fProt', '27'); return '#fKcal >> xpath=ancestor::div[contains(@class,"form-grid")]'; } },
  { name: 'chart-press', page: 'body', run: async p => { const b = await p.locator('#wChart').boundingBox(); await p.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2); await p.mouse.down(); return '#wChart'; } },
  { name: 'chart-picked', page: 'body', run: async p => { const b = await p.locator('#wChart').boundingBox(); await p.mouse.click(b.x + b.width * 0.3, b.y + b.height / 2); return '#wChart >> xpath=ancestor::div[contains(@class,"card")]'; } },
  { name: 'add-movement', page: 'workout', run: async p => { await p.click('#addMoveBtn'); return 'viewport'; } },
  { name: 'session-mon', page: 'workout', run: async p => { await p.selectOption('#fDay', 'mon'); return '#cardLog'; } },
  { name: 'plates', page: 'workout', run: async p => { await p.fill('#plGoal', '101'); await p.evaluate(() => { const d = document.getElementById('plSetup'); if (d) d.open = true; }); return '#cardPlates'; } },
  { name: 'fold-strength', page: 'workout', run: async p => { await p.click('button[data-fold="str"]'); return '#cardStr'; } },
];

// Wait until short-lived things are over: the 'Saved'/'Imported' message (gone after 2.4 s) and two screen refreshes.
async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('.saved.show'), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(250);
}
// The rebuild adds things on purpose: the "Copy this day to…" row, the How to use button and the fold button on every card. It is hidden while comparing
// with 8.1, and photographed on its own in the new-only runs below.
async function hideNew(page) { await page.addStyleTag({ content: '.copyrow,.tourrow,.plsides,.liftday,.dayrt,#cardRoutines,.foldbtn.corner{display:none!important}.foldlbl{padding-right:0!important}' }); }
async function showPage(page, pg) {
  await page.click(`#tabs button[data-pg="${pg}"]`);
  await page.waitForTimeout(150);
}
async function snap(page, sel, file, manifest) {
  try { await snapInner(page, sel, file, manifest); }
  catch (e) { manifest[path.relative(OUT, file)] = { png: 'missing', txt: 'missing', error: String(e.message).split('\n')[0] }; }
}
async function snapInner(page, sel, file, manifest) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let buf, text = '';
  if (sel === 'viewport') { buf = await page.screenshot({ animations: 'disabled', caret: 'hide' }); }
  else {
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
    await el.scrollIntoViewIfNeeded({ timeout: 3000 });
    buf = await el.screenshot({ animations: 'disabled', caret: 'hide', timeout: 5000 });
    text = String(await el.evaluate(n => n.innerText ?? n.textContent ?? ''));
  }
  fs.writeFileSync(file + '.png', buf);
  fs.writeFileSync(file + '.txt', text);
  manifest[path.relative(OUT, file)] = { png: sha(buf), txt: sha(Buffer.from(text)) };
}

const { server, url } = await start();
const browser = await chromium.launch();
const manifest = {}, problems = [];
fs.rmSync(OUT, { recursive: true, force: true });
try {
  for (const run of RUNS) {
    if (only && !run.name.includes(only)) continue;
    const dir = path.join(OUT, run.name);
    const { ctx, page, errors } = await openApp(browser, url, target, run);
    if (target === 'new' && !run.newOnly) await hideNew(page);
    if (run.welcome) await snap(page, 'viewport', path.join(dir, 'welcome'), manifest);
    if (run.importFile) {   // paste a backup into Settings > Import and confirm, like a person would
      await showPage(page, 'settings');
      await page.click('#importBtn');
      await page.fill('#importBox', fs.readFileSync(path.join(ROOT, 'tests/fixtures', run.importFile + '.json'), 'utf8'));
      await page.click('#loadBtn'); await page.waitForTimeout(100); await page.click('#loadBtn'); await page.waitForTimeout(400);
      await settle(page);
      await snap(page, '#syncMsg', path.join(dir, 'import-message'), manifest);
      await showPage(page, 'body');
    }
    if (run.pages) {
      await snap(page, 'header', path.join(dir, 'top/header'), manifest);
      await snap(page, '#sched', path.join(dir, 'top/sched'), manifest);
      await snap(page, '#tabs', path.join(dir, 'top/tabs'), manifest);
      await snap(page, '#dayBar', path.join(dir, 'top/daybar'), manifest);
      for (const pg of (Array.isArray(run.pages) ? run.pages : PAGES)) {
        await showPage(page, pg);
        const cards = page.locator(`#pg-${pg} > .card`);
        const n = await cards.count();
        // numbered among the visible cards only, so a card the newer app adds (hidden while recording) shifts nothing
        for (let i = 0, shown = 0; i < n; i++) {
          const c = cards.nth(i);
          if (!(await c.isVisible())) continue;
          const id = (await c.getAttribute('id')) || 'card';
          await snap(page, c, path.join(dir, pg, String(shown++).padStart(2, '0') + '-' + id), manifest);
        }
      }
    }
    await ctx.close();
    if (run.acts) for (const act of (run.actList === 'copy' ? COPY_ACTS : ACTS)) {
      const o = await openApp(browser, url, target, run);
      if (target === 'new' && !run.newOnly) await hideNew(o.page);
      await showPage(o.page, act.page);
      const sel = await act.run(o.page);
      await o.page.waitForTimeout(150); await settle(o.page);
      await snap(o.page, sel, path.join(dir, 'acts', act.name), manifest);
      errors.push(...o.errors);
      await o.ctx.close();
    }
    if (errors.length) problems.push(run.name + ': ' + [...new Set(errors)].join(' | '));
    process.stdout.write(run.name + ' ');
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('\n' + Object.keys(manifest).length + ' pictures recorded for ' + target);
if (problems.length) { console.log('PAGE ERRORS:\n' + problems.join('\n')); process.exitCode = 1; }
