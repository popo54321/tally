// Checks routines (9.4): weekday pins turn into routines without changing the plan, routines are made and
// edited per kind (workout, stretch, cardio), several on one weekday show up together, supersets, rest after
// the round, older versions editing the plan, backups.   node tests/routines.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const SEEN = { 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
const base = () => ({ ...fixture('full-male'), ...SEEN });
const routines = p => p.evaluate(() => JSON.parse(localStorage.getItem('tally:routines:v1')));
const plan = p => p.evaluate(() => JSON.parse(localStorage.getItem('tally:plan:v1')));
// the same contents, whatever order the weekdays were saved in
const canon = x => Array.isArray(x) ? x.map(canon) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x;
const samePlan = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const byName = (R, kind, name) => R[kind].find(r => r.name === name);
const logNames = p => p.evaluate(() => [...document.querySelectorAll('#exWrap .ex')].map(b => b.querySelector('[id^="sets-"]').id.slice(5)));
const tags = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(x => x.textContent.trim()), sel);
const session = async (p, d) => { await p.selectOption('#fDay', d); await p.waitForTimeout(150); };
const open = async (store, viewport = 'phone') => { const o = await openApp(browser, url, 'new', { store, viewport }); await o.page.click('#tabs button[data-pg="workout"]'); await o.page.waitForTimeout(200); return o; };
const edit = async (p, kind, name) => {
  await p.click(`#rtKind button[data-k="${kind}"]`);
  const id = (await routines(p))[kind].find(r => r.name === name).id;
  await p.click(`#rtRows [data-rtedit="${id}"]`); await p.waitForTimeout(100);
};

