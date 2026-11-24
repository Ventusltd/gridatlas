# DC-A2: planning applications as a data-centre pipeline source

Lane DC-A2 (Team A, data). Issue #73, steps 1 and 2 (planning sources). Written 29 Oct 2026.
Evidence: `hardening/evidence/DC-A2/` (fetcher `dc_planning_fetch.py`, output `out/`, reference clones `ext/`).
No PR (research + python lane). Nothing pushed.

## Bottom line
- **No fully open, national, machine-readable register of GB data-centre planning applications exists today.**
- **planning.data.gov.uk `planning-application`** is OGL v3, but it publishes **0 records**. Its page says "The planning application dataset is incomplete and is not yet ready for use". The spec marks it `phase: alpha`, `environment: staging`. Its pipeline config covers only **4 of ~300+ English LPAs**: Camden 77,739, Worthing 13,727, Adur 7,609 and Doncaster 1,914 lookup entities (digital-land/config `pipeline/planning-application/lookup.csv` @ 43078318).
- **The NSIP route is the only open source with national coverage**, through PINS and planning.data.gov.uk `infrastructure-project`, both OGL v3. Data centres became a prescribed s35 project type in Jan 2026 (Business or Commercial Projects (Amendment) Regulations, made 8 Jan 2026). Entry is opt-in, there is no MW threshold, and the NPS for data centres is unpublished. **Three directions have been granted so far.** Most data centres still go through TCPA local planning, which has no open national feed.
- **MW is almost never in the planning record.** It sits in PDF statements. Even where it is stated, IT load, facility power and grid connection all differ, for example:
  - QuestPit: 720 MW IT load (indicative), 200 MW initial connection, "1GW" headline;
  - Ebbsfleet: 240 MW IT load, 300 MW total power load.

## Source survey (planning)
| Source | Licence (quoted, URL) | Open | Access | DC usefulness |
|---|---|---|---|---|
| planning.data.gov.uk `planning-application` (files.planning.data.gov.uk/dataset/planning-application.{csv,json,geojson,parquet}) | "Licensed under the Open Government Licence v.3.0"; spec `licence: ogl3`. https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | yes | bulk + API; **0 records**; collector last ran 2025-09-17 | none today. Fields when live: reference, description, address-text, point/geometry, planning-application-status, planning-decision, decision-date, start-date, documentation-url, development-classification, ground-area. **No MW or use-class field.** |
| planning.data.gov.uk `infrastructure-project` (PINS NSIPs) | spec `licence: ogl3`, `environment: production`, phase beta | yes | bulk + API; since 2026-10-02 sourced from the PINS endpoints below | NSIP data centres (s35); point + boundary |
| PINS National Infrastructure Consenting: `/api/applications-download` (CSV) and `/projects-map/download-boundaries` | page footer: "All content is available under the Open Government Licence v3.0, except where otherwise stated" | yes | CSV: Project reference, Project name, Application type, Stage, Date of application (+ more) | authoritative NSIP stage; MW only in the project description |
| digital-land `infrastructure-project-collection/data/nsip.csv` (GitHub) | PINS-derived (OGL v3); endpoint **retired 2026-10-02** | yes (stale) | raw.githubusercontent | 233 projects, **0 data centres** (pre-dates s35 DCs) |
| LPA feeds collected by planning.data.gov.uk: Camden (Socrata), Adur, Worthing (CSV), Doncaster (GitHub pilot) | `ogl3` in digital-land config `source.csv` (publisher pages not re-read: **unverified**) | yes (per config) | per-LPA | tiny coverage; Doncaster has decided cases only and no coordinates |
| GOV.UK s35 direction publications (MHCLG) | GOV.UK content OGL v3 | yes | HTML + PDF, not machine-readable | 3 DC directions (Wapseys Wood, Bedford, Ebbsfleet); curated as a seed |
| Scotland: Spatial Hub "Planning Applications" (Improvement Service; spatialdata.gov.scot record 91a4b962…) | metadata: "Open Government Licence", "No limitations on public access"; but the download/WFS needs a free Spatial Hub account and the data.gov.uk mirror says "No Licence Provided" | **unverified** | registration-gated WFS/CSV; daily; all 32 councils (no East Ayrshire polygons) | the best national feed in GB if the licence is confirmed; text search on description |
| Scotland: Ministerial directions / call-ins (gov.scot) | OGL v3 | yes | HTML | DC-A3 holds the Aug 2026 directions |
| Wales: DNS (PEDW) and LPA portals | gov.wales OGL v3 for pages; no national open application dataset found | no dataset | HTML | DNS thresholds are energy-focused; none found for DCs |
| Northern Ireland: Planning Portal NI; OpenDataNI has statistics only | stats OGL; portal not open | no | — | none |
| Idox/Agile/Northgate LPA portals; aggregators (PlanIt, Searchland, Apify scrapers, Plota) | portal terms / commercial | **no** | — | excluded under the owner's rule |

## Finding data-centre applications
- **Description keywords** (implemented, case-insensitive):
  - "data centre/center", "datacentre";
  - "hyperscale";
  - "data hall", "server hall";
  - "data processing facility";
  - "co-location facility";
  - "AI campus/factory/compute";
  - "digital infrastructure campus".
