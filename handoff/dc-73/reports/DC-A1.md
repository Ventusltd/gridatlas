# DC-A1: NESO sources for data-centre / large-demand connections (issue #73, steps 1-3)

29 Oct 2026. Research done through WebSearch/WebFetch. api.neso.energy and the NESO document downloads were refused by both the proxy (CONNECT 403) and the WebFetch allowlist. **No NESO data file was fetched, so data-centre counts from the data are UNKNOWN, not zero.** #73 had no comments at the time of checking, so there was nothing from ChatGPT to cross-check.

## Bottom line
- **No fully open NESO dataset identifies data centres at site level.** NESO says so itself (FOI/25/174, 18 Dec 2025): "We do not currently have a register of demand connections. We are not required under the CUSC to maintain or publish one in the way that we are for generation connections."
- The only NESO publication that names transmission-connected demand projects (some with "Data Centre" in the name) is the **Existing Agreements (EA) Register** xlsx. It has three problems:
  - its licence is unverified;
  - it is consent-based, so it is incomplete;
  - it is known to miss data centres: FOI/26/149 says three transmission-connected DC projects in Ealing and Brent (490 MW combined) are "not on the register".
- NESO publishes data-centre figures only as **aggregates**, and it refuses project-level detail under EIR 12(5)(e):
  - **FOI/26/199** (8 Oct 2026), as at 30 Sep 2026: 213 transmission-connected demand projects totalling 83.7 GW, of which **163 are data centres totalling 62.7 GW** (demand capability, i.e. grid connection, not IT load);
  - **FOI/26/210** (9 Oct 2026): 57.88 GW across 164 projects (172 queue items); 163 are Gate 2 and 1 is Gate 1;
  - **Demand Call for Input summary** (Mar 2026): data centres are 50,802 MW across 152 project phases, of 92,947 MW in total;
  - **DCU0081**: about 72.8 GW of DC connection requests to 2039, including about 59 GW at transmission level.

## Source table
| Source | URL | Licence | Fully open? | Format / cadence | Fields | Can DCs be identified? |
|---|---|---|---|---|---|---|
| TEC register | https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register. CSV: https://api.neso.energy/dataset/cbd45e54-e6e2-4a38-99f1-8de6fd96d7c1/resource/17becbab-e3e8-473f-b303-3806f43a6a10/download/tec-register-27-october-2026.csv (filename changes; resolve via CKAN `resource_show`) | NESO Open Data Licence https://www.neso.energy/data-portal/neso-open-licence: "based on version 3.0 of the Open Government Licence with specific amendments for NESO"; commercial use allowed; attribution "Supported by National Energy SO Open Data"; may be revised without notice | **Yes** (OGL-derived, attribution only). It is not OGL v3 verbatim, so the owner should confirm | CSV + CKAN datastore; twice weekly | Project Name, Customer Name, Connection Site, Stage, MW Connected, MW Increase / Decrease, Cumulative Total Capacity (MW), MW Effective From, Project Status, Agreement Type, HOST TO, Plant Type, Project ID, Project Number, Gate. No coordinates | **Generation, storage and interconnectors only.** NESO: "a list of projects that hold contracts for Transmission Entry Capacity". Demand does not hold TEC. A DC can appear only through co-located generation or BESS, by name or customer. No demand field |
| Embedded Register | https://www.neso.energy/data-portal/embedded-register. CSV: https://api.neso.energy/dataset/4b0e109c-aa23-45ac-86c1-0bda557d1aab/resource/68b6f3a1-e1bf-403b-9062-0269fc758d77/download/embedded-register-27-october-2026.csv | NESO Open Data Licence | **Yes** (as above) | CSV; twice weekly | Expected to match TEC (Gate column added from 21 Nov 2025). Columns not confirmed | Distribution-connected generation with transmission impact. Not demand. Name/customer heuristic only |
| Existing Agreements (EA) Register | https://www.neso.energy/document/373996/download (cited in FOI/25/174, https://www.neso.energy/document/374976/download) | None found | **Unverified** | xlsx; irregular | Col A Project Name, Col F Technology Type (incl. "Transmission Connected Demand"); others unknown | **Partly**: "Some Transmission Connected Demand projects have 'Data Centre' in their 'Project Name'". Consent-based and incomplete (FOI/25/199, FOI/26/149) |
| Gate 2 results (8 Dec 2025 release; detailed results Jan 2026) | https://www.neso.energy/neso-implements-electricity-grid-connection-reforms-unlock-investment-great-britain ; https://www.neso.energy/industry-information/connections-reform/connections-reform-results (not fetchable) | Not stated | Unverified | Web page / aggregates | Transmission-connected demand: 11.8 GW for 2030 + 86.7 GW for 2035 | **No**: aggregate only, no DC split |
| Demand CFI summary | https://www.neso.energy/document/378226/download | Not stated | Unverified | PDF, one-off (Mar 2026) | Aggregates by technology, milestone and TO zone | **No**: aggregate (DC 50.8 GW / 152 phases) |
| Demand IRN (11 Mar 2026) | https://www.neso.energy/industry-information/connections/demand-information-request-notice-irn | n/a | n/a | Responses confidential | n/a | **No** |
| FOI responses (FOI/25/174, 25/186, 26/149, 26/183, 26/199, 26/210) | e.g. https://www.neso.energy/document/388721/download ; https://www.neso.energy/document/388941/download ; https://www.neso.energy/document/387731/download | Not stated | Unverified | PDF | Aggregates | **No**: project level refused (12(5)(e), 12(4)(b)) |
| CMP434 / CMP435 (connections reform code mods) | https://www.neso.energy/industry-information/codes/cusc/modifications/cmp434-implementing-connections-reform ; …/cmp435-application-gate-2-criteria-existing-contracted-background | n/a | n/a | Code documents | Process, not data | **No** |
| Ofgem "Proposed data centre connection reforms" (29 Jul 2026) | https://www.ofgem.gov.uk/consultation/proposed-data-centre-connection-reforms | Not stated | Unverified | Consultation | About 315 projects / 73 GW (Ofgem's figure as quoted by FOI/26/183) | **No** |
| Directly-connected demand list | None exists (FOI/25/174, FOI/25/186) | | | | | |

