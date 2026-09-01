# Estate deep scan: Pipeline News → GridAtlas map computation

Generated: 2026-09-01T18:44:26.054Z

This is screening evidence. Only findings labelled `proved-*` are established defects.

## Repository history

- **gridatlas:** 266 commits; 248 stamped; 353 tracked files; 12 current files ≥800 lines.
- **pipelinenews:** 374 commits; 207 stamped; 2531 tracked files; 62 current files ≥800 lines.
- **data-grid-gb:** 10 commits; 6 stamped; 22 tracked files; 0 current files ≥800 lines.
- **cvaa:** 31 commits; 14 stamped; 50 tracked files; 0 current files ≥800 lines.
- **spiders:** 58 commits; 1 stamped; 52 tracked files; 0 current files ≥800 lines.

## Deep-link contract

- Produced: capacity_mw, county, latitude, longitude, project, q, repd_ref, sort, status, tbm, technology, zoom
- Consumed: capacity_mw, latitude, longitude, project, repd_ref, technology
- Produced but not consumed: county, q, sort, status, tbm, zoom

## Findings

- **P1 · proved-static: GridAtlas current file is 4876 lines** — Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.
  - `gridatlas:atlas/parts/202609012045-sld-sandbox-body.js:1` — monolith
- **P1 · proved-static: GridAtlas current file is 5145 lines** — Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.
  - `gridatlas:atlas/cartridges/202609012045-sld-sandbox-v9-8.js:1` — monolith
- **P1 · proved-static: GridAtlas current file is 5152 lines** — Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.
  - `gridatlas:atlas/cartridges/202609012110-sld-sandbox-v9-8.js:1` — monolith
- **P1 · proved-static: GridAtlas current file is 5154 lines** — Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.
  - `gridatlas:atlas/cartridges/202609012130-sld-sandbox-v9-8.js:1` — monolith
- **P1 · proved-static: GridAtlas current file is 5166 lines** — Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.
  - `gridatlas:atlas/cartridges/202609012155-sld-sandbox-v9-8.js:1` — monolith
- **P1 · proved-static: gridatlas has 2 scheduled write workflow(s)** — Review each mutation boundary for deterministic inputs, ceilings, proofs and owned rollback.
  - `gridatlas:.github/workflows/202608310015-gridatlas-overnight-next-versions.yml:17` — contents: write
  - `gridatlas:.github/workflows/202608310050-gridatlas-next-version-builders.yml:20` — contents: write
- **P1 · proved-static: gridatlas workflows use 3 mutable action reference(s)** — Pin third-party actions to reviewed commit SHAs; the full evidence remains in JSON.
  - `gridatlas:.github/workflows/202608312212-cartridge-proof.yml:59` — uses: actions/checkout@v4
  - `gridatlas:.github/workflows/202608312212-cartridge-proof.yml:65` — uses: actions/checkout@v4
  - `gridatlas:.github/workflows/202608312212-cartridge-proof.yml:71` — uses: actions/setup-node@v4
- **P1 · proved-static: pipelinenews has 3 scheduled write workflow(s)** — Review each mutation boundary for deterministic inputs, ceilings, proofs and owned rollback.
  - `pipelinenews:.github/workflows/202608300232-sync-atlas-v9-deep-links.yml:15` — contents: write
  - `pipelinenews:.github/workflows/202608300309-current-gridatlas-v9-deep-link-successor.yml:18` — contents: write
  - `pipelinenews:.github/workflows/202608300522-resume-exact-atlas-pages-promotion.yml:14` — contents: write
- **P1 · proved-static: pipelinenews workflows use 123 mutable action reference(s)** — Pin third-party actions to reviewed commit SHAs; the full evidence remains in JSON.
  - `pipelinenews:.github/workflows/202608270844-live-news-discovery.yml:50` — uses: actions/checkout@v5
  - `pipelinenews:.github/workflows/202608270844-live-news-discovery.yml:56` — uses: actions/setup-node@v5
  - `pipelinenews:.github/workflows/202608270844-live-news-discovery.yml:388` — uses: actions/upload-artifact@v4
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/202609012105-parts-integrity.proof.mjs:88` — [skip]
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/202609012150-all-versions.proof.mjs:252` — skip
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/modules/202609012010-grid-scope.proof.mjs:82` — skipped
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/modules/202609012040-grid-scope.proof.mjs:82` — skipped
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/modules/202609012145-network-topology.proof.mjs:189` — [skip]
- **P1 · screening: Proof or gate contains an optional/skip path** — Inspect whether the skipped input is authoritative for the claim being made.
  - `gridatlas:tools/proofs/run-current.mjs:10` — skip

## Map-click engineering order

1. Keep immediate project identity and declared connection evidence independent of network fetch.
2. Require a recognised, pinned data-grid-gb schema; missing authoritative bytes fail the proof.
3. Select topology and fault current only by explicit declared connection voltage.
4. Render existing circuits separately from planned changes; carry nulls and reconciliation gaps.
5. Keep R/X/B as published parameters until a separately validated load-flow model exists.
6. Extract the next feature as a timestamped module; never enlarge the 4,000-line sandbox.

