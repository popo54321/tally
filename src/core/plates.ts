// Plate calculator. Plates are ids like 'kg20' or 'lb45'; bars are ids from PL_BARS.

export const LB = 0.45359237;
export const PL_KG = [50, 25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5, 0.25];
export const PL_LB = [55, 45, 35, 25, 10, 5, 2.5, 1.25];
export const PL_ALL = PL_KG.map(v => 'kg' + v).concat(PL_LB.map(v => 'lb' + v));
export const PL_DEF = ['kg25', 'kg20', 'kg15', 'kg10', 'kg5', 'kg2.5', 'kg1.25'];
export const PL_BARS: { id: string; kg?: number }[] = [{ id: 'kg20', kg: 20 }, { id: 'kg15', kg: 15 }, { id: 'kg10', kg: 10 },
  { id: 'lb45', kg: 45 * LB }, { id: 'lb35', kg: 35 * LB }, { id: 'own' }, { id: 'none', kg: 0 }];
export const PL_BAR_IDS = PL_BARS.map(b => b.id);
export const plateKg = (id: string): number => id.slice(0, 2) === 'lb' ? parseFloat(id.slice(2)) * LB : parseFloat(id.slice(2));

export interface Plate { id: string; kg: number; u: number }
export interface Loading { side: Plate[]; totalKg: number }
export type PlateResult = { err: 'under' | 'none' | 'big' } | { exact: true; main: Loading } | { exact: false; main: Loading | null; alt: Loading | null };

/**
 * Fewest plates per side that land closest to the goal. Works in the plates' own unit (lb if every plate is lb), to 0.01.
 * 'sides' is 2 for a bar or machine loaded evenly on both sides, 1 for a machine plated on one side only.
 */
export function plateSolve(goalKg: number, barKg: number, have: string[], sides: 1 | 2 = 2): PlateResult {
  const sideKg = (goalKg - barKg) / sides;
  if (sideKg < -1e-6) return { err: 'under' };
  if (!have.length) return { err: 'none' };
  const inLb = have.every(id => id.slice(0, 2) === 'lb'), toU = (kg: number) => kg / (inLb ? LB : 1) * 100;
  const ps: Plate[] = have.map(id => ({ id, kg: plateKg(id), u: Math.round(id.slice(0, 2) === 'lb' ? (inLb ? parseFloat(id.slice(2)) * 100 : toU(plateKg(id))) : toU(plateKg(id))) }))
    .sort((a, b) => b.kg - a.kg);
  const T = Math.round(toU(Math.max(0, sideKg))), max = T + ps[0].u;
  if (max > 120000) return { err: 'big' };
  const best = new Uint16Array(max + 1).fill(65535), from = new Int8Array(max + 1).fill(-1);
  best[0] = 0;
  for (let v = 1; v <= max; v++) for (let i = 0; i < ps.length; i++) { const q = v - ps[i].u; if (q >= 0 && best[q] !== 65535 && best[q] + 1 < best[v]) { best[v] = best[q] + 1; from[v] = i; } }
  const tol = inLb || have.every(id => id.slice(0, 2) === 'kg') ? 0 : 2;
  const build = (v: number): Loading => { const side: Plate[] = []; while (v > 0) { const i = from[v]; side.push(ps[i]); v -= ps[i].u; } return { side, totalKg: barKg + sides * side.reduce((a, p) => a + p.kg, 0) }; };
  for (let d = 0; d <= tol; d++) for (const v of [T - d, T + d]) if (v >= 0 && v <= max && best[v] !== 65535) return { exact: true, main: build(v) };
  let lo = -1, hi = -1;
  for (let v = T; v >= 0; v--) if (best[v] !== 65535) { lo = v; break; }
  for (let v = T; v <= max; v++) if (best[v] !== 65535) { hi = v; break; }
  const L = lo >= 0 ? build(lo) : null, H = hi >= 0 ? build(hi) : null;
  return { exact: false, main: L || H, alt: (L && H) ? H : null };
}
