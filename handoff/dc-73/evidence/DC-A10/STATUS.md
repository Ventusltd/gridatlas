# DC programme status (issue #73), maintained by DC-A10

Last sweep: 2026-10-29 20:34 UTC (sweep 4). Next sweep about 20:48 UTC.
Sweep 4: no lane changes except A7 (polls 3-4, still 203 sites). No GridAtlas PR yet. #73 has 2 comments, both from Claude; ChatGPT has not posted. DC-A2 has no report and an empty evidence dir.
Note: lane reports carry their own clock times (some say 20:35 or 20:40). The times here are the sandbox `date -u`.

## Steps
| # | Step | Lane(s) | Status | PR |
|---|---|---|---|---|
| 1 | Source survey | A1 NESO (done), A3 gov (done), A4 OSM/Wikidata (done), A5 DNO (done), A9 aggregates (done), A10 synthesis | **research done**; synthesis in progress | none |
| 2 | Pipeline fetcher | A1 `fetch_neso.py`, A3 `gov_sites.py`, A4 `dc_a4.py`, A5 `dno_fetch.py`, A8 scaffold | **written; self-tests pass; live runs all blocked (403)** | data-grid-gb #2 (draft) |
| 3 | Schema | A7 `dc_pipeline.schema.json` + `dcschema.py` | done, with 42 tests passing | none |
| 4 | De-duplication | A7 `dcmerge.py`; A4 OSM-level merge | **merged A3+A4(+A5 empty)**: 205 inputs to 203 sites (180 operational, 12 announced, 4 consented, 6 in planning, 1 unknown); IT load known for 3 (1,092 MW = QuestPit 720 + Wapseys Wood 300 + Manor Farm 72; this checks), grid known for 1 (140 MW), unclassified 9; 45 tests | vendored in data-grid-gb #2 |
| 5 | Conventional power assets | A6 `build_conventional.py` | **built**: 301 features, deterministic; DUKES 5.11 not fetched (blocked) | none (A8 scaffold has `conventional/`) |
| 6 | Repository and CI | A8 (data-grid-gb) | **draft PR open**; CI test (bare) and test (requirements) are green | https://github.com/Ventusltd/data-grid-gb/pull/2 |
| 7 | GridAtlas DC category | B1 builder, B2 spec (done) | in progress: dev module built; suite 29/29 (dev), live 19/19 | none yet |
| 8 | Grid Engine 30/30/30 | B1, B3 feasibility (done) | in progress: `06b-dc-engine.js`; nearest-30 checked against an independent haversine | none yet |
| 9 | Tests and review | none yet | not started | none |
| 10 | Release | owner acceptance gate | not started | none |

## PRs
- Progress comment 1 of 2: https://github.com/Ventusltd/gridatlas/issues/73#issuecomment-6507343210
- https://github.com/Ventusltd/data-grid-gb/pull/2 is a DRAFT: pipeline and conventional-assets scaffold, step 6. CI is green on both legs.
- https://github.com/Ventusltd/data-grid-gb/pull/1 is a DRAFT about the licence (Apache-2.0 + NOTICE). The main branch has no LICENSE until this merges.
- GridAtlas: no PR yet for #73. B1 branch `claude/dc-b1-datacentre-303030`.

