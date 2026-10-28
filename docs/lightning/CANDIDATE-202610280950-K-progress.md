# kv-density: whole-year density layer (Build K, generation 202610280950)

Status: DONE 2026-10-28 ~10:15 UTC. Nothing pushed.

## Collector (Ventusltd/lightning)
- Worktree `hardening/evidence/kv-density/lightning-wt`, branch `kv-density-grid` on origin/main 969a331.
  - b605e0a: `grid.py` (schema `uk-lightning-history-grid.v1`), hook at the end of `history.archive_observations` (so hourly ingest, backfill staging, parallel finalize and recover all refresh), `tests/test_grid.py` (13 unittest/pytest-style tests), docs + README, test workflow path filter, `grid.py` added to the 3 shell-test file copies.
  - abacfdc: `data/history/grid/2025-10..2026-10.json` from `python grid.py build`.
- Format: `cells: [[cell, day, n, ...]]`, cell = row*140+col on 0.1° (≈7×11 km); `days` = every retention date of the month with the index row's coverage, count (null = unknown) and shard sha256 list. No timestamp, so byte-stable; only changed months rewritten, only changed days re-read; a grid failure is reported (`grid.error`), never blocks the archive.
- Sizes (363,531 flashes): 13 files, 320,849 B total (~100 kB gzip), largest 135,113 B (2026-06). Full build 1.5 s, no-op refresh 0.09 s. Sums equal the index (363,531). `grid.py verify --deep` PASS.
- Tests: unittest 234 OK (1 skip; was 221), node history-window 25/25.

## GridAtlas module K
- Source `evidence/kv-density/module/fixed-module-K.js` (from fixed-module-J.js). 44,208 B (cap 44,781; 573 spare).
- Above the device cap (or 32 MB / 400 files), fetch only the months that hold flashes (`AR+'grid/'+YYYY-MM+'.json'`, regex-gated), validate (schema constant, 140×120×0.1, ≤31 days, ≤16,800 cells, integer ranges, per-day sums, sha256 arrays), use a day only when coverage, count and sha256 match the index row. Draw a heatmap fading into graduated cell circles (z8→9.5) under the points layer. Not tappable; taps still query only the hit layer.
- LOAD POINTS still adds the newest 40,000 tappable points over the density, and the neon engine is unchanged. Windows within the cap make no grid request.
- Caption: "drawn as density (≈10 km cells) of N observed optical flashes, not ground strikes; unsearched days [and N days not yet in the grid] blank (unknown, not zero)". A missing or invalid grid falls back to J's summary with "density archive not yet published / unavailable: …". A single missing month is partial and named. No innerHTML from data.
- Tests (`module/test-fixes.mjs`): 113/113 (K1–K9 new; K1–K8 fail on J, see out/fail-first-J.txt). K9 runs against the real index and grids: 12M density = 363,531 = the index sum, 10,819 cells, 8 files. ChatGPT chatgpt-lightning-regression 6/6, chatgpt-latest 8/8.

## Generation 202610280950 (v9.169)
- Worktree `evidence/kv-density/gridatlas-wt`, branch `claude/lightning-kv-density-20261028`, commit 39cc751 on bd3d230. Built by `evidence/kv-density/tools/make-generation-K.mjs` (the 480 scaffolder with CAND=202610271740; it keeps J2's 44,781 proof line). Composition note extended with one density sentence.
- Module 44,208 B, sha256 2df9277a…; cartridge 479,427 B (≤480,000; 573 spare).
- Gates (out/checks.log): lint 0; state leaves STATE.md and current.json unchanged; proofs 202610280950/202610271740/202610271647 PASS; run-current 4/4; verify-compose PASS; verify-candidate PASS; data-contract parity in a simulated release 12/15, the same 3 pre-existing failures as J2.
- Rest-state (one Chromium, 393×852 and 393×659, lightning OFF): 0 differing pixels against baseline (and J2), 0 lightning requests (rest/pixcmp.txt).
- Browser smoke (browser/, real data, phone): 12M showed the density with 10,819 cells and no map errors; z9.6 rendered 16 cell circles; LOAD POINTS drew 39,314 clusters; tapping a flash at -1.53,52.49 drew 5 neon links. The only map error is the known missing-glyphs error in the shim's style.

## Residuals
- The live site shows "density archive not yet published" until the lightning branch is merged. Merge the lightning branch first, then the generation.
- At zoom ≥ 9 the density turns into cell circles. Points still need LOAD POINTS: there is no automatic viewport loading, so phones get no unprompted multi-MB download.
- Day granularity: density sums whole overlapping UTC days, so a 30D window's partial first day counts in full. The caption says "whole UTC days" only in the points caption.
- The manifest does not separately declare the grid product (parity passes under data/history/). WebKit was not tested.
