#!/usr/bin/env python3
"""grid-colocation.py  (opus-memos-1, issue #32 §10, design-only evidence; harness: self-fixture, python -I, no network)

Genuine 408 EUMETSAT MTG LI L2-LFL optical flashes (lightning main, data/uk_lightning.geojson) against GridAtlas
production data (atlas-v9 202608300453 substations and 400/275/132 kV OSM ways; REPD 202608290716 browser registry),
with the searched time of the honest fixture index (fixtures/lightning-archive, 15 scan windows, 337,276 s).
Aggregates only: no site is named (lightning README.md:3).  Usage: python3 -I grid-colocation.py > grid-colocation.out.json
"""
import json, math, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
import numpy as np
from scipy.spatial import cKDTree

FEED = "/home/claude/lightning/data/uk_lightning.geojson"
REL = "/home/claude/gridatlas/atlas/releases/202608300453-atlas-v9/data/"
REPD = "/home/claude/gridatlas/data/repd_browser_registry_202608290716.json"
INDEX = ("/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/"
         "lightning-archive/data/history/index.json")
RE = 6371.0088
T0 = datetime(2026, 10, 20, 0, 0, 9, tzinfo=timezone.utc).timestamp()  # slot phase HH:M0:09 (history.py:50)

def xyz(lon, lat):
    lon, lat = np.radians(np.asarray(lon, float)), np.radians(np.asarray(lat, float))
    return np.c_[np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)]
chord = lambda km: 2 * math.sin(km / (2 * RE))
utc = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()

feed = json.load(open(FEED))
fl = [(f["geometry"]["coordinates"][0], f["geometry"]["coordinates"][1], utc(f["properties"]["time_utc"])) for f in feed["features"]]
FL = np.array(fl); FX = xyz(FL[:, 0], FL[:, 1]); ftree = cKDTree(FX)
fslot = np.floor((FL[:, 2] - T0) / 600).astype(int); fhour = np.floor(FL[:, 2] / 3600).astype(int); fday = np.floor(FL[:, 2] / 86400).astype(int)

idx = json.load(open(INDEX))
win = [(utc(w["start_utc"]), utc(w["end_utc"])) for w in idx["scan_windows"]]
searched_s = sum(e - s for s, e in win)
# searched slots: a slot counts with the fraction of its 600 s that lies inside a window
slot_frac = defaultdict(float)
for s, e in win:
    k = math.floor((s - T0) / 600)
    while T0 + k * 600 < e:
        a, b = max(s, T0 + k * 600), min(e, T0 + (k + 1) * 600)
        if b > a: slot_frac[k] += (b - a) / 600
        k += 1
searched_slots = sum(min(1.0, v) for v in slot_frac.values())
flash_in_window = sum(any(s <= t < e for s, e in win) for t in FL[:, 2])

out = {"harness": "self-fixture, python -I, numpy+scipy, no network", "flashes": len(fl),
       "flashes_inside_recorded_scan_windows": int(flash_in_window),
       "searched_seconds": round(searched_s), "searched_hours": round(searched_s / 3600, 2), "searched_slot_equivalents": round(searched_slots, 1)}

def per_asset(name, lon, lat, extra=None):
    A = xyz(lon, lat); res = {"assets": len(lon)}
    for R in (1, 5, 10, 20):
        hits = ftree.query_ball_point(A, chord(R))
        n = np.array([len(h) for h in hits]); res[f"with_flash_within_{R}km"] = int((n > 0).sum())
        if R == 10:
            pos = [h for h in hits if h]
            if pos:
                cnt = np.array([len(h) for h in pos])
                hours = np.array([len(set(fhour[h])) for h in pos]); days = np.array([len(set(fday[h])) for h in pos])
                top_hour_share = np.array([max(Counter(fhour[h]).values()) / len(h) for h in pos])
                res["within_10km"] = {"count_median": float(np.median(cnt)), "count_p90": float(np.percentile(cnt, 90)), "count_max": int(cnt.max()),
                    "distinct_utc_days_median": float(np.median(days)), "distinct_utc_days_max": int(days.max()),
                    "distinct_utc_hours_median": float(np.median(hours)),
                    "share_of_assets_whose_flashes_all_fall_in_one_utc_hour": round(float((hours == 1).mean()), 3),
                    "share_of_assets_whose_flashes_all_fall_on_one_utc_day": round(float((days == 1).mean()), 3),
                    "median_share_from_busiest_hour": round(float(np.median(top_hour_share)), 3)}
            # chance coincidence base rate: (asset, searched slot) pairs with >=1 flash within 10 km in that slot (and within +-1 slot)
            pairs0 = sum(len(set(fslot[h])) for h in hits if h)
            pairs1 = sum(len(set(s + d for s in fslot[h] for d in (-1, 0, 1))) for h in hits if h)
            res["coincidence_base_rate_10km"] = {"asset_slot_pairs_with_flash": int(pairs0), "of_asset_searched_slot_pairs": round(len(lon) * searched_slots),
                "rate_same_slot": float(f"{pairs0 / (len(lon) * searched_slots):.2e}"), "rate_pm1_slot_30min": float(f"{pairs1 / (len(lon) * searched_slots):.2e}")}
    if extra: res.update(extra)
    return res

