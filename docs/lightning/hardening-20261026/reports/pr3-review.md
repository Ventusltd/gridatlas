# pr3-review (final, 00:40 UTC 27 Oct 2026): Ventusltd/lightning draft PR #3 @ d4caf9e

Scope: Python/DuckDB only, no browser. Branch `data/parquet-duckdb-20261026`, head d4caf9e. Nothing was pushed. Production (`/home/claude/gridatlas`, generation 202609241334) and the shared clones were not touched. The only writable copy was the detached worktree `evidence/pr3-review/wt`, and the patch commits exist only there.

Harness: a self-fixture. The real 408-flash archive is rebuilt in temp dirs from the committed feed, exactly as `tests/test_parquet_store.py` does it. Synthetic `TEST-` ids are used only in temp dirs, with `synthetic=True`. Tampers then refresh the manifest, so only the semantic checks can catch them.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| T0 unittest, base (78) | PASS | evidence/pr3-review/run-unittest.txt | `python -m unittest discover -s tests -v` |
| T0 node, base (24) | PASS | evidence/pr3-review/run-node.txt | `node --test tests/test_history_window.mjs` |
| D1 two builds byte-identical | PASS | evidence/pr3-review/run-adv-real.txt | `WT=wt python3 -m unittest adversarial_test` |
| D2 builds in UTC / London / New York / Kolkata processes byte-identical | PASS | same | same |
| Z1 zero searched hours publish proximity 0 | **FAIL** → fixed by 0001 | run-z1-probe.txt, run-adversarial-patched-0004.txt | `WT=wt python3 z1_probe.py` |
| E1 episode edge over a shard_lost day claims searched/complete | **FAIL** → fixed by 0002 | run-adversarial.txt, run-adversarial-patched-0004.txt | adversarial_test.Synthetic |
| V1 unsearched hour relabelled full/0 passes verify | **FAIL** → fixed by 0003 | run-adv-real.txt, run-v-messages-patched.txt | `WT=wt python3 v_messages.py` |
| V2 unsearched slot relabelled full/0 passes verify | **FAIL** → fixed by 0003 | same | same |
| V3 daily rollup hours inflated to 24 passes verify | **FAIL** → fixed by 0003 | same | same |
| V4 headline count_state "complete" passes verify | **FAIL** → fixed by 0003 | same | same |
| V5 episode edges claimed searched passes verify | **FAIL** → fixed by 0003 | same | same |
| V6 daily-proximity hours/coverage inflated passes verify | **FAIL** → fixed by 0003 | same | same |
| T1 reopened `lightning.duckdb` in a non-UTC session buckets days and hours by local time | **FAIL** (analyst file only; published Parquet unaffected) → fixed by 0004 | run-adv-real.txt | adversarial_test T1 |
| T2 reopened file's session TZ is not UTC | WARN (cannot be pinned in a DuckDB file; made harmless by 0004) | run-adversarial-patched-0004.txt | adversarial_test T2 |
| S1 day `scanned_seconds` vs sum of hourly is off by 1 s (2026-10-23: 42472 vs 42473; 2026-10-24: 50269 vs 50270) | WARN (rounding per hour vs per day; 0.0003 h) | run-adversarial-patched-0004.txt | adversarial_test S1 |
| G1 distance cross-check against ventus-grid-engine `engine/v9-geodesy.js` distanceKm @ 6c1c75c | **OWNER_DECISION** (radius 6371.0088 vs estate 6378.137) → optional 0005 | run-distance.txt, run-distance-0005.txt | `cd distance; WT=../wt python3 -m unittest test_distance_crosscheck -v` |
| P full suites on the patched tree (0001–0004): 87 unittest, 24 node | PASS | run-unittest-patched-0004.txt, run-node-patched-0004.txt | as T0 |
| P full suites with 0005: 87 unittest, 24 node | PASS | run-unittest-patched-0005.txt | as T0 |
| P real-archive store values unchanged by 0001–0005 (33 Parquet tables equal, headline identical; 0004 is byte-identical including manifest) | PASS | tree-*.txt | `python3 tree_values.py base-d4caf9e wt`; `tree_hash.py` |
| P series applies cleanly to d4caf9e and reproduces the worktree tree | PASS | patches/ | `git apply` 0001..0005 on a `git archive d4caf9e` copy |
| W workflow push-failure simulation | PASS (warn) | wfsim/sim-output.txt | `bash wfsim/sim.sh` |
| L LICENSE/NOTICE aligned with GridAtlas | PASS | — | `sha256sum LICENSE` |

## FAILs: location and minimal fix (patches in `evidence/pr3-review/patches/`)

