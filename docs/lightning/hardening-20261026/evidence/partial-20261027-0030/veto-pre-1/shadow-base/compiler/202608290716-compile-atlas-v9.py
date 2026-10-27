#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

import duckdb
from pyproj import Transformer

GENERATION = "202608290716"
SOURCE_URL = "https://assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv"
SOURCE_SHA256 = "84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035"
SOURCE_BYTES = 5087389
V8_SHA256 = "ca5da437ddb832f7e4e8d84bba1f2f6d40df6285089a43156452fdda7eebe0fe"
V8_BYTES = 4256963
V8_FEATURES = 10784
VIABLE = {"operational", "under construction", "awaiting construction", "consented", "planning permission granted", "planning approved", "application submitted", "pre-construction"}
REQUIRED = ["Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name", "Technology Type", "Installed Capacity (MWelec)", "Development Status (short)", "Address", "County", "Region", "Country", "Post Code", "X-coordinate", "Y-coordinate", "Planning Authority", "Planning Application Reference"]
POSTCODE = re.compile(r"^(?:GIR 0AA|[A-Z][A-HJ-Y]?[0-9][0-9A-Z]? [0-9][ABD-HJLNP-UW-Z]{2})$")
ORG_WORDS = re.compile(r"\b(?:ltd|limited|plc|llp|company|co|group|holdings|energy|power|solar|wind|renewable|development|developer|farm|estate|university|college|council|authority|government|trust|society|association|partnership|services|systems|airport|water|waste|environment|utility|utilities|generation|investments?|infrastructure|industries|international|uk)\b", re.I)

def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def clean(value):
    if value is None:
        return None
    value = re.sub(r"\s+", " ", str(value)).strip()
    return None if not value or value.lower() in {"nan", "not set", "n/a"} else value

def norm(value):
    value = unicodedata.normalize("NFKD", clean(value) or "")
    return re.sub(r"[^a-z0-9]+", " ", value.encode("ascii", "ignore").decode().lower()).strip()

def postcode(raw):
    raw_clean = (clean(raw) or "").upper()
    compact = re.sub(r"\s+", "", raw_clean)
    canonical = f"{compact[:-3]} {compact[-3:]}" if len(compact) >= 5 else raw_clean
    return raw_clean or None, canonical or None, bool(POSTCODE.fullmatch(canonical))

def public_applicant(raw):
    value = clean(raw)
    if not value:
        return None, "NOT_SUPPLIED"
    if re.search(r"(?:@|\b\+?\d[\d ()-]{7,}\b)", value):
        return None, "WITHHELD_CONTACT_DETAIL"
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", value)
    possible_person = 2 <= len(words) <= 4 and all(w[:1].isupper() for w in words) and not ORG_WORDS.search(value)
    if possible_person:
        return "WITHHELD — POSSIBLE INDIVIDUAL", "WITHHELD_POSSIBLE_INDIVIDUAL"
    return value, "REPD_AS_PUBLISHED"

def classify_tech(raw, mounting):
    text = (clean(raw) or "").lower()
    mounting_text = (clean(mounting) or "").lower()
    if "solar photovoltaic" in text or "solar pv" in text:
        return "solar_roof" if mounting_text == "roof" else "solar"
    if "wind onshore" in text: return "wind_onshore"
    if "wind offshore" in text: return "wind_offshore"
    if text == "hydrogen" or "fuel cell (hydrogen)" in text: return "hydrogen"
    if any(x in text for x in ("large hydro", "small hydro", "pumped storage hydro")): return "hydro"
    if any(x in text for x in ("compressed air energy storage", "liquid air energy storage")): return "caes"
    if text in {"battery", "battery storage"} or "battery" in text: return "bess"
    if any(x in text for x in ("biomass", "efw incineration", "anaerobic digestion", "landfill gas", "sewage sludge", "co-firing", "energy from waste", "incineration")): return "biomass"
    if any(x in text for x in ("advanced conversion", "gasification", "pyrolysis")): return "act"
    if "geothermal" in text or "hot dry rocks" in text: return "geothermal"
    if "tidal" in text or "shoreline wave" in text: return "tidal"
    if "flywheel" in text: return "flywheel"
    if "storage" in text: return "bess"
    if "wind" in text: return "wind"
    return "other"

