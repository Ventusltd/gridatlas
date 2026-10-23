# Isolated UK Lightning V3 preview

**Live, unchanged:** https://ventusltd.github.io/gridatlas/atlas/ · generation `202609241334`.

**Independent preview:** https://ventusltd.github.io/gridatlas/atlas/preview/lightning/ · generation `202610230230`.

## Root causes of the failed V1

1. **Menu contract:** the GridAtlas menu requires exactly 60 engine plus 3 Pipeline News layer controls. The former V1 appended a 61st engine layer to `ukConfig`; the menu intentionally refused to install. **The original UI was not structurally broken; it was enforcing its safety invariant.**
2. **GeoJSON bridge:** the internal DuckDB/Parquet fetch interceptor claimed every request ending in `.geojson`, including external public lightning feeds, and tried to find a non-existent internal partition.

## V3 design

The preview composes the exact restored original SLD/menu cartridge, the original map shell, and the original place/search and substation-intelligence cartridges. It changes ONLY its isolated `streaming-parquet-bridge` to ignore cross-origin files, and injects `weather-module.js` verified by SHA-256. Weather adds a MapLibre GeoJSON source and a standalone Grid-menu toggle **after the existing 63-control menu is installed**, with no `data-layer-id`, no `data-pn-layer`, and no `ukConfig` mutation. Original menus and handler identities remain unchanged. The standalone toggle has a separate `weather:uk_lightning` identifier and cannot poison the legacy layer inventory.

**Data:** EUMETSAT optical flashes (including in-cloud activity). Not confirmed strikes at ground level. The production feed is `https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson`.

**Tests:** A GitHub Actions Chromium comparison exercises both versions on desktop (1440px) and phone (393px), asserts all 63 original layer proxies remain, original menu controls are identical, verifies one isolated Weather toggle, and tests the external GeoJSON fetch and rendered layer using two real historical observations as *test-only browser fixtures*.

**Publication rule:** leave the root `atlas/current.json` and `STATE.md` at the restored baseline. Publish preview files alone after CI passes. Production lightning activation requires a separately reviewed proposal.
