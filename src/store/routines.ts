// Routines: named groups of movements, of stretches, or of cardio (each kind kept separate), and which
// weekdays each one is on. Stored under its own key; the weekly plan that older versions read
// (tally:plan:v1) is worked out from these and still written alongside.
import { DAY_KEYS } from '../core/dates';

export const RKEY = 'tally:routines:v1';
export type Kind = 'lift' | 'sx' | 'cd';
export const KINDS: Kind[] = ['lift', 'sx', 'cd'];
/** One entry in a routine. For movements: planned sets, and whether it is linked to the next one (a superset). */
export interface RItem { k: string; sets?: number; link?: boolean }
export interface Routine { id: string; name: string; items: RItem[] }
export type Week = Record<string, string[]>;
export interface Routines { lift: Routine[]; sx: Routine[]; cd: Routine[]; week: Record<Kind, Week>; plan?: string }

export const ROUTINE_ID = /^r_[a-z0-9]{1,24}$/;
export const MAX_ROUTINES = 60, MAX_ITEMS = 40, NAME_MAX = 40;
export const emptyRoutines = (): Routines => ({ lift: [], sx: [], cd: [], week: { lift: {}, sx: {}, cd: {} } });

type Any = any;   // eslint-disable-line @typescript-eslint/no-explicit-any
/** Cleans whatever was saved: unknown entries dropped, each routine id and each entry once, weekdays pointing only at routines of their own kind. */
export function normRoutines(x: Any, exists: Record<Kind, (k: string) => unknown>): Routines {
  const out = emptyRoutines();
  if (!x || typeof x !== 'object') return out;
  const ids = new Set<string>();
  for (const kind of KINDS) {
    const list = Array.isArray(x[kind]) ? x[kind] : [];
    for (const r of list) {
      if (out[kind].length >= MAX_ROUTINES) break;
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !ROUTINE_ID.test(r.id) || ids.has(r.id)) continue;
      const seen = new Set<string>(), items: RItem[] = [];
      (Array.isArray(r.items) ? r.items : []).forEach((it: Any) => {
        if (!it || typeof it.k !== 'string' || seen.has(it.k) || !exists[kind](it.k) || items.length >= MAX_ITEMS) return;
        seen.add(it.k);
        const o: RItem = { k: it.k };
        if (kind === 'lift') {
          const n = parseInt(it.sets, 10); if (n >= 1 && n <= 20) o.sets = n;
          if (it.link === true) o.link = true;
        }
        items.push(o);
      });
      if (items.length) delete items[items.length - 1].link;   // the last one has nothing to link to
      ids.add(r.id);
      out[kind].push({ id: r.id, name: String(r.name == null ? '' : r.name).trim().slice(0, NAME_MAX) || 'Routine', items });
    }
    const mine = new Set(out[kind].map(r => r.id)), wk = x.week && x.week[kind];
    if (wk && typeof wk === 'object') DAY_KEYS.forEach(d => {
      const a = Array.isArray(wk[d]) ? wk[d].filter((id: Any, i: number, arr: Any[]) => typeof id === 'string' && mine.has(id) && arr.indexOf(id) === i) : [];
      if (a.length) out.week[kind][d] = a;
    });
  }
  if (typeof x.plan === 'string') out.plan = x.plan;
  return out;
}
