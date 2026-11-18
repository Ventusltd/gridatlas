# Native vicinity familiarisation

Source-only module for the next GridAtlas composition. It does not edit a live pointer, immutable release, historical generation, raw dataset or source graph.

`build.mjs` deterministically assembles `src/model.mjs`, `src/bootstrap.js` and `src/vicinity.css` into one bounded module. The source uses the existing native MapLibre map and the existing canonical `geodesy` module. It reuses the loaded `src-subs` source through public `querySourceFeatures`; while that source is not ready it can show the already-loaded ≥33 kV screening subset, explicitly labelled as a subset. Existing source voltage tags retain their units; unknown voltage and missing stable IDs remain unknown. No additional collector or data source is installed.

The control appears in the native Grid menu, original Layers and fullscreen controls. It offers an integer radius from 1–50 km, voltage tags, chosen map point/centre or a located source asset, nearby real mapped substations and an optional ordered local user model. Pink dashed model joins are explicitly user-assumed; the spatial radius boundary is not a circuit. No connections, transformers, capacity, energisation, routing or measured power flow are inferred from proximity.

## Origin contract

Vicinity is the sole consumer of:

```text
?journey=vicinity&origin_type=repd|datacentre|substation&origin_id=<opaque-source-id>&latitude=<number>&longitude=<number>&radius_km=<integer1..50>
```

Existing producer IDs such as `repd:2470`, `grid_substations:0` and data-centre source IDs are retained without deriving identity from a name or coordinates. Existing legacy REPD fields may coexist. Missing, repeated or invalid origin fields explicitly refuse the link. The user can then choose a map centre or point; no substitute point is silently invented.

All native/Layers/event actions use one controller:

```js
window.__GRIDATLAS_MODULES__.gridVicinity.open({
  origin: {at: [longitude, latitude], type: 'substation', id: 'grid_substations:0', name: 'Source name'},
  radiusKm: 10
});
window.dispatchEvent(new CustomEvent('gridatlas:vicinity-open', {detail: {origin, radiusKm: 10}}));
```

The module also exposes `mount(nativeMap)`, `setOrigin(origin)`, `snapshot()` and `destroy()`. User models are bounded to 20 selected stations, kept in this page only and never written into a source dataset. Close removes owned map overlays; destroy also removes the DOM, controls and listeners. Foreign map sources with colliding IDs are preserved.

## Verification

```text
node --test tools/vicinity/model.test.mjs
node tools/vicinity/build.mjs --generation YYYYMMDDHHMM --out NEW_MODULE.js
node tools/vicinity/browser.test.mjs
```

The browser proof uses the actual Atlas composer and native MapLibre. `VICINITY_BROWSER_GENERATION` chooses the full composition. During source review only, `VICINITY_BROWSER_INJECT=1` explicitly labels the receipt as candidate module injection rather than published acceptance; `VICINITY_ATLAS_ROOT` can select the local Atlas1 checkout used as the host. Physical handset certification is separate from browser emulation.
