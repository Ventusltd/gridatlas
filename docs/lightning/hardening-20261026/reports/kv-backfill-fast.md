# Lane: kv-backfill-fast

- **Branch:** `feature/backfill-parallel-20261027`. Worktree: `hardening/evidence/kv-backfill-fast/wt`.
- **Base:** origin/main `d32e6b6` (fetched 27 Oct 2026).
- **Head:** `2ef8f7fd3378aac57d9eff22fcd7f6244740ca6c`, one commit, **not pushed**.
- Node and Python only; no browser. /home/claude/lightning was only fetched and used to add the worktree.

## Expected days per hour

- **Measured baseline.** In run 40464739813 the "Search and ingest" step ran from 07:03:07 to 10:26:14: 203 min for 11 dates. That is **about 18.5 min per date, or 3.2 dates per hour** from one runner.
- **Parallel, with 6 shards (the cap):**
  - about **19 dates per wall-clock hour**;
  - about 16 dates per shard per run (290-min budget), so **about 90–96 dates per run** in about 5 h 10 min;
  - the 337 remaining never-searched dates take **about 4 runs, or about 18 h**, against about 34 sequential runs and about 105 h.
- **With 3 shards:** about 9.7 dates per hour.
- **Unverified assumption:** that EUMETSAT serves 6 concurrent whole-day searches as fast as 1. The first real run should use `days: 30, shards: 3`. Read the `seconds` per date in each `shard-K.json` before going to 6.

## Design

| Piece | What it does |
|---|---|
| `.github/workflows/backfill-parallel-lightning.yml` (new) | `workflow_dispatch` only. Inputs: `end_date`, `days` (1–366, default 90), `shards` (1–6, default 6) and `dry_run`. Three jobs, described below. Top-level `permissions: contents: read`; only `finalize` has `contents: write` (plus `actions: read`). The EUMETSAT secrets are used only by the shard jobs. |
| `plan` job | Runs the unit tests, then `backfill_parallel.py plan`. This calls `history.backfill_plan` (never-searched dates only, newest first, `shard_lost` excluded, retention cutoff) and deals the dates **round-robin** into at most 6 shards. It refuses a writing run off `main`, `shards` > 6 and `days` > 366. The plan is uploaded as an artifact. An empty plan emits a placeholder matrix, because GitHub rejects an empty matrix. |
| `shard` matrix | `max-parallel: 6`, `fail-fast: true`, `timeout-minutes: 340`, `SHARD_BUDGET_MINUTES: 290`. Each shard runs `collect.py --rebuild-day D` for each of its dates (stdin `/dev/null`) and writes **only run records**. Shard K waits 20 s × (K−1) before its first search. Records go to a `.partial-` file and are renamed only when collect.py succeeds. `shard-K.json` (dates, collected records with sha256 and seconds, stop reason) is rewritten after every date. The upload step (`if: always()`) runs next, and only then does a surface step fail the shard on `eumetsat_error` or `cancelled`. That failure triggers fail-fast, which cancels the other shards. SIGINT/SIGTERM become `cancelled`, the partial record is deleted, and the shard's finished records are still uploaded. |
| `finalize` job | `if: always() && !dry_run && plan succeeded`, so records from shards that stopped early are still used. It downloads all the artifacts, then loops up to 5 times: `wait-hourly` (at most 20 min, best effort, `gh run list` on `update-lightning.yml`), `git reset --hard origin/main`, `backfill_parallel.py finalize`, `history.py verify`, **one commit**, push. If the push is rejected, it resets and **re-ingests on the new main**; it never rebases `index.json`. |
| `backfill_parallel.py` (new) | Subcommands `plan`, `shard`, `finalize` and `wait-hourly`. `finalize` ingests newest first through the existing gated `history.backfill_day` (staging copy, verify, coverage and count equality). It also refuses a record whose sha256 differs from its shard summary. A date that is no longer never searched is skipped, not refused, which makes re-ingest idempotent. The first refusal stops the ingest. It writes the `status.py` `backfill` block with `mode: parallel`, `shards` and `skipped_already_searched_days`, and leaves the hourly heartbeat untouched. The overall stop is the worst of `completed < time_budget < cancelled < shard_missing < eumetsat_error < archive_refused`. |
| `history.py` | `backfill_plan(..., max_days=31)` now takes a parameter; the new constant `BACKFILL_PARALLEL_MAX_DAYS = 366`. The sequential workflow's behaviour is unchanged. |
| Other files | `test-lightning.yml` path triggers updated; new *Parallel backfill* section in `docs/HISTORY_ONE_YEAR.md`. |

