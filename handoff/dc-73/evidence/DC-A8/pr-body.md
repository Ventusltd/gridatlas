GridAtlas issue: Ventusltd/gridatlas#73, step 6 (repository and CI). It also gives steps 2–5 a home.

## Where it lives, and why here
**Recommendation: this repository (`data-grid-gb`).** The alternatives were a new repository, or `lightning` (wrong scope).
- This repository already fetches public GB grid sources, pins them by SHA-256, verifies them fail-closed and refreshes them through Actions. Data centres are new demand on this network, and conventional stations are existing generation on it.
- It already holds NESO and OSM data, with their attribution and share-alike terms recorded.
- It is public. Code is under Apache-2.0, through the open draft **#1**. **`main` has no LICENSE until #1 merges, so #1 should merge first or alongside this.**
- A new repository would need its own licence, CI and consumers for two folders. If that changes later, `datacentres/` and `conventional/` move out as they stand: they share no code with `derived/`.

## What this adds
- `datacentres/` and `conventional/` contain:
  - `sources.json`: URL, publisher, licence, licence URL, and **open: yes/no/unverified**;
  - **placeholder fetchers** for lanes DC-A1..A6;
  - `raw/` with `MANIFEST.json` (sha256 pins);
  - `normalised/<source>.geojson` and `INDEX.json`;
  - `NOTICE`, giving the licence and attribution for each source, with quotes and URLs.
- `assetpipe/` is standard library only. It holds the fetch/pin/normalise code and the schemas. Under those schemas:
  - **IT load MW and grid connection MW are separate fields**, and a bare `mw` field is rejected;
  - unknown is `null`, not zero;
  - no status means "committed";
  - location precision is always stated.
- `ci/verify.py` is in the style of lightning's `ci/verify_data.py` and fails closed. It checks:
  - pins and orphan raw files;
  - that each output comes from an `open: yes` source and carries the registry's licence;
  - the record schema and the honesty sentences;
  - that NOTICE agrees with the registry.
- `reproduce.py check` is in the style of lightning's `reproduce.py`. It runs offline, re-runs every normaliser and requires byte-identical output, and recomputes the headline numbers. It reports IT load and grid connection MW separately and never adds them. It prints a `summary_sha256`.
- `pipelines/fetch_assets.py` provides `list | fetch | normalise`.
- `tests/test_assets.py` and `tests/test_lanes.py` hold 35 tests. They run in two CI legs, `requirements` (openpyxl, and no skips allowed) and `bare` (standard library).
- `.github/workflows/fetch-assets.yml` is **manual (`workflow_dispatch`) only, with no schedule**. Sources update at very different rates (DUKES once a year, WRI frozen since 2021, OSM continuously), and a changed pin should be reviewed by a person. The workflow commits to `fetch/<run id>` and never to `main`.
- `docs/METHODS.md` covers the decision record, layout, schema, de-duplication plan, open rule, and how to reproduce.

## Vendored lanes (second commit)
The #73 lane scripts are vendored as delivered, under `datacentres/lanes/` and `conventional/lanes/`. They are run by `pipelines/run_lanes.py`, and `lanes/MANIFEST.json` pins every committed file.

| lane | role | offline baseline committed here |
|---|---|---|
| DC-A1 `fetch_neso.py` | NESO TEC + Embedded. Records grid connection MW, never IT load | none. Its licence is **unverified** (NESO Open Data Licence, "based on OGL v3 with amendments"), so `ci/verify.py` blocks its outputs on `main` until the owner confirms |
| DC-A2 `dc_planning_fetch.py` | planning.data.gov.uk, PINS NSIP download and LPA open feeds (OGL v3). A keyword match is a candidate only | 3 s35 candidates; the live feeds were unreachable from the sandbox |
| DC-A5 `dno_fetch.py` | DNO ECRs and queues (SSEN CC BY 4.0; NGED and NPg licence text not yet quoted) | none. **Unverified**, so blocked from `main` like DC-A1 |
| DC-A3 `gov_sites.py` | GOV.UK-published sites (AI Growth Zones, s35 directions, recovered appeals) | 27 records, byte-identical to the lane's |
| DC-A4 `dc_a4.py` | OSM (ODbL) + Wikidata (CC0) | 190 sites from the pinned legacy globalgrid2050 snapshot: 178 data centres plus 12 cable landing stations |
| DC-A7 `dcingest.py` | merge: de-duplication, provenance, conflicts | 208 inputs merged into **204 sites**: 180 operational, 12 announced, 7 in planning, 4 consented, 1 unknown. IT load is known for 4 and grid connection for 2; 8 MW figures are unclassified |
| DC-A6 `build_conventional.py` | conventional power assets | **301 sites, 167 with unstated fuel** (DUKES was blocked); sha `44b577a1…`, identical to the lane's |

- DC-A6's large inputs (offtakers, GPPD, REPD) are pinned by URL + sha256 and downloaded from GitHub at run time. All four sha256s match the lane's own pins.
- `dukes-5-11` is a **snapshot-only** native fetcher. It pins DUKES 5.11 (May 2026, OGL) so a parser can be written against the real bytes.
- `reproduce.py check` rebuilds every open lane offline in a scratch copy and requires byte-identical output. The CI requirements leg downloads the pinned inputs and may not skip.

## Manual fetch workflow: where every fetcher runs for real
The sandbox cannot reach gov.uk, api.neso.energy, Overpass or Wikidata. A GitHub runner can. `fetch-assets.yml` runs:
1. the native fetch;
2. the lane fetches, recording failures as **FAILED: unknown, not zero** and keeping the previous snapshot;
3. the offline builds;
4. verify and reproduce.

It then commits to `fetch/<run id>-<domain>` and **opens a draft PR with the diff summary. It never pushes to `main`.** `include_unverified=true` adds DC-A1 (NESO) and marks that PR "DO NOT MERGE".

**How to dispatch, after this PR merges to `main`:**
- Actions → "Fetch the asset sources (manual)" → Run workflow; or
- `gh workflow run fetch-assets.yml --repo Ventusltd/data-grid-gb --ref main -f domain=all -f include_unverified=false`

A PR opened by `GITHUB_TOKEN` does not trigger the test workflow; push a commit or close and reopen it to run the tests. If "Allow GitHub Actions to create pull requests" is off, the run prints a compare link instead.

## Status
- All lanes DC-A1 to DC-A7 are vendored at their final versions. Every lane rebuild is byte-identical, and reproduce gives `summary_sha256` `67b3ccb2…` when the pinned inputs are present.
- `.gitattributes` exempts `datacentres/**` and `conventional/**` from eol conversion. Without that, the CRLF raw CSVs would break their sha256 pins on checkout.
- Licences marked `unverified` (NESO connections, DNO ECRs, planning.data.gov.uk datasets, DSIT pages) stay that way until someone quotes the exact terms.

## Not changed
- `derived/`, `pipelines/fetch_sources.py`, the existing refresh workflow, and the live GridAtlas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JcZ2nJ9f9fgHY3X3JTk4DF
