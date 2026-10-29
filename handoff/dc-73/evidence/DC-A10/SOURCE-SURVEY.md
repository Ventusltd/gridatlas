# UK data-centre pipeline: source survey (step 1 of gridatlas #73)

Surveyed 29 October 2026 by Claude (lanes DC-A1, A3, A4, A5, A6 and A9, synthesised by DC-A10). This is for the data-grid-gb docs.

## The rule
Only **fully open** data is fetched by default. That means OGL v3, CC BY, CC0, public domain, or ODbL with attribution. Sources that are non-commercial, need approval or login, or cost money are marked **no**. **Unverified** means nobody has yet quoted the licence that applies to that exact file. Unverified sources are not fetched by default.

## What the survey found
1. **No fully open site-level register of data-centre demand exists in GB.**
   - NESO says (FOI/25/174, 18 Dec 2025): "We do not currently have a register of demand connections. We are not required under the CUSC to maintain or publish one in the way that we are for generation connections."
   - No DNO publishes a named demand queue either.
   - Data-centre connection figures exist **only as aggregates**:
     - NESO FOI/26/199, as at 30 Sep 2026: 163 transmission-connected data-centre projects, 62.7 GW of demand capability;
     - Ofgem, quoted in FOI/26/183: about 315 data-centre projects and about 73 GW in the whole demand queue;
     - NESO Demand CFI, Mar 2026: 50,802 MW across 152 project phases.
2. Open **site-level** records come from three places:
   - OpenStreetMap and Wikidata, for operational sites;
   - GOV.UK publications, for pipeline sites: AI Growth Zones, Planning Act s35 directions, and recovered planning appeals;
   - possibly, PINS NSIP data on planning.data.gov.uk.
3. DNO Embedded Capacity Registers can only produce **name-match candidates**. An ECR lists generation, storage and DSR of 50 kW or more, never plain demand. So a data centre appears there only through its standby generation or battery.
4. MW figures come in four kinds that must not be mixed:
   - **IT load** (s35 directions, the DSIT annex);
   - **grid connection / demand capability** (NESO, ECR import, appeals that "reserve" a connection);
   - **total power load**;
   - **on-site generation**.

   Example: the Ebbsfleet s35 direction (1 Jul 2026) gives "up to 300MW total power load" and "up to 240MW IT load" for the same site. The AI Growth Zone figures carry no stated basis.
5. **Not fetched in this session.** The sandbox proxy refused gov.uk, NESO, every DNO portal, Overpass and Wikidata SPARQL. Every fetcher is written and passes its self-test. Snapshots and SHA-256 hashes will come from the `workflow_dispatch` fetch in data-grid-gb. Until then, every count from live data is **unknown, not zero**.

