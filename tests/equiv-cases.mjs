// Pairs of (8.1 function, rebuilt function) and a generator of random inputs for each.
// 'old' is evaluated in the 8.1 page; 'new' is looked up on window.Core.
const pick = (r, a) => a[Math.floor(r() * a.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const dateStr = r => `${int(r, 2019, 2030)}-${String(int(r, 1, 12)).padStart(2, '0')}-${String(int(r, 1, 31)).padStart(2, '0')}`;
const messy = r => pick(r, [() => dateStr(r), () => '2026-02-30', () => '', () => null, () => 20260101, () => '2026-1-1', () => 'x'])();
const sexOf = r => pick(r, ['male', 'female', null, undefined]);
const numish = r => pick(r, [() => r() * 400 - 100, () => int(r, -5, 3000), () => String(r() * 90), () => '', () => null, () => 'abc', () => -0, () => 1e-9])();


// A random log: 0-200 days, oldest first, with weigh-ins, food and fasting days scattered through it.
const randDays = r => {
  const n = int(r, 0, 200), out = []; let t = Date.parse('2026-11-10') - n * 864e5, w = 60 + r() * 50;
  for (let i = 0; i < n; i++) {
    t += 864e5 * (r() < 0.2 ? int(r, 2, 6) : 1); if (t > Date.parse('2026-11-10')) break;
    const e = { date: new Date(t).toISOString().slice(0, 10) }; w += (r() - 0.52) * 0.6;
    if (r() < 0.7) e.weight = Math.round(w * 10) / 10;
    if (r() < 0.05) e.fast = true;
    if (r() < 0.65) e.kcal = int(r, 0, 4200);
    if (r() < 0.1) e.bf = Math.round((10 + r() * 25) * 10) / 10;
    out.push(e);
  }
  return out;
};


const MUSC = ['chest', 'delt_front', 'delt_side', 'triceps', 'back', 'traps', 'delt_rear', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower_back'];
const musc = r => MUSC.filter(() => r() < 0.15);
const randSets = r => Array.from({ length: int(r, 0, 5) }, () => pick(r, [{ kg: pick(r, [0, 2.5 * int(r, 0, 80), r() * 100]), reps: int(r, 0, 25) }, { variant: 'band', reps: int(r, 1, 15) }, { reps: int(r, 1, 12) }, null]));
const randMove = r => ({ key: 'x', unit: pick(r, [null, 'sec']), added: r() < 0.25, repMin: pick(r, [null, 3, 6, 8, 15]), repMax: pick(r, [null, 6, 8, 12, 20]), step: pick(r, [0, 2.5, 5, null]), def: pick(r, [0, 20, null]) });
// records computed the 8.1 way, as inputs for the 'records beaten' check
const recs = (ex, sessions) => { const out = {}; const better = (o, kg, reps) => !o || kg > o.kg || (kg === o.kg && reps > o.reps);
  sessions.forEach(s => s.sets.forEach(x => { if (!(x && x.reps > 0)) return; const kg = typeof x.kg === 'number' ? x.kg : 0;
    if (ex.unit === 'sec') { if (!out.hold || x.reps > out.hold.reps) out.hold = { kg, reps: x.reps }; }
    else if (ex.added) { if (kg === 0) { if (!out.bwReps || x.reps > out.bwReps.reps) out.bwReps = { kg: 0, reps: x.reps }; } else if (better(out.heavy, kg, x.reps)) out.heavy = { kg, reps: x.reps }; }
    else { if (better(out.heavy, kg, x.reps)) out.heavy = { kg, reps: x.reps }; const e = (kg > 0 && x.reps >= 1 && x.reps <= 12) ? (x.reps === 1 ? kg : kg * (1 + x.reps / 30)) : null; if (e != null && (!out.e1rm || e > out.e1rm.e)) out.e1rm = { kg, reps: x.reps, e }; } }));
  return out; };

const hex = r => '#' + Array.from({ length: 3 }, () => int(r, 0, 255).toString(16).padStart(2, '0')).join('');


const messyDay = r => pick(r, [() => null, () => ({ date: 'bad' }), () => {
  const e = { date: pick(r, [dateStr(r), '2026-01-15']) };
  if (r() < 0.5) e.day = pick(r, ['mon', '', 5, 'x']);
  if (r() < 0.7) e.weight = numish(r); if (r() < 0.3) e.height = numish(r); if (r() < 0.2) { e.bf = numish(r); e.bfSrc = pick(r, ['manual', 'calc']); }
  if (r() < 0.6) e.kcal = numish(r); if (r() < 0.6) e.prot = numish(r); if (r() < 0.1) e.fast = pick(r, [true, 'yes', 1]);
  if (r() < 0.4) e.mob = { sx_a: pick(r, [true, 30, -5, '12.6']), 'bad key': 3, sx_b: 90 }; if (r() < 0.3) e.mobSets = { sx_a: pick(r, [2, '3', 1, 60]), sx_z: 2 };
  if (r() < 0.3) e.cardio = { cd_walk: pick(r, [30, true, 'x']) }; if (r() < 0.2) e.cardioSets = { cd_walk: pick(r, [3, 0]) };
  if (r() < 0.3) e.meas = { waist: numish(r), neck: numish(r), nope: 5 };
  if (r() < 0.5) e.lifts = { cx_a: [{ kg: numish(r), reps: numish(r) }, null, { variant: 'band', reps: 8 }, { reps: 5 }], 'x y': [{ kg: 1, reps: 1 }], cx_b: 'x' };
  return e; }])();
const messySettings = r => ({ kcalTarget: numish(r), kcalOwn: r() < 0.5, chartEx: pick(r, [null, ['a', 'a', '', 5]]), chartFold: pick(r, [null, { str: true, sx: 'x', zz: false }]),
  restSec: pick(r, [5, 90, '120', 1000]), restSound: pick(r, [undefined, false, 0]), mobLead: pick(r, [0, 5, '10', 7]), sex: pick(r, ['male', 'female', 'm', null]),
  protFloor: pick(r, [undefined, 20, 140, '150', 500]), protPerKg: pick(r, [undefined, 1.6, 0]), age: pick(r, [undefined, 5, 34, '40', 130]), ageSet: pick(r, [undefined, '2026-01-01', 'x']),
  activity: pick(r, ['mod', 'ath', 'x']), volLo: pick(r, [undefined, 8, 30]), volHi: pick(r, [undefined, 16, 10]), volMute: pick(r, [undefined, ['chest', 'nope']]),
  calRate: pick(r, [-0.5, '0.25', 0.3, undefined]), calPeriod: pick(r, ['all', 21, 14, '91', 30, undefined]), plates: pick(r, [undefined, { have: ['kg20'] }]) });

export const CASES = [
  { name: 'calcVal', old: 'calcVal', new: 'Core.calcVal', seed: 1, runs: 6000, gen: r => {
      const parts = []; const n = int(r, 1, 6);
      for (let i = 0; i < n; i++) { parts.push(pick(r, [String(int(r, 0, 2500)), (r() * 300).toFixed(int(r, 0, 2)), '.5', '0', ''])); if (i < n - 1) parts.push(pick(r, ['+', '-', '*', '/', ' + ', '++', 'x'])); }
      return [pick(r, [parts.join(''), parts.join('') + '+', ' ' + parts.join('') + ' ', null, undefined, int(r, 0, 999)])]; } },
  { name: 'num', old: 'num', new: 'Core.num', gen: r => [numish(r)] },
  { name: 'roundTo', old: 'roundTo', new: 'Core.roundTo', gen: r => [r() * 2000 - 1000, pick(r, [undefined, null, 0, 1, 2, 3])] },
  { name: 'fmtSigned', old: 'fmtSigned', new: 'Core.fmtSigned', gen: r => [pick(r, [null, undefined, 0, -0.04, 0.04, r() * 20 - 10, int(r, -900, 900)]), pick(r, [undefined, ' kg', '%', ' cm']), pick(r, [undefined, 0, 1, 2])] },
  { name: 'localDate', old: 'localDate', new: 'Core.localDate', gen: r => [pick(r, [undefined, null])] },
  { name: 'localDate(given)', old: 'd=>localDate(new Date(d))', new: 'd=>Core.localDate(new Date(d))', gen: r => [int(r, 0, 2e12)] },
  { name: 'daysAgo', old: 'daysAgo', new: 'Core.daysAgo', gen: r => [int(r, -400, 900)] },
  { name: 'within7', old: 'within7', new: 'Core.within7', gen: r => [pick(r, [() => dateStr(r), () => '2026-11-0' + int(r, 1, 9), () => '2026-11-' + int(r, 10, 12)])()] },
  { name: 'dnum', old: 'dnum', new: 'Core.dnum', gen: r => [dateStr(r)] },
  { name: 'validDate', old: 'validDate', new: 'Core.validDate', gen: r => [messy(r)] },
  { name: 'weekdayKey', old: 'weekdayKey', new: 'Core.weekdayKey', gen: r => [dateStr(r)] },
  { name: 'fmtDMY', old: 'fmtDMY', new: 'Core.fmtDMY', gen: r => [pick(r, [() => dateStr(r), () => '', () => null])()] },
  { name: 'fmtDM', old: 'fmtDM', new: 'Core.fmtDM', gen: r => [dateStr(r)] },
  { name: 'fmtTick', old: 'fmtTick', new: 'Core.fmtTick', gen: r => [int(r, 17000, 22000)] },

  // batch 2: nutrition, body, plates. Old functions read the page's settings, so each call sets them first.
  { name: 'kcalFloor', old: "s=>{settings.sex=s;return kcalFloor()}", new: 's=>Core.kcalFloor(s)', gen: r => [sexOf(r)] },
  { name: 'kcalTargetFor', old: "(t,s,c)=>{settings.sex=s;settings.calRate=c;return kcalTargetFor(t)}", new: '(t,s,c)=>Core.kcalTargetFor(t,s,c)', gen: r => [r() * 4000, sexOf(r), pick(r, [-0.5, -0.25, 0, 0.25, 0.5])] },
  { name: 'kcalBand', old: "(t,s)=>{settings.sex=s;return kcalBand(t)}", new: '(t,s)=>Core.kcalBand(t,s)', gen: r => [int(r, 500, 4500), sexOf(r)] },
  { name: 'kcalState', old: "(a,t,s)=>{settings.sex=s;return kcalState(a,t)}", new: '(a,t,s)=>Core.kcalState(a,t,s)', gen: r => [pick(r, [null, undefined, int(r, 0, 5000)]), int(r, 500, 4500), sexOf(r)] },
  { name: 'protTarget/Ok/Auto', old: "(s,f)=>{settings.sex=s;settings.protFloor=f;return [protTarget(),protOk(),protAuto()]}", new: '(s,f)=>[Core.protTarget(s,f),Core.protOk(s,f),Core.protAuto(s)]', gen: r => [sexOf(r), pick(r, [null, undefined, int(r, 30, 400)])] },
  { name: 'effAge', old: "(a,d)=>{settings.age=a;settings.ageSet=d;return effAge()}", new: '(a,d)=>Core.effAge(a,d)', gen: r => [pick(r, [null, int(r, 10, 120)]), pick(r, [null, '', dateStr(r)])] },
  { name: 'kcalOf/protOf', old: 'e=>[kcalOf(e),protOf(e)]', new: 'e=>[Core.kcalOf(e),Core.protOf(e)]', gen: r => [{ kcal: pick(r, [null, undefined, 0, int(r, 0, 4000)]), prot: pick(r, [null, undefined, 0, int(r, 0, 300)]), fast: pick(r, [true, false, undefined]) }] },
  { name: 'mifflinBMR', old: 'mifflinBMR', new: 'Core.mifflinBMR', gen: r => [pick(r, [null, -1, r() * 150]), pick(r, [null, 0, r() * 210]), pick(r, [null, 0, 130, int(r, 1, 100)]), sexOf(r)] },
  { name: 'bfNavy', old: 'bfNavy', new: 'Core.bfNavy', gen: r => [pick(r, [null, { waist: r() * 120 + 40, neck: r() * 30 + 25, hips: pick(r, [undefined, r() * 60 + 70]) }, { neck: 40 }]), pick(r, [null, r() * 60 + 140]), sexOf(r)] },
  { name: 'bfNeeds', old: "s=>{settings.sex=s;return bfNeeds()}", new: 's=>Core.bfNeeds(s)', gen: r => [sexOf(r)] },
  { name: 'plateKg', old: 'plateKg', new: 'Core.plateKg', gen: r => [pick(r, ['kg20', 'kg2.5', 'lb45', 'lb1.25', 'kg0.25', 'lb55'])] },
  { name: 'plateSolve', old: 'plateSolve', new: 'Core.plateSolve', runs: 800, gen: r => {
      const all = ['kg50', 'kg25', 'kg20', 'kg15', 'kg10', 'kg5', 'kg2.5', 'kg2', 'kg1.25', 'kg1', 'kg0.5', 'kg0.25', 'lb55', 'lb45', 'lb35', 'lb25', 'lb10', 'lb5', 'lb2.5', 'lb1.25'];
      const have = all.filter(() => r() < 0.4);
      return [pick(r, [r() * 300, int(r, 0, 1200), 20, 0]), pick(r, [20, 15, 10, 45 * 0.45359237, 0, r() * 30]), have]; } },

  // batch 3: weight trend and calorie estimate, on random logs
  { name: 'trendWeights', old: 'trendWeights', new: 'Core.trendWeights', runs: 1500, gen: r => [pick(r, [null, randDays(r).filter(e => e.weight != null).map(e => ({ t: Math.floor(Date.parse(e.date) / 864e5), w: e.weight }))])] },
  { name: 'weekTrendChange', old: 'weekTrendChange', new: 'Core.weekTrendChange', runs: 1500, gen: r => { const d = randDays(r).filter(e => e.weight != null); return [d, d.length ? d[Math.floor(r() * d.length)].date : '2026-11-01']; } },
  { name: 'lastNumOf/deltaOf', old: "(E,n)=>{entries=E;return [lastNumOf(e=>e.weight),lastNumOf(e=>e.kcal),deltaOf(e=>e.weight,n),deltaOf(e=>e.bf,n)]}", new: '(E,n)=>[Core.lastNumOf(E,e=>e.weight),Core.lastNumOf(E,e=>e.kcal),Core.deltaOf(E,e=>e.weight,n),Core.deltaOf(E,e=>e.bf,n)]', runs: 1500, gen: r => [randDays(r), pick(r, [7, 30, 1, 0])] },
  // calRecommend: changed on purpose in 9.1 (outlier-proof line, range, formula blend); checked by tests/estimate.mjs instead.

  // batch 4: strength, records, weekly sets
  { name: 'workSets', old: 'workSets', new: 'Core.workSets', gen: r => [pick(r, [null, randSets(r)])] },
  { name: 'coachNext (headroom off)', old: 'coachNext', new: '(ex,s)=>Core.coachNext(ex&&Object.assign({},ex,{head:0}),s)', runs: 4000, gen: r => [pick(r, [null, randMove(r)]), pick(r, [null, [], Array.from({ length: int(r, 1, 6) }, () => randSets(r))])] },
  { name: 'e1rm', old: 'e1rm', new: 'Core.e1rm', gen: r => [pick(r, [0, -5, r() * 300]), int(r, -1, 20)] },
  { name: 'recordsOf', old: 'recordsOf', new: 'Core.recordsOf', gen: r => [randMove(r), pick(r, [null, Array.from({ length: int(r, 0, 6) }, () => ({ date: '2026-0' + int(r, 1, 9) + '-1' + int(r, 0, 9), sets: randSets(r) }))])] },
  { name: 'recordsBeaten', old: 'recordsBeaten', new: '(ex,w,n)=>Core.recordsBeatenKinds(w,n).map(k=>k==="heavy"?fmtLoad(ex,n.heavy.kg)+" × "+n.heavy.reps:k==="e1rm"?t("rec.e1rm")+" "+n.e1rm.e.toFixed(1)+" kg":k==="bwReps"?"BW × "+n.bwReps.reps:n.hold.reps+"s")',
    gen: r => { const ex = randMove(r), ss = () => Array.from({ length: int(r, 1, 4) }, () => ({ date: '2026-01-01', sets: randSets(r) })); return [ex, recs(ex, ss()), recs(ex, ss())]; } },
  { name: 'goalOfRange', old: 'goalOfRange', new: 'Core.goalOfRange', gen: r => [pick(r, [null, 3, 6, 15, int(r, 1, 30)]), pick(r, [null, 6, 8, 20, int(r, 1, 30)])] },
  { name: 'STEP_DEF/repInc', old: 'u=>[STEP_DEF(u),repInc({unit:u}),repInc(null)]', new: 'u=>[Core.STEP_DEF(u),Core.repInc({unit:u}),Core.repInc(null)]', gen: r => [pick(r, ['sec', null, 'reps', undefined])] },
  { name: 'volBand', old: 'volBand', new: 'Core.volBand', gen: r => [pick(r, [null, {}, { volLo: int(r, -5, 40), volHi: int(r, -5, 120) }, { volLo: '8', volHi: '16' }])] },
  { name: 'muscleVolume', old: '(D,M)=>muscleVolume(D,k=>M[k])', new: '(D,M)=>Core.muscleVolume(D,k=>M[k])', runs: 1500, gen: r => { const M = {}, keys = ['a', 'b', 'c', 'd']; keys.forEach(k => { if (r() < 0.8) M[k] = { prim: musc(r), sec: musc(r) }; }); return [pick(r, [null, Array.from({ length: int(r, 0, 8) }, () => ({ date: '2026-11-01', lifts: Object.fromEntries(keys.filter(() => r() < 0.5).map(k => [k, randSets(r)])) }))]), M]; } },
  { name: 'weekStart', old: 'weekStart', new: 'Core.weekStart', gen: r => [pick(r, [null, undefined, dateStr(r)])] },
  { name: 'weekState', old: 'weekState', new: 'Core.weekState', gen: r => [pick(r, ['chest', 'back']), { vol: { chest: int(r, 0, 30), back: r() * 25 }, proj: { chest: int(r, 0, 30), back: r() * 25 }, planned: r() < 0.5, lastDay: r() < 0.3 }, int(r, 2, 12), int(r, 13, 25), pick(r, [[], ['chest'], ['back']])] },
  { name: 'sessionMetric/exVolume', old: '(ex,s,bw)=>[sessionMetric(ex,s,bw),exVolume(ex,s,bw)]', new: '(ex,s,bw)=>[Core.sessionMetric(ex,s),Core.exVolume(ex,s,bw)]', gen: r => [randMove(r), randSets(r).filter(x => x && x.reps > 0), pick(r, [null, 0, r() * 120])] },
  { name: 'muscleList/muscleGrp', old: '(a,c,k)=>[muscleList(a,c),muscleGrp(k)]', new: '(a,c,k)=>[Core.muscleList(a,c),Core.muscleGrp(k)]', gen: r => [pick(r, [null, 'chest', musc(r).concat(['nope', 'chest'])]), int(r, 0, 5), pick(r, ['chest', 'abs', 'calves', 'x'])] },

  // batch 5: fixed lists must be identical, and the colour maths
  { name: 'lists identical', old: '()=>JSON.stringify([LIB,SX_LIB,CD_LIB,EQUIP,EQUIP_GROUPS,FONTS,THEME_VARS,THEME_PRESETS,TEXT_SCALES,MUSCLES,GROUPS,String(HEXRE)])', new: '()=>JSON.stringify([Core.LIB,Core.SX_LIB,Core.CD_LIB,Core.EQUIP,Core.EQUIP_GROUPS,Core.FONTS,Core.THEME_VARS,Core.THEME_PRESETS,Core.TEXT_SCALES,Core.MUSCLES,Core.GROUPS,String(Core.HEXRE)])', runs: 1, gen: () => [] },
  { name: 'library lookups', old: 'k=>[libByKey(k),sxLibByKey(k),cdLibByKey(k)]', new: 'k=>[Core.libByKey(k),Core.sxLibByKey(k),Core.cdLibByKey(k)]', gen: r => [pick(r, ['bb_bench', 'couch', 'walk', 'deadlift', 'pigeon', 'run', 'nope', ''])] },
  { name: 'colour contrast', old: '(a,b,c)=>[contrast(hexRgb(a),hexRgb(b)),luminance(hexRgb(c)),rgbHex(hexRgb(a)),legibleFaint(a,b,[c,b])]', new: '(a,b,c)=>[Core.contrast(Core.hexRgb(a),Core.hexRgb(b)),Core.luminance(Core.hexRgb(c)),Core.rgbHex(Core.hexRgb(a)),Core.legibleFaint(a,b,[c,b])]', gen: r => [hex(r), hex(r), hex(r)] },

  // step 5: text
  { name: 'all 8.1 text identical (except copy-a-day and the 9.1 estimate wording)', old: '()=>JSON.stringify(Object.fromEntries(Object.entries(LANG.en).filter(([k])=>k!=="meth.adapt.b")))', new: '()=>JSON.stringify(Object.fromEntries(Object.entries(Core.EN).filter(([k])=>!k.startsWith("copy.") && !k.startsWith("tour.") && !k.startsWith("fold.") && !k.startsWith("ca.") && k !== "chart.swap" && !/^(chart[.]today|coach[.](back|climb|retry)$|sh[.]coach[.]head)/.test(k) && !/^pl[.](sides|one|onenone|tot1|totnobar1)/.test(k) && !/^calib[.](basis|blend|noformula|range)/.test(k) && k!=="meth.adapt.b")))', runs: 1, gen: () => [] },
  { name: 't/tf/tn', old: '(k,v,n)=>[t(k),tf(k,v),tn(k,n,v)]', new: '(k,v,n)=>[Core.t(k),Core.tf(k,v),Core.tn(k,n,v)]', gen: r => [pick(r, ['stat.targetn', 'sync.imported', 'pl.useup', 'nope.key', 'rev.one.over', 'f.left.kcal', 'tdee.title', 'sync.undo']), pick(r, [undefined, { n: int(r, 0, 3), w: '1 kg', avg: 5, target: '2,000' }, { goal: 'x' }]), int(r, 0, 3)] },

  // step 5: tidying saved data, on messy input
  { name: 'normEntry', old: 'normEntry', new: 'Core.normEntry', runs: 5000, gen: r => [messyDay(r)] },
  { name: 'normEntries', old: 'normEntries', new: 'Core.normEntries', runs: 1500, gen: r => [pick(r, [null, 'x', Array.from({ length: int(r, 0, 12) }, () => messyDay(r))])] },
  { name: 'mergeDay', old: 'mergeDay', new: 'Core.mergeDay', gen: r => [messyDay(r) || { date: '2026-01-01' }, messyDay(r) || { date: '2026-01-01' }] },
  { name: 'normSettings', old: 'normSettings', new: 's=>{const o=Core.normSettings(s); delete o.plates.sides; return o;}', runs: 5000, gen: r => [pick(r, [null, 'x', messySettings(r)])] },
  { name: 'normTheme', old: 'normTheme', new: 'Core.normTheme', gen: r => [pick(r, [null, { font: pick(r, ['min', 'zen', 'nope']), scale: pick(r, [1, 1.3, 2, '1.1']), colors: { '--bg': pick(r, ['#ABCDEF', ' #123456 ', 'red', 5]), '--nope': '#000000' } }])] },
  { name: 'normCustomEx', old: 'normCustomEx', new: 'x=>{const o=Core.normCustomEx(x); if(o) delete o.head; return o;}', runs: 5000, gen: r => [pick(r, [null, { key: pick(r, ['cx_bench', 'bad key', 'a', 'Cx_x', 'cx_' + 'z'.repeat(40)]), name: pick(r, ['Bench', '', '  x  ', 'N'.repeat(50)]), short: pick(r, [undefined, 'b', '']), note: pick(r, [undefined, 'n'.repeat(70)]), def: pick(r, [undefined, -1, '20', 'x']), unit: pick(r, ['sec', 'reps', undefined]), repMin: pick(r, [undefined, 3, '6', 0, 50]), repMax: pick(r, [undefined, 6, 8, 200, 4000]), step: pick(r, [undefined, 2.5, -1, 99, '1.25']), prim: musc(r).concat(pick(r, [[], ['nope']])), sec: musc(r), group: pick(r, ['push', 'nope', undefined]), lib: pick(r, ['bb_bench', 'nope', undefined]), added: r() < 0.3, retired: r() < 0.2 }])] },
  { name: 'normExEdits', old: 'normExEdits', new: 'Core.normExEdits', gen: r => [pick(r, [null, { a: { name: ' X ', short: '', note: 'n', group: 'pull', retired: 1 }, b: 5, c: { group: 'nope' } }])] },
  { name: 'normCardio/normStretch', old: '(c,s)=>[normCardio(c),normStretch(s)]', new: '(c,s)=>[Core.normCardio(c),Core.normStretch(s)]', gen: r => [{ key: pick(r, ['cd_walk', 'walk', 'cd_']), name: pick(r, ['Walk', '']), mins: pick(r, [30, -1, 700, '45']), sets: pick(r, [1, 3, 0, 25]), lib: pick(r, ['walk', 'nope']) }, { key: pick(r, ['sx_couch', 'couch']), name: pick(r, ['Couch', '']), secs: pick(r, [30, -1, 4000]), reps: pick(r, [10, 1000]), unit: pick(r, ['reps', 'sec']), sets: pick(r, [2, 30]), mus: musc(r), lib: pick(r, ['couch', 'nope']) }] },
  { name: 'normGym/normPlates', old: '(g,p)=>[normGym(g),normPlates(p)]', new: '(g,p)=>{const q=Core.normPlates(p); delete q.sides; return [Core.normGym(g),q];}', gen: r => [pick(r, [null, { set: 1, have: ['barbell', 'nope', 'barbell'], own: [{ name: 'Sandbag' }, { name: 'Sandbag' }, { key: 'ge_x', name: 'X' }, { name: '' }] }]), pick(r, [null, { have: ['kg20', 'lb45', 'nope'], bar: pick(r, ['lb35', 'x']), barOwn: pick(r, [12.345, 0, 200, '15']), unit: pick(r, ['lb', 'kg', 'st']) }])] },
  { name: 'normPlan/normPlanSets/normDayLists', setup: "customEx=[normCustomEx({key:'cx_a',name:'A'}),normCustomEx({key:'cx_b',name:'B'})];rebuildCatalogue();",
    old: 'p=>[normPlan(p),normPlanSets(p.sets),normDayLists(p.sx,k=>k.startsWith("sx_"))]', new: 'p=>[Core.normPlan(p,exByKey),Core.normPlanSets(p.sets,exByKey),Core.normDayLists(p.sx,k=>k.startsWith("sx_"))]',
    gen: r => [{ mon: pick(r, [['cx_a', 'cx_a', 'cx_z', 5], 'x', []]), sun: ['cx_b'], nope: ['cx_a'], sets: { mon: { cx_a: pick(r, [3, '4', 0, 25]), cx_z: 3 }, fri: 'x' }, sx: pick(r, [null, [], { tue: ['sx_a', 'sx_a', 'b'], xyz: ['sx_q'] }]) }] },
];
