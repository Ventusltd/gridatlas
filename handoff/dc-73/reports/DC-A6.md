# DC-A6: UK conventional power assets (issue #73 step 5)

Lane DC-A6, Team A, 29 Oct 2026. Status: **dataset built, deterministic**. No PR: the lane did not ask for one, and #73 had no comments to cross-check when it was read at ~20:00 UTC.

## Output
Everything is under `evidence/DC-A6/`:

| file | sha256 |
|---|---|
| `out/conventional_power_uk.geojson` (301 features, 456 KB) | `44b577a12d714d934ce90ce39b44951fb2a641f32ccc20d45a5e2461b145ec98` |
| `out/excluded_repd.json` (58 sites dropped by the REPD rule, each with its REPD ref and distance) | `ce4e026a881981659358ed6304c4ae979adc225f79278af398059586fa78e012` |
| `out/counts.md` / `out/counts.json` | see `out/SHA256SUMS` |

Builder: `build_conventional.py`. It uses the standard library only and is run with `python3 -I`. It pins the sha256 of all 4 inputs and refuses any other bytes. Eight runs gave the same bytes, and so did runs under different `PYTHONHASHSEED` values.

Each feature has these fields:
- `name`, `operator`;
- `fuel` (gas, coal, oil, diesel, nuclear, biomass, waste, landfill_gas, biogas, unstated) and `technology`, with `fuel_basis`;
- `mw` with `mw_basis` and `mw_records[]` (the GPPD ids);
- `status` (operational, closing, closed, converted, construction, unknown), with `status_date`, `status_basis` and `status_source`;
- `in_nearest_default` (false only when closed);
- `precision`, `colocated_ids` (other features within 100 m);
- `sources[]` (name, URL, licence quote), `records[]` (provenance), `repd_rule`, `caveat`.

## Counts (fuel × status)
| fuel | operational | closing | closed | converted | construction | unknown | total | with MW | MW |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biomass | 3 | 0 | 0 | 0 | 0 | 2 | 5 | 0 | – |
| coal | 0 | 0 | 6 | 0 | 0 | 0 | 6 | 6 | 9,921 |
| gas | 41 | 0 | 2 | 1 | 0 | 54 | 98 | 47 | 32,575 |
| nuclear | 1 | 4 | 3 | 0 | 1 | 0 | 9 | 8 | 8,918 |
| oil | 9 | 0 | 0 | 0 | 0 | 2 | 11 | 11 | 372 |
| unstated | 167 | 0 | 0 | 0 | 0 | 0 | 167 | 0 | – |
| waste (EfW) | 5 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | – |
| **all** | 226 | 4 | 11 | 1 | 1 | 58 | 301 | 72 | 51,787 |

By technology: CCGT 23, CHP 30 (11 of them with fuel not stated), peaking/reserve 103, gas with type not stated 29, thermal with fuel not stated 79. No site is labelled diesel, because no open source used here states diesel; the 11 oil sites may include diesel. Missing values are unknown, not zero.

