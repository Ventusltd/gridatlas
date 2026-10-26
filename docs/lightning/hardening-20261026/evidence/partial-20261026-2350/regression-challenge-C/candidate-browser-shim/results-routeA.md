# candidate-browser-shim proof run — generation 202610261949

- base URL: http://127.0.0.1:8144/wt/atlas/v/202610261949/  | live: https://ventusltd.github.io/gridatlas/atlas/
- route boots here: **true**  | live reachable: **null**  | node v22.23.4 | playwright 1.63.0  | offline shim: **ON (/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/runners/shim-preload.cjs)**
- tally: FAIL 1, BLOCKED_HARNESS 1, PASS 2

| # | proof | kind | target | result | duration | first error line |
|--:|---|---|---|---|--:|---|
| 1 | grid-subs-chips-on-desktop | browser-route | http://127.0.0.1:8144/wt/atlas/v/202610261949/ | **FAIL** — exit 1 | 9.0s | FAIL  1400x900 desktop  on the map: [] |
| 2 | pdf-export-outcomes-202609051329 | browser-route | http://127.0.0.1:8144/wt/atlas/v/202610261949/ | **BLOCKED_HARNESS** — tooling: Executable doesn't exist at /opt/pw-browsers/firefox-1543/firefox/firefox | 15.6s | name: 'Error' |
| 3 | screen-grab-print-outcomes | browser-route | http://127.0.0.1:8144/wt/atlas/v/202610261949/ | **PASS** | 8.7s | 18 passed, 0 failed, 18 checks |
| 4 | teleprint-evidence | browser-route | http://127.0.0.1:8144/wt/atlas/v/202610261949/ | **PASS** | 17.5s | 2 passed, 0 failed, 2 sessions (1 pdf, 1 source) |
