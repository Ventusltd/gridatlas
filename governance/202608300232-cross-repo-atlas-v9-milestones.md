# Atlas V9 cross-repository promotion milestones

Inception: 2026-08-30 02:32 Europe/Dublin

## Mission

Promote a timestamped Grid Atlas V9 only when it is demonstrably equivalent to the pinned Atlas V8 product surface, faster at the real MapLibre render boundary, address/postcode capable, and safe for canonical deep links from GlobalGrid2050, PipelineNews and Companies.

## M0 — Frozen evidence baseline

**Repositories**: `Ventusltd/gridatlas`, `Ventusltd/globalgrid2050`, `Ventusltd/pipelinenews`, `Ventusltd/companies`.

**Gate**
- Atlas V8 oracle commit, CSS blob and engine blob are pinned.
- Current V9 and last-known-green rollback are recorded.
- No immutable timestamped release is edited.

## M1 — V8 ↔ V9 render comparator and machine-learning record

**Owner**: `gridatlas` GitHub Actions.

**Deliverables**
- Desktop and 390 px mobile product parity.
- Real 400 kV checkbox-to-MapLibre-render readiness measurement.
- Cold and warm samples against both V8 and the incumbent V9.
- PROMOTE/REJECT JSONL records with provenance, thresholds and failed gates.

**Promotion gate**
- Zero failed parity, integrity, privacy or render-performance gates.
- 4,106 400 kV source rows are loaded and rendered.
- No DuckDB-WASM or Parquet request occurs before critical-layer readiness.

## M2 — GlobalGrid2050 publication in catalogue order

**Owner**: `globalgrid2050` GitHub Actions.

**Deliverables**
- Mirror the exact promoted immutable V9 folder from `gridatlas` into the GlobalGrid2050 Pages tree.
- Place the V9 catalogue entry immediately after the existing Atlas V8 entry.
- Preserve V8 and every timestamped predecessor.

**Promotion gate**
- Source and mirrored SHA-256 manifests agree.
- Public readback succeeds from `globalgrid2050.com`.
- V8 appears before V9 in the homepage DOM.

## M3 — Canonical Atlas deep-link contract

**Owner**: `gridatlas`.

Canonical parameters:
- `repd_ref`: official REPD reference; mandatory for project identity.
- `technology`: one of `solar`, `bess`, `wind_onshore`, `wind_offshore`.
- `name`, `longitude`, `latitude`: optional display/fallback evidence only; never identity.

A consumer must use the promoted `state/live-set.json` pointer and must not hard-code a mutable candidate.

## M4 — PipelineNews integration

**Owner**: `pipelinenews` GitHub Actions.

**Deliverables**
- Poll the promoted Atlas pointer.
- Replace mutable-source V8 bases with the promoted V9 base while retaining query identity.
- Generate and test canonical links for all rows carrying a valid REPD reference.
- Preserve historical immutable releases.

**Gate**
- Beacon Fen REPD 13599 and East Pye REPD 17494 open the correct V9 project.
- No name-only or coordinate-only identity is manufactured.
- Existing counts, filters, exports and mobile layout remain unchanged.

## M5 — Companies integration

**Owner**: `companies` GitHub Actions.

**Deliverables**
- Produce a compact deterministic REPD/company-to-Atlas deep-link relation.
- Add `atlas_v9_url` only where official `repd_ref` and accepted technology exist.
- Use Parquet ZSTD and DuckDB validation; never store Companies House bulk dumps.

**Gate**
- Stable company number, REPD reference, role, evidence and Atlas URL remain relationally joined.
- No personal data is emitted.
- Abstentions are explicit and counted.

## M6 — End-to-end promotion and rollback

**Owner**: repository-local GitHub Actions only.

**Gate sequence**
1. GridAtlas render comparator promotes.
2. GlobalGrid mirror and catalogue readback pass.
3. PipelineNews deep-link sentinels pass.
4. Companies relationship/deep-link audit passes.
5. Cross-repository proof manifest records every commit, run, hash and public URL.

Any red gate leaves the previous current pointers unchanged. Recovery is always the last-known-green timestamped release.