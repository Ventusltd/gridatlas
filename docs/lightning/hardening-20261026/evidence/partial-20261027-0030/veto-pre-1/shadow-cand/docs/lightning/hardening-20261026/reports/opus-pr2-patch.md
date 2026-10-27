# opus-pr2-patch: tested patch proposal for lightning PR #2 (issue #32, Claude lane)

**Base.** `Ventusltd/lightning` `origin/data-plane/hourly-lookback-index-v2` at **f7db76c** (fetched 26 Oct).
**Proposal.** Local branch `proposal/pr2-hardening-20261026`, head **0788259**. It has 5 commits and no upstream. **Nothing was pushed.** A push needs a separate owner decision (issue §4.6).
**Worktree.** `EVP/wt`, where `EVP` = `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/opus-pr2-patch`. Shared clones were not touched.
**Harness.** Self-fixture, offline. Python 3.13 locally (CI pins 3.12), Node v22.23.4 (CI pins 24), git 2.43.0.

## 1. Deliverables

- **Patches:** `EVP/patches/0001…0005-*.patch`. Apply with `git am EVP/patches/*.patch` on f7db76c.
- **Combined diff:** `EVP/proposal-combined.diff` (8 files, +303/−9).
- **Before/after logs per fix:** `EVP/runs/0N-*-{before,after}.txt`.
- **Final suites:** `EVP/runs/10-final-python.txt` and `EVP/runs/10-final-node.txt`.
- **`git am` check:** `EVP/runs/09-format-patch-apply-check.txt`. The patches were applied to a clean detached f7db76c. The resulting tree (`4589e6e…`) is identical to the proposal tree, and its tests pass.

## 2. Results

| Fix | Before (f7db76c + new test) | After | Commit |
|---|---|---|---|
| D-1 listed shard missing on disk | **FAIL**: `('full', 86400, 0, …)`. A missing hourly part gave `('full', 4, None)`, a silent undercount of 4 out of 8 (`runs/01-D1-before.txt`). | PASS | e4ae418, f8c18b7 |
| D-3 `slots_parsed:false` | **FAIL**: the window was archived, and status moved the scan end to `15:17` (`runs/02-D3-before.txt`). | PASS | e54332c |
| D-4 heartbeat before `data/history` exists | **FAIL**: `128 != 0 : fatal: pathspec 'data/history' did not match any files` (`runs/04-D4-before.txt`) | PASS | b96781c |
| Verify gate (proofs-lane finding) | **FAIL ×3**: missing sha256 not rejected; the step called only `['ingest']`; `partial.json` was committed (`runs/05-verify-before.txt`). | PASS | 0788259 |

I ran the final suites exactly as `test-lightning.yml` runs them, from the worktree root:

- `python -m unittest discover -s tests -v` gives **59 OK, exit 0**. That is 49 original tests plus 10 new ones.
- `node --test tests/test_history_window.mjs` gives **24 pass, 0 fail**.

**Cross-checks:**

- **Verifier's defect script.** Re-running pr2-data-verifier's `exp4_defect_hypotheses.py` on the proposal now reports H1 and H3 as "not reproduced" (`runs/07`; the synthetic fixtures are in `EVP/exp4-rerun/`).
- **Strict verify on real data.** Strict `verify` passes on the genuine 408-flash archive (5 shards) and on the synthetic 24-part storm fixture (`runs/06`).
- **Consumers with a lost shard.** I deleted a shard from a copy of the genuine archive and re-ingested it (`EVP/consumer-check/`). Two validators accept the resulting index:
  - PR #2's `normaliseIndex`;
  - the overlay's `vk/ni` validator, extracted verbatim from fda6b10 (`runs/08`).

## 3. Fixes

### D-1: a listed shard missing on disk (history.py:388-405, 496-497, 514-515)

Days listed in the previous index are now visited along with the days on disk and the incoming days. If any listed file is missing, the day's row becomes:

- `coverage none`
- `scanned_seconds 0`
- `count null`
- `path`/`bytes`/`sha256` null
- `shard_lost: true`

The flag is sticky. If flashes for that date arrive later, they are dropped and counted in `dropped_lost_day`. Rebuilding from them would produce a partial count labelled `full`. Remaining files are left on disk, unlisted, so they can be recovered by hand from git history.

`status.json` now carries `archive.lost_days` and `archive.dropped_lost_day` (f8c18b7). The docs gain one bullet.

**A design choice for the owner.** pr2-data-verifier proposed raising `ValueError` instead. That would freeze every later run until a manual fix, the same failure shape as D-2. I followed the brief (unknown, not zero). The owner may prefer loud failure.

**Remaining limitation.** The client's `windowCoverage` (history-window.mjs:244-248) still counts that date's `scan_windows` seconds as searched; the count stays unknown (`unknownDays`). Client unchanged.

### D-3: unparsed slots are not searched time (history.py:587-590, status.py:77,103)

- `windows_from_run_record` returns `[]` when `slots_parsed is False`.
- `status.py` keeps the previous `last_successful_scan_end_utc` in that case. Before this change, the lookback also treated the unpublished tail as searched.
- `status.py` records `last_slots_parsed`.

If names stopped parsing permanently, health would become `stopped` after 24 h: loud, not a false coverage claim.

### D-4: the heartbeat (update-lightning.yml step 5)

