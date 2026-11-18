# DC-A5: DNO open data portals and data-centre demand evidence

Lane DC-A5 (Team A). Issue #73, step 1 (DNO part) and step 2 (fetcher). Updated 29 Oct 2026 around 20:15 UTC.

## Bottom line

**No DNO publishes a fully open, site-level list of large demand connections or a queue that names data centres.**

- **UKPN** is the only DNO with data-centre-specific datasets. All of them are anonymised and all need a portal login. Their dataset-level licences are unverified.
- **ECRs** are the only site-level, named route. Each register has `customer_name`, `customer_site` and `connected_maximum_import_capacity(mw)` fields. A data centre appears only if it has registered generation, storage or DSR of 50 kW or more (for example parallel-running standby sets or a BESS). A name match is therefore a Record-tier candidate, and absence from an ECR is not evidence of anything. ECR import capacity is a grid connection figure, never IT load.
- **Network access.** The sandbox proxy refuses CONNECT (403) to every DNO host and every mirror tried: data.opendatasoft.com, opennetzero, data.gov.uk, London Datastore, Zenodo. Only GitHub is reachable. WebFetch reaches the HTML dataset pages only. **I could not get live counts.** The fetcher is written and passes its self-test; its live run logs 8/8 sources as "Tunnel connection failed: 403". It needs to run in CI (GitHub Actions) or on an unrestricted machine.

## Per-portal findings

| DNO | Portal / licence (verified?) | Demand / DC datasets | DCs identifiable? | Fully open (owner rule) |
|---|---|---|---|---|
| **UKPN** | ukpowernetworks.opendatasoft.com. The terms page says each dataset is under "the Creative Commons licence; the Open Government licence; and the Shared Dataset Agreement", shown on its information tab. The data triages are CC BY 4.0. ECR and Grid & Primary Sites were stated as CC BY 4.0 in 2021 (OSM talk-gb). The licence of each DC dataset is **UNVERIFIED**. All datasets now show "To view this data please register and login." | `ukpn-data-centres-by-local-authority`: operational and pipeline DC capacity in MVA by local authority district, reviewed quarterly. Green Web Foundation reads it as about 1,000 MW operational and about 5.3 GW pipeline. `ukpn-data-centre-demand-profiles`: half-hourly % utilisation of over 100 DC sites, by voltage level and type (enterprise / co-located). `ukpn-data-centre-utilisation`: ARCHIVED. The London Datastore mirror is CC BY 4.0. `ukpn-large-demand-list`: anonymised, live and committed import projects of 5 MVA and above plus BESS. Fields: licence area, GSP, rounded import capacity, application date. `ukpn-overall-queue-insights`. | **No.** Data is anonymised by design: LA aggregate, voltage band, or GSP plus a sequential number. | **No / unverified.** Needs a login and API key. DC licences unverified. |
| **SSEN** | data-api.ssen.co.uk (CKAN). ECR is **CC BY 4.0, verified** on the dataset page. Resources of "Generation Availability and Network Capacity" are CC BY 4.0 (verified on one resource; the dataset-level field is blank). | No demand-queue or DC dataset. ECR 4.0 is monthly, with August 2026 Part 1 CSVs (≥1 MW and 50 kW–1 MW); Part 2 DSR is in the XLSX only. Demand heat maps (SEPD Feb 2024, Scotland and Shetland Aug 2023, as XLSX) plus GSP/BSP/Primary CSVs. | Only through ECR `customer_name` (candidates). | **Yes**, for ECR and the heat-map CSVs. Downloads 302 to signed Cloudflare R2 URLs that expire after 60 s; the fetcher follows the redirect. |
| **NGED** | connecteddata.nationalgrid.co.uk (CKAN). "NGED Open Data Licence" / "WPD Open Data Licence": the Dec 2020 text is **based on OGL v3.0**, allows commercial use, and requires the attribution "Supported by WPD Open Data". The current NGED version text is unverified. **The NGED Network Capacity map is under the "NGED Shared Data Licence", so it is NOT open.** | `nged-connections-reform-register` (CSV, CMP435 inventory). `nged-projects-connections-reforms-outcomes`: its Technology field is a CP2030 generation grouping, with only Export/Installed MW. `clearview-connect-queue-positions` (CSV, monthly). `connection-queue`: placeholder until NESO confirms. `embedded-capacity-register`: has `customer_name`, `customer_site`, `connected_maximum_import_capacity(mw/mva)`, lat/lon and E/N. | Queues: **no.** They carry no demand or DC type and are generation-oriented; demand rows are unverified. ECR: name candidates only. | **Yes** for the CRR, Clearview and ECR, under an OGL-derived licence; the attribution wording needs checking. Network Opportunity Map Headroom is "Open" but needs a login. |
| **Northern Powergrid** | northernpowergrid.opendatasoft.com. "Northern Powergrid Open Data Licence v1.0", whose text at /p/opendatalicence/ was **NOT readable: UNVERIFIED**. About 44 of 102 datasets are records-gated (per apis.io). | `npg_ndp_demand_headroom` / `npg_ndp_generation_headroom`: "does NOT require a login". ECR (6 sheets incl. Part 2 DSR). Older demand-and-capacity XLS files on data.gov.uk are under OGL. | No demand queue. ECR name candidates only. | **Unverified**: the licence text has not been read. |
| **ENWL** (now SP Electricity North West) | electricitynorthwest.opendatasoft.com: "Unless otherwise stated, all data is licensed under a Creative Commons Attribution 4.0 International License". The Distribution TX Headroom page says "copyright… all rights reserved", which conflicts. | `enwl-gsp-connection-queue`: "Contracted Not Connected" schemes by GSP, with technology and capacity. Whether demand is included is unverified. ECR Parts 1, 2 and 3 (DSR ≥1 MW, site-level). NDP Demand Capacity Map, HV Network Capacity Map, `distribution-tx-headroom`. | GSP queue: no names. ECR: candidates. | **No.** Queue and ECR need registration. |
| **SPEN** | spenergynetworks.opendatasoft.com. **Registration is required for all datasets**, and API keys are user-specific. No licence is named in the FAQ (**UNVERIFIED**). The GIS shapefiles are under the "Shared Data Licence". | "Connections by Market Segment" (added June 2025). Heat maps for SPM and SPD Grid and Primary, with Firm Capacity, Max/Min Load MVA, Generation Connected/Contracted, E/N. ECR. | No. | **No / unverified.** |

