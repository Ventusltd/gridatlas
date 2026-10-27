# kv-stars: combination matrix for Lightning Build I (202610270929), node only

**Method.** The stars method (`stars/README.md`): each star is one recorded run of a component combination. The chemistry rule (`stars/reports/CHEMISTRY.md`): stability = share of a compound's stars that are GREEN, and decay = what a failing star produces. The run used node:vm with `opus-fix-designer/minidom.mjs`, a strict fake MapLibre and the clock fixed at 2026-10-27T13:45:00Z.
- **Archive:** real, `Ventusltd/lightning` **2a49652** (10:43:35Z, the newest before 13:45Z; next is d32e6b6 at 15:24Z): index, 22 SHA-verified shards, feed, status.
- **Ground truth:** counted independently from the shards.
- **Matrix:** 9 periods × PREV 0/1/2 × archive (real, feed-only = index network error, index 404) × fresh/stale × phone/desktop × tap (none / flash / flash + NEAREST) = **972 stars**.
- **Three runs:** neon links from `data-grid-gb/derived/connection-points.v3.json` (489 located sites, all ≥132 kV); the real `grid_substations.geojson` payload parsed with the cartridge's own `voltagesKv`/`representativePoint`; and the patched module.
- **Result:** 0 harness errors and 0 module errors. Drawn count equals ground truth in **972/972** stars, and feed counts equal feed truth.

**Reproduced the owner's screenshots exactly.** 48H shows `[≥29 | 48h STALE]`. 30D, 3M, 6M and 12M all show `[≥1,480 | … STALE]`. NEAREST shows `5.42 km · 400 kV · Wymondley Substation` for the 2026-10-18 13:46:17Z flash at −0.313, 51.899.

## Pattern recognition

**1. Identical counts are correct, but the label hides why.**
- 12H, 24H and 48H all give 29. The 10 flashes on 25 Oct all fall before 13:45 (13:19 is the last), and 26 Oct was searched in full with 0 flashes. So 29 is the truth.
- 30D, 3M, 6M and 12M all give 1,480, because only 2026-09-29 → 10-27 was ever searched (337 of 366 index days are `coverage:none`). Ground truth for each window is also 1,480.
- Coverage is honest in the status line and caption: `SEARCHED 88% / 28% / 14% / 7%`, and "Unknown: 337 of 366 UTC dates have no collection run". But the **label** the owner reads (module line 182, `lt`) shows only `≥1,480`.
- "≥" is mathematically right (a lower bound), but on its own it does not explain identical numbers.
- In feed-only and index-404 states, 30D–12M show `444 · last 7 days only` (feed truth 444; the archive holds 1,480). That is correct and clearly labelled.

**2. STALE.**
- At 13:45 the index was 3 h 1 min old, and `next_update_due_utc` was 13:43:35. STALE is genuine, but only 1.5 min past due.
- The collector's own `status.json` reports `freshness:"ok"` with thresholds warn 6 h / stale 12 h. The index and the status file use two different notions of stale.
- **Feed-only and index-404 never show STALE** (0/36 stale-data stars at PREV 0). Module line 47 uses `now-gen<=4*HOUR`, and the feed has no `nextDue`. So the same 10:26Z feed is STALE in archive mode and fresh in feed mode at the same moment.
- Correction to the brief: the hourly collector last ran at **10:26–10:43Z** (`status.last_successful_run_utc`, commit 2a49652), not 08:55. Nothing followed until 15:24Z, a gap of 4 h 41 min.

**3. Paging, device.** NEXT×k round trips pass in 972/972. PREV is disabled in feed-only and index-404 (line 192, `!S.idx`), a minor issue. Device altered the drawn count 0 times.

