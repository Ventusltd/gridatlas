import json, sys
OGL = {"licence": "OGL v3.0", "licence_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", "fully_open": "yes"}
NESO_DOC = {"licence": "unverified: Crown-style publication, no licence statement found on the document; NESO Open Data Licence (OGL v3-based, attribution 'Supported by National Energy SO Open Data') covers only data-portal datasets", "licence_url": "https://www.neso.energy/data-portal/neso-open-licence", "fully_open": "unverified"}
PARL = {"licence": "Open Parliament Licence v3.0", "licence_url": "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/", "fully_open": "yes (licence statement not re-read on page: unverified)"}
PRESS = {"licence": "proprietary press coverage, cite only, do not reuse text", "licence_url": None, "fully_open": "no"}
U = {
 "covenant": "https://www.gov.uk/government/publications/data-centre-covenant/the-data-centre-covenant",
 "roadmap": "https://www.gov.uk/government/publications/uk-compute-roadmap/uk-compute-roadmap",
 "annex": "https://assets.publishing.service.gov.uk/media/69d8dae9d3e08b8871b66599/compute-evidence-annex-final.pdf",
 "desnz": "https://assets.publishing.service.gov.uk/media/6a3e9f25da47783d87723bf2/Data_centre_electricity_consumption_in_Great_Britain__2020_to_2024.pdf",
 "dukes": "https://assets.publishing.service.gov.uk/media/6aba96e8997a4b2950ccf02c/DUKES_2026_Chapter_5.pdf",
 "dukes_note": "https://assets.publishing.service.gov.uk/media/6a6a35c50ddb7e4831c629ed/DUKES_2026_Chapter_5.pdf",
 "dcu": "https://committees.parliament.uk/writtenevidence/166090/html/",
 "tyo": "https://www.neso.energy/document/388756/download",
 "dcd": "https://www.datacenterdynamics.com/en/news/uk-grid-operator-high-uncertainty-on-data-center-growth-makes-forecasting-hard-could-range-from-30-71twh-by-2050/",
 "foi": "https://www.neso.energy/foi-26-183-data-centre-projects-electricity-connections-queue-22-september-2026",
 "bb": "https://www.neso.energy/data-portal/future-energy-scenario-fes-building-block-data/fes_2025_building_blocks",
 "guardian": "https://www.inkl.com/news/uk-departments-at-odds-over-energy-demands-of-ai-datacentres",
}
def f(id, figure, value, unit, year, geo, measure, src, lic, verified, quote=None, notes=None, publisher=None, published=None):
    d = {"id": id, "figure": figure, "value": value, "unit": unit, "year": year, "geography": geo,
         "measure": measure, "source_url": src, "publisher": publisher, "published": published, **lic,
         "verified": verified}
    if quote: d["quote"] = quote
    if notes: d["notes"] = notes
    return d
