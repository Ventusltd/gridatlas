# overlay-code-review fixtures — SYNTHETIC, never publish
Byte copies of the lead's fixtures (`scratchpad/lightning/fixtures/*/data`) with ONE string changed each; every feature stays a genuine observation.
- `SYNTHETIC-hostile-index-first-obs/` — from `lightning-archive`: `history/index.json` row 2026-10-21 `first_observation_utc` = "not-a-date" (real value kept in `fixture_real_first_observation_utc`; `fixture_note` set). Hits overlay line 107 (`Ts(Date.parse(o[0].first_observation_utc))`) in overview mode (3m/6m/12m or custom >31 d).
- `SYNTHETIC-hostile-feed-query-end/` — from `lightning-archive-no-index`: `uk_lightning.geojson` `metadata.query_end_utc` = "not-a-date" (real value kept in `fixture_real_query_end_utc`). Hits overlay line 102 (`P('query_end_utc')`) in feed mode.
Purpose: D15 / §11 hostile-JSON probes of caption rendering. The earlier `SYNTHETIC-hostile-observation-utc` (23 Oct row) was removed because line 107 parses only the first and last rows with flashes.
