// Checks coaching headroom: a weight step that was too big sends you back to the old weight until every set
// reaches the top of the range plus the headroom; then it tries the heavier weight again. Also checks the
// editor field and the "Lifted today" line under the strength trend.   node tests/headroom.mjs
import path from 'node:path';
import * as esbuild from 'esbuild';
import { ROOT, chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const out = await esbuild.build({ stdin: { contents: "export * from './core/index';", resolveDir: path.join(ROOT, 'src'), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node' });
const C = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const S = (kg, ...reps) => reps.map(r => ({ kg, reps: r }));
const ex = { unit: null, added: false, repMin: 3, repMax: 6, step: 2.5, def: 0 };   // headroom left at its default (2)
const say = p => `${p.kind} ${p.load} kg × ${p.targets.join(',')}`;

// the case from the message: 3–6, two clean sessions at 30 kg, up to 32.5 kg, only 1–2 reps
let h = [S(30, 6, 6), S(30, 6, 6)];
let p = C.coachNext(ex, h);
ok(p.kind === 'up' && p.load === 32.5, 'two clean sessions at the top: up to 32.5 kg (' + say(p) + ')');
h.push(S(32.5, 2, 1));
p = C.coachNext(ex, h);
ok(p.kind === 'back' && p.load === 30 && p.fail === 32.5 && p.top === 8, 'only 2 and 1 reps at 32.5 kg: back to 30 kg, aiming for 8 (' + say(p) + ')');
ok(p.targets.every(r => r === 7), 'next time: at least 7 on every set at 30 kg (one more than the 6 done there)');
h.push(S(30, 7, 7));
p = C.coachNext(ex, h);
ok(p.kind === 'climb' && p.load === 30 && p.targets.every(r => r === 8), 'at 30 kg with 7, 7: stay, build to 8 (' + say(p) + ')');
h.push(S(30, 8, 7));
p = C.coachNext(ex, h);
ok(p.kind === 'climb' && p.load === 30, 'one set short of 8: stay at 30 kg (' + say(p) + ')');
h.push(S(30, 8, 8));
p = C.coachNext(ex, h);
ok(p.kind === 'retry' && p.load === 32.5 && p.targets.every(r => r === 3), 'every set reached 8: try 32.5 kg again, from 3 reps (' + say(p) + ')');
h.push(S(32.5, 4, 3));
p = C.coachNext(ex, h);
ok(p.kind === 'reps' && p.load === 32.5, 'the retry worked (4, 3): normal coaching at 32.5 kg (' + say(p) + ')');
// a second failed jump later on starts the same again
h.push(S(32.5, 6, 6), S(32.5, 6, 6), S(35, 2, 2));
p = C.coachNext(ex, h);
ok(p.kind === 'back' && p.load === 32.5 && p.fail === 35, 'a later failed jump to 35 kg: back to 32.5 kg (' + say(p) + ')');
// ignoring the advice and staying heavy: it respects that and coaches at the heavier weight
p = C.coachNext(ex, [S(30, 6, 6), S(32.5, 2, 1), S(32.5, 2, 2)]);
ok(p.kind === 'floor' && p.load === 32.5, 'if you stay at the heavier weight anyway, it coaches you there (' + say(p) + ')');
// a jump that worked (every set within the range) is not a miss
p = C.coachNext(ex, [S(30, 6, 6), S(32.5, 3, 3)]);
ok(p.kind === 'reps' && p.load === 32.5, 'a step up that stays in the range is fine (' + say(p) + ')');
// a bad day at the same weight is not a failed jump
p = C.coachNext(ex, [S(30, 5, 5), S(30, 2, 2)]);
ok(p.kind === 'floor' && p.load === 30, 'a bad day at the same weight: no going back (' + say(p) + ')');
// headroom 0 means off: exactly the old behaviour
p = C.coachNext({ ...ex, head: 0 }, [S(30, 6, 6), S(32.5, 2, 1)]);
ok(p.kind === 'floor' && p.load === 32.5, 'headroom 0: the old rule, stay at 32.5 kg (' + say(p) + ')');
p = C.coachNext({ ...ex, head: 4 }, [S(30, 6, 6), S(32.5, 2, 1)]);
ok(p.kind === 'back' && p.top === 10, 'headroom 4: build to 10 before trying again');
// holds and movements with no weight step never use it
p = C.coachNext({ ...ex, step: 0 }, [S(30, 6, 6), S(32.5, 2, 1)]);
ok(p.kind === 'floor', 'no weight step set: headroom does not apply');
p = C.coachNext({ ...ex, unit: 'sec', repMin: 20, repMax: 40, step: 5 }, [S(0, 40, 40), S(5, 10, 10)]);
ok(p.kind !== 'back' && p.kind !== 'climb', 'holds in seconds: headroom does not apply');
// bodyweight + kg works the same on the added weight
p = C.coachNext({ ...ex, added: true }, [S(10, 6, 6), S(12.5, 1, 1)]);
ok(p.kind === 'back' && p.load === 10, 'bodyweight + kg: back to +10 kg');

// ---- in the app ----
const { server, url } = await start();
const browser = await chromium.launch();
try {
{
  const store = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
  const o = await openApp(browser, url, 'new', { store });
  const pg = o.page;
  // Lifted today: the fixture clock is Tue 10 Nov 2026
  await pg.click('#tabs button[data-pg="workout"]'); await pg.waitForTimeout(200);
  const want = await pg.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('tally:entries:v1')).find(x => x.date === '2026-11-10');
    const exs = Object.fromEntries(JSON.parse(localStorage.getItem('tally:exercises:v1')).map(x => [x.key, x]));
    let kg = 0, n = 0;
    Object.keys((e && e.lifts) || {}).forEach(k => (e.lifts[k] || []).filter(s => s && s.reps > 0).forEach(s => { n++; if (exs[k].unit !== 'sec') kg += ((exs[k].added ? e.weight : 0) + (s.kg || 0)) * s.reps; }));
    return { kg: Math.round(kg), n };
  });
  const line = await pg.textContent('#strToday');
  ok(want.n ? line === `Lifted today: ${want.kg.toLocaleString('en-GB')} kg across ${want.n} sets` : line === 'Nothing lifted yet today.', 'the line under the strength trend: "' + line + '"');
  ok(!want.n, '(the sample data has no lifting on its test day)');
  await o.ctx.close();
}
{
  // the same data with Monday's session (bench, overhead press, lateral raise) also done on the test day
  const store = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
  const ents = JSON.parse(store['tally:entries:v1']), mon = ents.find(x => x.date === '2026-11-09');
  let tue = ents.find(x => x.date === '2026-11-10'); if (!tue) { tue = { date: '2026-11-10' }; ents.push(tue); }
  tue.lifts = JSON.parse(JSON.stringify(mon.lifts)); tue.lifts.cx_pullup = [{ kg: 5, reps: 8 }];
  store['tally:entries:v1'] = JSON.stringify(ents);
  const o = await openApp(browser, url, 'new', { store });
  const pg = o.page;
  await pg.click('#tabs button[data-pg="workout"]'); await pg.waitForTimeout(200);
  const exs = Object.fromEntries(JSON.parse(store['tally:exercises:v1']).map(x => [x.key, x]));
  const bw = tue.weight != null ? tue.weight : [...ents].reverse().find(x => x.weight != null).weight;
  let kg = 0, n = 0;
  Object.keys(tue.lifts).forEach(k => tue.lifts[k].filter(s => s && s.reps > 0).forEach(s => { n++; if (exs[k].unit !== 'sec') kg += ((exs[k].added ? bw : 0) + (s.kg || 0)) * s.reps; }));
  const line = await pg.textContent('#strToday');
  ok(n > 3 && line === `Lifted today: ${Math.round(kg).toLocaleString('en-GB')} kg across ${n} sets`, `with lifting logged today: "${line}" (worked out: ${Math.round(kg)} kg, ${n} sets, pull-ups counted with body weight ${bw} kg)`);
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
}
{
  const store = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };
  const o = await openApp(browser, url, 'new', { store });
  const pg = o.page;
  await pg.click('#tabs button[data-pg="workout"]'); await pg.waitForTimeout(200);
  // editor: Headroom field, filled with 2 when coaching is switched on, hidden with no step or for seconds
  await pg.evaluate(() => document.querySelector('[data-cedit="cx_barbellbenchpress"]').click()); await pg.waitForTimeout(200);
  await pg.click('#shGoal button[data-g="strength"]');
  ok(await pg.isVisible('#shHead') && await pg.inputValue('#shHead') === '2', 'the Headroom field shows 2 when coaching is switched on');
  ok(/Headroom 2: .* below 3, .* reaches 8/.test(await pg.textContent('#shCoachNote')), 'the note explains it with these numbers');
  await pg.fill('#shStep', ''); await pg.dispatchEvent('#shStep', 'input');
  ok(!(await pg.isVisible('#shHead')), 'hidden with no weight step');
  await pg.fill('#shStep', '2.5'); await pg.dispatchEvent('#shStep', 'input');
  await pg.fill('#shHead', '3'); await pg.dispatchEvent('#shHead', 'input');
  ok(/reaches 9/.test(await pg.textContent('#shCoachNote')), 'changing it updates the note (6 + 3 = 9)');
  await pg.click('#shCreate'); await pg.waitForTimeout(400);
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('tally:exercises:v1')).find(x => x.key === 'cx_barbellbenchpress'));
  ok(saved.repMin === 3 && saved.repMax === 6 && saved.head === 3, 'saved with headroom 3');
  await pg.evaluate(() => document.querySelector('[data-cedit="cx_barbellbenchpress"]').click()); await pg.waitForTimeout(200);
  ok(await pg.inputValue('#shHead') === '3', 'and shown again when reopened');
  await pg.click('#shMode button[data-m="sec"]'); await pg.waitForTimeout(100);
  ok(!(await pg.isVisible('#shHead')), 'hidden for holds in seconds');
  await pg.click('#shCancelNew');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();
}
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} headroom check(s) FAILED` : 'all headroom checks passed');
if (fails) process.exitCode = 1;
