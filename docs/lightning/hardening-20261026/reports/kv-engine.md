# kv-engine: why NEAREST SUBSTATIONS shows no lines, and how to route a flash through the ORIGINAL engine

Status: DONE (16:35 UTC 27 Oct). Lane BROWSER, port 8201, one Chromium at a time, offline shim, 393x852 iPhone UA with touch, fake clock 2026-10-26T18:40Z for the lightning route. Evidence is in `hardening/evidence/kv-engine/`. The harness is `kv-engine.browser.mjs <repro|deeplink|proto>`, and the integration under test is `engine-nearest.js`, run verbatim.

| ID | status | evidence | command |
|---|---|---|---|
| KE1 owner repro on 202610270929 | REPRODUCED: lines drawn but invisible | repro.json, repro-01…05.png | `node kv-engine.browser.mjs repro` |
| KE2 live deep link, repd 12588 | CAPTURED (identity lane FAILED offline, see note) | deeplink.json, deeplink-run3-map.json, deeplink-01-arrival.png | `KVCH=chromium node kv-engine.browser.mjs deeplink` |
| KE3 flash through the original engine | PASS: same layers, sources, card bar and framing; undo is clean | proto.json, proto-03…08.png | `KVCH=chromium node kv-engine.browser.mjs proto` |

Harness note: the deep-link route segfaults chrome-headless-shell 1243 about 6 s in (`SEGV_ACCERR`, dl-stderr.log; not OOM, about 5 GB free). The full `chromium` channel runs it. In both builds DuckDB-wasm fails with "memory access out of bounds", so the register identity is `FAILED` offline. The card is therefore the engine's from-link fallback, with "Deep-linked project" in the bar, and the "red pulsing origin" the owner saw is **not reproduced**. The neon engine draws no red pulse; its origin marker is a pale ring, `l-project-pin` #cfe9ed.

## KE1: why no lines are visible (cause found, no exception)

| Hypothesis | Result |
|---|---|
| Layer under the basemap or original layers | **No.** `gridatlas-lightning-nearest-{glow,core,node}` sit at the top of the 105 layers, above `l-gridatlas-lightning-hit`. |
| Wrong coordinates | **No.** The source holds `[[-1.6956,51.4377],[-1.6526,51.3315]]` etc., with labels 12.20/15.25/18.25 km · 132 kV. |
| `link.substations` empty | **No.** 5,800 were loaded before the tap. |
| Exception | **None.** 0 page errors. The label layer throws only because the shim style has no glyphs. |
| **Hidden by the card and the scale** | **Yes.** The phone default is **zoom 4.2**, and the module never moves the camera. The three lines are **4.6, 5.8 and 6.9 px** long and start under the 8 px flash dot. The card is 144×788 px and anchored on the flash, so 0% of each line is visible (repro.json `afterNearest.pixels`). At zoom 11 the same layers render at 511–768 px (repro-05). |

There are also two content differences from the original:
- **Filter:** the module keeps `kv[0]>=132` and the top 3 (`202610270929-uk-lightning-overlay.js:156`). The engine keeps ≥33 kV, 5 links, within 40 km. That is why the owner saw no 33 kV.
- **Card overlap:** the card (z-index 5) sits under the search box (repro-03).

A small side finding: the Lightning layer ids start with `l-` (`l-gridatlas-lightning`, `-hit`). The engine's `interactiveLayerIds` (cartridge :6029) therefore treats a flash as an interactive feature. A flash tap runs the engine's `clearLinks()`, and it would run Grid Scope if that is armed.

## KE2: what the original deep-link arrival draws (repd 12588, live route `wt/atlas/`)

- **Camera:** `flyTo` to (-1.3489728, 51.8132088) at **zoom 12**, 1200 ms (`camera_from_link`).
- **Sources:**
  - `gridatlas-neon-links`: 5 LineStrings with `{colour:'#d8c96a' (solar), strength:.62/.52/.42/.32/.22, km}`.
  - `gridatlas-neon-nodes`: 5 Points labelled **3.43 km · 132 kV, 3.81 · 33, 4.56 · 33, 6.00 · 33, 8.61 · 132** (Yarnton nearest).
  - `gridatlas-project-pin`: 1 point.