- **Z1** (`0001`). In `sql/30_substation_proximity.sql`, the view `substation_optical_flash_proximity` uses `coalesce(n.optical_flash_proximity_*, 0)`. It also sets count_state to `lower_bound_partial_coverage` when `hours_observed = 0`. `rollups.py headline()` does the same, so an archive with no searched time publishes 0 for every one of the 489 sites, 0 headline flashes and 0 sites within 10 km.
  - Fix: when `hours_observed > 0` is false, the counts become NULL and count_state becomes `UNKNOWN`. The headline then shows `flashes`/`with_any_within_10km` as null. The verifier now enforces the same rule.
- **E1** (`0002`). In `sql/40_storm_episodes.sql`, the `marked` (gap) and `edged` (30-min edge) CTEs only test `scan_windows`. A window that spans a day whose shard was later lost still counts as searched there. The result was that an episode ending at 23:55:30 before a lost day got `searched_30min_after=true` and `coverage=complete`.
  - Fix: a `lost` CTE built from `coverage_days` where coverage is `shard_lost`. Any gap or edge that overlaps a lost day is now unsearched.
- **V1–V6** (`0003`). `verify_parquet.py`'s docstring promises that "a builder and a product that drifted together must still fail". In practice it checks only counts and the NULL rule, never the coverage fields. The added checks:
  - `coverage/scan_windows` is compared against the index windows.
  - Each slot is recomputed: coverage, scanned_seconds, basis and flash_count.
  - Each hourly coverage/scanned_seconds/basis is recomputed from the windows, with a ±1 s tolerance for float rounding.
  - The daily rollup, daily proximity and `slots_searched` are compared against `coverage/days`.
  - Daily proximity counts are recomputed per site and per day.
  - Storm episodes are recomputed fully: gap rule, edges and shard_lost days.
  - The headline `count_state` and the complete-episode count are checked.

  Each tamper now fails with a specific message (run-v-messages-patched.txt). The new tests fail on the base verifier and pass with the patch.
- **T1** (`0004`). `SET TimeZone = 'UTC'` in `sql/00_views.sql` only applies to the session; it is not stored in `lightning.duckdb`. When the file is reopened in America/New_York, `daily_optical_flashes` reports 2026-10-21 as 31 instead of 27 and 2026-10-22 as 67 instead of 71. The cause is `CAST(time_utc AS DATE)`, `date_trunc` and `time_bucket` on TIMESTAMPTZ, used in `10_`, `20_`, `30_` and `40_`.
  - Fix: the base views expose naive UTC timestamps via `timezone('UTC', x)`, and `20_hourly` and the lost-day CTE cast dates to TIMESTAMP.
  - The published store stays byte-identical. A regression test reopens the file in London, New York and Kolkata, and the daily, hourly and episode results all match.

Regression tests for all of the above are in `tests/test_review_regressions.py` (patches 0001–0004 add 9 tests).

## OWNER_DECISION: Earth radius (G1)

- I could read ventus-grid-engine locally (`/home/claude/ventusltd/ventus-grid-engine`, 6c1c75c). Its `distanceKm` is haversine in atan2 form with R = 6378.137 km, and its header says there is one radius for the whole estate. PR #3 uses 6371.0088 km in both `verify_parquet.py` and the SQL.
- The test imports the JS module unmodified under node. It compares 264,060 synthetic pairs (489 sites × 36 bearings × 15 distances from 0.1 to 20.01 km) plus 374 real flash–site pairs within 25 km.
- The PR's Python and SQL formulas agree to 1.2e-12 km. Apart from the radius, the PR formula and the estate formula are the same (ratio residual 1.1e-11).
- **Maximum difference within 20 km: PR vs estate distanceKm 22.4 m.** The worst pair was a due-north offset from (-2.4875, 50.6239). Against WGS84 Vincenty (own implementation): PR 66.6 m, estate 44.7 m. In the UK, the estate radius is closer to WGS84.
- Ring flips (5/10/20 km) on the 374 real pairs: 0 for every comparison. A full year of flashes will have some pairs inside the 22 m boundary bands, so the rollups and the GridAtlas sandbox could then disagree on a count.
- Optional `0005`: switch the verifier and SQL radius to 6378.137. With it, the parity test passes (1.2e-12 km), the suites pass, and the real-archive values are unchanged. Owner to choose: estate parity (0005) or keep the mean radius and document the 22 m discrepancy.

## Artefacts
- Patches: `evidence/pr3-review/patches/0001…0005-*.patch` (format-patch on d4caf9e). In the worktree they are commits 2c7d93e, 36ec278, abb4fed, aeee622, 8823582 on a detached HEAD, not pushed.
- Tests: `adversarial_test.py`, `v_messages.py`, `z1_probe.py`, `tree_hash.py`, `tree_values.py`, `distance/test_distance_crosscheck.py` + `distance/estate_distance.mjs`.
