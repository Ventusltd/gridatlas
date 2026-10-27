# Lens: the data product (rollups)

**Verdict.** Yes to a rollup layer, owned by Ventusltd/lightning beside index v2, so GridAtlas and See Through read counts instead of computing them from raw flashes. It is not a headline product yet: the archive holds one fully searched day.

## Copy price v2, not V6 generation
- `gb_decade` (current.json:330-341) reads a derived product that fails closed. Its consumer recomputes totals and shares from per-year parts and refuses on any disagreement (202610221600-sld-sandbox-v9-8.js:5394-5429, 5462-5471), and it keeps numerator and denominator visible ("580 of 3,339"). The pinned v2 is 6,873 B (202609030137-pinned-products.js:74), not the "4 kB" in current.json:334.
- V6 generation rows carry `records` (2026-05-13 has 1 of 288 readings), but control_generation_history.js:14 never checks it, so a one-reading day is plotted as a full day.
- Index v2 already holds daily truth: `coverage`, `scanned_seconds`, and `count` null iff never searched (history.py:202-205, 476). Daily counts are therefore not a new product. Rollups reconcile to them.

## Coverage rule (binding on every file)
- C1: every count travels as `{count, scanned_s, span_s}`, or as an array aligned with a `scanned_s[]` in the same file. A file-level triple is allowed only when every element was computed under that same searched time.
- C2: status is derived, never asserted: FULL, PARTIAL, or UNKNOWN (scanned 0 means count null). Consumers recompute it.
- C3: parts reconcile. Σ hourly equals the index day (count and seconds), and Σ areas + `outside` equals the total. On a mismatch, no numbers are shown.
- C4: maxima may come from partial periods and are labelled "at least". Zeros, minima and comparisons need FULL coverage on both sides.
- C5: no scaling, interpolation or cross-period rates. Detection is about 70 % by day against 95 % by night (egusphere-2026-3177, a preprint).
- C6: anything touching an unsealed day is `provisional`. Every file states `observation: optical flashes, not ground strikes`.

## Products
A `rollup.py` step writes them to `derived/` after `history.py ingest`, hourly (cron `17 * * * *`). It recomputes only days touched since the last run and never blocks the feed. Sizes below are measured on the 408 genuine flashes; year sizes are shape estimates with stated assumptions.
- `manifest.json`: per file `schema, bytes, sha256, generated_utc, index_generated_utc`.
- `headline.json` (`lightning-gb.headline.v1`): `as_of, coverage{since, scanned_s, span_s, days{full,partial,none}}, windows{24h,7d,30d}, days_with_flashes{n, of_searched, of_full}, records{busiest_hour, busiest_day, busiest_10min, largest_episode}, withheld[]`. The example is 1,695 B raw, 830 B gzip.
- `hourly.json`: `t0_utc, step_s, scanned_s[], count[]`. The seed is 1.1 kB; a year is about 63 kB raw, 6 kB gzip.
- `regions.json`: `areas[{id, source, vintage}]` for 14 DNO licence areas, 11 GB ITL1 regions and `outside`, each with a daily `count[]` against a shared `scanned_s[]`. Not computed: there are no boundary polygons on this machine.
- `near-substations-{7d,30d,365d}.json`: `keyspace{file, sha256, n:5800}`, a window triple, and dense `r5km[]`, `r10km[]` (zeros written, never implied). The seed is 35 kB raw, 0.9 kB gzip; a year is about 50 kB raw, 19 kB gzip per window.
- `near-lines-*.json`: per 400/275/132 kV class, the flashes within 5/10 km, `buffer_km2`, and a per-way `r10km[]`. These are OSM ways, not circuits, so no circuit names.
- `episodes-{30d,365d}.json`: `params{link_km, link_min, min_flashes}` and, per episode, `id, start/end, flashes, bbox, hull_km2, peak_10min{slot, count}, censored{start, end, edge}, substations_within_10km` (a count only). About 324 B each.

## What the seed shows
- 136 hours spanned: 81 fully searched, 30 partial, 25 not searched.
- The busiest hour was 23 Oct 15:00 UTC with 71 flashes, fully searched. The busiest day was 23 Oct with at least 189 flashes, though only 49 % of it was searched. That beats the only full day (21 Oct, 31 flashes), which is C4 at work.
- Episode counts depend on the linkage parameters: 131, 73 and 57 at 10 km/10 min, 25/20 and 50/30, with the largest episode at 71, 135 and 151 flashes. Parameters therefore live in the schema, and changing them bumps the version. 7 of 73 episodes are cut off by a coverage gap.
- 238 of 5,800 substations had a flash within 10 km, and 6 within 1 km. By viewing geometry, a 4.5 km nadir pixel covers about 5 × 9-13 km over GB, so 1 km is smaller than one pixel. Publish 5 and 10 km. Withhold 1 km and any site ranking; README.md:3 also says "No particular site is targeted, analysed or named".

## Pinning
`gb_decade` pins a commit because its product changes monthly; an hourly product pinned the same way would freeze. Pin what must not move silently: the schema and the key spaces. Those are grid_substations.geojson sha256 `87976435…` (verified identical in order to descent.js:15 SUB), the line files, and the boundary vintage. Check the moving bytes against `manifest.json` on every no-cache fetch.

## Not known
LI location accuracy over GB and whether L2-LFL corrects for parallax. The licence-area split of the seed: the NESO file is EPSG:27700 under the NESO Open Data Licence, and its API is blocked here. Real annual volume.

## Recommendations
1. Write `rollup.py` in Ventusltd/lightning, emitting manifest, headline and hourly first, with a consumer gate modelled on `gbProductError`.
2. Key spatial rollups to the grid digests See Through and GridAtlas already share: 5/10 km only, no site ranking.
3. Keep this complementary to the cartridge. It has about 800 bytes left (PLAN §1, §9), so reading the headline ships in a later generation.

**Would change my mind:** evidence that LI geolocation over GB is off by more than about 10 km. Per-substation counts would then be noise, and licence-area counts should replace them.