def row_hash(row):
    payload = {key: clean(row.get(key)) for key in REQUIRED}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def compile_rows(source):
    transformer = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    output = []
    seen = set()
    with open(source, "r", encoding="cp1252", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [name for name in REQUIRED if name not in (reader.fieldnames or [])]
        if missing:
            raise RuntimeError(f"missing REPD columns: {missing}")
        for source_row, row in enumerate(reader, 2):
            status = (clean(row.get("Development Status (short)")) or "").lower()
            if status not in VIABLE:
                continue
            ref = clean(row.get("Ref ID"))
            if not ref or ref in seen:
                raise RuntimeError(f"missing or duplicate REPD Ref at source row {source_row}: {ref}")
            try:
                x = float(row.get("X-coordinate") or 0)
                y = float(row.get("Y-coordinate") or 0)
                lon, lat = transformer.transform(x, y)
            except Exception:
                continue
            if not (math.isfinite(lon) and math.isfinite(lat) and -9 < lon < 2.5 and 49 < lat < 61):
                continue
            try:
                capacity = float(row.get("Installed Capacity (MWelec)") or 0)
                capacity = capacity if math.isfinite(capacity) else 0.0
            except ValueError:
                capacity = 0.0
            technology = classify_tech(row.get("Technology Type"), row.get("Mounting Type for Solar"))
            if technology == "solar_roof" and capacity > 50: capacity = round(capacity / 1000, 4)
            if technology == "biomass" and capacity > 100: capacity = round(capacity / 1000, 4)
            postcode_raw, postcode_canonical, postcode_valid = postcode(row.get("Post Code"))
            applicant, applicant_state = public_applicant(row.get("Operator (or Applicant)"))
            record = {
                "repd_ref": ref,
                "name": clean(row.get("Site Name")) or "Unknown",
                "repd_address_raw": clean(row.get("Address")),
                "repd_address_display": clean(row.get("Address")),
                "repd_postcode_raw": postcode_raw,
                "repd_postcode": postcode_canonical,
                "postcode_valid": postcode_valid,
                "county": clean(row.get("County")),
                "region": clean(row.get("Region")),
                "country": clean(row.get("Country")),
                "planning_authority": clean(row.get("Planning Authority")),
                "planning_application_reference": clean(row.get("Planning Application Reference")),
                "repd_operator_or_applicant": applicant,
                "applicant_publication_state": applicant_state,
                "technology": technology,
                "repd_technology": clean(row.get("Technology Type")),
                "status": status,
                "capacity_mw": capacity,
                "longitude": round(lon, 6),
                "latitude": round(lat, 6),
                "source_record_updated": clean(row.get("Record Last Updated (dd/mm/yyyy)")),
                "source_row": source_row,
                "source_row_sha256": row_hash(row)
            }
            output.append(record)
            seen.add(ref)
    output.sort(key=lambda item: (int(item["repd_ref"]) if item["repd_ref"].isdigit() else 10**12, item["repd_ref"]))
    return output

SCHEMA = """CREATE TABLE projects(
repd_ref VARCHAR NOT NULL, name VARCHAR NOT NULL, repd_address_raw VARCHAR, repd_address_display VARCHAR,
repd_postcode_raw VARCHAR, repd_postcode VARCHAR, postcode_valid BOOLEAN NOT NULL, county VARCHAR, region VARCHAR,
country VARCHAR, planning_authority VARCHAR, planning_application_reference VARCHAR, repd_operator_or_applicant VARCHAR,
applicant_publication_state VARCHAR NOT NULL, technology VARCHAR NOT NULL, repd_technology VARCHAR, status VARCHAR NOT NULL,
capacity_mw DOUBLE NOT NULL, longitude DOUBLE NOT NULL, latitude DOUBLE NOT NULL, source_record_updated VARCHAR,
source_row INTEGER NOT NULL, source_row_sha256 VARCHAR NOT NULL
)"""

def write_parquet(rows, target):
    con = duckdb.connect()
    con.execute("PRAGMA threads=1")
    con.execute("SET preserve_insertion_order=true")
    con.execute(SCHEMA)
    columns = list(rows[0].keys())
    con.executemany(f"INSERT INTO projects VALUES ({','.join(['?'] * len(columns))})", [tuple(row[c] for c in columns) for row in rows])
    escaped = str(target).replace("'", "''")
    con.execute(f"COPY (SELECT * FROM projects ORDER BY TRY_CAST(repd_ref AS BIGINT), repd_ref) TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)")
    readback = con.execute(f"SELECT count(*), count(DISTINCT repd_ref), min(latitude), max(latitude), min(longitude), max(longitude) FROM read_parquet('{escaped}')").fetchone()
    schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{escaped}')").fetchall()
    con.close()
    if readback[0] != len(rows) or readback[1] != len(rows):
        raise RuntimeError(f"typed readback closure failed: {readback}")
    return readback, [{"name": item[0], "type": item[1], "nullable": item[2]} for item in schema]

def v8_parity(rows, v8_path):
    v8 = json.loads(Path(v8_path).read_text(encoding="utf-8"))
    features = v8.get("features", [])
    if len(features) != V8_FEATURES:
        raise RuntimeError(f"V8 feature count drift: {len(features)}")
    v9_keys = {(norm(r["name"]), round(r["longitude"], 4), round(r["latitude"], 4)) for r in rows}
    matches = 0
    for feature in features:
        p = feature.get("properties") or {}
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coords) >= 2 and (norm(p.get("name")), round(float(coords[0]), 4), round(float(coords[1]), 4)) in v9_keys:
            matches += 1
    ratio = matches / len(features)
    if ratio < 0.95:
        raise RuntimeError(f"V8 parity below 95%: {matches}/{len(features)}")
    return {"oracle_features": len(features), "matched_by_name_and_rounded_coordinate": matches, "match_ratio": round(ratio, 6)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--v8", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    source, v8_path, out = Path(args.source), Path(args.v8), Path(args.output)
    if source.stat().st_size != SOURCE_BYTES or digest(source) != SOURCE_SHA256:
        raise RuntimeError("official REPD input identity mismatch")
    if v8_path.stat().st_size != V8_BYTES or digest(v8_path) != V8_SHA256:
        raise RuntimeError("V8 oracle identity mismatch")
    out.mkdir(parents=True, exist_ok=True)
    rows = compile_rows(source)
    if not 10000 <= len(rows) <= 12000:
        raise RuntimeError(f"unexpected viable project count: {len(rows)}")
    cases = {row["repd_ref"]: row for row in rows}
    case = cases.get("16135")
    required_case = {"repd_postcode": "MK43 0ZY", "county": "Bedfordshire", "status": "awaiting construction", "repd_operator_or_applicant": "Prologis UK Limited"}
    if not case or any(case.get(k) != v for k, v in required_case.items()):
        raise RuntimeError(f"golden Marston Gate case failed: {case}")
    parquet = out / f"repd_projects_{GENERATION}.parquet"
    readback, schema = write_parquet(rows, parquet)
    registry = {
        "schema": "gridatlas.browser-registry.v1",
        "generation": GENERATION,
        "source": {"publisher": "DESNZ", "dataset": "REPD Q2 2026", "published": "2026-08-03", "sha256": SOURCE_SHA256},
        "relationship_label": "REPD operator or applicant (as published)",
        "records": rows
    }
    registry_path = out / f"repd_browser_registry_{GENERATION}.json"
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    parity = v8_parity(rows, v8_path)
    status_counts = Counter(row["status"] for row in rows)
    manifest = {
        "schema": "gridatlas.build-manifest.v1",
        "generation": GENERATION,
        "classification": "LIVE_CANDIDATE",
        "source": {"url": SOURCE_URL, "bytes": SOURCE_BYTES, "sha256": SOURCE_SHA256, "published": "2026-08-03"},
        "v8_oracle": {"commit": "f2f343a92ee972cc74ed23b4b99d8a22896791ad", "bytes": V8_BYTES, "sha256": V8_SHA256, **parity},
        "runtime": {"duckdb": duckdb.__version__, "parquet_compression": "ZSTD", "threads": 1},
        "closure": {"rows": len(rows), "unique_repd_refs": len({r['repd_ref'] for r in rows}), "addresses": sum(bool(r['repd_address_display']) for r in rows), "postcodes": sum(bool(r['repd_postcode_raw']) for r in rows), "valid_postcodes": sum(r['postcode_valid'] for r in rows), "status_counts": dict(sorted(status_counts.items()))},
        "parquet": {"path": parquet.name, "bytes": parquet.stat().st_size, "sha256": digest(parquet), "typed_readback": list(readback), "schema": schema},
        "browser_registry": {"path": registry_path.name, "bytes": registry_path.stat().st_size, "sha256": digest(registry_path)},
        "golden_case": {"query": "solar being built cranfield/marston bedfordshire", "repd_ref": "16135", "name": case["name"], **required_case},
        "privacy": {"possible_individual_applicants_withheld": sum(r['applicant_publication_state'] == 'WITHHELD_POSSIBLE_INDIVIDUAL' for r in rows)},
        "v8_untouched": True
    }
    (out / f"repd_v9_manifest_{GENERATION}.json").write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["closure"], sort_keys=True))

if __name__ == "__main__":
    main()
