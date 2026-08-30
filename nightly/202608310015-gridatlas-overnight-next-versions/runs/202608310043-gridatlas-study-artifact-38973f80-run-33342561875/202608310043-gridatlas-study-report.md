# 202608310043 GridAtlas overnight study

- Programme: `202608310015-gridatlas-overnight-next-versions`
- Observed: `2026-08-30T23:43:33.108Z`
- Source fingerprint: `38973f807fef8673b9b91a43d44d73faec7fee4665b79f6c713312c124ea7ad1`
- Study elapsed: **176s / 3600s**
- Earliest build: `2026-08-31T00:40:36.640Z`
- Visible unique corpus: **15,213 words** across **32 unique text blobs**
- 43k expectation: **ADDITIONAL_ARTIFACTS_EXPECTED**
- New valid composition: **none yet**

## Branch tips inspected

- `origin/automation/202608310043-gridatlas-hard-scope-gate` — `f5c6ec14cb7d` — 2026-08-31T00:43:08+01:00 — 202608310043-gridatlas: require complete 43k corpus before candidate build
- `origin/main` — `1586d0394a14` — 2026-08-31T00:43:25+01:00 — 202608310043-gridatlas: hard-gate candidates on complete 43k corpus

## Corpus by kind

| Kind | Files | Words | Bytes |
|---|---:|---:|---:|
| app | 1 | 533 | 5223 |
| artifact | 2 | 662 | 8845 |
| cartridge | 7 | 6254 | 65721 |
| compiler | 3 | 3009 | 33994 |
| document | 3 | 1214 | 9463 |
| manifest | 3 | 387 | 8305 |
| scope | 8 | 1202 | 9695 |
| state | 3 | 259 | 3349 |
| test | 2 | 1693 | 16753 |

## High-signal directives

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
- **origin/main:tools/v9_5/build_streaming_bridge.py** — parser.add_argument("--generation", required=True)
- **origin/main:tools/v9_5/build_streaming_bridge.py** — acceptance = copy.deepcopy(new_manifest.get("acceptance", {}))
- **origin/main:tools/v9_5/build_streaming_bridge.py** — acceptance.update({
- **origin/main:tools/v9_5/build_streaming_bridge.py** — new_manifest["acceptance"] = acceptance
- **origin/main:tools/v9_5/build_v9_5.py** — raise RuntimeError("request version must be v9.5")
- **origin/main:tools/v9_5/release_stream_payload_cache.py** — manifest.setdefault("acceptance", {})["bridge_payload_cache_released_after_serialisation"] = True

## Candidate rule

No candidate can be built for another 3424 seconds.

