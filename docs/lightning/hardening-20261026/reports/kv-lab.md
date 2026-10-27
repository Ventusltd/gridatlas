# kv-lab: the Lightning → Grid lab and Build I's nearest substations (node/static only)

27 Oct 2026. gridatlas `origin/main` 13479b4. Lab published at ad2dc82. Engine pinned at `69b4e88`. Evidence is in `hardening/evidence/kv-lab/`: `compare.mjs`, `compare-out.json`, `bitcheck.mjs`/`.out`, `extracted-cartridge-fns.js` (copied verbatim from the cartridge source), `fix-buildI-use-neon.diff` and the `data/` copies.

## 1. What the lab does

**Engine.** `app.mjs:9-14` imports `engine/lightning-click-context.js` at runtime from jsDelivr, pinned to `Ventusltd/ventus-grid-engine@69b4e88`. That SHA is the head of draft engine **PR #2** (branch `feature/lightning-click-grid-scenario-20261026`). It is **not on engine main**, which is at `b3c8121`. The adapter (`lightning-click-context.js:8-10`) imports:
- `v9-geodesy.js`: `distanceKm` (haversine, R = 6378.137 km, same form as `atlas/modules/202609011950-geodesy.js`), `voltagesKv` and `representativePoint`.
- `v9-nearest-search.js`: `index(points).nearest(lon,lat,{minimumKv,limit})`, an exhaustive O(n) scan sorted by km. Its own header (lines 6-16) says this module is **not loaded by the live Atlas**.
- `deeplink/contract.js`: `buildDeepLink`, which it uses for the REPD MAP links.

**Finding substations.** `createLightningContextEngine` (`:76-89`) normalises the 5,800 original Atlas substation features into `{location, voltages_kv}` and indexes them once. `selectFlash` (`:102`) calls `nearest(lon,lat,{minimumKv,limit})`. **No distance cap is applied to substations**: `radiusKm` filters solar only (`:111-112`). The lab's defaults are `minimumKv=132` (index.html `#kv` selected), `substationLimit=6` and `radiusKm=20` (`app.mjs:192-193`).

**Finding solar farms.** `distanceKm` over every REPD solar record with a valid geometry and numeric `repd_ref`, kept within `radiusKm`, sorted, top 30 (`app.mjs:193`), each with a `buildDeepLink` URL.

**Data.** On the first tap the lab fetches 9 files from `raw.githubusercontent.com` (`app.mjs:18-21,55-75`): the substation file `atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson` (blob `242a634`, the same file the live shell reads) and 8 Pipeline News solar partitions from pipelinenews `main`. Those 8 are unpinned, mutable paths.

**Drawing.** **The lab draws no links.** `map-view.mjs:88-95` adds only circles: blue `nearest-substation-dots` at radius 7 plus green solar circles sized by MW. No lines, no map labels, no origin pulse, no camera move (`:239`).

**On tap.** A tap on a flash runs `onPick` → `setObservation` → `inspect()` (`app.mjs:279-287`). Results appear in **panels below the map** (km and declared-kV lists, solar cards, IT/DC checklist with `NOT_RUN`). Tapping a dot opens a popup (`map-view.mjs:113-143`).

**The "390×844 Chromium smoke passed" claim** used synthetic fixtures (2 flashes, 1 station, 1 solar site), so it does not test real-data ranking. The published sidecar still has the missing-`flash_id` substitution, Inspect race and all-sources-down defects, which are fixed only in draft PR #43 (#36, 04:36–09:04 UTC).

## 2. Comparison on the same data (5,800 features, all ≥33 kV after parsing)

Methods compared:
- **Lab** = engine adapter.
- **I** = Build I `nr()` (module line 156, run verbatim): kv[0] ≥ 132, top 3.
- **Neon** = cartridge `nearestSubstations` (`sld-sandbox-v9-8.js:3513`): ≥33 kV, 5 links, 40 km cap.
- **NT** = `nearestTransmission` (`:623`): ≥400 kV, single result.

| Flash | Lab default (≥132, 6) | Build I (≥132, 3) | Neon (≥33, 5, ≤40 km) | nearestTransmission |
|---|---|---|---|---|
| 51.899,-0.313 | 5.43 Wymondley 400/132/33 · 6.20 Stevenage · 6.64 Luton S · 7.77 Luton N · 13.30 unnamed 132 · 13.51 Sundon | 5.43 Wymondley 400 · 6.20 Stevenage 132 · 6.64 Luton S 132 | 5.43 Wymondley · **5.69 unnamed 33** · 6.20 Stevenage · 6.64 Luton S · **7.14 unnamed 33** | 5.43 Wymondley (278 considered) |
| 55.374,-4.212 | 4.95 Enoch Hill · 6.42 Blackhill · 6.81 Dun Hill · 6.92 unnamed 132 · 8.45 New Cumnock 275/132 · 12.47 Benbrack | 4.95 Enoch Hill · 6.42 Blackhill · 6.81 Dun Hill | **0.53 New Cumnock 33** · 4.95 Enoch Hill · 6.42 Blackhill · **6.48 unnamed 33** · 6.81 Dun Hill | 27.54 Kilmarnock South |
| 51.5,-1.3 | 8.38 unnamed 132 · 8.94 unnamed 132/33 · 12.41 Thatcham · 14.14 unnamed · 14.16 unnamed 400 · 14.27 Didcot | 8.38 unnamed · 8.94 unnamed · 12.41 Thatcham | **4.72 unnamed 33** · **6.27 Yattendon 33** · 8.38 unnamed 132 · 8.94 unnamed 132/33 · **9.75 Love Lane 33** | 14.16 unnamed; named 14.27 Didcot |

