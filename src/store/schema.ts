// What saved data looks like, and how anything read back (from storage, an old version or a backup file)
// is tidied into that shape. Unknown or broken values are dropped or reset to defaults, never trusted.
import { DAY_KEYS, validDate, weekdayKey } from '../core/dates';
import { DEF_TARGET, CAL_RATES, CAL_PERIODS, ACTIVITY } from '../core/nutrition';
import { PL_ALL, PL_DEF, PL_BAR_IDS } from '../core/plates';
import { STEP_DEF, HEAD_DEF } from '../core/strength';
import { volBand } from '../core/volume';
import { MUSCLE_KEYS, muscleList, GROUP_KEYS } from '../data/muscles';
import { MEAS } from '../data/measurements';
import { libByKey, sxLibByKey, cdLibByKey } from '../data/library';
import { EQUIP } from '../data/equipment';
import { FOLD_KEYS } from '../data/folds';
import { FONTS, THEME_VARS, HEXRE, TEXT_SCALES } from '../data/themes';
import type { Day } from '../core/types';

// Storage keys (other than the logged days, which store/days.ts handles).
export const SKEY = 'tally:settings:v1';
export const XKEY = 'tally:exercises:v1';
export const PKEY = 'tally:plan:v1';
export const SXKEY = 'tally:stretches:v2';
export const EKEY = 'tally:exedits:v1';
export const TKEY = 'tally:theme:v1';
export const CDKEY = 'tally:cardio:v2';
export const GKEY = 'tally:gym:v1';
export const BKEY = 'tally:backup:v1';
export const UKEY = 'tally:undo:v1';
export const ABOUT_KEY = 'tally:aboutSeen:v1';
/** Keys left by older versions, cleared on start. */
export const RETIRED_KEYS = ['tally:stretches:v1', 'tally:cardio:v1', 'tally:lang:v1'];

export const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/;
export const CX_KEY = /^(cx_)?[a-z][a-z0-9_]{0,31}$/;
export const CD_KEY = /^cd_[a-z0-9]{1,32}$/;
export const SX_KEY = /^sx_[a-z0-9]{1,32}$/;
export const DEF_REST = 90;
export const PLAN_SETS_DEF = 3;
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
type Any = any;   // values read back from storage or a file: anything at all until tidied

// ---- logged days ----

export function normEntry(e: Any): Day | null {
  if (!e || !validDate(e.date)) return null;
  const pos = (v: Any) => { const x = parseFloat(v); return (isNaN(x) || x <= 0) ? null : x; };
  const nn = (v: Any) => { const x = parseFloat(v); return (isNaN(x) || x < 0) ? null : x; };
  const o: Any = { date: e.date, day: (typeof e.day === 'string' && e.day) ? e.day : weekdayKey(e.date) };
  o.weight = e.weight != null ? pos(e.weight) : null;
  o.height = e.height != null ? pos(e.height) : null;
  o.bf = e.bf != null ? pos(e.bf) : null;
  o.bfSrc = (e.bfSrc === 'manual' && o.bf != null) ? 'manual' : null;
  o.kcal = e.kcal != null ? nn(e.kcal) : null;
  o.prot = e.prot != null ? nn(e.prot) : null;
  if (e.fast === true) o.fast = true;
  const tally = (x: Any) => {
    if (!x || typeof x !== 'object') return null;
    const out: Record<string, number> = {};
    for (const k in x) { if (!SAFE_KEY.test(k)) continue; const v = (x[k] === true) ? 0 : nn(x[k]); if (v != null) out[k] = Math.round(v); }
    return Object.keys(out).length ? out : null;
  };
  o.cardio = tally(e.cardio);
  o.mob = tally(e.mob);
  const setCounts = (log: Any, x: Any) => {
    if (!log || !x || typeof x !== 'object') return null;
    const ms: Record<string, number> = {}; for (const k in x) { const n = parseInt(x[k], 10); if ((k in log) && n > 1 && n <= 50) ms[k] = n; }
    return Object.keys(ms).length ? ms : null;
  };
  o.mobSets = setCounts(o.mob, e.mobSets);
  o.cardioSets = setCounts(o.cardio, e.cardioSets);
  let m: Record<string, number> | null = null;
  if (e.meas && typeof e.meas === 'object') { const mm: Record<string, number> = {}; MEAS.forEach(x => { if (e.meas[x.key] != null) { const v = pos(e.meas[x.key]); if (v != null) mm[x.key] = v; } }); if (Object.keys(mm).length) m = mm; }
  o.meas = m;
  const L: Record<string, Any[]> = {};
  if (e.lifts && typeof e.lifts === 'object') {
    for (const k in e.lifts) {
      if (!SAFE_KEY.test(k)) continue; const a = e.lifts[k];
      if (Array.isArray(a)) {
        const arr = a.map((s: Any) => {
          if (!s) return null; const reps = pos(s.reps); if (reps == null) return null;
          if (s.variant != null) return { variant: String(s.variant), reps };
          const kg = s.kg != null ? (nn(s.kg) ?? 0) : 0; return { kg, reps };
        }).filter(Boolean);
        if (arr.length) L[k] = arr;
      }
    }
  }
  o.lifts = L;
  return o;
}

