ENGINE READY

# DC-B3 · Grid Engine 30/30/30: what the original engine can do, measured (issue #73 step 8)

For DC-B1. All figures come from `bench.mjs` → `results.json` and `bench2.mjs` → `results2.json` in this folder. Both ran in node v22 on the real data. No original file was altered: the engine functions are sliced byte-for-byte from the live cartridges and run in a `vm` sandbox.

## Inputs (sha256)
| what | file | sha256 | rows |
|---|---|---|---|
| live sld-sandbox (v9.156 slot) | atlas/cartridges/202609241334-sld-sandbox-v9-8.js | 7812953671d8bb22… | – |
| geodesy (live copy in substation-intelligence, identical to modules/202609011950-geodesy.js) | atlas/cartridges/202609062358-substation-intelligence-v9-63.js L1653-1783 | d94b0de50dedd… | – |
| substations (`SUBS_URL = 'data/grid_substations.geojson'`, resolved against the shell `<base>`) | atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson | 87976435766a58dd… | 5,800 (all 5,800 qualify at ≥33 kV) |
| REPD map register (the `/dist/repd_master.json` fallback of offtakers RG()) | globalgrid2050 dist/repd_master.json via the gh API | ca5da437ddb832f7… | 10,784; 9,636 distinct sites at 4 dp |
| conventional (interim) | data/offtakers_filtered_202610290945.geojson, class B | 6fc20e04fdcaadc5… | 358; 344 not closed or converted |
| conventional (alternative) | atlas/releases/…/data/power_plants.geojson | c7478e14724602fc… | 178 (gas 174, nuclear 4; too thin) |
| tap origins (lead instruction) | evidence/DC-A4/out/dc_operational.geojson | 614e69318c3ef53f… | 190, of which 178 are data centres (12 cable landing stations excluded) |

## 1. Can `nearestSubstations` return 30? No.
- `atlas/cartridges/202609241334-sld-sandbox-v9-8.js:3513` `nearestSubstations(lon, lat, subs)` returns `scored.slice(0, LINK_COUNT)`.
- The limits are closure `const`s at L1663-1665: `MIN_KV = 33`, `LINK_COUNT = 5`, `MAX_LINK_KM = 40`. They are not parameters, and `link.measure.LINK_COUNT` is only a copy, so setting it changes nothing.
- The 33 kV floor is not applied inside the function. It is applied when `loadSubstations()` (L3482) builds `link.substations`, keeping features whose maximum is ≥ 32.5 kV.
- Measured: the maximum return length over 178 data-centre origins is **5**.
- Past 40 km it returns `[]` and carries `.beyondRadiusNearest` and `.radiusKm` on the array.
- **How to get 30 without touching the original:** call `window.__GRIDATLAS_MODULES__.gridScope.scope(origin, link.substations, { bandsKm: [2, 5, 10, 25, 40], nearestCount: 30 })`.
  - This is the engine's own Grid Finding Scope (same cartridge, L45-186, frozen and exported; the engine calls it at L5741). It uses the same geodesy (R 6378.137 km, atan2 haversine) and the same `link.substations` list.
  - Count and radius are parameters (radius = last band).
  - It also returns per-band counts by voltage class (400/275/220/132/66/33; anything else is counted as unclassified, never rounded), `nearest_transmission` (≥275 kV) and its own not-capacity wording.
- **Parity proof:** for 2,499 origins (178 DC-A4 + 164 OT class C + 2,157 rural), the first 5 of `scope(...).nearest` equal `nearestSubstations` exactly: same objects, same order, same km. 2,499/2,499, 0 mismatches.
- **Independent haversine** (R 6371.0088, asin form, radius scaled): the same 30 in the same order for 178/178 origins.
- Caveats for the card:
  - `scope` returns `kv` as the maximum (a number), not the array, and adds `class_kv`.
  - Pass no `minimumKv`. `link.substations` is already filtered, and passing 33 would drop a 32.5-33 kV entry that `nearestSubstations` keeps.
  - `scope` has no `beyondRadiusNearest`, so when it counts 0 within 40 km, also call the original `nearestSubstations` for the "nearest beyond 40 km" line.
- A fallback that also reuses the original: call `nearestSubstations` 6 times, removing the 5 found each time (identical result, about 6× the cost). This is not recommended.

