# Isolated UK lightning V2 preview

**Live baseline (unchanged):** https://ventusltd.github.io/gridatlas/atlas/ · generation `202609241334`.

**Preview:** https://ventusltd.github.io/gridatlas/atlas/preview/lightning/ · generation `202610230100`.

The preview composes the same immutable release and the same three non-lightning cartridges. It substitutes a versioned **streaming bridge** that handles only same-origin legacy/Parquet GeoJSON requests; cross-origin `https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson` goes straight to native fetch. It also uses the existing lightning-enabled layer adaptor, without modifying the immutable UK shell, GridAtlas's live `atlas/current.json`, or `STATE.md`.

**Why V1 failed:** `legacyStem(pathname)` matched every URL ending in `.geojson` including external URLs. `queryOnDemand` then mistakenly tried to reconstruct `uk_lightning` from the internal Parquet manifest, which does not contain it.

**Acceptance:** compare all original menus on 1440px desktop and 393px phone before/after, check the weather group's new toggle, establish a direct cross-origin GeoJSON network request, count the plotted features, click a sample flash, toggle off, and run the existing suite of GridAtlas cartridge proofs. See `tools/proofs/uk-lightning-preview.browser.mjs` and `.github/workflows/uk-lightning-preview.yml`.

This folder is a preview version, not a new production release. The first 98 observations originate from EUMETSAT MTG Lightning Imager. Satellite optical flashes include in-cloud lightning and are not evidence of ground strikes or damage.
