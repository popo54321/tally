// Screen state that is never saved: which page is open, open dialogs and what they are editing,
// running timers, buttons waiting for a second tap, and the chart window.
type Timer = ReturnType<typeof setTimeout> | null;
export const HIST_PAGE = 60;   // History shows this many days at a time

export const V = {
  curPage: 'body',
  chartPeriod: 28 as number | 'all',
  histShown: HIST_PAGE,
  // plate calculator
  plGoal: null as number | null,
  // add-movement sheet and movement editor
  shManaging: false, shAddToDay: true, shEditing: null as any, shDelArmed: null as any, shDelTimer: null as Timer,
  dlgReturn: null as any,
  // stretch and cardio picker and editors
  kpKind: 'sx', sxPinDay: null as string | null, cdPinDay: null as string | null,
  cdEditing: null as any, cdDelArmed: false, cdDelTimer: null as Timer,
  sxEditing: null as any, sxDelArmed: false, sxDelTimer: null as Timer,
  // rest timer
  tmr: null as any, restTimer: null as any, audioCtx: null as AudioContext | null,
  // backup reminder and install banner
  bakSnoozed: false, instPrompt: null as any,
  // Guide page browsing
  guideMus: null as string | null, guideAll: false, guideMode: 'p', guideEq: '',
  // date picker month on show
  dpY: 0, dpM: 0,
  // second-tap confirmations: delete day, import, undo
  delArmed: null as any, delTimer: null as Timer,
  importArmed: false, importTimer: null as Timer,
  undoArmed: false, undoTimer: null as Timer,
  flashTimer: null as Timer,
};
