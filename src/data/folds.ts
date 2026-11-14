// Cards that can be folded shut, by the name saved in settings. A card's name is its id; the few cards
// without one use their heading's text key (dots written as underscores). 'str', 'sx' and 'cd' are the
// three trend charts, which were foldable first and keep their short names.
export const FOLD_KEYS = [
  // Body
  'cardBody', 'stat_bw', 'bfCard', 'stat_nutr', 'chart_weight', 'chart_size', 'calib_title', 'cardProfile',
  // Workout
  'cardLog', 'cardPlates', 'cardMob', 'cardCardio', 'cardColl', 'cardProg', 'str', 'sx', 'cd',
  // Guide
  'cardVol', 'cardSxWeek', 'cardRec', 'cardBrowse', 'cardCdLib',
  // My Gym
  'cardGym',
];
/** The trend charts: folded by default until there is something to plot. */
export const CHART_FOLDS = ['str', 'sx', 'cd'];