## Sources and licences
| source | licence (quote, URL) | use |
|---|---|---|
| Offtakers class B: GridAtlas `data/offtakers_filtered_202610290945.geojson`, sha `6fc20e04…`, 358 sites (366 before R-otdata) | NAEI 2023: OGL v3.0, "published by Defra, DESNZ and the Devolved Governments under the Open Government Licence" (https://naei.energysecurity.gov.uk/data/maps). OSM: ODbL 1.0 (https://www.openstreetmap.org/copyright). GPPD: see below | base sites, points, operators; NAEI 2023 is the basis for "operational" |
| WRI GPPD v1.3.0, sha `4b1f93e0…`. Uses the 84 GBR rows whose source is not REPD (73 cite BEIS DUKES) | "available ... under a Creative Commons-Attribution 4.0 (CC BY 4.0) license" (https://github.com/wri/global-power-plant-database) | MW. 83 of the 84 rows were already in class B; GPPD "Glanford" (biomass) was added and then excluded by REPD |
| R-otdata `status_curated.csv`, sha `04c8f83a…` (36 rows, each page fetched 29 Oct 2026) | cited facts | closed, closing, converted and construction status, with dates (already applied in the offtakers file) |
| REPD Q2 2026 registry 202608290716, sha `c8a5c59b…` | OGL v3.0 (DESNZ) | **exclusion only**; no REPD row is copied |
| DUKES 5.11 "Power stations in the United Kingdom, May 2026" (https://assets.publishing.service.gov.uk/media/6a6a365b0ddb7e4831c629f3/DUKES_5.11.xlsx) | "All content is available under the Open Government Licence v3.0" (gov.uk chapter 5 page, fetched; last updated 30 Jul 2026) | **NOT USED: blocked.** curl got CONNECT 403 and WebFetch said URL_NOT_ON_ALLOWLIST |
| NESO TEC register (CSV `tec-register-27-october-2026.csv`; twice weekly) | "NESO Open Data Licence" (OGL-v3-derived; owner to confirm). The register has no coordinates: connection site name, MW and project status only | **NOT USED: blocked** (api.neso.energy 403) |
| OSUKED Power Station Dictionary / powerdict | no licence declared (PyPI 1.3.0, Dec 2020) | **rejected**: not fully open |

The dataset as a whole is licensed ODbL 1.0, because it contains OSM data. Filtering on `sources[]` gives a subset that is OGL plus CC BY only.

## MW basis
`mw` is **installed capacity** taken from GPPD v1.3.0, which cites BEIS DUKES 5.11. The DUKES edition is about 2018-19 and is unverified.
- It is not DNC, not TEC and not a connection capacity.
- Converted sites count only the units that burn the current fuel. Kilroot is 142 MW of gas; its 520 MW of closed coal is excluded.
- Closed sites keep the capacity last listed.
- 229 sites have no MW in these sources. For them `mw` is null, meaning unknown.

## REPD rule (no double counting with the engine's 30-nearest REPD list)
Only sites whose current fuel is renewable-scope can be excluded: biomass, waste/EfW, landfill gas or biogas. Such a site is excluded when the pinned REPD registry has a bioenergy or EfW record that meets either test:
- it lies within 1 km and is in the same technology group (biomass/EfW/ACT, or landfill/AD/sewage);
- it lies within 5 km, is in the same group and shares a distinctive name token. REPD points are often at postcode level and can be 2-3 km out: Greatmoor, Westfield and Beddington are examples.

There is one cross-group case: a record of the other group counts only when it is within 0.5 km and shares a name token.

For a site that is operating, unknown or converted, only an **operational** REPD record counts, because a planned REPD project on the same site is a different asset.

Results:
- **58 sites excluded.** Among them: Drax (REPD 174), Lynemouth/Ashington (115), Steven's Croft, Markinch, Ferrybridge MF1, SELCHP, Riverside/Belvedere and the 11 landfill schemes.
- **10 renewable-scope sites kept, flagged "no REPD match".** These are Biomass Generator, Gascoigne Wood, Margate, Squabb Wood, Woodston, Broadpath, Earls Gate, Lancing, Newhaven EfW and the Seal Sands HTI. Newhaven EfW is probably REPD "North Quay ERF", 3.25 km away with no shared token, so it may be a residual double count.
- Fossil, nuclear and fossil-CHP sites are never excluded.
- Known side effect: Drax's 75 MW gas GTs (GPPD) leave with the Drax site.

## Reconciliation with the offtakers power-station class
Class B has 358 sites; adding GPPD Glanford makes 359. Of these, 301 are kept and 58 are excluded by REPD. The `origin` field maps every feature back to its OT id. Findings:
1. **Bug in the live offtakers data.** OT-B-0823 "Marchwood Power Station" has subclass **biomass**, but its GPPD record is Gas, 842 MW. Marchwood is a CCGT. The live overlay therefore draws it as biomass. This set corrects the fuel to gas (`fuel_basis` says so). The fix belongs in OT-filter `power_subclass`.
2. 20 features have a co-located twin within 100 m, for example Barry and Cadoxton at the same point, and Harbourne and Tillingham. They are flagged in `colocated_ids` so the engine can merge or de-duplicate them, rather than this set guessing.
3. 167 sites are NAEI power producers whose fuel no open source states (peaking/STOR and thermal_unspecified). DUKES 5.11 would resolve most of them.

## Gaps and next step
The fix is to run on a runner that can reach gov.uk and NESO, such as GitHub Actions:
- fetch DUKES 5.11 (OGL) and parse it with the standard library (xlsx is a zip of XML, so this is easy);
- join it by name and distance;
- replace GPPD MW with DUKES 2026 installed capacity, and fill fuel, technology and status for the 167 "unstated" sites;
- add TEC "Built" and "Under construction" gas/OCGT/reciprocating projects as `construction`, placed at the connection-site substation with coarse precision.

Until then:
- "operational" means reported to NAEI in 2023;
- GPPD MW is about 2018-19;
- the only construction-status record is Hinkley Point C.
