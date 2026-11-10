// Muscles tracked for weekly sets, and the movement groups.

export const MUSCLES = [
  { key: 'chest', grp: 'push' }, { key: 'delt_front', grp: 'push' }, { key: 'delt_side', grp: 'push' }, { key: 'triceps', grp: 'push' },
  { key: 'back', grp: 'pull' }, { key: 'traps', grp: 'pull' }, { key: 'delt_rear', grp: 'pull' }, { key: 'biceps', grp: 'pull' }, { key: 'forearms', grp: 'pull' },
  { key: 'quads', grp: 'legs' }, { key: 'hamstrings', grp: 'legs' }, { key: 'glutes', grp: 'legs' }, { key: 'calves', grp: 'legs' },
  { key: 'abs', grp: 'core' }, { key: 'lower_back', grp: 'core' },
];
export const MUSCLE_KEYS = MUSCLES.map(m => m.key);
/** Keeps only known muscle keys, once each, at most 'cap' of them. */
export const muscleList = (a: unknown, cap: number): string[] => Array.isArray(a) ? [...new Set(a.filter(k => MUSCLE_KEYS.indexOf(k) >= 0))].slice(0, cap) as string[] : [];
export const muscleGrp = (k: string): string => { const m = MUSCLES.find(x => x.key === k); return m ? m.grp : 'other'; };

export const GROUPS = [{ key: 'push' }, { key: 'pull' }, { key: 'legs' }, { key: 'core' }, { key: 'other' }];
export const GROUP_KEYS = GROUPS.map(g => g.key);
