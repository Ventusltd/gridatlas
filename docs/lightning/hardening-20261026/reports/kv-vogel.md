# kv-vogel: Build I lightning module as a Kuiper–Vogel belt (node only)

Pins (sha256): module `c797fffc…c723b` (33,623 B, `wt/atlas/modules/202610270929-uk-lightning-overlay.js`); cartridge `7812953…ca4ca`; substations `8797643…6251`; lightning archive at `2a49652` (2026-10-27T10:43:35+00:00: 29 searched days, 1,480 flashes, next update due 13:43:35Z). By `d32e6b6` (15:24:22+00:00) the total is 1,507.

## Method (kuiper-belt README and LAWS; rules printed in `evidence/kv-vogel/rules.txt`)
- **Bodies.** 138 module functions and closures, plus 19 cartridge bodies (the neon `link` object, `nearestTransmission` ×2, `nearestSubstations`, `drawLinks`, `selectAt`, `runDeepLink`, `deepLinkPlan` and others).
- **Placement.** Body n, in order of first appearance, sits at r = √n, θ = 2π·frac(n·2654435769/2³²). That is one golden-angle turn per item, the same law as `globalgrid2050 …/wafer_keys.py:80`.
- **Keys and ids.** Each body's key is the SHA-256 of its bytes. Its id is `kv:` + Fibonacci hash of its qualified name; a collision refuses the run.
- **Edges.** 549 edges, resolved with acorn and eslint-scope: calls, events, state, map sources and layers, camera, DOM writes, fetches. 7 edges (should_call, should_write, duplicates) are declared and marked as candidates.
- **Paths.** A path is everything forward-reachable from the trigger and backward-reachable from the sinks.
- **RAG.** Red means a finding with file:line that produces a complaint. Amber means on a complaint path, or a known failure. Green means neither.
- **Reproducibility.** A rerun is byte-identical.

Outputs: `evidence/kv-vogel/vogel.html` (self-contained SVG with path filters), `graph.json` (Spider format, as in `spiders/species/genome-spider/data/gridatlas-lineage.json`), `proof.json`.

**Disagreement with the framework.** README defines three depths (repo, file, commit). Function depth is a fourth, which I added. Only the placement law and keys are used; orbital elements need commit history per body, so none were computed.

## Complaint A: identical period counts. Reproduced.
`tools/periods.mjs` runs the deployed module under node:vm on the real index and day files at `2a49652`, at 13:45Z. Output: `periods-2a49652-1345.json`.

| period | label (verbatim) | status line |
|---|---|---|
| 48H | `[≥29 \| 48h STALE]` | SEARCHED 92% |
| 30D | `[≥1,480 \| 30d STALE]` | SEARCHED 88% |
| 3M | `[≥1,480 \| 3m STALE]` | SEARCHED 28% |
| 12M | `[≥1,480 \| 12m STALE]` | SEARCHED 7% |

These match the owner's screenshots exactly. The difference between windows exists in `cv` (L52-53) and in the status line `sl` (L184). The label `lt` (**L182, red**) drops it and prints only "≥".

Path A: chip → `sp` → `ld` → `lw` (L80-87, same 29 day files) → `cf` (L94, PARTIAL becomes "≥") → `pt` → `lt` → panel.

STALE is real; its cause, the collector schedule, is outside the module.

## Complaint B: "substation engine doesn't fire". It fires, but the result cannot be seen.
`tools/bcheck.mjs` uses the cartridge's own `nearestSubstations`, `voltagesKv` and `representativePoint` (sliced from its bytes), the geodesy `distanceKm`, the pinned payload (5,800 qualifying substations) and all 1,480 archived flashes. It found the owner's flash: `…20261018135027…:15443`, 2026-10-18T13:46:17Z, at −0.3132, 51.8994. For that flash Build I prints exactly "5.42 km · 400 kV · Wymondley Substation", then Stevenage 6.21 and Luton South 6.64.

