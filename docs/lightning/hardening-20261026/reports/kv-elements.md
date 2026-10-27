# KV lane: elements (Build I, generation 202610270929). Node only.

Module: `wt/atlas/modules/202610270929-uk-lightning-overlay.js` (sha256 `c797fffc…`, 33,623 B). Original: `wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`. Evidence: `hardening/evidence/kv-elements/`.

## Method (estate files)
- Keys per `elements/README.md` (`block:<Sym>`, `family:<n>`; catalogue built 2026-09-15). Lightning postdates it, so it has **no family numbers**; none invented, its families are named by job and line.
- Canonical homes: `block:Gc` "the one haversine" (`engine/geo-core.js`; `R_ATLAS` 6378.137, `R_UK` 6384.7272, `R_MEAN` 6371.0088 "should NOT be used in new code"; `stars/CODE-UNIVERSE.md` DECIDE 3: every other `distanceKm` should import from here), `block:Vg` (its byte-identical v9 copy), `block:Vn` (nearest search) and `block:Ss` (sld-sandbox families named in the table).
- Windows, coverage and validation: canonical is `Ventusltd/lightning` `history-window.mjs` @ `22f6625` (the module says it was trimmed from `f7db76c`); not yet catalogued.

## Table

| Family | Lightning location | Canonical element | Verdict / fix |
|---|---|---|---|
| Geodesy (distance) | No haversine of its own. Line 155 takes `L.measure.distanceKm`. | `block:Gc` ← `block:Vg` (`modules/202609011950-geodesy.js`, R=6378.137=`R_ATLAS`) ← cartridge `distanceKm` 3299-3301 (delegates to `GEODESY`) | **Bound correctly.** It uses the same radius as every neon distance. No `R_MEAN`, no bare radius. Keep it. |
| Geodesy (bbox, projection) | `bx` 21, `fb` 198, `cpos` 132 | none (`block:Gs`/`block:Gg` are circles and GeoJSON IO) | Not a re-implementation. |
| **Nearest-substation search** | **157** `subs.filter(…kv[0]>=132).map(dk…).sort.slice(0,3)` | `link.measure.nearestSubstations` (cartridge 3513-3541, exported 3584; `family:64149`): `MIN_KV` 33 (1663), `LINK_COUNT` 5 (1664), `MAX_LINK_KM` 40 (1665), `beyondRadiusNearest`. Engine twin: `block:Vn` `engine/v9-nearest-search.js` (its own header says that module is not loaded live). | **Re-implementation with drift.** Its 132 kV floor matches neither canonical floor: 33 kV for the links, ≥400 kV for `nearestTransmission`. It draws 3 links, not 5, and has no 40 km rule. Fix: call `nearestSubstations` (patch below). |
| "Transmission" wording | 158 "No transmission substation (132 kV or above)" | `nearestTransmission` (623-651, delegated at 1975, used at 6157; `family:8373`) defines transmission as **≥400 kV** and returns `considered` and `named` | **Vocabulary drift.** Lightning's "transmission" means something different from the estate's. Use the 33 kV wording, or bind to `nearestTransmission` if a 400 kV answer is wanted. |
| **Neon-link drawing** | 153-164: four Lightning-owned layers | `drawLinks` 4522ff (`family:67796`) + `ensureLayers` 4308ff (`family:8511`) + `setPin` 5193 (`family:8534`) + `startAnimation` 4414 | **Hand copy.** The glow, core, node and label paint are byte-equal to `ensureLayers`. So is the `strength` formula. The label format is `"x.xx km · N kV"`. Missing: `l-neon-flow` and `flow-b` (animation), `l-neon-node-ring`, the origin pin, and **framing** (drawLinks `fitBounds` 4611; arrival zoom 12 at 6628). `drawLinks` is closure-private and `link.selectAt` (6073) carries project state (`currentRepdRef`, `recordArrivalEngine`), so a flash must not use it. Patch adds origin ring and framing; full binding needs an exported non-project draw entry (owner decision). |
| Card UI | `tap` 146-150: an absolute `div`, max-width 280, anchored at the flash | Engine `maplibregl-popup` + `injectIntoCard` 4111 + `dockAsSheet` 3877 (`family:8489`; 58 dvh sheet, `.gridatlas-card-bar`, minimise) | **Re-implementation**: the owner's "tall black box", anchored over the flash and its links. Patch docks it at the map's foot after NEAREST; follow-up: a `maplibregl.Popup` so `dockAsSheet` and the card bar apply. |
| Data fetch | `gj`/`gx`/`lg`/`ls` 28-33, `sh` 61-66, `fr` 67-69 | `history-window.mjs` `readJson` + `Lru` + `createLightningHistoryClient` (`DEFAULTS` timeoutMs 15000, LRU 8, concurrency 4) | Faithful port, same constants. Keep; pin with a parity test. |
| Validation | `vk` 35-38, `ni` 39-47, `ok` 70 | `validateV2Row` / `normaliseIndex` / `validateFeature` | **Drifted port.** The module omits the `scanned_seconds` range (0-86400), the sha256 format, "path must be null without flashes", and part `bytes`. Fix: add those 4 checks (≈+160 B) or a parity test. |
| Time windows | `PERIODS` 14, `mm` 23, `wf` 56-58, `nv` 199-203 | `selectUtcWindow`, `minusMonths`, `previous/nextUtcWindow`, `clampWindow` | Equivalent `[start,end)` UTC; label "12 months" vs "1 year", PREV disabled for custom. Cosmetic. |
| Coverage arithmetic | `cv` 51-54 | `windowCoverage` | **Latent drift.** The module uses only the union of scan windows. Canonical also floors each day by the row's `scanned_seconds`. On today's index (`d32e6b6`, 14 windows, 29 searched days, 1,507 flashes) **0 of 29 days differ**. It would diverge if a backfill wrote rows without a scan window. Fix: add the floor (≈+90 B). |
| State and stale | `cf` 91-97, `stale` 48 | `classifyState`, `isStale` (4 h) | Same 4 h rule. PARTIAL `f<1‖ny>0` vs canonical `<0.999`; both give PARTIAL ("≥") for windows ending now. |
| Panel and caption | `bg` 168-180, `lt` 182-183, `sl` 184, `cp` 99-125 | Shell classes (`key-group`, `map-ctrl-btn`, `status-legend`, `radius-input-row`); `captionLines` | Shell CSS bound correctly. `lt` is Lightning-only: identical "≥1,480" for 30d/3m/12m because all hold the same 29 searched days; "searched N of M days" is only in the caption (copy lane). |

