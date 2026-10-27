# Lane kv-collector: why the hourly collector stopped, and the fix

- **Branch:** `fix/collector-own-lane-20261027`
- **Head:** `4ca2b8d33921ba2a30c7a6e73070908114ccf391` (one commit on origin/main `d32e6b6`)
- **Worktree:** `hardening/evidence/kv-collector/wt`
- **Not pushed.** Node and Python only; no browser was started.
- **Evidence:** `evidence/kv-collector/runs.json` (raw output of `gh api …/actions/runs?per_page=100`), `evidence/kv-collector/timeline.txt`, and `evidence/kv-collector/py-tests.log` / `node-tests.log`.

## 1. Cause (from the Actions API)

| Run | Event | Created | Job started | Ended |
|---|---|---|---|---|
| 40426455115 hourly | schedule | 00:26 | 00:26 | 00:28 |
| 40439576430 hourly | dispatch (hourly cron live from here, f026ee5) | 02:38 | 02:38 | 03:13 |
| 40443051576 backfill | dispatch | 03:14 | 03:14 | 07:01 |
| 40464739813 backfill | dispatch | 07:02 | 07:02 | 10:26 |
| **40476905747 hourly** | schedule | **08:55** | **10:26** | 10:43 |
| 40529873754 hourly | schedule | 15:19 | 15:19 | 15:24 |

**Findings:**

- **No run was cancelled or skipped.** `status=cancelled` and `status=skipped` both return `total_count 0` for the repository. So the "one pending run, cancel the rest" mechanism never fired.
- **Primary cause: GitHub's scheduler did not create runs.** Between 03:17 and 15:17 there were 13 hourly slots, and only **2** produced a run (08:55 and 15:19). From 10:43 to 15:19 the concurrency group was free and still no run was created. That 4.5 h gap is pure scheduler loss.
- Not new: under the old `20 */3` cron, 25 Oct got 5 of 8 runs, 1.5–2.5 h late.
- **Secondary cause: the shared concurrency group.** Run 40476905747 was created at 08:55 and **queued for 91 min** behind backfill 40464739813 in the shared group `uk-lightning-update`, so its job only started at 10:26.
- The feed was refreshed at 10:43 (69468dd), so "STALE" at 13:45 reflects data ending about 10:20.
- **Out of my lane, flagged for others:** the map's STALE threshold does not match `status.json`, which uses warn > 6 h and stale > 12 h. `docs/HISTORY_ONE_YEAR.md:90` says "> 4 h or `next_update_due_utc`".

## 2. Fix

| File | Change |
|---|---|
| `backfill-lightning.yml` | Gets its own group, **`uk-lightning-backfill`**. Only the hourly workflow now uses `uk-lightning-update`, and its runs are capped at 55 min, so the feed can only ever queue behind another hourly run (under 1 h), never behind a 3.5 h backfill. |
| `ci/push-with-replay.sh` (new) | Commits the step's paths and pushes. If the push is rejected, it fetches, resets hard to the new tip and runs a **replay** command that regenerates the outputs from inputs saved in `$RUNNER_TEMP`, then retries (5 attempts, linear backoff). This replaces `git pull --rebase`, which would hit a textual conflict on two regenerated `index.json` or `status.json` files and lose the heartbeat. Before resetting, it **refuses to discard** uncommitted changes outside the step's paths. It **pushes to the checked-out branch**, not a hard-coded `main`. |
| `ci/replay-hourly-archive.sh` (new) | Re-runs `history.py ingest`, then `verify`, then `status.py write`, all from the run record. If the replayed ingest fails, it restores the archive and commits the heartbeat only. |
| `ci/replay-backfill.sh` (new) | Re-ingests each filled date from its saved whole-day record, with no new EUMETSAT calls. If a date was searched by the hourly job in the meantime, `history.py backfill` refuses it; that date is **dropped** and the hourly row is kept, so it stays unknown and is never zeroed. It then rewrites the `backfill` block and runs `verify`. |
| `update-lightning.yml` | **Fallback cron `47 * * * *`.** A small `gate` job runs `status.py due`, checked out at the branch tip rather than the queued SHA. Only a *scheduled* run may skip, and only when the last attempt **succeeded** less than 40 min ago. A single dropped :17 slot now costs about 30 min instead of 1 h or more. The `collect` job records `JOB_STARTED_UTC`, plus `RUN_CREATED_UTC` from `gh api …/runs/$GITHUB_RUN_ID` (needs the new permission `actions: read`; best effort, and blank means unknown). It passes `--trigger`, `--run-id`, `--run-created` and `--job-started` to `status.py write`. The feed and archive commits both use the helper. |
| `test-lightning.yml`, `docs/HISTORY_ONE_YEAR.md` | `ci/**` path filter; new "Schedule and concurrency" section and heartbeat fields. |

