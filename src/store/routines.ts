// Routines: named groups of movements, of stretches, or of cardio (each kind kept separate), and which
// weekdays each one is on. Stored under its own key; the weekly plan that older versions read
// (tally:plan:v1) is worked out from these and still written alongside.
import { DAY_KEYS } from '../core/dates';

export const RKEY = 'tally:routines:v1';
export type Kind = 'lift' | 'sx' | 'cd';
export const KINDS: Kind[] = ['lift', 'sx', 'cd'];
type Any = any;   // eslint-disable-line @typescript-eslint/no-explicit-any
/**
 * One entry in a routine. Movements: planned sets, and whether it is linked to the next one (a superset).
 * Stretches: hold seconds or reps per set, and sets. Cardio: minutes per set, and sets. A field left out means
 * the stretch's or cardio's own setting.
 */
export interface RItem { k: string; sets?: number; link?: boolean; secs?: number; reps?: number; mins?: number }
/** Allowed range of each per-item field, by kind. */
export const ITEM_FIELDS: Record<Kind, Record<string, [number, number]>> = {
  lift: { sets: [1, 20] },
  sx: { secs: [1, 3600], reps: [1, 999], sets: [1, 50] },
  cd: { mins: [1, 600], sets: [1, 50] },
};
/** Keeps the fields this kind uses, each a whole number in range. */
export function cleanItem(kind: Kind, it: Any): RItem {
  const o: RItem = { k: it.k };
  for (const [f, [lo, hi]] of Object.entries(ITEM_FIELDS[kind])) { const n = parseInt(it[f], 10); if (n >= lo && n <= hi) (o as Any)[f] = n; }
  if (kind === 'lift' && it.link === true) o.link = true;
  return o;
}
export interface Routine { id: string; name: string; items: RItem[] }
export type Week = Record<string, string[]>;
export interface Routines { lift: Routine[]; sx: Routine[]; cd: Routine[]; week: Record<Kind, Week>; plan?: string }

export const ROUTINE_ID = /^r_[a-z0-9]{1,24}$/;
export const MAX_ROUTINES = 60, MAX_ITEMS = 40, NAME_MAX = 40;
export const emptyRoutines = (): Routines => ({ lift: [], sx: [], cd: [], week: { lift: {}, sx: {}, cd: {} } });

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
        items.push(cleanItem(kind, it));
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
