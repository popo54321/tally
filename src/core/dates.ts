// Dates are stored as 'YYYY-MM-DD' text in the phone's own time zone.
// Functions that need "today" take it as an argument, defaulting to the phone's clock.

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = typeof DAY_KEYS[number];

/** 'YYYY-MM-DD' for the given moment, in local time. */
export const localDate = (d?: Date): string => {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** The date n days before today, as 'YYYY-MM-DD'. */
export function daysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(now.getTime()); d.setDate(d.getDate() - n); return localDate(d);
}

/** True for today and the 6 days before it. */
export const within7 = (d: string, now: Date = new Date()): boolean => d >= daysAgo(6, now) && d <= localDate(now);

/** Whole days since 1 January 1970, for counting days between dates. */
export const dnum = (d: string): number => Math.floor(Date.parse(d) / 86400000);

export function validDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

/** Which weekday a date falls on: 'sun' … 'sat'. */
export function weekdayKey(dateStr: string): DayKey { return DAY_KEYS[new Date(dateStr + 'T12:00:00').getDay()]; }

export const fmtDMY = (ds: string | null | undefined): string => ds ? ds.slice(8, 10) + '/' + ds.slice(5, 7) + '/' + ds.slice(0, 4) : '—';
export const fmtDM = (ds: string): string => ds.slice(8, 10) + '/' + ds.slice(5, 7);
/** Chart axis label for a day number: '4/10'. */
export const fmtTick = (dn: number): string => { const d = new Date(dn * 86400000); return d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
