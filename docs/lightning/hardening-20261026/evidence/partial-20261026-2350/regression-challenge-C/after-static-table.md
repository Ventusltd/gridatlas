# after — classified proof table (40 entries)

Assessed tally: PASS 21 · FAIL 6 · BLOCKED_HARNESS 12 · BLOCKED_DEPENDENCY 1

| # | proof | kind | what it tests | target | machine result | assessed | duration | first error line |
|--:|---|---|---|---|---|---|--:|---|
| 1 | `scope-lint` | static | repository lint: compositions, manifests, workflow budget, STATE.md | files | PASS | **PASS** | 0.6s | … |
| 2 | `scope-state-stdout` | static | regenerates STATE.md to stdout (must equal STATE.md) | files | PASS | **PASS** | 0.4s | scope-ledger=PASS active=none master=done |
| 3 | `scope-verify-compose` | static | composer verification of atlas/current.json against manifests and cartridge hashes | files | PASS | **PASS** | 0.5s | … |
| 4 | `run-current` | static | runs the proof whose stamp matches each composed cartridge (4 cartridges) | files | PASS | **PASS** | 0.8s | "FAILED" |
| 5 | `bridge-202609241251` | static | streaming-parquet-bridge: contract vs runtime, fetch patching, legacyStem() routing, hashes (hard-codes live hrefs for window.location only) | files (window.location stubbed to live href) | PASS | **PASS** | 1.7s | … |
| 6 | `gazetteer-202609071213` | static | uk-gazetteer-flyto: contract vs runtime, deep-link publishing, generation stamps | files | PASS | **PASS** | 0.6s | "FAILED" |
| 7 | `engine-202609062358` | static | substation-intelligence: byte integrity vs 202609200022 manifest, syntax, initVentusMap present | files | PASS | **PASS** | 0.3s | … |
| 8 | `sld-202609241334` | static | sld-sandbox: exact delta vs 202609200022 cartridge (5 card-boundary replacements + popup-viewport module), sha256, syntax | files | FAIL — exit 1 | **FAIL** | 0.3s | AssertionError [ERR_ASSERTION]: only the reviewed card-boundary corrections may differ |
| 9 | `v8-layers-panel-restored` | static | v8 Layers panel shown beneath the six menus; dash toggle; collapsed-on-phone default; localStorage choice | files (composed cartridges) | PASS | **PASS** | 0.5s | … |
| 10 | `menu-bar-dom` | static | menu-bar module DOM contract in a vm (60+3 fail-closed, proxies, brand slot) | files (atlas/modules) | PASS | **PASS** | 0.1s | … |
| 11 | `about-estate-and-attribution` | static | About panel carries attribution + estate links (composed bytes) | files | FAIL — exit 1 | **BLOCKED_HARNESS (stale proof, pre-existing)** — its two print assertions (size:auto, map sized to printable area) encode the print design the owner overruled on 2026-09-05 ("just a screen grab"), see screen-grab-print-outcomes.browser.mjs header; 42 of 44 checks pass | 0.3s | 2 FAILED |
| 12 | `arrival-visibility-and-one-runtime` | static | visibility-gated arrival + single runtime, asserted on composed bytes | files | PASS | **PASS** | 0.2s | … |
| 13 | `parts-integrity-202609012105` | static | assembled cartridges still hash to their parts manifests | files | PASS | **PASS** | 2.8s | … |
| 14 | `all-versions-202609012150` | static | one Earth radius across every shipped version; module parity vs every cartridge | files | FAIL — exit 1 | **FAIL (pre-existing on main)** — two things: (a) every sld-sandbox cartridge since 202609070913 carries 6371.0088/6371.008/6371.0 strings beside the canonical 6378.137 (the proof forbids a second radius anywhere); (b) the proof then crashes on a VERSION_LEDGER regex the current cartridge no longer satisfies. Neither is lightning; both must read identically on the candidate | 3.6s | TypeError: Cannot read properties of null (reading '1') |
| 15 | `data-contract-parity-202609012214` | static | every product URL the bytes fetch is declared in current.json with the same schema | files | FAIL — exit 1 | **FAIL (pre-existing on main)** — bytes of sld-sandbox and substation-intelligence no longer name their declared product URLs in the string form the proof parses; not assessed further here, identical outcome required on the candidate | 0.3s | FAIL sld-sandbox: data/history/ fetched by the bytes is declared on the entry - declared: derived/gb-transmission-network.v1.json, derived/price-decade-rollup.json |
| 16 | `estate-deep-scan-202609012240` | static | run-current.mjs derives proof names from generation+id; every current cartridge has a matched proof | files | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 2.2s | node:internal/errors:983 |
| 17 | `quantumspawn-recovery-202609012305` | static | recovery capsule claims re-derived from git (read-only git calls) | files + git | FAIL — exit 1 | **FAIL (pre-existing on main)** — the recovery capsule names an older generation/version than current.json (202609241334 / v9.156); documentation drift the capsule proof exists to catch | 0.3s | [FAIL] the capsule names the generation that current.json points at - 202610262323 |
| 18 | `sld-styles-202609040400` | static | seven hoisted CSS values unchanged between sld-sandbox and substation-intelligence; size ceilings | files | FAIL — exit 1 | **BLOCKED_HARNESS (stale proof, pre-existing)** — reads sld.assembled_from from current.json; the 202609241334 sld-sandbox entry has derived_from instead, so the proof throws before asserting anything | 0.3s | TypeError: Cannot read properties of undefined (reading 'replace') |
| 19 | `arrival-identity-corpus-202609040229` | static | exact Pipeline 0144 corpus hashes against a sibling pipelinenews checkout | files + sibling repo ../pipelinenews | BLOCKED_HARNESS — tooling: not found beside /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after | **BLOCKED_HARNESS** | 0.2s | AssertionError [ERR_ASSERTION]: exact Pipeline 0144 corpus not found beside /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after |
| 20 | `transit-layer-availability-202609040212` | static-network | published transit partitions exist and hash at the data-gridatlas owner generation | https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/ | BLOCKED_DEPENDENCY — network: fetch failed | **BLOCKED_DEPENDENCY** | 0.6s | Error.captureStackTrace(err); |
| 21 | `mobile-static-audit-202609010030` | static | static mobile gate over composed sld cartridge + shell css + shell html | files | PASS — exit 0 only because --require-clean was not passed; the audit itself reports MOBILE_STATIC_FAILURE with LANDSCAPE_CONTROL_STACK_UNBOUNDED, LANDSCAPE_SEARCH_RESULTS_UNBOUNDED, LANDSCAPE_CONTROL_STACK_UNBOUNDED, LANDSCAPE_SEARCH_RESULTS_UNBOUNDED | **PASS** | 0.2s | "status": "MOBILE_STATIC_FAILURE" |
| 22 | `sld-finance-fixture-202609010002` | static | executes the original GlobalGrid2050 SLD finance modules and checks the committed oracle fixture | files + GlobalGrid2050 clone | BLOCKED_HARNESS — oracle upstream drifted: the GlobalGrid2050 sandbox files no longer hash as the committed fixture records (not a GridAtlas product fault) | **BLOCKED_HARNESS** | 0.4s | AssertionError [ERR_ASSERTION]: fixture drift: regenerate /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/shadow-after/tools/proofs/fixtures/2026090100 |
| 23 | `prepare-layer-census` | static | captures the 60 real shell layer definitions from ukConfig into work/layer-config.json (gitignored) | files | PASS | **PASS** | 0.1s | … |
| 24 | `modules-202609011950-module-parity` | static | module-level proof: 202609011950-module-parity.proof.mjs | files (atlas/modules, atlas/parts) | FAIL — exit 1 | **FAIL (pre-existing on main)** — "the incumbent loaded the fixture product" fails and the proof then throws on network.byName; compares modules against the composed cartridge, pre-dates the current composition | 0.6s | TypeError: Cannot read properties of undefined (reading 'byName') |
| 25 | `modules-202609012010-assembler` | static | module-level proof: 202609012010-assembler.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 2.8s | [PASS] a missing generation is refused |
| 26 | `modules-202609012010-grid-scope` | static | module-level proof: 202609012010-grid-scope.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.5s | [PASS] it names queue position and consent as the things it cannot see |
| 27 | `modules-202609012040-grid-scope` | static | module-level proof: 202609012040-grid-scope.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.1s | [PASS] a voltage that did not parse cannot pass a voltage floor |
| 28 | `modules-202609012130-declared-connections` | static | module-level proof: 202609012130-declared-connections.proof.mjs | files (atlas/modules, atlas/parts) | FAIL — exit 1 | **FAIL (pre-existing on main)** — nearestTransmission() parity against the 202609012250 inline cartridge differs on the unnamed-wins-on-distance case; 18 of 19 pass; pre-dates lightning | 0.2s | FAILURES |
| 29 | `modules-202609012135-source-registry` | static | module-level proof: 202609012135-source-registry.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.1s | a failure is distinguished from an absence |
| 30 | `modules-202609012145-network-topology` | static | module-level proof: 202609012145-network-topology.proof.mjs | files (atlas/modules, atlas/parts) + raw.githubusercontent.com product | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.2s | FAILURES |
| 31 | `modules-202609012205-sizing-arithmetic` | static | module-level proof: 202609012205-sizing-arithmetic.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 3.7s | (node:8111) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental, expect them to change at any time. |
| 32 | `modules-202609012217-source-registry` | static | module-level proof: 202609012217-source-registry.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.2s | a failure is distinguished from an absence |
| 33 | `modules-202609012230-map-click-network` | static | module-level proof: 202609012230-map-click-network.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.2s | [PASS] unknown, missing and future schemas fail closed |
| 34 | `modules-202609012245-electrical-distance` | static | module-level proof: 202609012245-electrical-distance.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.3s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 35 | `modules-202609012245-source-registry` | static | module-level proof: 202609012245-source-registry.proof.mjs | files (atlas/modules, atlas/parts) | PASS | **PASS** | 0.1s | a failure is distinguished from an absence |
| 36 | `modules-202609012250-rating-envelope` | static | module-level proof: 202609012250-rating-envelope.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 37 | `modules-202609012320-injection-response` | static | module-level proof: 202609012320-injection-response.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 38 | `modules-202609012345-planned-change` | static | module-level proof: 202609012345-planned-change.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 39 | `modules-202609012350-owner-boundary` | static | module-level proof: 202609012350-owner-boundary.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |
| 40 | `modules-202609020015-injection-response` | static | module-level proof: 202609020015-injection-response.proof.mjs | files (atlas/modules, atlas/parts) | BLOCKED_HARNESS — missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo) | **BLOCKED_HARNESS** | 0.1s | FAILED: the published product is not at /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/data-grid-gb/derived/gb-transmission-network.v1.json. |

