# kv-arrival-api: the public surface for drawing project-style neon links at any point

Lane: NODE/static, 27 Oct 2026. Source: `wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js` (435,218 B). The live 202610270929 cartridge is this file byte for byte, with the Lightning module appended. Line index: `evidence/kv-arrival-api/line-index.txt`.

## 1. What a project deep link does

- **Boot.** `install(map)` (6045):
  - installs `#gridatlas-neon-css`, which includes the card-bar CSS;
  - runs `ensureLayers` (4308) and warms `loadSubstations()` (6054);
  - starts `popupWatcher` (6059), which calls `clearLinks()` when lines are drawn and no popup exists;
  - registers the click handler (6191).
  `attemptArrival` (6938) runs only when the page is visible.
- **`runDeepLink`** (6320):
  - `claimPendingArrival` (6353 → 3435) runs a keyed, idempotent `arrivalGate.begin`.
  - `deepLinkPlan` (3378) is pure and returns `route`.
  - It applies the false-origin guard (6444), enters fullscreen (6459), calls `flyTo` at zoom 12 (6629) and enables layers (6681).
  - `runArrivalSelection` (6707) sets `currentRepdRef`, then calls `ensureArrivalCard` (4205), which opens the popup **before** the lines so the watcher does not wipe them. It then calls `setPin`, sets `deep_linked=true` and calls `selectAt(…, epoch)`.
- **`selectAt`** (6073; `link.selectAt` is set at 6168, only after install). Without an epoch:
  - It calls `invalidatePendingArrival('new-selection')` (3438). That increments the epoch, nulls `activeKey`, sets `arrival_reconciliation=INVALIDATED`, clears `arrival_engine` and the `data-gridatlas-arrival*` attributes, drops the declared frame, and dispatches `gridatlas:arrival-invalidated`. The search lane (place-global-search:97) then marks `deep_link` **CANCELLED**.
  - It calls `clearScope()` and resets `currentDeclared`, `currentNearest400` and `currentPolicy`.
  - It awaits `loadSubstations()` (3477), which sets `link.substations` and its counts.
  - It calls `resolveDeclaredConnection(currentRepdRef)`, **`nearestTransmission`** (6157 → 1975 → 623, 400 kV only, feeding the card at 2063) and `resolveNesoConnection(currentRepdRef)`.
  - It calls `drawLinks(nearestSubstations(...))`. `nearestSubstations` (3513) uses ≥33 kV, ≤40 km and 5 links, and returns `beyondRadiusNearest` when none are in range.
  - **It never resets `currentRepdRef`.** Only lines 6241, 6730 and `clearLinks` (4516) write it.
- **`drawLinks`** (4522):
  - writes the sources, plus a declared or NESO line;
  - `armCardKeeper` (4266) re-injects the block into **any** popup that appears;
  - `injectIntoCard` (4111) uses the first popup and calls `resetCardGeometry` and `addCardBar`;
  - `startAnimation` (4414);
  - `recordArrivalEngine` (4457) is the single writer of `arrival_engine`;
  - sets `last_selection` and calls `setPin`.

**Drawing (4308–4401).**

- Sources: `gridatlas-neon-links` and `gridatlas-neon-nodes`.
- Layers:

  | Layer | Paint |
  |---|---|
  | `l-neon-glow` | `['get','colour']`, width 5→12, opacity .10, blur 3→8 |
  | `l-neon-core` | width .9→1.8, opacity `strength`=max(.2, .62−.1·rank) |
  | `l-neon-flow` | `#bfe9ee`, opacity .8 |
  | `l-neon-flow-b` | `#bfe9ee`, opacity .45 |
  | `l-neon-node-ring` | stroke `#5fbdc2`, opacity .4 |
  | `l-neon-node` | `#5fbdc2`, opacity .8 (the "white" nodes) |
  | `l-neon-label` | `"{km} km · {kv} kV"`, `#a9c4c9`, halo `#000c10`; added only after a glyph fetch (5310) |

- The two flow layers have an animated dasharray (`flowDash`), half a period apart. Reduced motion hides them.
- Origin: `l-project-pin-halo` (tech colour, opacity .13) and `l-project-pin` (`#cfe9ed`), both hollow (5161–5185). **No red pulsing origin exists anywhere in the live composition** (I grepped the engine, the shell and all cartridges). The owner's red dot is the engine's own pixel.

**Card bar (`addCardBar`, 3950).** It contains `.grip`, `.label` (the first `b`/`strong`), `.min` (toggles `gridatlas-min`), and `.close` (`clearLinks` + `popup.remove` + `undockSheet`), plus pointer-drag. On a phone it arrives minimised (4088). The functions are private; only the CSS is global.

