// What a weekday's plan holds (worked out from its routines; copying a day lives in routines.ts).
import type { DayKey } from '../core/dates';
import { S } from './app';
import { exByKey, stretchByKey, cardioByKey } from './persist';



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
