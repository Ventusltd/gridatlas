# opus-browser-tests fixtures — SYNTHETIC, never publish

Built by `../build_synthetic.py` (`python3 -I build_synthetic.py`) from the lead's genuine fixture
`scratchpad/lightning/fixtures/lightning-archive/data` (built 2026-10-26T18:37:03Z). Each variant is a byte copy
with only the change below; each changed index row carries a `fixture_synthetic` note. `MANIFEST.sha256` lists every file.

| folder | used by | change |
|---|---|---|
| `SYNTHETIC-hostile-index-timestamp/` | T2 | index row 2026-10-21 `first_observation_utc` = `"not-a-date"` (real value kept in `fixture_real_first_observation_utc`) |
| `SYNTHETIC-out-of-box/` | T9 | shard 2026-10-25: 3 genuine flashes + 3 SYNTHETIC records (lon/lat 20,40 outside the UK box; `[null,null]`; `["NaN","NaN"]`); index count/bytes/sha256 recomputed so the row is self-consistent |
| `SYNTHETIC-shard-mismatch/` | T10 | INDEX only: 2026-10-22 `sha256` = 64 zeros; 2026-10-23 `bytes` +1; 2026-10-24 `count` −1. Shards untouched |
| `SYNTHETIC-bulk-day/` | T11, T12 | shard 2026-10-25 replaced by 85,000 SYNTHETIC points (00:00:00–05:49:59 UTC, uniform in −10.5..2.5 E, 50..61 N), 33,713,273 bytes (> 32,000,000); index row count/bytes/sha256 recomputed, coverage `full` |

T3 builds a further mutable copy of the lead's `lightning-archive-no-index` at run time under `runs/<gen>-<stamp>/T3-feed/`
and rewrites `metadata.query_start_utc/query_end_utc` of `uk_lightning.geojson` between the two ON presses (SYNTHETIC change, logged).
Other tests use the lead's fixtures unchanged.
