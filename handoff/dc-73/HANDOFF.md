# Issue #73 handoff from Claude to ChatGPT (29 Oct 2026, 20:50 UK)

The owner has run out of Claude credit and asked ChatGPT to finish the 10 steps of #73. All Claude agents are stopped. Nothing from this programme is merged, and live is still 202610291044 (v9.186).

## Where things are
- This folder holds every lane's evidence (`evidence/DC-*`) and report (`reports/DC-*.md`), plus the brief (`reports/DC-BRIEF.md`). The rules in the brief still apply: fully open data only; IT load MW never conflated with grid connection MW; unknown is not zero; proximity is not connection or feasibility; pipeline entries are not commitments.
- Two upstream copies were left out to keep this small: DC-A2's `ext/` (a planning.data.gov.uk config clone) and DC-B3's `repd_master.json` (already in the repo).

## Step status
| Step | Lane | State |
|---|---|---|
| NESO | DC-A1 | Done. No open site-level demand register; NESO gives only totals (163 DC projects, 62.7 GW, FOI/26/199). |
| Planning | DC-A2 | Done. planning.data.gov.uk has 0 DC records. 3 NSIP s35 sites: Wapseys Wood, Bedford, Ebbsfleet. |
| Government sites | DC-A3 | Done. 27 sites (AI Growth Zones, s35, appeals, Scotland). |
| OSM/Wikidata | DC-A4 | Done. 178 operational DCs. Known issue: Slough over-merge, and DC-OW-0075 merges Digital Realty with Global Technical Realty. |
| DNO | DC-A5 | Done. No open site-level list. |
| Conventional power | DC-A6 | Done. 301 sites (`out/conventional_power_uk.geojson`, sha256 44b577a1…); 167 with unstated fuel. |
| Merge | DC-A7 | Done. **204 sites** in `evidence/DC-A7/uk_datacentre_pipeline.geojson`; schema-valid and reproducible; 49 tests pass. |
| Pipeline repo | DC-A8 | Branch `datacentres/pipeline-scaffold-20261029` on Ventusltd/data-grid-gb (head 6681265). CI result not yet confirmed. Draft PR opened by the lead. Next: merge it once green, then run its workflow_dispatch fetch workflow so Actions fetches DUKES 5.11, NESO TEC/Embedded, Overpass, Wikidata and planning (the sandbox proxy blocks these). |
| Card spec / engine | DC-B2, DC-B3 | Done (`CARD-SPEC.md`, `ENGINE.md`). |
| Builder | DC-B1 | **Unfinished.** Branch `claude/dc-b1-datacentre-303030` on gridatlas has preview generation 202610292044 (v9.187): the data-centre category, a Grid Engine 30/30/30 (gridScope.scope 30 substations ≤40 km, 30 REPD ≤40 km, 30 conventional listed with lines ≤100 km) and the Marchwood biomass → gas_ccgt fix. 29/29 node tests pass. Not browser-verified. |

## What ChatGPT needs to do
1. On the B1 draft PR, swap the data-centre input from DC-A4's 178 operational sites to DC-A7's 204-site pipeline (all statuses). Keep the IT MW, connection MW and unstated MW fields apart on the card.
2. Fix the Slough and DC-OW-0075 over-merges: never merge records across operators.
3. Raise the offtakers module budget. The dev module is 70,423 B against a 40,000 B limit; this needs the owner's decision.
4. Browser-check a tap (including Slough), parity with live 202610291044 and lightning L3/G regression, then run security (CSV, caps), accessibility/performance and wording reviews.
5. Get CI green and publish the preview (tools/release/publish-preview). The owner posts `ACCEPT <gen>`. Release via docs/RELEASE.md, then the homepage bump and check-served.
6. Merge and dispatch the data-grid-gb fetch workflow (step 8 above).
