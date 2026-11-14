// Checks for "Apply this coaching to other movements" in the movement editor.   node tests/coachapply.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const saved = p => p.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('tally:exercises:v1')).map(x => [x.key, x])));
const listed = p => p.evaluate(() => [...document.querySelectorAll('#shApplyList button')].map(b => b.dataset.k));
const edit = (p, k) => p.evaluate(k => { document.querySelector('#tabs button[data-pg="workout"]').click(); document.querySelector(`[data-cedit="${k}"]`).click(); }, k);

try {
  const o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' } });
  const p = o.page;
  const before = await saved(p);
  const kg = Object.values(before).filter(x => !x.retired && !x.added && x.unit !== 'sec').map(x => x.key);
  const bw = Object.values(before).filter(x => !x.retired && x.added && x.unit !== 'sec').map(x => x.key);
  await edit(p, 'cx_barbellbenchpress'); await p.waitForTimeout(200);
  ok(await p.isVisible('#shApplyBtn') && !(await p.isVisible('#shApplyBox')), 'the button is under the coaching settings, list closed');
  await p.click('#shApplyBtn');
  let l = await listed(p);
  ok(l.length === kg.length - 1 && !l.includes('cx_barbellbenchpress') && !l.some(k => bw.includes(k)),
    `only other kg movements are offered (${l.length} of ${Object.keys(before).length}), not the one being edited`);
  // switching the loading to bodyweight + kg swaps the list
  await p.click('#shMode button[data-m="bw"]'); await p.waitForTimeout(100);
  l = await listed(p);
  ok(bw.length > 0 && l.length === bw.length && l.every(k => bw.includes(k)), `with Bodyweight + kg the list shows those instead (${l.length})`);
  await p.click('#shMode button[data-m="kg"]'); await p.waitForTimeout(100);
  // pick Muscle 6–8 with a 2.5 kg step, tick two movements
  await p.click('#shGoal button[data-g="strength2"]'); await p.fill('#shStep', '2.5'); await p.dispatchEvent('#shStep', 'input');
  const [a, b, c] = (await listed(p));
  await p.click(`#shApplyList button[data-k="${a}"]`); await p.click(`#shApplyList button[data-k="${b}"]`);
  ok(/Apply to 2 more movements/.test(await p.textContent('#shApplyBtn')), 'the button counts the ticked movements');
  await p.click('#shCreate'); await p.waitForTimeout(400);
  let s = await saved(p);
  ok(s.cx_barbellbenchpress.repMin === 6 && s.cx_barbellbenchpress.repMax === 8 && s.cx_barbellbenchpress.step === 2.5, 'the edited movement is saved as 6–8, step 2.5');
  ok([a, b].every(k => s[k].repMin === 6 && s[k].repMax === 8 && s[k].step === 2.5), 'both ticked movements got 6–8, step 2.5');
  ok(s[c].repMin === before[c].repMin && s[c].repMax === before[c].repMax, 'an unticked movement is left alone');
  ok(/also set on 2 more movements/.test(await p.textContent('#flash, .flash, body')), 'the message says how many more were set');
  ok([a, b].every(k => JSON.stringify({ ...s[k], repMin: 0, repMax: 0, step: 0 }) === JSON.stringify({ ...before[k], repMin: 0, repMax: 0, step: 0 })), 'nothing else about them changed');
  // Select all, then Off, clears coaching everywhere of that kind
  await edit(p, 'cx_barbellbenchpress'); await p.waitForTimeout(200);
  ok(/^Apply this coaching/.test(await p.textContent('#shApplyBtn')), 'reopening starts with nothing ticked');
  await p.click('#shApplyBtn'); await p.click('#shApplyAll');
  ok(/Apply to \d+ more movements/.test(await p.textContent('#shApplyBtn')) && (await p.$$('#shApplyList button.on')).length === kg.length - 1, 'Select all ticks every movement in the list');
  await p.click('#shApplyNone');
  ok((await p.$$('#shApplyList button.on')).length === 0, 'None clears them');
  await p.click('#shApplyAll'); await p.click('#shGoal button[data-g="off"]');
  await p.click('#shCreate'); await p.waitForTimeout(400);
  s = await saved(p);
  ok(kg.every(k => s[k].repMin == null && s[k].repMax == null), 'Off with Select all clears coaching on every kg movement');
  ok(bw.every(k => s[k].repMin === before[k].repMin && s[k].repMax === before[k].repMax), 'bodyweight movements untouched');
  // Cancel throws the picks away
  await edit(p, 'cx_backsquat'); await p.waitForTimeout(200);
  await p.click('#shApplyBtn'); await p.click('#shApplyAll'); await p.click('#shGoal button[data-g="strength"]');
  await p.click('#shCancelNew'); await p.waitForTimeout(200);
  const afterCancel = await saved(p);
  ok(kg.every(k => afterCancel[k].repMin == null && afterCancel[k].repMax == null), 'Cancel saves nothing (all kg movements still Off)');
  // after a restart the coaching is still there
  await p.reload(); await p.waitForTimeout(600);
  ok((await saved(p))[a].repMin == null, 'and it survives a restart');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} coaching-apply check(s) FAILED` : 'all coaching-apply checks passed');
if (fails) process.exitCode = 1;
