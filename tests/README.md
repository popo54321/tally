# Tests

`npm test` runs everything below; CI runs the same on every push to a `tally-*` branch.

## Compared with the last reviewed version

`tests/baseline.json` names the **baseline**: the last version that was reviewed (always the published
version right after a publish). Two checks compare the current code with it:

```
node tests/calc.mjs           # every calculation, wording and storage rule on thousands of random inputs
node tests/record.mjs base    # photograph every screen of the baseline     -> tests/out/base/
node tests/record.mjs new     # photograph every screen of the current build -> tests/out/new/
node tests/compare.mjs        # list differences; side-by-side pictures in tests/out/diff/
```

Any difference fails, unless `tests/expected-changes.mjs` lists it with the reason (a picture-name
pattern, `calc:<case>` or `text:<key>`). After reviewing a change, and at every publish, move the
baseline forward to that commit and empty the list. The baseline is unpacked into `tests/.baseline/`.

Every run uses the same clock (Tuesday 10 November 2026, 09:00 Bangkok time), language, screen sizes
and sample data, and turns off fades, so two runs of the same app give the same pictures.
Differences of up to 4 brightness levels per pixel, and up to 32 faint stray pixels where an overlay
or shadow is blended, are ignored: that is the browser's own rendering noise and cannot be seen.

What gets photographed: every visible card on every page and the top bar, for three sample data
sets (`full-male`, `full-female`, `sparse`) on phone and desktop at 100% and 150% text; each colour
theme; a brand-new user with the welcome dialog; an empty app; saved data with the quirks older
versions left behind (`old-shapes`); importing an 8.1 backup and a bare list of days; and a set of
interactions (date picker, typed meals, chart press and pick, add movement, session change, plate
calculator, folded chart, copy a day, routine editor, adding a routine).

## Feature checks

`estimate` (maintenance estimate against simulated people), `storage` (updating from 8.1 data, saving,
six-month packing, going back to the previous version, crashes, damage), `copyday`, `tour`, `fold`,
`plates`, `coachapply`, `chartpick`, `headroom`, `routines`. Sample data: `npm run fixtures` rebuilds
`tests/fixtures/` (only when it should change).

The frozen 8.1 app, which the rebuild was checked against up to 9.4, is kept on the `legacy-8.1` branch.
