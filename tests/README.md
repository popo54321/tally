# Tests

These record exactly how Tally looks and behaves, so the rebuilt app can be checked against the
frozen 8.1 app (`legacy/index.html`) picture by picture.

```
npm install                    # once
npm run fixtures               # rebuild the sample data in tests/fixtures/ (only when it should change)
npm run record:old             # photograph the 8.1 app      -> tests/out/old/
npm run record:new             # photograph the rebuilt app  -> tests/out/new/
npm run compare                # any difference is listed, with side-by-side pictures in tests/out/diff/
```

Every run uses the same clock (Tuesday 10 November 2026, 09:00 Bangkok time), language, screen sizes
and sample data, and turns off fades, so two runs of the same app give the same pictures.
Differences of up to 4 brightness levels per pixel, and up to 32 faint stray pixels where an overlay
or shadow is blended, are ignored: that is the browser's own rendering noise and cannot be seen.

What gets photographed: every visible card on every page and the top bar, for three sample data
sets (`full-male`, `full-female`, `sparse`) on phone and desktop at 100% and 150% text; each colour
theme; a brand-new user with the welcome dialog; an empty app; saved data with the quirks older
versions left behind (`old-shapes`); importing an 8.1 backup and a bare list of days; and a set of
interactions (date picker, typed meals, chart press and pick, add movement, session change,
plate calculator, folded chart).
