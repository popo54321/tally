// What the work since the baseline (tests/baseline.json) changes on purpose. Anything that differs from the
// baseline and is not listed here fails the checks.
//   pictures and card text:  a pattern on the picture's name, e.g. /\/workout\/\d+-cardLog$/
//   calculations:            'calc:<case name>', e.g. 'calc:coachNext'
//   wording:                 'text:<key>', e.g. 'text:rt.title'
// Say why next to each one. When the baseline moves forward (after a review, and at every publish), empty this list.
export const EXPECTED = [
  // { what: /\/workout\/\d+-cardLog$/, why: 'example: the workout card gets a new button' },
];

/** The entry that allows this difference, if any. */
export const expected = name => EXPECTED.find(e => typeof e.what === 'string' ? e.what === name || (e.what.endsWith('*') && name.startsWith(e.what.slice(0, -1))) : e.what.test(name)) || null;
