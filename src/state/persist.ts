// Reading the app state from storage at start-up, and saving each part of it after a change.
// Nothing here touches the screen: callers show messages and redraw.
import { localDate, validDate } from '../core/dates';
import { STORE } from '../store/kv';
import { DaysStore } from '../store/days';
import { SKEY, XKEY, PKEY, SXKEY, EKEY, TKEY, CDKEY, GKEY, BKEY, UKEY, RETIRED_KEYS, KNOWN_SETTINGS, CX_KEY,
  normEntries, normSettings, normTheme, normCustomEx, normExEdits, normCardio, normStretch, normPlan, normPlanSets,
  normDayLists, everyDay, normGym } from '../store/schema';
import { S, type Move, type Stretch, type Cardio } from './app';

// ---- lookups the rest of the app uses ----
export function rebuildCatalogue(): void {
  S.catalogue = S.customEx.map(e => { const ed = S.exEdits[e.key]; return ed ? Object.assign({}, e, ed) as Move : e; });
  S.catByKey = new Map(S.catalogue.map(e => [e.key, e]));
}
export const exByKey = (k: string) => S.catByKey.get(k);
export const stretchByKey = (k: string) => S.stretches.find(s => s.key === k);
export const cardioByKey = (k: string) => S.cardios.find(c => c.key === k);
export const activeStretches = () => S.stretches.filter(s => !s.retired);
export const activeCardio = () => S.cardios.filter(c => !c.retired);

/** Clears keys left by much older versions. */
export async function purgeOldNamespace(): Promise<number> {
  try {
    const have = (await STORE.list('tally:')) || [];
    const old = ((await STORE.list('training-log:')) || []).concat(RETIRED_KEYS.filter(k => have.indexOf(k) >= 0));
    for (const k of old) { try { await STORE.set(k, ''); } catch (e) { /* keep going */ } }
    if (typeof localStorage !== 'undefined') old.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* keep going */ } });
    return old.length;
  } catch (e) { return 0; }
}

// ---- logged days ----
const DAYS = new DaysStore(STORE, () => localDate());
export async function loadDays(): Promise<void> {
  S.loadFailed = false; S.entries = [];
  const r = await DAYS.load();
  if (r.failed) { S.loadFailed = true; return; }
  S.entries = normEntries(r.days);
  // First start after the update (copy the 8.1 days into the new layout) or a month old enough to pack.
  if (r.needsWrite) { try { await DAYS.save(S.entries); } catch (e) { console.error('day storage update failed', e); } }
}
/** False if storage refused the write. */
export async function saveDays(): Promise<boolean> {
  try { await DAYS.save(S.entries); return true; }
  catch (e) { console.error('save failed', e); return false; }
}

// ---- settings ----
export async function loadSettings(): Promise<void> {
  try {
    const v = await STORE.get(SKEY); if (!v) return;
    const s = JSON.parse(v) || {};
    S.settings = normSettings(s);
    // Rewrite when tidying changed anything, so storage holds exactly the current shape.
    const canon = (o: any) => JSON.stringify(KNOWN_SETTINGS.map(k => (o && o[k] !== undefined) ? o[k] : null));
    if (Object.keys(s).length !== KNOWN_SETTINGS.length || canon(s) !== canon(S.settings)) await saveSettings();
  } catch (e) { /* unreadable settings: keep the defaults */ }
}
export async function saveSettings(): Promise<void> { try { await STORE.set(SKEY, JSON.stringify(S.settings)); } catch (e) { /* ignored, as in 8.1 */ } }

// ---- movements ----
export async function loadCatalogue(): Promise<void> {
  S.customEx = [];
  try {
    const v = await STORE.get(XKEY);
    if (v) {
      const a = JSON.parse(v);
      if (Array.isArray(a)) { const seen = new Set<string>(); a.forEach(x => { const c = normCustomEx(x); if (c && !seen.has(c.key)) { seen.add(c.key); S.customEx.push(c); } }); }
    }
  } catch (e) { console.error('movement catalogue read failed', e); }
  rebuildCatalogue();
}
export async function saveCatalogue(): Promise<boolean> {
  rebuildCatalogue();
  try { await STORE.set(XKEY, JSON.stringify(S.customEx)); return true; }
  catch (e) { console.error('catalogue save failed', e); return false; }
}
export async function loadExEdits(): Promise<void> {
  S.exEdits = {};
  try { const v = await STORE.get(EKEY); if (v) S.exEdits = normExEdits(JSON.parse(v)); }
  catch (e) { console.error('movement edits read failed', e); }
  rebuildCatalogue();
}
export async function saveExEdits(): Promise<boolean> {
  rebuildCatalogue();
  try { await STORE.set(EKEY, JSON.stringify(S.exEdits)); return true; }
  catch (e) { console.error('movement edits save failed', e); return false; }
}

