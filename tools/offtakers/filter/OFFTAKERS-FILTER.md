FILTER READY

# Potential offtakers: data filter (lane OT-filter)

29 Oct 2026. In this folder: `ot_filter.py` (stdlib Python, deterministic), `data/` (inputs; sha256 in the output header), `out/` (GeoJSON, counts, top-20 lists, run log), `licences.md` (quoted licence findings). Owner's rules of 02:57 UTC applied.

Run: `python3 -I ot_filter.py --data data --out out [--dukes DUKES_5.11.xlsx] [--tec tec-register.csv]`. Two runs give sha256 `b31a369e51040aa8…`. Output: **1,645 features**, 2.28 MB raw, **97 kB gzip**.

## 1. Categories

Every feature carries `class`, `subclass`, `size_metric` (value, unit, source, basis), `emission_band_naei_2023`, `status`/`status_date`/`status_source`, `onsite_combustion_indicator`, `records[]`, `osm_corroboration[]`, `inclusion_rule`, `sources[]` (name, URL, licence) and the fixed `screening_note`.

**Size metric.** The only open, site-level metric that covers industry is the NAEI 2023 GHG point-source figure. It is shown **as a band only** (<1, 1–10, 10–25, 25–100, ≥100 kt CO2e-approx), never as a number, because the repo's figure converts CO2 "as carbon" ×44/12 and adds other gases at raw mass (PW-design O2). Plausibility check: Pembroke 4.0 Mt and Ratcliffe 2.7 Mt for 2023 fit CO2 reported as carbon and converted; without the conversion they would be 1.1 and 0.7 Mt, too low for their 2023 output. The pollutant string in the 2024 workbook must still be read before any number is shown. Band boundaries: 10 kt ≈ 50 GWh of gas a year (about 6 MW thermal continuous); 25 kt is the UK ETS "small emitter" limit.

| class | subclasses | inclusion | threshold ("large") | excluded |
|---|---|---|---|---|
| **A Energy-intensive industry** (870) | cement 16, lime 11, bricks/clay 50, glass 21, gypsum board 16, insulation 3, ceramics 7, aggregates/asphalt 83, minerals other 6, steel 49, non-ferrous 16, paper/pulp 50, chemicals 138, refinery 13, petroleum other 8, food & drink 208, oil/gas terminal 32, gas processing/LNG/compressor 37, other manufacturing 106 | NAEI sector in the map (table in script), country not Offshore. Minerals split by name/operator keywords. OSM industry only with a strong keyword (refinery, steelworks, paper mill, glassworks, cement, chemical works): 4 sites added, 31 corroborate NAEI | all NAEI-listed sites kept (a NAEI point source is already a regulated large site); band drives dot size; default chip ≥1 kt | Offshore (159), OSM fuel depots/wells (127), OSM stockholders (13) |
| **B Power stations** (366) | gas CCGT large 25, gas other 19, peaking/reserve 103, CHP/energy centre 30, biomass 24, EfW 32, landfill/biogas 11, nuclear 12, coal 7, oil 11, thermal unspecified 92 | NAEI Major+Minor power producers; NAEI waste sector with EfW/ERF keyword and ≥10 kt; GPPD GBR Coal/Gas/Oil/Nuclear/Cogeneration (DUKES-derived, CC BY); OSM power=plant gas/nuclear | none: a closed 2 GW coal site is the point of rule 2 | landfills without a generator keyword (504), unnamed unmatched OSM plants (16) |
| **C Data centres** (176) | data_centre 159, data_centre_campus 17 (≥2 OSM objects within 250 m) | NAEI Commercial rows with "data centre" in the name (31 sites, the ones with standby/CHP combustion) plus OSM data centres grouped at 250 m | **no open IT-load metric exists**; "large" cannot be defined honestly; 23 NAEI-listed centres are the best proxy | none; 51 unnamed OSM rows show "name not listed" |
| **D Large water/wastewater** (176) | water_wastewater_large 8 (band ≥1 kt), water_wastewater_listed_small 168 | **only NAEI-listed** water & sewerage sites (regulated works reporting emissions); OSM water points within 500 m corroborate (96 merged) | ≥1 kt band = large (Beckton, Middlesbrough, Avonmouth, Crossness, Belfast, Levenmouth…). The listed-small tier is off by default; it is almost all sewage-gas CHP engines | **5,602 OSM water/wastewater rows dropped** (owner rule 1) |
| **E Other large energy users** (57) | public campus 51, commercial 6 | NAEI Public administration or Commercial, ≥10 kt, with a campus or CHP keyword (hospitals, universities, AWE, ports, airports, naval base) | 10 kt | 273 small public/commercial rows; agriculture 15, construction 8, misc 5 |

