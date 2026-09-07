#!/usr/bin/env python3
"""Give every offshore REPD row a coordinate, or say plainly why it has none.

REPD locates almost everything it lists: 13,970 of 13,995 rows carry a finite
easting and northing. Wind Offshore is the exception, and the leftover rows are
the ones whose MAP button reaches the Atlas with nothing to fly to. The Crown
Estate leases the seabed those projects sit on and publishes the lease polygons,
so the gap is closable from data we already hold.

This reconciles the two and writes a coordinate set. It never edits REPD: the
register is the register, and a derived point must be labelled as derived.

Three things here were learned the hard way and are load-bearing:

  * Parse the CSV with the csv module, never str.split(','). REPD site names
    contain commas inside quoted fields; splitting on commas shifts every later
    column and makes the coordinate columns appear to hold region names like
    "England". That artefact was published once and had to be retracted.

  * Reduce a lease polygon with point-on-surface, not a centroid. The centroid
    of a concave or multipart lease can fall in open water outside the lease,
    and an arrival must land on the site it names.

  * Match on every name a lease offers. Round 4 sites are catalogued as
    "R4 Project 6 (Morgan)" - the usable name is inside the brackets - and the
    tenant SPV usually carries it too. Keying on the property name alone
    reported Morgan as unmatched while its geometry sat on disk.

Usage:
    python reconcile_offshore_coordinates.py --out atlas/data/offshore-coordinates.json
    python reconcile_offshore_coordinates.py --check      # fail if coverage regressed
"""

from __future__ import annotations

import argparse
import csv
import datetime as _dt
import json
import re
import sys
from pathlib import Path

# Where to look. Each entry is a root and a glob; the first root that exists
# wins, so the same script runs on a developer machine and on a CI runner where
# the sibling repositories are checked out beside this one.
REPD_CANDIDATES = [
    "globalgrid2050/repd.csv",
    "../globalgrid2050/repd.csv",
    "repd.csv",
]
# Wildcards on both sides: a lease file is not always named "crown-something".
# morgan-crown-estate.geojson would be missed by a leading-anchor glob.
CROWN_GLOBS = [
    "testcode/sandbox/**/*crown*.geojson",
    "../testcode/sandbox/**/*crown*.geojson",
    "**/*crown*estate*.geojson",
    "data/crown/**/*.geojson",
]

SITE_KEYS = ("Name_Prop", "Property_Description", "Site Name", "name")
TENANT_KEYS = ("Name_Ten", "Tenant_Name", "operator")

_STOPWORDS = re.compile(
    r"offshore|wind\s*farm|windfarm|wind|farm|limited|ltd|project|phase|extension|array",
    re.I,
)


