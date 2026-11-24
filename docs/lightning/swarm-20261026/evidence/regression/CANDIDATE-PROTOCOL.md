# Candidate comparison protocol — GridAtlas original 202609241334 vs lightning candidate

Author: atlas-regression-auditor. Everything below is runnable from this folder; nothing edits the clones.
Baseline tables for every step already exist here (`baseline-*/results.md`, `baseline-table.md`); the candidate
is run through the SAME commands with only the URL / `--candidate` / `--label` changed, and the two tables are diffed.

## 0. Conditions that must be identical on both sides (not "similar")
| condition | value | how it is fixed |
|---|---|---|
| serving | parent dir served so the path is `/gridatlas/atlas/` (python http.server on the agent's port); candidate under a sibling route such as `/gridatlas/atlas/v/<generation>/` or a second port of the SAME clone state | both URLs passed explicitly; never the live site for one side and local for the other |
| bytes under test | `current.json` generation asserted on each page (`data-gridatlas-generation`) | `--baseline-generation 202609241334 --candidate-generation <gen>` |
| network | the lead's offline shim on BOTH sides (`shim-preload.cjs` for the unmodified proofs; `installOfflineShim` inside `compare-candidate.mjs` / `lightning-cases.mjs`); raw.githubusercontent.com Ventusltd products pass through; everything else off-origin aborted and logged | `GRIDATLAS_SHIM_LOG` per proof; the aborted/missing lists must be identical for baseline and candidate except the lightning feed |
| lightning data | answered from a directory, never the live feed, so the candidate's requests are deterministic | `GRIDATLAS_LIGHTNING_DATA_DIR` / `--lightning-data-dir`; the fixture directory is recorded in every result |
| viewports | 1440x1000 desktop (all-controls), 1400x900 + 2327x1156 (chips proof), 393x852 Android touch UA (all proofs' phone profile), 844x390 landscape (compare harness), 456x906 + 1280x800 (bucket proof) | the proofs own their viewports; `compare-candidate.mjs --viewports` |
| route, zoom, selection | plain visit; deep link `?technology=solar&latitude=52.6369&longitude=-1.1398&zoom=12&project=GRIDATLAS_PROOF_parity&capacity_mw=10` (the coordinates every existing arrival proof uses); Grid menu open; Layers panel toggled; View > fullscreen | `compare-candidate.mjs --scenes plain,deeplink,grid-menu,layers-panel,fullscreen` |
| waits | generation attribute <= 60 s; map + 60 proxies + menuBar.installed <= 90 s; network idle <= 20 s; fixed 3 s; deep link additionally waits for the card bar and `links_drawn>0` or a recorded failure | hard-coded in the harness, printed in every record |
| determinism | locale en-GB, timezone Europe/London, reducedMotion reduce, colorScheme dark, deviceScaleFactor 1; clocks (#clock, #date, #days), live counts `[n]` and the tile-less map canvas masked before pixel diff | `compare-candidate.mjs` |
| CPU | ONE browser proof at a time for the timing-sensitive proofs (all-controls uses a 6 s default action timeout; two concurrent Chromiums on this 2-core sandbox produced false "scrolling into view" timeouts) | `--concurrency 1` |
| lightning state | OFF by default: zero requests to the lightning host at boot, no lightning input checked, no lightning layer visible | asserted in every compare scene |

## 1. Original behaviours that must be re-proved on the candidate (same proof file, same arguments)
Run: `node run-baseline.mjs --repo <clone> --base <candidate URL> --out candidate-browser-shim --group browser --shim --concurrency 1 --label candidate-browser-shim`
then `node assess.mjs --label candidate --dirs candidate-static,candidate-historical,candidate-python,candidate-browser-shim --out candidate-table.md --diff baseline-table.json`.

| behaviour | proof (unmodified, under the shim) | what the baseline table says today | candidate must |
|---|---|---|---|
| all 60 engine controls + 3 Pipeline News controls present, fail-closed menu | `menu-bar-dom.proof.mjs` (static), every browser proof's boot wait (`>=60 proxies`), `menuBar.inspect()` recorded by `compare-candidate.mjs` | PASS / 60+3 complete | identical: engine 60, pipeline 3, total 63, unique 63, complete true; the lightning control carries neither `data-layer-id` nor `data-pn-layer` |
| every layer click (paint, pick, card closes inside the viewport, off state) at 1440 and 393 | `all-layer-clicks.browser.mjs --width 1440/393 --url <base>` | see `baseline-browser-shim/all-layer-clicks-*/results.json` (per-id pass/fail; layers whose partition needs DuckDB stay BLOCKED_DEPENDENCY) | the same per-id outcome set, id for id; no new `errors`, no change in `eligible`/`rendered` for ids that pass on the baseline |
| menus x6, Status/Radius/Area/Zone/Measure tools, fullscreen in/out, basemaps, CSV export, GB conditions + version ledger expand, Layers toggle, image/PDF/print export, solar CSV, search, deep link, Pipeline same/wider/all, card minimise/restore/close | `all-controls.browser.mjs --desktop` / `--mobile` | 20/26 desktop checks pass under the shim; `search` is BLOCKED_DEPENDENCY (postcodes.io/Nominatim), `csv-export-loaded` BLOCKED_DEPENDENCY (solar partition) — see table | the same 20 pass; the same blocked set; `report.json` `profiles[].errors` empty |
| deep-link arrival with the project's layer lit, for 13 technology buckets | `deep-link-technology-buckets.browser.mjs` (env `GRIDATLAS_BROWSER_WIDTH`, `GRIDATLAS_BROWSER_BUCKET` to bound) | see table | identical receipts |
| hidden-tab arrival deferral and recovery | `deep-link-visibility.browser.mjs` (chromium only; WebKit absent = BLOCKED_HARNESS half) | see table | identical |
| arrival engine answered/declined/silent per technology | `202609072356-arrival-engine-sweep.browser.mjs --per-tech 1` | see table | no new SILENT |
| REPD identity arrivals | `202609040229-arrival-identity.browser.mjs`, `repd-deep-link-sweep.browser.mjs --cases 2` | DuckDB `+esm` missing → BLOCKED_DEPENDENCY locally; run in CI with network | identical |
| SLD layout, project card geometry per selection, card bounded to the map | `202609241334-sld-sandbox.proof.mjs` (static exact-delta), `all-controls` card checks, `compare-candidate.mjs` deeplink scene (card rect, bar rect, `gridatlas-free`/anchor class, content max-height) | static PASS; card x/y is timing-dependent on the ORIGINAL itself (self-parity measured anchor-top 17,53 vs anchor-bottom 205,89 on two identical loads) | card width 340, bar height 55 and content heights within the self-parity envelope; class set equal; x/y not a regression signal unless outside the envelope on 3 repeats |
| search box present and search executes (results need postcodes.io/Nominatim) | `all-controls` `search` check | BLOCKED_DEPENDENCY locally | run in CI with network; locally only the box geometry is compared |
| export/print outcomes | `export-print-and-image-outcomes.browser.mjs --route <route>`, `screen-grab-print-outcomes.browser.mjs <base>`, `202609051329-pdf-export-outcomes.browser.mjs <base>` (firefox/webkit absent = BLOCKED_HARNESS), `teleprint-evidence.browser.mjs <base> <out> --sessions 2` | see table | identical check lists; the print sheet must not carry the lightning furniture when lightning is OFF |
| fullscreen keeps the six menus and the curtain keys | `menu-bar-mobile-hit.browser.mjs` (fixture), `all-controls` fullscreen check, `compare-candidate.mjs` fullscreen scene (`#fs-curtain-keys` inventory) | PASS | identical; the curtain's FIRST group is still the engine's first group unless `--allow-added` names the lightning group AND the visual lane accepts it |
| Layers panel on mobile: starts collapsed, LAYERS toggle opens it, controls reachable | `v8-layers-panel-restored.proof.mjs` (static), `all-controls --mobile` `layer-panel-toggle`, `compare-candidate.mjs` layers-panel scene at 393x852 | PASS | identical geometry of every original `label.key-item` (the V5 preview PREPENDED a group, which moves every original control down — that is the kind of change the owner saw) |
| attribution / About / estate links | `about-estate-and-attribution.proof.mjs` (42/44, stale print checks) | FAIL pre-existing | same 2 failures, no more |
| GRID / SUBS chips on the map | `grid-subs-chips-on-desktop.browser.mjs <base>` | PASS 393, FAIL 1400/2327 (desktop chips never shipped: `trayTarget()` is coarse-pointer-or-<=700px, cartridge line 5810) | identical |
| pixel and geometry parity with lightning OFF | `compare-candidate.mjs` (all scenes, all viewports) | self-parity: 7/8 scenes 0 px, 0 rect deltas; deep-link scene noise documented above | 0 masked px, 0 rect deltas, 0 style deltas, map layer list equal, DOM inventories equal except `--allow-added` |

## 2. Lightning-specific cases (run `lightning-cases.mjs` with the candidate adapter)
`node lightning-cases.mjs --base <candidate URL> --adapter ./adapters/<candidate>.mjs --out lightning-cases-candidate [--viewport 393x852]`
The V5 result (`lightning-cases-v5/lightning-cases.md`) is the floor the candidate must beat.

| case | fixture (written by the harness) | contract the candidate must meet |
|---|---|---|
| baseline-feed | the real 7-day seed (408 flashes) | label carries the count, the latest-detection or refresh time, and "optical/satellite, not ground strikes"; terminal within 30 s; count equals the file; 60+3 intact; no page error |
| zero-observations | `features: []`, status ready | reported as "no observations in the window" with the window/refresh time; control stays ON; not a failure |
| malformed-json | truncated JSON | a visible reason (unreadable feed); bounded retry (<= 3 requests); nothing drawn; no uncaught error |
| http-500 | 500 | reason names the HTTP status |
| network-abort | aborted request | reason says network |
| cors-denied | genuine cross-origin response without ACAO (page from localhost:port, feed redirected to 127.0.0.1:port) | reported as a failure with reason — never as OK or empty |
| stale-archive | valid feed whose latest detection and query end are 10 days old | time shown verbatim; flagged stale beyond `--stale-hours` (default 6 h = 2x the 3 h collector cadence; the UX lane owns the threshold) |
| over-40k-points | 45,000 synthetic flashes in the UK box (seeded PRNG) | either all drawn and counted or "N shown of 45000" stated; terminal <= 30 s; frame cadence recorded |
| older-than-one-year | history index with `cutoff_date_utc` = today-365; window 400..390 days ago | refused with a message naming the retention horizon; no day shard requested (`history-window.mjs` throws RangeError — the UI must surface it) |
| missing-day-unknown | index with D-3 and D-1 archived, scan windows covering D-3.5..now only; window D-6..now | D-2 (scanned, nothing archived) reads 0; D-5 (never scanned) reads UNKNOWN; the total excludes unknown days or says so. NOTE: `history-window.mjs` (PR #1) exposes `selectedDays` only — days absent from the index are silently dropped and `archivedDayCount` sums only archived days; the per-date `scanned/unscanned` status must be derived from `index.scan_windows` by the client, otherwise the UI cannot tell a quiet day from a gap |

## 3. Acceptance rule
PASS only if: every row of section 1 reads identically to the baseline table (same PASS set, same pre-existing FAIL set, same BLOCKED set with the same first error lines), `compare-candidate.mjs` reports PASS on every scene with lightning OFF, and `lightning-cases.mjs` has no FAIL row. A candidate that turns a baseline BLOCKED into PASS is fine; one that turns any PASS into anything else, or changes a first-error line, is a regression until explained.
