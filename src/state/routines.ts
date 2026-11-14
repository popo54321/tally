// Routines in use: the weekly plan is worked out from them, older plans are turned into them, and the
// small edits (add or remove a routine on a weekday, save one, delete one) happen here.
import { DAY_KEYS, type DayKey } from '../core/dates';
import { STORE } from '../store/kv';
import { RKEY, KINDS, MAX_ROUTINES, emptyRoutines, normRoutines, type Kind, type Routine, type Routines, type RItem } from '../store/routines';
import { S } from './app';
import { savePlan, exByKey, stretchByKey, cardioByKey } from './persist';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const EXISTS: Record<Kind, (k: string) => unknown> = { lift: k => exByKey(k), sx: k => stretchByKey(k), cd: k => cardioByKey(k) };

/** The plan's lists for one kind, by weekday. */
const planList = (kind: Kind): Record<string, string[]> => kind === 'lift' ? S.planExtras : kind === 'sx' ? S.planSx : S.planCd;

/** A fixed-order description of the plan, to tell whether an older version changed it since we last saved. */
export function planSig(): string {
  return JSON.stringify(DAY_KEYS.map(d => [S.planExtras[d] || [], Object.entries(S.planSets[d] || {}).sort(), S.planSx[d] || [], S.planCd[d] || []]));
}

/** Routines on a weekday, of one kind, in the order they were added. */
export function dayRoutines(day: string, kind: Kind): Routine[] {
  const ids = S.routines.week[kind][day] || [];
  return ids.map(id => S.routines[kind].find(r => r.id === id)).filter(Boolean) as Routine[];
}
export const routineById = (kind: Kind, id: string) => S.routines[kind].find(r => r.id === id) || null;
/** Weekdays a routine is on. */
export const routineDays = (kind: Kind, id: string): DayKey[] => DAY_KEYS.filter(d => (S.routines.week[kind][d] || []).indexOf(id) >= 0);

/** Works the weekly plan out from the routines: every routine on a day, one after the other, each entry once. */
export function derivePlan(): void {
  const lifts: Record<string, string[]> = {}, sets: Record<string, Record<string, number>> = {}, sx: Record<string, string[]> = {}, cd: Record<string, string[]> = {};
  DAY_KEYS.forEach(d => {
    const L: string[] = [], N: Record<string, number> = {};
    dayRoutines(d, 'lift').forEach(r => r.items.forEach(it => { if (L.indexOf(it.k) < 0) { L.push(it.k); if (it.sets) N[it.k] = it.sets; } }));
    if (L.length) lifts[d] = L;
    if (Object.keys(N).length) sets[d] = N;
    for (const [kind, map] of [['sx', sx], ['cd', cd]] as const) {
      const a: string[] = [];
      dayRoutines(d, kind).forEach(r => r.items.forEach(it => { if (a.indexOf(it.k) < 0) a.push(it.k); }));
      if (a.length) map[d] = a;
    }
  });
  S.planExtras = lifts; S.planSets = sets; S.planSx = sx; S.planCd = cd;
}

/**
 * Makes routines match the plan as it stands (the first time, or after an older version changed the plan).
 * A weekday whose routines already give exactly its plan keeps them; otherwise it gets a routine holding
 * exactly that day's list, shared with any other day that has the same list, named by nameFor(those days).
 */
export function routinesFromPlan(prev: Routines | null, nameFor: (days: DayKey[]) => string): Routines {
  const R: Routines = prev ? clone(prev) : emptyRoutines();
  delete R.plan;
  let n = 0;
  const fresh = new Map<string, DayKey[]>();
  const sameItems = (a: RItem[], b: RItem[]) => a.length === b.length && a.every((x, i) => x.k === b[i].k && (x.sets || 0) === (b[i].sets || 0));
  for (const kind of KINDS) {
    DAY_KEYS.forEach(d => {
      const want: RItem[] = (planList(kind)[d] || []).map(k => kind === 'lift' && S.planSets[d] && S.planSets[d][k] ? { k, sets: S.planSets[d][k] } : { k });
      const have: RItem[] = [];
      const seen = new Set<string>();
      (R.week[kind][d] || []).forEach(id => { const r = R[kind].find(x => x.id === id); if (r) r.items.forEach(it => { if (!seen.has(it.k)) { seen.add(it.k); have.push({ k: it.k, sets: it.sets }); } }); });
      if (sameItems(have, want)) return;
      if (!want.length) { delete R.week[kind][d]; return; }
      // the day's only routine, used on no other day: an older version edited this day's list, so edit it in place
      const own = (R.week[kind][d] || []).length === 1 ? R[kind].find(x => x.id === R.week[kind][d][0]) : null;
      if (own && DAY_KEYS.every(o => o === d || (R.week[kind][o] || []).indexOf(own.id) < 0)) {
        own.items = want.map(w => { const old = own.items.find(it => it.k === w.k); return Object.assign({}, w, old && old.link ? { link: true } : {}); });
        delete own.items[own.items.length - 1].link;
        return;
      }
      let r = R[kind].find(x => sameItems(x.items.map(it => ({ k: it.k, sets: it.sets })), want));
      if (!r && R[kind].length < MAX_ROUTINES) {
        r = { id: newRoutineId(R, n++), name: '', items: want };
        R[kind].push(r);
        fresh.set(r.id, []);
      }
      if (!r) return;
      R.week[kind][d] = [r.id];
      if (fresh.has(r.id)) fresh.get(r.id)!.push(d);
    });
    R[kind].forEach(r => { if (fresh.has(r.id)) r.name = nameFor(fresh.get(r.id)!); });
  }
  return R;
}

