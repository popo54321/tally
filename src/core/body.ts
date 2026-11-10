// Body measurements.
import type { Sex } from './nutrition';

export interface Girths { waist?: number; neck?: number; hips?: number; [k: string]: number | undefined }

/** US Navy body-fat estimate (Hodgdon and Beckett, 1984) from girths and height in cm; null if anything is missing or the answer is implausible. */
export function bfNavy(meas: Girths | null | undefined, height: number | null | undefined, sex: Sex): number | null {
  if (!meas || height == null) return null;
  const waist = meas.waist, neck = meas.neck, hips = meas.hips;
  if (waist == null || neck == null) return null;
  let v: number;
  if (sex === 'female') {
    if (hips == null) return null;
    if (waist + hips - neck <= 0) return null;
    v = 1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height);
  } else {
    if (waist - neck <= 0) return null;
    v = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
  }
  const bf = 495 / v - 450;
  return (bf > 0 && bf < 70) ? bf : null;
}

/** Which girths the estimate needs. */
export const bfNeeds = (sex: Sex): string[] => sex === 'female' ? ['waist', 'hips', 'neck'] : ['waist', 'neck'];
