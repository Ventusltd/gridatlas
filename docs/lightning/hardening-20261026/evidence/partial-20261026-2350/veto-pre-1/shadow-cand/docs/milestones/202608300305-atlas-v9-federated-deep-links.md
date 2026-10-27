# Atlas V9 federated deep-link milestones

Generation: `202608300305`  
Coordinator: `Ventusltd/gridatlas`  
Execution rule: GitHub Actions performs builds, comparisons, publication and pointer movement. Human/AI work is restricted to contracts, gates and bounded repairs.

## Governing invariant

No consumer repository may hard-code an unverified Atlas candidate. Consumers resolve the current receiver from the public Grid Atlas live pointer only when all of the following hold:

- `classification` identifies a verified live Atlas V9 release;
- `verification.promotion_eligible` is `true`;
- `verification.failed_gates` is `0`;
- the immutable release and its manifests are publicly readable;
- a canonical `repd_ref` deep link opens the receiver without route interception or fabricated identity.

The previous current release remains the rollback target until every milestone is green.

## M0 — Repair the comparison harness

Status: **ACTIVE**

Scope:

- preserve the complete V8/V9 render-ready comparator;
- execute desktop and 390 × 844 mobile viewport gates on an installed pinned browser runtime;
- compare V8 oracle, current V9 parent and candidate;
- measure actual MapLibre readiness, not an `[OK]` label;
- retain machine-readable `PROMOTE` / `REJECT` records.

Acceptance:

- comparator process completes;
- source `src-400` reports loaded;
- layer `l-400` is visible;
- rendered feature count is greater than zero;
- no product threshold is weakened.

## M1 — Publish the render-ready Atlas V9 successor

Status: **BLOCKED BY M0**

Candidate: `202608292311-atlas-v9`  
Parent: `202608292126-atlas-v9`  
V8 oracle: `https://globalgrid2050.com/repd_grid_atlasv8/`

Acceptance:

- local and public comparator records both label the release `PROMOTE`;
- desktop and mobile rendered-readiness gates pass;
- CSS and approved V8 surface invariants pass;
- 4,106 400 kV rows are present;
- no eager window prefetch, duplicate fetch or main-thread JSON parse is used for 400 kV;
- immutable release is published and `state/live-set.json` moves atomically;
- `202608292126-atlas-v9` remains a working rollback.

## M2 — Catalogue Atlas V9 on GlobalGrid2050

Status: **BLOCKED BY M1**

Repository: `Ventusltd/globalgrid2050`

Scope:

- add one generated “current verified Atlas V9” catalogue item;
- place it directly after the V8 Atlas / existing immutable V9 entries in `UK Grid Tracking`;
- preserve every historical immutable Atlas link;
- update only after authenticating the Grid Atlas public live pointer.

Acceptance:

- homepage entry order is deterministic;
- public link resolves to the exact promoted release;
- no candidate or failed release is catalogued;
- repeated runs are idempotent.

## M3 — Move PipelineNews deep links to the verified Atlas pointer

Status: **BLOCKED BY M1**

Repository: `Ventusltd/pipelinenews`

Scope:

- retain PipelineNews release bytes and project/news data unchanged;
- generate a small mutable Atlas receiver contract from Grid Atlas `state/live-set.json`;
- build canonical links as `{atlas_base_url}?repd_ref={repd_ref}`;
- prove golden REPD reference `16135` in a real browser;
- prohibit project-name or coordinate matching as an identity substitute.

Acceptance:

- pointer provenance includes Atlas release, publication commit and proof hashes;
- golden deep link resolves without route interception;
- rollback keeps the last-known-green PipelineNews receiver contract;
- no full PipelineNews rebuild is required for pointer movement.

## M4 — Expose Companies relationships through the same Atlas contract

Status: **BLOCKED BY M1**

Repository: `Ventusltd/companies`

Scope:

- preserve key-only Parquet tables: `company_number`, `repd_ref`, `evidence_type`;
- do not add URLs, names or descriptive data to relationship rows;
- publish only one compact Atlas link-template contract;
- join `repd_ref` to the template at read time.

Acceptance:

- no raw Companies House data or company master is committed;
- Parquet/DuckDB and privacy boundaries remain unchanged;
- template points only to a verified Atlas release;
- a sample `repd_ref` link is publicly validated;
- previous template is retained for rollback.

## M5 — Federated audit and automatic rollback discipline

Status: **BLOCKED BY M2–M4**

Scope:

- audit Grid Atlas, GlobalGrid2050, PipelineNews and Companies pointers together;
- fail closed on missing manifests, pointer drift, broken deep links or failed render gates;
- emit a compact JSON/JSONL audit suitable for future learning and release scoring;
- never roll a data or application pointer forward from a red gate.

Completion definition:

- all four public surfaces resolve the same Atlas release ID;
- V8 and the previous V9 remain available;
- PipelineNews and Companies canonical `repd_ref` links work;
- GlobalGrid2050 catalogue order is correct;
- every mutation is attributable to a bounded GitHub Actions run.
