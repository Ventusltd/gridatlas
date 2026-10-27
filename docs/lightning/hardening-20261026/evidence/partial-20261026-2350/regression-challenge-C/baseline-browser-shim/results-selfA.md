# baseline-browser-shim proof run — generation 202609241334

- base URL: http://127.0.0.1:8143/gridatlas/atlas/  | live: https://ventusltd.github.io/gridatlas/atlas/
- route boots here: **true**  | live reachable: **null**  | node v22.23.4 | playwright 1.63.0  | offline shim: **ON (/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/runners/shim-preload.cjs)**
- tally: FAIL 3, PASS 1

| # | proof | kind | target | result | duration | first error line |
|--:|---|---|---|---|--:|---|
| 1 | deep-link-visibility | browser-self-served | self-served http://127.0.0.1:<random>/atlas/ (same bytes as http://127 | **FAIL** — pre-existing on main — exit 1 | 15.8s | FAILURES |
| 2 | deep-link-technology-buckets | browser-self-served | self-served http://127.0.0.1:<random>/atlas/ (same bytes as http://127 | **FAIL** — pre-existing on main — exit 1 | 2.3s | FAILURES |
| 3 | export-print-and-image-outcomes | browser-self-served | self-served http://127.0.0.1:<random>/atlas/ (same bytes as http://127 | **FAIL** — pre-existing on main — exit 1 | 26.5s | 16 export outcome check(s) failed |
| 4 | repd-deep-link-sweep | browser-self-served | self-served http://127.0.0.1:<random>/atlas/ (same bytes as http://127 | **PASS** | 1.3s | arrived 2 · no identity 0 · page error 0  (of 2) |