try {
  // ---- 1. pins become routines; the plan older versions read is unchanged ----
  {
    const store = base();
    const pl = JSON.parse(store['tally:plan:v1']);
    pl.sun = ['cx_deadlift', 'cx_pullup']; pl.thu = ['cx_deadlift', 'cx_pullup'];   // identical days share one routine
    pl.sat = pl.wed.slice();
    store['tally:plan:v1'] = JSON.stringify(pl);
    const o = await open(store), p = o.page;
    const R = await routines(p);
    ok(R && R.lift.map(r => r.name).sort().join('|') === ['Friday', 'Monday', 'Sun + Thu', 'Wed + Sat'].sort().join('|'), 'workout routines made from the pins: ' + R.lift.map(r => r.name).join(', '));
    ok(JSON.stringify(R.week.lift.sun) === JSON.stringify(R.week.lift.thu) && R.week.lift.sun.length === 1, 'Sunday and Thursday share one routine');
    ok(byName(R, 'lift', 'Monday').items[0].sets === 4 && byName(R, 'lift', 'Friday').items[0].sets === 2, 'planned set counts carried over (bench 4, deadlift 2)');
    ok(R.sx.map(r => r.name).join(',') === 'Monday,Wednesday,Friday' && R.cd.map(r => r.name).join(',') === 'Tuesday,Saturday', 'stretch and cardio routines kept separate: ' + R.sx.map(r => r.name) + ' / ' + R.cd.map(r => r.name));
    const now = await plan(p);
    ok(samePlan(now, pl), 'the weekly plan older versions read is exactly as before');
    ok((await p.textContent('#fDay')).includes('Monday · barbell bench'), 'a routine still named after its weekday: the session lists its movements, as before');
    await session(p, 'mon');
    ok((await tags(p, '#exWrap .xtag')).every(x => x === 'Monday'), 'movements are tagged with the routine they come from');
    ok(await p.$$eval('#rtRows .rtrow', r => r.length) === 4, 'the Routines card lists the four workout routines');
    ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
    await o.ctx.close();
  }
  // a plan saved before stretches and cardio were pinned to days: every stretch on every day
  {
    const store = base(); const pl = JSON.parse(store['tally:plan:v1']); delete pl.sx; delete pl.cd; store['tally:plan:v1'] = JSON.stringify(pl);
    const o = await open(store), R = await routines(o.page);
    ok(R.sx.length === 1 && R.sx[0].name === 'Every day' && Object.keys(R.week.sx).length === 7, 'an old plan with stretches on every day becomes one "Every day" stretch routine');
    await o.ctx.close();
  }

  // ---- 2. make and edit routines; supersets and rest after the round ----
  const o = await open(base()), p = o.page;
  await edit(p, 'lift', 'Monday');
  await p.fill('#rtName', 'Push A');
  await p.click('#rtItems .rtlink[data-link="0"]');                         // bench + overhead press
  await p.fill('#rtItems .rtitem[data-i="2"] .rtset', '2');                 // lateral raise: 2 sets
  await p.click('#rtAddBtn'); await p.fill('#rtSearch', 'curl'); await p.click('#rtPool button');
  await p.click('#rtDays button[data-d="thu"]');
  await p.click('#rtSave'); await p.waitForTimeout(300);
  let R = await routines(p), push = byName(R, 'lift', 'Push A');
  ok(push && push.items.map(i => i.k).join(',') === 'cx_barbellbenchpress,cx_overheadpress,cx_dumbbelllateralraise,cx_dumbbellcurl', 'saved: renamed, curl added at the end');
  ok(push.items[0].link === true && !push.items[1].link && push.items[2].sets === 2, 'superset link and set count saved');
  ok(JSON.stringify(R.week.lift.mon) === JSON.stringify([push.id]) && JSON.stringify(R.week.lift.thu) === JSON.stringify([push.id]), 'on Monday and now Thursday');
  let pl = await plan(p);
  ok(pl.thu.join(',') === push.items.map(i => i.k).join(',') && pl.sets.thu.cx_dumbbelllateralraise === 2, 'the weekly plan follows (older versions see Thursday too)');
  await session(p, 'mon');
  ok((await p.textContent('#fDay')).includes('Monday · Push A'), 'the session is named after the routine');
  ok(await p.$$eval('#exWrap .ssgroup .ex', b => b.length) === 2, 'bench and overhead press are grouped as a superset');
  ok(await p.$$eval('#sets-cx_barbellbenchpress .rmnext', b => b.length) === 4 && await p.$$eval('#sets-cx_barbellbenchpress .rmrest', b => b.length) === 0, 'the first in the superset has → instead of rest');
  ok(await p.$$eval('#sets-cx_dumbbelllateralraise .setrow', r => r.length) === 2, 'lateral raise shows its 2 planned sets');
  await p.click('#sets-cx_barbellbenchpress .setrow:nth-child(2) .rmnext'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.activeElement.classList.contains('rp') && document.activeElement.closest('.sets').id === 'sets-cx_overheadpress' && [...document.activeElement.closest('.sets').children].indexOf(document.activeElement.closest('.setrow')) === 1), '→ on set 2 goes to set 2 of overhead press');
  ok(await p.getAttribute('#sets-cx_overheadpress .rmrest', 'title') === 'Start rest: the superset round is done', 'the last one in the superset starts the rest');
  await p.click('#sets-cx_overheadpress .rmrest'); await p.waitForTimeout(200);
  ok(/bench pr.* \+ overhead pr/i.test(await p.textContent('#restWho')), 'the rest names the whole round: ' + await p.textContent('#restWho'));
  await p.click('#restStop');

  // ---- 3. several routines of each kind on one weekday show up together ----
  await p.click('#dayRtAdd');
  const fri = byName(R, 'lift', 'Friday'), wedSx = byName(R, 'sx', 'Wednesday'), tueCd = byName(R, 'cd', 'Tuesday');
  await p.click(`#dayRtPick [data-rid="${fri.id}"]`); await p.waitForTimeout(250);
  // the list stays open, so several can be added in a row
  await p.click(`#dayRtPick [data-rid="${wedSx.id}"]`); await p.waitForTimeout(250);
  await p.click(`#dayRtPick [data-rid="${tueCd.id}"]`); await p.waitForTimeout(250);
  ok(!(await p.$(`#dayRtPick [data-rid="${tueCd.id}"]`)), 'routines already on the day drop out of the list');
  await p.click('#dayRtAdd');
  const chips = await tags(p, '#dayRtList .rtchip');
  ok(chips.length === 5 && chips[0].startsWith('Push A') && chips[1].startsWith('Friday'), 'Monday now has 2 workout, 2 stretch and 1 cardio routine: ' + chips.join(' / '));
  const names = await logNames(p);
  ok(names.join(',') === 'cx_barbellbenchpress,cx_overheadpress,cx_dumbbelllateralraise,cx_dumbbellcurl,cx_deadlift,cx_barbellrow,cx_pullup', 'the two workout routines combine in order, the curl (in both) only once');
  const mob = await p.evaluate(() => [...document.querySelectorAll('#mobWrap .mobrow')].map(r => r.dataset.k));
  ok(['sx_couchstretch', 'sx_pigeonpose', 'sx_catcow'].every(k => mob.includes(k)), 'both stretch routines show in the mobility card');
  ok(await p.evaluate(() => [...document.querySelectorAll('#cdWrap .mobrow')].some(r => r.dataset.k === 'cd_walking')), 'the cardio routine shows in the cardio card');
  ok((await tags(p, '#cdWrap .xtag')).includes('Tuesday'), 'tagged with the cardio routine it comes from');
  pl = await plan(p);
  ok(pl.mon.includes('cx_deadlift') && pl.sx.mon.includes('sx_catcow') && pl.cd.mon.includes('cd_walking'), 'the plan has it all on Monday');
  await p.click(`#dayRtList button[data-rid="${fri.id}"]`); await p.waitForTimeout(250);
  ok(!(await logNames(p)).includes('cx_deadlift') && (await routines(p)).week.lift.fri.includes(fri.id), '✕ takes Friday\'s routine off Monday only');

  // ---- 4. dropping a movement from a day's log leaves the routine alone ----
  await p.click('#sets-cx_dumbbelllateralraise >> xpath=ancestor::div[contains(@class,"ex")][1] >> .exdrop'); await p.waitForTimeout(200);
  ok(!(await logNames(p)).includes('cx_dumbbelllateralraise') && byName(await routines(p), 'lift', 'Push A').items.length === 4, '✕ on a movement drops it from this day only; the routine keeps it');
  await session(p, 'wed'); await session(p, 'mon');
  ok(!(await logNames(p)).includes('cx_dumbbelllateralraise'), 'and it stays off while you switch sessions');

  // ---- 5. hiding and deleting movements ----
  await p.evaluate(() => document.querySelector('[data-cret="cx_overheadpress"]').click()); await p.waitForTimeout(200);
  await session(p, 'wed'); await session(p, 'mon');   // (as in 8.1, an open log keeps it until it is redrawn)
  ok(!(await logNames(p)).includes('cx_overheadpress') && byName(await routines(p), 'lift', 'Push A').items.some(i => i.k === 'cx_overheadpress'), 'a hidden movement leaves the log but stays in its routine');
  await p.evaluate(() => document.querySelector('[data-cret="cx_overheadpress"]').click()); await p.waitForTimeout(200);
  await session(p, 'wed'); await session(p, 'mon');
  ok((await logNames(p)).includes('cx_overheadpress'), 'shown again, it is back');
  await p.evaluate(() => document.querySelector('[data-cedit="cx_legpress"]').click()); await p.waitForTimeout(150);
  await p.click('#shDelete'); await p.click('#shDelete'); await p.waitForTimeout(300);
  ok(!byName(await routines(p), 'lift', 'Wednesday').items.some(i => i.k === 'cx_legpress'), 'a deleted movement is removed from its routines');

  // ---- 6. checks in the editor; deleting a routine ----
  await p.click('#rtKind button[data-k="lift"]'); await p.click('#rtNew'); await p.click('#rtSave');
  ok(/name/i.test(await p.textContent('#rtMsg')), 'a new routine needs a name');
  await p.fill('#rtName', 'Push A'); await p.click('#rtPool button'); await p.click('#rtSave');
  ok(/already have a routine called/.test(await p.textContent('#rtMsg')), 'two routines of one kind cannot share a name');
  await p.click('#rtCancel');
  await edit(p, 'lift', 'Friday'); await p.click('#rtDelete'); await p.click('#rtDelete'); await p.waitForTimeout(300);
  R = await routines(p);
  ok(!byName(R, 'lift', 'Friday') && !R.week.lift.fri && !(await plan(p)).fri, 'a deleted routine is gone from its weekdays and from the plan');
  // a stretch routine of its own
  await p.click('#rtKind button[data-k="sx"]'); await p.click('#rtNew'); await p.fill('#rtName', 'Hips');
  await p.click('#rtPool button[data-k="sx_pigeonpose"]'); await p.click('#rtPool button[data-k="sx_couchstretch"]'); await p.click('#rtDays button[data-d="sat"]');
  ok(await p.$$eval('#rtItems .rtset', x => x.length) === 0 && await p.$$eval('#rtItems .rtlink', x => x.length) === 0, 'stretch routines have no sets or supersets');
  await p.click('#rtSave'); await p.waitForTimeout(300);
  ok((await plan(p)).sx.sat.join(',') === 'sx_pigeonpose,sx_couchstretch', 'a new stretch routine on Saturday');

  // ---- 7. the pickers have no pin buttons any more ----
  await p.click('#addMoveBtn'); await p.waitForTimeout(150);
  ok(await p.$$eval('#shList [data-pin], #shList [data-libpin]', x => x.length) === 0 && await p.$$eval('#shList [data-add]', x => x.length) > 0, 'movement picker: Add only, no "Pin to …"');
  await p.keyboard.press('Escape');
  await p.click('#addStretchBtn').catch(() => p.click('#mobAdd')); await p.waitForTimeout(150);
  ok(await p.$$eval('#kpList [data-kpin], #kpList [data-lpin]', x => x.length) === 0, 'stretch picker: no pin buttons');
  await p.keyboard.press('Escape');

  // ---- 8. backups carry routines ----
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#exportBtn'); await p.waitForTimeout(300);
  const backup = await p.inputValue('#exportBox');
  const bj = JSON.parse(backup);
  ok(bj.routines && byName(bj.routines, 'lift', 'Push A') && bj.plan && bj.version === 4, 'the backup has the routines, and still the plan for older versions');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  const saved = await p.evaluate(() => ({ r: localStorage.getItem('tally:routines:v1'), p: localStorage.getItem('tally:plan:v1') }));
  await o.ctx.close();
  {
    const o2 = await open({ ...SEEN }), q = o2.page;
    await q.click('#tabs button[data-pg="settings"]'); await q.click('#importBtn'); await q.fill('#importBox', backup);
    await q.click('#loadBtn'); await q.waitForTimeout(100); await q.click('#loadBtn'); await q.waitForTimeout(500);
    const R2 = await routines(q), p2 = byName(R2, 'lift', 'Push A');
    ok(p2 && p2.items[0].link && byName(R2, 'sx', 'Hips'), 'importing it into an empty app brings the routines back, superset and all');
    await q.click('#tabs button[data-pg="settings"]'); await q.click('#importBtn');
    await q.fill('#importBox', fs.readFileSync(path.join(ROOT, 'tests/fixtures/backup-v4.json'), 'utf8'));
    await q.click('#loadBtn'); await q.waitForTimeout(100); await q.click('#loadBtn'); await q.waitForTimeout(500);
    const R3 = await routines(q);
    ok(R3.lift.length > 0 && R3.lift.every(r => !/Push A/.test(r.name)), 'an 8.1 backup (no routines) gets routines made from its plan: ' + R3.lift.map(r => r.name).join(', '));
    ok(o2.errors.length === 0, 'no page errors (' + o2.errors.join(' | ') + ')');
    await o2.ctx.close();
  }

  // ---- 9. an older version changed the plan meanwhile ----
  {
    const store = base(); store['tally:routines:v1'] = saved.r;
    const pl2 = JSON.parse(saved.p);
    pl2.wed = ['cx_backsquat', 'cx_plank', 'cx_pullup'];      // the old app changed Wednesday's pins
    pl2.tue = ['cx_dumbbellcurl'];                           // and pinned a movement on Tuesday
    store['tally:plan:v1'] = JSON.stringify(pl2);
    const o3 = await open(store), q = o3.page, R4 = await routines(q);
    ok(byName(R4, 'lift', 'Wednesday').items.map(i => i.k).join(',') === 'cx_backsquat,cx_plank,cx_pullup', 'Wednesday\'s own routine follows the older version\'s change, keeping its name');
    ok(byName(R4, 'lift', 'Push A').items[0].link === true && byName(R4, 'lift', 'Push A').items.length === 4, 'routines it did not touch keep their name and supersets');
    ok(byName(R4, 'lift', 'Tuesday') && R4.week.lift.tue.length === 1, 'the new Tuesday pin becomes a "Tuesday" routine');
    ok(samePlan(await plan(q), pl2), 'and the plan stays as the older version left it');
    ok(o3.errors.length === 0, 'no page errors (' + o3.errors.join(' | ') + ')');
    await o3.ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} routine check(s) FAILED` : 'all routine checks passed');
if (fails) process.exitCode = 1;
