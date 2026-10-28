# M3-build: auto-activate the REPD layers of the 10 nearest projects, plus the M2 review fixes

Status: DONE at the 90-minute limit (23:02 UTC), with one open item. **The browser check was not run.** M2R-camera and M2R-l3regress never ended with DONE (l3regress is still queued behind M2R-taps, which has no report), and the brief allows a browser only after both are DONE. Node work, gates and both PR gates are done. Nothing is pushed.

## Deliverables
- **Generation:** 202610282215, v9.175.
  - candidate_predecessor = 202610282100 (M2).
  - previous = superseded = parent = 202610281340 (the live L3).
  - The base is still the original 202609241334 bytes.
  - An earlier cut, 202610282205, came before the M2R-layout fixes. It was dropped (never pushed), so v9.175 was reused.
- **Worktree:** `evidence/M3-build/gridatlas-wt`, branch `claude/lightning-M3-repd-layers-20261028`, cut from origin/main `fa992a6`.
- **Commits:**
  1. `606af52` tools/docs.
  2. `86c2183` the 6 scaffolder files.
- **Sizes:** module 56,944 B (cap 64,781; 7,837 B spare); cartridge 492,163 B (gate 500,000).
  - Module sha256 `62770e61…`. The cartridge sha256 (LF) is `b9a9e12b…`.
- **Tools** (`evidence/M3-build/tools/`):
  - `build-M3.mjs`: M2 module → M3 module; every edit is exact-once.
  - `layers-m3.part.js`: the layer bookkeeping.
  - `repd-m3.part.js`: the REPD block, readable, with the review fixes folded in.
  - `make-generation-M3.mjs`: the M2 scaffolder with predecessor M2.
  - `m3-test-edits.mjs`, `patch-tests-M3.mjs`, `m3-tests.txt`, `m3-review-tests.txt`.
  - `vendor-ci56.mjs`, `gates.sh`, `run-suites.sh`.
- **PR #56 (lead's request):** `evidence/M3-build/ci56-m3-suite.patch`, one commit `6abb503` on top of #56 `be5e375` (worktree `evidence/M3-build/ci56-wt`, branch `claude/ci56-m3-suite`).
  - It updates the vendored `tools/ci/lightning/overlay-engine.test.mjs` with the same edits, the M3 tests and the review-fix tests. CI1 and CI2 are kept.
  - `@gate-min-generation` is now 202610282215. The suite is RED on M2 by design (30 failures, all M2 wording).
  - With `LIGHTNING_DATA` the suite passes 193/193. Without it, 187 pass and 6 skip.
- **Merge note:** I dropped my docs/CI.md hunk (480 → 500 kB) because #56 makes the same fix. #56 + `606af52` + `86c2183` now apply without conflict.
  - Rehearsal branch: `claude/rehearsal-ci56-plus-M3` in `evidence/M3-build/combo-wt`.
  - #56's `pr-gate.mjs --base fa992a6` passes 12/12 there, with overlay-engine on 202610282215 at 187 pass, 0 fail, 6 skip.

## Recon: how the original switches REPD layers
- **Config:** shell `releases/202608300453-atlas-v9/index.html:241-262`, group "REPD (GeoJSON)".
  - Each base layer filters `['==',['get','tech'],<id>]`. The ids are solar, solar_roof, wind, bess, biomass, tidal, hydrogen, hydro, flywheel, act, geothermal and caes.
  - Those are exactly the register's `tech` values, so the mapping is the identity.
  - 'other' (1 row) has no layer. The `*_operational` layers are never touched.
- **Engine** (`cartridges/202609062358-substation-intelligence-v9-63.js`):
  - `buildDOM` (:1060-1112) builds `#scada-ui-container input[data-layer-id]` and a `#fs-curtain-keys` copy.
  - Each container has one delegated `change` listener (:1095, :1106). It syncs the other copy and calls the private `handleLayerToggle` (:1178), which sets visibility and the glow, updates the interactive ids, and hydrates `src-repd`.
  - menuBar (:4386-6080): each proxy forwards with `original.click()`, and the document `change` listener (:6077) re-syncs the proxy. `inspect()` only counts controls.
- **M3's path:** tick the original checkbox and dispatch a bubbling `change`. That is the event a reader's tap produces, so the engine and the menu bar keep their own state consistent. No click is synthesised, so the menu bar's outside-click closer is not triggered.

## M3 behaviour
- **Switching on.** Every list render (`RpR`, including filter changes) computes the techs of the listed sites within the filter and calls `Ry(techs)`.
  - Layers M3 holds that the list no longer needs go off.
  - Needed layers that are off go on and are recorded in `state.ly`.
  - A layer that is already on belongs to the reader and is never recorded or touched.
- **Release.** `Ry()` releases every layer M3 holds on:
  - × close and a tap on empty map;
  - lightning OFF;
  - a period, prev/next, custom or LOAD POINTS change (`ld` without refresh);
  - LATEST;
  - a register failure on a new tap.
- **Kept.** The layers stay through a row tap and back, so the project view shows the project's own dot. They also stay through the 10-minute refresh.
- **REPD dot taps.** A tap on a REPD dot belongs to the engine: the card closes, as in L3, and the dot stays.
- **Reader takes over.** If the reader ticks or unticks a layer M3 holds, from any surface, that layer becomes the reader's. The existing container listener `bt` handles this; M3's own dispatch runs with `state.lyx` set.
- **Card line.** "REPD map layers on for this list: Solar PV, Battery Storage, … (those switched on here go off when this card closes)".
- **Before a tap.** Nothing runs, so the arrival with lightning OFF is untouched.
- **Deliberate proof change.** The generation proof's static negative banned `data-layer-id` and `lbl-`. `make-generation-M3.mjs` narrows it to the two selector sites and the one label read, and asserts that the module never names or writes such a control. The manifest `contract` text says the same.
- **Manifest additions:** `uk_lightning.repd_layers` and `uk_lightning.repd_source` (M2R-provenance P2).