**5. Tap paths.**
- **Never add a map layer:** `none`; `flash` (card only, by design); NEAREST when no flash is drawn (17 combinations: real-archive PREV windows that are UNKNOWN or EMPTY, and Custom in feed mode); NEAREST before substations load; and NEAREST on a cluster (not reached here, since 1,480 is under both caps).
- **Any later map tap removes the lines** (`tap` → `pc` → `nc`, lines 143, 128).
- **NEAREST does add lines: 3 lines and 4 layers in 256/256 stars, with 0 camera moves.** That is why the owner sees "no lines".
- At a national zoom of about 5, the Wymondley set is **3.6 / 8.9 / 14.9 px long, 0.9 px wide** (line 161), and starts under the 7.5 px flash dot (lines 136–137). The card is about 450 of 664 px tall on an iPhone, estimated from text length since minidom has no layout. The deep link instead flies to zoom 12, where the same 5.42 km is about 460 px.
- **Different rule from the engine:** line 156 keeps `kv[0]>=132` and the 3 nearest, with no radius. The deep link uses the cartridge's public pure `link.measure.nearestSubstations` (sld-sandbox lines 3511–3540, exported at 3585): ≥33 kV (`MIN_KV`, 1663), 5 links (`LINK_COUNT`, 1664), within 40 km (`MAX_LINK_KM`, 1665).
- With the real payload, Lightning shows **0/256** 33 kV sites, while the engine would show 33 kV in 256/256. Their first answers match in only 20/256.
- Example, the 7D flash at −1.631, 51.451: Lightning shows `13.41 km · 132 kV · West Grafton`, but the engine's nearest is `1.72 km · 33 kV · Ramsbury S/S`.
- `stars/code/names.json` already numbers `nearestSubstations` (families 514, 8477, 64149): the same work done twice.

## Chemistry (compounds = archive·tap over all other dimensions; release payload)

| compound | stars | stable, Build I | decays to (Build I) | stable, patched | decays (patched) |
|---|---|---|---|---|---|
| real·none | 108 | 74 % | same ≥count, coverage hidden ×28 | 100 % | — |
| real·flash | 108 | 74 % | same ≥count, coverage hidden ×28 | 100 % | — |
| real·nearest | 108 | 41 % | coverage hidden ×28; lines unframed ×64; no 33 kV ×64 | 100 % | — |
| feedonly·none / ·flash | 108 each | 33 % | coverage hidden ×36; STALE hidden ×54 | 67 % | ≥29 shared by 12H/24H/48H (true; feed coverage genuinely unknown) |
| feedonly·nearest | 108 | 6 % | + lines unframed ×96; no 33 kV ×96 | 67 % | as above |
| index404 (all taps) | 324 | 33 / 33 / 6 % | as feed-only | 67 % | as above |

No compound decays to an error or a wrong count; every decay is presentation or framing. (elements/ registers no `block:` symbol for Lightning; none invented.)

## Minimal fixes (built and tested: `evidence/kv-stars/patched/module-I-kv.js`, 33,623 → **34,074 B, +451**, cap 44,781)

| id | line | change | bytes |
|---|---|---|---|
| K1 | 182 `lt` | PARTIAL labels add `· N% searched`, e.g. `[≥1,480 · 7% searched \| 12m STALE]` | +72 |
| K2 | 47 `stale` | `4*HOUR` → `3*HOUR`, so feed mode uses the collector's 1 h + 2 h grace, like the index | 0 |
| K3 | 156–157 `nr` | use `L.measure.nearestSubstations` (≥33 kV, ≤40 km, 5), with the same rule as a fallback; empty-result text updated | +65 |
| K4 | 163 `near` | `nr` returns `k`; `fitBounds` over flash + links, top padding = card height (≤ half the map), maxZoom 13 | +314 |

Patched results: 972 stars, 0 errors, counts still equal truth. NEAREST now draws **5 lines with 33 kV in 256/256** stars and makes 1 camera fit. STALE now shows in all 54 stale feed-mode stars. Real-archive compounds are 100 % stable.

Existing suite (`test-fixes.mjs`): **90/91**. Only I3 fails, and on purpose: it asserts ≥132 kV, 3 lines and no "Tiny 33kV", which contradicts the owner's expectation. I3 should be rewritten to the engine's rule.

Not applied: shorten the 142-character flash ID (about 6 of roughly 22 card rows on a phone; about +40 B). K4 still needs an iPhone-viewport browser check (BROWSER lane).

Evidence: `evidence/kv-stars/` (harness, three star logs, analyses, `chemistry-table.md`, `fixture-2a49652/`).
