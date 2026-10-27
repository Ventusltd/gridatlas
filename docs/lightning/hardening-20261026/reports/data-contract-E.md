# data-contract-E: real lightning data → generation 202610270024 (NODE ONLY)

Lane: data-contract-E, 27 Oct 2026 00:20–00:40 UTC. Module `wt/atlas/modules/202610270024-uk-lightning-overlay.js` (24,780 B, sha256 `2976cae7…90bf`). I ran its own `ni/vk/sh/ok/co/cv/cf/cp` and the full panel flow (ON, 12H…12M, PREV, custom) in node:vm with `evidence/gen-202610270024/minidom.mjs`. A stubbed fetch/XHR serves a set directory for `raw.githubusercontent.com/Ventusltd/lightning/main/data/…` and returns 404 for anything else. No Chromium was started. Production and the worktree were read only. In `/home/claude/lightning` the only change was `git fetch` with explicit refspecs into `refs/remotes/origin/*`.

Evidence root: `hardening/evidence/data-contract-E/` (written E/ below).

## What real data exists (E/refs.txt)

| ref | commit | data files |
|---|---|---|
| main | 4b35a6c (00:28 UTC refresh) | `data/uk_lightning.geojson` only (215,536 B, 408 flashes, query 21:27→00:27) |
| PR #2 `data-plane/hourly-lookback-index-v2` | f7db76c | the geojson (an older main copy, query 10:05→13:05) + `seed_scan_windows.json` |
| PR #4 `proposal/pr2-shard-lost-20261026` | 1b883c2 | same two blobs as PR #2 |
| PR #3 `data/parquet-duckdb-20261026` | d4caf9e | same two blobs as PR #2 |

