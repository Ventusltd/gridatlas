# Handover to ChatGPT — GridAtlas lightning re-integration, state at 21:55 UTC, 26 October 2026

Written by Claude (swarm lead) for the next model to continue. Everything below is on GitHub; nothing is merged or deployed.

## Read in this order
1. https://github.com/Ventusltd/gridatlas/issues/28 — the owner's STOP condition and acceptance gates.
2. https://github.com/Ventusltd/gridatlas/blob/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/README.md — what happened, what finished, what was interrupted.
3. https://github.com/Ventusltd/gridatlas/blob/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/PLAN.md — the binding design (sections 0–9).
4. https://github.com/Ventusltd/gridatlas/tree/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/reports — the ten audits and two builder reports. Start with atlas-baseline-architect.md, atlas-menu-contracts.md, atlas-transport-auditor.md, atlas-merge-veto.md, lightning-archive-auditor.md.
5. https://github.com/Ventusltd/gridatlas/pull/30 — the candidate (generation 202610261949), with its own report at docs/lightning/CANDIDATE-202610261949.md on that branch.
6. https://github.com/Ventusltd/lightning/pull/2 — the collector and one-year archive v2 (data plane only).
7. https://github.com/Ventusltd/gridatlas/tree/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/think/memos — nine completed See Through memos; the brief for all twenty lenses is think/THINK-BRIEF.md.

## Branches and PRs (all draft, none merged)
- gridatlas `candidate/202610261949-uk-lightning-additive` → PR #30
- gridatlas `review/lightning-swarm-evidence-20261026` → PR #31 (this pack)
- lightning `data-plane/hourly-lookback-index-v2` → PR #2
- Unchanged: gridatlas `main` (c08f3a6, live generation 202609241334), PR #29, lightning PR #1.

## What is proven
- The design: no free slot exists; a new generation of the sld-sandbox cartridge = exact live bytes + newline + one module, previewed at atlas/v/<generation>/ without moving the live pointer; append-last moves 0/63 original controls; prepend (the rejected V5) moved all 63; the original fetch bridge needs zero bytes changed because .json paths pass through and XHR is not hooked; the 60+3 menu contract is exact and fail-closed.
- The candidate's own verification under the offline shim: lint PASS, state parity, exact-delta proof PASS, run-current 4/4, loader byte copy, 31/31 original hashes intact, OFF = {60,3,63,63,true} with 63 proxies and 63 markers, ON by real click = 408 fixture flashes with seven captions, every fixture variant gives its named state.
- The collector had missed ~46% of hours; PR #2 fixes cadence, lookback, coverage recording, byte caps and status.

## What is NOT yet done (next session, in this order)
1. Run the two independent challengers on PR #30 using the pack's runners: evidence/visual-parity/parity-harness.mjs (baseline vs candidate, four viewports, four states, additive selector [data-lightning-group]) and evidence/regression (CANDIDATE-PROTOCOL.md, run-baseline.mjs, lightning-cases.mjs). Their prompts are in the lead's plan; harness notes in BRIEF.md.
2. Have an adversarial reviewer apply the veto checklist V1–V15 in reports/atlas-merge-veto.md and write RELEASE or NO-RELEASE.
3. Rule on the one open design point: the Grid dropdown mirror sits in a footer slot that the original's own `#map-container{overflow:hidden}` clips at 1440×900 and 1280×720 (pre-existing; the original's ⬇ Layers tab is unreachable there too). Options: accept (desktop native panel is open at rest with the group visible), or a head-slot role=checkbox row (would shift the body; measure before choosing).
4. Owner's visual approval on a device, then a SEPARATE release PR that moves atlas/current.json and regenerates STATE.md in one commit (previous_generation 202609241334, composition v9.158, candidate_predecessor 202610221600) — never from these branches.
5. Finish the eleven missing See Through memos if the owner still wants the cosmic product decided: Kuiper law for lightning, grid engineering value, rendering performance, EUMETSAT science and terms, licensing, Atlas bridge, cvaa governance, storage economics, descent UX and grammar, roadmap, proofs and testing. The two completed architecture memos already conclude: separate product, no new repo, no See Through code inside GridAtlas (MapLibre 4.7.1 vs 3.6.2, 156 kB vs 24.8 kB headroom, CERN-OHL-S vs Apache-2.0), linked page instead.

## Sandbox facts the next session will hit
- The build sandbox cannot reach jsdelivr, cartocdn, ventusltd.github.io, extensions.duckdb.org or EUMETSAT. The shim in harness/offline-shim.mjs serves MapLibre and DuckDB from npm tarballs and the data partitions from a local clone of Ventusltd/data-gridatlas; DuckDB's Parquet extension host stays unreachable, so REPD technology layers and search remain BLOCKED_DEPENDENCY locally. WebKit is not installed; iPhone geometry is Chromium emulation, labelled.
- lint and state fail on main today because the rejected preview added a tenth workflow; the candidate deletes it.
