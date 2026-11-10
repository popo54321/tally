// Weekly plan actions: copying one weekday's plan to other weekdays, and undoing it.
import type { DayKey } from '../core/dates';
import { S } from './app';
import { savePlan, exByKey, stretchByKey, cardioByKey } from './persist';

type Lists = Record<string, string[]>;
export interface PlanSnapshot { extras: Lists; sets: Record<string, Record<string, number>>; sx: Lists; cd: Lists }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const planSnapshot = (): PlanSnapshot => clone({ extras: S.planExtras, sets: S.planSets, sx: S.planSx, cd: S.planCd });
export async function restorePlan(p: PlanSnapshot): Promise<void> {
  S.planExtras = clone(p.extras); S.planSets = clone(p.sets); S.planSx = clone(p.sx); S.planCd = clone(p.cd);
  await savePlan();
}

/** What a weekday's plan holds: movements (with planned set counts), stretches and cardio still in their lists. */
export function dayPlan(day: DayKey) {
  const lifts = (S.planExtras[day] || []).filter((k, i, a) => { const ex = exByKey(k); return !!ex && !ex.retired && a.indexOf(k) === i; });
  const sets: Record<string, number> = {};
  lifts.forEach(k => { const n = S.planSets[day] && S.planSets[day][k]; if (n) sets[k] = n; });
  const sx = (S.planSx[day] || []).filter(k => { const s = stretchByKey(k); return !!s && !s.retired; });
  const cd = (S.planCd[day] || []).filter(k => { const c = cardioByKey(k); return !!c && !c.retired; });
  return { lifts, sets, sx, cd };
}
export const dayPlanEmpty = (day: DayKey): boolean => { const p = dayPlan(day); return !p.lifts.length && !p.sx.length && !p.cd.length; };

const setList = (map: Lists, day: string, list: string[]) => { if (list.length) map[day] = list.slice(); else delete map[day]; };

/**
 * Copies one weekday's plan onto other weekdays. 'add' keeps what a day already has and adds what is
 * missing (a movement already there keeps its own set count); 'replace' makes the day identical.
 * Saves the plan and returns how it was before, for Undo.
 */
export async function copyDay(from: DayKey, to: DayKey[], mode: 'add' | 'replace'): Promise<PlanSnapshot> {
  const before = planSnapshot(), src = dayPlan(from);
  for (const d of to) {
    if (d === from) continue;
    if (mode === 'replace') {
      setList(S.planExtras, d, src.lifts);
      if (Object.keys(src.sets).length) S.planSets[d] = { ...src.sets }; else delete S.planSets[d];
      setList(S.planSx, d, src.sx);
      setList(S.planCd, d, src.cd);
    } else {
      const merge = (map: Lists, list: string[]) => { const cur = map[d] || []; setList(map, d, cur.concat(list.filter(k => cur.indexOf(k) < 0))); };
      const had = new Set(S.planExtras[d] || []);
      merge(S.planExtras, src.lifts);
      src.lifts.forEach(k => { if (!had.has(k) && src.sets[k]) (S.planSets[d] || (S.planSets[d] = {}))[k] = src.sets[k]; });
      merge(S.planSx, src.sx);
      merge(S.planCd, src.cd);
    }
  }
  await savePlan();
  return before;
}