**The arithmetic is already one implementation.** With matching parameters (lab with `minimumKv=33, limit=5` against Neon), 15 of 15 (km, name) pairs are **bitwise identical** (`bitcheck.out`). The engine's and the cartridge's `voltagesKv` agree on all 5,800 features once sorted and deduplicated. Every difference in the table comes from **parameters**:

- **Threshold.** The lab and Build I use 132 kV, so they hide the 33 kV sites the owner expects. At 55.374,-4.212 they miss New Cumnock at 0.53 km. At 51.5,-1.3 they miss three ≥33 kV sites closer than the first 132 kV site.
- **Count.** The lab returns 6, Build I 3 and Neon 5. The owner expects about 5.
- **Cap.** At the extra offshore point 57.9,-1.0, the lab returns 5 substations, the first at **61.56 km**, with no caveat. Neon draws nothing and reports `beyondRadiusNearest` = 61.56 km. That is the rule written into the cartridge (`:1665`, `:3515-3533`): "silence is more honest" than a long chord.
- **kV text.** Neon shows the ≥33 list ("33" for 33/11). Build I shows only kv[0]. The lab shows every token, including 11.

Four selection routines sit on one geodesy: cartridge `nearestSubstations`, `nearestTransmission`, engine `v9-nearest-search.nearest`, and Build I's hand-rolled `filter…slice(0,3)` (module line 156). The last is redundant, because the cartridge already publishes `link.measure.nearestSubstations` (`:3584`).

## 3. Recommendation

**Build I's in-map tap should use the original sld-sandbox neon engine, not the lab adapter.** The reasons:
- `link.measure.nearestSubstations` is already on the page and public, and it runs on the list the cartridge warms at install (`:6054`). It is the only routine that produces exactly what the owner pointed to: ≥33 kV, 5 links, a 40 km cap with an honest beyond-radius sentence, and labels like "4.56 km · 33 kV".
- The lab adapter would add a cross-origin import pinned to an **unmerged** engine branch, a second 1.19 MB substation fetch, unpinned solar partitions and an uncapped search to a byte-budgeted overlay. #36 rules that out ("Do not duplicate the VGE resolver… in the native overlay").
- **Do not use both.** Keep the lab as the off-map scenario sidecar, reached at most through an opt-in `?flash_id=` link (the #36 handshake). It answers a different question: solar plus the IT/DC checklist.
- **Do not call `link.selectAt` for a flash**: it treats the origin as a project with REPD-declared connections.

### Minimal fix (Build I module, **−21 B**, 33,623 → 33,602; syntax OK)

```diff
-…,dk=L.measure&&L.measure.distanceKm,say=…
-if(!subs.length||typeof dk!=='function')return say('Substation data not loaded yet; try again in a moment.');
-const k=subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=132).map(s=>({s,km:dk(x,y,s.at[0],s.at[1])})).filter(a=>isFinite(a.km)).sort((a,b)=>a.km-b.km).slice(0,3);
+…,ns=L.measure&&L.measure.nearestSubstations,say=…
+if(!subs.length||typeof ns!=='function')return say('Substation data not loaded yet; try again in a moment.');
+const r=ns(x,y,subs),k=r.map(s=>({s,km:s.km})),b=r.beyondRadiusNearest;
…
-if(!k.length)return say('No transmission substation (132 kV or above) in the published list.');
+if(!k.length)return say(b?`Nearest mapped substation is ${b.km.toFixed(2)} km away, beyond ${r.radiusKm} km, so no line is drawn.`:'No mapped substation in the published list.');
```

The full diff is in `evidence/kv-lab/fix-buildI-use-neon.diff`. The line and label drawing code is unchanged and already matches the neon style (strength `max(.2,.62-i·.1)` against `drawLinks` `:4535`). The Build I test I3 (`test-fixes.mjs:887`) has to be updated: its mock must supply `measure.nearestSubstations`, and the expected result becomes 5 links at ≥33 kV.

This fix **does not explain why the owner saw no lines**; Build I already adds a line source. That needs the browser lane (layer order, `text-font`, card placement).

### For the lab (ChatGPT, PR #43 or successor)
Default to ≥33 kV and 5 results. Add a 40 km `maxKm` with a reported beyond-radius nearest. Draw labelled lines if the lab should match the neon engine. Pin the solar partitions and the engine import (to engine main after PR #2 merges). Adopt `bitcheck.mjs` as a parity proof against the cartridge.

Honesty rules hold throughout: optical flashes are not ground strikes, nearest does not mean affected, and no repd_ref is ever produced for a flash.
