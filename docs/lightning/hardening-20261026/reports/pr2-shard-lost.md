# pr2-shard-lost: shard_lost on ChatGPT's four conditions, plus `history.py recover`

**Base.** `Ventusltd/lightning` `data-plane/hourly-lookback-index-v2` at **f7db76c**, with opus-pr2-patch 0001–0005 applied (head 180720a). Their diffs are identical to the opus-pr2-patch series.
**Proposal.** Local branch `proposal/pr2-shard-lost-20261026` in `EV/wt`, head **1b883c2**, 5 new commits. **Nothing was pushed.**
`EV` = `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/pr2-shard-lost`.
**Harness.** Offline, synthetic fixtures in temp directories only (ids `TEST-…`). Python 3.13 locally (CI pins 3.12), Node v22 (CI pins 24).

## Deliverables

- `EV/patches/0001…0010-*.patch`: the full series on f7db76c. 0001–0005 are the opus-pr2-patch fixes; 0006–0010 are this lane's work. Apply with `git am EV/patches/*.patch`.
- `EV/proposal-combined.diff`: f7db76c..1b883c2.
- `EV/runs/`: the fail-first runs, the final suites, the apply check and the per-commit check.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| Apply 0001–0005 | PASS | `EV/runs/00-base-head.txt`, `EV/runs/09-format-patch-apply-check.txt` | `git am` |
| Fail-first: new tests on the base implementation (180720a) | FAIL as expected: 23 Python failures/errors, 1 Node failure | `EV/runs/03-failfirst-python-on-180720a.txt`, `EV/runs/03-failfirst-node-on-180720a.txt` (also `01-before-*`, `02-before-collect-rebuild.txt`) | final `tests/` copied onto `git archive 180720a` |
| Final Python suite | PASS: 81 tests OK (59 before + 22 new) | `EV/runs/10-final-python.txt` | `python -m unittest discover -s tests -v` |
| Final Node suite | PASS: 25 pass, 0 fail (24 before + 1 new) | `EV/runs/10-final-node.txt` | `node --test tests/test_history_window.mjs` |
| C1: the day is unknown, never zero | PASS | `tests/test_shard_lost.py::test_lost_day_is_unknown…`, `…verify_rejects…`, node test 25 | as above |
| C2: recorded in the index and in the status, with an explicit alert | PASS | `test_index_carries_an_explicit_integrity_alert`, `test_status.py` (4 new tests), `test_workflow.py::test_surface_step_fails_on_an_integrity_alert…` | as above |
| C3: healthy days continue, but the archive is never reported entirely healthy | PASS | `test_healthy_days_continue…`, `test_shard_lost_degrades_health…`, `test_integrity_alert_is_carried…` | as above |
| C4: recovery only from verified evidence | PASS | 9 `recover`/`rebuild` tests, including the CLI and the end-to-end `collect.py --rebuild-day` | as above |
| `git am` of the 10 patches on a clean f7db76c | PASS: tree 521c4a6 is identical to the worktree | `EV/runs/09-format-patch-apply-check.txt` | `git am` |
| Every commit is green on its own | PASS: Python OK and Node 0 fail at each of 0006–0010 | `EV/runs/11-per-commit.txt` | per-commit loop |
| Live GitHub Actions, EUMETSAT, `eumdac` | BLOCKED_DEPENDENCY / NOT_TESTED | none | none |

## What changed (0006–0010)

**Condition 1: unknown, never zero (history.py, client).**
- The lost row stays `coverage none`, `scanned_seconds 0`, `count null`, with no files.
- `verify` rejects two things:
  - a `shard_lost` row that carries a count, a coverage value or a file;
  - an index whose `shard_lost` rows differ from `integrity.lost_days`. A hand-edit cannot silently clear the flag.
- Client: `windowCoverage` no longer counts a lost date's scan-window seconds as searched. It returns `lostDays`, `normaliseIndex` exposes `integrityState`/`lostDays`, and the caption warns `Integrity: N UTC date lost its archive shard (…); count unknown, not zero`. This closes the "remaining limitation" in opus-pr2-patch.