- **Layers, at style indices 1–8 just above `background`:**
  - `l-neon-glow`: width 5→12, opacity .10, blur 3→8.
  - `l-neon-core`: width .9→1.8, opacity `['get','strength']`.
  - `l-neon-flow` and `l-neon-flow-b`: #bfe9ee, animated dasharray, opacity .8 and .45.
  - `l-neon-node-ring` and `l-neon-node`: #5fbdc2.
  - `l-project-pin-halo` and `l-project-pin`: radius 11→26.
  - `l-neon-label` is omitted offline because the shim has no glyphs.
- **Card:** `.maplibregl-popup.gridatlas-sheet.gridatlas-min`, docked as a 393×70 bottom bar. `.gridatlas-card-bar` holds grip, label, − and ×. `<html>` gets `gridatlas-sheet-open` and `--gridatlas-sheet-h:66px`; expanded it is 494 px.
- **Record:** `links_drawn 5`, `arrival_engine {onshore, answered, terminal}`. Line visibility on screen is 44–98%.

## KE3: the cleanest route through the original engine

`window.__GRIDATLAS_NEON_LINKS__.selectAt(origin, name, tech, false, null)` is the same function a project click and a deep-link arrival end in (cartridge :6073, :6743). It measures with the engine's own `nearestSubstations` (≥33 kV, 5, 40 km) and `nearestTransmission`. It also draws `l-neon-*`, sets the origin ring (`drawLinks` → `setPin`, :4725), docks the card bar and records `arrival_engine`.

It has one precondition. The popup watcher (:6059) clears any lines that stand without a `.maplibregl-popup`, so a MapLibre popup must exist **before** the call. That is the same order `ensureArrivalCard` uses (:6731). No repd_ref is set: `currentRepdRef` stays null, and the URL is untouched.

Prototype result (proto.json, proto-03):

- **Land flash (-1.6956, 51.4377):** zoom 12. The engine's own `gridatlas-neon-links` and `-nodes` hold 5 links each, labelled **3.36 · 33, 6.24 · 33, 9.23 · 33, 11.28 · 33, 12.20 km · 132 kV**. The ring is drawn, the bar reads "Optical flash 2026-10-23 02:22:34 UTC", and the first line is 100% visible.
- **Sea flash:** no line. The card prints the nearest substation beyond 40 km (Salcombe, 80.7 km), and the record is `NEAREST_BEYOND_40_KM`.
- **Card bar taps:** minimise and restore by real tap keep everything, and no map click fires (`clicks: []`).

### Integration code (37 lines, ~1.4 kB minified; budget headroom 11.1 kB)

This is `evidence/kv-engine/engine-nearest.js`, verbatim. `S`, `pc`, `note`, `msg`, `mh`, `Ts` and `tm` are the module's own.

