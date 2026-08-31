# 202608310446 GridAtlas overnight study

- Programme: `202608310015-gridatlas-overnight-next-versions`
- Observed: `2026-08-31T03:46:27.394Z`
- Source fingerprint: `9f699c189a90256b5edcee379495a0ced6e554c9e07e2f84618e0513e3ecf0d3`
- Study elapsed: **14750s / 3600s**
- Earliest build: `2026-08-31T00:40:36.640Z`
- Visible unique corpus: **23,622 words** across **47 unique text blobs**
- 43k expectation: **ADDITIONAL_ARTIFACTS_EXPECTED**
- New valid composition: **none yet**

## Branch tips inspected

- `origin/automation/202608310043-gridatlas-hard-scope-gate` — `f5c6ec14cb7d` — 2026-08-31T00:43:08+01:00 — 202608310043-gridatlas: require complete 43k corpus before candidate build
- `origin/main` — `71365bb857e2` — 2026-08-31T01:37:11Z — 202608310237-gridatlas: record overnight study observation

## Corpus by kind

| Kind | Files | Words | Bytes |
|---|---:|---:|---:|
| app | 1 | 533 | 5223 |
| artifact | 3 | 1501 | 16440 |
| cartridge | 7 | 6254 | 65721 |
| compiler | 15 | 9347 | 95304 |
| document | 4 | 1295 | 10472 |
| manifest | 3 | 387 | 8305 |
| scope | 8 | 1202 | 9695 |
| state | 3 | 259 | 3349 |
| test | 2 | 1693 | 16753 |
| workflow | 1 | 1151 | 12398 |

## High-signal directives