**Condition 2: recorded with an explicit alert.**
- `index.integrity = {state, alert, lost_days[], recoveries[]}`.
- Each lost entry keeps `detected_utc`, `missing_paths` and `last_recorded`, the last index entry: `path`/`parts`, `count`, `bytes`, `sha256`, `index_generated_utc`. A recovery must match this entry.
- `status.json` gains `integrity {state, alert, lost_days, quarantined_observations, source}`. A failed or skipped archive step carries the previous state forward. It never loses an alert.
- `status.py alert` exits 1 while the alert is raised. `ingest`, `verify` and `status write` print it to stderr.
- The last workflow step, now named "Surface collection, archive or integrity failure", runs with `if: always()`. It fails the run on the alert **after** the commits.

**Condition 3: healthy days continue.**
- Other days are ingested, verified (`verify` passes on a consistent lost state) and committed.
- `status.health` becomes `degraded` instead of `ok`/`warn` while any shard is lost. The new `freshness` field keeps the age-only value.
- Later flashes for a lost date are no longer discarded. They are held, uncounted, in `data/history/quarantine/YYYY-MM-DD.json`, idempotent by id. Only if that file would exceed `max_shard_bytes` are new flashes dropped, and they are counted in `dropped_lost_day`. Quarantine files expire with retention. `verify` validates them.

**Condition 4: `history.py recover --day D (--from-shard F… | --rebuild --rebuild-record R)`.**
- Every gate runs before any write; a refusal leaves the index byte-identical (tested).
- `--from-shard` requires all of the following:
  - each file's bytes and sha256 equal a recorded entry;
  - each file's feature count and the total equal the recorded counts;
  - for a split day, every missing part is supplied, and each surviving part still matches its recorded sha256;
  - no unlisted file for the date remains.
  If no evidence was kept, an earlier `index.json` from git history can supply it with `--recorded-index`. The audit records that index's sha256.
- `--rebuild` requires all of the following:
  - a successful run record with `slots_parsed: true`;
  - `run_utc` after `detected_utc` (a fresh search);
  - examined slots that cover every second the index recorded as searched on that date;
  - every flash still on disk or in quarantine;
  - a flash count equal to the recorded count.
  Without a recorded count it refuses unless `--accept-unanchored` is given, which is audited as `anchored:false`.
- **New producer:** `collect.py --rebuild-day YYYY-MM-DD --run-record R` searches the whole UTC date and writes only the run record, never the feed or the status. Without it `--rebuild` was unusable beyond the 48 h lookback.
- On success:
  1. the verified files are written;
  2. quarantined flashes are merged on top;
  3. the row is restored and the date is removed from `lost_days`;
  4. an audit record is appended to `integrity.recoveries` (method, `verified_against`, input sha256s, `byte_identical`, `quarantined_merged`, result hashes, covered seconds);
  5. the index is rebuilt and `verify` runs.

  The audit survives later ingests (tested).
- The procedure is in `docs/HISTORY_ONE_YEAR.md`, under "Lost shards: alert, quarantine and recovery".

## Limits and OWNER_DECISIONs

- **OWNER_DECISION: a red hourly run while any shard is lost.** Every scheduled run fails visibly until recovery or until the date leaves retention. This is the literal reading of condition 2/3 ("never reported healthy"). The alternative is a warning-only annotation.
- **OWNER_DECISION: the contract widens.** New additive keys: `index.integrity`, `status.integrity`/`freshness`, `health: "degraded"`, and the `data/history/quarantine/` path. No current consumer reads `status.health`. The GridAtlas overlay (`202610262323`) does not read `integrity`/`shard_lost`, so it would still count a lost date's seconds as searched. Fixing that requires a new overlay generation (out of scope; overlay unchanged).
- **OWNER_DECISION: the alert expires with retention.** A lost date that leaves the one-year window drops out of `lost_days` together with its row. The data is gone either way, but the alert then stops.
- **Not atomic after the gates.** `recover` writes the files and the index, then re-runs ingest. A crash between these steps leaves an uncommitted working tree; the workflow restore and `verify` would catch it. Recovery is a manual step, committed by hand after reviewing the audit.
- **`--rebuild` against real EUMETSAT is NOT_TESTED.** It was tested with a stubbed downloader and real-format product names. EUMETSAT's retention of old LI L2-LFL products is unknown.
- D-2 (storm > 25 MB per hour) is still unpatched (see opus-pr2-patch §4). Option (a) there could reuse this mechanism.
