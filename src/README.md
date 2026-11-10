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
| `ui/` | Pages, cards and shared pieces (charts, day picker, dialogs). Each card draws from the state and redraws only when its own data changes. | everything above, `i18n/` |
| `platform/` | Device links: offline helper, install banner, Android file saving, Android Back button, rest-timer alarms. | `ui/`, `state/`, `i18n/` |
| `legacy/` | The 8.1 code, still in one piece. It shrinks as each part moves into the folders above, with all picture checks re-run after every move. When it is empty, it is deleted. | anything (temporary) |

`build/check-layers.mjs` fails the build if a file imports from a folder its row does not allow.
