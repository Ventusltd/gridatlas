# Lens: architecture of a separate product

## Answer
Yes, as three owners joined by URLs and pinned contracts, not a new application. See Through code never enters GridAtlas; a See Through lightning view complements the additive cartridge through a link.

## What the code forces
- **The price panel works because of ownership and pinning.** data-gb-electricity owns the numbers; GridAtlas checks one commit-pinned rollup's length and sha256 before showing any value (atlas/modules/202609030137-pinned-products.js:69-76, 133-158; current.json:330-341). "Moving a pin is a cut" (pinned-products.js:31). The pin records 6,873 B (line 74), not the "4 kB" in current.json:334.
- **Every lightning consumer reads `main`:** weather-module.js:12, PLAN §3.2/3.4, history-window.mjs:46-47. data-gridatlas forbids this for its own consumer (`floating_raw_urls: false`, contracts/202608290904-gridatlas-consumer.json:11).
- **Shard digests are never checked.** Index v2 stores `bytes` and `sha256` per shard, but `shard()` (history-window.mjs:459-470) only checks schema and date.
- **See Through cannot run inside GridAtlas:**
  - MapLibre clash: GridAtlas loads 3.6.2 (releases/202608300453-atlas-v9/index.html:133); See Through ships 4.7.1 and builds its own map.
  - Size: descent.js is 156 kB. sld-sandbox has 24,782 B of headroom (tools/scope/loop.mjs:194) and is already past cvaa's 400 kB app-copy line (pointer-verifies.md:24).
  - Licence: See Through is CERN-OHL-S v2 (see-through/202610050609/LICENSE.md:3-7); GridAtlas and lightning are Apache-2.0.
- **See Through is already a copy chain:** three 3.08 MB dated folders; across kuiper-belt, kuiper-law.js exists 13 times and grid-data.js (587 kB) 10 times. The antibody's regex needs `-name-vN`, so it misses this (no-app-copies.md:15).
- **See Through has no extension seam.** `open(host)` takes only a host (descent.js:883, 1072-1073), and nothing reads the URL hash.

## Ownership layout (no new repository)
```
Ventusltd/lightning    Apache-2.0: observations and every number derived from them
  contracts/           feed.v1, history-index.v2, history-day.v1, daily-rollup.v1
  data/                uk_lightning.geojson, status.json, history/index.json  (live head)
  data/history/days/YYYY/MM/DD.json                                          (sealed)
  derived/             build_daily_rollup.py, uk-lightning-daily-rollup.v1.json
  .github/workflows/   update (hourly), refresh-rollup (daily, after sealing)
Ventusltd/kuiper-belt  CERN-OHL-S: See Through UI, no lightning bytes
  see-through/lib/<sha12>-<name>.js         written once
  see-through/layers/<sha12>-lightning.js   new, <= 20 kB
  see-through/v/<gen>/index.html + manifest.json   names lib files by sha256
Ventusltd/gridatlas    Apache-2.0: consumes, never derives
  atlas/modules/<GEN>-uk-lightning-overlay.js      in flight, plus one link
  pinned-products.js                               plus one rollup pin, later
```
Rollups stay with the owner, as price-decade-rollup does (uk_energy_tracking_v6/derived/README.md:3-20).

## Contracts
1. **Live head (feed, index, unsealed shards).** Pin schema, repository, path and maximum bytes, never a digest; a digest pin would fail within the hour (transport F10). Show `generated_utc`, and show STALE after `next_update_due_utc`.
2. **Sealed shard.** Check `bytes`, then `sha256`, against the index row before drawing. A mismatching day becomes UNKNOWN with its reason. A browser with no crypto draws it marked unverified (pinned-products.js:88-95).
3. **Daily rollup.** Sealed shards only. Consumers pin repository, commit, path, sha256, bytes and schema; any other schema fails closed (current.json:337). Genuine fixture: 366 rows, 9,717 B raw, 1,158 B gzip; only 7 rows have coverage today.
4. **Code reuse.** `lib/` files are content-addressed, and CI checks each name against its digest. See Through adds `open(host, {layers, at})` and a deep link `#layer=lightning&date=…&sub=…`, modelled on contracts/atlas-v9-deep-link-contract.v1.json.
5. **Cross-repo copies.** The history-window functions PLAN §7 lets GridAtlas inline need a parity proof that runs the canonical file, as geodesy already has (current.json:234-235).

## How GridAtlas consumes it
- **Cartridge:** keeps its role, adopts contract 2.
- **Deep link from the caption:** about 200 B, no MapLibre clash, no licence mixing. **Chosen.**
- **Rollup panel:** UK-wide only, and only after a sealed month exists.
- **Per-site card:** no. lightning/README.md:3 says no site is targeted.
- **Pinned candidate route (`atlas/v/<GEN>/`):** measures the cartridge; does not consume the product.

## Order
(1) merge the data plane, contracts, shard verification; (2) collect a sealed month; (3) kuiper-belt no-copy layout and seam; (4) layer: rollup at UK altitude, shards in the porthole, ≤10k points on phones; (5) GridAtlas link, then rollup pin.

## Unknowns
data-gb-electricity is not cloned here (`gh` 403), so its layout is inferred from consumers. kuiper-belt Pages CORS not measured. Imager detection efficiency at UK latitudes unknown to me. The licence point is a flag, not a legal opinion.

## Recommendations
- Keep observations and rollups in Ventusltd/lightning only.
- Verify sealed shards by sha256 now; pin only rollups by commit.
- Link from GridAtlas to See Through; never import its code.

**Would change my mind:** GridAtlas moving to MapLibre 4.x with a lazily loaded cartridge budget, plus See Through code offered under Apache-2.0.