ECR scope: connected and accepted generation, storage and DSR of 50 kW and above, in DCUSA/ENA common format, updated monthly. It holds no general demand connections.

## Files

- **Fetcher:** `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/DC-A5/dno_fetch.py` (stdlib only).
  - It covers 8 open sources (SSEN ECR ×3, SSEN heat-map package, NGED ECR, CRR, Clearview, NPg demand headroom).
  - It takes pinned URLs or CKAN `package_show` resolution, and writes raw snapshots, SHA-256 in `manifest.json`, and a `--verify` mode.
  - It screens ECR names for DC terms and converts OSGB to WGS84 with a Helmert transform, checked against the OS Caister worked example and Greenwich.
  - It writes GeoJSON `dno_ecr_dc_candidates.geojson`.
  - The login-gated UKPN/ENWL sources run only with `--include-gated` plus `UKPN_API_KEY` / `ENWL_API_KEY`.
  - `--selftest` passes.
- **Live run log:** `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/DC-A5/run.log`. All 8 sources fail with 403; counts are **unknown, not zero**.

## Substation headroom for "local area" context (Record tier only)

| Source | Licence | Notes |
|---|---|---|
| SSEN demand heat maps / GSP-BSP-Primary CSVs | CC BY 4.0 | Not logged in. |
| NPg `npg_ndp_demand_headroom` | NPg ODL v1.0, unverified | No login. |
| UKPN `dfes-network-headroom-report` (BSP and Primary demand and generation headroom to 2050) and `grid-and-primary-sites` | | Login. |
| NGED Network Opportunity Map Headroom | | Login. NGED Network Capacity is under the Shared licence, so not open. |
| ENWL NDP Demand Capacity / HV Network Capacity / `distribution-tx-headroom` | | Login. |
| SPEN heat maps | | Login. |
| Zenodo 10866260, GB Primary Substation Datasets (Zhou, Essayeh, Morstyn, 2024) | CC BY 4.0 | Firm capacity, peak demand, location and GSP for all six DNOs. A good single open file, but its upstream DNO licences need checking. Unreachable from the sandbox. |

Headroom is indicative and may already be contractually committed (UKPN's own caveat). Proximity is not capacity.

## Cross-check with #73

#73 had no comments at 20:10 UTC, so there was nothing to cross-check.

## Nothing committed or pushed