```js
const ENGINE_CLASS = 'gridatlas-lightning-engine';
function engineNearest(m, x, y, when) {
  const L = window.__GRIDATLAS_NEON_LINKS__, gl = window.maplibregl;
  if (!L || typeof L.selectAt !== 'function' || !gl || typeof gl.Popup !== 'function') return false;
  pc();                                              // Lightning's own card (and any earlier engine card) goes
  if (!document.getElementById(ENGINE_CLASS)) {      // project-only controls are hidden inside the engine block
    const st = document.createElement('style'); st.id = ENGINE_CLASS;
    st.textContent = `.${ENGINE_CLASS} .neon-layout,.${ENGINE_CLASS} .neon-pin{display:none}`;
    document.head.appendChild(st);
  }
  const card = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
  card.style.cssText = 'font-family:monospace;background:#000;padding:6px';
  b.style.cssText = 'color:#00ffff;font-size:13px'; b.textContent = 'Optical flash ' + when;
  s.style.cssText = 'color:#888;font-size:11px';
  s.textContent = 'EUMETSAT MTG Lightning Imager: an optical flash, not necessarily a ground strike. '
    + 'Distances to the nearest mapped substations only; nothing here says any asset was affected.';
  card.append(b, document.createElement('br'), s);
  // The card must exist BEFORE selectAt: the engine's popup watcher clears lines that stand with no .maplibregl-popup.
  const ep = S.ep = new gl.Popup({ maxWidth: '340px', closeOnClick: false, className: ENGINE_CLASS })
    .setLngLat([x, y]).setDOMContent(card).addTo(m);
  if (!S.ev) S.ev = { center: m.getCenter(), zoom: m.getZoom() };   // camera to give back on OFF
  m.flyTo({ center: [x, y], zoom: Math.max(12, m.getZoom()), duration: 1200, essential: true });
  L.selectAt([x, y], 'Optical flash ' + when, '', false, null).catch(e => note('engine nearest: ' + msg(e)));
  return true;
}
function engineClose() {   // the card's OWN ×: clearLinks() + popup.remove() + undockSheet()
  const p = S.ep; S.ep = null; if (!p) return;
  const x = p.getElement && p.getElement().querySelector('.gridatlas-card-bar .close');
  try { if (x) x.click(); else p.remove(); } catch (_) {}
}
// pc() gains:      engineClose();
// so(false) gains: if (S.ev) { const m = mh(); if (m) m.jumpTo(S.ev); S.ev = null; } document.getElementById(ENGINE_CLASS)?.remove();
// card button:     n.addEventListener('click', () => engineNearest(m, x, y, Ts(tm(g))) || near(m, c, x, y));
```

The existing `near()` stays as the fallback when the engine is absent. That fallback still needs a `fitBounds` over the flash and its substations to be visible at all.

### Side effects on original state, and how each is undone

| Side effect | Undone by | Verified |
|---|---|---|
| `invalidatePendingArrival('new-selection')`: arrival epoch +1, `gridatlas:arrival-invalidated` event, scope cleared. This cancels a still-pending URL arrival, exactly as a project click does. | Not reversible, by design (same as a user click) | epoch 3→5→6 |
| `l-neon-*` and pin sources filled, the flow animation's rAF running, `links_drawn`, `last_selection` and `lastSelection` set | `engineClose()` → bar × → `clearLinks()` | protoAfterPc: links/nodes/pin 0, `last_selection` null |
| `arrival_engine` and container `data-gridatlas-arrival*` | `clearLinks()` → `clearArrivalEngine()` | `containerAttrs: []` |
| `<html>.gridatlas-sheet-open` and `--gridatlas-sheet-h` | the bar × → `undockSheet()`. A bare `popup.remove()` **leaks** both (first prototype run). | htmlClass back to `gridatlas-menu-hosted` |
| Sea flash, 0 links: the ring and record stay, because the watcher only clears when `links_drawn>0` | the bar × path clears them too | protoSeaAfterPc all 0 |
| Camera moved to zoom ≥12 | `so(false)` restores `S.ev`. On × the camera stays, matching the project card. | zoom back to 4.2 |
| `<style id=gridatlas-lightning-engine>` | `so(false)` removes it | `styleEl:false` |
| Without the `pc()` hook, Lightning OFF leaves the engine card and 5 lines standing | the `pc()` hook (OFF → `cx()` → `pc()`) | protoOffWithoutPatch vs protoOffPatched |

### Owner decisions
1. **OWNER_DECISION: project-oriented extras.** The expanded card also shows the engine's "Nearest 400 kV substation … corridor estimate" block and the "Explore route corridors ›" button (proto-04-expanded). They are faithful to the deep link but irrelevant to a flash. Hiding them costs one selector: `.gridatlas-corridor-open`.
2. **OWNER_DECISION: camera on OFF.** Restoring the camera on OFF is optional. Drop the `S.ev` line to match the original, which never restores it.
