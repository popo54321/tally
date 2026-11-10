// Pairs of (8.1 function, rebuilt function) and a generator of random inputs for each.
// 'old' is evaluated in the 8.1 page; 'new' is looked up on window.Core.
const pick = (r, a) => a[Math.floor(r() * a.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const dateStr = r => `${int(r, 2019, 2030)}-${String(int(r, 1, 12)).padStart(2, '0')}-${String(int(r, 1, 31)).padStart(2, '0')}`;
const messy = r => pick(r, [() => dateStr(r), () => '2026-02-30', () => '', () => null, () => 20260101, () => '2026-1-1', () => 'x'])();
const numish = r => pick(r, [() => r() * 400 - 100, () => int(r, -5, 3000), () => String(r() * 90), () => '', () => null, () => 'abc', () => -0, () => 1e-9])();

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
];
