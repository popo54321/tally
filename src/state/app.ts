// The one record of what the app currently knows. Screens read from it; only actions change it, and each
// action saves just the part it changed (see actions as they move here from legacy/).
import type { Day } from '../core/types';
import { normSettings, normTheme, normGym, type Settings } from '../store/schema';
import { emptyRoutines, type Routines } from '../store/routines';

type Rec<T> = Record<string, T>;
export interface Move { key: string; name: string; short: string; note: string; def: number; added: boolean; unit: string | null; group: string;
  repMin: number | null; repMax: number | null; step: number | null; prim: string[]; sec: string[]; lib: string | null; retired: boolean; custom: boolean; [k: string]: unknown }
export interface Stretch { key: string; name: string; secs: number; reps: number; unit: string | null; sets: number; mus: string[]; lib: string | null; retired: boolean }
export interface Cardio { key: string; name: string; mins: number; sets: number; lib: string | null; retired: boolean }

export const S = {
  /** Every logged day, oldest first. */
  entries: [] as Day[],
  settings: normSettings({}) as Settings,
  /** Movements in the collection as saved, and the user's edits to them. */
  customEx: [] as Move[],
  exEdits: {} as Rec<Record<string, unknown>>,
  /** Movements with edits applied, and the same by key. Rebuilt whenever either changes. */
  catalogue: [] as Move[],
  catByKey: new Map<string, Move>(),
  stretches: [] as Stretch[],
  cardios: [] as Cardio[],
  /** Routines of movements, stretches and cardio, and which weekdays each is on. The weekly plan below is worked out from them. */
  routines: emptyRoutines() as Routines,
  /** Weekly plan: movements, planned set counts, stretches and cardio, per weekday (from the routines). */
  planExtras: {} as Rec<string[]>,
  planSets: {} as Rec<Rec<number>>,
  planSx: {} as Rec<string[]>,
  planCd: {} as Rec<string[]>,
  /** The plan as read from storage, kept for re-reading stretch/cardio pins after the lists load. */
  planRaw: null as unknown,
  gym: normGym(null),
  theme: normTheme(null),
  /** Date of the last backup file saved, and today's undo snapshot. */
  lastBackup: null as string | null,
  undoSnap: null as null | { at: string; n: number; data: Record<string, unknown> },
  /** True when saved days could not be read: the app then refuses to save over them. */
  loadFailed: false,
};
