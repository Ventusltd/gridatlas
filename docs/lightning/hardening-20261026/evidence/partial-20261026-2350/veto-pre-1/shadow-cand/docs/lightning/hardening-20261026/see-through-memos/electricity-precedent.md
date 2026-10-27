# Lens: the electricity intelligence precedent

Paths: V6=/home/claude/ventusltd/globalgrid2050/uk_energy_tracking_v6/, S=/home/claude/ventusltd/globalgrid2050/scripts/, SB=/home/claude/gridatlas/atlas/cartridges/202609241334-sld-sandbox-v9-8.js, PP=/home/claude/gridatlas/atlas/modules/202609030137-pinned-products.js, DP=/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/lightning-data-plane-builder/wt/. Loader mechanics: reports/v6-tracker-pattern-study.md, not repeated.

## What was built
1. **Collect:** a script per feed behind a dispatch workflow; a failed source is recorded, not fatal (S/update_uk_price_v6.py:135-143). No data workflow is scheduled now; live feeds stop at 2026-06-18.
2. **Store by grain:** ~250 B live JSON; yearly CSVs; a 656 kB daily file dropping days under 24 of 48 periods (S/generate_price_history_daily_v5.py:12,76-78); a 9.7 MB chunk with index, 25 MB cap and audit/apply report (S/build_generation_daily_mwh_fuelhh_chunks.py:101-142). Doctrine: globalgrid2050/data_science_protocol/THE_DATA_SPINE.md (peaks do not roll up :83-86; never overwrite good data :115-117).
3. **Load:** Year/Start/Period, previous/next, swipe; 12 months and longer read the daily file. No browser script reads the index.
4. **Draw:** canvas renderers, decimation keeping each bucket's high and low (V6/price_history_chart/render_price_chart/render_price_chart.js:32); 18 repair reports, mostly phone layout.
5. **Federate:** the tracker's rollup was retired to Ventusltd/data-gb-electricity (V6/derived/README.md). GridAtlas reads a 6,873-byte rollup pinned by commit and sha256 (PP:52-77; re-downloaded, hash matches) and links out. SB:5329-5334: the 49 MB tracker was deliberately not ported.

**The precedent never put charts inside GridAtlas:** owner repository → small verified product → card plus link.

## Mapping
| Stage | Transfers unchanged | Lightning rewrite |
|---|---|---|
| Collect | per-source health; failure keeps last success | log coverage as time searched: electricity exposes gaps as missing rows (48 expected daily); a calm lightning day looks like an unsearched one |
| Store | grain ladder, byte caps, audit/apply, atomic writes (generate_price_history_daily_v5.py:102-104) | counts add only over searched time; partial days are lower bounds |
| Load | window arithmetic, tiers, caches (DP/history-window.mjs) | end-anchored, one-year floor; sealed shards cacheable |
| Draw | decimation, fullscreen, phone layouts | break lines at unknown (V6 bridges gaps, render_price_chart.js:34,48); no extremes from partial periods; no forecast line |
| Federate | PP `verify()` for sealed rollups; ready/withheld/failed states (SB:5453-5471) | live data cannot be pinned; the candidate reads `main` (…/202610261949-uk-lightning-overlay.js:9-10) and should say so |

## Lessons not to relearn
- **Partial periods become extremes:** Nuclear's 2026 "LOW DAY" on V6's daily MWh chart is 2026-05-31, 46 of 48 records; the lowest complete day is 2026-05-23. The renderer ignores `completeness` (V6/generation_history/render_solar_daily_mwh_chart.js:9,21).
- **Gaps sit mid-record:** the owner rollup marks 2018, 2021 and 2025 partial (75.6%, 58.6%, 33.7%) where V6's copy (V6/derived/decade-summary.json) shows 365 days each; V6's YTD rule (control_price_history.js:3-4,12-14) sees only the current year.
- **`force-cache` served v1 for hours** after v2 shipped; use `no-cache` (SB:5435-5442).
- **Schema strings check shape, not values** (PP:12-24).
- **Failure must not erase data or refresh timestamps:** S/generate_price_history_daily_v6.py:8-11 writes empty rows over good ones; update_uk_price_v6.py:144-146 stamps run time, shown as data time by render_live_snapshot.js:23-26.
- **One quantity per series:** Market Index captures merge into the series labelled System Price (generate_price_history_daily_v5.py:51-58; V6/index.md:47). Never merge optical flashes with ground strikes.
- **Order:** "File first. Audit second. Config third. UI test fourth." (V6/generation_history/THREAD_CATCHUP_LOG_20260609.md:52); "Visual power last" (GENERATION_HISTORY_DEVELOPMENT_COMPARISON_LOG.md:172).

## Answer
**Yes to a separate product on the federated pattern; not yet to charts or See Through.**
- **Record too thin:** the fixture index holds 93.7 searched hours of 8,784 (1.07%), one full day; V6's charts assume a dense decade.
- **Missing gate:** DP validates rows singly (DP/history-window.mjs:140-157); unlike SB:5400-5418 it never reconciles `archived_observations` with summed counts, or coverage labels with `scanned_seconds`.
- **Contract:** `uk-lightning-rollup.v1`, one row per UTC month: calendar days; days fully, partly, never searched; hours searched; flash count (lower bound unless all full); maximum daily count from full days only; owner-computed status; sha256 per sealed month.
- **Budget:** the candidate cartridge leaves 808 bytes under 460,000 (/home/claude/gridatlas/tools/scope/loop.mjs:194); See Through's JavaScript is ~836 kB. Charts and See Through need their own route; the additive overlay stays in GridAtlas and links there.

**Not verified:** data-gb-electricity, gb-electricity-ui (globalgrid2050/AGENTS.md:7), UI_CHARTS_MIGRATION_SCOPE.md; whether EUMETSAT permits backfilling missed hours.

## Recommendations
1. Before any chart, add the monthly coverage rollup and a client gate that withholds values when totals or coverage disagree.
2. Keep GridAtlas to the additive overlay plus a link; charts live on the lightning product's page.
3. Reuse V6's controls, decimation and phone layouts; rewrite renderers so unknown shows as unknown and partial periods yield no extremes.

**Would change my mind:** a verified EUMETSAT backfill lifting searched coverage above ~95% for a full convective season; then charts could come sooner.
