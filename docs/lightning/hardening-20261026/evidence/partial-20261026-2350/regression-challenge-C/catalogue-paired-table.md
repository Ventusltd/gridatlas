# Browser proof catalogue — paired baseline vs candidate (regression-challenge-C)

Harness: lead offline shim (runners/shim-preload.cjs) on both sides, Playwright 1.63.0 Chromium headless, concurrency 1, same catalogue (runners/run-chunked.mjs). Baseline = main c08f3a6 via shadow-baseline, base http://127.0.0.1:8143/gridatlas/atlas/ ; candidate = fda6b10 bytes via shadow-candidate, base http://127.0.0.1:8144/wt/atlas/v/202610261949/ .

| proof | baseline | candidate | same | baseline first error | candidate first error |
|---|---|---|---|---|---|
| menu-bar-mobile-hit | PASS | PASS | yes | "pageErrors": [], | "pageErrors": [], |
| menu-bar-attrib-clearance | FAIL | FAIL | yes | FAILURES | FAILURES |
| menu-bar-instrument-panel-202609041250 | FAIL | FAIL | yes | FAILURES | FAILURES |
| all-controls-desktop | FAIL | FAIL | yes | desktop csv-export-loaded false TimeoutError: page.waitForFunction: Timeout 60000ms exceeded. | name: 'Error' |
| all-controls-mobile | FAIL | FAIL | yes | android-emulation csv-export-loaded false TimeoutError: page.waitForFunction: Timeout 60000ms exceeded. | android-emulation csv-export-loaded false TimeoutError: page.waitForFunction: Timeout 60000ms exceeded. |
| grid-subs-chips-on-desktop | FAIL | FAIL | yes | FAIL  1400x900 desktop  on the map: [] | FAIL  1400x900 desktop  on the map: [] |
| pdf-export-outcomes-202609051329 | BLOCKED_HARNESS | BLOCKED_HARNESS | yes | name: 'Error' | name: 'Error' |
| screen-grab-print-outcomes | PASS | PASS | yes | 18 passed, 0 failed, 18 checks | 18 passed, 0 failed, 18 checks |
| teleprint-evidence | PASS | PASS | yes | 2 passed, 0 failed, 2 sessions (1 pdf, 1 source) | 2 passed, 0 failed, 2 sessions (1 pdf, 1 source) |
| deep-link-visibility | FAIL | FAIL | yes | FAILURES | FAILURES |
| deep-link-technology-buckets | FAIL | FAIL | yes | FAILURES | FAILURES |
| export-print-and-image-outcomes | FAIL | FAIL | yes | 16 export outcome check(s) failed | 16 export outcome check(s) failed |
| repd-deep-link-sweep | PASS | PASS | yes | arrived 2 · no identity 0 · page error 0  (of 2) | arrived 2 · no identity 0 · page error 0  (of 2) |
| arrival-engine-sweep-202609072356 | PASS | PASS | yes | technology       cases  answered  declined  pending  silent  error  engines / reasons | technology       cases  answered  declined  pending  silent  error  engines / reasons |
| arrival-identity-202609040229 | FAIL | FAIL | yes | name: 'Error' | name: 'Error' |
| transit-layer-availability-202609040219 | FAIL | FAIL | yes | name: 'Error' | name: 'Error' |
| uk-lightning-preview | PASS | FAIL | **NO** | … | AssertionError [ERR_ASSERTION]: baseline generation mismatch |
| all-layer-clicks-1440 (per layer, 60 ids) | {"PASS":12,"NOT-LOADED [FAIL]":40,"ERR:target-crashed":6,"ERR:timeout getByRole('button', { name: 'Grid', exact: true })\u001b[22m":2} | {"PASS":12,"NOT-LOADED [FAIL]":41,"ERR:target-crashed":7} | **NO** |  |  |
| all-layer-clicks-393 (per layer, 60 ids) | {"PASS":12,"NOT-LOADED [FAIL]":41,"ERR:target-crashed":7} | {"PASS":12,"NOT-LOADED [FAIL]":41,"ERR:target-crashed":7} | yes |  |  |

## all-layer-clicks-1440: per-layer differences

| layer | baseline | candidate |
|---|---|---|
| metro | ERR:timeout getByRole('button', { name: 'Grid', exact: true })[22m | ERR:target-crashed |
| solar_operational | ERR:timeout getByRole('button', { name: 'Grid', exact: true })[22m | NOT-LOADED [FAIL] |

## all-layer-clicks-393: per-layer differences

| layer | baseline | candidate |
|---|---|---|

## all-controls-desktop: per-step pairing (26 steps, 3 differ)

| step | baseline | candidate | same |
|---|---|---|---|
| menu-File | ok | ok | yes |
| menu-Edit | ok | ok | yes |
| menu-View | ok | ok | yes |
| menu-Scope | ok | ok | yes |
| menu-Grid | ok | ok | yes |
| menu-About | ok | ok | yes |
| btn-status | ok | ok | yes |
| btn-radius | ok | ok | yes |
| btn-radius-area | ok | ok | yes |
| btn-zonedraw | ok | ok | yes |
| btn-measure | ok | ok | yes |
| fullscreen | ok | ok | yes |
| basemaps | ok | ok | yes |
| csv-export | ok | ok | yes |
| expand-View | ok | ok | yes |
| expand-About | ok | ok | yes |
| layer-panel-toggle | ok | ok | yes |
| gridatlas-export-image | ok | ok | yes |
| gridatlas-export-pdf | ok | ok | yes |
| gridatlas-export-print | ok | ok | yes |
| csv-export-loaded | timeout | timeout | yes |
| search | timeout | timeout | yes |
| pipeline-same | timeout | timeout | yes |
| pipeline-wider | timeout | ERR:renderer-crashed(OOM) | **NO** |
| pipeline-all | timeout | ERR:renderer-crashed(OOM) | **NO** |
| card-minimise-restore-close | ok | ERR:renderer-crashed(OOM) | **NO** |

## all-controls-mobile: per-step pairing (26 steps, 0 differ)

| step | baseline | candidate | same |
|---|---|---|---|
| menu-File | ok | ok | yes |
| menu-Edit | ok | ok | yes |
| menu-View | ok | ok | yes |
| menu-Scope | ok | ok | yes |
| menu-Grid | ok | ok | yes |
| menu-About | ok | ok | yes |
| btn-status | ok | ok | yes |
| btn-radius | ok | ok | yes |
| btn-radius-area | ok | ok | yes |
| btn-zonedraw | ok | ok | yes |
| btn-measure | ok | ok | yes |
| fullscreen | ok | ok | yes |
| basemaps | ok | ok | yes |
| csv-export | ok | ok | yes |
| expand-View | ok | ok | yes |
| expand-About | ok | ok | yes |
| layer-panel-toggle | ok | ok | yes |
| gridatlas-export-image | ok | ok | yes |
| gridatlas-export-pdf | ok | ok | yes |
| gridatlas-export-print | ok | ok | yes |
| csv-export-loaded | timeout | timeout | yes |
| search | timeout | timeout | yes |
| pipeline-same | timeout | timeout | yes |
| pipeline-wider | timeout | timeout | yes |
| pipeline-all | timeout | timeout | yes |
| card-minimise-restore-close | ok | ok | yes |