## 2. Is 30 within 40 km realistic? (`results.json` → distribution)
| set | origins | km to 30th: p50 / p90 / max | ≥30 within 40 km | <5 within 40 km |
|---|---|---|---|---|
| substations ≥33 kV | 178 data centres | 11.7 / 20.2 / 40.3 | **99.4 %** | 0 % |
| substations ≥33 kV | 2,157 rural (every 5th REPD point) | 18.0 / 32.8 / 236.7 | 94.1 % | 0.5 % |
| substations ≥132 kV only | rural | 35.4 / 69.0 / 321 | 61.4 % | 4.5 % |
| REPD sites | data centres | 9.0 / 13.5 / 39.6 | **100 %** | 0 % |
| REPD sites | rural | 11.8 / 22.6 / 210 | 98.2 % | 0.2 % |
| conventional (class B, live) | data centres | **49.6 / 121 / 278** | **15.2 %** | 7.9 % |
| conventional (class B, live) | rural | 75 / 209 / 533 | 5.8 % | 32.7 % |

- Substations and REPD: 30 within 40 km is the norm.
  - For data centres it is near-universal; the one shortfall has 29.
  - It is rural and island points that fall short: Scilly, Shetland and Western Isles take the maximum.
- Conventional: a 40 km cap is not workable.
  - Lines drawn within each cap (mean per data-centre tap; taps with all 30): 40 km 18.2 (27/178), 60 km 25.0 (119/178), **100 km 28.2 (155/178)**, 150 km 29.0 (164/178).
  - DC-A5's DUKES 5.11 or GPPD set will be denser than 344 sites (DUKES lists more small CHP, OCGT and diesel), so re-run `bench2.mjs` on it.

## 3. Cost per tap (node, warm, mean of 400-1,000 taps; a phone is typically 4-8× slower)
| search | ms |
|---|---|
| original `nearestSubstations` (5) | 4.2 |
| `gridScope.scope` (30, 5 bands) | 6.1 |
| REPD 30, full scan + sort over 9,636 sites | 9.5 |
| conventional 30, full scan over 344 | 0.3 |
| all three as above | **16.5** (≈70-130 ms on a phone) |
| bbox prefilter (±40 km lat/lon box, then the same distanceKm, sort, slice): substations 30 | 0.11 |
| bbox prefilter: REPD 30 | 0.35 |
| bbox prefilter: all three | **0.47** |

- The bbox prefilter returns exactly the same 30 as the full scan for 178/178 origins.
- The original's cost comes from object spreads (`{...sub, km}`) for every candidate within 40 km (a median of 268 around data centres) and from the sort, not from the haversine.

**GeoJSON for 90 lines**, built on NTT Slough with substations, REPD and conventional:
- 90 LineStrings plus 90 end points makes 180 features.
- It is **25.1 kB** with coordinates at 5 dp, and `JSON.stringify` takes 0.1 ms.
- Farthest line: substations 11.2 km, REPD 9.0 km, conventional 49.1 km.

**MapLibre layer count** (static analysis; DC-B1 must measure the browser frame cost):
- Today's offtakers neon uses 11 layers over 5 sources (`tools/offtakers/src/02-map-neon.js`, `NI` and `NSR`).
- Splitting 30/30/30 by kind would mean three times the line sets, about 17 layers.
- Recommended design: **2 sources and 7 layers, constant in N**.
  - Sources:
    - `…-dc-links`: LineStrings and end Points, each with `k` set to `s`, `r` or `c`, plus a rank and km;
    - `…-dc-pin`.
  - Layers:
    - glow and core (line, `line-color` by `match k`);
    - flow (line; filter `k == 's'` only, so it keeps the existing single `setPaintProperty` dash animation);
    - node (circle);
    - label (symbol; filter `k == <active tab>`, so at most 30 labels with collision on);
    - pin halo and pin.
  - A tab switch is one `setFilter` on the label layer (optionally on glow too, to dim the other kinds). No source rebuild is needed.