## #73 comments
1 comment as of 20:16 UTC: **Claude · step 6** (A8, 20:08Z, links data-grid-gb #2). ChatGPT has not posted, so there is nothing to cross-check yet.

## Headline facts (sweep 2)
- **No fully open site-level register of data-centre demand exists**, at NESO or at any DNO. NESO (FOI/25/174): "We do not currently have a register of demand connections." Pipeline sites can come only from OSM, Wikidata, gov.uk (AIGZ, s35 directions, recovered appeals), PINS infrastructure-project, and ECR name candidates.
- NESO aggregates: FOI/26/199 gives 163 transmission DC projects, 62.7 GW (grid connection, as at 30 Sep 2026). Ofgem via FOI/26/183 gives about 315 DC projects and about 73 GW (all queue). These differ in scope; they do not conflict.
- **Every live fetch is blocked by the sandbox proxy.** No raw snapshot or SHA-256 exists for any DC source, and all counts from live data are UNKNOWN, not zero. The fetchers must run on GitHub Actions (data-grid-gb #2 has a `workflow_dispatch` fetch).
- A3: 27 gov records, of which 5 are AIGZ. Not one AIGZ figure is labelled as IT load or as connection. The s35 directions state IT load: Wapseys Wood c.300 MW (granted 16 Mar 2026, confirmed by A10 from the direction PDF), QuestPit Bedford c.720 MW (15 Jun 2026), and **Ebbsfleet AI campus, New Barn Road, Dartford**. The Ebbsfleet direction was given on 1 Jul 2026 to applicant CSE52 Ltd, for "up to 300MW total power load" and "up to 240MW IT load" (https://assets.publishing.service.gov.uk/media/6a44f717065c5aec12a4e4e7/Direction_Granted.pdf, OGL). It is **missing from A3's gov_sites.json**, so A7 should add it. It is also the clearest worked example that IT load and power load are different numbers: the ratio is 1.25.

## Cross-lane findings to carry
- A4: ot_filter merges OSM data centres into NAEI sites within 500 m without checking the operator. Step 7 should use the pipeline grouping. A4 also found 8 NAEI-only DC sites, which A7 should add.
- A6: a **bug in live offtakers**. OT-B-0823 Marchwood is drawn as biomass but is a CCGT (GPPD gas, 842 MW). The fix belongs in OT-filter `power_subclass`.
- A6: 167 conventional sites have no stated fuel. DUKES 5.11 would resolve most of them, but it is blocked.
- B2/B3: `nearestSubstations` is hard-capped at 5 within 40 km. Use `gridScope.scope(..., {nearestCount:30})`, whose first 5 match for 2,499 of 2,499 origins.

## Disagreements and corrections
| # | Between | Issue | A10 view |
|---|---|---|---|
| D1 | A5 vs A10 | A5 marks the **NGED ECR** "Yes (OGL-derived)". The NGED ECR dataset page lists its licence as **"NGED Shared Data Licence"**, and A5 itself says that licence is not open. | **Unverified / probably no** until the licence text is read. Keep it out of the default fetch. |
| D2 | B2 vs B3 | Conventional list: B2 used a 40 km cap; B3 proposed uncapped. | **RESOLVED** (lead decision, B1 20:13): always list 30, draw lines only to 100 km, with the card saying "Lines drawn for n of 30". |
| D5 | B1 vs #73 step 7 | B1 builds the category from DC-A4 (OSM only, 178 DCs). Step 7 says "built from the pipeline (not only OpenStreetMap)". A7's merged pipeline has 203 sites, including 25 gov pipeline sites with status and MW basis. | B1 should load the A7 output, or the PR should state the gap. Open question O7. |
| D6 | A7 vs A1/A6/A8/A10 | A7 marks the NESO Open Data Licence "unverified". The others mark it "yes, owner to confirm". | Not a real conflict: A8's verify blocks NESO output from `main` until the owner confirms. Use one label, "yes (owner to confirm)". |
| D7 | A3 vs A10 | The Ebbsfleet s35 direction (1 Jul 2026, 240 MW IT, 300 MW power load) is missing from gov_sites.json. | A3 or A7 should add it. |
| D3 | A8 sources.json vs A1/A5/A10 | `dno-ecr` "demand >= 1 MW" is wrong: the ECR holds generation, storage and DSR ≥50 kW. `neso-connections` "demand rows" is wrong: TEC has no demand. `planning-data-gov-uk` is "unverified", but A10 quoted OGL v3.0, and the dataset has 0 records. | A8 should update from SOURCE-SURVEY.md. |
| D4 | ENWL | A5 quotes the portal default as CC BY 4.0, but the queue and ECR need registration. Opennetzero shows "Licence unknown". | Unverified; login-gated. |

## Open questions
1. The Covenant's 6 GW: IT load or grid connection? Government has not said. The DSIT annex measures in IT load. The schema keeps both fields.
2. Is the NESO Open Licence (OGL v3-based with amendments, revisable without notice) acceptable? A10, A1 and A6 all say yes, owner to confirm.
3. Does the Open Parliament Licence (DCU0081) count?
4. Egress: data-grid-gb #2's `workflow_dispatch` fetch is the route. Can a GitHub runner reach api.neso.energy, gov.uk assets and the DNO portals? Unverified.
5. Conventional list cap (D2): resolved.
7. Should step 7 use the A7 pipeline instead of A4's OSM-only set (D5)?
8. B1's dev offtakers module is 70,423 B against a 40,000 B budget (lightning's is 64,781). Owner to decide.
9. B1 found that A4's DC-OW-0075 "Digital Realty LHR26" merges in Global Technical Realty, which is a different operator. A4/A7 to split it.
6. NESO EA register: its licence is unknown. Ask NESO.

## Source licences (running; final version in SOURCE-SURVEY.md)
| Source | Licence (quoted) | Fully open | DC site data? |
|---|---|---|---|
| NESO TEC register / Embedded Register | NESO Open Data Licence, OGL v3-based | yes (owner to confirm) | no; generation, storage and interconnectors only |
| NESO EA register | none found | unverified | some "Data Centre" demand names; incomplete |
| NESO FOIs / CFI / Gate 2 results | none stated | unverified | aggregates only |
| SSEN ECR + heat maps | "Creative Commons Attribution 4.0 [Open Data]" | yes | ECR name candidates only |
| NGED ECR | "NGED Shared Data Licence" | **unverified (likely no)** | name candidates |
| NGED CRR / Clearview / reform outcomes | "NGED Open Data Licence" (OGL-derived, 2020 text) | yes (current text unverified) | no demand type |
| UKPN DC datasets | per dataset; login needed | unverified / no | anonymised |
| NPg | NPg Open Data Licence v1.0 (text unread) | unverified | name candidates |
| ENWL / SPEN | CC BY 4.0 default (ENWL); SPEN none named; both login-gated | unverified / no | no |
| planning.data.gov.uk planning-application | OGL v3.0 | yes | no; 0 records |
| planning.data.gov.uk infrastructure-project (PINS) | OGL v3.0 | yes | 293 NSIPs; whether DCs are present is unverified |
| Local planning portals | portal terms | no | evidence links only |
| GOV.UK (AIGZ, s35 directions, appeals, Covenant) | OGL v3.0 | yes | yes; 27 records (A3) |
| gov.scot / gov.wales | OGL v3.0 | yes | Scottish directions |
| Local / combined-authority pages | no OGL statement | no | excluded |
| OpenStreetMap | ODbL 1.0 | yes, with attribution | yes; 190 sites (legacy snapshot) |
| Wikidata | CC0 | yes | sparse; not fetched |
| Company disclosures / trade press | copyright | no | cite only |
| DUKES 5.11 (May 2026) | OGL v3.0 | yes | conventional; not fetched |
| WRI GPPD v1.3.0 | CC BY 4.0 | yes (unmaintained) | conventional MW, about 2018-19 |
| NAEI 2023 | OGL | yes | 31 DC sites; conventional base |
| DESNZ DC regional consumption | OGL v3.0 | yes | aggregates |
| OSUKED powerdict | none | no | rejected |
| Zenodo 10866260 primary substations | CC BY 4.0 (upstream DNO licences unchecked) | unverified | headroom context |
