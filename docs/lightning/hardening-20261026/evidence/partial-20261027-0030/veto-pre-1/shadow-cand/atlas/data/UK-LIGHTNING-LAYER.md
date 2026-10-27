# UK lightning public layer

The immutable GridAtlas UK `ukConfig` lives in `atlas/releases/202608300453-atlas-v9/index.html`. Do not modify this release.

Generation `202610221600` extends the active **sld-sandbox** cartridge with a small constructor wrapper. It appends an ordinary MapLibre **point** layer to the existing `ukConfig` before `initVentusMap` freezes it, using the existing dashboard checkboxes, GeoJSON loader and popups. No additional map shell, custom control framework or site-specific code is introduced.

Group: **Weather (GeoJSON)**; layer ID: `uk_lightning`; source: `https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson`.

Data: EUMETSAT Meteosat Third Generation Lightning Imager **Level 2 Lightning Flashes**, satellite optical detections, including in-cloud lightning. These are **not verified ground strikes**. The UK geographic rectangle includes neighbouring waters, not a national polygon.

The data repository initially serves an empty FeatureCollection with `status: awaiting_credentials`; it has NO synthetic strikes. Configure EUMETSAT API secrets and activate `Ventusltd/lightning` Actions for actual observations.

A failed or empty download must not be labelled `no lightning`. The layer is off by default and lazily loads only on request.

Review procedure: confirm existing layers work, toggle Weather → Lightning, check optical-flash timestamps (UTC) in native asset popups once observations exist, and verify GridAtlas scope lint/STATE generation before merge.
