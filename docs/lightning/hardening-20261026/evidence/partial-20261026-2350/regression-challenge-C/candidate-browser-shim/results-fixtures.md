# candidate-browser-shim proof run — generation 202610261949

- base URL: http://127.0.0.1:8144/wt/atlas/v/202610261949/  | live: https://ventusltd.github.io/gridatlas/atlas/
- route boots here: **true**  | live reachable: **null**  | node v22.23.4 | playwright 1.63.0  | offline shim: **ON (/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/runners/shim-preload.cjs)**
- tally: PASS 1, FAIL 3

| # | proof | kind | target | result | duration | first error line |
|--:|---|---|---|---|--:|---|
| 1 | menu-bar-mobile-hit | browser-fixture | fixture DOM + atlas/modules/202609031958-menu-bar.js + production full | **PASS** | 0.8s | "pageErrors": [], |
| 2 | menu-bar-attrib-clearance | browser-fixture | fixture DOM + menu-bar module | **FAIL** — exit 1 | 1.8s | FAILURES |
| 3 | menu-bar-instrument-panel-202609041250 | browser-fixture | fixture DOM + menu-bar module | **FAIL** — exit 1 | 4.0s | FAILURES |
| 4 | all-controls-desktop | browser-route | http://127.0.0.1:8144/wt/atlas/v/202610261949/ | **FAIL** — exit 1 | 199.8s | name: 'Error' |