Side finding (not Lightning): cartridge **8245-8251**, the interconnectors module, declares `EARTH_KM = 6371.0088` (`R_MEAN`) and its own haversine, measuring the same `link.substations` the neon links measure on `R_ATLAS` (≈0.11% apart). Bind it to `GEODESY.distanceKm`.

## Evidence on real data
`compare-nearest.mjs` runs the cartridge's own functions, extracted verbatim and run on the geodesy module, against the release substation payload (5,800 qualifying; 1,668 ≥132 kV; 278 ≥400 kV) and 8 flashes from the live 7-day feed. Output is in `compare-nearest.out.json`. On those 8 flashes:
- **Missing links.** Lightning drops nearer 33 and 66 kV sites. Example: flash −0.265,54.084. Lightning's nearest is 13.67 km at 132 kV. Canonical gives 1.22 km at 66 kV, then four more. Another example: −6.213,56.57 gives 63.30 km against 1.66 km.
- **Lines past the 40 km rule.** Lightning draws 95.6 km and 74.8 km straight lines from sea flashes. Canonical draws none and reports `beyondRadiusNearest`. The rule's reason is at 4577-4578: a long chord to whatever is nearest "is never mistaken for a cable".
- **Lines too short to see.** Lightning's nearest line is 18-45 px long at zoom 6 and is not framed. It sits under a card anchored at the flash. That explains "no lines appear". The layers were added, but they were not visible.

## Minimal fix (`KV-nearest.diff`, built by `make-patch.mjs`)
1. **Measurement.** Line 157 now calls `L.measure.nearestSubstations(x,y,subs)`. That gives 33 kV and above, 5 links, 40 km, the cartridge's geodesy, and the beyond-radius message ("None within 40 km, so no line is drawn; nearest mapped: …").
2. **Origin ring.** It uses `setPin`'s paint (radius 11→26, `#cfe9ed` 1.6, 0.85). The node and label layers leave the origin out.
3. **Framing.** `fitBounds` covers the flash and its links, with `maxZoom` 12 and bottom padding equal to the card height.
4. **Card position.** The card docks at the map's foot (`bottom:8px`, `max-height:38%`), and `cpos` stops re-anchoring it.
- **Bytes:** 33,623 → **34,468 (+845 B)**, which leaves 43,936 B of the 44,781 B budget.
- **Tests:** `test-kv.mjs` is the full `test-fixes.mjs` with I3 replaced by **KV-I3**, which uses the real cartridge `nearestSubstations`. The original fails as expected (expected 5 links, got 3; 90/91 pass). The patched module passes 91/91. The old I3 asserted the drift itself: it asserted "3 nearest ≥132 kV" and `doesNotMatch(/Tiny 33kV/)`.

Not fixed here (owner or other lanes): flow animation and node ring (need an exported draw entry), a full popup/sheet card, `history-window.mjs` parity tests, "searched N of M days" in the label. The "not evidence any asset was struck" sentence stays; no `repd_ref`; nothing is called "affected".
