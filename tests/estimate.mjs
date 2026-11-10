// Checks the maintenance estimate against people whose true maintenance is known: simulated logs with
// realistic food and weigh-in wobble. Compares the 8.1 method (straight-line fit, logs only) with 9.1
// (outlier-proof line, ± range, blended with the formula estimate).   node tests/estimate.mjs
import path from 'node:path';
import * as esbuild from 'esbuild';
import { ROOT } from './harness.mjs';

const out = await esbuild.build({ stdin: { contents: "export * from './core/index';", resolveDir: path.join(ROOT, 'src'), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node' });
const C = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// seeded random numbers, and a bell-curve draw
let seed = 12345; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const date = i => new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10);

// The 8.1 method, exactly as it was: ordinary straight-line fit through the weigh-ins, logs only.
function old81(win) {
  const wd = win.filter(e => e.weight != null).map(e => ({ t: C.dnum(e.date), w: e.weight }));
  if (wd.length < 2) return null;
  const n = wd.length, tb = wd.reduce((s, p) => s + p.t, 0) / n, wb = wd.reduce((s, p) => s + p.w, 0) / n;
  let nu = 0, de = 0; wd.forEach(p => { nu += (p.t - tb) * (p.w - wb); de += (p.t - tb) ** 2; });
  const firstT = wd[0].t, lastT = wd[wd.length - 1].t;
  const k = win.filter(e => e.kcal != null && C.dnum(e.date) >= firstT && C.dnum(e.date) <= lastT - 1).map(e => e.kcal);
  if (!k.length || !de) return null;
  return k.reduce((a, b) => a + b, 0) / k.length - nu / de * 7700;
}

// A simulated person: true maintenance, daily intake around a target, real weight change from the energy
// balance, plus water wobble on each weigh-in (and now and then a salty or big-training-day spike).
function person(days, { profile = true, spikes = true } = {}) {
  const tdee = 1800 + rnd() * 1500, target = tdee - 300 + rnd() * 500, out = [];
  let mass = 60 + rnd() * 45;
  for (let i = 0; i < days; i++) {
    const kcal = Math.max(0, Math.round(target + gauss() * 380));
    const e = { date: date(i) };
    if (rnd() < 0.85) e.kcal = kcal;
    if (rnd() < 0.8) e.weight = Math.round((mass + gauss() * 0.35 + (spikes && rnd() < 0.05 ? 1 + rnd() : 0)) * 10) / 10;
    if (i === 0) e.height = 160 + Math.round(rnd() * 30);
    out.push(e);
    mass += (kcal - tdee) / 7700;
  }
  // the formula is typically within a tenth of the truth: pick the age that makes it land there
  const formulaTrue = tdee * (1 + gauss() * 0.10);
  const h = out[0].height, w = out.filter(e => e.weight != null).slice(-1)[0].weight, sex = rnd() < 0.5 ? 'male' : 'female';
  const bmrWanted = formulaTrue / 1.55, age = Math.round((10 * w + 6.25 * h + (sex === 'female' ? -161 : 5) - bmrWanted) / 5);
  const o = profile && age >= 10 && age <= 120 ? { sex, age, activity: 'mod' } : { sex, age: null, activity: 'mod' };
  return { tdee, days: out, o };
}

// 1. Against the truth, for 14-, 28- and 91-day windows, after 2, 3, 5 and 13 weeks of logging.
console.log('\nAverage error against the true maintenance (kcal), 2,000 simulated people each:');
console.log('logging   window   8.1 method   9.1 method   9.1 range covers the truth');
const stats = {};
for (const [weeks, period] of [[2, 14], [3, 28], [5, 28], [13, 91]]) {
  let eOld = 0, eNew = 0, nOld = 0, nNew = 0, inside = 0;
  for (let i = 0; i < 2000; i++) {
    const p = person(weeks * 7);
    const win = C.entriesInWindow(p.days, period), a = old81(win);
    const r = C.calRecommend(p.days, { calPeriod: period, sex: p.o.sex, calRate: 0, age: p.o.age, activity: p.o.activity });
    if (a != null) { eOld += Math.abs(a - p.tdee); nOld++; }
    if (r.tdee != null) { eNew += Math.abs(r.tdee - p.tdee); nNew++; if (Math.abs(r.tdee - p.tdee) <= r.sd) inside++; }
  }
  stats[weeks] = { old: eOld / nOld, neu: eNew / nNew, cover: inside / nNew };
  console.log(`${String(weeks).padStart(2)} weeks  ${String(period).padStart(3)} days   ${(eOld / nOld).toFixed(0).padStart(6)}       ${(eNew / nNew).toFixed(0).padStart(6)}       ${(100 * inside / nNew).toFixed(0)}%`);
}
ok(stats[2].neu < stats[2].old * 0.85, 'after 2 weeks the new estimate is clearly closer to the truth');
ok(stats[3].neu < stats[3].old && stats[5].neu < stats[5].old, 'after 3 and 5 weeks it is closer to the truth');
ok(stats[13].neu <= stats[13].old * 1.05, 'after 13 weeks it is at least as close (logs dominate)');
ok(Object.values(stats).every(s => s.cover >= 0.6), 'the ± range is never overconfident: it covers the truth at least 6 times in 10 (wider for long windows, where it keeps a small allowance for real-life logging drift that the simulation does not have)');

// 2. One odd weigh-in barely moves the new line.
{
  const days = []; for (let i = 0; i < 28; i++) days.push({ date: date(i), weight: Math.round((85 - i * 0.07 + gauss() * 0.2) * 10) / 10, kcal: 2200 });
  const base = C.calcCalibration(days).tdee, oldBase = old81(days);
  days[27].weight += 1.8;
  const spiked = C.calcCalibration(days).tdee, oldSpiked = old81(days);
  console.log(`\nOne weigh-in 1.8 kg heavy on the last day: 8.1 moves by ${Math.abs(oldSpiked - oldBase).toFixed(0)} kcal, 9.1 by ${Math.abs(spiked - base).toFixed(0)} kcal`);
  ok(Math.abs(spiked - base) < Math.abs(oldSpiked - oldBase) / 2, 'a single odd weigh-in moves the new estimate less than half as much');
}

// 3. Steadier from one day to the next as the window slides.
{
  let jOld = 0, jNew = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const p = person(90);
    let pa = null, pb = null;
    for (let d = 40; d <= 90; d++) {
      const part = p.days.slice(0, d), a = old81(C.entriesInWindow(part, 28));
      const b = C.calRecommend(part, { calPeriod: 28, sex: p.o.sex, calRate: 0, age: p.o.age, activity: p.o.activity }).tdee;
      if (pa != null && a != null && pb != null && b != null) { jOld += Math.abs(a - pa); jNew += Math.abs(b - pb); n++; }
      pa = a; pb = b;
    }
  }
  console.log(`Average change from one day to the next (28-day window): 8.1 ${(jOld / n).toFixed(0)} kcal, 9.1 ${(jNew / n).toFixed(0)} kcal`);
  ok(jNew < jOld, 'the new estimate lurches a little less from day to day');
}

// 4. How the blend behaves.
{
  const p = person(14), r = C.calRecommend(p.days, { calPeriod: 14, sex: p.o.sex, calRate: 0, age: 34, activity: 'mod' });
  const q = person(91), s = C.calRecommend(q.days, { calPeriod: 91, sex: q.o.sex, calRate: 0, age: 34, activity: 'mod' });
  const none = C.calRecommend(p.days, { calPeriod: 14, sex: p.o.sex, calRate: 0, age: null, activity: 'mod' });
  console.log(`Share from your logs: after 2 weeks ${(100 * r.logShare).toFixed(0)}%, after 13 weeks ${(100 * s.logShare).toFixed(0)}%`);
  ok(r.logShare < 0.8, 'after 2 weeks the formula still carries real weight');
  ok(s.logShare > 0.9, 'after 13 weeks it is almost all your own numbers');
  ok(none.logShare === 1 && none.formula === null && Math.abs(none.tdee - none.c.tdee) < 1e-9, 'without a profile the logs stand alone');
  ok(r.sd < none.sd, 'with a profile the range is narrower than logs alone');
}
console.log(fails ? `\n${fails} estimate check(s) FAILED` : '\nall estimate checks passed');
if (fails) process.exitCode = 1;
