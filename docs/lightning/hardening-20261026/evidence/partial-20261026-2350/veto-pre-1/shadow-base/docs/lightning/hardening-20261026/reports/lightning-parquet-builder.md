# lightning-parquet-builder: Parquet + DuckDB store for Ventusltd/lightning

**Harness:** local sandbox (Python 3.13.17 and a Python 3.12 venv, duckdb 2.0.0, pyarrow 26.0.0, Node 22.23.4), plus GitHub Actions on the pushed head.
**Branch:** `data/parquet-duckdb-20261026`, created from `origin/data-plane/hourly-lookback-index-v2` at `f7db76c` (PR #2 head).
**Head:** `4def4aaca026ec2092d325c74baaf4bf4f12e1f9`, confirmed with `git ls-remote`.
**PR:** https://github.com/Ventusltd/lightning/pull/3. It is a draft based on `data-plane/hourly-lookback-index-v2`, and its body says DO NOT MERGE.
**Worktree:** `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/lightning-parquet-builder/wt`.

Nothing was merged. Nothing went to `main`, and PR #1 and PR #2 were not touched. The only push was to the one new branch.

## Authority note

`OPUS-SUPPORT-BRIEF.md` says "no pushes". My prompt said the brief states my writer exception, but **the brief does not contain one**. I relied on the owner request relayed in my prompt (23:07 UTC, one new branch plus a draft PR) and stayed inside it. The lead should confirm that this matches the owner's intent.

## Commits (all end with the Co-Authored-By and Claude-Session lines)

| sha | what |
|---|---|
| `fa96d68` | `sources/`: SHA-256 pin of data-grid-gb `connection-points.v3.json` (`5181de3`, `8db7171d…`, 2,934,509 B), plus a located-substation extract (489 of 886) and `tools/extract_substations.py` |
| `c852a14` | `parquet_store.py`, `rollups.py`, `sql/00–40*.sql`, `verify_parquet.py`, requirements pins, `.gitignore` |
| `716ebe7` | `tests/test_parquet_store.py` (29 tests) |
| `0842943` | workflows: Parquet build, verify and separate commit; the test workflow installs requirements and checks the pin |
| `151c148` | `docs/PARQUET-DUCKDB.md` and the README section |
| `749c27f` | `tools/stress_storm_year.py`. I had left it uncommitted, and CI failed because of it (see below). |
| `4def4aa` | docs: the 1M-flash synthetic measurements |

## What was built (work-order items 1–7)

1. **Flashes.** Output goes to `data/parquet/flashes/year=YYYY/month=MM/part-0.parquet`.
   - Columns: `id`, `time_utc` (timestamp[us, UTC]), `lon`, `lat` (float64), `source_product`, `observation_kind`, `ingest_run_id`.
   - Writer: ZSTD level 9, rows sorted by `(time_utc, id)`, row groups of 32,768 rows, statistics plus page index, delta encoding for time and integer columns.
   - The source is `parquet_store.read_archive`. It re-verifies every shard's bytes and sha256 against index v2, re-runs `history.validate_feature` on every record, rejects duplicates, requires the per-day counts to equal the index, and requires the shards on disk to equal the shards listed.
   - A non-synthetic build refuses any id that is not a genuine `W_XX-EUMETSAT-…LI-2-LFL…_OPE_…:n`.
   - Output is deterministic: a rebuild with a different `--run-id` produced `changed: nothing`, and `ingest_run_id` is carried forward.
2. **Coverage.**
   - `coverage/days.parquet` (366 rows from index v2) has `coverage`, `count_state`, `hours_observed`/`hours_expected`, `scanned_seconds`, `flash_count` and `slots_searched`. The count and hour fields are NULL iff the coverage is `none` or `shard_lost`.
   - `coverage/scan_windows.parquet` holds the search windows.
   - `coverage/slots/year=/month=/` has one row per 10-minute LI slot (phase :09). Its `basis` is `scan_window` or `flash_proven`, and its count is NULL when the slot was never searched.
3. **SQL layer.** `sql/*.sql` defines the views `flashes`, `coverage_days`, `scan_windows`, `coverage_slots`, `daily_optical_flashes`, `hourly_optical_flashes`, `archive_coverage`, `substation_optical_flash_pairs`, `substation_optical_flash_proximity`, `substation_optical_flash_proximity_daily` and `storm_episodes`.
   - `rollups.py` writes the rollup Parquet files and `rollups/headline.json` (1,970 B, hard limit 4096).
   - `python rollups.py duckdb` writes a views-only `lightning.duckdb` (about 0.5 MB). It is gitignored.
4. **Manifest and verify.**
   - `manifest.json` records each file's path, bytes, sha256, rows, row groups, schema version, time column and min/max. It also records the archive totals, the substation pin and the writer settings, and holds no wall-clock time.
   - `verify_parquet.py` recomputes everything in plain Python, including proximity by grid-bucketed haversine, independently of the SQL. It fails closed.
5. **Tests.** See below.
6. **Workflow.**
   - Steps added after PR #2's "Commit archive and status": "Build Parquet, coverage, rollups and manifest", "Verify the Parquet store (fail closed)" and "Commit the Parquet store (parquet commit)".
   - The build and verify steps use continue-on-error. The commit step stages only `data/parquet`, commits only on change, and makes its own commit.
   - The final surface step now includes the Parquet outcomes.
   - The cron `17 * * * *` and the feed-first order are unchanged, and a test asserts both.
7. **Docs.** `docs/PARQUET-DUCKDB.md` covers the prospective archive, the partially searched seed (100/94/49/58/59 %), the null and shard_lost rules, and attribution: EUMETSAT NoConditions, © OpenStreetMap contributors under ODbL, and NESO ETYS via data-grid-gb. It says what the products are not (ground strikes, damage, faults, causality), gives sizes, and lists limitations.

### Coordinator's mid-task requirements (joint ChatGPT review)

- **Optical-flash proximity label.**
  - The columns are `optical_flash_proximity_5km`, `_10km` and `_20km`, in the views `substation_optical_flash_proximity` and `substation_optical_flash_proximity_daily`.
  - Each count column's Parquet field description contains "OPTICAL-FLASH PROXIMITY … not strikes or faults".
  - The DuckDB `COMMENT ON VIEW` reads "Not ground strikes, not confirmed strikes, not electrical faults, not damage".
  - The headline label, README and docs carry the same wording.
  - The verifier fails if the field descriptions lose the label.
- **Coverage kept separate from missing history.**
  - Every aggregate carries `coverage` (none, partial, full or shard_lost), `count_state` (observed or UNKNOWN) and `hours_observed`/`hours_expected`.
  - `coalesce(…, 0)` appears only inside `count_state = 'observed'`.
  - A `shard_lost: true` index row reads UNKNOWN in days, slots, daily, hourly and the headline.
  - A shard missing *without* the flag fails the build ("a lost shard must be flagged shard_lost, never read as 0").
  - Proximity and archive totals say `lower_bound_partial_coverage` whenever any day is not full.
  - PR #2's `history.py` never writes `shard_lost`; this branch accepts it forward-compatibly and does not change `history.py`.

## Test results

| run | result |
|---|---|
| Baseline, PR #2 head `f7db76c`, before any change | 49 Python OK, 24 Node pass |
| New test module copied onto the PR #2 head | **fails** (import error: modules absent), so it fails before and passes after |
| Worktree, Python 3.13 | **78 Python OK** (49 + 29), **24 Node pass** |
| Fresh clone of `4def4aa`, Python 3.12 venv | 78 OK, 24 pass, `extract_substations.py --fetch --check` passes, tree still clean |
| GitHub Actions run 40419573562 on `151c148` | **FAILURE.** `tools/stress_storm_year.py` was not committed (`ModuleNotFoundError`). I reproduced this on a fresh 3.12 clone; the Actions log host is blocked by the proxy, so the cause was found locally. |
| GitHub Actions run 40419800454 on `4def4aa` | **success** |

The 29 new tests cover:

- Real seed: 408 rows, per-day 31/67/189/118/3, ZSTD, genuine ids; verify PASS; the size comparison; byte-stable rebuild; run-id carry-forward and new-id assignment.
- The NULL-not-zero rule in days, slots and hours.
- The headline: at most 4 kB, with coverage and labels.
- Proximity labels in the Parquet field metadata and the DuckDB comments, and the DuckDB file of views.
- Fail-closed cases: a flipped byte, a missing file, an out-of-box row, a zero on an unsearched day (daily and coverage), a proximity count +1, the headline total, the manifest row count, and a Parquet/archive mismatch.
- A non-genuine id refused unless synthetic, and a synthetic store refused by verify.
- Episode splitting at an unsearched gap, and the edge flags.
- shard_lost reading UNKNOWN everywhere, and an unflagged loss failing.
- `--if-archive` no-ops.
- The SYNTHETIC storm year at 5,000 flashes.
- No synthetic file anywhere in the repository.
- The SHA-256 pin and a tampered extract being refused.
- Workflow order, cron, and the separate on-change commit.

Final verify on the real seed, using the committed code:
`{"outcome": "PASS", "files": 34, "bytes": 162092, "flashes": 408, "days": 366, "days_searched": 7, "substations": 489, "episodes": 27, "headline_bytes": 1970, "synthetic": false}`.

## Sizes

**Real 408 flashes.** The archive was rebuilt in a temp dir from the committed feed and `seed_scan_windows.json` with `now = 2026-10-26T14:00Z`; script at `evidence/lightning-parquet-builder/scripts/make_real_archive.py`.

| | |
|---|---|
| JSON day shards | 216,561 B (530.8 B/flash) |
| index.json | 71,107 B |
| Parquet flashes | 12,356 B (30.3 B/flash), 17.5× smaller |
| whole store (34 files) | about 162 kB; most of it is the mostly-NULL 366-day slot and hourly grids, about 3 to 4.5 kB per month each |
| headline | 1,970 B |

**SYNTHETIC storm year.** These are invented flashes, generated in a temp dir that was deleted afterwards; the output is in `evidence/lightning-parquet-builder/stress/storm-year-1M.json`.

| | |
|---|---|
| volume | 1,000,000 flashes over 89 storm days; busiest day 47,443 (split into hourly JSON parts) |
| JSON | 537,167,717 B (537.2 B/flash) |
| Parquet | 17,992,654 B (18.0 B/flash), **29.9×** smaller |
| row groups | 36, of 108–586 kB (mean 489 kB); the busiest-day query touches 2 |
| DuckDB queries: count / daily / hourly / one day of points | 0.022 / 0.092 / 0.62 / 0.007 s |
| DuckDB queries: proximity for 489 sites / episodes | 9.6 / 1.8 s |
| build: JSON archive / Parquet + rollups / verify | 48 / 75 / 42 s |
| wall time and memory | 178 s, peak RSS 1.77 GB |

## Findings and limitations

1. **Real data quirk.** Flash `…_OPE_20261023195009_20261023200009_…:322` is timed 19:50:08.639, which is 0.361 s *before* its product's nominal sensing start. The genuineness check therefore allows ±60 s, and slot attribution uses the product slot.
   - PR #2's `history.slots_proved_by_flashes` assigns the flash by time, so it lands in the previous slot. This is a minor, conservative difference, reported and not changed.
2. **The store has not been populated yet.** `data/history` does not exist on the PR #2 branch, so no Parquet is committed. The first successful hourly run writes the archive and then the store; until then `--if-archive` no-ops. I did not commit derived data for an archive that isn't committed.
3. **Commit churn.** Coverage changes on every successful hourly run, so expect one Parquet commit per hour of a few tens of kB of binary that git cannot delta. A daily cadence is a one-line `if:` change for the owner to decide.
4. **Scale limits.**
   - Proximity at 1M flashes takes 9.6 s, using a bbox join with no spatial index; this is acceptable in CI.
   - Building and verifying hold all records in memory (1.8 GB at 1M). This is fine on the 7 GB GitHub runners. Beyond about 3M flashes a year it would need streaming per month.
5. **Licensing.**
   - data-grid-gb has no LICENSE file at `5181de3`.
   - The OSM-derived coordinates are ODbL, with share-alike applying to the extract and the proximity rollups.
   - The owner must confirm the NESO terms.
6. **Model differences from data-gb-electricity.**
   - Its partitions are `month=6` (unpadded); this store uses `month=06` per the work order.
   - Its price-decade rollup is 6,873 B, not 4 kB. This headline is held to 4,096 B and the verifier enforces it.
7. **Browser path.** DuckDB-wasm reading this Parquet in a browser was not tested. It is BLOCKED in this sandbox (R08) and **not** PASS.
8. **Workflow behaviour I could not test.** The scheduled update workflow was not executed: no EUMETSAT secrets and no dispatch. Only its YAML order is tested. If the archive commit's push fails, the Parquet commit can still push Parquet derived from that unpushed archive; this is an unhandled edge case.

## Files

- Code:
  - `parquet_store.py`
  - `rollups.py`
  - `verify_parquet.py`
  - `sql/00_views.sql`, `sql/10_daily.sql`, `sql/20_hourly.sql`, `sql/30_substation_proximity.sql`, `sql/40_storm_episodes.sql`
  - `tools/extract_substations.py`, `tools/stress_storm_year.py`
  - `sources/gb-transmission-substations.{source,v1}.json`
  - `tests/test_parquet_store.py`
  - `docs/PARQUET-DUCKDB.md`
  - README, requirements.txt, .gitignore, and both workflows.
- Evidence in `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/lightning-parquet-builder/`:
  - `stress/storm-year-1M.json` and `.log`
  - `stress/real-seed-verify.txt`
  - `stress/py312-fresh-clone.txt`
  - `stress/fail-before.txt`
  - `scripts/`
  - `pr-body.md`
