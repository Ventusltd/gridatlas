| proof | as-is (table 1) | first error, as-is | under shim (table 2) | duration (shim) |
|---|---|---|---|--:|
| `scope-lint` | FAIL (pre-existing on main) | [scope-loop:lint] Error: active workflow budget mismatch:  | — (not a browser proof / live-only) | 0 s |
| `scope-state-stdout` | FAIL (pre-existing on main) | [scope-loop:state] Error: active workflow budget mismatch: | — (not a browser proof / live-only) | 0 s |
| `scope-verify-compose` | PASS | {"composition":"PASS","generation":"202609241334","release | — (not a browser proof / live-only) | 0 s |
| `run-current` | PASS | "FAILED" | — (not a browser proof / live-only) | 0 s |
| `v8-layers-panel-restored` | PASS | v8 layers panel restored: PASS — 9 checks against the comp | — (not a browser proof / live-only) | 0 s |
| `menu-bar-dom` | PASS |  | — (not a browser proof / live-only) | 0 s |
| `menu-bar-mobile-hit` | PASS | "pageErrors": [], | PASS | 7 s |
| `menu-bar-attrib-clearance` | BLOCKED_HARNESS (stale proof, pre-existing) | FAILURES | BLOCKED_HARNESS (stale proof, pre-existing) | 12 s |
| `all-controls-desktop` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 90000ms exceeded. | PASS 21/26 · BLOCKED_DEPENDENCY 5 | 341 s |
| `all-controls-mobile` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 90000ms exceeded. | PASS 21/26 · BLOCKED_DEPENDENCY 5 | 352 s |
| `all-layer-clicks-1440` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 60000ms exceeded. | PASS 12/60 · BLOCKED_DEPENDENCY 48/60 | 744 s |
| `all-layer-clicks-393` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 60000ms exceeded. | PASS 12/60 · BLOCKED_DEPENDENCY 48/60 | 463 s |
| `grid-subs-chips-on-desktop` | BLOCKED_DEPENDENCY | locator.waitFor: Timeout 90000ms exceeded. | FAIL (pre-existing on main) | 30 s |
| `pdf-export-outcomes-202609051329` | BLOCKED_HARNESS | name: 'Error' | PASS chromium 16/16 · BLOCKED_HARNESS firefox+webkit | 22 s |
| `screen-grab-print-outcomes` | BLOCKED_DEPENDENCY | locator.waitFor: Timeout 90000ms exceeded. | PASS | 20 s |
| `export-print-and-image-outcomes` | BLOCKED_DEPENDENCY | locator.click: Timeout 10000ms exceeded. | PASS 50/66 · BLOCKED_DEPENDENCY 16 | 48 s |
| `teleprint-evidence` | BLOCKED_DEPENDENCY | FAIL 01-pdf-phone-portrait :: locator.waitFor: Timeout 900 | PASS | 91 s |
| `deep-link-visibility` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 120000ms exceeded. | PASS 9/10 · BLOCKED_HARNESS 1 | 22 s |
| `deep-link-technology-buckets` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 120000ms exceeded. | PASS 5/6 · BLOCKED_HARNESS 1 | 6 s |
| `repd-deep-link-sweep` | BLOCKED_DEPENDENCY | arrived 1 · no identity 0 · page error 1  (of 2) | PASS | 5 s |
| `arrival-engine-sweep-202609072356` | BLOCKED_DEPENDENCY | technology       cases  answered  declined  pending  silen | PASS | 260 s |
| `arrival-identity-202609040229` | BLOCKED_DEPENDENCY | page.waitForFunction: Timeout 120000ms exceeded. | BLOCKED_DEPENDENCY (DuckDB +esm) | 193 s |
| `uk-lightning-preview` | BLOCKED_DEPENDENCY | GRIDATLAS_LOAD_DIAGNOSTIC {"mode":"baseline","width":1440, | PASS | 113 s |
| `live-all-controls-desktop` | BLOCKED_DEPENDENCY | page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://ve | — (not a browser proof / live-only) | 6 s |
| `layer-census-cpu` | BLOCKED_HARNESS | Traceback (most recent call last): | — (not a browser proof / live-only) | 1 s |
| `verify-layers-local-ps1` | BLOCKED_HARNESS | Error: spawn pwsh ENOENT | — (not a browser proof / live-only) | 0 s |
