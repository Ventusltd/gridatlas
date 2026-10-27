# NEXT VERSION — Lightning optical observation → Grid Engine / solar MAP → IT AC and floating DC scenario

**27 October 2026, experimental branch. This is NOT the current GridAtlas or Build E preview. No deployment or live pointer change.**

This next-version sidecar is a lightweight **separate page** at \`atlas/labs/lightning-grid/\`. It reuses Ventus Grid Engine and the Pipeline News/GridAtlas MAP receiver; it does **not** attempt to squeeze electrical models into the 24,781-byte Lightning cartridge. The first iteration is HTML + JS and a Node proof, all read-only. A user can pick an authentic flash and ask which **mapped** substations and **identified** REPD solar projects are near it. No claim of actual strike, connection, damaged asset or quantified risk follows.

## Current dependencies and exact source

- Engine: \`Ventusltd/ventus-grid-engine\` draft PR #2, currently pinned to commit \`1829ea0b132dc5f1650c1cacdc54635fec6b1fc1\` through jsDelivr; it imports the estate's nearest search, geodesy and MAP deep-link contract rather than duplicating algorithms.
- Optical observations: \`Ventusltd/lightning/main/data/uk_lightning.geojson\`; seven-day feed only, indexed by authentic \`Feature.id\` with source UTC. Optical flashes **are not confirmed ground strikes**.
- Substation locations: the existing GridAtlas immutable shell's \`grid_substations.geojson\`. Entries lacking coordinates or valid voltage must not be falsely ranked.
- Solar plant catalogue: **eight Pipeline News V9.1 real GeoJSON solar partitions** under \`Ventusltd/pipelinenews/main/data/atlas/\`, not a generated mock list or the entire 35.7 MB register.
- Actual project MAP navigation: the imported Ventus Grid Engine \`buildDeepLink\` uses the canonical \`https://ventusltd.github.io/gridatlas/atlas/\` route; advisory \`capacity_mw\` and \`project\` follow existing deployed Pipeline News semantics, \`repd_ref\` is the sole genuine project identity. A selected optical event ID NEVER becomes a REPD reference.
- Scenario: model configuration via explicit user-chosen AC IT/TN/TT, DC floating/functional earth and inverter isolation. The result is a list of required inputs and options **with \`solver_status=NOT_RUN\`**. No fabricated kA, voltages, arc risks, protection trip, causal claims or compliance conclusion.

## Boundary and acceptance gates

1. **Current state:** code committed to a **draft** next-version branch. Not browser tested; CDN, raw GitHub CORS, real iOS Safari and 8-partition download remain unverified. Do not merge until actually smoke-tested.
2. Run \`node tools/proofs/lightning-grid-explorer.proof.mjs\` from repository root. This is a STATIC Node proof only.
3. Execute \`node proofs/lightning-click-context.proof.mjs\` in the pinned Grid Engine source. The first pre-PR functional isolation run showed 54 checks passing in a JS harness with a URL shim; **not a full Node CI result**. Require actual Node CI before merge.
4. Validate the real \`grid_substations.geojson\` Feature/attribute shape and that nearest candidate counts are nonzero. Accept zero where legitimately none is located, but do not present missing coverage as no facilities.
5. Exercise same-position Map links against actual GridAtlas receiver (historical wind bucket issue, null coordinates, numeric \`repd_ref\`, 44px targets, keyboard and touch). Test on owner iPhone.
6. Capture memory/performance using real 408 observed optical events, all 8 solar partitions and the substation GeoJSON. If a partition fails, show PARTIAL SOURCE rather than a complete zero.
7. Do not modify original \`atlas/current.json\`, Build E's 202610270024 route or existing 63 controls. Keep E's independent V1–V15 acceptance and archive verification separate under issue #32.
8. All source licences and attribution remain attached (Ventus code under its declared licence; EUMETSAT/OSM/NESO data retain their respective terms).

See [feature work order #36](https://github.com/Ventusltd/gridatlas/issues/36), [release-critical Issue #32](https://github.com/Ventusltd/gridatlas/issues/32) and [Grid Engine draft PR #2](https://github.com/Ventusltd/ventus-grid-engine/pull/2).
