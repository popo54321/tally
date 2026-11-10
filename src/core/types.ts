// The shape of one logged day, as stored. Every field except date is optional.
import type { DayKey } from './dates';

export interface LiftSet { kg?: number; reps: number; variant?: string }
export interface Day {
  date: string;                       // 'YYYY-MM-DD'
  day?: DayKey | string;              // the session it was logged under (normally its weekday)
  weight?: number | null;             // kg
  height?: number | null;             // cm
  bf?: number | null;                 // body fat %, typed in or estimated
  bfSrc?: 'manual' | null;
  kcal?: number | null;
  prot?: number | null;               // g
  fast?: boolean;                     // marked as a fasting day
  meas?: Record<string, number> | null;          // girths in cm
  lifts?: Record<string, LiftSet[]>;             // movement key -> sets
  mob?: Record<string, number> | null;           // stretch key -> seconds or reps done
  mobSets?: Record<string, number> | null;       // stretch key -> sets done, when more than 1
  cardio?: Record<string, number> | null;        // cardio key -> minutes
  cardioSets?: Record<string, number> | null;
}
