// Strength: next-session suggestions, personal records and session scores.
import type { LiftSet } from './types';

/** The parts of a movement these calculations need. */
export interface Move { key?: string; unit?: string | null; added?: boolean; repMin?: number | null; repMax?: number | null; step?: number | null; def?: number | null }

/** Rep ranges for each goal. */
export const GOALS = [
  { key: 'strength', min: 3, max: 6 },
  { key: 'strength2', min: 6, max: 8 },
  { key: 'endurance', min: 15, max: 20 },
];
export const goalOfRange = (mn: number | null | undefined, mx: number | null | undefined): string => {
  if (mn == null || mx == null) return 'off';
  const g = GOALS.find(x => x.min === mn && x.max === mx);
  return g ? g.key : 'custom';
};
export const STEP_DEF = (unit: string | null | undefined): number => unit === 'sec' ? 0 : 2.5;
/** Sessions at the top of the range, at the same load, before the load goes up. */
export const CLEAN_TO_STEP = 2;
export const repInc = (ex: Move | null | undefined): number => (ex && ex.unit === 'sec') ? 5 : 1;

/** The heaviest load of a session and the reps done at it. */
export function workSets(sets: LiftSet[] | null | undefined): { load: number; reps: number[] } | null {
  const ws = (sets || []).filter(s => s && s.reps > 0 && typeof s.kg === 'number');
  if (!ws.length) return null;
  const top = Math.max(...ws.map(s => s.kg as number));
  return { load: top, reps: ws.filter(s => s.kg === top).map(s => s.reps) };
}

export type CoachPlan = { kind: string; load: number; targets: number[]; last: { load: number; reps: number[] } | null; run?: number };

/**
 * What to do next time, from earlier sessions (oldest first): build reps within the range, repeat a clean
 * top-of-range session, then add load.
 */
export function coachNext(ex: Move | null | undefined, sessions: LiftSet[][] | null | undefined): CoachPlan | null {
  if (!ex || ex.repMin == null || ex.repMax == null) return null;
  const mn = ex.repMin, mx = ex.repMax, step = ex.step || 0, inc = repInc(ex);
  const hist = (sessions || []).map(workSets).filter(Boolean) as { load: number; reps: number[] }[];
  if (!hist.length) return { kind: 'first', load: ex.def || 0, targets: [mn], last: null };
  const last = hist[hist.length - 1];
  const clean = (w: { reps: number[] }) => w.reps.every(r => r >= mx);
  const climb = (w: { reps: number[] }) => { const aim = Math.min(mx, Math.max(mn, Math.min(...w.reps) + inc)); return w.reps.map(() => aim); };
  if (last.reps.some(r => r < mn)) return { kind: 'floor', load: last.load, targets: climb(last), last };
  if (!clean(last)) return { kind: 'reps', load: last.load, targets: climb(last), last };
  let run = 0;
  for (let i = hist.length - 1; i >= 0 && hist[i].load === last.load && clean(hist[i]); i--) run++;
  if (run < CLEAN_TO_STEP) return { kind: 'confirm', load: last.load, targets: last.reps.map(() => mx), last, run };
  if (step > 0) return { kind: 'up', load: Math.round((last.load + step) * 100) / 100, targets: last.reps.map(() => mn), last, run };
  return { kind: 'top', load: last.load, targets: last.reps.map(() => mx), last, run };
}

/** Estimated one-rep max (Epley), only from sets of 12 reps or fewer. */
export const E1RM_MAX_REPS = 12;
export const e1rm = (kg: number, reps: number): number | null => (kg > 0 && reps >= 1 && reps <= E1RM_MAX_REPS) ? (reps === 1 ? kg : kg * (1 + reps / 30)) : null;

export interface Rec { kg: number; reps: number; date: string; e?: number }
export interface Records { heavy?: Rec; e1rm?: Rec & { e: number }; bwReps?: Rec; hold?: Rec }

/** Best sets across sessions: heaviest, best estimated max, most bodyweight reps, longest hold. */
export function recordsOf(ex: Move, sessions: { date: string; sets: LiftSet[] }[] | null | undefined): Records {
  const r: Records = {};
  const better = (o: Rec | undefined, kg: number, reps: number) => !o || kg > o.kg || (kg === o.kg && reps > o.reps);
  (sessions || []).forEach(s => (s.sets || []).forEach(x => {
    if (!(x && x.reps > 0)) return;
    const kg = typeof x.kg === 'number' ? x.kg : 0;
    if (ex.unit === 'sec') {
      if (!r.hold || x.reps > r.hold.reps) r.hold = { kg, reps: x.reps, date: s.date };
    } else if (ex.added) {
      if (kg === 0) { if (!r.bwReps || x.reps > r.bwReps.reps) r.bwReps = { kg: 0, reps: x.reps, date: s.date }; }
      else if (better(r.heavy, kg, x.reps)) r.heavy = { kg, reps: x.reps, date: s.date };
    } else {
      if (better(r.heavy, kg, x.reps)) r.heavy = { kg, reps: x.reps, date: s.date };
      const e = e1rm(kg, x.reps);
      if (e != null && (!r.e1rm || e > r.e1rm.e)) r.e1rm = { kg, reps: x.reps, e, date: s.date };
    }
  }));
  return r;
}

/** Which records 'now' beats compared with 'was', in display order. */
export function recordsBeatenKinds(was: Records, now: Records): ('heavy' | 'e1rm' | 'bwReps' | 'hold')[] {
  const b: ('heavy' | 'e1rm' | 'bwReps' | 'hold')[] = [];
  if (now.heavy && was.heavy && (now.heavy.kg > was.heavy.kg || (now.heavy.kg === was.heavy.kg && now.heavy.reps > was.heavy.reps))) b.push('heavy');
  if (now.e1rm && was.e1rm && now.e1rm.e > was.e1rm.e + 0.05) b.push('e1rm');
  if (now.bwReps && was.bwReps && now.bwReps.reps > was.bwReps.reps) b.push('bwReps');
  if (now.hold && was.hold && now.hold.reps > was.hold.reps) b.push('hold');
  return b;
}

/** Body weight assumed for bodyweight movements when none has been logged. */
export const BW_FALLBACK = 70;
export function exVolume(ex: Move, sets: LiftSet[], bw: number | null | undefined): number {
  const base = ex.added ? (bw || BW_FALLBACK) : 0;
  return sets.reduce((a, s) => a + (base + (s.kg || 0)) * s.reps, 0);
}
/** The number the strength chart plots: total time for holds, total reps for bodyweight, kg × reps otherwise. */
export function sessionMetric(ex: Move, sets: LiftSet[]): { val: number; unit: string; lbl: string } {
  const reps = sets.reduce((a, s) => a + s.reps, 0);
  if (ex.unit === 'sec') return { val: reps, unit: 'sec', lbl: 'metric.time' };
  if (ex.added) return { val: reps, unit: 'reps', lbl: 'metric.reps' };
  return { val: sets.reduce((a, s) => a + (s.kg || 0) * s.reps, 0), unit: 'kg', lbl: 'metric.volume' };
}
