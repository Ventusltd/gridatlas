#!/usr/bin/env python3
"""Bind every register project to the substation NESO says it connects at.

WHY THIS EXISTS
---------------
An offshore wind farm has to make landfall. Its export cable comes ashore and
connects at an onshore substation, and until this file existed the Atlas had no
idea which one -- so it answered the only question it could, "what is the
nearest mapped substation to the array", and for an array sitting 60 km out at
sea that returns another company's offshore platform. Measured on the live
payload: of the 82 offshore wind rows that carry a coordinate, at least 15 got
an answer that is a structure in the water. Berwick Bank was told its nearest
substation is the Neart na Gaoithe platform. Hornsea 3 was told Sheringham
Shoal's. Those are not wrong distances, they are wrong questions, and no search
radius fixes a wrong question -- a bigger circle just finds more sea.

The right answer is published, and it is published by the body that issues the
connection. NESO's Transmission Entry Capacity register carries one row per
contracted project with a `Connection Site` column, and the Embedded register
does the same for the distribution-connected ones. Hornsea 3 connects at
Norwich Main. Hornsea 4 at Creyke Beck. Berwick Bank at Branxton and Blyth.
Marram and Muir Mhor at Longside. Morgan and Morecambe at Penwortham. That is
the fact the map should be drawing, and it costs one HTTP request.

The set is small and finite: 97 offshore wind farms and ten interconnectors in
UK waters, about a hundred export-cable systems in total. This is a dataset to
finish, not to sample -- and because cable routes barely move and new farms
arrive roughly once a year, it needs refreshing annually, not continuously.
See .github/workflows/neso-connection-register-refresh.yml.

WHAT IT REFUSES TO DO
---------------------
It never invents a connection. A project that is not in either register gets no
record: nineteen of the ninety-seven are in that state, almost all of them
pre-2010 farms that connected through a DNO before these registers began, and
"absent from the register" is a fact worth printing rather than a gap worth
filling. It never resolves a conflict silently either -- where REPD and NESO
disagree about which name belongs to which project, both readings are written
and the row is marked CONFLICT for a human.

THE JOIN, AND WHY IT NEEDS A HAND-WRITTEN TABLE
-----------------------------------------------
REPD and NESO name the same project differently, and no normaliser bridges
"Hornsea 2 - Optimus and Breesea" to "Hornsea Power Station 2A". So names are
normalised first (accents folded, parentheticals and boilerplate stripped),
which pairs 57 of the 97 on its own, and the remainder go through ALIASES
below. Every alias carries the evidence that justified it -- almost always the
capacity agreeing to within a few MW -- because a wrong alias is worse than a
missing one: it prints a real substation name against the wrong wind farm, and
the map presents that as fact.

Usage:
    python tools/offshore/fetch_neso_connection_sites.py            # audit
    python tools/offshore/fetch_neso_connection_sites.py --apply    # write
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# NESO's CKAN datastore. Resource ids are stable; the datasets behind them are
# republished in place, which is exactly why this is a refresh and not a
# one-off copy.
API = "https://api.neso.energy/api/3/action/datastore_search"
REGISTERS = {
    "TEC": "17becbab-e3e8-473f-b303-3806f43a6a10",
    "EMBEDDED": "68b6f3a1-e1bf-403b-9062-0269fc758d77",
}
PORTAL = "https://www.neso.energy/data-portal"
USER_AGENT = "GridAtlas/1.0 (+https://github.com/Ventusltd/gridatlas)"

REGISTRY = ROOT / "data" / "repd_browser_registry_202608290716.json"
SUBSTATIONS = (ROOT / "atlas" / "releases" / "202608300453-atlas-v9"
               / "data" / "grid_substations.geojson")
OUT = ROOT / "atlas" / "data" / "neso-connection-sites.json"
LEAN = ROOT / "atlas" / "data" / "neso-connection-sites.lean.json"

# REPD ref -> (NESO project name, why we are confident it is the same project).
# The reason is not decoration. It is the whole justification for the row.
ALIASES = {
    "2470": ("East Anglia Three", "REPD 'East Anglia 3 (EA 3)'; NESO spells the number; 1,400 MW REPD against 1,200-1,300 MW contracted"),
    "2471": ("East Anglia One North", "REPD 'East Anglia 1 North (EA 4)'; 800 MW REPD against 860 MW contracted; same Friston connection as the ScottishPower cluster"),
    "2472": ("Hornsea Power Station 3", "REPD 'Hornsea 3'; NESO uses the Power Station form; 2,955 MW REPD against 2,250-3,000 MW contracted"),
    "2473": ("Hornsea Power Station 4", "REPD 'Hornsea 4'; 2,400 MW REPD against 1,500-2,600 MW contracted"),
    "2500": ("Walney I Offshore Wind Farm", "NESO uses roman numerals; 183.6 MW REPD against 182 MW contracted"),
    "2502": ("Hornsea Power Station 2", "REPD 'Hornsea 2 - Optimus and Breesea'; NESO splits it into 2A/2B/2C at 440 MW each, 1,320 MW total, which is the REPD figure exactly"),
    "2505": ("Aberdeen Offshore Wind Farm", "REPD 'European Offshore Wind Deployment Centre (EOWDC)'; the EOWDC is the Aberdeen Bay project; 96.8 MW REPD against 95.5 MW contracted"),
    "2506": ("Walney II Offshore Wind Farm", "NESO uses roman numerals; 183.6 MW REPD against 182 MW contracted"),
    "2513": ("Lincs Offshore Wind Farm", "REPD 'Centrica (Lincs)' names the operator; 270 MW REPD against 265 MW contracted"),
    "2524": ("East Anglia One", "REPD 'East Anglia 1 (EA 1)'; 714 MW REPD against 680 MW contracted"),
    "2525": ("Hornsea Power Station 1", "REPD 'Hornsea 1 - Heron & Njord'; NESO splits it into 1A/1B/1C at 400 MW each, 1,200 MW, against 1,218 MW REPD"),
    "5867": ("East Anglia Two", "REPD 'East Anglia 2 (EA 2)'; 900 MW REPD against 860-880 MW contracted"),
    "7861": ("Erebus", "identical name; 100 MW REPD against 95.25 MW contracted; both the Pembrokeshire floating demonstrator"),
    "10922": ("Morecambe Offshore Wind Farm", "REPD spells it 'Morecombe'; 480 MW REPD against 480 MW contracted, exact"),
    "11035": ("Salamander Offshore Wind Farm", "REPD 'Peterhead - The Salamander Project'; both the Peterhead floating project"),
    # Weaker, and marked as such in the output rather than presented as equal.
    "10920": ("Morven A Offshore Wind Farm (Prev Phoenix 1A)", "MEDIUM: REPD splits Morven into North and South at 1,450 MW each; NESO holds one 1,500 MW 'Morven A' entry, so the North/South split cannot be verified from the register"),
    "11613": ("Buchan 01 Offshore Wind Farm", "MEDIUM: REPD 'Fraserburgh - Buchan Floating Wind Project' at 1,000 MW against a 960 MW Buchan entry; the Buchan naming is shared across several Aberdeenshire schemes"),
    "12307": ("Caledonia Offshore Wind Farm", "MEDIUM: REPD splits Caledonia into North and South; NESO holds one entry, so which half connects at Greens cannot be established from the register"),
    "17559": ("Caledonia Offshore Wind Farm", "MEDIUM: as 12307 - the same single NESO entry serves both REPD halves"),
}

# Where REPD and NESO contradict each other. Written, never resolved.
CONFLICTS = {
    "13417": ("Cluaran Deas Ear / Ayre Wind Farm",
              "REPD pairs the Gaelic name 'Cluaran Deas Ear' with 'Ayre'. NESO pairs them the "
              "OPPOSITE way: its 'Ayre' entry is annotated '(ex Cluaran Ear - Thuath)' and "
              "connects at Banniskirk, while its 'Bowdun' entry is annotated '(ex Cluaran Deas "
              "Ear)' and connects at Hurlie. One of the two registers has the pairing backwards "
              "and this tool will not choose between them."),
    "13418": ("Cluaran Ear-Thuath / Bowdun Wind Farm",
              "REPD pairs 'Cluaran Ear-Thuath' with 'Bowdun'. NESO's 'Bowdun' is annotated "
              "'(ex Cluaran Deas Ear)'. Same contradiction as 13417, seen from the other side."),
}

NOISE = re.compile(
    r"(offshore\s+wind\s*farm|offshore\s+windfarm|wind\s*farm|offshore|project"
    r"|phase|extension|demonstrator|pilot|park|ltd|limited|the)")


def normalise(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    text = text.lower()
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    text = NOISE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def fetch(resource_id: str, limit: int = 5000) -> list[dict]:
    query = urllib.parse.urlencode({"resource_id": resource_id, "limit": limit})
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    result = payload["result"]
    if len(result["records"]) < result["total"]:
        raise SystemExit(
            f"{resource_id}: fetched {len(result['records'])} of {result['total']} rows; "
            "raise --limit rather than shipping a partial register")
    return result["records"]


def substation_names() -> set[str]:
    """Names in the pinned payload, so the report can say which connection
    sites the map is actually able to place."""
    if not SUBSTATIONS.exists():
        return set()
    data = json.loads(SUBSTATIONS.read_text(encoding="utf-8"))
    names = set()
    for feature in data.get("features", []):
        name = (feature.get("properties") or {}).get("name")
        if name:
            # Keyed the same way a connection site is, or "Norwich Main
            # Substation" and "Norwich Main 400kV Substation" never meet.
            names.add(site_key(name))
    return names


def site_key(site: str) -> str:
    """A connection site written for binding: the voltage and the word
    substation are decoration on what is fundamentally a place name."""
    text = normalise(re.sub(r"\d+\s*/?\s*\d*\s*kv", " ", str(site or ""), flags=re.I))
    return re.sub(r"\b(substation|substations|gsp|grid supply point|node|platform|offshores?)\b", " ", text).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the output file; otherwise audit only")
    parser.add_argument("--limit", type=int, default=5000)
    args = parser.parse_args()

    registers: dict[str, list[dict]] = {}
    for name, resource in REGISTERS.items():
        try:
            registers[name] = fetch(resource, args.limit)
        except urllib.error.URLError as error:
            raise SystemExit(f"{name} register unreachable: {error}") from error
        print(f"  {name:<9} {len(registers[name]):>5} rows")

    rows = [(name, record) for name, records in registers.items() for record in records]
    index: dict[str, list[tuple[str, dict]]] = {}
    for register, record in rows:
        index.setdefault(normalise(record.get("Project Name")), []).append((register, record))

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))["records"]
    placeable = substation_names()

    out, unmatched, conflicts = [], [], []
    for project in registry:
        ref = str(project["repd_ref"])
        candidates: list[tuple[str, dict]] = []
        method = None

        if ref in CONFLICTS:
            title, why = CONFLICTS[ref]
            conflicts.append((ref, title))
            out.append({
                "repd_ref": ref, "repd_name": project["name"], "technology": project["technology"],
                "connection_site": None, "match_confidence": "CONFLICT", "match_method": "REGISTERS_DISAGREE",
                "note": why,
            })
            continue

        if ref in ALIASES:
            alias, why = ALIASES[ref]
            key = normalise(alias)
            candidates = [pair for name, pairs in index.items() if name.startswith(key) for pair in pairs]
            method, note = "MANUAL_ALIAS", why
        else:
            key = normalise(project["name"])
            candidates = index.get(key, [])
            method, note = "NORMALISED_NAME", None
            if not candidates:
                for name, pairs in index.items():
                    if name and abs(len(name) - len(key)) <= 14 and (name.startswith(key) or key.startswith(name)):
                        candidates, method = pairs, "NORMALISED_PREFIX"
                        break

        if not candidates:
            unmatched.append((ref, project["name"], project["technology"]))
            continue

        sites = sorted({str(record.get("Connection Site")) for _, record in candidates if record.get("Connection Site")})
        confidence = "MEDIUM" if (note or "").startswith("MEDIUM:") else ("HIGH" if method != "NORMALISED_PREFIX" else "MEDIUM")
        first = candidates[0][1]
        out.append({
            "repd_ref": ref,
            "repd_name": project["name"],
            "technology": project["technology"],
            "neso_project_name": first.get("Project Name"),
            "connection_site": sites[0] if len(sites) == 1 else None,
            "connection_sites": sites,
            "connection_site_placeable": [site_key(s) in placeable for s in sites],
            "customer": first.get("Customer Name"),
            "mw_contracted": first.get("Cumulative Total Capacity (MW)"),
            "project_status": first.get("Project Status"),
            "agreement_type": first.get("Agreement Type"),
            "plant_type": first.get("Plant Type"),
            "register": candidates[0][0],
            "match_method": method,
            "match_confidence": confidence,
            "note": note,
        })

    offshore = [r for r in out if r.get("technology") == "wind_offshore"]
    offshore_missing = [u for u in unmatched if u[2] == "wind_offshore"]
    print(f"\n  register rows           {len(registry)}")
    print(f"  matched                 {len(out)}")
    print(f"  offshore wind matched   {len(offshore)} of "
          f"{sum(1 for p in registry if p['technology'] == 'wind_offshore')}")
    print(f"  offshore wind unmatched {len(offshore_missing)}")
    print(f"  conflicts               {len(conflicts)}")

    unplaceable = [r for r in offshore if r.get("connection_sites")
                   and not any(r.get("connection_site_placeable") or [])]
    print(f"  offshore sites the pinned payload cannot place: {len(unplaceable)}")

    if not args.apply:
        print("\naudit only; pass --apply to write", OUT)
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "schema": "gridatlas.neso-connection-sites.v1",
        "generated_utc": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {
            "publisher": "NESO (National Energy System Operator)",
            "portal": PORTAL,
            "api": API,
            "resources": REGISTERS,
            "licence": "NESO Open Data Licence - see the portal dataset page",
        },
        "refresh": "annual; see .github/workflows/neso-connection-register-refresh.yml",
        "statement": (
            "The connection site is the substation NESO records the project as connecting at. "
            "It is a contractual fact from the connection authority, not a measurement and not "
            "a route. Where a project connects at its own offshore platform the site names that "
            "platform, which is the start of the export cable rather than its landfall."
        ),
        "counts": {
            "registry_rows": len(registry),
            "matched": len(out),
            "unmatched": len(unmatched),
            "conflicts": len(conflicts),
        },
        "records": out,
        "unmatched": [{"repd_ref": r, "repd_name": n, "technology": t} for r, n, t in unmatched],
    }
    OUT.write_text(json.dumps(document, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print("\nwrote", OUT, f"({OUT.stat().st_size:,} bytes)")

    # The full document carries every unmatched registry row, which is the
    # right record to keep and the wrong thing to send to a phone. The lean
    # file is what the cartridge fetches: only projects that actually have a
    # connection site, only the fields the card prints.
    lean = {
        "schema": "gridatlas.neso-connection-sites.lean.v1",
        "generated_utc": document["generated_utc"],
        "source": document["source"]["portal"],
        "statement": document["statement"],
        "sites": {
            record["repd_ref"]: {
                "site": record.get("connection_site") or (record.get("connection_sites") or [None])[0],
                "sites": record["connection_sites"] if len(record.get("connection_sites") or []) > 1 else None,
                "placeable": bool(any(record.get("connection_site_placeable") or [])),
                "mw": record.get("mw_contracted"),
                "status": record.get("project_status"),
                "register": record.get("register"),
                "confidence": record.get("match_confidence"),
                "neso_name": record.get("neso_project_name"),
            }
            for record in out if record.get("connection_sites")
        },
    }
    for entry in lean["sites"].values():
        for key in [k for k, v in list(entry.items()) if v is None]:
            del entry[key]
    lean_path = LEAN
    lean_path.write_text(json.dumps(lean, ensure_ascii=False, separators=(",", ":")) + "\n",
                         encoding="utf-8", newline="\n")
    print("wrote", lean_path, f"({lean_path.stat().st_size:,} bytes, {len(lean['sites'])} projects)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
