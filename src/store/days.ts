// Logged days in storage.
//
// Layout:
//   tally:month:YYYY-MM   one slot per month for the current month and the 6 before it, plain JSON
//   tally:half:YYYY-H1    older days, one compressed bundle per half-year (H1 = Jan–Jun, H2 = Jul–Dec);
//                         every day is kept in full, nothing is summarised away
//   tally:days-format     {v:2, v1: fingerprint} written last, once a save has fully succeeded
//   tally:entries:v1      the 8.1 copy of every day, still kept up to date so going back to 8.1 works
//
// Saving writes only the slots whose days changed. Old months move into their half-year bundle on the
// first save after they pass the 6-month line: the bundle is written and read back before the month
// slot is removed, so a crash part-way loses nothing.
//
// If an older Tally changed the 8.1 copy since our last save (someone went back to 8.1 for a while),
// its fingerprint no longer matches and the 8.1 copy is taken as the truth again.

import type { Day } from '../core/types';
import type { KV } from './kv';
import { pack, unpack } from './codec';

export const V1_KEY = 'tally:entries:v1';
export const FORMAT_KEY = 'tally:days-format';
export const MONTH_PREFIX = 'tally:month:';
export const HALF_PREFIX = 'tally:half:';
export const LIVE_MONTHS = 6;
/** Keep writing the 8.1 copy. Turn off once nobody needs to go back to 8.1. */
export const KEEP_V1 = true;

const monthIndex = (d: string) => (+d.slice(0, 4)) * 12 + (+d.slice(5, 7)) - 1;
const halfOf = (d: string) => d.slice(0, 4) + '-H' + (+d.slice(5, 7) <= 6 ? 1 : 2);
export const slotKeyFor = (date: string, today: string): string =>
  monthIndex(date) >= monthIndex(today) - LIVE_MONTHS ? MONTH_PREFIX + date.slice(0, 7) : HALF_PREFIX + halfOf(date);
const isSlot = (k: string) => k.startsWith(MONTH_PREFIX) || k.startsWith(HALF_PREFIX);

/** A short fingerprint of a text (FNV-1a), to notice when an older Tally has changed the 8.1 copy. */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return s.length + '.' + h.toString(36);
}

export interface LoadResult { days: unknown[]; failed: boolean; needsWrite: boolean; from: 'new' | 'v1' | 'none' }

export class DaysStore {
  private written = new Map<string, string>();   // slot key -> JSON last written or read
  private slots = new Set<string>();             // slot keys that exist in storage
  private formatOk = false;

  constructor(private kv: KV, private today: () => string) {}