## M2 review fixes folded in
| Report | Findings | Applied |
|---|---|---|
| a11y | MAJOR-1 status region, MAJOR-2 chip focus, MAJOR-3 row/back focus, MINOR-1 back name | yes. The helper is named `Ra`; focus uses `?.focus?.()` |
| words | W1 (MAJOR) unknown is not 0 MW; W2 (MAJOR) collapsed summary; W3–W10 | yes |
| layout | MAJOR-1 open card capped at top + 320 px; MAJOR-2/MINOR-3 refit on a hidden point plus a details toggle refit; MINOR-4 11 px text | yes. F2's bottom padding merged with MD1 |
| bugs | M2RB1 modifier click; M2RB2 draw error | yes |
| repd | R1 ~10 m grouping; R2 wording; R3 status table | yes |
| security | SEC-M2-1/2 malformed rows | yes |
| data | D1 scheme MW counted once; D2 "capacity not stated"; D5 placeholder guard | yes |
| provenance | P1 DESNZ/OGL credit; P2 `repd_source` | yes |
| diff | MD1 short-map padding; MD2 = W2; MD3 = M2RB1 | yes |
| perf | MINOR-1/2 | no fix recommended; none made |
| release | MINOR-1 (`--prep-gate-kb` checked in preconditions; a failed cherry-pick removes the branch), MINOR-3, MINOR-4 | yes, in `606af52`. Negative repro: `out/neg-prep500.log` |
| release | MINOR-2 | n/a: verify-candidate is not on main |
| handoff | CI.md 480 kB | left to #56 |
| ci | MAJOR-1, MINOR-2..5 | that is PR #56; the M3 suite is vendored into it as above |

**Not folded in (no finished report by 23:00 UTC):** M2R-camera (IN PROGRESS), M2R-l3regress (IN PROGRESS, queued behind taps) and M2R-taps (no report file). The 12 other lanes are folded in.

## Tests
- **M3 tests** (`m3-tests.txt`, 9 tests). They use an engine stand-in: container listeners, the curtain copy, the menu proxy and visibility. Covered:
  - exact layers on and off, with the checkboxes in sync;
  - a reader layer surviving close;
  - the diff on a new tap;
  - the filter;
  - row tap and back;
  - OFF, period, LATEST, prev, custom and empty map;
  - a REPD-dot tap;
  - ownership hand-over;
  - a disabled control and the 'other' tech;
  - register failure;
  - Doncaster (53.45, −1.05) on the real register, against the independent brute force.
- **Review-fix tests** (`m3-review-tests.txt`, 6 tests): a11y, bugs, security, repd/data, diff and layout.
- **Fail-first:** all 15 fail on M2.
- **M2 expectations** changed only where a folded finding changes wording or grouping (`m3-test-edits.mjs`, each tagged). test-fixes changes only J1 (layout F2).
- **Generation module, 3 runs each:** test-engine 191/191, test-fixes 104/104, ChatGPT 8/8 and 6/6.
- All runs started after 21:40 UTC, after M2R-diff's 21:35 `pkill`.

## Gates
- `out/checks-202610282215.log`:
  - lint PASS;
  - STATE.md identical; STATE.md and current.json unchanged;
  - all 14 proofs PASS;
  - run-current, verify-compose and verify-candidate PASS.
- main's `tools/ci/pr-gate.mjs --base fa992a6` on the branch: 11/11 PASS (`out/pr-gate-202610282215.log`).
- #56's gate with M3: 12/12 PASS (`out/pr-gate-ci56-plus-M3.log`).

## Browser check: ready, NOT RUN (the browser rule was not met by 23:00 UTC)
- The scripts are ready. Each uses one Chromium and one context per case, with the offline shim, the real lightning data (M-build/lt) and the MR register. They serve `evidence/M3-build/serve` (wt → the worktree, `repd.json` → MR's export).
- `node evidence/M3-build/browser/m3.mjs` runs two cases at the Doncaster 12M cell (53.45, −1.05). It records, per REPD layer:
  - the main checkbox, its curtain copy and the menu proxy;
  - the map visibility and M3's own set;
  - `menuBar.inspect()`;
  - the project dots actually rendered at the listed sites.
- The cases cover tap, settle, row tap (with the project's own dot), back, close, retap and OFF. The second case starts with Solar ticked by the reader through the menu proxy, then presses the Solar/All filter and switches period.
- Output goes to `browser/m3.json` and `M3-*.png`.
- `node evidence/M3-build/browser/rest.mjs` then `node evidence/M3-build/browser/pixcmp.mjs` compare the rest state of live L3 (`/wt/atlas/`) and `/wt/atlas/v/202610282215/` at 393×659 and 393×852.
- The node rest-state argument holds: nothing in M3 runs before a tap. `RL`, `Ly` and `Ry` are only called from `RpR` or after a card or a switch-on, and the `bt` change is on listeners that L3 already installs.

## Residuals
- No browser or WebKit run for M3. The layout fix F1 (an open card capped at top + 320 px) needs the owner's iPhone check, as M2R-layout noted.
- The first REPD tap on a page loads the register twice. The module fetches it once, and the engine hydrates `src-repd` again when M3 switches a layer on. This is M2R-perf MINOR-1; it now happens on every first tap, which costs about 5 MB and one DuckDB query, once per page.
- With layers on, a tap that lands on a drawn project dot belongs to the engine's popup, not to the lightning cell under it. That matches L3 with REPD layers ticked.

DONE
