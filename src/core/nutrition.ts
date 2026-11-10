// Food, energy and protein rules. 'sex' is 'male', 'female' or null (not set).
import { dnum, localDate } from './dates';

export type Sex = 'male' | 'female' | null | undefined;

/** Energy in one kilogram of body weight change, used to turn a weight trend into calories. */
export const KCAL_PER_KG = 7700;
export const DEF_TARGET = 2000;
export const CAL_RATES = [-0.5, -0.25, 0, 0.25, 0.5];
export const CAL_PERIODS = [14, 28, 91];
/** What the suggested target needs before it is trusted: days covered, weigh-ins, days with food logged. */
export const CAL_NEED = { span: 14, weighIns: 6, kcalDays: 6 };

/** The app never suggests a target below this. Not set counts as male here, so suggestions stay on the safe side. */
export const kcalFloor = (sex: Sex): number => sex === 'female' ? 1200 : 1500;

/** Daily target for a goal rate (kg per week) from the maintenance estimate, never below the floor, rounded to 25. */
export const kcalTargetFor = (tdee: number, sex: Sex, calRate: number): number =>
  Math.round(Math.max(kcalFloor(sex), tdee + calRate * KCAL_PER_KG / 7) / 25) * 25;

/**
 * Energy dot on the Nutrition card: green within a tenth of the target, yellow below that, red when more than
 * a tenth over or under the safe minimum. With sex not set the lower minimum is used, so a normal intake for a
 * woman is never called dangerous.
 */
export const kcalSafeMin = (sex: Sex): number => sex === 'male' ? 1500 : 1200;
export function kcalBand(target: number, sex: Sex) {
  const min = kcalSafeMin(sex), tg = Math.max(target, min), r10 = (v: number) => Math.round(v / 10) * 10;
  return { min, lo: Math.max(min, r10(tg * 0.9)), hi: r10(tg * 1.1) };
}
export function kcalState(avg: number | null | undefined, target: number, sex: Sex): 'none' | 'verylow' | 'over' | 'under' | 'ok' {
  if (avg == null) return 'none';
  const b = kcalBand(target, sex);
  return avg < b.min ? 'verylow' : avg > b.hi ? 'over' : avg < b.lo ? 'under' : 'ok';
}

/** Protein aim: 100 g for women, 140 g for men, 120 g when not set; 75% of the aim counts as fine. */
export const PROT_BY_SEX: Record<string, number> = { female: 100, male: 140 };
export const PROT_UNSET = 120, PROT_OK = 0.75;
export const protAuto = (sex: Sex): number => PROT_BY_SEX[sex as string] || PROT_UNSET;
export const protTarget = (sex: Sex, protFloor: number | null | undefined): number => protFloor || protAuto(sex);
export const protOk = (sex: Sex, protFloor: number | null | undefined): number => Math.round(protTarget(sex, protFloor) * PROT_OK / 5) * 5;

/**
 * Energy and protein for a day. A marked fasting day with nothing logged counts as 0; an ordinary day with
 * nothing logged was simply not logged (null) and is left out of averages.
 */
export interface FoodDay { kcal?: number | null; prot?: number | null; fast?: boolean }
export const kcalOf = (e: FoodDay): number | null => e.kcal != null ? e.kcal : (e.fast ? 0 : null);
export const protOf = (e: FoodDay): number | null => e.prot != null ? e.prot : (e.fast ? 0 : null);

/** Activity levels and their multipliers for the resting-energy estimate. */
export const ACTIVITY = [
  { key: 'sed', mult: 1.2 },
  { key: 'light', mult: 1.375 },
  { key: 'mod', mult: 1.55 },
  { key: 'high', mult: 1.725 },
  { key: 'ath', mult: 1.9 },
];

/** Mifflin-St Jeor resting energy, kcal a day; null when anything needed is missing or out of range. */
export function mifflinBMR(kg: number | null | undefined, cm: number | null | undefined, age: number | null | undefined, sex: Sex): number | null {
  if (kg == null || cm == null || age == null) return null;
  if (kg <= 0 || cm <= 0 || age <= 0 || age > 120) return null;
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}

/** Age today from the age typed in and the day it was typed, so it goes up by itself each year. */
export function effAge(age: number | null | undefined, ageSet: string | null | undefined, now: Date = new Date()): number | null {
  if (age == null) return null;
  if (!ageSet) return age;
  const yrs = Math.floor((dnum(localDate(now)) - dnum(ageSet)) / 365.25);
  return Math.min(120, age + Math.max(0, yrs));
}
