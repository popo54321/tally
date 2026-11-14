// What the work since the baseline (tests/baseline.json) changes on purpose. Anything that differs from the
// baseline and is not listed here fails the checks.
//   pictures and card text:  a pattern on the picture's name, e.g. /\/workout\/\d+-cardLog$/
//   calculations:            'calc:<case name>', e.g. 'calc:coachNext'
//   wording:                 'text:<key>', e.g. 'text:rt.title'
//   add moved: true when only the picture may shift (a card above it grew); its words must still match.
// Say why next to each one. When the baseline moves forward (after a review, and at every publish), empty this list.
export const EXPECTED = [
  // { what: /\/workout\/\d+-cardLog$/, why: 'example: the workout card gets a new button' },
  // 9.7: Android updates itself; 'Your data is 100% offline' wherever the app talked about offline
  { what: 'text:upd.*', why: '9.7: self-update wording; web and Android update text say your data is 100% offline' },
  { what: 'text:tour.backup.b', why: '9.7: Your data is 100% offline: it stays on this phone and nowhere else' },
  { what: /\/settings\/\d+-cardUpdate$/, why: '9.7: the web update text now says your data is 100% offline' },
  { what: /\/settings\/\d+-card(About|Methods|Theme)?$|\/import-message$/, moved: true, why: '9.7: below the Version card, which is a line taller' },
];

/** The entry that allows this difference, if any. */
export const expected = name => EXPECTED.find(e => typeof e.what === 'string' ? e.what === name || (e.what.endsWith('*') && name.startsWith(e.what.slice(0, -1))) : e.what.test(name)) || null;