- **Negative guard:** "telecom cabinet", "server room" and "mobile mast" hits are counted as `keyword-ancillary` and excluded.
- **Use classes:** data centres are usually consented as B8 (storage and distribution), sometimes E(g)(iii)/B2, and increasingly sui generis. B8 and E(g) alone are far too broad (warehouses, offices), so use class is only recorded as a supporting flag (`use_classes`), never as a classifier. planning.data.gov.uk has no use-class field; it lives only in free text.
- **Location:**
  - point/WKT from the record (`application point`);
  - the PINS boundary GeoJSON for NSIPs;
  - otherwise `location_precision: none`.
  - Coordinates are never invented.
- **MW:**
  - parsed only from the description text, using the nearest qualifier after or before the figure;
  - MVA, or a figure near grid/connection/substation/kV/import → `grid_connection_mw`;
  - a figure near generat/engine/battery/standby → `onsite_generation_mw`;
  - a figure near IT/critical/compute → `it_load_mw`;
  - otherwise `mw_unqualified`;
  - `facility_power_mw` is set only from a curated quote;
  - missing values are null, never 0.

## Fetcher
`python3 -I dc_planning_fetch.py --out out` (stdlib only).
- **Other modes:** `--selftest`, `--verify` (re-hashes `raw/` against the manifest), `--offline`.
- **Pinned URLs:** 9 sources, plus an s35 seed.
- **Outputs:** raw snapshots with SHA-256 in `out/manifest.json`, and `out/dc_planning.geojson`.
- **Determinism:** two runs gave byte-identical output.

**Status mapping:**
| Raw | Pipeline status |
|---|---|
| withdrawn | withdrawn |
| refus*, reject*, dismiss* | refused |
| grant*, approv*, permit*, consent, allowed | consented |
| pending, registered, valid, under consideration, pre-app, acceptance, pre-examination, examination, recommendation, appeal lodged | in planning |
| a bare "Decided" | `decided (outcome not stated)`; it is not assumed consented |
| empty | unknown |

### Run results (29 Oct 2026, this sandbox)
| Source | Fetch | Rows | DC candidates |
|---|---|---|---|
| pdgu-planning-application | **unreachable** (proxy 403) | unknown | unknown (publisher shows 0 records) |
| pdgu-infrastructure-project | **unreachable** | unknown | unknown |
| pins-nsip-applications | **unreachable** | unknown | unknown |
| adur / worthing / camden | **unreachable** | unknown | unknown |
| digital-land-nsip-snapshot | ok, sha256 0cd20e88…2dcfa | 233 | 0 |
| doncaster-2024 | ok, sha256 4933704b…96b52 | 1,053 | 0 |
| doncaster-2023 | ok, sha256 48380b73…bc999f1 | 1,126 | 0 |
| s35 seed (curated, OGL) | n/a | 3 | 3 |

**Total: 3 candidates, all `in planning` (NSIP s35, pre-application).** There are 0 consented, 0 refused and 0 withdrawn. Every unreachable source is unknown, not zero.

**s35 seed (geometry null; no coordinates invented):**
- **EN0110030 SDC M40 / Wapseys Wood** (Slough Holdings UK Ltd):
  - IT load c.300 MW;
  - on-site gas energy centre c.250–350 MW generation;
  - c.900 MW gas connection, which is **not** an electrical figure;
  - application expected Jan 2027.
- **QuestPit, Ampthill Road, Bedford** (direction 15 Jun 2026):
  - IT 720 MW, "indicative and subject to revision";
  - initial grid connection 200 MW.
- **Ebbsfleet, New Barn Road, Dartford** (CSE52 Ltd, direction 1 Jul 2026):
  - IT 240 MW;
  - total power load 300 MW.

## Limits (honest)
1. **The sandbox proxy blocks** planning.data.gov.uk, files.planning.data.gov.uk, PINS, Socrata, the council hosts and Spatial Hub. Only GitHub was reachable, so the main sources must run on a runner (for example, the data-grid-gb `workflow_dispatch` in PR #2).
2. **The coverage gap is structural.** England's national dataset is empty (alpha/staging, 4 LPAs). Most DC applications sit in ~330 LPA portals, which are not open. Scotland is gated (unverified licence). Wales and NI have nothing open.
3. **Keyword search will miss** applications described only as "B8 warehouse" or "technology campus", and will catch amendments, discharge-of-condition cases and minor works on existing DCs. The candidates need a human pass.
4. **MW is missing for nearly all planning records**, so expect nulls. Description-level MW is rare and ambiguous. Grid-connection MW usually appears only in connection offers, not in planning.
5. **"Consented" ≠ built ≠ connected.** A pipeline entry is not a commitment.

## Cross-check with #73
- The Team A synthesis (comment 20:17Z) gives "planning.data.gov.uk planning-application OGL v3.0, 0 records", which **agrees**.
- **Ebbsfleet** 300 MW total / 240 MW IT **agrees**.
- **DC-A3's QuestPit 720 MW IT agrees.** DC-A2 adds the **200 MW initial connection** from the same statement (§5.3); DC-A3 should carry it.
- DC-A3 also seeds the s35 sites. The DC-A7 merge should de-duplicate on PINS ref / site name (`dc-a2:s35:*`).
- ChatGPT had not posted as of this check.
