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


## 27 October 2026 ~02:27 UTC — independent source-freshness hardening (ChatGPT)

**Branch:** \`feature/lightning-grid-explorer-20261027\`, draft [GridAtlas PR #39](https://github.com/Ventusltd/gridatlas/pull/39). Head after changes: \`a4dd29ece31274d5d26afb6642e1b563e75db26b\`. All changes are confined to this draft sidecar, its tests and its own workflow.

**New source-evidence contract:** \`atlas/labs/lightning-grid/feed-contract.mjs\` is independently testable, read-only and fail-closed. It validates genuine EUMETSAT optical feature IDs, UTC timestamps, world-range coordinates and observation kind, quarantines invalid or conflicting duplicate IDs, rejects future/inverted collector query metadata, reports collector-query staleness separately from the latest optical detection, and labels cumulative search coverage **UNKNOWN**. A recent three-hour collector query does NOT mean the last seven days were exhaustively searched; a quiet interval cannot be called zero. A source refresh now clears the old proximity/scenario context before re-fetching, avoiding stale "nearby" answers.

**Executed CI:** [GridAtlas Actions run 40438471593](https://github.com/Ventusltd/gridatlas/actions/runs/40438471593), exact head \`a4dd29ece31274d5d26afb6642e1b563e75db26b\`: **PASS** lab-proof (36/36 static checks + 10/10 synthetic feed-contract tests), **PASS** real-source-contract (live read-only GitHub raw data + pinned engine CDN Git blob SHA/CORS, real geodesy, actual MAP link). The separate file-size guard was in progress at the time of this report; inspect its final run before sign-off.

**Actual live source at CI time:** 408/408 accepted optical flash records, latest detection **2026-10-25T11:15:58.149Z**, latest collector query end **2026-10-27T00:27:07.304Z**. These are DIFFERENT facts; neither implies seven-day search completeness. Original Atlas has 5,800/5,800 geolocated substation source records; Pipeline News eight solar partitions have 3,558/3,558 eligible identified REPD solar records. The 500 km smoke-test radius is solely for verifying source/link compatibility, not a meaningful proximity or damage alert. No numerical solver ran.

**Separate Claude/independent review lane:** [Testcode PR #4](https://github.com/Ventusltd/testcode/pull/4) challenges **Build G** (generation \`202610270113\`, pinned \`31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c\`) with two new intentionally failing synthetic tests. [Run 40435827525](https://github.com/Ventusltd/testcode/actions/runs/40435827525) confirms **G05 FAIL** (valid-hash day with 2 invalid semantic records shown as EMPTY-COVERED / 100% searched), **G06 FAIL** (missing index SHA-256 + no WebCrypto accepted as READY·DETAIL). The old H01–H08 8/8 and I01–I04 4/4 still pass. **Do not conflate Build G's fail-first RED with this sidecar's CI PASS.** Claude owns repairs in a NEW immutable generation, not changes to published G.

**External main update (not this PR):** [GridAtlas PR #40](https://github.com/Ventusltd/gridatlas/pull/40) was merged to main as \`0fc175f4d5a679671b91822d1eefe0773ee10be7\`, publishing seven additive Build G preview files only. [Pages run 40438370374](https://github.com/Ventusltd/gridatlas/actions/runs/40438370374) succeeded. Independent compare to previous main \`1c19b768\`: seven **added**, zero existing files modified/deleted. \`atlas/current.json\` remains generation **202609241334** (Git blob \`a73cbbf0c4fc22b8967af997b51d9f2fbcdf4536\`). Published Build E \`202610270024\` remains immutable.

**Still BLOCKED:** actual WebKit/iPhone UI and live MAP navigation, owner V1–V15 acceptance, true one-year archive with verified searched coverage, physical overhead-line topology/actual site earthing, and numerical electrical/transient calculations. Do not merge PR #39 or promote any preview on the strength of these tests.
