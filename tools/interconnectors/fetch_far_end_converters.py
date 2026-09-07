#!/usr/bin/env python3
"""Find the far-end converter station for each GB interconnector.

The estate already holds the GB end of every link: our own substation data names
Sellindge Converter Station, Grain Static Inverter Plant and Auchencrosh Static
Inverter Plant outright, and the rest land at named substations. What it has
never held is the other end, so no link could be drawn.

HVDC converters are tagged `power=converter` in OpenStreetMap, which makes the
far ends queryable rather than guessable. This fetches them across north-west
Europe, matches them to the links by name, pairs them with the GB end, and emits
a straight line for each.

A straight line between converter stations is the intended output, not a
stopgap. It states the separation exactly and is honest so long as it is labelled
a straight line rather than a cable route. Where a true cable length is known the
report carries the route factor beside it: BritNed is ~245 km of submarine cable
against its own straight line, quoted in BritNed v ABB [2018] EWHC 2616 (Ch).

Nothing here is asserted from memory. A link with no OSM match is reported as
unmatched rather than filled in.

Usage:
    python fetch_far_end_converters.py --out atlas/data/interconnector-endpoints.json
    python fetch_far_end_converters.py --offline   # reuse a cached Overpass response
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = (48.0, -11.5, 62.5, 13.0)  # south, west, north, east — Ireland to Denmark
USER_AGENT = "GridAtlas-CI/1.0 (interconnector endpoint reconciliation)"

# Each link: the GB substation to look for in our own data, and the names its
# far-end converter answers to in OSM. Aliases are needed because operators and
# mappers do not agree: "HVDC Britned", "Konti-Skan", "Cross-Skagerrak".
LINKS = [
    {"link": "IFA",              "bmrs": "INTFR",   "gb": "sellindge",        "far_aliases": ["ifa", "les mandarins", "bonningues"]},
    {"link": "IFA2",             "bmrs": "INTIFA2", "gb": "chilling",         "far_aliases": ["ifa2", "ifa 2", "tourbe"]},
    {"link": "ElecLink",         "bmrs": "INTELEC", "gb": "sellindge",        "far_aliases": ["eleclink", "elec link"]},
    {"link": "BritNed",          "bmrs": "INTNED",  "gb": "grain static",     "far_aliases": ["britned", "brit ned", "maasvlakte"]},
    {"link": "Nemo Link",        "bmrs": "INTNEM",  "gb": "richborough",      "far_aliases": ["nemo", "herdersbrug", "zeebrugge"]},
    {"link": "North Sea Link",   "bmrs": "INTNSL",  "gb": "blyth substation", "far_aliases": ["north sea link", "nsl", "kvilldal"]},
    {"link": "Viking Link",      "bmrs": "INTVKL",  "gb": "bicker fen",       "far_aliases": ["viking link", "revsing"]},
    {"link": "East West",        "bmrs": "INTEW",   "gb": "deeside",          "far_aliases": ["east west interconnector", "ewic", "woodland"]},
    {"link": "Greenlink",        "bmrs": "INTGRNL", "gb": "pembroke",         "far_aliases": ["greenlink", "great island"]},
    {"link": "Moyle",            "bmrs": "INTIRL",  "gb": "auchencrosh",      "far_aliases": ["moyle", "ballycronan"]},
]

# Cable lengths quoted in court or by the operator, for the route factor.
KNOWN_CABLE_KM = {
    "BritNed": {
        "submarine_km": 245,
        "land_km": 9,
        "source": "BritNed Development Ltd v ABB AB [2018] EWHC 2616 (Ch)",
    }
}

GB_SUBSTATIONS = [
    "gridatlas/atlas/releases/202608292311-atlas-v9/data/grid_substations.geojson",
    "atlas/releases/202608292311-atlas-v9/data/grid_substations.geojson",
]


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance on a sphere of the WGS84 mean radius."""
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def fetch_converters(cache: Path, offline: bool) -> list[dict]:
    if offline or cache.exists():
        if cache.exists():
            payload = json.loads(cache.read_text(encoding="utf-8"))
            print(f"  using cached Overpass response ({cache.name})")
            return payload.get("elements") or []
        raise SystemExit(f"--offline given but no cache at {cache}")

    south, west, north, east = BBOX
    query = f"""[out:json][timeout:180];
(
  node["power"="converter"]({south},{west},{north},{east});
  way["power"="converter"]({south},{west},{north},{east});
  relation["power"="converter"]({south},{west},{north},{east});
);
out center tags;"""
    request = urllib.request.Request(
        OVERPASS,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": USER_AGENT},
    )
    print("  querying Overpass ...")
    with urllib.request.urlopen(request, timeout=240) as response:
        payload = json.loads(response.read().decode("utf-8"))
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(payload), encoding="utf-8")
    print(f"  cached to {cache.name}")
    return payload.get("elements") or []


