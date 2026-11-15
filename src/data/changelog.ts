// Release notes, newest first. Shown once after an update ("What's new") and in full under
// Settings → Version & Updates → Update log. Add the new version at the top with every release.
export interface Release { v: string; date: string; notes: string[] }

export const CHANGELOG: Release[] = [
  { v: '9.8', date: '2026-11-15', notes: [
    'After an update, Tally shows what is new, once.',
    'Settings → Version & Updates → Update log lists every version, back to the first release.',
  ] },
  { v: '9.7.3', date: '2026-11-15', notes: ['A test release for updating from inside the app. Nothing else changed.'] },
  { v: '9.7.2', date: '2026-11-15', notes: [
    'Android: updates open Android’s standard install screen instead of the earlier method, which some phones stopped.',
    'If Android stops an install, Tally shows Android’s own reason.',
  ] },
  { v: '9.7.1', date: '2026-11-15', notes: ['A test release for updating from inside the app. Nothing else changed.'] },
  { v: '9.7', date: '2026-11-14', notes: [
    'The Android app checks for a new version once a day and updates itself when you tap Update. The daily check can be switched off.',
    'Your data is 100% offline: only the update check goes online, and it sends nothing about you.',
  ] },
  { v: '9.6', date: '2026-11-14', notes: [
    'A wording pass: no full stop after a version number, “1 day logged” instead of “1 days”, one apostrophe style, and every card title in the same style.',
  ] },
  { v: '9.5', date: '2026-11-14', notes: [
    'Stretch routines set their own hold time (or reps) and sets; cardio routines set minutes and sets. The day’s log uses them.',
  ] },
  { v: '9.4', date: '2026-11-14', notes: [
    'Routines replace weekday pins: named workout, stretch and cardio routines, put on the weekdays you choose, as many on one day as you like.',
    'Link movements into a superset: → goes to the next one, and the rest comes after the round.',
    'Your pins became routines by themselves; identical days share one.',
  ] },
  { v: '9.3', date: '2026-11-14', notes: [
    'Fold any card on the Body, Workout, Guide and My Gym pages.',
    'Plate calculator: plates on both sides, or all on one side.',
    'Apply one movement’s coaching to many movements at once.',
    'Coaching headroom: after a weight step that was too heavy, go back and build reps above the range before trying again.',
    '“Lifted today” under Strength Trend.',
    'With eight movements on the strength chart, tapping another swaps out the one trained longest ago.',
  ] },
  { v: '9.2', date: '2026-11-12', notes: ['A How to use tour for new users, and any time from Settings.'] },
  { v: '9.1', date: '2026-11-10', notes: [
    'A steadier maintenance estimate: odd days no longer throw it, it shows a ± range, and it leans on the formula from your profile while data is thin.',
  ] },
  { v: '9.0', date: '2026-11-10', notes: [
    'Tally rebuilt from the ground up, with the same screens and numbers.',
    'Copy this day to other weekdays, with Undo.',
    'Older days are packed into six-month bundles, so storage stays small.',
  ] },
  { v: '8.1', date: '2026-11-07', notes: ['Your target and what is left, under Energy and Protein.'] },
  { v: '8.0', date: '2026-11-04', notes: ['Plate calculator: which plates to load for a weight.'] },
  { v: '7.9', date: '2026-11-01', notes: [
    'A coloured dot for your calorie average: green near the target, yellow below it, red far over it or under the safe minimum.',
  ] },
  { v: '7.8', date: '2026-10-31', notes: ['Chart labels are readable on phones and follow the text size.'] },
  { v: '7.7', date: '2026-10-31', notes: ['Text size in Settings → Appearance, from 90% to 150%.'] },
  { v: '7.6', date: '2026-10-31', notes: ['Stretches and cardio with several sets tick off one set per tap.'] },
  { v: '7.5', date: '2026-10-31', notes: [
    'A Fasting day button logs 0 kcal and 0 g in one tap.',
    'The 7-day averages count an empty day as 0.',
  ] },
  { v: '7.4', date: '2026-10-31', notes: ['Stretches have sets.'] },
  { v: '7.3', date: '2026-10-31', notes: ['Charts open on 28 days. Press and drag on a chart to pick a day.'] },
  { v: '7.2', date: '2026-10-31', notes: ['The Android app is called Tally (it was Tally Pro). Updates keep your data.'] },
  { v: '7.1', date: '2026-10-31', notes: ['Tally is free and stays free: new wording for Support Tally.'] },
  { v: '7.0', date: '2026-10-31', notes: [
    'Trend charts reworked: 14, 28 and 91 days or All, details for any day, new Mobility and Cardio charts, and charts that fold.',
    '37 more stretches, 103 in all.',
    'Why cardio has no calorie counts: the calorie target already includes it.',
  ] },
  { v: '6.9', date: '2026-10-30', notes: ['You don’t have to log perfectly: the estimate needs consistent logging, not exact logging.'] },
  { v: '6.8', date: '2026-10-30', notes: [
    'Welcome to Tally on first launch, also kept in About Tally.',
    'The weekly review respects your own calorie target.',
  ] },
  { v: '6.7', date: '2026-10-30', notes: ['A Version & Updates card in Settings.'] },
  { v: '6.6', date: '2026-10-30', notes: ['Clearer wording: maintenance is an estimate, not a measurement. Copy for your AI to analyse.'] },
  { v: '6.5', date: '2026-10-29', notes: ['Importing a hand-edited backup can no longer reset settings by accident.'] },
  { v: '6.4', date: '2026-10-29', notes: ['The number of sets you plan for a movement always wins.'] },
  { v: '6.3', date: '2026-10-29', notes: ['A note that the automatic protein number is a general guide.'] },
  { v: '6.2', date: '2026-10-29', notes: ['Support Tally moves to the top of Settings.'] },
  { v: '6.1', date: '2026-10-29', notes: ['An install prompt for the web app, and proper icons everywhere.'] },
  { v: '6.0', date: '2026-10-29', notes: [
    'The calorie estimate shows as soon as it can be worked out, with a warning while it is early.',
    'Browse by Muscle splits into Main target and Also works, with an equipment filter.',
  ] },
  { v: '5.8', date: '2026-10-29', notes: ['One daily protein target: 100 g for women, 140 g for men, 120 g until set. Three quarters of it counts as fine.'] },
  { v: '5.7', date: '2026-10-28', notes: [
    'Planned movements remember how many sets you plan.',
    'The Guide shows Starting out, Building and Maintaining ranges.',
  ] },
  { v: '5.6', date: '2026-10-28', notes: ['The Android app, built and published here with every release.'] },
  { v: '5.5', date: '2026-10-14', notes: [
    'Sets per muscle each week, and recommended muscles, in the Guide.',
    'A Stop button on the timer, and a note when exact alarms are off on Android.',
  ] },
  { v: '5.4', date: '2026-10-13', notes: [
    'Cardio targets.',
    'Remove a movement, stretch or cardio along with its logged days; delete a day in History.',
  ] },
  { v: '', date: '2026-08-21', notes: [
    'The first release: Tally as an installable web app, in English and Thai. Your data stays on your device.',
  ] },
];