export function newRoutineId(R: Routines = S.routines, salt = 0): string {
  const used = new Set(KINDS.flatMap(k => R[k].map(r => r.id)));
  let id = '';
  do { id = 'r_' + (Date.now() + salt).toString(36) + Math.floor(Math.random() * 1296).toString(36); salt++; } while (used.has(id));
  return id;
}

/** Reads routines; called once the plan, movements, stretches and cardio are loaded. */
export async function loadRoutines(nameFor: (days: DayKey[]) => string): Promise<void> {
  let saved: Routines | null = null;
  try { const v = await STORE.get(RKEY); if (v) saved = normRoutines(JSON.parse(v), EXISTS); }
  catch (e) { console.error('routines read failed', e); }
  const sig = planSig();
  if (saved && saved.plan === sig) { S.routines = saved; derivePlan(); return; }
  S.routines = routinesFromPlan(saved, nameFor);
  await saveRoutines();
}

/** Saves routines and the weekly plan worked out from them (which older versions and backups read). */
export async function saveRoutines(): Promise<boolean> {
  derivePlan();
  const okPlan = await savePlan();
  try { await STORE.set(RKEY, JSON.stringify(Object.assign({}, S.routines, { plan: planSig() }))); return okPlan; }
  catch (e) { console.error('routines save failed', e); return false; }
}

/** Takes routines from a backup: the file's own routines if it has them, else made from its plan. */
export function routinesFromBackup(data: { routines?: unknown }, nameFor: (days: DayKey[]) => string): Routines {
  const r = data.routines ? normRoutines(data.routines, EXISTS) : null;
  if (r && KINDS.some(k => r[k].length)) { delete r.plan; return r; }
  return routinesFromPlan(null, nameFor);
}

// ---- edits ----
export function addToDay(kind: Kind, id: string, day: string): boolean {
  const w = S.routines.week[kind], a = w[day] || (w[day] = []);
  if (a.indexOf(id) >= 0) return false;
  a.push(id); return true;
}
export function removeFromDay(kind: Kind, id: string, day: string): void {
  const w = S.routines.week[kind], a = (w[day] || []).filter(x => x !== id);
  if (a.length) w[day] = a; else delete w[day];
}
/** Saves a routine (new or changed) and puts it on exactly these weekdays. */
export function putRoutine(kind: Kind, r: Routine, days: string[]): void {
  const list = S.routines[kind], i = list.findIndex(x => x.id === r.id);
  const items = r.items.map(it => kind === 'lift' ? Object.assign({ k: it.k }, it.sets ? { sets: it.sets } : {}, it.link ? { link: true } : {}) : { k: it.k });
  if (items.length) delete (items[items.length - 1] as RItem).link;
  const clean = { id: r.id, name: r.name, items };
  if (i >= 0) list[i] = clean; else list.push(clean);
  DAY_KEYS.forEach(d => { if (days.indexOf(d) >= 0) addToDay(kind, r.id, d); else removeFromDay(kind, r.id, d); });
}
export function deleteRoutine(kind: Kind, id: string): void {
  S.routines[kind] = S.routines[kind].filter(r => r.id !== id);
  DAY_KEYS.forEach(d => removeFromDay(kind, id, d));
}
/** Removes a movement, stretch or cardio from every routine (when it is deleted for good). */
export function dropFromRoutines(kind: Kind, key: string): boolean {
  let hit = false;
  S.routines[kind].forEach(r => { const n = r.items.length; r.items = r.items.filter(it => it.k !== key); if (r.items.length !== n) { hit = true; if (r.items.length) delete r.items[r.items.length - 1].link; } });
  return hit;
}

/**
 * Supersets on a weekday: each movement linked to the next in a routine, as groups of keys in order.
 * Only movements that appear once that day, in that routine, count.
 */
export function daySupersets(day: string): string[][] {
  const groups: string[][] = [], placed = new Set<string>();
  dayRoutines(day, 'lift').forEach(r => {
    let cur: string[] = [];
    r.items.forEach((it, i) => {
      if (placed.has(it.k)) { if (cur.length > 1) groups.push(cur); cur = []; return; }
      placed.add(it.k);
      cur.push(it.k);
      if (!it.link || i === r.items.length - 1) { if (cur.length > 1) groups.push(cur); cur = []; }
    });
  });
  return groups;
}
/** Which of the day's routines a movement comes from (the first that has it). */
export function routineFor(day: string, kind: Kind, key: string): Routine | null {
  return dayRoutines(day, kind).find(r => r.items.some(it => it.k === key)) || null;
}

// ---- copying a weekday's routines to other weekdays (Copy this day to…) ----
export type WeekSnapshot = Routines['week'];
export const weekSnapshot = (): WeekSnapshot => clone(S.routines.week);
export async function restoreWeek(w: WeekSnapshot): Promise<void> { S.routines.week = clone(w); await saveRoutines(); }
/** 'add' keeps what a day has and adds the routines it lacks; 'replace' makes the day the same. Returns the week before, for Undo. */
export async function copyDayRoutines(from: DayKey, to: DayKey[], mode: 'add' | 'replace'): Promise<WeekSnapshot> {
  const before = weekSnapshot();
  for (const kind of KINDS) {
    const src = (S.routines.week[kind][from] || []).slice();
    for (const d of to) {
      if (d === from) continue;
      if (mode === 'replace') { if (src.length) S.routines.week[kind][d] = src.slice(); else delete S.routines.week[kind][d]; }
      else src.forEach(id => addToDay(kind, id, d));
    }
  }
  await saveRoutines();
  return before;
}
