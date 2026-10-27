# Build F overnight development checkpoint · 2026-10-27 UTC

**Status:** unmerged, experimental **next version**; do not confuse with the published, public Build E standalone page \`/atlas/v/202610270024/\` or original live GridAtlas \`atlas/current.json = 202609241334\`.

User approval: publish completed Build E testing assets as **a standalone preview only**, start the next version, and run unattended independent checks through the early morning. Every automatic scheduled iteration must respect the same release veto: **NO production pointer switch; no releases/merge without fresh owner approval.**

## Stable inputs already published
- GridAtlas Build E standalone preview, GitHub Pages deployment run **40426931408**, publish commit \`1c19b76838758ef08ed9c8c4902a798a8762ece6\`.
- Independent Testcode checks merged in \`Ventusltd/testcode\` commit \`d09c185c8dacbc5c73afb2b0d0d8dad40745a544\`; previous workflow run **40427197494** 9/9 composition + 8/8 independent Node tests PASS, with old candidate negative control RED as expected. This does **not** establish the real iPhone/V1–V15 gates.
- Current **unmerged** pure engine adapter: \`Ventusltd/ventus-grid-engine\` draft PR #2, pinned SHA \`ced25abae2b8b4d0d719faf36e299632e69c2522\`. Engine imports existing \`v9-geodesy\`, \`v9-nearest-search\`, \`deeplink/contract.js\`; no third distance implementation.
- EUMETSAT genuine seven-day feed is **optical events, not measured ground strikes**; archive PR #2 remains unmerged. Six/12-month windows cannot be shown as complete until real coverage exists.

## What Build F started with

The initial \`atlas/experiments/lightning-grid-20261027/selection.mjs\` is a **pure MapLibre adapter for experimental wiring**:
- Reuses \`gridatlas-lightning\` source; does not alter it, add a fake observation, or modify source coordinates.
- A distinct 22px-radius transparent hit layer provides >=44 CSS px optical-point tap targets (not geographic intensity).
- Click returns genuine source ID/time/location; clusters are NEVER converted to a single flash.
- Late source loading, event teardown and state reset are covered by Node tests.
- No numeric electrical study or damage interpretation; hypothetical scenario config remains in independent engine draft PR #2.

Run \`node --test tools/proofs/build-f-lightning-selection.test.mjs\`.
CI: \`.github/workflows/lightning-build-f-20261027.yml\` also runs the separate pinned engine proof and refuses a changed \`atlas/current.json\`.

## Next implementation steps (not yet claimed complete)
1. **Wire a NEW standalone page**, not the immutable GridAtlas overlay (only one byte remained under old cartridge cap). Lift the existing Pipeline News MAP deep-link and Atlas arrival choreography: real \`repd_ref\`, project name, technology, declared MW, coordinates and zoom. Do not reimplement the receiver or fake a project identity from a lightning event.
2. Add genuine substation and solar project data adapters, validated against \`data-grid-gb/derived/connection-points.v3.json\` and compact PipelineNews 7,680-row project index, with provenance and geometry-validity contracts. No fake count/coverage/available capacity. Use current \`v9-nearest-search\` and fixed Earth model.
3. Add a *click-on-an-observed-optical-flash* accessible panel with nearest geolocated substations by voltage class, nearby real solar plants by MW and 5/10/20 km radius; optional **fit to selection**, NEVER pan automatically merely on layer toggle.
4. Hypothetical IT AC / floating DC / combined surge scenario selector using the engine adapter; default solver status \`NOT_RUN\`. Engineering numerics require explicit circuit/earthing/inverter/impulse model and independent validation; nothing here establishes a strike or an actual electrical fault.
5. Full standalone experimental browser build using correct source attribution, 12h/24h coverage unknown, genuine 48h Scottish optics outside original camera, iPhone Safari hit-target and HIDE LAYERS independent V1–V15 release veto.

## Overnight duties and constraints
- Independent tester rechecks E against new Claude changes and checks this PR's CI, records *actual* PASS/FAIL/BLOCKED with exact run links.
- On test failure, fix the *independent feature/test branch only*; never patch the already-published Build E assets or Claude's release lane.
- Read gridatlas Issues [#32](https://github.com/Ventusltd/gridatlas/issues/32) and [#36](https://github.com/Ventusltd/gridatlas/issues/36); post actionable findings and do not merge a new product/branch automatically.
- User-facing morning briefing should distinguish **published** vs **source pushed** vs **tested** vs **released live**. Test coverage alone does not settle owner visual approval or historical data rights.
