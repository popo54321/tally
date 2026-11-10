// Weekly sets per muscle. A set counts fully for the main muscles and half for the ones that also work.
import { MUSCLE_KEYS } from '../data/muscles';
import { localDate } from './dates';
import type { Day } from './types';

export const VOL_LO = 10, VOL_HI = 20;
export const VOL_PRESETS = [{ key: 'start', lo: 6, hi: 10 }, { key: 'build', lo: VOL_LO, hi: VOL_HI }, { key: 'keep', lo: 4, hi: 8 }];
export function volBand(s: { volLo?: unknown; volHi?: unknown } | null | undefined): { lo: number; hi: number } {
  const lo = parseInt((s && s.volLo) as string, 10), hi = parseInt((s && s.volHi) as string, 10);
  return (isNaN(lo) || isNaN(hi) || lo < 0 || hi > 100 || lo >= hi) ? { lo: VOL_LO, hi: VOL_HI } : { lo, hi };
}

export interface Tagged { prim?: string[]; sec?: string[] }
export function muscleVolume(days: Day[] | null | undefined, exOf: (key: string) => Tagged | null | undefined) {
  const vol: Record<string, number> = {}; MUSCLE_KEYS.forEach(k => vol[k] = 0);
  const untagged = new Set<string>();
  (days || []).forEach(e => Object.keys((e && e.lifts) || {}).forEach(key => {
    const n = ((e.lifts as Record<string, { reps: number }[]>)[key] || []).filter(s => s && s.reps > 0).length; if (!n) return;
    const ex = exOf(key), p = (ex && ex.prim) || [], s = (ex && ex.sec) || [];
    if (!p.length && !s.length) { untagged.add(key); return; }
    p.forEach(m => { if (m in vol) vol[m] += n; });
    s.forEach(m => { if (m in vol) vol[m] += n / 2; });
  }));
  return { vol, untagged: [...untagged] };
}

/** The Sunday that starts the week containing 'ds'. */
export function weekStart(ds?: string | null): string { const d = new Date((ds || localDate()) + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return localDate(d); }

export interface Week { vol: Record<string, number>; proj: Record<string, number>; planned: boolean; lastDay: boolean }
/** One muscle this week: over the band, in it, on track with what is still planned, muted, or low. */
export function weekState(k: string, w: Week, lo: number, hi: number, mute: string[]): string {
  const v = w.vol[k], p = w.proj[k];
  if (v > hi) return 'high';
  if (v >= lo) return 'ok';
  if (w.planned && p >= lo) return 'track';
  if (mute.indexOf(k) >= 0) return 'muted';
  return (w.planned || w.lastDay) ? 'low' : 'sofar';
}
