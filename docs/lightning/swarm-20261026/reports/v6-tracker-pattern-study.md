# v6-tracker-pattern-study — V6 loading mechanics vs the lightning draft loader

Evidence folder: `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/v6-tracker-pattern-study/` (harness scripts, `*.output.txt`, `feed_headers.txt`, and `wt/` = isolated worktree of `origin/feature/one-year-utc-lightning-history` at 22e5579).

## Scope

Read-only study of UK Energy Tracker V6 loading mechanics (`/home/claude/ventusltd/globalgrid2050/uk_energy_tracking_v6/`, plus the `data/` shards it fetches and the builder in `scripts/`), mapped onto the lightning periods, then compared line by line with the draft `history-window.mjs` / `history.py` (PR #1 branch). No UI, no transport, no browser proofs; no file in either clone was modified.

## Method and commands

- Tree and sizes: `find … -type f | stat`; data shards: `ls data/electricity data/generation/fuelhh_halfhourly/2025 data/generation/archive/2025 data/confirmed`.
- Read in full: `load_price_history_data.js`, `load_generation_history_data.js`, `control_price_history.js`, `fullscreen_period_menu.js`, `control_generation_history.js`, `load_generation_mwh_aggregates.js`, both `live-config.js`, `load_json.js`, `generation_daily_mwh_by_technology_fuelhh_index.json`, `scripts/build_generation_daily_mwh_fuelhh_chunks.py`, `derived/build_from_data_repo.py`, `V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md`, `GENERATION_DATA_COVERAGE_AUDIT.md`. `grep -rn 'fuelhh_index\|\.chunks'` to find index consumers.
- Draft: `git -C /home/claude/lightning show origin/feature/one-year-utc-lightning-history:{history-window.mjs,history.py,tests/*,docs/HISTORY_ONE_YEAR.md}` and `git diff main origin/feature/… -- collect.py .github/workflows/`.
- Worktree (rule 2): `git -C /home/claude/lightning worktree add <evidence>/wt origin/feature/one-year-utc-lightning-history`; `node --test tests/test_history_window.mjs` → 9/9 pass; `python3 -m unittest discover -s tests -v` → 14/14 pass.
- Harnesses: `node --expose-gc harness_history_window.mjs` (H1–H8) and `PYTHONPATH=$PWD/wt python3 harness_history_py.py` (H9–H11); synthetic fixtures live only in the harness/tempdir.
- Wire facts: `curl -D - -H 'Accept-Encoding: gzip' https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson`; `python3 -I` sizing of the real feed.

## Findings

### F1. V6 sharding is per year (price) or one rolling file (generation); nothing in V6 is per day, and no browser code reads the chunk index
- Price half-hourly tier: `loadAnnual(year)` fetches `annualBase+year+'.csv'` (`load_price_history_data.js:17`); files `data/electricity/elexon_system_prices_2016..2026.csv`, ~1.9 MB each, 17,520 rows/yr. Plus one capture JSON (`:18`) and one daily-decade JSON of 656 KB with `retention_days: 3653`, `minimum_observations_per_day: 24`, `skipped_incomplete_days[]`, rows `date|average|high|highAt|low|lowAt|observations` (`:19`, file header).
- Generation: `loadJsonOnce('recent', recentEcg)` = one 2.8 MB 30-day/30-min file; `loadJsonOnce('daily', dailyHistory)` = one 14.8 MB daily spine (`load_generation_history_data.js:17-21`, `live-config.js`). Monthly CSV shards (`data/generation/fuelhh_halfhourly/YYYY/generation_fuelhh_YYYY_MM.csv`, ~750 KB) feed the builder only.
- Index `generation_daily_mwh_by_technology_fuelhh_index.json` = `{schemaVersion, generatedUTC, unit, sourceNote, chunks:[{startYear,endYear,path,rows,sizeBytes}]}` (one chunk, 9.67 MB). Grep: only `scripts/build_generation_daily_mwh_fuelhh_chunks.py:117` and an audit script reference it; no `.js` reads it. The builder enforces `MAX_BYTES = 25_000_000` and the check `output_under_25mb`.
- Consequence: "reuse V6 lazy loading and indexing" means reusing the *principles* (tiered files, promise caches, byte-capped builder, index with `sizeBytes`), not V6 code; the draft is already more index-driven than V6.

### F2. V6 window, tier, fan-out, cache and missing-data rules (exact)
- Periods: `periodDays` `{12hday:.5,12hnight:.5,1d:1,24h:1,48h:2,7d:7,30d:30,3m:92,6m:183,12m:366,5y:1827,10y:3653}` (`price:13`, `gen:7`). Window is start-anchored: `end = start + days*86400000 - 1000`, clamped to `[2016-01-01, today+7d]` (`price:21`). Navigation shifts start by `round(periodDays)` days (`control_price_history.js:21`); 55 px swipe (`:30`); resize debounce 120 ms (`:26`).
- Tier: price `isDaily = {12m,5y,10y}` (`:15`); generation `tierFor recent = {12h…30d}` else daily (`gen:10`). Protocol §4 fixes this contract.
- Fan-out: price = capture + one request per calendar year touched (`years()` `:20`, `Promise.all` `:22`, **no concurrency cap**); generation = exactly one file per tier.
- Caches: promise caches keyed by year/tier, session lifetime, never evicted (`price:2`, `gen:2`). HTTP cache deliberately defeated: `url+'?t='+Date.now()`, `{cache:'no-store'}` on every data fetch (`price:17-19`, `gen:17`, `load_json.js:2`); scripts versioned by `?v=`.
- Missing shards: `r.ok ? … : ''|{rows:[]}` then `.catch(()=>[])` — a 404 is silently an empty array; the price renderer then draws "No actual data yet · showing indicative seasonal baseline" (`render_price_chart.js:48`). V6 therefore **cannot** distinguish missing from zero at the loader; completeness lives in the data (`observations`, `records/expectedRecords/completeness`, `methodState`).
- Rendering bound: `decimateRows(rows, max(900, 1.8×cssWidth))` keeping per-bucket high/low (`render_price_chart.js:32,48`).
- Storage bound: 10-year `retention_days`, 30-day rolling recent file, 25 MB builder cap, year-sized CSVs.

### F3. Mapping V6 mechanisms to the lightning periods
Assumptions: measured 526 B/feature raw, 31.5 B gzip (feed 215,536→12,870 B, 16.7:1); heap 695 B/feature retained (H2); worst-case storm day **100,000** optical flashes in the 14°×12° box (stated assumption; ground networks report ~10^5 UK strikes on extreme days and LI also counts intracloud). Phone budget: ≤48 MB heap for lightning data (~70k retained features), ≤8 shards or ≤32 MB raw in cache.

| Period | V6 analogue | Shard granularity | Index fields needed | Requests/period (worst) | Bytes/request storm day (raw/gzip) | Heap if fully loaded |
|---|---|---|---|---|---|---|
| 12h, 24h | gen `recent` tier (one rolling file) | **live feed** `uk_lightning.geojson` (7d, 40k cap), filter in memory | feed `metadata.first/last_detection_utc`, `total_before_display_cap` | 1 | ≤21 MB / 1.3 MB (cap) | ≤28 MB |
| 48h, 7d | same | live feed; day shards only for dates the cap dropped | per-day `count`,`bytes`,`coverage` | 1 (+≤8 shards on overflow) | ≤21 MB / 1.3 MB per file | ≤28 MB per file |
| 30d | price half-hourly tier (year CSVs) | UTC-day shards, **budgeted by index `count`/`bytes` before fetch** | `count`,`bytes`,`coverage`,`sealed` | 1 index + ≤31 shards, 4 in flight | 52.6 MB / 3.2 MB per shard — refuse detail when Σbytes > budget | 69.5 MB per storm shard — over budget |
| 3m, 6m, 12m | price daily tier (one decade file) | index only → daily counts; drill to one day = 1 shard | `count`,`coverage`,`scanned_seconds` per day | 1 (index ≈114 KB raw / 4.8 KB gzip for 366 rows) | 114 KB / 4.8 KB | <2 MB |
| custom | V6 start+period | ≤31 d → budgeted detail; else index only | all above | as 30d / 12m | as above | as above |

### F4. Where the draft faithfully reuses V6
Named periods and `periodDays` style map (`history-window.mjs:12-18`); previous/next navigation (`:50-62`); daily-summary tier for long windows and point tier for short (`:148-152`, `maxDetailDays=31` ≈ V6 generation split); promise caches (`:103-131`); UTC-only `Date.UTC` arithmetic; `cache:'no-store'`; `.json` shard names to dodge the bridge's `.geojson` hijack (`history.py:5-7`); index with `path,count,first/last_observation_utc` (`history.py:222-228`); byte-stable atomic writes (`:82-90`); refusal to overwrite on malformed archive (`:163-191`); scan-window provenance merged in the index (`:103-127`). Both test suites pass as shipped.

### F5. Divergences from V6
End-anchored `[start,end)` windows with calendar-month 3m/6m/12m (V6: start-anchored, fixed 92/183/366 days) — better for "latest first", but the UX lane must not pair it with V6's Year/Start-date controls. Concurrency capped at 4 (V6 none) — improvement. HTTP failures throw (V6 swallows) — improvement. `maxMapPoints` keeps the **last** 40k (`:168`) instead of V6's hi/lo decimation — oldest flashes vanish with only `truncated:true`. No clamp of `end` to now (H6: `end=2031-01-01` accepted; V6 clamps to today+7d).

### F6. What the draft lacks (demonstrated)
1. **No byte/point budget before fan-out** (H1): a 30d detail window with 100k/day in the index issues all 31 shard requests (~1.63 GB raw) before `maxMapPoints` applies; `row.count` is never consulted; the index has no `bytes` (V6 index has `sizeBytes`).
2. **Unbounded memory cache** (H3): paging 11×31-day windows retained 341 shards; revisit issued 0 requests; no LRU/eviction. Storm shards retain 695 B/feature (H2: 100k features → 69.5 MB heap; 7-day storm ≈ 487 MB).
3. **Scanned-zero and never-scanned are identical** (H4, H11): `history.py:200-201` skips days without records, so `days[]` lacks both; `scan_windows` exists but the client only forwards `scan_window_note`. The brief's "missing is UNKNOWN, never zero" cannot be rendered per day.
4. **Default call over-counts sub-day presets** (H5): `loadWindow(w)` without `detail:true` returns `archivedDayCount` summed over overlapping UTC dates — a 12h window reported 3 vs 1 actual.
5. **Sealed shards bypass the HTTP cache** (H8): every fetch is `no-store`, though raw.githubusercontent.com returns `cache-control: max-age=300` and a strong ETag (`feed_headers.txt`); V6 has no immutable shards, lightning does.
6. **No staleness field**: index has `generated_utc` only; no interval/`next_update_due_utc`.
7. **No live-feed tier**: 12h–7d go straight to day shards although the collector already publishes the V6-style rolling file.

### F7. Storage growth is not bounded by bytes (FAIL in the draft's own terms)
H9: 200,000 synthetic flashes on one day → `days/2026/10/25.json` = 105,368,973 B (527 B/feature); `history.py` raised nothing. GitHub rejects blobs >100 MB, so above ~189,800 flashes/day the cron can never push again; >50 MB (~95k) already warns. V6's builder caps at 25 MB. H10: an empty follow-up run re-read/re-validated the 105 MB shard in 4.8 s — cost is O(archive) per 3-hour run. Also `index.json` changes every run (`generated_utc`), so a commit lands every 3 h even with no new flashes (`files_changed=1` in H10), and the client clears all cached days on any index refresh (`:113`).

### F8. Minimal data contract for the GridAtlas implant (consistent with V6 fields and the collector)
`data/history/index.json` — `uk-lightning-history-index.v2`:
```json
{"schema":"uk-lightning-history-index.v2","generated_utc":"ISO-8601Z","collection_interval_hours":3,
 "collection_lookback_hours":3,"next_update_due_utc":"ISO","cutoff_date_utc":"YYYY-MM-DD",
 "retention":"one calendar year, UTC","source":"EUMETSAT MTG Lightning Imager L2-LFL","source_url":"https://…",
 "observation":"satellite optical lightning flashes, not ground strikes","bounds_wsen":[-11,49.5,3,61.5],
 "max_shard_bytes":25000000,"archived_observations":int,"first_observation_utc":"ISO|null","last_observation_utc":"ISO|null",
 "scan_windows":[{"start_utc":"ISO","end_utc":"ISO","successful_runs":int}],
 "days":[{"date":"YYYY-MM-DD","coverage":"none|partial|full","scanned_seconds":0..86400,
          "count":int|null,"bytes":int|null,"path":"days/YYYY/MM/DD.json"|null,"sealed":bool,
          "first_observation_utc":"ISO|null","last_observation_utc":"ISO|null","sha256":"hex|null"}],
 "status":"archive_partial_until_history_is_genuinely_collected_or_backfilled"}
```
Rules: one row per UTC date from `cutoff_date_utc` to today (≤366 rows; measured 114 KB raw / 4.8 KB gzip); `count` is `null` iff `coverage=="none"`; `count==0` is only legal with `scanned_seconds>0`; `path` null when `count` is null or 0; `sealed = generated_utc ≥ date+1d+lookback`; `bytes` is the shard file size (V6 `sizeBytes`); shard writes above `max_shard_bytes` must fail the run loudly (V6 builder rule).

`days/YYYY/MM/DD.json` — `uk-lightning-history-day.v1` (unchanged feature shape from `collect.py:48-67`):
```json
{"schema":"uk-lightning-history-day.v1","type":"FeatureCollection",
 "metadata":{"date_utc":"YYYY-MM-DD","source":"…","observation":"optical satellite flash; not a confirmed ground strike",
             "count":int,"first_observation_utc":"ISO","last_observation_utc":"ISO","sealed":bool},
 "features":[{"type":"Feature","id":"<product>:<index>","geometry":{"type":"Point","coordinates":[lon,lat]},
   "properties":{"time_utc":"ISO","source":"EUMETSAT","source_product":"MTG LI L2-LFL","observation_kind":"optical_lightning_flash",
                 "name":"…","raw_tech":"…","status":"Satellite detection"}}]}
```
Client rules: tier A (12h–7d) = live feed, fall back to shards for dates the 40k cap removed; tier B (≤31 d) = shards only while Σ`bytes` ≤ 32 MB and Σ`count` ≤ 70k, else degrade to tier C with an explicit reason; tier C (3m–12m) = index only; `cache:'default'` for `sealed` shards, `no-store` for index/unsealed; LRU ≤8 shards; render "unknown" for `coverage=="none"`, "0" only for scanned days; mark stale when now > `next_update_due_utc`. Optional later: hoist constant properties into `metadata` (measured 156 B/feature vs 526 B; keep the full `id`, short ids may collide).

## Objections to other lanes
- UX lane: do not transplant V6's Year select + Start-date input (start-anchored, 2016 floor, YTD rollover on 15 Jan); lightning has a one-year rolling floor and should be end-anchored. Do not render absent days as zero; the draft index cannot tell you.
- Transport lane: do not copy V6's `?t=Date.now()` cache-busting onto sealed shards; raw.githubusercontent.com already sends `max-age=300`+ETag. The `.json` suffix passes `legacyStem()`; verify `text/plain` content-type does not matter to the consumer.
- Storage/collector lane: the live PR has no shard byte cap and no per-day coverage; merging it as-is sets up a storm-day push failure.
- Anyone citing "all tests pass": they do (9+14), but none covers fan-out budget, cache eviction, coverage, or shard size.

## Recommendation for the smallest additive integration
1. In `history.py`: emit one `days` row per UTC date with `coverage/scanned_seconds/count/bytes/sealed` derived from `scan_windows`; add `max_shard_bytes` (25 MB) hard failure; add `collection_interval_hours` and `next_update_due_utc`. Keep day shard v1 unchanged.
2. In `history-window.mjs`: pre-fetch budget from index `bytes/count`; LRU on `cachedDays`; `sealed`-aware cache mode; clamp `end` to now; make `detail` the default for windows ≤31 d; add tier A (live feed) so 12h–7d cost one request.
3. The GridAtlas implant consumes only F8; no V6 UI/CSS; lightning OFF by default; no `data-layer-id`.

## Verdict
FAIL — the draft reproduces V6's navigation and tiering well, but lacks V6's byte-bounded storage and index `sizeBytes`, fans out without a budget, and cannot express scanned-zero vs unknown per day; fix F6/F7 via F8 before any implant consumes it.
