# NEXT VERSION — Lightning optical observation → Grid Engine / solar MAP → IT AC and floating DC scenario

**27 October 2026, experimental branch. This is NOT the current GridAtlas or Build E preview. No deployment or live pointer change.**

This next-version sidecar is a lightweight **separate page** at \`atlas/labs/lightning-grid/\`. It reuses Ventus Grid Engine and the Pipeline News/GridAtlas MAP receiver; it does **not** attempt to squeeze electrical models into the 24,781-byte Lightning cartridge. The first iteration is HTML + JS and a Node proof, all read-only. A user can pick an authentic flash and ask which **mapped** substations and **identified** REPD solar projects are near it. No claim of actual strike, connection, damaged asset or quantified risk follows.

## Current dependencies and exact source

- Engine: \`Ventusltd/ventus-grid-engine\` draft PR #2, currently pinned to commit \`69b4e88c8464f0310bd67e47ec83ee8afa9e1921\` through jsDelivr; it imports the estate's nearest search, geodesy and MAP deep-link contract rather than duplicating algorithms.
- Optical observations: \`Ventusltd/lightning/main/data/uk_lightning.geojson\`; seven-day feed only, indexed by authentic \`Feature.id\` with source UTC. Optical flashes **are not confirmed ground strikes**.
- Substation locations: the existing GridAtlas immutable shell's \`grid_substations.geojson\`. Entries lacking coordinates or valid voltage must not be falsely ranked.
- Solar plant catalogue: **eight Pipeline News V9.1 real GeoJSON solar partitions** under \`Ventusltd/pipelinenews/main/data/atlas/\`, not a generated mock list or the entire 35.7 MB register.
- Actual project MAP navigation: the imported Ventus Grid Engine \`buildDeepLink\` uses the canonical \`https://ventusltd.github.io/gridatlas/atlas/\` route; advisory \`capacity_mw\` and \`project\` follow existing deployed Pipeline News semantics, \`repd_ref\` is the sole genuine project identity. A selected optical event ID NEVER becomes a REPD reference.
- Scenario: model configuration via explicit user-chosen AC IT/TN/TT, DC floating/functional earth and inverter isolation. The result is a list of required inputs and options **with \`solver_status=NOT_RUN\`**. No fabricated kA, voltages, arc risks, protection trip, causal claims or compliance conclusion.

## Boundary and acceptance gates

1. **Current state:** code committed to a **draft** next-version branch. Not browser tested; CDN, raw GitHub CORS, real iOS Safari and 8-partition download remain unverified. Do not merge until actually smoke-tested.
2. Run \`node tools/proofs/lightning-grid-explorer.proof.mjs\` from repository root. This is a STATIC Node proof only.
3. Execute \`node proofs/lightning-click-context.proof.mjs\` in the pinned Grid Engine source. The current functional isolation run showed **79 checks PASS** in a JS harness with a URL shim, including existing OSM polygon/MultiPolygon geodesy and owner-required non-diagnostic diligence. **Not a full Node CI result**. Require actual Node CI before merge.
4. Validate the real \`grid_substations.geojson\` Feature/attribute shape and that nearest candidate counts are nonzero. Accept zero where legitimately none is located, but do not present missing coverage as no facilities.
5. Exercise same-position Map links against actual GridAtlas receiver (historical wind bucket issue, null coordinates, numeric \`repd_ref\`, 44px targets, keyboard and touch). Test on owner iPhone.
6. Capture memory/performance using real 408 observed optical events, all 8 solar partitions and the substation GeoJSON. If a partition fails, show PARTIAL SOURCE rather than a complete zero.
7. Do not modify original \`atlas/current.json\`, Build E's 202610270024 route or existing 63 controls. Keep E's independent V1–V15 acceptance and archive verification separate under issue #32.
8. All source licences and attribution remain attached (Ventus code under its declared licence; EUMETSAT/OSM/NESO data retain their respective terms).

See [feature work order #36](https://github.com/Ventusltd/gridatlas/issues/36), [release-critical Issue #32](https://github.com/Ventusltd/gridatlas/issues/32) and [Grid Engine draft PR #2](https://github.com/Ventusltd/ventus-grid-engine/pull/2).

## Owner's mandatory engineering boundaries (27 Oct)

Every flash-to-site view explicitly states (1) EUMETSAT optical detection is not necessarily a ground strike or evidence that a site was hit; (2) faults and surges may have independent causes, including grid switching, equipment failure, insulation degradation, moisture or a second IT fault; and (3) post-event inspection is a **diligence recommendation**, not a diagnosis. The user may declare nearby pylons/overhead lines and wet/dry weather; neither is inferred from the optical source.

The pure Grid Engine `postEventDiligence` helper supplies IMD/RCMU/SPD logs, insulation-resistance and earthing/bonding checks, cable/connector inspections, thermography and weather review, without claiming an electrical solution. DEHN White Paper WPX051/EN/0422 is linked as **manufacturer technical background**, not proof of a strike, a particular inverter installation, or a substitute for standards and site engineering.

A static CI workflow was added to the draft branch to run the separate `node tools/proofs/lightning-grid-explorer.proof.mjs`; inspect its exact GitHub run for PASS/FAIL rather than assuming green. Full browser/CDN and owner-iPhone checks remain blocked until performed.

## Executed real-source contract smoke, 27 Oct 01:35 UTC

[GitHub Actions run 40433400517](https://github.com/Ventusltd/gridatlas/actions/runs/40433400517) **PASS** on pinned Grid Engine commit `69b4e88c8464f0310bd67e47ec83ee8afa9e1921`. The read-only Node network test `tools/proofs/lightning-grid-real-sources.proof.mjs` verified exact Git blob hashes, jsDelivr's pinned source and declared CORS, and fetched the genuine EUMETSAT feed, 8 genuine Pipeline News solar partitions and original GridAtlas substation GeoJSON:

| Source | Read and accepted |
| --- | ---: |
| EUMETSAT optical observations | 408 |
| Original Atlas OSM substation features | 5,800 of 5,800 geolocated |
| REPD solar project features | 3,558 of 3,558 eligible |
| MAP receiver | Genuine REPD ref `2033` validated |
| Engine | `solver_status=NOT_RUN` |

The 500 km radius in this test is **solely to prove that at least one real project deep link is generated from a real optical observation**. It is not the UI's 20 km default, a proximity alert, a risk rating, or evidence of a ground strike. The first observed flash's nearest eligible mapped substation was ~80.68 km away, not an asset-damage claim. Data may change on subsequent runs.

**Still untested:** actual iPhone/Safari UI, interactive MapLibre tap bridge, on-device CORS/module import, site-specific electrical transients, archive integrity/backfill and owner sign-off. This is an experimental sidecar on a draft PR; **do not publish or merge** on the basis of Node tests.
