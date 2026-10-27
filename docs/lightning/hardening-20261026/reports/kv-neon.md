# kv-neon: the neon arrival, specified from the live cartridge and reproduced for a flash

Source of truth: `wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js` (the live `sld-sandbox` in `current.json`, called "C" below). Geodesy: `atlas/modules/202609011950-geodesy.js`, a haversine with R = 6378.137 km (= grid-distance-maths `R_ATLAS`).
Evidence is in `hardening/evidence/kv-neon/`: `lightning-neon.js` (71 lines), `test-lightning-neon.mjs` (**34/34 pass**) and a `gdm/` clone.

## 1. Spec (as the live code has it, not as remembered)

**Scope.** C:1691-1693 sets `MIN_KV = 33`, `LINK_COUNT = 5` and `MAX_LINK_KM = 40`. The loader (C:3477-3508) keeps a substation when max(kV) ≥ 32.5. The label shows the highest class. `nearestSubstations` (C:3509) sorts by km, keeps those ≤ 40 km, slices 5. So 33, 66, 132, 275 and 400 kV are all included.

**Label.** The format is `` `${km.toFixed(2)} km · ${kv[0]} kV` `` (C:4545), with U+00B7 as the separator. `text-size 10`, `text-offset [0,-1.5]`, `text-anchor bottom` and `text-allow-overlap false`. Paint is `text-color #a9c4c9`, `halo #000c10` at 1.5 and `opacity 0.9`. The font is the first `text-font` the basemap style already uses, falling back to `['Open Sans Bold','Arial Unicode MS Bold']`. With no `glyphs` endpoint there are no labels (C:5248).

**Line paint.** There are four stacked line layers (C:4314-4352). Interpolation is linear on zoom, with stops at z6 and z12:

| layer | colour | width z6→z12 | opacity | other |
|---|---|---|---|---|
| glow | `['get','colour']` | 5→12 | 0.10 | blur 3→8, cap/join round |
| core | `['get','colour']` | 0.9→1.8 | `strength` = max(0.20, 0.62 − 0.10·rank) | cap/join round |
| flow | `#bfe9ee` | 1.2→2.4 | 0.8 | dash [0.2,3.2] at start, cap round |
| flow-b | `#bfe9ee` | 0.9→1.8 | 0.45 | dash [0.2,3.2] at start, cap round |

The colour is `TECH_COLOUR[tech]`, for example solar `#d8c96a` and BESS `#d9963c`, or `#5fbdc2` when the technology is unknown (C:4524-4526).

**Animation.** C:3128-3130: period 1.5, speed 0.055 per frame, pulse 0.42, 24 dash patterns `[0.001, lead, 0.42, tail]`; flow-b half a period behind (C:4425-4440). Under `prefers-reduced-motion` both flow layers go to opacity 0.

**Substation node.** The ring is a circle with radius 6→13, transparent fill and a `#5fbdc2` stroke 1 px wide at 0.4. The dot has radius 2.2→4, `#5fbdc2` at 0.8 (C:4354-4372). It is **teal, not white**. The "white" is the pale-cyan flow and labels.

**Origin marker.** The project ring (C:5163-5185) has two parts:
- A halo with radius 11→26 (stops at z6 and z14), a 6 px stroke in the tech colour at 0.13 and blur 0.4.
- A ring with the same radius and a `#cfe9ed` stroke 1.6 px at 0.85.

**No red pulsing circle exists in the live code.** None in the shell or the four live cartridges; the only animation is the line flow. The red on REPD 12588 (solar) is most likely the engine's static `l-solar-glow` (engine:1309): capacity-ramped `#ffff00→#ff0000`, radius 22–80 px, opacity 0.12–0.35 and blur 1.0, drawn under a `#ffff00→#ff2200` dot. A "pulse" would be a new design, not a reproduction. I have not built one.

**Camera.** A nearest-links arrival does **not** call fitBounds. It does `flyTo({center, zoom: link zoom || 12, duration 1200, essential})` (C:6629). After idle, or after 2.6 s, it eases (400 ms) to `framed() = clamp(3, 18, zoom + log2(max(innerWidth,320)/393))` (C:6396-6425). The only fitBounds in the path covers a NESO declared connection when no nearest link is drawn (C:4611): padding `{top 90, left 40, right 40, bottom sheet ? 220 : 90}`, `maxZoom 10`, 900 ms.