No commit of any ref contains `data/history/index.json`, a day shard, a part, or `data/status.json` (count = 0 over `git rev-list --all`). So the "real archive" exists only after PR #2 or PR #4 merges and the first hourly run (`cron 17 * * * *`) commits it. To build the after-merge cases I ran each branch's own `collect.build_run_record` and an unmodified `history.py ingest` + `verify` on the real main feed. The run record is CONSTRUCTED from the committed feed metadata, while the flashes are genuine. The module never requests `status.json` (it requested `status_json_requested:false` in every run), so there is no client contract for it.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| E01 Publication day, lightning main now (feed only, index 404) | **PASS** | E/node/asis-main.json, E/node/SUMMARY.txt | `run-all.sh` (NOW 00:45Z) |
| E02 PR #2/#3/#4 branch data as committed | **PASS** (STALE, since the feed is from 13:05) | E/node/asis-pr{2,3,4}.json | same |
| E03 FEED_SCHEMA / `ok()` on real feed | **PASS** 408/408 accepted, `observation_kind` = `optical_lightning_flash` | E/node/*.json `unit.feed` | same |
| E04 After PR #2 merge, first run | **PASS** | E/node/merged-pr2-first-run.json | `build_sets.py` + `run-all.sh` |
| E05 After PR #4 merge, first run | **PASS** | E/node/merged-pr4-first-run.json | same |
| E06 IX_SCHEMA, observation sentence, `vk` on all 366 rows (PR #2 and PR #4) | **PASS** 0 rows rejected | `unit.rows_rejected_by_vk` | same |
| E07 count/bytes/sha256 on real shards | **PASS** 5/5 (31/67/189/118/3) | `unit.shards` | same |
| E08 Parts path allow-list, real collector split (threshold lowered to 20 kB, SYNTHETIC) | **PASS** 25 parts `days/2026/10/DD/HH.json` accepted and verified, 408 drawn | E/node/merged-pr4-split-SYNTHETIC-threshold.json | same |
| E09 shard_lost (PR #4 history.py run 2 after `23.json` vanished) | **PASS** for 7d/30d/range; **FAIL** copy for a lost-day-only window (see F1) | E/node/merged-pr4-shard-lost.json | same |
| E10 sha256 tamper (one byte, same length) | **PASS** → `FAIL · 1 of 5 day files failed … index mismatch: sha256` | E/node/merged-pr4-TAMPER-sha.json | same |
| E11 Stale archive (4 h after run) | **PASS** → `[… STALE]`, `Refresh archive … (4h 5min ago; expected every 1 h) · STALE` | E/node/merged-pr4-first-run-at0445-STALE.json | same |
| E12 Detail mode shows "0" for an unknown window | **FAIL** (F1) | merged-pr4-*.json `[7d PREV]`, `[ON]` | same |
| E13 GitHub CDN skew between index and an updating shard | **FAIL** (F2) / OWNER_DECISION | E/node-skew/SUMMARY.txt, E/cdn-probe.txt | `build_skew.py` + `run-real-E.mjs` (NOW 2026-10-23T16:17Z) |
| E14 "archive unavailable" for a real valid archive | **none found**: every real or collector-built set parsed; 404 is worded `archive not yet published: HTTP 404` | all | — |

## What the public sees

**Publication day (lightning main as it is now).** The index returns 404, so the panel runs in feed mode. Default ON 24h shows `Lightning Flashes (Optical) [UNKNOWN | 24h]`, `UNKNOWN · 0 seen in the available 7-day feed · 24 hours requested · searched unknown`, `Actual  none seen in the available 7-day feed for this window (unknown, not zero)`, and `Refresh live feed 2026-10-27 00:27 UTC (… archive not yet published: HTTP 404; earlier hours unknown, not zero)`. With 7D the panel shows `[≥408 | 7d]` and draws 408 points. 30D through 12M also say `older history unknown` and `archive not yet published: earlier coverage unknown, not zero`. PREV is disabled. There is no "archive unavailable", no handler error, and no zero presented as a fact.

**After PR #2 or PR #4 merges (first run).** The index is accepted (cutoff 2025-10-27, 366 rows, 16 scan windows, archive start 2026-10-20 22:41 UTC). The panel shows 7D `PARTIAL · 408 FLASHES DRAWN · SEARCHED 57%` with `Unknown: 2026-10-20 … precede archive start … (not zero)` and 12M `PARTIAL · 408 ARCHIVED · SEARCHED 1% … Unknown: 358 of 366 UTC dates have no collection run`. The custom range 21–25 Oct shows 408, and 23 Oct alone shows 189. PR #2 and PR #4 produce identical panels. The PR #4 index adds an `integrity` block, which the module ignores apart from the `shard_lost` rows.

**PR #4 shard_lost.** The lost row (`coverage none, count null, shard_lost true`) passes `vk`. 7D shows `[≥219 | 7d]`, `SEARCHED 50%`, and `1 days lost from the archive (integrity alert), unknown, not zero`. The 189 lost flashes are not shown as zero in multi-day windows.

## Findings

**F1 FAIL (copy, unknown shown as zero), line 108 and line 115.** In detail mode, a window with no archived flashes prints `Actual  no archived flashes within this window` and `Flashes 0 archived in window`, even when the label says UNKNOWN or PARTIAL. Real cases:
- 7D PREV (0% searched): `UNKNOWN` and `Flashes 0 archived in window`.
- ON 24h after merge (35% searched): `PARTIAL · 0 FLASHES DRAWN`.
- The worst case is the lost day 23 Oct, which really held 189 flashes. It shows `Flashes 0 archived in window` plus `Searched EUMETSAT 0% of window — no collection run covers these dates`. That is false, because 23 Oct was searched and its shard was lost.

veto-pre-3 flagged the same wording provisionally (S02/S10). Variant E fixed it in feed mode only.

Minimal fix in `cp`: when `!n && c && c.f < 0.999`, set `L.actual='Actual  none archived in the searched part; the rest is unknown, not zero'` and append `' (unknown, not zero)'` to the Flashes line when `c.f<=0`. In `L.searched`, when `c.f<=0&&c.l`, use `'Searched EUMETSAT: shard lost (integrity alert), unknown, not zero'`.

**F2 FAIL (a valid archive shown as FAIL on storm days), lines 47, 63 and 90.** `raw.githubusercontent.com` serves `cache-control: max-age=300`. A `?v=` query and `Cache-Control: no-cache` both still returned `x-cache: HIT` from the same object (E/cdn-probe.txt). So for up to 5 minutes after each hourly commit that changes an unsealed day shard, the browser can receive the new index with the old shard, or the reverse. I tested both orders using PR #4 `history.py` across two real-flash runs on 23 Oct (timing CONSTRUCTED). Each turned every window that touches that day into `FAIL · 1 of N day files failed (2026-10-23 index mismatch: count, bytes, sha256)` with the `[FAIL]` label (24h, 12h, 48h, 7d, 30d, custom). The consistent pair shows `[≥176 | 24h]` correctly.

`S.ip` caches the index until the 10-minute timer runs, so an old index can keep the FAIL showing for up to about 15 minutes per storm-hour. The cause is CDN caching, not an invalid archive.

Minimal fix (OWNER_DECISION on wording): in `sh`, on `index mismatch` for an unsealed target, clear `S.ip` and retry once after about 60 s. If it still fails, `cf` reports PARTIAL with `today's file is updating (GitHub CDN caches up to 5 min); unknown, not zero` instead of FAIL. Sealed rows keep the FAIL as it is now. A query-string cache-buster does not work.

**Notes (no action):**
- The module never reads `status.json`.
- If PR #1 (index v1) merged by itself, `ni` would refuse with `unsupported index schema` and the panel would show "Archive unavailable". PR #4's `history.py` upgrades v1 to v2 on write.
- All "after merge" sets are collector output built on a constructed run record, not a live EUMETSAT run.