figs = [
 # Policy targets
 f("covenant_6gw", "AI data-centre capacity required by 2030 (Data Centre Covenant)", 6, "GW", 2030, "UK",
   "UNDEFINED: not stated whether IT load or grid connection", U["covenant"], OGL, "yes (fetched 2026-10-29)",
   "will require 6 GW of AI data centre capacity by 2030", "No TWh, load factor or definition of the GW given. Asks new facilities to design for PUE 1.3 or better.", "HM Treasury", "2026-10-28"),
 f("covenant_pue", "Design PUE asked of new facilities (Covenant)", 1.3, "ratio (facility power / IT power)", None, "UK",
   "efficiency ratio", U["covenant"], OGL, "yes", "a Power Usage Effectiveness of 1.3 or better", None, "HM Treasury", "2026-10-28"),
 f("roadmap_6gw", "AI-capable data-centre capacity the UK will need by 2030 (Compute Roadmap)", 6, "GW", 2030, "UK",
   "'AI-capable data centre capacity'; the evidence annex measures capacity as IT load, but the roadmap text itself does not say", U["roadmap"], OGL, "yes",
   "We forecast that the UK will need at least 6GW of AI-capable data centre capacity by 2030 ... a threefold increase on the data centre capacity that is available in the UK today",
   "First published 17 July 2025, updated 23 April 2026. AI Growth Zones: 'each capable of serving at least 500MW of demand by 2030', at least one >1 GW.", "DSIT", "2025-07-17"),
 f("annex_it_load_now", "Current UK data-centre IT load capacity (Compute evidence annex)", 1.8, "GW (IT load)", 2024, "UK",
   "IT load", U["annex"], OGL, "yes",
   "Around 1.8GW of UK's IT load (power capacity) is currently used to power around 330 data centres around the country.",
   "Figure 3 labels it 2024 IT load capacity, broken down by ownership type, not region. No 'threefold' wording in the annex (that is in the roadmap page). A July 2025 edition is at https://assets.publishing.service.gov.uk/media/687f74f4fdc190fb6b846868/compute-evidence-annex-final.pdf", "DSIT", "2025 (Crown copyright 2025)"),
 f("annex_site_count", "Number of UK data centres behind the 1.8 GW", 330, "sites (approx.)", 2024, "UK", "count", U["annex"], OGL, "yes", "around 330 data centres", None, "DSIT", "2025"),
 # Metered
 f("desnz_2024", "GB data-centre electricity drawn from the grid (meter data)", 4.5, "TWh", 2024, "GB", "metered energy", U["desnz"], OGL, "yes",
   "an estimated 4.5 TWh (2%)", "Of 249.2 TWh consumed from the grid. Official Statistics in Development; excludes enterprise (in-house) data centres; 2,423 sites matched to meters. 2025 update planned for 2027. Also quoted in DUKES 2026 Ch.5.", "DESNZ (Energy Trends special article)", "2026-06-30"),
 f("desnz_2023", "GB data-centre electricity drawn from the grid (meter data)", 4.1, "TWh", 2023, "GB", "metered energy", U["desnz"], OGL, "yes", None,
   "DESNZ notes NESO's 7.6 TWh for 2023 is capacity-based, and ND-NEED gives 2.6 TWh for England and Wales.", "DESNZ", "2026-06-30"),
 f("desnz_growth_2020_2024", "Growth in GB data-centre grid consumption 2020-2024", 1.3, "TWh (+41%)", "2020-2024", "GB", "metered energy", U["desnz"], OGL, "yes", "increased by 1.3 TWh (41%)", None, "DESNZ", "2026-06-30"),
 # NESO
 f("fes2025_baseline_twh", "FES 2025 estimate of current GB data-centre demand", 7.6, "TWh", 2023, "GB", "modelled energy (capacity-based)", U["dcd"], PRESS,
   "secondary only: quoted by DCD and by DESNZ (as 2023); FES primary document not fetched",
   "Data center demand in Great Britain is estimated at 7.6TWh from the 2.4GW connected facilities", "Year 2023 per DESNZ's article. Implied utilisation 7.6/(2.4x8.76) = 36% (calculation, not a NESO figure).", "NESO via DCD", "2025-07"),
 f("fes2025_baseline_gw", "FES 2025 connected GB data-centre capacity", 2.4, "GW (connected)", 2023, "GB", "connected capacity", U["dcd"], PRESS, "secondary only (DCD)", None,
   "Connection capacity, not IT load. Compare DSIT's 1.8 GW IT load (UK).", "NESO via DCD", "2025-07"),
 f("fes2025_2050_range", "FES 2025 GB data-centre demand range in 2050", "30-71", "TWh", 2050, "GB", "modelled energy", U["dcd"], PRESS, "secondary only (DCD)", "2050 demand ranging from 30-71 TWh", None, "NESO via DCD", "2025-07"),
 f("fes2025_2030_gw_range", "FES 2025 range of GB data-centre capacity in 2030", "3.7-6.3", "GW (connected)", 2030, "GB", "connected capacity", U["dcu"], PARL, "yes (DCU0081)",
   "explored a range of potential data centre capacities between 3.7 and 6.3 Gigawatts in 2030", None, "NESO", None),
 f("dcu_2030_gw", "NESO ten-year forecast of connected GB data-centre capacity, 2030", 5.2, "GW (connected)", 2030, "GB", "connected capacity", U["dcu"], PARL, "yes",
   "around 5.2 GW of connected capacity and just over 20 TWh of demand by 2030", "DCU0081 to the Environmental Audit Committee; undated (refers to 2025 pipeline data). Superseded in part by the 2026 10-Year Outlook.", "NESO", None),
 f("dcu_2030_twh", "NESO forecast GB data-centre demand, 2030", 20, "TWh (just over)", 2030, "GB", "modelled energy", U["dcu"], PARL, "yes", "just over 20 TWh of demand by 2030",
   "Implied utilisation 20/(5.2x8.76) = 44% (calculation, not a NESO figure).", "NESO", None),
 f("dcu_requests", "Data-centre connection requests (GB)", 70, "GW (exceeds; connection requests)", "2025 pipeline", "GB", "requested connection capacity", U["dcu"], PARL, "yes",
   "connection requests now exceed 70 GW; around 72.8 GW of connection requests through to 2039",
   "Nearly 59 GW awaiting transmission connection; 57.8 GW from projects of 100+ MW; 40 of 173 queued projects are 500-1500 MW. Requests are not commitments.", "NESO", None),
 f("dcu_ramp", "Average ramp from connection to full demand", 7, "years", None, "GB", "assumption", U["dcu"], PARL, "yes", "average ramp rate ... of seven years", None, "NESO", None),
 f("dcu_scotland_cap", "Maximum share of future data-centre demand in Scotland", 20, "%", None, "Scotland", "assumption", U["dcu"], PARL, "yes", "a maximum of 20% of future data centre demand could be located in Scotland", "Only regional number NESO gives. Existing sites mostly London and South-East.", "NESO", None),
 f("tyo_2026", "NESO 10-Year Outlook GB data-centre demand", 5.4, "TWh", 2026, "GB", "modelled energy", U["tyo"], NESO_DOC, "yes (read from chart labels on slide 17)", None, "EMAC slides, 22 Sep 2026.", "NESO", "2026-09-22"),
 f("tyo_2031", "NESO 10-Year Outlook GB data-centre demand", 14.6, "TWh", 2031, "GB", "modelled energy", U["tyo"], NESO_DOC, "yes (chart labels)", None, None, "NESO", "2026-09-22"),
 f("tyo_2036", "NESO 10-Year Outlook GB data-centre demand", 23.5, "TWh", 2036, "GB", "modelled energy", U["tyo"], NESO_DOC, "yes (chart labels)", None, None, "NESO", "2026-09-22"),
 f("tyo_utilisation", "NESO 10-Year Outlook utilisation assumption", None, "% of connected capacity", None, "GB", "assumption", U["tyo"], NESO_DOC, "not published as a number",
   "Reduction in data centre demand primarily due to updated data around utilization and project attrition rates", "Unknown is not zero: NESO gives no numeric utilisation or connected-GW figure that could be read reliably.", "NESO", "2026-09-22"),
 f("tyo_speculative", "Share of data-centre pipeline capacity possibly speculative or duplicative", 50, "% (close to)", None, "GB", "stakeholder estimate", U["tyo"], NESO_DOC, "yes",
   "close to 50% of project capacity may be from 'highly speculative' or duplicative applications", None, "NESO", "2026-09-22"),
 f("tyo_gb_demand", "GB electricity demand (excl. losses), NESO 10-Year Outlook", {"2025": 269, "2036": 368}, "TWh", "2025/2036", "GB", "modelled energy", U["tyo"], NESO_DOC, "yes", None,
   "EVs + heat pumps + data centres: 4.7% of demand in 2025 rising to 23.9% in 2036 (combined only).", "NESO", "2026-09-22"),
 f("foi_queue", "Data-centre projects in the demand connection queue", {"projects": 315, "GW": 73}, "count / GW (contracted)", "2026", "GB", "contracted connection capacity", U["foi"], NESO_DOC, "yes (quoting an Ofgem consultation)",
   "around 315 data centre projects ... approximately 73 GW of the total demand queue", "Project sizes 1-1,500 MW. FOI/26/183, 22 Sep 2026.", "NESO", "2026-09-22"),
 # DUKES
 f("dukes_2025_demand", "UK total electricity demand", 323, "TWh", 2025, "UK", "energy", U["dukes"], OGL, "yes", "Electricity demand was higher in 2025 at 323 TWh",
   "The note's URL (" + U["dukes_note"] + ") is indexed under the same title but could not be fetched from this session; figures verified at the alternate asset URL.", "DESNZ (DUKES 2026)", "2026"),
 f("dukes_2025_final", "UK final electricity consumption", 275.5, "TWh", 2025, "UK", "energy", U["dukes"], OGL, "yes", "Final consumption also rose to 275.5 TWh", None, "DESNZ (DUKES 2026)", "2026"),
 f("dukes_2025_gen", "UK electricity generation", 293.6, "TWh", 2025, "UK", "energy", U["dukes"], OGL, "yes", "electricity generation rose to 293.6 TWh in 2025", None, "DESNZ (DUKES 2026)", "2026"),
]
regional = {
 "neso_gsp_breakdown": {"status": "not found",
   "detail": "No NESO data-centre breakdown by GSP or region was found in DCU0081, the 2026 10-Year Outlook slides (pipeline split only into transmission and distribution) or FOI/26/183. The FES 2025 Building Blocks are published at GSP level under the NESO Open Data Licence (" + U["bb"] + "), but no data-centre building block ID could be confirmed: unverified. If one exists, it is the open route to GSP figures.",
   "fully_open": "unverified"},
 "desnz_2024_regions": {"source_url": U["desnz"], **OGL, "unit": "TWh (metered, 2024)", "geography": "GB",
   "values": {"South East": 1.8, "of which Slough": 1.3, "of which Hampshire": 0.2, "London": 1.7, "of which Outer London": 1.2, "of which Inner London": 0.5,
              "of which Hillingdon": 0.5, "of which Tower Hamlets": 0.4, "Rest of GB": 1.0, "of which South West and Wales": 0.4, "of which East of England": 0.3},
   "shares": {"South East": "40%", "London": "37%", "Rest of GB": "23%"},
   "notes": "Slough rose from 0.6 TWh (2020) to 1.3 TWh (2024). Sub-items overlap as reported by DESNZ; do not sum them."},
}
derived = [
 {"calc": "6 GW x 8,760 h", "value": 52.56, "unit": "TWh", "status": "ceiling: 100% utilisation of 6 GW; not a forecast"},
 {"calc": "52.56 / 323 (DUKES demand 2025)", "value": 0.163}, {"calc": "52.56 / 275.5 (final consumption)", "value": 0.191},
 {"calc": "6 GW IT x PUE 1.3 x 8,760 h", "value": 68.3, "unit": "TWh", "status": "only if 6 GW is IT load at full load"},
 {"calc": "6 GW x 44% x 8,760 h (NESO DCU0081-implied utilisation)", "value": 23.1, "unit": "TWh", "share_of_323": 0.072},
 {"calc": "6 GW x 85% x 8,760 h", "value": 44.7, "unit": "TWh", "share_of_323": 0.138},
 {"calc": "FES 2025 implied utilisation 7.6 / (2.4 x 8.76)", "value": 0.36},
 {"calc": "DCU0081 implied utilisation 20 / (5.2 x 8.76)", "value": 0.44},
]
note_check = [
 {"claim": "Covenant: 28 Oct 2026, HM Treasury, 6 GW by 2030, no definition/TWh/load factor, PUE 1.3", "result": "confirmed"},
 {"claim": "Annex: capacity in GW of IT load, ~1.8 GW across ~330 data centres", "result": "confirmed"},
 {"claim": "'DSIT called that a threefold increase'", "result": "confirmed on the Compute Roadmap page, not in the evidence annex the note cites"},
 {"claim": "DUKES 2026: 323 / 275.5 / 293.6 TWh in 2025", "result": "confirmed (alternate asset URL; the note's URL is not reachable from this session)"},
 {"claim": "NESO DCU0081: ~5.2 GW, just over 20 TWh in 2030, >70 GW requests, 7-year ramp", "result": "confirmed"},
 {"claim": "FES 2025 baseline 7.6 TWh from 2.4 GW", "result": "confirmed via DCD and DESNZ (DESNZ dates it to 2023); NOT in DCU0081, which the note's sentence implies"},
 {"claim": "DESNZ meter data 4.5 TWh in 2024", "result": "confirmed; excludes enterprise data centres; the note gives no URL for it (added here)"},
 {"claim": "10-Year Outlook 5.4 / 14.6 / 23.5 TWh; lower utilisation + attrition; ~half speculative; 269 -> 368 TWh; 4.7% -> 23.9%", "result": "confirmed (data-centre TWh read from chart labels)"},
 {"claim": "'Industry feedback ... seven-year average ramp'", "result": "source is DCU0081, not the 10-Year Outlook slides (no ramp years there)"},
 {"claim": "Guardian: 528 MW commercial-services growth, 34-123 MtCO2, >100x revision", "result": "confirmed (via inkl; undated)"},
 {"claim": "Arithmetic (52.56, 16%/19%, 68 TWh, 23-45 TWh, 30%)", "result": "confirmed; 45 TWh is 13.8% of 323, so '7 to 15 per cent' is better stated as '7 to 14 per cent'"},
 {"claim": "AEMO 45-51%, CEC ~67%, FiT 9.2%, solar DC/AC, 407 TWh in 2005", "result": "not re-verified (outside this lane's data-centre scope)"},
]
about = open(sys.argv[1]).read().strip()
out = {"lane": "DC-A9", "compiled": "2026-10-29", "scope_note": "Aggregates only. Geographies differ: DSIT/DUKES/Covenant are UK; NESO and DESNZ meter data are GB. IT load (DSIT) and connection capacity (NESO) are different measures and must never be added, subtracted or compared as like-for-like.",
       "it_load_vs_connection": "IT load = power used by computing equipment. Grid connection capacity = maximum import agreed with the network, covering IT plus cooling, losses and headroom (roughly IT x PUE, plus margin). Connection requests are a further, larger, speculative quantity.",
       "figures": figs, "regional": regional, "derived_calculations_not_source_figures": derived, "owner_note_verification": note_check,
       "about_text": about, "about_text_words": len(about.split())}
json.dump(out, open(sys.argv[2], "w"), indent=2, ensure_ascii=False)
print(len(figs), "figures;", out["about_text_words"], "words")
