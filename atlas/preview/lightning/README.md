# Isolated UK Lightning V5 preview

**Live, unchanged:** https://ventusltd.github.io/gridatlas/atlas/ · generation `202609241334`.

**Independent preview:** https://ventusltd.github.io/gridatlas/atlas/preview/lightning/ · generation `202610261500`.

## Root causes of the failed V1

1. **Menu contract:** the GridAtlas menu requires exactly 60 engine plus 3 Pipeline News layer controls. The former V1 appended a 61st engine layer to `ukConfig`; the menu intentionally refused to install. **The original UI was not structurally broken; it was enforcing its safety invariant.**
2. **GeoJSON bridge:** the internal DuckDB/Parquet fetch interceptor claimed every request ending in `.geojson`, including external public lightning feeds, and tried to find a non-existent internal partition.

## V5 design

The preview composes the exact restored original SLD/menu cartridge, the original map shell, and the original place/search and substation-intelligence cartridges. It changes ONLY its isolated `streaming-parquet-bridge` to ignore cross-origin files, and injects `weather-module.js` verified by SHA-256. Weather adds a MapLibre GeoJSON source and a standalone Grid-menu toggle **after the existing 63-control menu is installed**, with no `data-layer-id`, no `data-pn-layer`, and no `ukConfig` mutation. Original menus and handler identities remain unchanged. The standalone toggle has a separate `weather:uk_lightning` identifier and cannot poison the legacy layer inventory.

**Data:** EUMETSAT optical flashes (including in-cloud activity). Not confirmed strikes at ground level. The production feed is `https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson`.

**Fix for missing menu option:** the V3 Weather group was appended after all existing layers and was below the scrollable menu viewport. V4 prepends the Weather group and Lightning toggle, with an automated assertion that the toggle is in the initial visible viewport, without scrolling.

**Tests:** A GitHub Actions Chromium comparison exercises both versions on desktop (1440px) and phone (393px), asserts all 63 original layer proxies remain, original menu controls are identical, verifies one isolated Weather toggle, and tests the external GeoJSON fetch and rendered layer using two real historical observations as *test-only browser fixtures*.

**Publication rule:** leave the root `atlas/current.json` and `STATE.md` at the restored baseline. Publish preview files alone after CI passes. Production lightning activation requires a separately reviewed proposal.

## V5: native LAYERS presence

Earlier releases inserted Weather solely into the six-item **Grid dropdown**, not the actual Layers (SCADA) dashboard or fullscreen curtain; the user's missing-layer report was correct. V5 now inserts separate synchronised checkboxes as the **first section** in `#scada-ui-container` and `#fs-curtain-keys`, preserving the original 60 engine + 3 Pipeline News inputs. Clicking either native Layers or dropdown turns the SAME MapLibre layer on/off. No `data-layer-id` or `data-pn-layer` attributes are assigned to Weather, so the original safety invariant is preserved. Chromium tests must click the actual native Layers checkbox, not merely assert it exists.
