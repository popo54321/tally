// What the work since the baseline (tests/baseline.json) changes on purpose. Anything that differs from the
// baseline and is not listed here fails the checks.
//   pictures and card text:  a pattern on the picture's name, e.g. /\/workout\/\d+-cardLog$/
//   calculations:            'calc:<case name>', e.g. 'calc:coachNext'
//   wording:                 'text:<key>', e.g. 'text:rt.title'
//   add moved: true when only the picture may shift (a card above it grew); its words must still match.
// Say why next to each one. When the baseline moves forward (after a review, and at every publish), empty this list.
export const EXPECTED = [
  // { what: /\/workout\/\d+-cardLog$/, why: 'example: the workout card gets a new button' },
  // 9.7.2: updates go through Android's standard install screen; a failure shows Android's own reason
  { what: 'text:upd.confirm', why: '9.7.2: install screen instead of prompt' },
  { what: 'text:upd.detail', why: '9.7.2: Android’s own reason after a failed install' },
];

/** The entry that allows this difference, if any. */
export const expected = name => EXPECTED.find(e => typeof e.what === 'string' ? e.what === name || (e.what.endsWith('*') && name.startsWith(e.what.slice(0, -1))) : e.what.test(name)) || null;
