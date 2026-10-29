# DC-A8 report (step 6: repository and CI for the data-centre pipeline and conventional assets)

Started 2026-10-29 ~20:00 UTC. Status: decided repo (data-grid-gb); building scaffold in a worktree at evidence/DC-A8/wt.

## ~19:57 UTC (sandbox clock)
- Decision: Ventusltd/data-grid-gb (public; same pin/verify/Actions pattern; already holds NESO+OSM with attribution). Caveat: main has no LICENSE until draft PR #1 (Apache-2.0 + NOTICE) merges.
- Branch datacentres/pipeline-scaffold-20261029 pushed; DRAFT PR https://github.com/Ventusltd/data-grid-gb/pull/2
- Scaffold: assetpipe/ (stdlib), datacentres/ + conventional/ (sources.json, placeholder fetchers, raw/MANIFEST pins, normalised/, NOTICE), ci/verify.py, reproduce.py, pipelines/fetch_assets.py, tests (23; bare + requirements legs), fetch-assets.yml (workflow_dispatch only), test-assets.yml, docs/METHODS.md.
- Local: 23/23 pass with openpyxl; 22 pass + 1 skip in a bare venv; pyflakes clean except an intentional availability import.
- Next: wait for CI; poll evidence/DC-A1..A7 for fetchers and outputs.

## 20:07 UTC
- Lead's request handled: fetch-assets.yml (workflow_dispatch only) now runs every fetcher for real on a runner: native sources (dukes-5-11 snapshot), DC-A1 (only with include_unverified), DC-A3 fetch --verify, DC-A4 Overpass+Wikidata; then offline builds DC-A3, A4, A6, A7; verify + reproduce; commits to fetch/<run id>-<domain> and opens a DRAFT PR with the diff summary. Never main.
- Lanes vendored: datacentres/lanes/{dc-a1-neso,dc-a3-gov,dc-a4-osm-wikidata,dc-a7-merge}, conventional/lanes/dc-a6 (marked path-redirect patch only). Offline baseline committed: A3 27 recs; A4 190 sites (legacy, no --offtakers reconcile); A7 merge; A6 301 sites (sha 44b577a1, identical to evidence).
- A6 large inputs (offtakers, GPPD, REPD) pinned by URL+sha256, fetched from GitHub at run time (all four sha256 match the lane's pins).
- Simulated the workflow locally (network blocked): all fetches fail -> recorded as FAILED/unknown; strict verify blocks A1 output; reproduce identical.
- Commit ced197d pushed to PR #2. 34 tests local.

## 20:09 UTC
- #73 linked: https://github.com/Ventusltd/gridatlas/issues/73#issuecomment-6507164025 (no ChatGPT comments on #73 yet to cross-check).
- Added DC-A5 (dno_fetch.py; lane open=unverified) and DC-A7's updated dcingest.py; commit fd999e9. CI on ced197d green (both legs, no skips: REQUIRE_DEPS/INPUTS=1 on requirements leg).
- Polling lanes every 30 s for script changes until ~21:15 UTC.

## 20:37 UTC
- DC-A2 (dc_planning_fetch.py, OGL v3, open=yes) vendored with its reachable raw snapshots; offline build via --offline; baseline 3 s35 candidates; A7 merge reads it. Commit 4cbe645.
- Bug caught: .gitattributes text=auto eol=lf would rewrite CRLF raw CSVs and break their sha256 pins -> added 'datacentres/** -text' and 'conventional/** -text' (+ test); fresh clone verifies. Commit 76524ce.
- Synthesis note on #73 says NGED ECR is under the "NGED Shared Data Licence" (likely not open); DC-A5 is unverified as a whole, so its outputs are blocked from main anyway.