def load_gb_substations(root: Path) -> list[dict]:
    for candidate in GB_SUBSTATIONS:
        path = root / candidate
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        out = []
        for feature in payload.get("features") or []:
            coords = (feature.get("geometry") or {}).get("coordinates")
            if not coords:
                continue
            out.append(
                {
                    "name": str((feature.get("properties") or {}).get("name", "")),
                    "lon": round(float(coords[0]), 5),
                    "lat": round(float(coords[1]), 5),
                    "voltage": (feature.get("properties") or {}).get("voltage"),
                }
            )
        print(f"  GB substations: {len(out)} from {path.name}")
        return out
    raise SystemExit("grid_substations.geojson not found")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--out", default="atlas/data/interconnector-endpoints.json")
    parser.add_argument("--cache", default="atlas/data/.overpass-converters.json")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    gb = load_gb_substations(root)
    elements = fetch_converters(Path(args.cache), args.offline)

    converters = []
    for element in elements:
        tags = element.get("tags") or {}
        name = tags.get("name")
        if not name:
            continue
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lon = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        converters.append(
            {
                "name": name,
                "lon": round(float(lon), 5),
                "lat": round(float(lat), 5),
                "operator": tags.get("operator"),
                "osm": f"{element.get('type')}/{element.get('id')}",
            }
        )
    print(f"  OSM converters with a name and a position: {len(converters)}")

    results = []
    for spec in LINKS:
        gb_hit = next((s for s in gb if spec["gb"] in s["name"].lower()), None)
        far_hit = None
        for alias in spec["far_aliases"]:
            far_hit = next((c for c in converters if alias in c["name"].lower()), None)
            if far_hit:
                break

        row = {
            "link": spec["link"],
            "bmrs": spec["bmrs"],
            "gb_name": gb_hit["name"] if gb_hit else None,
            "gb_lon": gb_hit["lon"] if gb_hit else None,
            "gb_lat": gb_hit["lat"] if gb_hit else None,
            "gb_source": "gridatlas grid_substations.geojson",
            "far_name": far_hit["name"] if far_hit else None,
            "far_lon": far_hit["lon"] if far_hit else None,
            "far_lat": far_hit["lat"] if far_hit else None,
            "far_source": f"OpenStreetMap {far_hit['osm']}" if far_hit else None,
            "crs": "EPSG:4326",
        }

        if gb_hit and far_hit:
            straight = haversine_km(gb_hit["lon"], gb_hit["lat"], far_hit["lon"], far_hit["lat"])
            row["straight_line_km"] = round(straight, 2)
            row["midpoint_lon"] = round((gb_hit["lon"] + far_hit["lon"]) / 2, 5)
            row["midpoint_lat"] = round((gb_hit["lat"] + far_hit["lat"]) / 2, 5)
            row["geometry_kind"] = "STRAIGHT_LINE_CONVERTER_TO_CONVERTER"
            row["drawable"] = True
            known = KNOWN_CABLE_KM.get(spec["link"])
            if known:
                row["known_submarine_cable_km"] = known["submarine_km"]
                row["route_factor"] = round(known["submarine_km"] / straight, 3)
                row["route_factor_source"] = known["source"]
        else:
            row["drawable"] = False
            row["missing"] = "far end" if gb_hit else ("GB end" if far_hit else "both ends")
        results.append(row)

    drawable = [r for r in results if r["drawable"]]
    report = {
        "schema": "gridatlas.interconnector-endpoints.v1",
        "generated_utc": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "purpose": (
            "Converter-station pairs for GB interconnectors. GB ends come from our own "
            "substation data; far ends are queried from OpenStreetMap power=converter. "
            "The line between them is a straight line and is labelled as one: it measures "
            "separation between converter stations, not cable length."
        ),
        "far_end_source": "OpenStreetMap Overpass, power=converter",
        "bbox": {"south": BBOX[0], "west": BBOX[1], "north": BBOX[2], "east": BBOX[3]},
        "links": len(results),
        "drawable": len(drawable),
        "gb_ends_found": sum(1 for r in results if r["gb_lon"] is not None),
        "far_ends_found": sum(1 for r in results if r["far_lon"] is not None),
        "endpoints": results,
    }

    print()
    for row in results:
        if row["drawable"]:
            extra = f"  route factor {row['route_factor']}" if "route_factor" in row else ""
            print(f"  {row['link']:<18} {row['gb_name'][:28]:<30} -> {row['far_name'][:26]:<28} {row['straight_line_km']:>7.1f} km{extra}")
        else:
            print(f"  {row['link']:<18} {str(row['gb_name'])[:28]:<30} -> missing {row['missing']}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    # A GeoJSON the Atlas can consume without new plumbing. Each drawable link
    # yields two features: the straight line, and a midpoint carrying the same
    # property names an offshore project carries, so the existing offshore
    # rendering and the existing MAP button apply to it unchanged.
    features = []
    for row in results:
        if not row["drawable"]:
            continue
        common = {
            "link": row["link"],
            "bmrs_code": row["bmrs"],
            "gb_converter": row["gb_name"],
            "far_converter": row["far_name"],
            "straight_line_km": row["straight_line_km"],
            "geometry_kind": row["geometry_kind"],
            "far_end_source": row["far_source"],
        }
        if "route_factor" in row:
            common["known_submarine_cable_km"] = row["known_submarine_cable_km"]
            common["route_factor"] = row["route_factor"]
        features.append({
            "type": "Feature",
            "properties": dict(common, feature_role="link-line"),
            "geometry": {
                "type": "LineString",
                "coordinates": [[row["gb_lon"], row["gb_lat"]], [row["far_lon"], row["far_lat"]]],
            },
        })
        features.append({
            "type": "Feature",
            "properties": dict(
                common,
                feature_role="midpoint",
                name=row["link"],
                technology="interconnector",
                repd_ref=row["bmrs"],
                capacity_mw=None,
            ),
            "geometry": {"type": "Point", "coordinates": [row["midpoint_lon"], row["midpoint_lat"]]},
        })

    geo_path = out_path.with_name("interconnectors.geojson")
    geo_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
                "generated_utc": report["generated_utc"],
                "note": (
                    "Straight lines between converter stations, not surveyed cable routes. "
                    "Midpoints carry offshore-project property names so the existing "
                    "rendering and MAP button apply unchanged."
                ),
                "features": features,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"\n  {report['drawable']}/{report['links']} drawable · written {out_path}")
    print(f"  {len(features)} features · written {geo_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
