#!/usr/bin/env python3
"""
Potential-offtakers filter (lane OT-filter), 29 Oct 2026.

Deterministic. Standard library only. Run with:  python3 -I ot_filter.py --data data --out out

Inputs (data/):
  heavy_emitters_uk.json       NAEI 2023 point sources (globalgrid2050 @ 4f0f3a9b), OGL v3
  manifest_heavy_emitters.json NAEI manifest (source URL, year, formula)
  industrial_offtakers.geojson OSM industrial (ODbL)
  datacentres.geojson          OSM data centres (ODbL)
  power_plants.geojson         OSM power=plant gas+nuclear (ODbL)
  gppd/gppd.csv                WRI Global Power Plant Database v1.3.0 (CC BY 4.0); GBR rows only
  status_curated.csv           curated power-station status overrides, each with a source URL
Optional (not fetchable in this session; loaders are header-driven and skipped when absent):
  dukes_5_11.xlsx              DUKES 5.11 power stations (OGL v3)      --dukes <path>  (needs openpyxl)
  tec_register.csv             NESO TEC register (NESO Open Licence)   --tec <path>

Outputs (out/): offtakers_filtered.geojson, excluded_counts.json, top20_per_class.md, counts.md, run_log.txt
"""
import argparse, csv, hashlib, json, math, os, re, sys
from collections import Counter, defaultdict, OrderedDict

GENERATION = "OT-filter-2026-10-29"
NAEI_URL = "https://naei.energysecurity.gov.uk/data/maps/emissions-point-sources"
NAEI_LIC = "OGL v3.0 (NAEI site: 'published by Defra, DESNZ and the Devolved Governments under the Open Government Licence')"
OSM_LIC = "ODbL 1.0, (c) OpenStreetMap contributors (open, attribution + share-alike; not in the owner's OGL/CC-BY/CC0 list: owner to confirm)"
GPPD_URL = "https://github.com/wri/global-power-plant-database"
GPPD_LIC = "CC BY 4.0 (WRI Global Power Plant Database v1.3.0)"
GG_RAW = "https://raw.githubusercontent.com/Ventusltd/globalgrid2050/4f0f3a9bf9fcd9560adf6ce2058adab4936fbe9f/"

WATER_TYPES = {"Wastewater Plant", "Water Works", "Water Treatment", "Sewage Plant", "Water", "Sewage"}
BBOX = (-11.0, 49.5, 3.0, 61.5)

# ---------- helpers ----------
def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def hav_km(a, b):
    lon1, lat1 = map(math.radians, a); lon2, lat2 = map(math.radians, b)
    d = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(d))

def in_bbox(c):
    return isinstance(c, (list, tuple)) and len(c) == 2 and all(isinstance(v, (int, float)) for v in c) \
        and BBOX[0] <= c[0] <= BBOX[2] and BBOX[1] <= c[1] <= BBOX[3]