/** 'cx_bench_press' -> 'Bench press'. */
export function prettyKey(k: string, fallback: string): string {
  const s = String(k).replace(/^(cx|sx|cd)_/, '').replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : fallback;
}
/** Logged days can mention a movement, stretch or cardio that is missing from its list (e.g. after an import): add it back. */
export async function recoverMovements(fallbackName: string, note: string): Promise<number> {
  const seen = new Set<string>();
  S.entries.forEach(e => Object.keys(e.lifts || {}).forEach(k => { if (!exByKey(k)) seen.add(k); }));
  if (!seen.size) return 0;
  seen.forEach(k => {
    const looksCustom = /^cx_/.test(k);
    const def = normCustomEx({ key: looksCustom ? k : 'cx_' + String(k).replace(/[^a-z0-9]/g, '').slice(0, 28),
      name: prettyKey(k, fallbackName), short: prettyKey(k, fallbackName).toLowerCase().slice(0, 16), note, def: 0, added: false, group: 'other' });
    if (!def) return;
    if (!looksCustom) { if (!CX_KEY.test(k)) return; def.key = k; }
    if (!S.customEx.some(x => x.key === def.key)) S.customEx.push(def);
  });
  rebuildCatalogue();
  await saveCatalogue();
  return seen.size;
}
export async function recoverStretches(fallbackName: string): Promise<number> {
  const seen = new Set<string>();
  S.entries.forEach(e => Object.keys(e.mob || {}).forEach(k => { if (!stretchByKey(k)) seen.add(k); }));
  if (!seen.size) return 0;
  seen.forEach(k => { const s = normStretch({ key: k, name: prettyKey(k, fallbackName), secs: 0 }); if (s && !stretchByKey(s.key)) S.stretches.push(s); });
  await saveStretches();
  return seen.size;
}
export async function recoverCardio(fallbackName: string): Promise<number> {
  const seen = new Set<string>();
  S.entries.forEach(e => Object.keys(e.cardio || {}).forEach(k => { if (!cardioByKey(k)) seen.add(k); }));
  if (!seen.size) return 0;
  seen.forEach(k => { const c = normCardio({ key: k, name: prettyKey(k, fallbackName), mins: 0 }); if (c) S.cardios.push(c); });
  await saveCardio();
  return seen.size;
}

// ---- stretches and cardio ----
async function loadList<T extends { key: string }>(key: string, norm: (x: unknown) => T | null, what: string): Promise<T[]> {
  const out: T[] = [];
  try {
    const v = await STORE.get(key);
    if (v != null) { const a = JSON.parse(v); if (Array.isArray(a)) { const used = new Set<string>(); a.forEach(x => { const s = norm(x); if (s && !used.has(s.key)) { used.add(s.key); out.push(s); } }); } }
  } catch (e) { console.error(what + ' list read failed', e); }
  return out;
}
export async function loadStretches(): Promise<void> { S.stretches = []; S.stretches = await loadList<Stretch>(SXKEY, normStretch as (x: unknown) => Stretch | null, 'stretch'); }
export async function saveStretches(): Promise<boolean> {
  try { await STORE.set(SXKEY, JSON.stringify(S.stretches)); return true; }
  catch (e) { console.error('stretch list save failed', e); return false; }
}
export async function loadCardio(): Promise<void> { S.cardios = []; S.cardios = await loadList<Cardio>(CDKEY, normCardio as (x: unknown) => Cardio | null, 'cardio'); }
export async function saveCardio(): Promise<boolean> {
  try { await STORE.set(CDKEY, JSON.stringify(S.cardios)); return true; }
  catch (e) { console.error('cardio list save failed', e); return false; }
}

