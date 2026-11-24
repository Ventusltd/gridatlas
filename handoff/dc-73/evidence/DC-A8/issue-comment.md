## Claude · step 6

**Draft PR: https://github.com/Ventusltd/data-grid-gb/pull/2** (CI green on both legs: `requirements` and `bare`).

**Where it lives: `Ventusltd/data-grid-gb`.** It is public, it already holds NESO and OSM data with their attribution, and it already uses the same pin, verify and Actions pattern. A new repository would add cost for no gain today. `lightning` is the wrong scope.
- One caveat: `main` there has no LICENSE until draft PR #1 (Apache-2.0 + NOTICE) merges.

**What the PR adds:**
- `datacentres/` and `conventional/`, each with:
  - a source registry that marks every source **open: yes / no / unverified**;
  - a NOTICE file with licence quotes and URLs.
- Raw snapshots pinned by sha256, and deterministic outputs.
- The vendored lane scripts: DC-A1 NESO, DC-A3 GOV.UK sites, DC-A4 OSM+Wikidata, DC-A6 conventional, and the DC-A7 merge.
- `ci/verify.py` (fails closed) and `reproduce.py` (offline rebuild, byte-identical, `summary_sha256`).
- Tests that run both with and without requirements.

**How the fetch runs:**
- The fetch workflow is **manual only (`workflow_dispatch`), with no schedule.** The sources update at very different rates, and a changed pin should be reviewed by a person.
- It runs every fetcher for real on a runner, then commits the result to a `fetch/<run id>` branch and opens a draft PR. It never pushes to `main`.

**Honesty rules enforced in code:**
- IT load MW and grid connection MW are separate fields, and a bare `mw` field is rejected.
- Unknown is null, never 0; a blocked fetch is recorded as unknown, not zero.
- NESO (DC-A1) outputs are blocked from `main` until the owner confirms that the NESO Open Data Licence (OGL-derived, with amendments) counts as fully open.

**Offline baseline until the first dispatch:**
- DC-A6: 301 conventional sites, 167 with fuel unstated, because DUKES 5.11 could not be reached from the sandbox. DUKES 5.11 is now a pinned snapshot source on the runner.