## Source table: data-centre sites and pipeline
| # | Source | Publisher | URL | Licence (quoted) | Fully open | Format / cadence | Useful fields | What it gives for data centres |
|---|---|---|---|---|---|---|---|---|
| 1 | TEC register | NESO | https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register | NESO Open Data Licence: "based on version 3.0 of the Open Government Licence with specific amendments for NESO"; attribution "Supported by National Energy SO Open Data"; https://www.neso.energy/data-portal/neso-open-licence | **yes** (OGL-derived; owner to confirm) | CSV + CKAN; twice weekly | Project Name, Customer Name, Connection Site, MW, Status, Plant Type, Gate | Generation, storage and interconnectors only. Demand does not hold TEC. Co-located generation or BESS shows up only by name. |
| 2 | Embedded Register | NESO | https://www.neso.energy/data-portal/embedded-register | NESO Open Data Licence | **yes** (as above) | CSV; twice weekly | as TEC | Distribution generation with transmission impact. Not demand. |
| 3 | Existing Agreements (EA) Register | NESO | https://www.neso.energy/document/373996/download | none found | **unverified** | xlsx; irregular | Project Name, Technology Type ("Transmission Connected Demand") | Some names contain "Data Centre". Consent-based and known to be incomplete (FOI/26/149). Opt-in only. |
| 4 | FOI responses, Demand CFI, Gate 2 results | NESO | e.g. https://www.neso.energy/document/378226/download ; https://www.neso.energy/foi-26-183-data-centre-projects-electricity-connections-queue-22-september-2026 | none stated | **unverified** | PDF / web; one-off | aggregates | Context only. Project-level detail refused under EIR 12(5)(e). |
| 5 | Embedded Capacity Register: SSEN | SSEN Distribution | https://data-api.ssen.co.uk/dataset/groups/embedded_capacity_register | "Creative Commons Attribution 4.0 [Open Data]" | **yes** | CSV/XLSX; monthly | customer_name, customer_site, import/export MW, location | Name-match candidates only. Import MW is a grid figure, never IT load. |
| 6 | Embedded Capacity Register: NGED | NGED | https://connecteddata.nationalgrid.co.uk/dataset/embedded-capacity-register | "NGED Shared Data Licence" (dataset page) | **unverified (likely no)** | CSV; monthly | as above + lat/lon | Candidates. Keep out of default fetch until the licence is read. |
| 7 | Connections Reform Register, Clearview queue, reform outcomes | NGED | https://connecteddata.nationalgrid.co.uk/dataset/nged-projects-connections-reforms-outcomes | "NGED Open Data Licence" (2020 WPD text based on OGL v3.0; current text unverified) | **yes** (wording to check) | CSV; monthly or annual | Technology (generation grouping), MW | No demand type; no data centres. |
| 8 | ECR and NDP headroom: Northern Powergrid | NPg | https://northernpowergrid.opendatasoft.com/ | "Northern Powergrid Open Data Licence v1.0" (text not read) | **unverified** | CSV; monthly | as ECR | Candidates. |
| 9 | ECR, GSP queue: ENWL | SP Electricity North West | https://electricitynorthwest.opendatasoft.com | portal default "Creative Commons Attribution 4.0 International"; datasets need registration | **unverified / no** (login) | CSV; monthly | GSP, technology, MW | No names in the queue. |
| 10 | ECR, heat maps: SPEN | SP Energy Networks | https://spenergynetworks.opendatasoft.com | none named; registration required | **no / unverified** | CSV | | none |
| 11 | Data-centre datasets (by local authority, demand profiles, large-demand list) | UK Power Networks | https://ukpowernetworks.opendatasoft.com | per dataset: CC, OGL or "Shared Dataset Agreement"; login required | **unverified / no** | CSV/API; quarterly | LA, GSP, MVA | Anonymised by design. Aggregates only. |
| 12 | planning-application dataset | MHCLG | https://www.planning.data.gov.uk/dataset/planning-application | "Licensed under the Open Government Licence v.3.0" | **yes** | CSV/GeoJSON/Parquet | | **0 records, no providers**. The page says it "is incomplete and is not yet ready for use". |
| 13 | infrastructure-project (NSIPs) | Planning Inspectorate via planning.data.gov.uk | https://www.planning.data.gov.uk/dataset/infrastructure-project | "Licensed under the Open Government Licence v.3.0" | **yes** | CSV/GeoJSON; collected daily | boundaries, project | 293 NSIPs. Data-centre NSIPs (after s35) may appear; unverified. |
| 14 | Local planning portals (Idox and similar) | LPAs | various | portal terms | **no** | HTML | | Evidence links for people only. Never scraped. |
| 15 | AI Growth Zones, s35 directions, recovered appeals, DSIT releases, Covenant | DSIT, MHCLG, HMT on GOV.UK | https://www.gov.uk/ (e.g. https://assets.publishing.service.gov.uk/media/6a44f717065c5aec12a4e4e7/Direction_Granted.pdf) | "All content is available under the Open Government Licence v3.0, except where otherwise stated" | **yes** | HTML/PDF; ad hoc | name, locality, MW with stated basis | 27 records (A3) plus Ebbsfleet. Precision is mostly town or region. Wapseys Wood is exact. |
| 16 | Scottish Ministers' directions; Welsh Government | gov.scot, gov.wales | https://www.gov.scot/ ; https://www.gov.wales/ | OGL v3.0 | **yes** | HTML/PDF | | Wester Hermiston, Auchtertool, Redheughs Avenue. |
| 17 | Local and combined-authority pages | e.g. NECA | various | no OGL statement | **no** | | | Excluded. |
| 18 | OpenStreetMap | OSM contributors | https://www.openstreetmap.org/copyright | ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/; credit "© OpenStreetMap contributors" | **yes** (share-alike) | Overpass JSON; continuous | name, operator, tags | 240 objects, which make 190 sites (178 data centres + 12 cable landing stations), from a legacy snapshot. No MW. |
| 19 | Wikidata | Wikidata contributors | https://www.wikidata.org/wiki/Wikidata:Licensing | "All structured data in the main, property and lexeme namespaces is made available under the Creative Commons CC0 License" | **yes** | SPARQL JSON; continuous | operator, inception, coordinates | Sparse. Not fetched (blocked). |
| 20 | NAEI point sources 2023 | Defra / DESNZ | https://naei.energysecurity.gov.uk/data/maps | "published by Defra, DESNZ and the Devolved Governments under the Open Government Licence" | **yes** | xlsx; annual | site, emissions | 31 data centres with reportable combustion (standby/CHP). |
| 21 | Company disclosures, trade press (DCD, the Guardian) | operators, press | various | copyright | **no** | | | Cite as context only. |

