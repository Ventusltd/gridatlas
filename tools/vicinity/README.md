# Native vicinity familiarisation

Source-only module for the next GridAtlas composition. It does not edit a live pointer, immutable release, historical generation, raw dataset or source graph.

`build.mjs` deterministically assembles `src/model.mjs`, `src/bootstrap.js` and `src/vicinity.css` into one bounded module. The source uses the existing native MapLibre map and the existing canonical `geodesy` module. It first reads the complete already-loaded `src-subs.serialize().data` GeoJSON, so changing radius or origin is not restricted to currently visible tiles. Public `querySourceFeatures` is only a labelled viewport-subset fallback; while that source is not ready it can show the already-loaded ≥33 kV screening subset, also explicitly labelled. Existing source voltage tags retain their units; unknown voltage and missing stable IDs remain unknown. No additional collector or data source is installed.

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

An optional `news_context_url` may supply an HTTPS exact-host `globalgrid2050.com/uk_renewables_pipeline/<12 digits>/` edition base, optionally ending `index.html`. Credentials, ports, query strings, fragments and other hosts/paths are refused. The explorer constructs only `news_origin_type`, `news_origin_id` and one of six `news_topic` values, plus the fixed `#headlinesHeading` anchor. News context opens only on a user click and is explicitly topic context, not an association between a headline and an asset. No unpublished edition is guessed or reserved. A valid base is retained when the user chooses another origin.

This additive module also styles the inherited Journey select dark in WebKit and reserves space for native Layers in short landscape viewports. The original Journey source and its historical rebuild remain unchanged.

The module budget is 64,000 bytes, including the owner-requested generation/storage/demand context and documentary adapters. This replaces the unpublished stations-only prototype's 48,000-byte proposal; the repository's cartridge ceiling remains unchanged. All available categories share the same radius. The context adapter keeps register power, IT load, grid-connection statements and unknown actual demand separate; it retains source precision without treating an opaque ID and point as facility verification. The user can add any located context row to the same local assumed model.

Documented works match only an exact existing REPD declaration key. Those legacy published declarations are explicitly not freshly revalidated; the pinned source and review status remain visible. Official Sea Link notices remain unassociated context with no coordinates or asset join. Planned bounds are not installed capacity or measured power flow.

## Verification

```text
node --test tools/vicinity/model.test.mjs
node tools/vicinity/build.mjs --generation YYYYMMDDHHMM --out NEW_MODULE.js
node tools/vicinity/browser.test.mjs
```

The browser proof uses the actual Atlas composer and native MapLibre. `VICINITY_BROWSER_GENERATION` chooses the full composition. During source review only, `VICINITY_BROWSER_INJECT=1` explicitly labels the receipt as candidate module injection rather than published acceptance; `VICINITY_ATLAS_ROOT` can select the local Atlas1 checkout used as the host. Physical handset certification is separate from browser emulation.
