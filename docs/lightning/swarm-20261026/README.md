# Lightning re-integration swarm — evidence pack, 26 October 2026

Status: REVIEW MATERIAL ONLY. Nothing in this folder changes the application. The live composition
(generation 202609241334) is untouched on `main`. Do not merge or deploy anything on the strength of this pack.

## What happened on 26 October 2026 (UTC)
- 16:34 Owner commissioned a multi-agent re-integration of EUMETSAT lightning into the ORIGINAL GridAtlas after rejecting the V5 preview (issue #28, draft PR #29).
- 16:40–19:00 Ten read-only audits ran in parallel (reports/). All ten delivered.
- 19:05 PLAN.md reconciled the audits into one design (smallest additive integration).
- 18:00–19:10 Lightning collector fixes and the one-year archive v2 were built and tested on branch `data-plane/hourly-lookback-index-v2` in Ventusltd/lightning (draft, not merged).
- 19:10–20:15 The single-writer builder produced candidate generation 202610261949 on branch `candidate/202610261949-uk-lightning-additive` (draft, not merged); self-verification in reports/atlas-implant-builder.md and evidence/candidate-screenshots.
- 20:11 Twenty Opus thinkers were asked to consider the owner's See Through proposition (think/THINK-BRIEF.md). Nine memos completed (think/memos/) before the session's usage limit stopped the rest at 20:15.
- 20:15 The two independent phase-four challengers (visual parity on the candidate; regression and hit tests on the candidate) and the final merge-veto review were ALSO stopped by the usage limit before producing results. **The candidate has therefore not yet been independently challenged or vetoed.** Its own verification evidence is here; independent confirmation is the next step.

## Folder map
- PLAN.md — the consolidated technical plan (sections 0–9), binding on the builder.
- BRIEF.md — the shared agent brief, rules, harness notes and known blocked dependencies.
- reports/ — the ten audit reports plus the two builder reports, each with Scope, Method, Findings, Objections, Recommendation, Verdict.
- think/ — the See Through think-tank brief and the nine completed memos (product vision, separate-product architecture, See Through reuse, data-product rollups, electricity precedent, honesty and labelling, time and replay, devil's advocate, public value). Eleven lenses did not complete: Kuiper law for lightning, grid engineering value, rendering performance, EUMETSAT science and terms, licensing, Atlas bridge, cvaa governance, storage economics, descent UX and grammar, roadmap, proofs and testing.
- harness/ — the offline request shim that lets the composition boot in a sandbox without CDN access (MapLibre 3.6.2 and DuckDB-wasm 1.29.0 from npm tarballs, data partitions from a local clone of data-gridatlas, a background-only style). Shim evidence is valid for geometry, counts, hit tests, transport and lightning rendering; NOT for basemap tiles/labels, the DuckDB Parquet lane (its extension host is unreachable) or real-device touch.
- fixtures/ — local test archives built only from the genuine 408 flashes (see fixtures/README.md); broken, missing-shard, no-index, stale and big-count variants for the negative cases. Test data, never served as a product.
- evidence/candidate-screenshots, candidate-verify — the builder's own screenshots (OFF/ON at 1440x900 and 360x740, every fixture variant) and command outputs.
- evidence/visual-parity — the parity harness, its original-vs-preview run (quantifies the owner's complaint) and baseline geometry JSON.
- evidence/regression — baseline proof tables (as-is and under the shim), runner scripts and the candidate protocol.
- evidence/veto — the tamper baseline (sha256 manifest of 31 original files) and the veto checklist evidence.
- evidence/menu-contracts — the 60+3 contract measurements and hit-test scripts.

## Links
- Candidate branch: https://github.com/Ventusltd/gridatlas/tree/candidate/202610261949-uk-lightning-additive
- Candidate report: docs/lightning/CANDIDATE-202610261949.md on that branch
- Lightning data-plane branch: https://github.com/Ventusltd/lightning/tree/data-plane/hourly-lookback-index-v2
- Issue #28 and draft PR #29 (review pack with the nine agent definitions) are unchanged.