## 4. Recommendation (exact)
1. **Substations: reuse, do not reimplement.**
   - Call `gridScope.scope(o, link.substations, { bandsKm: [2, 5, 10, 25, 40], nearestCount: 30 })`.
   - Cap at 40 km, the engine's own `MAX_LINK_KM`.
   - Group the list by `class_kv` ("by voltage", 400 → 33, then unclassified), with each row's km.
   - Use `bands` for the area summary.
   - If 0 are within 40 km, show the original `nearestSubstations(...).beyondRadiusNearest` line.
   - Keep the original `nearestSubstations` call for the first 5. It is cheap, and it lets the PR gate assert parity on every tap in a test.
   - Label: "Screening · N nearest mapped substations ≥33 kV within 40 km, straight line. Not capacity or connection feasibility."
2. **REPD: our own search, over the same register, with the engine's geodesy.**
   - No original 30-nearest REPD function exists. `nearestProjects` (L3549) reads `querySourceFeatures`, which depends on the viewport, and has `LINK_COUNT` 5.
   - Use the offtakers RG() register (src-repd serialized, else /dist/repd_master.json).
   - Reuse the offtakers grouping: projects about 10 m apart share one site, and ties at the 30th are kept.
   - Prefilter with the bbox, then `link.measure.distanceKm`. Cap at 40 km.
   - Attach REPD records through the exported M6 join `__GRIDATLAS_MODULES__.repdRecords.join`, unchanged.
   - Label: "Screening · N nearest REPD sites within 40 km (status chips)…"
3. **Conventional: our own search, over DC-A5's set** (interim: offtakers class B, excluding closed and converted).
   - **No radius cap on the list.** Always show the 30 nearest, each with its km, and state "nearest 30, out to X km".
   - **Draw lines only up to 100 km** and say so: "N of 30 drawn (lines limited to 100 km; the rest are listed)."
   - Show MW and status only where the source gives them. Unknown MW is "not stated", never 0.
   - Do not frame the camera on lines beyond 40 km: frame the substations and REPD set, so a 278 km line does not zoom a phone out to national scale.
4. **Performance budget:** the total search stays under 1 ms in node with the bbox prefilter, or about 17 ms without it. Either is fine, but use the prefilter for REPD. GeoJSON is about 25 kB. The 7 layers are a constant. DC-B1 should measure first-frame and flow-animation cost on a phone in the browser lane.
5. **Honesty wording, unchanged:**
   - proximity is not connection, capacity or feasibility;
   - "straight line";
   - the substation set is OSM-derived mapped substations, so not every substation is mapped;
   - a conventional site whose status is unknown is shown as "status unknown", never as operating.

## 5. Slough cluster (lead instruction; proven in `results.json` → `slough_cluster_3km`)
- Within 3 km of Slough Trading Estate (-0.6200, 51.5230), DC-A4 has **16 data-centre sites at 16 distinct points** across 11 operators:
  - Equinix 4, CyrusOne 3;
  - Kao Data, Digital Realty, NTT, Rackspace, VIRTUS, Lumen, Telefónica and Iron Mountain;
  - 1 with an unknown operator.
- The current offtakers class C has **5** sites in the same circle (OT-C-1264 "Slough LON2" and others). Per DC-A4, its merge collapses multiple operators into one site.
- The 30/30/30 engine must take its origins from DC-A4 (or DC-A7 once that exists), one tap target per site, with no cross-operator merge.
- **Test for DC-B1:**
  - assert at least 16 distinct origins within 3 km of (-0.6200, 51.5230);
  - assert that no origin carries records from two different non-empty operators;
  - assert that each origin's substation list equals `gridScope.scope(...).nearest`, and that its first 5 equal `nearestSubstations`.
  - `bench.mjs` already computes the first two; lift that into `tests/`.

## Reproduce
```
cd evidence/DC-B3
node bench.mjs /home/claude/gridatlas data/repd_master.json ../DC-A4/out/dc_operational.geojson results.json   # ~90 s
node bench2.mjs /home/claude/gridatlas data/repd_master.json ../DC-A4/out/dc_operational.geojson               # ~5 s
```
`data/repd_master.json` was fetched with `gh api -H "Accept: application/vnd.github.raw" repos/Ventusltd/globalgrid2050/contents/dist/repd_master.json`. ventusltd.github.io is blocked by the session proxy, so the live served bytes could not be cross-checked; an older served copy in the lightning evidence has a different sha, c43e81c6…. Issue #73 had no comments yet at 19:55 UTC.