- **origin/main:.github/workflows/202608310050-gridatlas-next-version-builders.yml** — if: always() && steps.plan.outputs.output_dir != ''
- **origin/main:.github/workflows/202608310050-gridatlas-next-version-builders.yml** — if: always() && steps.plan.outputs.output_dir != '' && steps.finalise.outcome == 'success' && steps.boundary.outcome == 'success'
- **origin/main:202608310050-gridatlas-next-version-builders/202608310050-source-gate.md** — Required files beyond the attached sample set:
- **origin/main:202608310050-gridatlas-next-version-builders/README.md** — A second, isolated overnight campaign. It complements — and never edits — `orchestration/202608310015-gridatlas-overnight-next-versions/`.
- **origin/main:202608310050-gridatlas-next-version-builders/README.md** — The workflow refuses changes to `_build-plan/`, the immutable shell, `atlas/current.json`, `state/live-set.json`, `releases/current-v5.json`, PipelineNews or Companies. It never promotes a pointer and never creates a full application copy. A failed proof is committed as evidence and the same stage retries later.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — Required N1 proof:
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — The index must be hash-pinned to `data/repd_projects_202608290716.parquet`, whose expected SHA-256 is `174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b`. It is data, not a full app. Cartridge installation remains blocked until the reviewed anchored patch and spec arrive under `DRAFT-CARTRIDGES/`.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — - Static exact-ref lookup must work on constrained devices without starting DuckDB.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — The immutable shell has four script slots: the bridge is taken, search is taken, the engine is forbidden, and the pre-snapped config adapter is the one remaining slot. A future window-intelligence cartridge must be composite and reproduce `snap: false` for 400/275/220/132/66 kV before adding any layer. It must insert the Funding Window group first so it is visible on iPad portrait without scrolling. Failure of its data or manifest must add zero window layers while leaving the core map unchanged.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — - C5 Companies candidate search Parquet; never draw it.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — - C12 GB electricity HUD, must carry as-of/stale state.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — CVAA has 24 vaccines and a reusable pinned workflow, but no consumer repository directly calls it. GridAtlas re-implements some antibodies inline. Adoption must be pinned to reviewed commit `d2ebc01f6eab41f2a84b0c53c4cfae0d2625ec5e`, measure actual findings first, then create a short-dated ratchet baseline. Do not install predicted maxima as if measured. Adding an inoculate workflow requires updating GridAtlas `ACTIVE_WORKFLOWS` in the same commit.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — This is dependency-free arithmetic over the frozen 7,680-project PipelineNews spine. For projects with both planning permission and construction dates, compute `under_construction - planning_permission_granted`, then median by technology and capacity band. A cell with fewer than 30 samples is NULL, not guessed. The estimate remains derived and must publish sample size.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — The shipped product calls postcodes.io and Nominatim without source cards. REPD's card is still unstudied. Needed cards also include PlanIt, planning.data.gov.uk, The Gazette, LCCC, Companies House bulk and Companies House REST. A draft card is not approval: licence, attribution, rate limits, allowed use and last-checked date must be reviewed before a source becomes declared truth.
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — ## Required missing artefacts
- **origin/main:202608310050-gridatlas-next-version-builders/inputs/202608310015-attached-sample-findings.md** — Later stages must block rather than infer these files.
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — """Build isolated N1 candidate files. Never writes into producer repositories."""
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — parser.add_argument("--output", required=True, type=Path)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — parser.add_argument("--generation", required=True)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — parser.add_argument("--pipelinenews", required=True, type=Path)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — parser.add_argument("--companies", required=True, type=Path)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-n1-deep-link-candidates.py** — parser.add_argument("--gridatlas-current", required=True, type=Path)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — if (!fs.existsSync(source)) throw new Error(`required build-plan file missing: ${relative}`);
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — ['postcodes_io', 'postcodes.io', 'live geocoder; rate, attribution and browser-use constraints must be verified'],
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — ['nominatim', 'Nominatim / OpenStreetMap', 'live explicit geocoder; rate and attribution policy must be verified'],
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — ['repd', 'DESNZ REPD', 'frozen project spine; licence and attribution must be completed'],
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — rule: 'No card may leave draft until licence, attribution, access, rate and last-checked fields are externally verified.'
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — const required = [
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-readiness.mjs** — const files = required.map(relative => copy(relative, 'frozen-inputs'));
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-repd-ref-index.py** — parser.add_argument("--parquet", required=True, type=Path)
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-build-repd-ref-index.py** — "rule": "Do not infer or rewrite the anchored search-cartridge patch when the reviewed draft is absent.",
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-calibrate-design-freeze.py** — "recovery_rule": "Never overwrite this calibration; create a later Europe/London timestamped successor.",
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-finalise-stage.mjs** — if (!outputDir || !fs.existsSync(outputDir)) throw new Error('OUTPUT_DIR is required');
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-finalise-stage.mjs** — if (!stage) throw new Error('STAGE is required');
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-prove-federated-deep-links.mjs** — if (!outputDir || !fs.existsSync(outputDir)) throw new Error('output directory is required');
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-select-build-plan.mjs** — const missing = REQUIRED.filter(relative => !fs.existsSync(path.join(plan, relative)));
- **origin/main:202608310050-gridatlas-next-version-builders/tools/202608310050-select-build-plan.mjs** — required_files: REQUIRED, missing: selected.missing,
- **origin/main:atlas/cartridges/202608301136-place-postcode-search.js** — // ---- 202608301136 UK gazetteer lane (LOCATION_ONLY, never claims REPD identity) ----
- **origin/main:atlas/manifests/202608301522-composition.json** — "acceptance": {
- **origin/main:atlas/manifests/202608301624-composition.json** — "golden_browser_verification": "REQUIRED"
- **origin/main:atlas/manifests/202608301825-composition.json** — "golden_browser_verification": "REQUIRED",
- **origin/main:atman/verify_streaming_roads.mjs** — if (!url || !expectedGeneration) throw new Error('GRIDATLAS_URL and EXPECTED_GENERATION are required');
- **origin/main:docs/milestones/202608300305-atlas-v9-federated-deep-links.md** — Execution rule: GitHub Actions performs builds, comparisons, publication and pointer movement. Human/AI work is restricted to contracts, gates and bounded repairs.
- **origin/main:docs/milestones/202608300305-atlas-v9-federated-deep-links.md** — - no full PipelineNews rebuild is required for pointer movement.
- **origin/main:docs/milestones/202608300305-atlas-v9-federated-deep-links.md** — - do not add URLs, names or descriptive data to relationship rows;
- **origin/main:docs/milestones/202608300305-atlas-v9-federated-deep-links.md** — - never roll a data or application pointer forward from a red gate.
- **origin/main:governance/202608300232-cross-repo-atlas-v9-milestones.md** — - `name`, `longitude`, `latitude`: optional display/fallback evidence only; never identity.
- **origin/main:governance/202608300232-cross-repo-atlas-v9-milestones.md** — A consumer must use the promoted `state/live-set.json` pointer and must not hard-code a mutable candidate.
- **origin/main:governance/202608300232-cross-repo-atlas-v9-milestones.md** — - Use Parquet ZSTD and DuckDB validation; never store Companies House bulk dumps.
- **origin/main:governance/202608300232-cross-repo-atlas-v9-milestones.md** — Any red gate leaves the previous current pointers unchanged. Recovery is always the last-known-green timestamped release.
- **origin/main:scope-of-works/202608301321-01-move-atlas-into-atlas-folder.md** — ## Acceptance
- **origin/main:scope-of-works/202608301321-scope-of-works.md** — 6. Failed gates do not advance the scope. The last known green shell remains available.
- **origin/main:scope-of-works/202608301321-scope-of-works.md** — 2. Replace the temporary redirect with one stable modular Atlas loader: immutable shell plus ordered SHA-256 cartridges. Do not duplicate the application.
- **origin/main:scope-of-works/202608301321-scope-of-works.md** — ## Out of scope
- **origin/main:scope-of-works/202608301518-02-modularise-immutable-shell-and-cartridges.md** — - Define ordered cartridges in `atlas/current.json`; an empty order must reproduce the shell.
- **origin/main:scope-of-works/202608301520-03-apply-pipelinenews-lessons.md** — - Preserve the archived one-off workflows as evidence; do not reactivate them.
- **origin/main:scope-of-works/202608301521-04-add-uk-location-search-cartridge.md** — - Location results are `LOCATION_ONLY`, never set `repd_ref`, and remove a stale `repd_ref` on selection.
- **origin/main:scope-of-works/202608301525-closure.md** — All six bounded scopes are complete. The loop schedule is retired. The immutable shell remains `202608300453-atlas-v9`; future application changes must be SHA-256 cartridges ordered by `atlas/current.json`, not copied application folders.
- **origin/main:state/v9-5-request.json** — "goal": "REPD-first search plus fly-to for any address, town, postcode or global place",
- **origin/main:state/v9-5-request.json** — "acceptance": [
- **origin/main:tools/v9_5/build_streaming_bridge.py** — acceptance = copy.deepcopy(new_manifest.get("acceptance", {}))
- **origin/main:tools/v9_5/build_streaming_bridge.py** — acceptance.update({
- **origin/main:tools/v9_5/build_streaming_bridge.py** — new_manifest["acceptance"] = acceptance
- **origin/main:tools/v9_5/build_v9_5.py** — raise RuntimeError("request version must be v9.5")
- **origin/main:tools/v9_5/release_stream_payload_cache.py** — manifest.setdefault("acceptance", {})["bridge_payload_cache_released_after_serialisation"] = True

## Candidate rule

The one-hour study gate is mature. A new source fingerprint may now produce a new candidate folder.