  async load(): Promise<LoadResult> {
    this.written.clear(); this.slots.clear(); this.formatOk = false;
    let keys: string[];
    try { keys = await this.kv.list('tally:'); }
    catch (e) {
      // No key listing on this host: fall back to reading the 8.1 copy directly, and change nothing.
      try { const v = await this.kv.get(V1_KEY); const a = v ? JSON.parse(v) : []; return { days: Array.isArray(a) ? a : [], failed: false, needsWrite: false, from: 'v1' }; }
      catch (e2) { return { days: [], failed: false, needsWrite: false, from: 'none' }; }
    }
    const raw = async (k: string) => { const v = keys.indexOf(k) >= 0 ? await this.kv.get(k) : null; return v ? v : null; };
    let fmt: { v?: number; v1?: string | null } | null = null;
    try { const f = await raw(FORMAT_KEY); fmt = f ? JSON.parse(f) : null; } catch (e) { fmt = null; }
    const v1 = await raw(V1_KEY);
    const v1Changed = !!fmt && fmt.v1 != null && v1 != null && fingerprint(v1) !== fmt.v1;
    for (const k of keys) if (isSlot(k)) this.slots.add(k);

    if (!fmt || v1Changed) {
      // First start after the update, or 8.1 was used in between: the 8.1 copy is the truth.
      if (v1 == null) return { days: [], failed: false, needsWrite: false, from: 'none' };
      try { const a = JSON.parse(v1); return { days: Array.isArray(a) ? a : [], failed: false, needsWrite: true, from: 'v1' }; }
      catch (e) { console.error('entry read failed', e); return { days: [], failed: true, needsWrite: false, from: 'v1' }; }
    }

    // Normal start: read every slot. Half-year bundles first, so a month slot wins if a day is in both
    // (which only happens after a crash between writing a bundle and removing the month).
    const byDate = new Map<string, unknown>();
    let needsWrite = false;
    const ordered = [...this.slots].sort((a, b) => (a.startsWith(HALF_PREFIX) ? 0 : 1) - (b.startsWith(HALF_PREFIX) ? 0 : 1) || a.localeCompare(b));
    for (const k of ordered) {
      const v = await this.kv.get(k);
      if (!v) { this.slots.delete(k); continue; }
      let json: string, list: unknown;
      try { json = k.startsWith(HALF_PREFIX) ? await unpack(v) : v; list = JSON.parse(json); }
      catch (e) { console.error('day slot read failed', k, e); return { days: [], failed: true, needsWrite: false, from: 'new' }; }
      if (!Array.isArray(list)) { console.error('day slot is not a list', k); return { days: [], failed: true, needsWrite: false, from: 'new' }; }
      this.written.set(k, json);
      for (const d of list) {
        const date = d && (d as Day).date;
        if (typeof date !== 'string') continue;
        byDate.set(date, d);
        if (k.startsWith(MONTH_PREFIX) && slotKeyFor(date, this.today()) !== k) needsWrite = true;   // a month to pack
      }
    }
    this.formatOk = true;
    const days = [...byDate.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(e => e[1]);
    return { days, failed: false, needsWrite, from: 'new' };
  }

  /** Saves all days (oldest first), writing only what changed. Returns false if storage refused a write. */
  async save(days: Day[]): Promise<boolean> {
    const today = this.today();
    const groups = new Map<string, Day[]>();
    for (const d of days) { const k = slotKeyFor(d.date, today); (groups.get(k) || groups.set(k, []).get(k)!).push(d); }
    const json = new Map<string, string>();
    for (const [k, list] of groups) json.set(k, JSON.stringify(list));

    // 1. Half-year bundles, each read back and checked before going on.
    for (const [k, text] of json) {
      if (!k.startsWith(HALF_PREFIX) || this.written.get(k) === text) continue;
      const stored = await pack(text);
      await this.kv.set(k, stored);
      if (await unpack((await this.kv.get(k)) || '') !== text) throw new Error('bundle ' + k + ' did not read back the same');
      this.written.set(k, text); this.slots.add(k);
    }
    // 2. Month slots.
    for (const [k, text] of json) {
      if (!k.startsWith(MONTH_PREFIX) || this.written.get(k) === text) continue;
      await this.kv.set(k, text);
      this.written.set(k, text); this.slots.add(k);
    }
    // 3. Remove slots that no longer hold any day (a month now packed into its bundle, or a deleted day).
    for (const k of [...this.slots]) if (!json.has(k)) { await this.kv.remove(k); this.slots.delete(k); this.written.delete(k); }
    // 4. The 8.1 copy, then the format note with its fingerprint (null if the copy could not be written).
    let v1fp: string | null = null;
    if (KEEP_V1) {
      const all = JSON.stringify(days);
      try { await this.kv.set(V1_KEY, all); v1fp = fingerprint(all); } catch (e) { v1fp = null; }
    }
    // 5. On the first save in this format, check that everything reads back exactly before declaring it done.
    if (!this.formatOk) {
      const back = new DaysStore(this.kv, this.today);
      await this.kv.set(FORMAT_KEY, JSON.stringify({ v: 2, v1: v1fp }));
      const r = await back.load();
      if (r.failed || JSON.stringify(r.days) !== JSON.stringify(days)) {
        await this.kv.remove(FORMAT_KEY);
        throw new Error('the new day storage did not read back the same; still using the 8.1 copy');
      }
      this.formatOk = true;
    } else {
      await this.kv.set(FORMAT_KEY, JSON.stringify({ v: 2, v1: v1fp }));
    }
    return true;
  }
}