The proper water metric is **population equivalent**: UWWTD reporting uses ≥150,000 p.e. as its top class; England has 1,451 works above 2,000 p.e. (OGL, 2022). The per-works table (data.gov.uk "Wastewater treatment in England"; EEA Waterbase UWWTD 2018) was not fetchable this session; when it is, D should switch to `p.e. ≥ 150,000`.

## 2. Data sources and licences

Verdicts and quotes are in `licences.md`.

| class | source used now | licence | status |
|---|---|---|---|
| A, B, C, D, E | NAEI 2023 point sources via `heavy_emitters_uk.json` (2,458 rows; sha `9d603ac9…`) | **OGL v3**, now verified on the NAEI site itself: "published by Defra, DESNZ and the Devolved Governments under the Open Government Licence" (closes O1) | 2024 workbook (103 MB) exists; refetch recommended |
| B | WRI Global Power Plant Database v1.3.0, GBR Coal/Gas/Oil/Nuclear/Cogeneration (89 rows; sha `4b1f93e0…`) | **CC BY 4.0** (README) | fetched; capacities are DUKES 2018–19; coordinates from GEODB/CARMA can be 1–3 km off (Kilroot and West Burton CCGT appear twice because of this) |
| B | `power_plants.geojson` (OSM power=plant gas/nuclear, 178) | ODbL | fetched from repo |
| A, C, D | `industrial_offtakers.geojson`, `datacentres.geojson` (OSM) | ODbL | repo files; now only corroboration plus 4 industrial and 145 data-centre sites |
| B status | `data/status_curated.csv`: 35 rows, each with a public URL | n/a | written from knowledge; **none re-verified in session**; builder to check each URL |
| B (recommended) | **DUKES 5.11** "Power stations in the UK, May 2026" xlsx | **OGL v3** | not fetchable (gov.uk assets refused by proxy); `--dukes` loader is header-driven and ready |
| B (recommended) | **NESO TEC register** CSV | NESO Open Licence, "based on version 3.0 of the Open Government Licence", commercial use allowed, attribution "Supported by National Energy SO Open Data" | not fetchable; `--tec` loader joins on exact normalised name only |
| A (recommended) | UK ETS allocation table (installations and operators) | OGL v3 | no location or activity column; name join only |
| rejected | EA "EPR Industrial Sites", EA Pollution Inventory, EA UWWTD plants | **Environment Agency Conditional Licence** (one-year term) | fails rule 4, even though the PI is NAEI's upstream for England |
| rejected | Wikipedia lists, operator maps | CC BY-SA / proprietary | not in the owner's list |

**ODbL note.** OSM is open with attribution and share-alike, not in the owner's literal list. OSM now supplies only data-centre dots, 65 small OSM-only plants and corroboration; if the owner excludes ODbL, class C falls to the 31 NAEI-listed data centres.

**Reclassification of the existing files (counts).** NAEI: 1,494 of 2,458 rows kept, 964 excluded (Offshore 159, landfill/other waste 504, small public 160, small commercial 113, agriculture/construction/misc 28); 100 m grouping gives 1,412 sites. OSM industrial: 5,878 → 5 duplicates, 5,602 water dropped, 96 water and 31 industrial merged as corroboration, 127 depots dropped, 13 minor dropped, 4 kept. OSM data centres: 240 → 73 merged into NAEI sites, 167 grouped into 176 − 31 = 145 OSM-only sites. GPPD: 89 rows → 71 merged into existing sites, 18 new sites. OSM power=plant: 178 → 96 merged, 65 new, 16 unnamed dropped.

## 3. Behind-the-meter flag