## Context sources (aggregates, not sites)
| Source | URL | Licence | Fully open |
|---|---|---|---|
| DSIT Compute Roadmap evidence annex (1.8 GW of IT load, about 330 DCs) | https://assets.publishing.service.gov.uk/media/69d8dae9d3e08b8871b66599/compute-evidence-annex-final.pdf | OGL v3.0 | yes |
| HM Treasury Data Centre Covenant (6 GW by 2030, basis undefined) | https://www.gov.uk/government/publications/data-centre-covenant/the-data-centre-covenant | OGL v3.0 | yes |
| DESNZ data-centre electricity by region, 2024 | see DC-A9 `context.json` | OGL v3.0 | yes |
| NESO written evidence DCU0081 | https://committees.parliament.uk/writtenevidence/166090/html/ | Open Parliament Licence | yes (OGL-like; owner to confirm) |

## Conventional power assets (step 5)
| Source | URL | Licence | Fully open | Note |
|---|---|---|---|---|
| DUKES 5.11, Power stations in the UK, May 2026 | https://assets.publishing.service.gov.uk/media/6a6a365b0ddb7e4831c629f3/DUKES_5.11.xlsx | "All content is available under the Open Government Licence v3.0" | **yes** | The preferred source for status and MW. Not fetched (blocked). |
| WRI Global Power Plant Database v1.3.0 | https://github.com/wri/global-power-plant-database | "Creative Commons-Attribution 4.0 (CC BY 4.0)" | **yes** | "not currently maintained by WRI". MW is about 2018-19 (DUKES-derived). |
| NAEI 2023 power producers | as above | OGL | **yes** | Basis for "operational". |
| NESO TEC register (gas, OCGT, recips under construction) | as row 1 | NESO Open Data Licence | **yes** (owner to confirm) | No coordinates. Placement is at the connection-site level. |
| OSUKED Power Station Dictionary | https://osuked.github.io/Power-Station-Dictionary/ | none declared | **no** | Rejected. |

## Honesty rules carried into the data
- Proximity is not connection, capacity or feasibility.
- A pipeline entry, an AI Growth Zone, an s35 direction or a queue position is not a commitment.
- Unknown is not zero.
- IT load MW and grid connection MW are separate fields, and neither is ever filled from the other. A figure whose basis is not stated goes to an "unclassified" field.
- The 6 GW Covenant target has no stated basis. The DSIT annex measures in IT load, which suggests IT load, but government has not confirmed this.