Under vm, NEAREST adds the source, 4 layers and 3 lines with labels, with no errors and **no camera call** (`bcheck-2a49652.json`). What the owner sees follows from that:
- **No framing (`near`, L163, red).** At zoom 6 the three lines are 7.2–8.8 px long, against a flash dot of radius 8.2 px with a 0.9 px core line. They sit inside the dot. At zoom 12, which the deep link reaches, the same lines are 459–563 px.
- **Wrong set (`nr`, L156, red).** It keeps `kv[0]>=132` and the nearest 3, with no 40 km radius. The cartridge's public `link.measure.nearestSubstations` (L3513, exported at L3584: MIN_KV 33, LINK_COUNT 5, MAX_LINK_KM 40) gives the five the owner expects: 5.42 km 400 kV, **5.67 km 33 kV**, 6.21 km 132 kV, 6.64 km 132 kV, **7.10 km 33 kV**.
- **Card covers the map (`tap`, L132/L145, amber).** The card is 280 px wide, as tall as the map, and placed 14 px above the flash.
- **Silent failure risk (L159-162).** `addSource` and `addLayer` are not guarded. A throw after the text list (L157) would leave text with no lines, and nothing would be recorded.

Path B runs: `event:map.click` → `tap` → card click → `near` → `nr` → nearest layers. The cartridge joins B only through `link.substations`, which `loadSubstations` fills and `install(map)` warms at boot (L6054).

## Reading the plot
- **On both paths:** only `FC`, `Q`, `T`, `Ts`, `mh`, `msg`, `sf`, `tm`. Formatters and the map handle: no shared defect. Their shared inputs are `state:S.res` (the flash list behind the card) and `source:gridatlas-lightning`.
- **Orphans:**
  - `window.__GRIDATLAS_SUBSTATIONS__` is read by `nr` (L154) and by the cartridge (L8372, L8410, L8535), but **nothing in `wt/atlas` writes it**. It is a dead fallback.
  - `S.last` and `S.waiting_for` are write-only inside the module; they are read only through the exported state.
  - No module body lacks a caller.
- **Cycles:**
  - `lw` calls itself once on an unsealed shard mismatch (L88, bounded by `q`).
  - `fit` registers itself with a ResizeObserver (L213); the previous observer is never disconnected when the button element changes.
  - `runDeepLink` re-enters through `retryArrival` (cartridge L6696).
- **Duplicated logic:**
  - `nr` re-implements `nearestSubstations` with different constants.
  - `nr`'s layers copy `drawLinks`'s paint (opacity 0.62−i·0.10, L158 vs cartridge L4535).
  - There are three "transmission" thresholds: 132 (module), ≥400 (`nearestTransmission`, cartridge L631) and MIN_KV 33. `nearestTransmission` is also declared twice (L623, and L1975 which only delegates).
  - Lightning's card re-implements the original card bar (`addCardBar`, L3950).
  - The only byte-identical bodies are the two `()=>tick()` closures (L221).
- **Co-dispatch:** the engine's own click handler (cartridge L6191) fires on the same tap. Over a project it opens a second popup with its own links; over empty basemap it runs `clearLinks` (L6212).

## Minimal fixes (`evidence/kv-vogel/patch-AB.js`, diff in `patch-AB.diff`)
1. **A, L182, +80 B.** Replace the bare "≥" with the measured coverage: `[1,480 · 28% searched | 3m STALE]` (12M shows 7%, 30D 88%). This uses the same `cv` fraction as the status line. A days ratio would overstate coverage: partly searched days would count as searched, giving 3/3 for a window that is 92% searched.
2. **B1, L156-157, +165 B.** Use `link.measure.nearestSubstations` when it is present. This gives ≥33 kV, 5 links and the 40 km radius. If it is absent, the current 132 kV path is kept.
3. **B2, `nr` tail before L163, +247 B.** After drawing, call `fitBounds` over the flash and its links with `maxZoom:12`, padding the top by the card height.

Total: +492 B, giving 34,115 B against a budget of 44,781.

Checks:
- The pinned I suite (`suite-I/test-fixes.mjs`, sha256 `cbc85c3…`) passes 91/91 on the original and on both patches. The designer lane's J suite (16:39:44Z) asks for the same behaviour.
- Rerun of complaint A on the patch: 30D/3M/6M/12M now read 88/28/14/7% searched.
- Rerun of complaint B on the patch: 5 lines with labels, and one `fitBounds([[-0.4011,51.8745],[-0.2232,51.9550]], maxZoom 12)`.

Not in this patch: the pulsing origin, a collapsible card, a guard around L159-162.

## Status
Every number above comes from a pinned file named beside it. What the owner saw on the device remains a candidate until a BROWSER lane confirms it.

Next test, BROWSER lane: run the patched module live, open 30D, tap the 2026-10-18T13:46:17Z flash near Hitchin, press NEAREST, and screenshot. Node reproduction: `node tools/bcheck.mjs <cartridge> <geodesy> <substations> 2a49652 module-I.orig.js patch-AB.js`
