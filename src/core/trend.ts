// Weight trend and the calorie estimate that learns from weight and food logs.
import { dnum } from './dates';
import { KCAL_PER_KG, CAL_NEED, kcalFloor, kcalOf, kcalTargetFor, type Sex } from './nutrition';
import type { Day } from './types';

/** Smoothed weight: each weigh-in pulls the trend 10% of the way per day since the last one. */
export function trendWeights(pts: { t: number; w: number }[] | null | undefined): number[] {
  let tr: number | null = null, prev = 0;
  return (pts || []).map(p => {
    if (tr == null) tr = p.w;
    else tr += (1 - Math.pow(0.9, Math.max(1, p.t - prev))) * (p.w - tr);
    prev = p.t; return Math.round(tr * 100) / 100;
  });
}

/** Trend change from the last weigh-in before 'start' to the latest one, or null. 'wp' holds only weighed days, oldest first. */
export function weekTrendChange(wp: Day[], start: string): number | null {
  const trs = trendWeights(wp.map(e => ({ t: dnum(e.date), w: e.weight as number })));
  let iB = -1; wp.forEach((e, i) => { if (e.date < start) iB = i; });
  return (iB >= 0 && iB < wp.length - 1) ? Math.round((trs[trs.length - 1] - trs[iB]) * 100) / 100 : null;
}

/** The latest value of something across days (oldest first), or null. */
export function lastNumOf<T>(days: Day[], get: (e: Day) => T | null | undefined): T | null {
  for (let i = days.length - 1; i >= 0; i--) { const v = get(days[i]); if (v != null) return v; } return null;
}

/** Change between the latest value and the one closest to 'days' earlier. */
export function deltaOf(days: Day[], get: (e: Day) => number | null | undefined, n: number): { delta: number } | null {
  const arr = days.filter(e => get(e) != null);
  if (arr.length < 2) return null;
  const latest = arr[arr.length - 1], target = dnum(latest.date) - n;
  const cand = arr.slice(0, -1);
  let best = cand[0], bd = Math.abs(dnum(best.date) - target);
  cand.forEach(e => { const d = Math.abs(dnum(e.date) - target); if (d < bd) { bd = d; best = e; } });
  return { delta: (get(latest) as number) - (get(best) as number) };
}

/** The days inside the calorie window: the last 'period' days, counted back from the latest logged day. */
export function entriesInWindow(days: Day[], period: number): Day[] {
  if (!days.length) return [];
  const anchor = dnum(days[days.length - 1].date);
  return days.filter(e => dnum(e.date) >= anchor - (period - 1));
}

export interface Calibration { weighIns: number; kcalDays: number; spanDays: number; slope: number | null; meanK: number | null; tdee: number | null }

/** Maintenance estimate: average intake minus the energy in the weight trend (straight-line fit, kg a day × 7,700). */
export function calcCalibration(win: Day[]): Calibration {
  const wd = win.filter(e => e.weight != null).map(e => ({ t: dnum(e.date), w: e.weight as number })).sort((a, b) => a.t - b.t);
  const kdAll = win.filter(e => kcalOf(e) != null).map(e => kcalOf(e) as number);
  const out: Calibration = { weighIns: wd.length, kcalDays: kdAll.length, spanDays: 0, slope: null, meanK: null, tdee: null };
  if (wd.length >= 2) {
    const firstT = wd[0].t, lastT = wd[wd.length - 1].t;
    out.spanDays = lastT - firstT + 1;
    const n = wd.length, tbar = wd.reduce((s, p) => s + p.t, 0) / n, wbar = wd.reduce((s, p) => s + p.w, 0) / n;
    let nu = 0, de = 0; wd.forEach(p => { nu += (p.t - tbar) * (p.w - wbar); de += (p.t - tbar) ** 2; });
    if (de > 0) out.slope = nu / de;
    const kdAlign = win.filter(e => kcalOf(e) != null && dnum(e.date) >= firstT && dnum(e.date) <= lastT - 1).map(e => kcalOf(e) as number);
    if (kdAlign.length) out.meanK = kdAlign.reduce((s, k) => s + k, 0) / kdAlign.length;
  } else if (kdAll.length) {
    out.meanK = kdAll.reduce((s, k) => s + k, 0) / kdAll.length;
  }
  if (out.slope != null && out.meanK != null) out.tdee = out.meanK - out.slope * KCAL_PER_KG;
  return out;
}

/** The suggested daily target, and whether there is enough data to trust it. */
export function calRecommend(days: Day[], o: { calPeriod: number; sex: Sex; calRate: number }) {
  const c = calcCalibration(entriesInWindow(days, o.calPeriod));
  const enough = c.tdee != null && c.spanDays >= CAL_NEED.span && c.weighIns >= CAL_NEED.weighIns && c.kcalDays >= CAL_NEED.kcalDays;
  const has = c.tdee != null;
  return { c, enough, partial: has && c.spanDays < o.calPeriod,
    target: has ? kcalTargetFor(c.tdee as number, o.sex, o.calRate) : null,
    floored: has && (c.tdee as number) + o.calRate * KCAL_PER_KG / 7 < kcalFloor(o.sex) };
}