The NESO "connection registers" group (https://www.neso.energy/data-groups/connection-registers) states "Each dataset on the NESO data portal is licenced on an individual basis". The TEC and Embedded pages both name the NESO Open Data Licence.

## Fetcher
The fetcher is `evidence/DC-A1/fetch_neso.py`. It uses only the standard library and should be run with `python3 -I`.
- **Inputs:** it pins dataset and resource ids and resolves the current CSV through CKAN `resource_show`, falling back to the pinned 27 Oct URL.
- **Snapshots:** it saves each raw file as `raw/<KEY>/<sha12>-<file>`. `manifest.json` records the URL, byte count, sha256 and UTC fetch time.
- **Outputs:**
  - `neso_connections.normalised.json` holds every row in #73 step-3 schema.
  - `neso_dc_like.normalised.json` and `.geojson` hold the data-centre-like rows. Geometry is null because NESO gives only a site name.
  - `counts.json` holds the counts.
- **Status mapping:** Built → operational; Under Construction/Commissioning → under construction; Consents Approved → consented; Awaiting Consents → in planning; everything else → "connection request". The raw value is always kept.
- **MW handling:** `it_load_mw` is always null. `grid_connection_mw` is the Cumulative Total Capacity, with its basis and direction stated (TEC means export).
- **Data-centre matching:**
  - Rule `name`/`type`/`customer_name`: a regex on the name, plant type and customer. These rows are counted as data-centre-like.
  - Rule `customer_is_dc_operator`: the customer is a known DC operator. This is reported separately and never counted as a data centre.
  - Demand-type rows are flagged `large_demand`.
- **EA register:** opt-in only (`--include-ea`), because its licence is unverified. The fetcher includes a stdlib xlsx reader for it.
- **`--from-file KEY=path`:** lets a CI runner or a person with access feed in a downloaded copy.
- **`--selftest`:** runs a synthetic fixture and passes.

**Live run:** all three sources failed with `Tunnel connection failed: 403 Forbidden` and the exit code was 2. Only `out/manifest.json` was written, recording the failures. On failure the fetcher deliberately writes no empty count files.
- **Data-centre-like count: UNKNOWN** (it was not fetched).
- **Expectation:** about 0 by name in TEC and Embedded, because they hold generation only. The EA register holds some "Data Centre" demand rows but is incomplete.

## Next
- Run the fetcher on a GitHub Actions runner, or have someone with access run it. It is unverified whether a runner can reach api.neso.energy. `tools/offshore/fetch_neso_connection_sites.py` names a `neso-connection-register-refresh.yml` workflow that is not in `.github/workflows`.
- Ask NESO for the EA register's licence.
- For site-level DC pipeline data, the useful open routes are the DNO ECRs, planning.data.gov.uk and DSIT AI Growth Zones, not NESO.
