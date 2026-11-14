// What the work since the baseline (tests/baseline.json) changes on purpose. Anything that differs from the
// baseline and is not listed here fails the checks.
//   pictures and card text:  a pattern on the picture's name, e.g. /\/workout\/\d+-cardLog$/
//   calculations:            'calc:<case name>', e.g. 'calc:coachNext'
//   wording:                 'text:<key>', e.g. 'text:rt.title'
// Say why next to each one. When the baseline moves forward (after a review, and at every publish), empty this list.
export const EXPECTED = [
  // { what: /\/workout\/\d+-cardLog$/, why: 'example: the workout card gets a new button' },
  // 9.6: wording pass. One apostrophe style (’); no full stop after a value ('You have Tally 9.6'); '1 day logged';
  // the four card titles in sentence case now Title Case like the rest; a hyphen made a colon.
  { what: 'text:*', why: '9.6 wording pass (apostrophes, full stops after values, singular day, title casing, one hyphen)' },
  { what: /\/body\/\d+-cardBody$/, why: '9.6: Body & Food; I’ll enter it' },
  { what: /^empty-phone\/body\/\d+-card$/, why: '9.6: no full stop after the calorie estimate’s progress' },
  { what: /\/history\/\d+-cardReview$/, why: '9.6: 1 day logged (was 1 days)' },
  { what: /\/settings\/\d+-card$/, why: '9.6: device’s (sync card)' },
  { what: /\/settings\/\d+-cardMethods$/, why: '9.6: Where These Numbers Come From; night’s' },
  { what: /\/settings\/\d+-cardUpdate$/, why: '9.6: no full stop after the version number' },
  { what: /\/workout\/\d+-cardLog$/, why: '9.6: Workout Sets' },
  { what: /\/workout\/\d+-cardRoutines$|\/acts\/routine-editor$/, why: '9.6: day’s, stretch’s, cardio’s' },
  { what: /\/acts\/copy-replace-note$/, why: '9.6: Wednesday’s' },
];

/** The entry that allows this difference, if any. */
export const expected = name => EXPECTED.find(e => typeof e.what === 'string' ? e.what === name || (e.what.endsWith('*') && name.startsWith(e.what.slice(0, -1))) : e.what.test(name)) || null;