subs = json.load(open(REL + "grid_substations.geojson"))["features"]
s_lon = [f["geometry"]["coordinates"][0] for f in subs]; s_lat = [f["geometry"]["coordinates"][1] for f in subs]
out["substations"] = per_asset("substations", s_lon, s_lat)

repd = json.load(open(REPD))["records"]
rows = [r for r in repd if isinstance(r.get("latitude"), (int, float)) and isinstance(r.get("longitude"), (int, float))]
tech_key = next((k for k in rows[0] if k.startswith("repd_technolog")), None)
status_key = next((k for k in rows[0] if k in ("status", "development_status", "repd_status", "development_status_short")), None)
out["repd_fields"] = {"technology_field": tech_key, "status_field": status_key, "with_coordinates": len(rows), "records": len(repd)}
out["repd_all"] = per_asset("repd", [r["longitude"] for r in rows], [r["latitude"] for r in rows])
if status_key:
    for st in sorted(set(r[status_key] for r in rows)):
        sub = [r for r in rows if r[status_key] == st]
        out[f"repd_status_{st}"] = {k: v for k, v in per_asset(st, [r["longitude"] for r in sub], [r["latitude"] for r in sub]).items() if k.startswith("with_") or k == "assets"}

# line routes: km of OSM way within R of any flash (ways, not circuits); densify to <= 0.25 km
def line_km(path):
    feats = json.load(open(path))["features"]; total = 0.0; near = {5: 0.0, 10: 0.0}
    for f in feats:
        g = f["geometry"]; parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"] if g["type"] == "MultiLineString" else []
        for cs in parts:
            for (x0, y0), (x1, y1) in zip(cs[:-1], cs[1:]):
                p0, p1 = xyz([x0], [y0])[0], xyz([x1], [y1])[0]
                L = RE * 2 * math.asin(min(1.0, np.linalg.norm(p1 - p0) / 2)); total += L
                n = max(1, int(math.ceil(L / 0.25)))
                t = (np.arange(n) + 0.5) / n; mid = p0[None, :] * (1 - t[:, None]) + p1[None, :] * t[:, None]
                mid /= np.linalg.norm(mid, axis=1)[:, None]
                d, _ = ftree.query(mid)
                for R in near: near[R] += float((d <= chord(R)).sum()) * L / n
    return {"route_km": round(total), "km_within_5km_of_a_flash": round(near[5]), "km_within_10km_of_a_flash": round(near[10])}
out["lines"] = {kv: line_km(REL + f"grid_{kv}kv.geojson") for kv in ("400", "275", "132")}

# viewing geometry from MTG-I at 0 deg (collection EO:EUM:DAT:0691 "MTG 0 degree", collect.py:20)
RS, RG = 42164.0, RE
geo = []
for lat in (49.5, 52.0, 55.0, 58.0, 61.5):
    for lon in (-11.0, 0.0, 3.0):
        g = math.acos(math.cos(math.radians(lat)) * math.cos(math.radians(lon)))
        rho = math.sqrt(RS**2 + RG**2 - 2 * RS * RG * math.cos(g))
        elev = math.degrees(math.atan2(math.cos(g) - RG / RS, math.sin(g))); vza = 90 - elev
        ifov = 4.5 / (RS - RG)  # 4.5 km at nadir (archive auditor F10)
        geo.append({"lat": lat, "lon": lon, "vza_deg": round(vza, 1), "parallax_km_per_km_of_height_error": round(math.tan(math.radians(vza)), 2),
                    "footprint_across_km": round(rho * ifov, 1), "footprint_along_km": round(rho * ifov / math.cos(math.radians(vza)), 1)})
out["viewing_geometry_0E"] = geo
print(json.dumps(out, indent=1))
