# 202608310050 GridAtlas next-version builders

A second, isolated overnight campaign. It complements — and never edits — `orchestration/202608310015-gridatlas-overnight-next-versions/`.

The existing campaign remains the observer and composition-snapshot controller. This campaign performs bounded candidate work from the completed `_build-plan`:

1. N1 stable-route PipelineNews and Companies producer candidates, plus real public Chromium proofs for REPD `13599` and `17494`;
2. N2 static exact-REPD reference index, hash-pinned to the official 11,069-row Parquet;
3. N3 measured CVAA findings against the reviewed pinned registry, without guessing or installing a baseline;
4. N4 design-freeze calibration over the frozen PipelineNews spine, with fewer than 30 samples recorded as NULL;
5. N5/N6/N11 source-card, window-intelligence and PMTiles readiness packs;
6. a timestamped handover index.

## Source gate

No build may start until all conditions are true:

- at least one hour has elapsed since `202608310015`;
- the best `_build-plan` visible on any fetched branch contains at least 43,000 words;
- `NEXT-VERSION.md`, `summary.md`, `window-intelligence.md`, `questions.md`, and all four referenced files under `DRAFT-CARTRIDGES/` are present;
- the source ref and SHA are frozen in each output folder before work starts.

Workflow dispatch cannot bypass these conditions.

## Isolation law

Every run writes one new folder under:

`202608310050-gridatlas-next-version-builders/outputs/<timestamp>-<stage>-gridatlas-run-<run-id>/`

The workflow refuses changes to `_build-plan/`, the immutable shell, `atlas/current.json`, `state/live-set.json`, `releases/current-v5.json`, PipelineNews or Companies. It never promotes a pointer and never creates a full application copy. A failed proof is committed as evidence and the same stage retries later.

Scheduled runs are offset from the observer at 01:07/01:37 BST and every 30 minutes thereafter, with a hard not-before time of 01:15 BST. A successful stage dispatches the next bounded stage; the schedule is the fallback.