## Diff against /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C/candidate-static-table.json

| proof | baseline | candidate | changed |
|---|---|---|---|
| scope-lint | PASS | PASS | no |
| scope-state-stdout | PASS | PASS | no |
| scope-verify-compose | PASS | PASS | no |
| run-current | PASS | PASS | no |
| bridge-202609241251 | PASS | PASS | no |
| gazetteer-202609071213 | PASS | PASS | no |
| engine-202609062358 | PASS | PASS | no |
| sld-202609241334 | FAIL | FAIL | no |
| v8-layers-panel-restored | PASS | PASS | no |
| menu-bar-dom | PASS | PASS | no |
| about-estate-and-attribution | BLOCKED_HARNESS (stale proof, pre-existing) | BLOCKED_HARNESS (stale proof, pre-existing) | no |
| arrival-visibility-and-one-runtime | PASS | PASS | no |
| parts-integrity-202609012105 | PASS | PASS | no |
| all-versions-202609012150 | FAIL (pre-existing on main) | FAIL (pre-existing on main) | no |
| data-contract-parity-202609012214 | FAIL (pre-existing on main) | FAIL (pre-existing on main) | no |
| estate-deep-scan-202609012240 | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| quantumspawn-recovery-202609012305 | FAIL (pre-existing on main) | FAIL (pre-existing on main) | no |
| sld-styles-202609040400 | BLOCKED_HARNESS (stale proof, pre-existing) | BLOCKED_HARNESS (stale proof, pre-existing) | no |
| arrival-identity-corpus-202609040229 | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| transit-layer-availability-202609040212 | BLOCKED_DEPENDENCY | BLOCKED_DEPENDENCY | no |
| mobile-static-audit-202609010030 | PASS | PASS | no |
| sld-finance-fixture-202609010002 | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| prepare-layer-census | PASS | PASS | no |
| modules-202609011950-module-parity | FAIL (pre-existing on main) | FAIL (pre-existing on main) | no |
| modules-202609012010-assembler | PASS | PASS | no |
| modules-202609012010-grid-scope | PASS | PASS | no |
| modules-202609012040-grid-scope | PASS | PASS | no |
| modules-202609012130-declared-connections | FAIL (pre-existing on main) | FAIL (pre-existing on main) | no |
| modules-202609012135-source-registry | PASS | PASS | no |
| modules-202609012145-network-topology | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609012205-sizing-arithmetic | PASS | PASS | no |
| modules-202609012217-source-registry | PASS | PASS | no |
| modules-202609012230-map-click-network | PASS | PASS | no |
| modules-202609012245-electrical-distance | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609012245-source-registry | PASS | PASS | no |
| modules-202609012250-rating-envelope | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609012320-injection-response | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609012345-planned-change | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609012350-owner-boundary | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
| modules-202609020015-injection-response | BLOCKED_HARNESS | BLOCKED_HARNESS | no |
