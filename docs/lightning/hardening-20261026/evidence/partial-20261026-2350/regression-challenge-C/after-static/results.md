# after-static proof run — generation 202610262323

- base URL: http://127.0.0.1:8162/wt/atlas/v/202610262323/  | live: https://ventusltd.github.io/gridatlas/atlas/
- route boots here: **null**  | live reachable: **null**  | node v22.23.4 | playwright 1.63.0  | offline shim: **off**
- tally: PASS 21, FAIL 8, BLOCKED_HARNESS 10, BLOCKED_DEPENDENCY 1

| # | proof | kind | target | result | duration | first error line |
|--:|---|---|---|---|--:|---|
| 1 | scope-lint | static | files | **PASS** | 0.6s | … |
| 2 | scope-state-stdout | static | files | **PASS** | 0.4s | scope-ledger=PASS active=none master=done |
| 3 | scope-verify-compose | static | files | **PASS** | 0.5s | … |
| 4 | run-current | static | files | **PASS** | 0.8s | "FAILED" |
| 5 | bridge-202609241251 | static | files (window.location stubbed to live href) | **PASS** | 1.7s | … |
| 6 | gazetteer-202609071213 | static | files | **PASS** | 0.6s | "FAILED" |
| 7 | engine-202609062358 | static | files | **PASS** | 0.3s | … |
| 8 | sld-202609241334 | static | files | **FAIL** — exit 1 | 0.3s | AssertionError [ERR_ASSERTION]: only the reviewed card-boundary corrections may differ |
| 9 | v8-layers-panel-restored | static | files (composed cartridges) | **PASS** | 0.5s | … |
| 10 | menu-bar-dom | static | files (atlas/modules) | **PASS** | 0.1s | … |
| 11 | about-estate-and-attribution | static | files | **FAIL** — exit 1 | 0.3s | 2 FAILED |
| 12 | arrival-visibility-and-one-runtime | static | files | **PASS** | 0.2s | … |
| 13 | parts-integrity-202609012105 | static | files | **PASS** | 2.8s | … |
| 14 | all-versions-202609012150 | static | files | **FAIL** — exit 1 | 3.6s | TypeError: Cannot read properties of null (reading '1') |
| 15 | data-contract-parity-202609012214 | static | files | **FAIL** — exit 1 | 0.3s | FAIL sld-sandbox: data/history/ fetched by the bytes is declared on the entry - declared: derived/gb-transmission-network.v1.json, derived/price-decade-rollup.json |
| 16 | estate-deep-scan-202609012240 | static | files | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 2.2s | node:internal/errors:983 |
| 17 | quantumspawn-recovery-202609012305 | static | files + git | **FAIL** — exit 1 | 0.3s | [FAIL] the capsule names the generation that current.json points at - 202610262323 |
| 18 | sld-styles-202609040400 | static | files | **FAIL** — exit 1 | 0.3s | TypeError: Cannot read properties of undefined (reading 'replace') |
| 19 | arrival-identity-corpus-202609040229 | static | files + sibling repo ../pipelinenews | **BLOCKED_HARNESS** — tooling: not found beside /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after | 0.2s | AssertionError [ERR_ASSERTION]: exact Pipeline 0144 corpus not found beside /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after |
| 20 | transit-layer-availability-202609040212 | static-network | https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas | **BLOCKED_DEPENDENCY** — network: fetch failed | 0.6s | Error.captureStackTrace(err); |
| 21 | mobile-static-audit-202609010030 | static | files | **PASS** — exit 0 only because --require-clean was not passed; the audit itself reports MOBILE_STATIC_FAILURE with LANDSCAPE_CONTROL_STACK_UNBOUNDED, LANDSCAPE_SEARCH_RESULTS_UNBOUNDED, LANDSCAPE_CONTROL_STACK_UNBOUNDED, LANDSCAPE_SEARCH_RESULTS_UNBOUNDED | 0.2s | "status": "MOBILE_STATIC_FAILURE" |
| 22 | sld-finance-fixture-202609010002 | static | files + GlobalGrid2050 clone | **BLOCKED_HARNESS** — oracle upstream drifted: the GlobalGrid2050 sandbox files no longer hash as the committed fixture records (not a GridAtlas product fault) | 0.4s | AssertionError [ERR_ASSERTION]: fixture drift: regenerate /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after/tools/proofs/fixtures/2026090100 |
| 23 | prepare-layer-census | static | files | **PASS** | 0.1s | … |
| 24 | modules-202609011950-module-parity | static | files (atlas/modules, atlas/parts) | **FAIL** — exit 1 | 0.6s | TypeError: Cannot read properties of undefined (reading 'byName') |
| 25 | modules-202609012010-assembler | static | files (atlas/modules, atlas/parts) | **PASS** | 2.8s | [PASS] a missing generation is refused |
| 26 | modules-202609012010-grid-scope | static | files (atlas/modules, atlas/parts) | **PASS** | 0.5s | [PASS] it names queue position and consent as the things it cannot see |
| 27 | modules-202609012040-grid-scope | static | files (atlas/modules, atlas/parts) | **PASS** | 0.1s | [PASS] a voltage that did not parse cannot pass a voltage floor |
| 28 | modules-202609012130-declared-connections | static | files (atlas/modules, atlas/parts) | **FAIL** — exit 1 | 0.2s | FAILURES |
| 29 | modules-202609012135-source-registry | static | files (atlas/modules, atlas/parts) | **PASS** | 0.1s | a failure is distinguished from an absence |
| 30 | modules-202609012145-network-topology | static | files (atlas/modules, atlas/parts) + raw.githubusercontent.com product | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.2s | FAILURES |
| 31 | modules-202609012205-sizing-arithmetic | static | files (atlas/modules, atlas/parts) | **PASS** | 3.7s | (node:8111) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental, expect them to change at any time. |
| 32 | modules-202609012217-source-registry | static | files (atlas/modules, atlas/parts) | **PASS** | 0.2s | a failure is distinguished from an absence |
| 33 | modules-202609012230-map-click-network | static | files (atlas/modules, atlas/parts) | **PASS** | 0.2s | [PASS] unknown, missing and future schemas fail closed |
| 34 | modules-202609012245-electrical-distance | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.3s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 35 | modules-202609012245-source-registry | static | files (atlas/modules, atlas/parts) | **PASS** | 0.1s | a failure is distinguished from an absence |
| 36 | modules-202609012250-rating-envelope | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 37 | modules-202609012320-injection-response | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 38 | modules-202609012345-planned-change | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 39 | modules-202609012350-owner-boundary | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 40 | modules-202609020015-injection-response | static | files (atlas/modules, atlas/parts) | **BLOCKED_HARNESS** — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
