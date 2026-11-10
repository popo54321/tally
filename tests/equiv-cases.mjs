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
  { name: 'calRecommend', old: "(E,p,s,c)=>{entries=E;settings.calPeriod=p;settings.sex=s;settings.calRate=c;return calRecommend()}", new: '(E,p,s,c)=>Core.calRecommend(E,{calPeriod:p,sex:s,calRate:c})', runs: 2000, gen: r => [randDays(r), pick(r, [14, 28, 91]), sexOf(r), pick(r, [-0.5, -0.25, 0, 0.25, 0.5])] },
];