**Unknown is not zero.**
- Dates that a shard never reached, that hit a rate limit, that were cancelled or whose artifact is missing stay `coverage none / count null`.
- Slots EUMETSAT did not return stay unsearched, so the day is `partial`. This is tested with 2 missing slots, giving 84,000 s searched.
- `count 0` appears only for a whole searched day. This is tested.

## Hourly coordination

- **Own group.** The workflow uses `concurrency: uk-lightning-backfill`, never `uk-lightning-update`. The hourly job is never queued behind a 5-hour backfill. GitHub's one-pending-run rule also cannot replace a pending hourly run with a backfill run, or the reverse.
- **No repository writes from shards.** Shards never write to the repository. The only writer is the finalize job, which takes seconds to minutes, waits for an active hourly run first, and recovers from a lost push race by resetting and re-ingesting.
- **Residual risk, for the concurrency lane:**
  1. If an hourly run checks out before the finalize push and pushes after it, its `git pull --rebase` on `index.json`/`status.json` can conflict. That hour's archive commit then fails. The next run's self-healing lookback (≤48 h) repairs it. The same risk already exists between the hourly job and the sequential backfill.
  2. The sequential `backfill-lightning.yml` still uses `uk-lightning-update`, which is the STALE cause in the brief. I did not touch it. I recommend that the concurrency lane move it to `uk-lightning-backfill` too, so that the two backfills serialise (at most 6 + 1 EUMETSAT streams). `finalize` already tolerates dates filled by the other workflow: it skips them.

## Tests (fake downloader, no network)

`tests/test_backfill_parallel.py` adds **23 tests**:

- **Split:** round-robin, the cap of 6, 366 days but not 367, an empty plan.
- **Shard:** records and summary; a 429 stops it with no later attempt; time budget; cancellation leaves no partial record; stagger.
- **Finalize:** full, partial and 0 handled correctly with the heartbeat untouched; a rate-limited shard's dates stay `none/null`; `shard_missing`; a tampered record refused; idempotent re-ingest.
- **wait-hourly:** a fake `gh` that is busy then idle; bounded; a `gh` error is not fatal.
- **Workflow text and structure:** own group, `max-parallel` 6, fail-fast, `always()` upload, a single writer, secrets only in shards.
- **Shell end-to-end:** the real YAML step scripts run in a throwaway repository with a bare origin, with separate runner directories per shard and a simulated artifact merge:
  - 3 shards → **exactly 1 commit**;
  - a 429 in shard 2 → that shard goes red, the others are committed, its dates stay unknown;
  - a **pre-push hook that commits an "hourly" heartbeat to origin** → the push is rejected, the job re-ingests and the push succeeds, keeping both the hourly commit and its heartbeat;
  - refusal of 7 shards or a writing run off `main`.

Mutation checks, all caught and then reverted: the sha256 gate removed; `break` changed to `continue` after an EUMETSAT error; `reset --hard` replaced by `pull --rebase`; the already-searched skip removed; `Cancelled` derived from `Exception`. The last was a real bug found during development: the per-date `except Exception` swallowed the cancellation.

Results:
- `python -m unittest discover -s tests`: **138 OK** (115 existing + 23 new).
- `node --test tests/test_history_window.mjs`: **25/25**.
- All 4 workflows parse as YAML.
- actionlint is not installed, so the matrix expressions are checked only by the structure test.

## Not verified

- GitHub runtime behaviour that cannot be exercised locally: fail-fast cancellation running the `always()` upload of the cancelled shards, and `download-artifact` with `merge-multiple`. The design does not depend on either for correctness. Missing records leave dates unknown, and a missing summary gives `shard_missing` (red).
- I did not look up EUMETSAT's fair-use quotas for `EO:EUM:DAT:0691` in this lane. The cap of 6 is the lead's.