**Limits:**

- **GitHub's cron cannot be made reliable from inside the repository.** A multi-hour scheduler outage still leaves the map stale. The only real guarantee is an external `workflow_dispatch` trigger, for example from a gridatlas workflow or an outside pinger. That is the owner's call; I did not implement it.
- If a replay drops a date, the commit subject's "N day(s)" can over-count by that date. The body and `status.backfill.filled_days` are correct.

## 3. Heartbeat explains staleness (`status.json` → `heartbeat`)

The new `heartbeat` block holds:

- `cron_utc`
- `next_expected_run_utc`
- `late_after_utc` (last attempt + 90 min)
- `this_run`: `trigger`, `run_id`, `run_created_utc`, `job_started_utc`, `queued_minutes`, `outcome`
- `gap_before_this_run`: `previous_attempt_utc`, `minutes`, `hourly_slots_without_a_run`, `cause`
- `explanation`
- `if_late`

`cause` is one of:

- `on_time`
- `github_schedule_late_or_dropped`
- `queued_behind_another_run`
- `github_schedule_late_then_queued`
- `no_scheduled_run_until_manual_start`
- `unknown`

The `backfill` block is carried through unchanged.

This is the real 08:55 run as the code would report it:

> Last collector run 27 Oct 10:26 UTC (schedule, success). Before it, no run for 10 h 00 min (since 27 Oct 00:27 UTC): GitHub's scheduler started no run on time (7 hourly slots produced no run), then this run waited 1 h 31 min in the queue behind another run.

A run that never starts cannot report its own cause. `if_late` says so ("…the next run records the cause… Flashes in the gap are unknown, not zero."). A client can show `explanation` when the heartbeat is fresh and `if_late` once `now > late_after_utc`. Wiring this into the map module is a follow-up for the overlay lane.

## 4. Tests

- **Python:** `python3 -m unittest discover -s tests` ran **138 tests, all OK**: the 115 existing tests plus 23 new.
- **Node:** `node --test tests/test_history_window.mjs` passed **25/25**.
- `bash -n ci/*.sh` passes; all three workflows parse with `yaml.safe_load` (Python 3.13.17, Node 22.23.4).

New test files:

- **`tests/test_concurrent_writers.py`** (11 tests). It uses two clones of one bare origin and runs the **real** step shells of both workflows.
  - The hourly archive push loses to a backfill and is replayed. Both the backfill's flashes and the hourly flash survive, `verify` passes, and the heartbeat and `backfill` block coexist.
  - The feed push loses, and the archive then builds on top of the backfill.
  - The backfill loses to an hourly run that touched yesterday. Yesterday is dropped, its partial row is kept, and the other dates are filled.
  - Also covered: the reset guard, branch targeting, the attempt limit, group exclusivity, the 55-min cap, the cron slots and gate, and no `pull --rebase`.
- **`tests/test_heartbeat.py`** (12 tests), on the real 27 Oct timings: every `cause` value, the first heartbeat, a failure, `if_late`, survival through a backfill status write, `next_cron_slot` and `due`.
- **Updated:** `test_backfill_workflow.py` now asserts the own group; both workflow tests pass outcomes via env and copy `ci/`.

**Mutation checks:** I replaced the reset+replay with `git pull --rebase`, and separately removed the replay. Each mutant fails **3** race tests.

## Overlap warning

Lane `kv-backfill-fast` has branch `feature/backfill-parallel-20261027` and also edits `backfill-lightning.yml`. Expect a merge conflict in the concurrency and commit steps. Its commit step should call `ci/push-with-replay.sh` with `ci/replay-backfill.sh`, or an equivalent replay.