There is **no fully open site-level register of on-site generation**: DUKES CHP site data is withheld ("commercially sensitive"), and the EA combustion/MCPD permit data is under the Conditional Licence. So the field is an **indicator with its evidence string**, never a capacity:

- `generator site (listed as power producer)` for class B (366);
- `CHP/energy centre named in record` where any merged record says CHP, cogeneration, energy centre or heat and power (75);
- `CO2 reported to NAEI ≥10 kt (fuel combustion on site is the usual source; not distinguished)` (352);
- `CO2 reported to NAEI (combustion and/or process emissions, not distinguished)` for cement, lime, glass, brick, ceramics, steel, gypsum and aggregates (112), where process CO2 is large;
- `CO2 reported to NAEI (<10 kt)` (591);
- `unknown (no open site-level register found)` for OSM-only rows (149).

Card wording: "On-site combustion: <indicator>. Source NAEI 2023. Not a measure of generation capacity." A real flag needs the UK ETS activity code or the EA permit activity; neither is openly available with coordinates.

## 4. Power-station status

Precedence: (1) curated table (name regex, status, date, URL, `verified_in_session`); (2) in NAEI 2023 → "operating 2023 (reported emissions to NAEI 2023)"; (3) GPPD/OSM only → "status unknown: not in NAEI 2023 point sources (may be closed, mothballed or small)"; (4) with `--dukes`, in the May 2026 list → "operational (listed in DUKES 5.11, May 2026)". Result: operating 2023 **269**, closed 14, closing 4 (Heysham 1/2, Hartlepool, Torness with EDF dates), converted 4 (Drax, Kilroot, Lynemouth), unknown 75.

Merging is **status-consistent**: a record joins a site only when the curated table gives the same answer for both names, so Cottam coal (closed) and Cottam Development Centre (operating, 395 MW), or West Burton A (closed) and West Burton B CCGT (operating), stay separate.

**Never claimed:** connection rights, TEC, or available capacity. `size_metric` for B is "MW installed capacity, GPPD v1.3.0 (DUKES-derived)", basis "published installed capacity, not connection capacity". A `tec_register` block appears only when `--tec` is supplied and the normalised project name matches exactly; the card then reads "TEC register (NESO, open licence): <MW connected>, <status>, as published". The NESO licence is OGL-derived and fully open; the owner should confirm it counts.

## 5. Result

Counts per class and nation (NAEI nation field; "(approx)" rows for OSM/GPPD use a coarse geometric fallback and are folded in):

| class | England | Scotland | Wales | N. Ireland | total |
|---|---:|---:|---:|---:|---:|
| A industry | 613 | 153 | 81 | 23 | 870 |
| B power | 284 | 37 | 38 | 7 | 366 |
| C data centres | 153 | 10 | 11 | 2 | 176 |
| D water | 156 | 7 | 11 | 2 | 176 |
| E other | 47 | 6 | 1 | 3 | 57 |

Default-on dots (A + B + C + D-large) = 1,420; 1,645 with E and D-small on. All under the 10,000 phone cap.

**Default chips (resolved by R-otdata, 29 Oct 2026):** E "Other large users" is **off by default**, as the §6 table and this count line say; the OT-build module had it on (`src/01-data.js` CLS e flag 1). After the R-otdata corrections (§7) the counts are A 813, B 358, C 164, D-large 8, D-small 168, E 57: **1,343 default-on dots**, 1,568 with every chip on.

The 20 largest per class are in `out/top20_per_class.md`. Sanity reading: A is led by British Sugar Wissington and Bury, Winnington soda ash, Wilton, Tunstead cement, Stanlow and the gas terminals; B by Pembroke 2,180 MW, then the closed coal sites West Burton A, Cottam, Ratcliffe, Eggborough and Aberthaw, Drax (biomass), Staythorpe, Didcot B, Grain, the CHPs at Immingham and Saltend and the AGR fleet; C by Amazon Hemel Hempstead; D by Middlesbrough and Beckton; E by Port of Liverpool CHP and hospital CHPs.

**Known limits.** GPPD duplicates where its coordinate is >2.5 km off (Kilroot ×2); 92 power producers with non-specific names fall in `thermal_unspecified`; nation is approximate for non-NAEI rows; status table unverified; no 2024 NAEI refresh.