The step now runs `git add -A -- data/status.json`, then `git add -A -- data/history` only when that directory exists. I chose separate adds over `mkdir -p` because an empty directory stages nothing anyway.

The new `tests/test_workflow.py` lifts each step's `run: |` block from the YAML, with no YAML library. It substitutes the `${{ … }}` expressions and runs the block with `bash -e` in a throwaway repository with a local bare `origin`.

`test-lightning.yml` now also triggers on changes to `update-lightning.yml`. Before this, workflow edits never ran the tests.

### Verify gate: proofs-lane finding confirmed at f7db76c

**Confirmed:**

- Step 5 commits `data/history` with `if: always()`, and no `verify` step exists.
- `_verify_unchanged` skips the size check when `bytes` is None (:282) and the hash check when `sha256` is falsy (:284).
- `verify_archive` (:575) never compares counts.

**Changes in 0788259:**

1. **Strict verify.** `verify_archive` now requires `bytes` and `sha256` (history.py:285). It also checks:
   - each file's feature count against its row or part count;
   - the sum of the parts against the row count;
   - `count null ⇔ coverage none`;
   - that `count > 0` always comes with a path or parts.

   Ingest keeps the lenient check, so the v1 upgrade path is unchanged.
2. **Verify in the archive step.** Step 3 runs `python history.py verify` right after ingest (yml:86).
3. **Commit only a verified archive.** Step 5 stages `data/history` only when `steps.archive.outcome == 'success'`. Otherwise it restores the committed archive (`git checkout … || true; git clean -fdq -- data/history`) and commits `status.json` alone. This also keeps D-2 partial writes out of git. Leftover modified tracked files would otherwise break the `git pull --rebase` fallback.

**Limits of these tests:**

- The step-3 test uses a stub `history.py` that logs its subcommand. It proves call order and failure propagation only.
- The step-5 tests run real git against a local remote, not GitHub.
- How `steps.archive.outcome` behaves under `continue-on-error` comes from the Actions documentation. It is NOT_TESTED live.

## 4. D-2: storm burst above ~46k flashes/hour (analysis only, no patch)

**Mechanism at f7db76c:**

1. `_plan_shards` raises `ShardTooLarge` for any hourly part above 25,000,000 bytes (history.py:259-262). At 531 B per flash, that is about 46,200 flashes in one UTC hour.
2. The raise aborts the ingest after earlier days were written but before the index is written.
3. Each run record carries the 7-day feed (collect.py:397), so every hourly run raises again for up to 7 days.
4. During that time no scan windows and no flashes from any day reach the index.

With the new gate those runs commit status only. That is honest, but the archive is still frozen.

**Options:**

| | (a) Per-day isolation | (b) Sub-hourly split | (c) Larger cap |
|---|---|---|---|
| Change | Catch `ShardTooLarge` per day and mark that date unarchived (sticky, like D-1). Other days and the index are still written. | Split an oversize hour into 10-minute parts `DD/HH-M.json` | Raise `MAX_SHARD_BYTES` to ~45 MB |
| Capacity | Same per hour; the failure is limited to one date | About 6× (~277k/h) | About 1.8× (~85k/h) |
| Burst flashes | Lost: the date is unknown, not zero | Kept | Kept up to the new cap |
| Consumer change | None (the unknown row is already valid) | `PART_PATH_RE` in history-window.mjs:132 **and** the overlay. The overlay has 808 B of headroom, so this needs a new candidate generation. | None, but a part above the client's 32 MB budget never loads in detail |
| Risk | Data loss for one date | Schema change across two repositories | Only moves the cliff. GitHub warns at 50 MiB, and every rewrite bloats git history |

**Recommendation: (a) now.** It needs no schema change, reuses the D-1 mechanism, and the archive never freezes. Consider (b) later, only if real hourly counts approach the cap.

I do not know the real UK maximum hourly flash count. The genuine feed peaked at 189 flashes in a whole day, and this is the hard limit on this recommendation.

**Code shape for (a)**, at history.py:442:

```python
try:
    plan = _plan_shards(day, records, max_bytes=max_shard_bytes, target_bytes=target_shard_bytes)
except ShardTooLarge as error:
    lost_days.add(day); failed_days.append({"date": day, "error": str(error)})
    continue  # files untouched and unlisted; other days proceed; index still written
```

Other parts of the change:

- The flag becomes `shard_lost: "missing" | "too_large"`.
- `failed_days` goes into the result and into `status.archive`.
- The CLI exits 2 when `failed_days` is non-empty, so the run stays red.
- The workflow must then commit the archive when the only failure is `failed_days` (for example via a distinct exit code). This is the one interaction with the strict gate.
- Test: an oversize burst plus a normal day; assert the normal day is archived, the burst day is `none/null/too_large`, and the index is written.

## 5. Limits and items not done

- **Not verified live:** GitHub Actions, EUMETSAT and `eumdac`/`netCDF4` (BLOCKED_DEPENDENCY).
- **New flag in the published contract:** `shard_lost` is an additive key. Both consumers tolerate it, but it widens the published contract. **OWNER_DECISION.**
- **Stale doc count:** docs/HISTORY_ONE_YEAR.md:174 still says "49 tests". I left it unchanged.
- D-5…D-8 are out of scope.
