# CI: the pull-request gate

Every pull request runs two jobs from `.github/workflows/pr-file-size-guard.yml`:

| job | what it does |
| --- | --- |
| `size-guard` | fails a PR that adds or grows a file over 5 MB unless it is allowlisted |
| `cartridge-gate` | runs `node tools/ci/pr-gate.mjs --base <PR base sha>` on Node **22.23.4**, pinned exactly |

`cartridge-gate` runs the checks that used to be run by hand before a cut.
It uses only Node built-ins: no `npm ci`, no browser, no network and no
secrets. It takes about 3 seconds after checkout when no overlay suite from
202610282100 on applies, and about 65 seconds when one does (see 7).

## What the gate checks

Every check runs even if an earlier one fails, so a single run reports
everything that is wrong. The job summary shows a table of the results.

1. **lint**: `node tools/scope/loop.mjs lint`. This covers the scope ledger,
   the exact workflow budget, immutable release checksums, cartridge hashes and
   the 500 kB ceiling.
2. **state-parity**: `node tools/scope/loop.mjs state --stdout` must match
   `STATE.md` byte for byte.
3. **generations**: this runs for every generation the PR touches, and for the
   generation that `atlas/current.json` points to.
   - A generation counts as touched when a changed path under `atlas/`
     (excluding `atlas/releases/`) or under `tools/proofs/` carries its
     12-digit stamp, either as a path segment or as a filename prefix.
   - If `atlas/v/<gen>/current.json` exists, every cartridge it orders must
     exist and match its declared SHA-256. This is checked against the served
     LF bytes, the same rule `lib.mjs` uses.
   - Every `tools/proofs/<gen>-*.proof.mjs` is run in its own process.
   - A **new** pinned generation without a proof fails. So does the live
     generation without one. A historical generation that never had a proof
     only gets a note.
4. **run-current**: `node tools/proofs/run-current.mjs`.
5. **verify-compose**: `node tools/scope/verify-compose.mjs`.
6. **loader-registry** and **loader-equivalence** (docs/LIGHTNING-CARTRIDGE.md):
   - `atlas/index.html` and every `atlas/v/<gen>/index.html` must be
     byte-identical to a registered loader (`ATLAS_LOADERS` in
     `tools/scope/lib.mjs`: v1, the composer of every generation up to
     202610290050, and v2, which adds the `after-cartridge` slot) that supports
     every slot type its own `current.json` uses. A pinned route with a
     `current.json` but no `index.html` also fails.
   - A pinned `index.html` that exists at the base may not be changed or
     removed: a generation keeps the loader bytes it was cut with.
   - `atlas/index.html` may change only together with `atlas/current.json`,
     and only to `atlas/v/<live gen>/index.html` (the release of a v2
     generation moves the loader in its release commit).
   - `tools/proofs/loader-equivalence.proof.mjs` runs both loaders in
     `node:vm` over every route: v2 writes byte-for-byte what v1 writes for
     every `replace-script`-only composition, v1 refuses a modular one, and v2
     fails closed on a bad `after-cartridge` entry.
   **lightning-source** (run after loader-equivalence): `node tools/lightning/build.mjs --check`.
   The newest `atlas/modules/*-uk-lightning-overlay.js` must be listed in
   `tools/lightning/generations.json`, and every listed generation must rebuild
   from `tools/lightning/src/` byte for byte. See `docs/LIGHTNING-SOURCE.md`.
   **offtakers-source**: `node tools/offtakers/build.mjs --check`, the same for the
   potential-offtakers overlay (`tools/offtakers/src/`, `docs/OFFTAKERS-SOURCE.md`).
7. **lightning-suites**: every `tools/ci/lightning/*.test.mjs` runs with
   `node --test` against these overlay modules:
   - the live overlay module: the file the live `uk-lightning-overlay`
     cartridge points at, or, for a monolithic generation,
     `atlas/modules/<live sld-sandbox gen>-uk-lightning-overlay.js`;
   - every overlay module the PR adds or edits;
   - the overlay module of every pinned generation the PR adds (for a
     modular generation, the module its `uk-lightning-overlay` cartridge
     points at);
   - the newest pinned overlay module (the candidate), when the PR changes
     `tools/ci/lightning/`, `tools/ci/pr-gate.mjs` or this workflow, so a suite
     edit is proven on the module it guards.

   A suite whose first lines say `// @gate-min-generation <stamp>` runs only
   on modules of that generation or later; the gate prints a note for the
   modules it skips. The suite/module pairs run side by side (up to 4), because
   the time is spent waiting on real timers, not on the CPU.