def normalise(value: str) -> str:
    """Reduce a site name to its distinguishing words."""
    text = _STOPWORDS.sub(" ", str(value or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def keys_for(site: str, tenant: str) -> list[str]:
    """Every name a lease answers to, longest-lived first."""
    out: list[str] = []

    def add(value: str) -> None:
        key = normalise(value)
        if len(key) > 2 and key not in out:
            out.append(key)

    add(site)
    for inner in re.findall(r"\(([^)]+)\)", str(site or "")):
        add(inner)
    add(re.sub(r"\(.*?\)", " ", str(site or "")))
    add(tenant)
    return out


def first_prop(properties: dict, names: tuple[str, ...]) -> str:
    for name in names:
        if properties.get(name):
            return str(properties[name]).strip()
    return ""


def point_on_surface(geometry: dict) -> tuple[float, float] | None:
    """A point guaranteed to lie inside the polygon, unlike a centroid.

    Ray-cast across the largest ring at its median latitude and take the midpoint
    of the widest interior span.
    """
    kind = (geometry or {}).get("type")
    if kind == "Polygon":
        rings = geometry.get("coordinates") or []
    elif kind == "MultiPolygon":
        rings = [ring for poly in (geometry.get("coordinates") or []) for ring in poly]
    else:
        return None
    if not rings:
        return None

    def shoelace(ring: list) -> float:
        total = 0.0
        for i in range(len(ring)):
            x1, y1 = ring[i - 1][0], ring[i - 1][1]
            x2, y2 = ring[i][0], ring[i][1]
            total += x1 * y2 - x2 * y1
        return abs(total) / 2.0

    ring = max(rings, key=shoelace)
    lats = sorted(point[1] for point in ring)
    y = lats[len(lats) // 2]

    crossings: list[float] = []
    for i in range(len(ring)):
        x1, y1 = ring[i - 1][0], ring[i - 1][1]
        x2, y2 = ring[i][0], ring[i][1]
        if (y1 > y) != (y2 > y):
            crossings.append(x1 + (y - y1) / (y2 - y1) * (x2 - x1))
    crossings.sort()

    widest, x = -1.0, None
    for i in range(0, len(crossings) - 1, 2):
        span = crossings[i + 1] - crossings[i]
        if span > widest:
            widest, x = span, (crossings[i] + crossings[i + 1]) / 2.0
    if x is None:
        return None
    return round(x, 6), round(y, 6)


def find_repd(root: Path) -> Path | None:
    for candidate in REPD_CANDIDATES:
        path = root / candidate
        if path.is_file():
            return path
    return None


def find_leases(root: Path) -> list[Path]:
    """Discover lease files rather than naming them, so a new one is picked up."""
    found: list[Path] = []
    for pattern in CROWN_GLOBS:
        for path in sorted(root.glob(pattern)):
            if path.is_file() and path not in found:
                found.append(path)
    return found


def load_leases(paths: list[Path]) -> list[dict]:
    leases: list[dict] = []
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"  skipped {path.name}: {error}", file=sys.stderr)
            continue
        region = "Scotland" if "scotland" in path.name.lower() else "England/Wales/NI"
        for feature in payload.get("features") or []:
            point = point_on_surface(feature.get("geometry") or {})
            if point is None:
                continue
            properties = feature.get("properties") or {}
            site = first_prop(properties, SITE_KEYS)
            tenant = first_prop(properties, TENANT_KEYS)
            leases.append(
                {
                    "site": site,
                    "tenant": tenant,
                    "region": region,
                    "source_file": path.name,
                    "lon": point[0],
                    "lat": point[1],
                    "keys": keys_for(site, tenant),
                }
            )
    return leases


def read_offshore_rows(path: Path) -> tuple[list[dict], int, int]:
    """Return offshore rows, total row count and total mappable count.

    Try UTF-8 first so that names such as "Muir Mhor" keep their diacritics, and
    fall back to latin-1, which cannot fail, if the export is not UTF-8.
    """
    rows: list[dict] = []
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            with path.open(newline="", encoding=encoding) as handle:
                rows = list(csv.DictReader(handle))
            break
        except UnicodeDecodeError:
            continue

    def finite(row: dict) -> bool:
        try:
            float(row.get("X-coordinate", ""))
            float(row.get("Y-coordinate", ""))
            return True
        except (TypeError, ValueError):
            return False

    mappable = sum(1 for row in rows if finite(row))
    offshore = [r for r in rows if "offshore" in str(r.get("Technology Type", "")).lower()]
    for row in offshore:
        row["_mappable"] = finite(row)
    return offshore, len(rows), mappable


def match(row: dict, leases: list[dict]) -> dict | None:
    key = normalise(row.get("Site Name", ""))
    if not key:
        return None
    for lease in leases:
        if key in lease["keys"]:
            return lease
    for lease in leases:
        if any(k in key or key in k for k in lease["keys"]):
            return lease
    return None


def build(root: Path) -> dict:
    repd_path = find_repd(root)
    if repd_path is None:
        raise SystemExit(f"repd.csv not found under {root} (looked in {REPD_CANDIDATES})")
    lease_paths = find_leases(root)
    if not lease_paths:
        raise SystemExit(f"no Crown Estate lease geojson found under {root}")

    leases = load_leases(lease_paths)
    offshore, total_rows, mappable_rows = read_offshore_rows(repd_path)
    gaps = [row for row in offshore if not row["_mappable"]]

    recovered = []
    for row in gaps:
        lease = match(row, leases)
        recovered.append(
            {
                "repd_ref": str(row.get("Ref ID", "")).strip(),
                "site_name": str(row.get("Site Name", "")).strip(),
                "operator": str(row.get("Operator (or Applicant)", "") or row.get("Operator", "")).strip(),
                "matched_lease": lease["site"] if lease else None,
                "tenant": lease["tenant"] if lease else None,
                "region": lease["region"] if lease else None,
                "source_file": lease["source_file"] if lease else None,
                "longitude": lease["lon"] if lease else None,
                "latitude": lease["lat"] if lease else None,
                "crs": "EPSG:4326" if lease else None,
                "method": "CROWN_ESTATE_LEASE_POINT_ON_SURFACE" if lease else "NO_LEASE_MATCH",
            }
        )

    found = [r for r in recovered if r["longitude"] is not None]
    return {
        "schema": "gridatlas.offshore-coordinates.v1",
        "generated_utc": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "purpose": (
            "Coordinates for offshore REPD rows that the register itself does not locate, "
            "derived from Crown Estate lease geometry. Derived, not authoritative: REPD "
            "remains the register and is never edited by this tool."
        ),
        "sources": {
            "repd": str(repd_path.as_posix()),
            "crown_estate_leases": [p.as_posix() for p in lease_paths],
        },
        "register": {
            "rows": total_rows,
            "mappable": mappable_rows,
            "unmappable": total_rows - mappable_rows,
            "offshore_rows": len(offshore),
            "offshore_unmappable": len(gaps),
        },
        "leases_with_geometry": len(leases),
        "recovered": len(found),
        "still_unmatched": len(gaps) - len(found),
        "coordinates": recovered,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="directory holding the repositories")
    parser.add_argument("--out", default="atlas/data/offshore-coordinates.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="compare against the committed file and fail if coverage regressed",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    report = build(root)

    print(f"  repd            {report['sources']['repd']}")
    print(f"  lease files     {len(report['sources']['crown_estate_leases'])}")
    print(f"  register        {report['register']['mappable']}/{report['register']['rows']} mappable")
    print(f"  offshore gaps   {report['register']['offshore_unmappable']} of {report['register']['offshore_rows']}")
    print(f"  RECOVERED       {report['recovered']}")
    print(f"  still unmatched {report['still_unmatched']}")
    for row in report["coordinates"]:
        if row["longitude"] is None:
            print(f"    {row['repd_ref']:<8}{row['site_name'][:34]:<36} no lease match")
        else:
            print(f"    {row['repd_ref']:<8}{row['site_name'][:34]:<36} {row['longitude']}, {row['latitude']}  ({row['matched_lease']})")

    out_path = Path(args.out)
    if args.check:
        if not out_path.exists():
            print(f"\n  {out_path} does not exist yet", file=sys.stderr)
            return 1
        previous = json.loads(out_path.read_text(encoding="utf-8"))
        if report["recovered"] < previous.get("recovered", 0):
            print(
                f"\n  REGRESSED: recovered {report['recovered']} against "
                f"{previous.get('recovered')} committed",
                file=sys.stderr,
            )
            return 1
        print(f"\n  no regression ({report['recovered']} >= {previous.get('recovered', 0)})")
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n  written {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