## 2. The smallest public surface

| Need | Surface |
|---|---|
| candidates | `__GRIDATLAS_NEON_LINKS__.substations` (filled at boot) |
| measurement | `.measure.nearestSubstations(lon, lat, subs)`, the project's own answer |
| constants | `.measure.MIN_KV`, `MAX_LINK_KM`, `LINK_COUNT` |
| animation | `.measure.flowDash(phase)` |
| 400 kV row (optional) | `__GRIDATLAS_MODULES__.declaredConnections.nearestTransmission` (653, pure) |
| card | `maplibregl.Popup` plus the global `.gridatlas-card-bar` and `.gridatlas-neon-block` CSS |

**Not `link.selectAt`**; see the risks below. Draw on Lightning-owned ids with the paint copied from section 1.

**Call sequence**

1. Proceed when `L.installed && Array.isArray(L.substations)`.
2. Call `links = L.measure.nearestSubstations(lon, lat, L.substations)`. If it is empty, state `beyondRadiusNearest` and draw no line, as the original does at 3738.
3. Open a popup (`closeOnClick: false`) with a bar using the original class names and your own `.min` and `.close` handlers. Title it "Optical flash · nearest mapped substations". Leave out "Show the project ring" and "Lay out a scheme here".
4. Add your own sources and layers matching the seven `l-neon-*` layers plus the ring.
5. Animate with `requestAnimationFrame` (step .055, period 1.5) and honour reduced motion.
6. **Frame:** `fitBounds(origin + nodes, {maxZoom: 12, padding.bottom ≈ 220 on a sheet})`. The Lightning card never moves the camera today, and it filters to ≥132 kV with 3 links (module line 154). At zoom 6, 5 km lines under a large card are the likeliest cause of "no lines appear". I have not verified this in a browser.

## 3. Risks of reusing `link.selectAt`

1. **Stale `currentRepdRef`.** After project X, without `clearLinks`, X's declared or NESO line is drawn **from the flash**, labelled "PoC" or "Declared" (4554–4599), and the card prints X's declared connection. This passes the flash off as a project.
2. Invalidating the gate cancels an in-flight real deep link, and the search lane marks it CANCELLED.
3. `arrival_engine` becomes `{onshore, answered: true}` and `data-gridatlas-arrival="answered"`. `arrivalHasVisibleOutcome` (6933) then suppresses the visibility re-run of a deferred arrival.
4. "Lay out a scheme here" calls `openSldFromProject` (8077) and places an array at the flash.
5. `armCardKeeper` decorates the **first** popup, which may be Lightning's.
6. **Click order.** Lightning's layers start with `l-`, so the neon handler (6191) calls `clearLinks()` synchronously before Lightning's tap handler runs. This holds only while Lightning registers after `install()`. A flash over a project pixel selects the project asynchronously.
7. `L.substations` is `undefined` until loaded and `[]` after a failure.

## 4. Cleanup

1. Cancel your `requestAnimationFrame`.
2. Remove your layers top-down, then your sources, guarding each with `getLayer` / `getSource`.
3. Remove your popup. Undo `gridatlas-sheet-open` and `--gridatlas-sheet-h` only if you set them.
4. Trigger cleanup on: your close button, the next map tap, a period change, the overlay being toggled off, and `gridatlas:arrival-invalidated`.
5. Never call `invalidatePendingArrival`, `claimPendingArrival` or `recordArrivalEngine`, and never send a synthetic Escape. Escape also closes the corridor sheet (2133) and search.

If the original drawer must be reused, the only safe public way to clear it is clicking the original card's `.gridatlas-card-bar .close` (3984). The minimal original-side change is to export `link.clear = clearLinks` and give `selectAt` a `repdRef` reset. That is about 60 B, but it is a change to a hashed cartridge.

## 5. ChatGPT lab (gridatlas origin/main 13479b4)

`atlas/labs/lightning-grid/` is a separate page with its own map and a CARTO raster basemap. It reuses **none** of the Atlas runtime (no neon object, gate or card bar).

- **Reused:** the same `releases/202608300453-atlas-v9/data/grid_substations.geojson` (via raw.githubusercontent), eight Pipeline News solar partitions, and a pinned `ventus-grid-engine@69b4e88…/lightning-click-context.js` (`selectFlash`, `substationLimit: 6`).
- **Drawn:** dots only (a white selection ring, blue substations, green solar), with no lines or labels.
- **Camera:** none on selection; the owner presses "Fit selection" (maxZoom 9).
- **Hygiene:** a serial counter guards stale results.

It confirms that "own layers plus public measurement" works. It is not the neon visual the owner expects.