8. **release-tools**: `node --check` of every `tools/release/*.mjs`, and
   `node --test tools/release/*.test.mjs`, the offline tests of the delivery
   flow's acceptance and PR-classification rules (docs/RELEASE.md). A broken
   release script therefore fails the PR that broke it, not the release that
   needs it.

## The lightning suites

| suite | tests | modules | time | what it guards |
| --- | --- | --- | --- | --- |
| `overlay-latest.test.mjs` | 8 | all | about 1 s | the first ChatGPT findings: OFF at rest, feed revalidation, STALE, coordinate checks, shard integrity, honest 12M and coverage captions |
| `overlay-engine.test.mjs` | 212 (6 need real data; 9 M3 layer tests or 4 M4b tests skip by module) | 202610290246 on | about 75 s | everything below |

`overlay-engine.test.mjs` is the hardening lanes' `test-engine.mjs` as it stood
at Build M2 (202610282100). It is a superset of their `test-fixes.mjs`. The
only changes are mechanical: the module comes from `LIGHTNING_MODULE`, fixtures
come from `tools/ci/lightning/fixtures/`, and two tests were added at the end
(CI1 and CI2, see below). It covers:
- the archive index, shards, parts and grid integrity;
- captions and wording: an optical flash is not a strike, unknown is not zero;
- dots, clusters and ≈10 km cells, and taps on them firing the original
  `nearestSubstations` from the right point;
- the docked card, the camera and layout padding;
- the REPD card: the 10 nearest sites from the real 10,784-row register, with
  co-located parts grouped, duplicates once and ties with the 10th kept;
  the Status and Tech filters; the 10/40 km summary; a row tap that stays in
  the page, with "◀ back"; the 15 s register timeout;
- cleanup on close, period change, LATEST and OFF.

The six `LIGHTNING_DATA` tests need a checkout of `Ventusltd/lightning`
`data/history`. The gate has no network, so they are reported as skipped. Run
them locally with
`LIGHTNING_DATA=<lightning>/data/history LIGHTNING_MODULE=<module> node --test tools/ci/lightning/overlay-engine.test.mjs`.

The suite was RED by design on Build M (202610281950) and earlier, which do not
have the M2 REPD card. Since Build M3 it also carries the M3 layer tests and the
M2 review-fix tests (minimum 202610282215), and since Build M4 the camera tests: a
MapLibre-like `stop()` that fires `moveend` synchronously must never see a camera
call inside it (M2R-taps T1), plus the landscape dock (M2R-camera fix C) and the
M4b dot tests. M3 fails them, so it carries `@gate-min-generation 202610290045`.
The M3 layer tests run on modules that switch layers (M4); the M4b tests run on
M4b modules (`/* M4b:` in the source), where the M3 layer tests skip.
Since Build M5 (202610290246; M5b 202610290247) it also carries the M5 tests: the full REPD record of
each listed project, joined exactly from the pinned `repd_projects_202608290716.parquet` the project
search reads. A DuckDB stand-in answers the module's SQL from the repository's JSON twin of that parquet,
`data/repd_browser_registry_202608290716.json` (SHA-256 c8a5c59b…, pinned by the manifest; no new fixture).
M5 also changes wording on purpose (V-tiers Screening/Record, V-geometry 0.1° cells), so M4 fails the
edited expectations and the suite carries `@gate-min-generation 202610290246`.
Build M6 (202610290314; M6b 202610290315) opens the card by default with the 10-site list first, replaces
the "−" minimise with a "▾ Hide list / ▸ Show 10 sites" toggle and makes record failures a tap-to-retry line
(tests M6-1..M6-3 and 9 intended expectation edits), so M5 fails them and the suite carries
`@gate-min-generation 202610290314`.
When a new build changes a behaviour on purpose, update the affected test in
the same PR and give the reason in the commit. Do not relax an expectation
just to pass.

### Fixtures

