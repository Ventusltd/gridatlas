# baseline-browser-shim proof run — generation 202609241334

- base URL: http://127.0.0.1:8143/gridatlas/atlas/  | live: https://ventusltd.github.io/gridatlas/atlas/
- route boots here: **true**  | live reachable: **null**  | node v22.23.4 | playwright 1.63.0  | offline shim: **ON (/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/runners/shim-preload.cjs)**
- tally: FAIL 1, BLOCKED_HARNESS 1, PASS 2

| # | proof | kind | target | result | duration | first error line |
|--:|---|---|---|---|--:|---|
| 1 | grid-subs-chips-on-desktop | browser-route | http://127.0.0.1:8143/gridatlas/atlas/ | **FAIL** — pre-existing on main — exit 1 | 8.8s | FAIL  1400x900 desktop  on the map: [] |
| 2 | pdf-export-outcomes-202609051329 | browser-route | http://127.0.0.1:8143/gridatlas/atlas/ | **BLOCKED_HARNESS** — tooling: Executable doesn't exist at /opt/pw-browsers/firefox-1543/firefox/firefox | 15.8s | name: 'Error' |
| 3 | screen-grab-print-outcomes | browser-route | http://127.0.0.1:8143/gridatlas/atlas/ | **PASS** | 11.0s | 18 passed, 0 failed, 18 checks |
| 4 | teleprint-evidence | browser-route | http://127.0.0.1:8143/gridatlas/atlas/ | **PASS** | 21.4s | 2 passed, 0 failed, 2 sessions (1 pdf, 1 source) |
