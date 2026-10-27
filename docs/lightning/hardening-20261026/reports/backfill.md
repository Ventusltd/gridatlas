# Lane: backfill

- **Branch:** `feature/backfill-workflow-20261027`, worktree at
  `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/backfill/wt`
- **Base:** origin/main `f026ee5`
- **Head:** `2fd9d1b4e16d9cd524d8e035197c1e9856eb97f6` (one commit)
- **Not pushed.** The lead pushes.
- Node and Python only. No browser was started.

## What changed

| File | Change |
|---|---|
| `.github/workflows/backfill-lightning.yml` (new) | Runs on `workflow_dispatch` only. Inputs: `end_date` (empty means yesterday UTC), `days` (default 7, 1–31) and `dry_run` (boolean; prints the plan only, with no EUMETSAT call and no commit). Uses `concurrency: uk-lightning-update` with `cancel-in-progress: false`, the same as the hourly job. Steps run in this order: unit tests, then plan, then a per-date loop (`collect.py --rebuild-day D --run-record $RUNNER_TEMP/rb-D.json`, then `history.py backfill`), then `status.py backfill`, then `history.py verify`, then **one commit** of `data/history` and `data/status.json`, then a surface step. The loop stops at the first EUMETSAT error, rate limit or empty search (`eumetsat_error`), at an ingest refusal (`archive_refused`), or at a soft time budget of 200 min inside a 300-min job timeout (`time_budget`). Dates it did not reach stay never-searched. Writing runs are refused outside `main`. Child processes get `/dev/null` as stdin so they cannot drain the plan file. |
| `history.py` | Adds `backfill-plan` and `backfill`. `backfill` is separate from `recover`, which stays for `shard_lost` dates. All gates run before any write: the index exists; the row is `none/null` and not `shard_lost`; the record is a successful run record with `slots_parsed: true`; `rebuild_day_utc` is D; the query covers the whole date and `run_utc` is after the date ended; the scanned ranges lie inside D; every flash is on D and inside an examined slot; and there are no unlisted files for D. After the gates, the existing `archive_observations` and `verify_archive` run on a **staging copy**. The copy is swapped in only if the new row's `scanned_seconds` and `count` equal the record's. The usual byte caps apply (8 MiB split, 25 MB hard cap), and a `ShardTooLarge` changes nothing. `last_run_lookback_hours` is preserved. `SEED_NOTE` no longer says "nothing is backfilled". |
| `status.py` | `backfill` subcommand. It writes a `backfill` block (filled, remaining-unknown and stop reason) and refreshes the archive totals and integrity from the index. It leaves the hourly heartbeat untouched (`last_attempt_*`, failures, `last_successful_scan_end_utc`, freshness), so the lookback anchor cannot move. `build_status` carries the block forward. |
| `.github/workflows/test-lightning.yml` | Adds the new workflow to the path triggers. |
| `docs/HISTORY_ONE_YEAR.md` | Corrects the "no back-data" wording and adds a *Backfill* section covering the gates, stop rules, status and the EUMETSAT retention finding. |

## Tests

The new tests were written fail-first: 22 of 24 errored before the implementation. The 2 that passed assert behaviour that already existed.

- `tests/test_backfill.py` (24 tests, with a fake downloader):
  - **Coverage and counts:** real partial coverage when slots are missing, `full`/`0` only when the whole date was searched, and hourly split under the byte caps.
  - **Refusals:** each refusal path is covered, and the test checks that no file changed and no staging directory was left behind.
  - **EUMETSAT errors:** a rate limit writes no record.
  - **Plan:** ordering, skipping of `shard_lost` dates, the retention cutoff and input limits.
  - **Status:** the heartbeat is preserved.
- `tests/test_backfill_workflow.py` (10 tests): runs the real workflow step shells in a throwaway git repo with a bare origin. A copy of `collect.py` has a fake `download`, and the real `history.py` and `status.py` are used. The tests cover:
  - a full run producing exactly one commit;
  - a 429 on the 2nd date: the 1st date is committed, the rest stay `none/null`, and the run goes red;
  - an archive refusal;
  - the time budget;
  - a non-main ref;
  - the concurrency group matching the hourly job;
  - dispatch being the only trigger.

  I mutation-checked these tests by replacing `break` with `continue` and by dropping `</dev/null`; both mutants are caught.
- Results: `python -m unittest discover -s tests` passed 115 tests (81 existing plus 34 new). `node --test tests/test_history_window.mjs` passed 25 tests. Both workflows parse as YAML.

## EUMETSAT retention of past MTG LI L2-LFL products: **unverified**

- EUMETSAT's LI L2 Operational Dissemination Validation Report (30 Oct 2024) plans operational dissemination of LI L2 products, flashes included, from the beginning of November 2024.
- AERIS, a secondary source, dates the operational declaration to 31 Oct 2024.
- EUMETSAT's pages describe the Data Store as "a growing catalogue" that gradually replaces the Data Centre's data service, with the Data Centre focused on long-term preservation.
- No page I could reach states the temporal extent or retention of `EO:EUM:DAT:0691`. The collection's catalogue/browse pages were not fetchable from this environment (not on the allowlist, or the page needs JavaScript).
- The workflow does not depend on the answer: if EUMETSAT returns no products for a date, the run stops and the date stays unknown.
- Suggested empirical check: a `dry_run`, then `days: 1` on an old `end_date`.

Sources:
- https://user.eumetsat.int/s3/eup-strapi-media/LI_Level_2_Data_Operational_Dissemination_Validation_Report_pub2_bd35cd8ccf.pdf
- https://eumetsat.int/distributing-data
- https://www.eumetsat.int/storing-data
- https://www.eumetsat.int/lightning-imagers-data-debut-time-storm-season
- https://www.aeris-data.fr/en/data-from-mtgs-new-lightning-imager-available-in-aeris/

## Notes for the lead

- **No archive on main yet.** `data/history` does not exist on main at `f026ee5`, so `backfill-plan` currently refuses with "no index.json". This is deliberate: the hourly job must create the index first so the one-off seed windows get merged. A backfill that ran first would permanently skip them.
- **Partial days are out of scope.** Partly searched days, such as the seeded 21–25 Oct, are not touched. Topping them up would need a different, merge-aware gate.
- **Hourly runs while a backfill is going.** Hourly runs that queue during a long backfill collapse to one pending run, because GitHub keeps only one pending run per concurrency group. Its self-healing lookback, capped at 48 h, catches up the missed hours.
- **Timing at midnight.** The workflow shell tests use the real current UTC date and could flake if run exactly across midnight UTC.