def norm(s):
    s = (s or "").lower()
    s = re.sub(r"\b(ltd|limited|plc|llp|co|company|uk|the|power|station|generation|energy|centre|center|ccgt|chp|site|works|plant)\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return " ".join(s.split())

def tokens(s):
    return set(t for t in norm(s).split() if len(t) > 2)

def unknown(s):
    return (not s) or s.strip().lower().startswith("unknown") or s.strip().lower() in ("unnamed", "nan", "none")

def band(t):
    """Emission band from the NAEI-derived figure. Shown as a band, never as a number."""
    if t is None: return None
    if t >= 100000: return ">=100 kt"
    if t >= 25000: return "25-100 kt"
    if t >= 10000: return "10-25 kt"
    if t >= 1000: return "1-10 kt"
    return "<1 kt"

BAND_RANK = {None: -1, "<1 kt": 0, "1-10 kt": 1, "10-25 kt": 2, "25-100 kt": 3, ">=100 kt": 4}

# ---------- taxonomy ----------
# (A) energy-intensive industry subclass from NAEI sector, refined by name/operator keywords
MINERAL_KW = [
    ("glass", r"glass|pilkington|guardian industries|\bo-i\b|rockware|ardagh|encirc|quinn glass|beatson clark|stolzle"),
    ("bricks_clay", r"brick|ibstock|forterra|wienerberger|hanson building|clay|\btile|marley|plasmor|naylor|redland"),
    ("gypsum_board", r"gypsum|plasterboard|\bbpb\b|knauf|british gypsum|saint-gobain"),
    ("insulation", r"rockwool|knauf insulation|superglass|isover|armstrong world"),
    ("ceramics", r"ceramic|pottery|sanitary|wedgwood|churchill|steelite|norcros|imerys|prince minerals|unifrax"),
    ("aggregates_asphalt", r"quarry|asphalt|aggregate|tarmac|cemex|lafarge|hanson|breedon|roadstone|eurovia|civil and marine|mine\b|potash"),
]
SECTOR_MAP = {
    "Cement": ("A", "cement"),
    "Lime": ("A", "lime"),
    "Iron & steel industries": ("A", "steel"),
    "Non-ferrous metal industries": ("A", "metals_nonferrous"),
    "Paper, printing & publishing industries": ("A", "paper_pulp"),
    "Chemical industry": ("A", "chemicals"),
    "Processing & distribution of petroleum products": ("A", "refining_petroleum"),
    "Food, drink & tobacco industry": ("A", "food_drink"),
    "Other industries": ("A", "other_manufacturing"),
    "Vehicles": ("A", "other_manufacturing"),
    "Electrical engineering": ("A", "other_manufacturing"),
    "Mechanical engineering": ("A", "other_manufacturing"),
    "Textiles, clothing, leather & footwear": ("A", "other_manufacturing"),
    "Other fuel production": ("A", "other_manufacturing"),
    "Oil & gas exploration and production": ("A", "oil_gas_terminal"),
    "Processing & distribution of natural gas": ("A", "gas_processing_terminal"),
    "Other mineral industries": ("A", "minerals_other"),
    "Water & sewerage": ("D", "water_wastewater"),
    "Major power producers": ("B", None),
    "Minor power producers": ("B", None),
    "Waste collection, treatment & disposal": ("WASTE", None),
    "Public administration": ("E", "public_campus"),
    "Commercial": ("E", "commercial"),
    "Agriculture, forestry & fishing": ("X", "agriculture"),
    "Construction": ("X", "construction"),
    "Miscellaneous": ("X", "misc"),
}
EFW_KW = r"efw|energy from waste|energy recovery|\berf\b|resource recovery|incinerat|generating station|\bchp\b|power|energy works|waste to energy|recycling & energy|energy centre"
DC_KW = r"data ?cent(re|er)"
CAMPUS_KW = r"airport|naval base|port of|dockyard|university|hospital|infirmary|medical centre|nhs|awe\b|aldermaston|research|institute"

def power_subclass(name, operator, t):
    s = f"{name} {operator}".lower()
    if re.search(r"nuclear|hinkley|heysham|hartlepool|torness|sizewell|dungeness|hunterston|wylfa|oldbury|british energy|nnb generation|edf energy nuclear", s):
        return "nuclear"
    if re.search(r"biomass|renewable energy plant|steven's croft|markinch|lynemouth|drax|wood|pellet", s):
        return "biomass"
    if re.search(r"landfill|biogas|anaerobic|sewage gas", s):
        return "landfill_biogas"
    if re.search(r"efw|energy from waste|energy recovery|\berf\b|incinerat|waste", s):
        return "energy_from_waste"
    if re.search(r"\bchp\b|cogeneration|energy centre|heat (&|and) power|district|heat network|hospital|university|infirmary", s):
        return "chp_energy_centre"
    if re.search(r"peaking|reserve|\bstor\b|standby|velox|conrad|mercia power|rolls.royce power|plutus|statera|generation ltd|generation limited|flexible|ocgt|gas engine", s):
        return "peaking_reserve"
    if re.search(r"coal", s):
        return "coal"
    if t is not None and t >= 100000:
        return "gas_ccgt_large"
    return "thermal_unspecified"

# ---------- loaders ----------
def load_naei(path):
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for f in d["features"]:
        p = f["properties"]; c = f["geometry"]["coordinates"]
        out.append(dict(src="naei", id=p["id"], name=p["name"].strip(), operator=p["operator"].strip(),
                        sector=p["sector"], country=p["country"], datatype=p["datatype"],
                        t=float(p["emission_tco2e"]), lon=c[0], lat=c[1]))
    return out

def load_geojson(path, src):
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for i, f in enumerate(d["features"]):
        p = f.get("properties") or {}; g = f.get("geometry") or {}
        c = g.get("coordinates")
        if g.get("type") != "Point" or not in_bbox(c): continue
        out.append(dict(src=src, id=f"{src}-{i}", name=(p.get("name") or "").strip(), operator=(p.get("operator") or "").strip(),
                        type=p.get("type") or p.get("source") or "", lon=c[0], lat=c[1]))
    return out

def load_gppd(path):
    out = []
    with open(path, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["country"] != "GBR": continue
            if r["primary_fuel"] not in ("Coal", "Gas", "Oil", "Nuclear", "Cogeneration"): continue
            try: mw = float(r["capacity_mw"])
            except ValueError: mw = None
            out.append(dict(src="gppd", id=r["gppd_idnr"], name=r["name"].strip(), operator=r["owner"].strip(),
                            fuel=r["primary_fuel"], mw=mw, lon=float(r["longitude"]), lat=float(r["latitude"]),
                            year=r["commissioning_year"], gppd_source=r["source"], cap_year=r["year_of_capacity_data"]))
    return out

def load_status(path):
    rows = []
    with open(path, encoding="utf-8", newline="") as fh:
        for line in fh:
            if line.startswith("#") or not line.strip(): continue
            rows.append(line)
    rd = csv.DictReader(rows)
    return [dict(rx=re.compile(r["match_regex"], re.I), status=r["status"], date=r["status_date"],
                 note=r["fuel_note"], url=r["source_url"], verified=r["verified_in_session"]) for r in rd]

def load_dukes(path):
    """DUKES 5.11 (OGL). Header-driven: finds the sheet with 'Station Name' and 'Installed Capacity'."""
    if not path or not os.path.exists(path): return []
    try: import openpyxl
    except ImportError:
        print("openpyxl missing: DUKES skipped", file=sys.stderr); return []
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        hdr = None
        for row in ws.iter_rows(values_only=True):
            vals = [str(v).strip() if v is not None else "" for v in row]
            if hdr is None:
                if any("station name" in v.lower() for v in vals) and any("capacity" in v.lower() for v in vals):
                    hdr = [v.lower() for v in vals]
                continue
            rec = dict(zip(hdr, vals))
            name = next((rec[k] for k in hdr if "station name" in k), "")
            if not name: continue
            cap = next((rec[k] for k in hdr if "capacity" in k), "")
            out.append(dict(src="dukes", name=name, company=next((rec[k] for k in hdr if "company" in k), ""),
                            fuel=next((rec[k] for k in hdr if k.startswith("fuel") or "type" in k), ""),
                            mw=float(re.sub(r"[^0-9.]", "", cap) or 0) or None,
                            year=next((rec[k] for k in hdr if "year" in k), ""),
                            location=next((rec[k] for k in hdr if "location" in k or "region" in k), "")))
    return out

def load_tec(path):
    if not path or not os.path.exists(path): return []
    with open(path, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    out = []
    for r in rows:
        k = {kk.lower().strip(): (vv or "").strip() for kk, vv in r.items()}
        name = k.get("project name") or k.get("project_name") or ""
        if not name: continue
        out.append(dict(name=name, customer=k.get("customer name", ""), site=k.get("connection site", ""),
                        mw=k.get("mw connected", ""), status=k.get("project status", ""), plant_type=k.get("plant type", ""),
                        host=k.get("host to", "")))
    return out

# ---------- classification ----------
def classify_naei(r):
    """Returns (cls, subclass, reason) for one NAEI row, or ('X', sub, reason) when excluded."""
    if r["country"] == "Offshore":
        return "X", "offshore", "Offshore country: not a land site"
    cls, sub = SECTOR_MAP.get(r["sector"], ("X", "unmapped_sector"))
    s = f"{r['name']} {r['operator']}".lower()
    t = r["t"]
    if cls == "A" and sub == "minerals_other":
        for k, pat in MINERAL_KW:
            if re.search(pat, s): sub = k; break
    if cls == "A" and sub == "refining_petroleum" and re.search(r"refiner|stanlow|fawley|pembroke|grangemouth|humber|lindsey", s):
        sub = "refinery"
    if cls == "B":
        return "B", power_subclass(r["name"], r["operator"], t), "NAEI power-producer sector"
    if cls == "WASTE":
        if re.search(EFW_KW, s) and t >= 10000:
            return "B", "energy_from_waste", "NAEI waste sector, EfW/ERF keyword and >=10 kt"
        return "X", "waste_landfill_other", "waste sector without generator keyword or <10 kt"
    if cls == "E":
        if re.search(DC_KW, s):
            return "C", "data_centre", "NAEI commercial sector, data-centre keyword"
        if t >= 10000 and (re.search(CAMPUS_KW, s) or re.search(r"\bchp\b|energy centre", s)):
            return "E", sub, "NAEI public/commercial, >=10 kt, campus or CHP keyword"
        return "X", f"small_{sub}", "public/commercial <10 kt or no campus keyword"
    if cls == "D":
        if t >= 1000:
            return "D", "water_wastewater_large", "NAEI water & sewerage point source, band >=1 kt (large works)"
        return "D", "water_wastewater_listed_small", "NAEI water & sewerage point source <1 kt (listed, usually a sewage-gas CHP; off by default)"
    if cls == "X":
        return "X", sub, "sector outside taxonomy"
    return cls, sub, "NAEI sector map"

def btm_flag(cls, sub, s_lower, t, sources):
    """Honest on-site-combustion indicator. Values: evidence strings, never a claim of capacity."""
    if cls == "B": return "generator site (listed as power producer)"
    if re.search(r"\bchp\b|cogeneration|energy centre|heat (&|and) power|combined heat", s_lower):
        return "CHP/energy centre named in record"
    if "naei" in sources and t is not None and t >= 10000:
        if sub in ("cement", "lime", "glass", "bricks_clay", "ceramics", "steel", "gypsum_board", "aggregates_asphalt", "minerals_other"):
            return "CO2 reported to NAEI (combustion and/or process emissions, not distinguished)"
        return "CO2 reported to NAEI >=10 kt (fuel combustion on site is the usual source; not distinguished)"
    if "naei" in sources: return "CO2 reported to NAEI (<10 kt)"
    return "unknown (no open site-level register found)"

def nation(country, lon, lat):
    if country in ("England", "Scotland", "Wales", "Northern Ireland"): return country
    # OSM/GPPD rows carry no nation: coarse geometric fallback, flagged as approximate
    if lon < -5.3 and lat > 53.9 and lat < 55.4: return "Northern Ireland (approx)"
    if lat > 55.0 and not (lon > -2.5 and lat < 55.82): return "Scotland (approx)"
    if lon < -2.65 and 51.35 < lat < 53.45 and not (lon < -4.6 and lat < 51.75): return "Wales (approx)"
    return "England (approx)"

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data"); ap.add_argument("--out", default="out")
    ap.add_argument("--dukes", default=None); ap.add_argument("--tec", default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    log = []
    def L(*x): s = " ".join(str(v) for v in x); log.append(s); print(s)

    inputs = {}
    for fn in ["heavy_emitters_uk.json", "manifest_heavy_emitters.json", "industrial_offtakers.geojson", "datacentres.geojson",
               "power_plants.geojson", "gppd/gppd.csv", "status_curated.csv"]:
        p = os.path.join(a.data, fn); inputs[fn] = sha256(p); L("input", fn, inputs[fn][:16])
    manifest = json.load(open(os.path.join(a.data, "manifest_heavy_emitters.json")))
    naei = load_naei(os.path.join(a.data, "heavy_emitters_uk.json"))
    osm_ind = load_geojson(os.path.join(a.data, "industrial_offtakers.geojson"), "osm_ind")
    osm_dc = load_geojson(os.path.join(a.data, "datacentres.geojson"), "osm_dc")
    osm_pp = load_geojson(os.path.join(a.data, "power_plants.geojson"), "osm_pp")
    gppd = load_gppd(os.path.join(a.data, "gppd", "gppd.csv"))
    status_rows = load_status(os.path.join(a.data, "status_curated.csv"))
    dukes = load_dukes(a.dukes); tec = load_tec(a.tec)
    L("rows naei", len(naei), "osm_ind", len(osm_ind), "osm_dc", len(osm_dc), "osm_pp", len(osm_pp), "gppd GBR thermal", len(gppd),
      "dukes", len(dukes), "tec", len(tec))

    def status_of(name):
        for st in status_rows:
            if st["rx"].search(name): return st["status"] + st["date"]
        return None

    excluded = Counter(); reasons = defaultdict(Counter)
    sites = []  # merged site dicts

    # 1. NAEI rows: classify, then group rows within 100 m of same class (same operator or either unknown)
    kept = []
    for r in sorted(naei, key=lambda r: (int(r["id"]))):
        cls, sub, why = classify_naei(r)
        if cls == "X":
            excluded[f"naei:{sub}"] += 1; reasons["naei"][why] += 1; continue
        kept.append((cls, sub, why, r))
    L("naei kept", len(kept), "excluded", sum(v for k, v in excluded.items() if k.startswith("naei:")))

    for cls, sub, why, r in kept:
        merged = None
        for s in sites:
            if s["class"] != cls or s["_primary"] != "naei": continue
            if hav_km((s["lon"], s["lat"]), (r["lon"], r["lat"])) <= 0.1 and (
                    norm(s["operator"]) == norm(r["operator"]) or tokens(s["name"]) & tokens(r["name"])):
                if cls == "B" and status_of(s["name"]) != status_of(r["name"]): continue
                merged = s; break
        if merged:
            merged["records"].append(dict(source="NAEI", id=r["id"], name=r["name"], operator=r["operator"], sector=r["sector"]))
            merged["t"] = (merged["t"] or 0) + r["t"]
            if BAND_RANK[band(r["t"])] > BAND_RANK[band(merged["_t_lead"])]: merged["_t_lead"] = r["t"]
            continue
        sites.append(dict(_primary="naei", class_=None, **{"class": cls}, subclass=sub, name=r["name"], operator=r["operator"],
                          lon=r["lon"], lat=r["lat"], country=r["country"], t=r["t"], _t_lead=r["t"], mw=None, fuel=None,
                          records=[dict(source="NAEI", id=r["id"], name=r["name"], operator=r["operator"], sector=r["sector"])],
                          sources={"naei"}, why=why, osm_corroboration=[]))
    L("naei sites after 100 m grouping", len(sites))

    # 2. Power stations from GPPD (CC BY) and OSM power=plant (ODbL): merge into NAEI B sites within 1 km with a shared name token,
    #    otherwise add as new B sites.
    def merge_into_B(rec, src_label, dist_km=2.5):
        """Merge a GPPD/OSM power-plant record into an existing B site when: within dist_km, a shared name token
        (or the record is unnamed and within 0.5 km), and the curated status table gives the same answer for both
        names (so a closed coal station is never folded into the CCGT next door). Best match = most shared tokens, then nearest."""
        best = None
        for s in sites:
            if s["class"] != "B": continue
            d = hav_km((s["lon"], s["lat"]), (rec["lon"], rec["lat"]))
            shared = tokens(s["name"]) & tokens(rec["name"])
            if not ((d <= dist_km and shared) or (unknown(rec["name"]) and d <= 0.5)): continue
            if status_of(s["name"]) != status_of(rec["name"]): continue
            score = (len(shared), -d)
            if best is None or score > best[0]: best = (score, s)
        if best:
            s = best[1]; s["records"].append(dict(source=src_label, **{k: rec.get(k) for k in ("id", "name", "operator", "fuel", "mw", "year")}))
            s["sources"].add(rec["src"])
            if rec.get("mw") and not s["mw"]: s["mw"] = rec["mw"]; s["fuel"] = rec.get("fuel")
            fuel_sub = {"Coal": "coal", "Nuclear": "nuclear", "Oil": "oil"}.get(rec.get("fuel"))
            if fuel_sub and s["subclass"] in ("thermal_unspecified", "gas_ccgt_large", "gas_other"): s["subclass"] = fuel_sub
            return True
        return False

    for g in sorted(gppd, key=lambda g: g["id"]):
        if merge_into_B(g, "GPPD"): continue
        sub = {"Nuclear": "nuclear", "Coal": "coal", "Oil": "oil", "Cogeneration": "chp_energy_centre"}.get(g["fuel"])
        if not sub: sub = power_subclass(g["name"], g["operator"], None); sub = "gas_ccgt_large" if (sub == "thermal_unspecified" and (g["mw"] or 0) >= 300) else ("gas_other" if sub == "thermal_unspecified" else sub)
        sites.append(dict(_primary="gppd", **{"class": "B"}, subclass=sub, name=g["name"], operator=g["operator"], lon=g["lon"], lat=g["lat"],
                          country=None, t=None, _t_lead=None, mw=g["mw"], fuel=g["fuel"],
                          records=[dict(source="GPPD", id=g["id"], name=g["name"], operator=g["operator"], fuel=g["fuel"], mw=g["mw"], year=g["year"], gppd_source=g["gppd_source"])],
                          sources={"gppd"}, why="GPPD GBR thermal plant (DUKES-derived), not in NAEI 2023", osm_corroboration=[]))
    for o in sorted(osm_pp, key=lambda o: o["id"]):
        if merge_into_B(o, "OSM power=plant"): continue
        if unknown(o["name"]):
            excluded["osm_pp:unnamed_unmatched"] += 1; continue
        sub = "nuclear" if o["type"] == "nuclear" else power_subclass(o["name"], o["operator"], None)
        if sub == "thermal_unspecified": sub = "gas_other"
        sites.append(dict(_primary="osm_pp", **{"class": "B"}, subclass=sub, name=o["name"], operator=o["operator"], lon=o["lon"], lat=o["lat"],
                          country=None, t=None, _t_lead=None, mw=None, fuel=o["type"],
                          records=[dict(source="OSM power=plant", id=o["id"], name=o["name"], operator=o["operator"], fuel=o["type"])],
                          sources={"osm_pp"}, why="OSM power=plant (gas/nuclear), not matched to NAEI or GPPD", osm_corroboration=[]))
    L("B sites after GPPD+OSM", sum(1 for s in sites if s["class"] == "B"))

    # 3. OSM industrial: keep strong-keyword sites; corroborate NAEI sites within 500 m; drop the rest.
    STRONG = r"refiner|steelworks|steel works|paper mill|papermill|glass works|glassworks|cement|chemical works|chemical plant|smelter"
    seen = set()
    for o in sorted(osm_ind, key=lambda o: o["id"]):
        key = (o["name"], round(o["lon"], 4), round(o["lat"], 4))
        if key in seen: excluded["osm_ind:exact_duplicate"] += 1; continue
        seen.add(key)
        is_water = o["type"] in WATER_TYPES
        near = None
        for s in sites:
            if s["_primary"] != "naei": continue
            if (s["class"] == "D") != is_water: continue
            if hav_km((s["lon"], s["lat"]), (o["lon"], o["lat"])) <= 0.5: near = s; break
        if near:
            near["osm_corroboration"].append(dict(source="OSM", id=o["id"], name=o["name"], type=o["type"], operator=o["operator"]))
            near["sources"].add("osm_ind"); excluded[f"osm_ind:{'water' if is_water else 'industrial'}_merged_into_naei"] += 1; continue
        if is_water:
            excluded["osm_ind:water_not_large"] += 1; continue
        s_l = f"{o['name']} {o['type']}".lower()
        if re.search(STRONG, s_l):
            sub = ("refinery" if "refiner" in s_l else "steel" if "steel" in s_l else "paper_pulp" if "paper" in s_l else
                   "glass" if "glass" in s_l else "cement" if "cement" in s_l else "chemicals" if "chemical" in s_l else "metals_nonferrous")
            sites.append(dict(_primary="osm_ind", **{"class": "A"}, subclass=sub, name=o["name"], operator=o["operator"], lon=o["lon"], lat=o["lat"],
                              country=None, t=None, _t_lead=None, mw=None, fuel=None,
                              records=[dict(source="OSM", id=o["id"], name=o["name"], operator=o["operator"], type=o["type"])],
                              sources={"osm_ind"}, why="OSM industrial with strong keyword, no NAEI site within 500 m", osm_corroboration=[]))
        elif o["type"] in ("Oil", "Oil Storage", "Oil Field"):
            excluded["osm_ind:fuel_storage_depot_or_well"] += 1
        else:
            excluded["osm_ind:minor_industrial"] += 1

    # 4. OSM data centres: group within 250 m; corroborate NAEI C sites within 500 m.
    dc_groups = []
    for o in sorted(osm_dc, key=lambda o: o["id"]):
        near = None
        for s in sites:
            if s["class"] == "C" and s["_primary"] == "naei" and hav_km((s["lon"], s["lat"]), (o["lon"], o["lat"])) <= 0.5: near = s; break
        if near:
            near["osm_corroboration"].append(dict(source="OSM", id=o["id"], name=o["name"], operator=o["operator"])); near["sources"].add("osm_dc")
            excluded["osm_dc:merged_into_naei"] += 1; continue
        g = None
        for gg in dc_groups:
            if hav_km((gg["lon"], gg["lat"]), (o["lon"], o["lat"])) <= 0.25 and (
                    unknown(gg["operator"]) or unknown(o["operator"]) or norm(gg["operator"]) == norm(o["operator"])): g = gg; break
        if g:
            g["records"].append(dict(source="OSM", id=o["id"], name=o["name"], operator=o["operator"]))
            if unknown(g["name"]) and not unknown(o["name"]): g["name"] = o["name"]
            if unknown(g["operator"]) and not unknown(o["operator"]): g["operator"] = o["operator"]
        else:
            dc_groups.append(dict(_primary="osm_dc", **{"class": "C"}, subclass="data_centre", name=o["name"], operator=o["operator"], lon=o["lon"], lat=o["lat"],
                                  country=None, t=None, _t_lead=None, mw=None, fuel=None,
                                  records=[dict(source="OSM", id=o["id"], name=o["name"], operator=o["operator"])], sources={"osm_dc"},
                                  why="OSM data centre (telecom/building=data_center)", osm_corroboration=[]))
    for g in dc_groups:
        g["subclass"] = "data_centre_campus" if len(g["records"]) >= 2 else "data_centre"
    sites.extend(dc_groups)

    # 5. Status for class B
    for s in sites:
        if s["class"] != "B":
            s["status"] = "listed site (status not tracked)"; s["status_date"] = None; s["status_source"] = None; continue
        nm = s["name"]; hit = None
        for st in status_rows:
            if st["rx"].search(nm): hit = st; break
        if hit:
            s["status"] = hit["status"]; s["status_date"] = hit["date"]
            s["status_source"] = hit["url"] + (" (curated; not re-verified in session)" if hit["verified"] == "no" else "")
        elif "naei" in s["sources"]:
            s["status"] = "operating 2023 (reported emissions to NAEI 2023)"; s["status_date"] = "2023"; s["status_source"] = NAEI_URL
        else:
            s["status"] = "status unknown: listed in GPPD/OSM, not in NAEI 2023 point sources (may be closed, mothballed or small)"
            s["status_date"] = None; s["status_source"] = GPPD_URL if "gppd" in s["sources"] else "https://www.openstreetmap.org/copyright"
        # DUKES 5.11 (if supplied): presence in the May 2026 list = operational per DUKES
        if dukes:
            m = [d for d in dukes if tokens(d["name"]) & tokens(nm) and len(tokens(d["name"]) & tokens(nm)) >= 1]
            if m:
                s["dukes_5_11"] = dict(station=m[0]["name"], company=m[0]["company"], fuel=m[0]["fuel"], mw=m[0]["mw"], year=m[0]["year"])
                if not hit: s["status"] = "operational (listed in DUKES 5.11, May 2026)"; s["status_date"] = "2026-05"; s["status_source"] = "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes"
        if tec:
            m = [t for t in tec if norm(t["name"]) == norm(nm)]
            if m: s["tec_register"] = [dict(project=t["name"], mw_connected=t["mw"], status=t["status"], site=t["site"]) for t in m]

    # 6. Build features (deterministic order)
    def size_metric(s):
        if s["class"] == "B" and s["mw"]:
            return dict(value=s["mw"], unit="MW installed capacity", source="GPPD v1.3.0 (DUKES-derived, capacity year " + str(next((r.get("gppd_source") and "2018-19" for r in s["records"] if r["source"] == "GPPD"), "")) + ")", basis="published installed capacity, not connection capacity")
        if s["t"] is not None:
            return dict(value=None, unit="emission band, tCO2e-approx, NAEI 2023", band=band(s["_t_lead"]),
                        source=NAEI_URL, basis="band only: CO2 as-carbon x44/12 and N2O x298 per repo manifest; other gases at raw mass; units unverified against the 2024 workbook")
        if s["class"] == "C": return dict(value=len(s["records"]), unit="OSM data-centre objects grouped within 250 m", source="OpenStreetMap", basis="no open IT-load figure exists")
        return dict(value=None, unit=None, source=None, basis="no open size metric for this record")

    def licence_for(s):
        parts = []
        if "naei" in s["sources"]: parts.append(("NAEI", NAEI_URL, NAEI_LIC))
        if "gppd" in s["sources"]: parts.append(("GPPD", GPPD_URL, GPPD_LIC))
        if s["sources"] & {"osm_ind", "osm_dc", "osm_pp"}: parts.append(("OpenStreetMap", "https://www.openstreetmap.org/copyright", OSM_LIC))
        return parts

    order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
    sites.sort(key=lambda s: (order[s["class"]], s["subclass"], s["name"].lower(), s["lon"], s["lat"]))
    features = []; rank_values = []
    for i, s in enumerate(sites):
        sm = size_metric(s); lic = licence_for(s)
        s_l = f"{s['name']} {s['operator']} {' '.join(r.get('name','') for r in s['records'])}".lower()
        props = OrderedDict([
            ("id", f"OT-{s['class']}-{i:04d}"),
            ("class", s["class"]),
            ("class_label", {"A": "Energy-intensive industry", "B": "Power station", "C": "Data centre", "D": "Large water/wastewater works", "E": "Other large energy user"}[s["class"]]),
            ("subclass", s["subclass"]),
            ("name", s["name"] if not unknown(s["name"]) else None),
            ("operator", s["operator"] if not unknown(s["operator"]) else None),
            ("nation", nation(s["country"], s["lon"], s["lat"])),
            ("size_metric", sm),
            ("emission_band_naei_2023", band(s["_t_lead"]) if s["t"] is not None else None),
            ("status", s["status"]), ("status_date", s["status_date"]), ("status_source", s["status_source"]),
            ("onsite_combustion_indicator", btm_flag(s["class"], s["subclass"], s_l, s["_t_lead"], s["sources"])),
            ("records", s["records"]), ("osm_corroboration", s["osm_corroboration"]),
            ("inclusion_rule", s["why"]),
            ("sources", [dict(name=n, url=u, licence=l) for n, u, l in lic]),
            ("screening_note", "potential offtaker (screening): not a confirmed demand, contract or connection"),
        ])
        for k in ("dukes_5_11", "tec_register"):
            if k in s: props[k] = s[k]
        feat = OrderedDict([("type", "Feature"), ("geometry", {"type": "Point", "coordinates": [round(s["lon"], 6), round(s["lat"], 6)]}), ("properties", props)])
        rank_values.append((s["mw"] or 0, s["_t_lead"] or 0))
        features.append(feat)

    fc = OrderedDict([("type", "FeatureCollection"),
                      ("generation", GENERATION),
                      ("inputs_sha256", inputs),
                      ("naei_manifest", manifest),
                      ("caveat", "Sites listed in open registers. A listing is not electricity demand, a contract or a grid connection. Vicinity screening only."),
                      ("features", features)])
    with open(os.path.join(a.out, "offtakers_filtered.geojson"), "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=False)

    # 7. Counts and top-20 lists
    by_class = Counter(f["properties"]["class"] for f in features)
    by_sub = Counter((f["properties"]["class"], f["properties"]["subclass"]) for f in features)
    by_nat = Counter((f["properties"]["class"], f["properties"]["nation"].replace(" (approx)", "")) for f in features)
    by_status = Counter(f["properties"]["status"].split(" (")[0].split(":")[0] for f in features if f["properties"]["class"] == "B")
    with open(os.path.join(a.out, "counts.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# Counts ({GENERATION})\n\nTotal features: {len(features)}\n\n## Per class\n\n| class | n |\n|---|---:|\n")
        for k in "ABCDE": fh.write(f"| {k} | {by_class[k]} |\n")
        fh.write("\n## Per class and subclass\n\n| class | subclass | n |\n|---|---|---:|\n")
        for (c, s), n in sorted(by_sub.items()): fh.write(f"| {c} | {s} | {n} |\n")
        fh.write("\n## Per class and nation (nation is NAEI's field; '(approx)' rows are a coarse geometric fallback for OSM/GPPD rows)\n\n| class | England | Scotland | Wales | Northern Ireland |\n|---|---:|---:|---:|---:|\n")
        for c in "ABCDE": fh.write(f"| {c} | " + " | ".join(str(by_nat[(c, n)]) for n in ("England", "Scotland", "Wales", "Northern Ireland")) + " |\n")
        fh.write("\n## Class B status\n\n| status | n |\n|---|---:|\n")
        for k, n in sorted(by_status.items()): fh.write(f"| {k} | {n} |\n")
        fh.write("\n## Excluded (reason: rows)\n\n| reason | rows |\n|---|---:|\n")
        for k, n in sorted(excluded.items()): fh.write(f"| {k} | {n} |\n")
    json.dump(dict(excluded=dict(sorted(excluded.items())), naei_reasons=dict(reasons["naei"])), open(os.path.join(a.out, "excluded_counts.json"), "w"), indent=1)

    rank_of = {id(f): rv for f, rv in zip(features, rank_values)}
    def rank(f):
        return rank_of[id(f)] + (f["properties"]["name"] or "",)
    with open(os.path.join(a.out, "top20_per_class.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# 20 largest per class ({GENERATION})\n\nRank key: MW where published (class B via GPPD), else the internal NAEI 2023 figure (displayed only as a band, see spec), then name.\n")
        for c in "ABCDE":
            fh.write(f"\n## Class {c}\n\n| # | name | operator | subclass | nation | size | status | sources |\n|---:|---|---|---|---|---|---|---|\n")
            rows = sorted([f for f in features if f["properties"]["class"] == c], key=rank, reverse=True)[:20]
            for j, f in enumerate(rows, 1):
                p = f["properties"]; sm = p["size_metric"]
                size = f"{sm['value']:.0f} MW" if sm.get("unit", "") and str(sm["unit"]).startswith("MW") else (sm.get("band") or (f"{sm['value']} OSM objects" if sm.get("value") else "n/a"))
                fh.write(f"| {j} | {p['name'] or 'name not listed'} | {p['operator'] or 'operator not listed'} | {p['subclass']} | {p['nation']} | {size} | {p['status'][:40]} | {','.join(x['name'] for x in p['sources'])} |\n")
    L("features", len(features), dict(by_class))
    L("output sha256", sha256(os.path.join(a.out, "offtakers_filtered.geojson")))
    open(os.path.join(a.out, "run_log.txt"), "w").write("\n".join(log) + "\n")

if __name__ == "__main__":
    main()
