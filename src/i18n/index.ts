// Looking up text. t('key') gives the words; tf fills in {placeholders}; tn picks the singular form for 1.
import { EN } from './en';

export function t(k: string): string { const v = EN[k]; return v != null ? v : k; }
export const tf = (k: string, vals?: Record<string, unknown>): string =>
  String(t(k)).replace(/\{(\w+)\}/g, (m, p) => (vals && vals[p] != null) ? String(vals[p]) : m);
export const tn = (k: string, n: number, vals?: Record<string, unknown>): string =>
  tf((n === 1 && EN[k + '.1'] != null) ? k + '.1' : k, Object.assign({ n }, vals));