/** Tidies a list of days, merging any date that appears twice (later wins field by field), oldest first. */
export function normEntries(list: Any): Day[] {
  const byDate = new Map<string, Day>();
  (Array.isArray(list) ? list : []).map(normEntry).filter((e: Day | null): e is Day => !!e).forEach((e: Day) => {
    const was = byDate.get(e.date);
    byDate.set(e.date, was ? mergeDay(was, e) as Day : e);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function mergeDay(a: Any, b: Any): Day | null {
  const o = Object.assign({}, a);
  ['day', 'weight', 'height', 'kcal', 'prot', 'fast'].forEach(k => { if (b[k] != null) o[k] = b[k]; });
  if (b.bf != null) { o.bf = b.bf; o.bfSrc = b.bfSrc; }
  ['mob', 'cardio', 'meas', 'lifts'].forEach(k => { if (b[k] && Object.keys(b[k]).length) o[k] = Object.assign({}, a[k] || {}, b[k]); });
  [['mob', 'mobSets'], ['cardio', 'cardioSets']].forEach(([f, sf]) => { if (!b[f]) return; const ms = Object.assign({}, a[sf] || {}); Object.keys(b[f]).forEach(k => { if (b[sf] && b[sf][k]) ms[k] = b[sf][k]; else delete ms[k]; }); o[sf] = ms; });
  return normEntry(o);
}

// ---- settings ----

export function normPlates(x: Any) {
  x = (x && typeof x === 'object') ? x : {};
  const have = Array.isArray(x.have) ? PL_ALL.filter(id => x.have.indexOf(id) >= 0) : PL_DEF.slice();
  const own = parseFloat(x.barOwn);
  return { have, bar: PL_BAR_IDS.indexOf(x.bar) >= 0 ? x.bar : 'kg20', barOwn: (own > 0 && own <= 100) ? Math.round(own * 100) / 100 : null,
    unit: x.unit === 'lb' ? 'lb' : 'kg', sides: x.sides === 1 ? 1 : 2 };
}
export const KNOWN_SETTINGS = ['kcalTarget', 'kcalOwn', 'chartEx', 'chartSx', 'chartCd', 'chartFold', 'restSec', 'restSound', 'mobLead', 'sex', 'protFloor', 'age', 'ageSet', 'activity', 'volLo', 'volHi', 'volMute', 'calRate', 'calPeriod', 'plates'];
export function normSettings(s: Any) {
  s = (s && typeof s === 'object') ? s : {};
  const k = parseFloat(s.kcalTarget), band = volBand(s);
  const r = parseInt(s.restSec, 10);
  const keyList = (a: Any) => { if (!Array.isArray(a)) return null; const o: string[] = []; a.forEach((x: Any) => { if (typeof x === 'string' && x && o.indexOf(x) < 0 && o.length < 200) o.push(x); }); return o; };
  const fold: Record<string, boolean> = {}; if (s.chartFold && typeof s.chartFold === 'object') FOLD_KEYS.forEach(k => { if (typeof s.chartFold[k] === 'boolean') fold[k] = s.chartFold[k]; });
  return {
    kcalTarget: (isNaN(k) || k <= 0) ? DEF_TARGET : Math.round(k),
    kcalOwn: !!s.kcalOwn,
    chartEx: keyList(s.chartEx),
    chartSx: keyList(s.chartSx),
    chartCd: keyList(s.chartCd),
    chartFold: fold,
    restSec: (isNaN(r) || r < 10 || r > 900) ? DEF_REST : r,
    restSound: (s.restSound == null) ? true : !!s.restSound,
    mobLead: ([0, 5, 10].indexOf(parseInt(s.mobLead, 10)) >= 0) ? parseInt(s.mobLead, 10) : 5,
    sex: (s.sex === 'female' || s.sex === 'male') ? s.sex as 'female' | 'male' : null,
    protFloor: (function () {
      const p = parseInt(s.protFloor, 10);
      if (isNaN(p) || p < 30 || p > 400) return null;
      if ('protPerKg' in s && (parseFloat(s.protPerKg) > 0 || p === 140)) return null;   // an old setting from before the fixed aims
      return p;
    })(),
    age: (function () { const a = parseInt(s.age, 10); return (isNaN(a) || a < 10 || a > 120) ? null : a; })(),
    ageSet: (typeof s.ageSet === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.ageSet)) ? s.ageSet as string : null,
    activity: (ACTIVITY.some(a => a.key === s.activity)) ? s.activity as string : 'mod',
    volLo: band.lo,
    volHi: band.hi,
    volMute: muscleList(s.volMute, MUSCLE_KEYS.length),
    calRate: CAL_RATES.indexOf(parseFloat(s.calRate)) >= 0 ? parseFloat(s.calRate) : -0.25,
    plates: normPlates(s.plates),
    calPeriod: s.calPeriod === 'all' ? 91 : parseInt(s.calPeriod, 10) === 21 ? 28 : (CAL_PERIODS.indexOf(parseInt(s.calPeriod, 10)) >= 0 ? parseInt(s.calPeriod, 10) : 28),
  };
}
export type Settings = ReturnType<typeof normSettings>;

export function normTheme(x: Any) {
  const out: { font: string; colors: Record<string, string>; scale: number } = { font: 'min', colors: {}, scale: 1 };
  if (!x || typeof x !== 'object') return out;
  if (TEXT_SCALES.indexOf(x.scale) >= 0) out.scale = x.scale;
  if (FONTS.some(f => f.key === x.font)) out.font = x.font;
  if (x.colors && typeof x.colors === 'object') {
    THEME_VARS.forEach(v => {
      const c = x.colors[v.v];
      if (typeof c === 'string' && HEXRE.test(c.trim())) out.colors[v.v] = c.trim().toLowerCase();
    });
  }
  return out;
}

// ---- movements, stretches, cardio ----

const headOf = (v: Any): number => { const h = parseInt(v, 10); return (isNaN(h) || h < 0 || h > 20) ? HEAD_DEF : h; };
export function normCustomEx(x: Any) {
  if (!x || typeof x !== 'object') return null;
  const key = (typeof x.key === 'string') ? x.key : '';
  if (!CX_KEY.test(key)) return null;
  const name = String(x.name == null ? '' : x.name).trim().slice(0, 40);
  if (!name) return null;
  const d = parseFloat(x.def);
  const unit = (x.unit === 'sec') ? 'sec' : null;
  const rMin = parseInt(x.repMin, 10), rMax = parseInt(x.repMax, 10);
  const ranged = !isNaN(rMin) && !isNaN(rMax) && rMin >= 1 && rMax >= rMin && rMax <= (unit === 'sec' ? 3600 : 100);
  const st = parseFloat(x.step);
  const prim = muscleList(x.prim, 3), sec = muscleList(x.sec, 4).filter(k => prim.indexOf(k) < 0);
  return { key, name,
    short: (String(x.short == null ? '' : x.short).trim().slice(0, 16) || name.toLowerCase().slice(0, 16)),
    note: String(x.note == null ? '' : x.note).trim().slice(0, 60),
    def: (isNaN(d) || d < 0) ? 0 : d,
    added: !!x.added,
    unit,
    group: (GROUP_KEYS.indexOf(x.group) >= 0) ? x.group as string : 'other',
    repMin: ranged ? rMin : null,
    repMax: ranged ? rMax : null,
    step: ranged ? ((isNaN(st) || st < 0 || st > 50) ? STEP_DEF(unit) : Math.round(st * 100) / 100) : null,
    head: (ranged && unit !== 'sec') ? headOf(x.head) : null,
    prim, sec,
    lib: (typeof x.lib === 'string' && libByKey(x.lib)) ? x.lib as string : null,
    retired: !!x.retired, custom: true };
}
export function normExEdits(o: Any) {
  const out: Record<string, Record<string, unknown>> = {};
  if (!o || typeof o !== 'object') return out;
  for (const k in o) {
    const v = o[k]; if (!v || typeof v !== 'object') continue;
    const e: Record<string, unknown> = {};
    if (typeof v.name === 'string' && v.name.trim()) e.name = v.name.trim().slice(0, 40);
    if (typeof v.short === 'string' && v.short.trim()) e.short = v.short.trim().slice(0, 16);
    if (typeof v.note === 'string' && v.note.trim()) e.note = v.note.trim().slice(0, 60);
    if (typeof v.group === 'string' && GROUP_KEYS.indexOf(v.group) >= 0) e.group = v.group;
    if (v.retired) e.retired = true;
    if (Object.keys(e).length) out[k] = e;
  }
  return out;
}
export function normCardio(x: Any) {
  if (!x || typeof x !== 'object') return null;
  const key = (typeof x.key === 'string') ? x.key : '';
  if (!CD_KEY.test(key)) return null;
  const name = String(x.name == null ? '' : x.name).trim().slice(0, 40);
  if (!name) return null;
  const m = parseInt(x.mins, 10);
  const n = parseInt(x.sets, 10);
  return { key, name, mins: (isNaN(m) || m < 0 || m > 600) ? 0 : m, sets: (isNaN(n) || n < 1 || n > 20) ? 1 : n, lib: (typeof x.lib === 'string' && cdLibByKey(x.lib)) ? x.lib as string : null, retired: !!x.retired };
}
export function normStretch(x: Any) {
  if (!x || typeof x !== 'object') return null;
  const key = (typeof x.key === 'string') ? x.key : '';
  if (!SX_KEY.test(key)) return null;
  const name = String(x.name == null ? '' : x.name).trim().slice(0, 40);
  if (!name) return null;
  const s = parseInt(x.secs, 10), r = parseInt(x.reps, 10);
  return { key, name,
    secs: (isNaN(s) || s < 0 || s > 3600) ? 0 : s,
    reps: (isNaN(r) || r < 0 || r > 999) ? 0 : r,
    unit: (x.unit === 'reps') ? 'reps' : null,
    sets: (function () { const n = parseInt(x.sets, 10); return (isNaN(n) || n < 1 || n > 20) ? 1 : n; })(),
    mus: muscleList(x.mus, 4),
    lib: (typeof x.lib === 'string' && sxLibByKey(x.lib)) ? x.lib as string : null,
    retired: !!x.retired };
}

// ---- weekly plan and gym ----

/** Per weekday, the movement keys that exist (has(key)), each once. */
export function normPlan(p: Any, has: (k: string) => unknown) {
  const out: Record<string, string[]> = {};
  if (!p || typeof p !== 'object') return out;
  DAY_KEYS.forEach(d => {
    const a = p[d]; if (!Array.isArray(a)) return;
    const keep: string[] = [];
    a.forEach((k: Any) => { if (typeof k === 'string' && has(k) && keep.indexOf(k) < 0) keep.push(k); });
    if (keep.length) out[d] = keep;
  });
  return out;
}
/** Per weekday, planned set counts (1-20) for movements that exist. */
export function normPlanSets(p: Any, has: (k: string) => unknown) {
  const out: Record<string, Record<string, number>> = {};
  if (!p || typeof p !== 'object') return out;
  DAY_KEYS.forEach(d => {
    const m = p[d]; if (!m || typeof m !== 'object') return;
    Object.keys(m).forEach(k => { const n = parseInt(m[k], 10); if (has(k) && n >= 1 && n <= 20) (out[d] || (out[d] = {}))[k] = n; });
  });
  return out;
}
/** Per weekday, stretch or cardio keys that exist, each once. */
export function normDayLists(p: Any, exists: (k: string) => unknown) {
  const out: Record<string, string[]> = {};
  if (!isObj(p)) return out;
  DAY_KEYS.forEach(d => { const a = p[d]; if (!Array.isArray(a)) return; const keep: string[] = []; a.forEach((k: Any) => { if (typeof k === 'string' && exists(k) && keep.indexOf(k) < 0) keep.push(k); }); if (keep.length) out[d] = keep; });
  return out;
}
/** The same list on every weekday (used for plans saved before stretches and cardio were pinned to days). */
export function everyDay(keys: string[]) { const o: Record<string, string[]> = {}; if (keys.length) DAY_KEYS.forEach(d => { o[d] = keys.slice(); }); return o; }

export function normGym(g: Any) {
  g = (g && typeof g === 'object') ? g : {};
  const have = Array.isArray(g.have) ? [...new Set(g.have.filter((k: Any) => EQUIP.indexOf(k) >= 0))] as string[] : [];
  const own: { key: string; name: string }[] = [], seen = new Set<string>();
  (Array.isArray(g.own) ? g.own : []).forEach((x: Any) => {
    const name = String((x && x.name) || '').trim().slice(0, 40); if (!name) return;
    let k = (x && /^ge_[a-z0-9]{1,30}$/.test(x.key)) ? x.key : 'ge_' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'item');
    const base = k; let n = 1;
    while (seen.has(k)) k = base + (++n);
    seen.add(k); own.push({ key: k, name });
  });
  return { set: !!g.set, have, own };
}
