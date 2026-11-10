// Weight trend and the calorie estimate that learns from weight and food logs.
import { dnum } from './dates';
import { KCAL_PER_KG, CAL_NEED, ACTIVITY, kcalFloor, kcalOf, kcalTargetFor, mifflinBMR, effAge, type Sex } from './nutrition';
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

const median = (xs: number[]): number => { const a = xs.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/**
 * A trend line that one odd weigh-in cannot tilt: the slope is the middle value of the slopes between every
 * pair of weigh-ins (Theil–Sen). 'sd' is how far weigh-ins typically sit from the line, measured the same
 * robust way (middle distance × 1.4826, which equals the ordinary spread for well-behaved data).
 */
export function robustLine(pts: { t: number; w: number }[]): { slope: number; sd: number } | null {
  if (pts.length < 2) return null;
  const slopes: number[] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[j].t !== pts[i].t) slopes.push((pts[j].w - pts[i].w) / (pts[j].t - pts[i].t));
  if (!slopes.length) return null;
  const slope = median(slopes), icpt = median(pts.map(p => p.w - slope * p.t));
  const sd = 1.4826 * median(pts.map(p => Math.abs(p.w - icpt - slope * p.t)));
  return { slope, sd };
}

/** Weigh-ins usually wobble at least this much from day to day (kg), whatever a short run of them suggests. */
export const MIN_SCATTER = 0.25;
/** Logged intake is never perfectly comparable from week to week: a small allowance (kcal) always stays in the range. */
export const LOG_ALLOWANCE = 40;
/** The formula estimate is typically within about a tenth of a person's real maintenance. */
export const FORMULA_SPREAD = 0.10;

export interface Calibration { weighIns: number; kcalDays: number; spanDays: number; slope: number | null; meanK: number | null; tdee: number | null;
  /** Likely range of the logs-only estimate, ± kcal. */ sd: number | null }

/**
 * Maintenance from the logs: average intake minus the energy in the weight trend (kg a day × 7,700), with its
 * likely range from how scattered the weigh-ins are, how many days they span, and how much intake varies.
 */
export function calcCalibration(win: Day[]): Calibration {
  const wd = win.filter(e => e.weight != null).map(e => ({ t: dnum(e.date), w: e.weight as number })).sort((a, b) => a.t - b.t);
  const kdAll = win.filter(e => kcalOf(e) != null).map(e => kcalOf(e) as number);
  const out: Calibration = { weighIns: wd.length, kcalDays: kdAll.length, spanDays: 0, slope: null, meanK: null, tdee: null, sd: null };
  if (wd.length >= 2) {
    const firstT = wd[0].t, lastT = wd[wd.length - 1].t;
    out.spanDays = lastT - firstT + 1;
    const n = wd.length, tbar = wd.reduce((s, p) => s + p.t, 0) / n;
    const sxx = wd.reduce((s, p) => s + (p.t - tbar) ** 2, 0);
    const line = robustLine(wd);
    if (line) out.slope = line.slope;
    const kdAlign = win.filter(e => kcalOf(e) != null && dnum(e.date) >= firstT && dnum(e.date) <= lastT - 1).map(e => kcalOf(e) as number);
    if (kdAlign.length) out.meanK = kdAlign.reduce((s, k) => s + k, 0) / kdAlign.length;
    if (line && kdAlign.length && sxx > 0) {
      const scatter = n >= 4 ? Math.max(MIN_SCATTER, line.sd) : 2 * MIN_SCATTER;         // too few weigh-ins to judge: assume a wobbly start
      const slopeSe = scatter / Math.sqrt(sxx);                                            // kg a day
      const kSd = kdAlign.length >= 2 ? Math.sqrt(kdAlign.reduce((s, k) => s + (k - (out.meanK as number)) ** 2, 0) / (kdAlign.length - 1)) : 500;
      out.sd = Math.sqrt((slopeSe * KCAL_PER_KG) ** 2 + kSd ** 2 / kdAlign.length + LOG_ALLOWANCE ** 2);
    }
  } else if (kdAll.length) {
    out.meanK = kdAll.reduce((s, k) => s + k, 0) / kdAll.length;
  }
  if (out.slope != null && out.meanK != null) out.tdee = out.meanK - out.slope * KCAL_PER_KG;
  return out;
}

/** The formula estimate (Mifflin-St Jeor resting energy × activity) from the latest weight and height, or null without a profile. */
export function profileTdee(days: Day[], o: { sex: Sex; age?: number | null; ageSet?: string | null; activity?: string }) {
  const w = lastNumOf(days, e => e.weight), h = lastNumOf(days, e => e.height);
  const age = effAge(o.age, o.ageSet);
  if (w == null || h == null || age == null) return null;
  const bmr = mifflinBMR(w, h, age, o.sex);
  if (bmr == null) return null;
  const a = ACTIVITY.find(x => x.key === o.activity) || ACTIVITY[2];
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * a.mult), mult: a.mult, act: a.key, age, weight: w, height: h };
}

/**
 * The maintenance estimate shown and the target built on it. The logs-only estimate is blended with the
 * formula estimate, each trusted in proportion to how sure it is (the narrower its range, the more it
 * counts), and the combined range comes out of the same step. With little data the formula carries it;
 * after a few weeks of steady logging it is almost all your own numbers. Without a profile there is no
 * formula estimate, so the logs stand alone.
 */
export function blendEstimate(log: { tdee: number; sd: number }, formula: number | null): { tdee: number; sd: number; logShare: number } {
  if (formula == null) return { tdee: log.tdee, sd: log.sd, logShare: 1 };
  const wl = 1 / (log.sd * log.sd), fsd = formula * FORMULA_SPREAD, wf = 1 / (fsd * fsd);
  return { tdee: (log.tdee * wl + formula * wf) / (wl + wf), sd: 1 / Math.sqrt(wl + wf), logShare: wl / (wl + wf) };
}

/** The suggested daily target, and whether there is enough data to trust it. */
export function calRecommend(days: Day[], o: { calPeriod: number; sex: Sex; calRate: number; age?: number | null; ageSet?: string | null; activity?: string }) {
  const c = calcCalibration(entriesInWindow(days, o.calPeriod));
  const enough = c.tdee != null && c.spanDays >= CAL_NEED.span && c.weighIns >= CAL_NEED.weighIns && c.kcalDays >= CAL_NEED.kcalDays;
  const has = c.tdee != null && c.sd != null;
  const prior = profileTdee(days, o);
  const b = has ? blendEstimate({ tdee: c.tdee as number, sd: c.sd as number }, prior ? prior.tdee : null) : null;
  return { c, enough, partial: has && c.spanDays < o.calPeriod,
    tdee: b ? b.tdee : null, sd: b ? b.sd : null, logShare: b ? b.logShare : null, formula: prior ? prior.tdee : null,
    target: b ? kcalTargetFor(b.tdee, o.sex, o.calRate) : null,
    floored: !!b && b.tdee + o.calRate * KCAL_PER_KG / 7 < kcalFloor(o.sex) };
}