| file | SHA-256 | source |
| --- | --- | --- |
| `fixtures/repd-master-v8-oracle.json.gz` | `02d8b135…4aa8` (gzip), `15cc89a7…f61c` (JSON, checked by the suite) | the export of the pinned `repd_master_v8_oracle.parquet` (`a737d00d…416c`) that the browser loads through the parquet bridge as `/dist/repd_master.json`: 10,784 rows. MR's independent DuckDB export has identical geometry and properties, row for row, so one file serves both |
| `fixtures/reference-module-F.js` | `9e81e967…536b` | the build F overlay, the reference for the REST rest-state DOM test |
| `fixtures/mask-30km.txt` | `bf00e721…d7b2` | the 16,800-cell 30 km REPD mask, checked against the module's private copy |
| `minidom.mjs` | `94dc9bc3…df2c` | just enough DOM for the overlay under `node:vm` |

### Mutation run (28 Oct 2026)

Eighteen single-point bugs were applied to the 202610282100 module, one at a
time. They included: the cell tap disabled; "optical flash" captions changed to
"strike"; the dots layer or the neon project layers left behind on OFF; the REPD ranking
reversed; a 30 km radius; a row tap that navigates; a dead "◀ back"; no co-location
grouping; no de-duplication; ties dropped; the 10 km summary counting 40 km;
a broken status filter; cell lon/lat swapped; ON at arrival; no 15 s timeout;
and no cell index guard.

| suite | mutants caught |
| --- | --- |
| `overlay-latest.test.mjs` alone (the gate before this change) | 1 of 18 (only "ON at arrival") |
| `test-engine.mjs` as vendored, before CI1 and CI2 | 16 of 18 |
| `overlay-engine.test.mjs` with CI1 and CI2 | 17 of 18 |

The two that got through the M2 suite were:
- "OFF leaves the dots layer behind". The stub map let a source be removed
  while a layer still used it; MapLibre throws. CI1 and CI2 now enforce
  MapLibre's rule and require zero lightning layers and sources after OFF.
- "the tap-time cell index guard (`c<16800`) is gone". It still gets through.
  The grid parser already refuses such cells, so only a forged rendered
  feature reaches that guard. A test that taps one sends the mutant into a
  runaway allocation that kills the whole suite process, so no test was added.

The mutants and the per-mutant results are in the hardening lane's evidence
(M2R-ci), not in this repository.

## Running it locally

```
git fetch origin main
node tools/ci/pr-gate.mjs                 # diffs the working tree against origin/main
node tools/ci/pr-gate.mjs --base <sha>    # or against any commit
```

The gate diffs the working tree, so uncommitted edits count as touched. The
exit code is 0 only when every check passes.

## Not in the gate, and why

- **Browser proofs** (`*.browser.mjs`, layer clicks, mobile hit-testing) live
  in `202608312212-cartridge-proof.yml`. That workflow needs Chromium, the
  `grid-distance-maths` checkout and the `pipelinenews` checkout. It is
  currently **disabled** in the repository settings.
- **`202609012214-data-contract-parity.proof.mjs`** has 3 known failures that
  predate this gate. Adding it now would make every PR red.
- **`tools/rollback.mjs --dry-run`** checks rollback readiness, not the PR's
  content.

## Workflow budget

`tools/scope/lib.mjs` `ACTIVE_WORKFLOWS` fixes the exact set of workflow files
at nine, and `STATE.md` records that count. The gate was added as a second job
in the one entry that is still enabled, so the budget, `STATE.md` and the
ledger are unchanged. The decision is written down beside that entry in
`lib.mjs`.

## Proof that the gate works

- A draft PR containing this gate ran green.
- A throwaway PR flipped one byte in
  `atlas/cartridges/202610281950-sld-sandbox-v9-8.js` and ran red on
  `composition 202610281950` (SHA-256 mismatch) and on
  `proof 202610281950-sld-sandbox.proof.mjs`. That PR was then closed unmerged.

**offtakers-suites** (after lightning-suites): every `tools/ci/offtakers/*.test.mjs` runs with `node --test` and
`OFFTAKERS_MODULE` set to the live potential-offtakers module, every one the PR adds or edits, the one each pinned
generation the PR adds composes, and the newest one when the PR changes `tools/ci/offtakers/`, `tools/offtakers/` or the gate.
Fixtures: `tools/ci/offtakers/fixtures/` (the three pinned globalgrid2050 files, gzip -9 -n; test P0 checks them against the
module's SHA-256 pins), the lightning REPD register fixture, `data/repd_browser_registry_202608290716.json` and the release's
`grid_substations.geojson`.
