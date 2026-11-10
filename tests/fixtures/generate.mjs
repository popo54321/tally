// Builds the sample data sets the tests use. It drives the frozen 8.1 app's own functions,
// so every stored value is exactly what the real app would have saved. Run: node tests/fixtures/generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openApp, ROOT } from '../harness.mjs';
import { start } from '../serve.mjs';

const SCENARIOS = {
  'full-male':   { seed: 11, sex: 'male',   days: 430, startKg: 92.4, endKg: 88.6, kcal: 2300, prot: 145, ownTargets: false, lb: false },
  'full-female': { seed: 23, sex: 'female', days: 300, startKg: 68.0, endKg: 63.9, kcal: 1750, prot: 100, ownTargets: true,  lb: true  },
  'sparse':      { seed: 37, sex: null,     days: 40,  startKg: 75.0, endKg: 74.2, kcal: 2100, prot: 110, ownTargets: false, lb: false, gaps: 0.55 },
};

async function build(page, sc) {
  return page.evaluate(async (sc) => {
    // seeded random numbers, so the data is the same every time
    let s = sc.seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)], r1 = v => Math.round(v * 10) / 10, r25 = v => Math.round(v / 2.5) * 2.5;
    const today = localDate(), plus = n => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };

    if (sc.sex) settings.sex = sc.sex;
    settings.age = sc.sex === 'female' ? 29 : 34; settings.ageSet = plus(-200);
    if (sc.ownTargets) { settings.kcalTarget = sc.kcal; settings.kcalOwn = true; settings.protFloor = sc.prot; }
    if (sc.lb) settings.plates = normPlates({ have: ['lb45', 'lb35', 'lb25', 'lb10', 'lb5', 'lb2.5'], bar: 'lb35', unit: 'lb' });
    await persistSettings();

    const lifts = ['bb_bench', 'back_squat', 'deadlift', 'ohp', 'bb_row', 'pullup', 'db_curl', 'plank', 'leg_press', 'lat_raise'];
    const K = {}; for (const l of lifts) K[l] = await libToCollection(l);
    const SX = {}; for (const k of ['couch', 'pigeon', 'cat_cow', 'band_dislocate']) SX[k] = await sxFromLib(k);
    const CD = {}; for (const k of ['walk', 'run', 'cycle']) CD[k] = await cdFromLib(k);
    stretches.find(x => x.key === SX.couch).sets = 2; await persistStretches();
    cardios.find(x => x.key === CD.run).sets = 3; await persistCardio();

    planExtras.mon = [K.bb_bench, K.ohp, K.lat_raise]; planExtras.wed = [K.back_squat, K.leg_press, K.plank];
    planExtras.fri = [K.deadlift, K.bb_row, K.pullup, K.db_curl];
    planSets.mon = { [K.bb_bench]: 4 }; planSets.fri = { [K.deadlift]: 2 };
    planSx.mon = [SX.couch, SX.pigeon]; planSx.wed = [SX.cat_cow]; planSx.fri = [SX.band_dislocate];
    planCd.tue = [CD.walk]; planCd.sat = [CD.run];
    await persistPlan();

    const start = { [K.bb_bench]: 60, [K.back_squat]: 80, [K.deadlift]: 100, [K.ohp]: 40, [K.bb_row]: 55, [K.leg_press]: 120, [K.lat_raise]: 8, [K.db_curl]: 12 };
    const E = [];
    for (let i = sc.days; i >= 0; i--) {
      if (sc.gaps && rnd() < sc.gaps) continue;
      const d = plus(-i), wd = weekdayKey(d), prog = 1 - i / sc.days, e = { date: d };
      if (rnd() < 0.85) e.weight = r1(sc.startKg + (sc.endKg - sc.startKg) * prog + (rnd() - 0.5) * 1.2);
      if (i === sc.days) e.height = sc.sex === 'female' ? 166 : 177;
      const fast = rnd() < 0.04;
      if (fast) { e.fast = true; if (rnd() < 0.5) { e.kcal = Math.round(300 + rnd() * 300); e.prot = Math.round(20 + rnd() * 20); } }
      else { if (rnd() < 0.8) e.kcal = Math.round(sc.kcal + (rnd() - 0.5) * 600); if (rnd() < 0.78) e.prot = Math.round(sc.prot + (rnd() - 0.5) * 50); }
      if (i % 7 === 3) { e.meas = {}; MEAS.forEach((m, j) => { if (rnd() < 0.8) e.meas[m.key] = r1((sc.sex === 'female' ? 40 : 45) + j * 7 - prog * (m.key === 'waist' ? 4 : 1) + rnd()); }); }
      const plan = planExtras[wd];
      if (plan && rnd() < 0.9 && i > 0) {
        e.lifts = {};
        plan.forEach(k => {
          const ex = exByKey(k), n = (planSets[wd] && planSets[wd][k]) || 3;
          e.lifts[k] = Array.from({ length: n }, (_, j) => ex.unit === 'sec' ? { kg: 0, reps: Math.round(40 + prog * 30 + rnd() * 10) }
            : ex.added ? { kg: prog > 0.5 ? 5 : 0, reps: Math.max(3, Math.round(6 + prog * 3 - j + rnd() * 2)) }
            : { kg: r25((start[k] || 20) * (1 + prog * 0.25)), reps: Math.max(3, Math.round(8 - j * 0.7 + rnd() * 2)) });
        });
      }
      const sx = planSx[wd]; if (sx && rnd() < 0.7) { e.mob = {}; e.mobSets = {}; sx.forEach(k => { const st = stretchByKey(k), n = st.sets || 1; const done = rnd() < 0.8 ? n : 1; e.mob[k] = sxTarget(st) * done; if (done > 1) e.mobSets[k] = done; }); }
      const cd = planCd[wd]; if (cd && rnd() < 0.75) { e.cardio = {}; e.cardioSets = {}; cd.forEach(k => { const c = cardios.find(x => x.key === k), n = c.sets || 1; e.cardio[k] = (c.mins || 20) * n; if (n > 1) e.cardioSets[k] = n; }); }
      if (rnd() < 0.05) e.cardio = Object.assign(e.cardio || {}, { [CD.cycle]: 45 });
      const ne = normEntry(e); if (ne) E.push(ne);
    }
    entries = normEntries(E); await persist();
    if (!sc.ownTargets) { const rec = calRecommend(); if (rec.target != null) { settings.kcalTarget = rec.target; await persistSettings(); } }
    const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('tally:')) out[k] = localStorage.getItem(k); }
    return out;
  }, sc);
}

