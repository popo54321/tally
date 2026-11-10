# How the code is organised

Everything here is joined into one `dist/index.html` by `build/build.mjs`, because the web host
and the Android app both expect a single file. Phones get exactly one script; the folders below only
exist to keep the code easy to change.

| Folder | Job | May use |
|---|---|---|
| `core/` | Pure maths: dates, units, weight trend, calorie estimate, protein aim, body fat, strength scores, next-session suggestions, weekly sets per muscle, plate maths, fasting rules. No screen and no storage: everything it needs comes in as arguments ("today" defaults to the phone's clock). | `core/`, `data/` |
| `data/` | Fixed lists: the lift, stretch and cardio libraries, equipment, muscles, colour themes. | `data/` |
| `i18n/` | Every word the app shows. | nothing |
| `store/` | The only code that reads or writes saved data: storage access, format versions, upgrading older data, packing old months into half-year bundles, backup import and export. | `core/`, `data/` |
| `state/` | The one record of what the app currently knows, changed only through named actions (log a set, tick a stretch, copy a day, undo). Each action saves only what it changed. | `core/`, `data/`, `store/` |
| `platform/` | Device services with no screen of their own: the offline helper (`sw.js`), its start-up registration (`boot.js`) and the Android rest-timer alarm bridge. | `core/`, `data/` |
| `ui/` | One file per page or card (`body`, `workout-log`, `plates`, `mobility`, `cardio`, `guide`, `gym`, `history`, `sync`, ...), plus shared pieces: `charts`, `dialog`, `datepicker`, `picker`, `movements`, `dom`, `nav`, `view` (screen state that is never saved) and `start` (start-up). | everything above, `i18n/` |

`build/check-layers.mjs` fails the build if a file imports from a folder its row does not allow, and
`build/check-names.mjs` fails it if a `.js` file uses a name it neither defines nor imports.
The `.js` files under `ui/` are the 8.1 screen code moved as it was; they become typed `.ts` files
one at a time.