## 6. UI

Palette: a **copper-to-teal family**, away from lightning violet, REPD `#ffcc00→#ff4444`/`#00ff88`, the substation teal `#5fbdc2` and white substations.

| chip | class | fill | stroke | radius z6→z12 (×1.0/1.25/1.5 by band <10/10–100/≥100 kt or by MW <100/100–1000/≥1000) | default |
|---|---|---|---|---|---|
| Industry | A | `#e07b39` copper | `#3a1d0a` | 3→6 | on |
| Power stations | B | `#f2c14e` amber-gold with a dark centre dot; closed/closing/converted sites draw a **hollow ring** | `#3a1d0a` | 3.5→7 | on |
| Data centres | C | `#2ec4b6` teal-green | `#ffffff` 1 px | 3→6 | on |
| Water (large) | D | `#4f86c6` steel blue | none, opacity 0.8 | 3→5 | on (large) / off (listed-small sub-chip) |
| Other large users | E | `#a26769` dusty rose | `#3a1d0a` | 3→5 | off |

Chips: `[All] [Industry] [Power] [Data centres] [Water] [Other]`; second row for B `[Operating] [Closing] [Closed/converted] [Unknown]`. Legend footer: "Dot size: emission band (NAEI 2023) or installed MW (GPPD). Hollow ring: closed or closing station."

Card header: **"Potential offtaker (screening): not a confirmed demand, contract or connection."** Record line: "<name> · operator (<source>) <operator> · <subclass>". Size line: "Emission band 25–100 kt CO2e-approx, NAEI 2023 (band only; method under check)" or "2,000 MW installed (GPPD, DUKES-derived), closed 2024-09-30 (source linked)". Combustion line as §3. Footer: "Not shown here: electricity use, connection terms, TEC, consent, viability." The overlay spec's banned-word lint applies.

## 7. R-otdata corrections (29 Oct 2026)

Evidence: `hardening/evidence/R-otdata/` (STATUS-VERIFY.md, DIFF-SUMMARY.md, ODBL.md, qa_points_*.json, diff.json). Output 1,568 features (was 1,645), sha256 `6fc20e04fdcaadc5…`, deterministic.

- **Status table re-verified**: every one of the 35 rows was checked against a fetched public page; `verified_in_session` is now yes/partial. Eight dates were wrong (Heysham 1 and Hartlepool now March 2028; Eggborough 2018-03-23; Drax coal units 2023-03; Uskmouth 2017-04; Baglan Bay 2020-07; Deeside 2018-03; Roosecote 2012; Teesside 2011-04). Three regexes hit the wrong plant (`deeside` hit the Parc Adfer EfW; `oldbury` hit the Oldbury, West Midlands standby plant and drew it as a closed nuclear station; `grain` hit GPPD "Grain GT"). Hinkley Point C's NAEI row is a construction site, not a generator.
- **Site-level merge (class A)**: NAEI points of one works join when the operator is the same (alias Corus → Tata Steel), they share a site-name token that is not a process word, and a record lies within 1,500 m of a record of the other (single linkage). Port Talbot (9 NAEI points, spread 2.65 km) and Scunthorpe (10 points, 3.5 km) are one dot each; 38 further two- or three-point works merge (sugar factories, refineries, plasterboard, Llanwern, Shotton). Every NAEI row stays in `records[]` with its own coordinates and band; `site_merge` states the rule and spread.
- **Wrong or duplicate points**: GPPD Bowmore (North Sea off Fife) folded into NAEI Bowmore (Islay); NAEI Kilroot point (3.5 km off, Belfast Lough shore) replaced by the GPPD point; GPPD duplicates 2.5–5 km off (Kilroot, Spalding, Burghfield, Chickerell, Slough, Baglan Bay OCGT) merged when unambiguous; the OSM Heysham point is corroboration; 12 OSM cable landing stations dropped from data centres; Queens Medical Centre listed in A and E merged.
- **Licence**: OSM data and NAEI/GPPD data are mixed within the same feature types, so the shipped file is an ODbL Derivative Database (see ODBL.md). The file states `licence: ODbL-1.0` with the OGL and CC BY attributions; the overlay footer carries "Contains OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0".