const { server, url } = await start();
const browser = await chromium.launch();
try {
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const { ctx, page, errors } = await openApp(browser, url, 'old', { store: { 'tally:aboutSeen:v1': '1' } });
    const data = await build(page, sc);
    if (errors.length) throw new Error(name + ': ' + errors.join('; '));
    fs.writeFileSync(path.join(ROOT, 'tests/fixtures', name + '.json'), JSON.stringify(data, null, 1) + '\n');
    console.log(name, Object.keys(data).length, 'keys,', JSON.parse(data['tally:entries:v1']).length, 'days,', (JSON.stringify(data).length / 1024).toFixed(0), 'KB');
    await ctx.close();
  }
  // A backup file exactly as 8.1 writes it, and the bare list of days that older versions wrote.
  {
    const { ctx, page } = await openApp(browser, url, 'old', { store: JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/full-male.json'), 'utf8')) });
    fs.writeFileSync(path.join(ROOT, 'tests/fixtures/backup-v4.json'), await page.evaluate(() => exportPayload()) + '\n');
    await ctx.close();
    const sp = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/sparse.json'), 'utf8'));
    fs.writeFileSync(path.join(ROOT, 'tests/fixtures/backup-days-only.json'), sp['tally:entries:v1'] + '\n');
  }
  // Saved data with the quirks older versions left behind, which 8.1 quietly tidies on load.
  {
    const sp = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/sparse.json'), 'utf8'));
    const ents = JSON.parse(sp['tally:entries:v1']), st = JSON.parse(sp['tally:stretches:v2']), ex = JSON.parse(sp['tally:exercises:v1']);
    ents[0].weight = String(ents[0].weight);                       // numbers saved as text
    ents[1].mob = { [st[0].key]: true };                           // early "done" tick with no time
    ents.push(Object.assign({}, ents[2], { kcal: 999, weight: null })); // the same day twice
    ents.push({ date: '2026-02-30', weight: 80 });                 // impossible date
    const liftDay = ents.find(e => e.lifts && Object.keys(e.lifts).length);
    if (liftDay) { const k = Object.keys(liftDay.lifts)[0]; liftDay.lifts[k].push({ variant: 'band', reps: 12 }); }
    const settings = Object.assign(JSON.parse(sp['tally:settings:v1']), { protPerKg: 1.6, protFloor: 140, calPeriod: 'all', restSec: 5, oldThing: 1 });
    const plan = JSON.parse(sp['tally:plan:v1']); delete plan.sx; delete plan.cd;   // before stretches/cardio were pinned to days
    const data = Object.assign({}, sp, {
      'tally:entries:v1': JSON.stringify(ents), 'tally:settings:v1': JSON.stringify(settings), 'tally:plan:v1': JSON.stringify(plan),
      'tally:theme:v1': JSON.stringify({ font: 'zen', colors: { '--brass': '#AA3355', '--bg': 'bad' }, scale: 1.3 }),
      'tally:gym:v1': JSON.stringify({ set: true, have: ['barbell', 'bench', 'rack', 'nonsense'], own: [{ name: 'Sandbag 20 kg' }, { name: 'Sandbag 20 kg' }] }),
      'tally:exedits:v1': JSON.stringify({ [ex[0].key]: { name: 'My bench', short: 'mybench', group: 'chest' }, [ex[1].key]: { hidden: true } }),
      'training-log:entries': '[]', 'tally:stretches:v1': '[]', 'tally:lang:v1': 'en',
    });
    fs.writeFileSync(path.join(ROOT, 'tests/fixtures/old-shapes.json'), JSON.stringify(data, null, 1) + '\n');
  }
  console.log('backup-v4, backup-days-only, old-shapes written');
} finally { await browser.close(); server.close(); }