// ---- gym, theme ----
export async function loadGym(): Promise<void> {
  try { const v = await STORE.get(GKEY); S.gym = normGym(v != null ? JSON.parse(v) : null); }
  catch (e) { console.error('gym read failed', e); S.gym = normGym(null); }
}
export async function saveGym(): Promise<boolean> {
  try { await STORE.set(GKEY, JSON.stringify(S.gym)); return true; }
  catch (e) { console.error('gym save failed', e); return false; }
}
export async function loadTheme(): Promise<void> {
  try { const v = await STORE.get(TKEY); if (v) S.theme = normTheme(JSON.parse(v)); }
  catch (e) { console.error('theme read failed', e); }
}
export async function saveTheme(): Promise<boolean> {
  try { await STORE.set(TKEY, JSON.stringify(S.theme)); return true; }
  catch (e) { console.error('theme save failed', e); return false; }
}

// ---- weekly plan ----
export async function loadPlan(): Promise<void> {
  S.planExtras = {}; S.planSets = {}; S.planRaw = null;
  try { const v = await STORE.get(PKEY); if (v) { const p = JSON.parse(v); S.planRaw = p; S.planExtras = normPlan(p, exByKey); S.planSets = normPlanSets(p && p.sets, exByKey); } }
  catch (e) { console.error('plan read failed', e); }
}
/** Stretch and cardio pins; plans saved before they were pinned to days get every active one on every day. */
export function planLogsInit(p: any): void {
  S.planSx = (p && p.sx !== undefined) ? normDayLists(p.sx, stretchByKey) : everyDay(activeStretches().map(x => x.key));
  S.planCd = (p && p.cd !== undefined) ? normDayLists(p.cd, cardioByKey) : everyDay(activeCardio().map(x => x.key));
}
export const planObject = () => Object.assign({}, S.planExtras, { sets: S.planSets, sx: S.planSx, cd: S.planCd });
export async function savePlan(): Promise<boolean> {
  // Drop set counts for movements no longer pinned to that day.
  Object.keys(S.planSets).forEach(d => {
    Object.keys(S.planSets[d]).forEach(k => { if ((S.planExtras[d] || []).indexOf(k) < 0) delete S.planSets[d][k]; });
    if (!Object.keys(S.planSets[d]).length) delete S.planSets[d];
  });
  try { await STORE.set(PKEY, JSON.stringify(planObject())); return true; }
  catch (e) { console.error('plan save failed', e); return false; }
}

// ---- backups and undo ----
/** Everything, in the backup file layout 8.1 uses (version 4), so any version can read it. */
export function exportObject(extra?: Record<string, unknown>) {
  return Object.assign({ app: 'tally', version: 4, exportedAt: new Date().toISOString(),
    entries: S.entries, settings: S.settings, exercises: S.customEx, plan: planObject(), routines: S.routines, stretches: S.stretches, exEdits: S.exEdits, cardio: S.cardios,
    theme: S.theme, gym: S.gym }, extra || {});
}
export async function loadBackupDate(): Promise<void> {
  try { const v = await STORE.get(BKEY); S.lastBackup = (typeof v === 'string' && validDate(v)) ? v : null; } catch (e) { S.lastBackup = null; }
}
export async function saveBackupDate(): Promise<void> { S.lastBackup = localDate(); try { await STORE.set(BKEY, S.lastBackup); } catch (e) { /* ignored */ } }
/** Today's snapshot, taken before an import, so it can be undone the same day. */
export async function saveUndo(): Promise<void> {
  S.undoSnap = { at: localDate(), n: S.entries.length, data: exportObject() };
  try { await STORE.set(UKEY, JSON.stringify(S.undoSnap)); } catch (e) { S.undoSnap = null; }
}
export async function loadUndo(): Promise<void> {
  try {
    const v = await STORE.get(UKEY), u = v ? JSON.parse(v) : null;
    S.undoSnap = (u && u.at === localDate() && u.data && Array.isArray(u.data.entries)) ? u : null;
    if (v && !S.undoSnap) await STORE.set(UKEY, '');
  } catch (e) { S.undoSnap = null; }
}
export async function clearUndo(): Promise<void> { try { await STORE.set(UKEY, ''); } catch (e) { /* ignored */ } }