**Card bar.** `addCardBar` (C:3950) builds `⋮⋮` (grip, `#3f6f75`), then the card's first `<b>/<strong>` as the title (`#8b9aa1`, 10 px, ellipsis at 190 px, or `Card` when there is none), then a spacer, then `−` (title "Minimise") and `×` (title "Close"). The buttons are 44×44, `#050a0d` with a `#2f6f75` border and `#5fbdc2` text. The block heading reads `NEAREST SUBSTATIONS ≥33 KV` with a `BETA` badge (`#e0b050` on `#3a2f12`, C:3712). On a phone the card docks as a sheet at 58% of the viewport (C:3886). Close runs `clearLinks()` (C:4501).

**The proof is stale for visuals.** `tools/proofs/202608311910-neon-substation-links.proof.mjs` loads the old `202608311910-…-v9-6.js`, which has one flow layer, a hard-coded font, and reads `voltage:'33'` as 33 kV (proof:253). Do not take visual constants from the proof.

## 2. Why the owner saw no lines (static finding, needs a BROWSER lane to confirm)

Module `202610270929-uk-lightning-overlay.js:150-163` (`nr`) already draws glow, core, node and label in teal. Against the spec it has **≥132 kV only** (`s.kv[0]>=132`, :155), **3 links**, **no 40 km cut-off**, and **no flow, origin ring or camera move**.

Without a camera move, the lines are drawn at whatever zoom the tap happened at. At z6, latitude 52, there are 1,505 m per px, so the 5.42 km Wymondley link is **3.6 px long, under a flash dot of 6.7 px radius** (module:136 `Z`). The core is 0.9 px wide at 0.62 opacity. On top of that, the card covers most of the map. The text list renders, which matches what the owner saw, but nothing visible reaches past the dot. That is my explanation for "doesn't fire". 

## 3. Lightning-owned implementation (`evidence/kv-neon/lightning-neon.js`, 71 lines)

It sets `window.__GRIDATLAS_LIGHTNING_NEON__ = {show(map,x,y), clear(map), nearest, bar(card,title,onClose), head}`.
- It reads only `__GRIDATLAS_NEON_LINKS__.substations` and `.measure.distanceKm`.
- It owns its ids `gridatlas-lightning-neon-*`, with 3 sources and 9 layers, and never writes to `l-neon-*`, which belong to the cartridge's `clearLinks`.
- A flash has no technology, so the colour is the engine's unknown-tech fallback `#5fbdc2` (`#d8c96a` would match the solar picture).
- It returns `NOT_LOADED` when the payload is absent. When nothing is within 40 km, it draws nothing and still returns the nearest substation beyond that.
- Its bar omits the minimise button.

**Test** (`node test-lightning-neon.mjs`, minidom + node:vm). It **cuts `ensureLayers`, `ensurePinLayers` and the flow code out of C and runs them** against the same recording map. Paint and layout are JSON-identical for all 9 layers, order matches, and the first frame's dashes equal C's `flowDash`. It also checks:
- 33 kV in and 11 kV out, cap 5, cut-off 40 km, nearest-first order;
- the labels `4.56 km · 33 kV` and `3.43 km · 132 kV`, and the strength ramp;
- close and OFF remove everything and cancel the frame; a second flash replaces rather than duplicates;
- not loaded, beyond 40 km, reduced motion, no glyphs.

Result: **34/34 pass**.

## 4. Minimal wiring into the module (byte cost)

1. Inline `lightning-neon.js`. A crude minified size is **6,032 B** (`lightning-neon.min.js`, without name mangling).
2. Change `nc` (module:153) to `nc=()=>{const N=window.__GRIDATLAS_LIGHTNING_NEON__;N&&N.clear(mh())}`. Close (`pc`, :128) and OFF (`cx`, :133) already route through `nc`, so the cleanup is wired.
3. In `nr` (module:154-163), take the list from `N.nearest(x,y)` so the text and the lines agree (≥33 kV, ≤40 km, 5). Then call `N.show(m,x,y)` and delete the module's own four `addLayer` calls.

**Net about +4.4 kB** (+6.0 kB at worst) against 44,781 B of headroom. Keep the honesty line at :157. The flight to zoom 12 moves the map on every tap. On a flash it should stay behind the NEAREST SUBSTATIONS button, not run on the tap.

## Open items
- BROWSER: confirm lines appear after the camera move, and how they sit against the card at 390 px.
- The owner's "red pulsing" origin is not in the code. He needs to decide whether he wants a new pulse or the faithful pale ring.
