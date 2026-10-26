# Local lightning-archive fixtures for GridAtlas phase 4

Built by `build_fixtures.py` from the lightning branch `data-plane/hourly-lookback-index-v2`
(worktree `../evidence/lightning-data-plane-builder/wt`, commit `f7db76c`) at
**2026-10-26T18:37:03Z**. Never published; served to the browser only through
`harness/offline-shim.mjs`.

## Every point is a genuine observation

All 408 features in every shard and in every `uk_lightning.geojson` are the unchanged EUMETSAT
MTG LI L2-LFL optical flashes of `data/uk_lightning.geojson` at lightning `main` 21c3e56
(21 Oct 12:32:19 → 25 Oct 11:15:58 UTC; 31 / 67 / 189 / 118 / 3 per UTC day). No point was
added, moved, re-timed or invented. The archive (`index.json`, `days/…`) was produced by running
the branch's `history.py` over those flashes with the 17 search windows reconstructed from the
committed feed history (`wt/data/seed_scan_windows.json`, from
`evidence/lightning-archive-auditor/scan_windows_analysis.txt`), so coverage per day is honest:

| UTC date | coverage | scanned_seconds | count | bytes | sealed | path |
|---|---|---|---|---|---|---|
| 2026-10-20 | partial | 4 685 (5.4 %) | 0 | – | true | – |
| 2026-10-21 | full | 86 400 | 31 | 16 667 | true | days/2026/10/21.json |
| 2026-10-22 | partial | 81 609 (94.5 %) | 67 | 35 555 | true | days/2026/10/22.json |
| 2026-10-23 | partial | 42 472 (49.2 %) | 189 | 99 892 | true | days/2026/10/23.json |
| 2026-10-24 | partial | 50 269 (58.2 %) | 118 | 62 521 | false | days/2026/10/24.json |
| 2026-10-25 | partial | 51 158 (59.2 %) | 3 | 1 926 | false | days/2026/10/25.json |
| 2026-10-26 | partial | 20 683 (23.9 %) | 0 | – | false | – |
| all other 359 dates | none | 0 | null | – | true | – |

`count 0` on 20 and 26 Oct is genuine: those hours were searched and held no flash in the UK
box. `null` means never searched (unknown, not zero).

## Layout and how to serve

Each variant mirrors the repository's `data/` directory, because the shim maps
`https://raw.githubusercontent.com/Ventusltd/lightning/<ref>/data/<path>` to
`<lightningDataDir>/<path>`. **Pass the variant's `data` folder**:

```js
await installOfflineShim(page, { lightningDataDir: '<fixtures>/lightning-archive/data' });
// → .../data/history/index.json, .../data/history/days/2026/10/23.json, .../data/uk_lightning.geojson, .../data/status.json
```

| folder | purpose | what differs from the genuine archive |
|---|---|---|
| `lightning-archive/` | the good archive: index v2, 5 day shards, `status.json`, live feed | nothing |
| `lightning-archive-broken-json/` | `history/index.json` is an HTML error page, not JSON | SYNTHETIC: the index body only; shards and feed real |
| `lightning-archive-missing-shard/` | index lists 2026-10-23 (189 flashes) but `days/2026/10/23.json` is absent → 404 for that day | SYNTHETIC: a deleted file only |
| `lightning-archive-no-index/` | only `uk_lightning.geojson` (archive not yet published → fallback path) | nothing synthetic |
| `lightning-archive-stale/` | `generated_utc` and `next_update_due_utc` are 9 h before the build time | SYNTHETIC: those two index fields (`fixture_synthetic_fields`) |
| `lightning-archive-big-count/` | the 30-day window sums to exactly 120 000 flashes / 48 000 000 bytes in the index; shards are the real small ones | SYNTHETIC: `count` (119 781) and `bytes` (47 883 331) on the 2026-10-23 row only; the row keeps the real `path`/`sha256`, the real values are kept in `fixture_real_count`/`fixture_real_bytes`, and the index carries `fixture_note` |

`MANIFEST.sha256` lists the sha256 of every fixture file (`sha256sum -c MANIFEST.sha256`).

## Expected client behaviour (verified with `evidence/lightning-data-plane-builder/verify_fixtures.mjs`)

| fixture / window | mode | state | notes |
|---|---|---|---|
| good / 7d | detail | PARTIAL | 408 drawn, 56 % searched, 17 runs, tail not yet ingested, 1 of 8 dates without a run |
| good / 23 Oct | detail | PARTIAL | 189 drawn, 49 % searched, 4 runs |
| good / 12m | overview | PARTIAL | index only, 1 request, "359 of 366 UTC dates have no collection run" |
| broken-json / 7d | feed (fallback) | PARTIAL | reason names the JSON parse error; 408 from the live feed |
| missing-shard / 7d | detail | FAIL | `failures: [{date: 2026-10-23, error: HTTP 404}]`, 219 drawn, index count 408 kept |
| no-index / 24h | feed (fallback) | PARTIAL | "archive not yet published: HTTP 404" |
| no-index / 30d | rejected | — | `History index unavailable: HTTP 404` (the UI disables 30d+) |
| stale / 7d | detail | PARTIAL + STALE | "Refresh archive … (9h 0min ago) · STALE" |
| big-count / 30d | overview | PARTIAL | budget 120 000 / 48 000 000 refused before any shard request, `canLoadPoints` |
| big-count / 30d + consent | detail | PARTIAL | newest 3 days loaded, "120,000 archived in window (index) · 310 drawn from the newest 3 of 5 days" |

## Time dependence

`generated_utc` is the build time. The good archive looks STALE to a real clock about 3–4 h
after the build (`next_update_due_utc` = build + 3 h; the client also flags age > 4 h), and the
stale variant is defined relative to the same build. For reproducible browser tests either
install a fake clock (`page.clock.install({ time: '2026-10-26T18:40:00Z' })`) or rebuild:

```bash
python3 build_fixtures.py ../evidence/lightning-data-plane-builder/wt . [--now 2026-10-26T18:34:47Z]
```

Rebuilding regenerates every variant and the manifest; the shard bytes and sha256 values do not
change (the shards contain no timestamps of their own).
