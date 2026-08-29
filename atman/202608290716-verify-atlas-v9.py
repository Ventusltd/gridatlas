#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import duckdb

GENERATION = "202608290716"
EXPECTED_COLUMNS = [
    ("repd_ref", "VARCHAR"), ("name", "VARCHAR"), ("repd_address_raw", "VARCHAR"),
    ("repd_address_display", "VARCHAR"), ("repd_postcode_raw", "VARCHAR"),
    ("repd_postcode", "VARCHAR"), ("postcode_valid", "BOOLEAN"), ("county", "VARCHAR"),
    ("region", "VARCHAR"), ("country", "VARCHAR"), ("planning_authority", "VARCHAR"),
    ("planning_application_reference", "VARCHAR"), ("repd_operator_or_applicant", "VARCHAR"),
    ("applicant_publication_state", "VARCHAR"), ("technology", "VARCHAR"),
    ("repd_technology", "VARCHAR"), ("status", "VARCHAR"), ("capacity_mw", "DOUBLE"),
    ("longitude", "DOUBLE"), ("latitude", "DOUBLE"), ("source_record_updated", "VARCHAR"),
    ("source_row", "INTEGER"), ("source_row_sha256", "VARCHAR")
]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    args = parser.parse_args()
    site = Path(args.site)
    data = site / "data"
    manifest_path = data / f"repd_v9_manifest_{GENERATION}.json"
    registry_path = data / f"repd_browser_registry_{GENERATION}.json"
    parquet_path = data / f"repd_projects_{GENERATION}.parquet"
    required = [site / "index.html", site / "assets" / "atlas-v9.mjs", site / "assets" / "atlas-v9.css", site / "cartridges" / f"{GENERATION}-repd-address-flyto.mjs", manifest_path, registry_path, parquet_path]
    missing = [str(path.relative_to(site)) for path in required if not path.is_file()]
    if missing:
        raise SystemExit(f"missing closure: {missing}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    if manifest["runtime"]["duckdb"] != "1.3.2" or manifest["runtime"]["parquet_compression"] != "ZSTD":
        raise SystemExit("DuckDB/ZSTD pin failed")
    if sha(parquet_path) != manifest["parquet"]["sha256"] or parquet_path.stat().st_size != manifest["parquet"]["bytes"]:
        raise SystemExit("Parquet identity failed")
    if sha(registry_path) != manifest["browser_registry"]["sha256"] or registry_path.stat().st_size != manifest["browser_registry"]["bytes"]:
        raise SystemExit("registry identity failed")
    con = duckdb.connect()
    schema = [(row[0], row[1]) for row in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{parquet_path}')").fetchall()]
    if schema != EXPECTED_COLUMNS:
        raise SystemExit(f"typed schema drift: {schema}")
    stats = con.execute(f"SELECT count(*), count(DISTINCT repd_ref), count(repd_address_display), count(repd_postcode_raw), count(*) FILTER (WHERE postcode_valid), count(*) FILTER (WHERE applicant_publication_state='WITHHELD_POSSIBLE_INDIVIDUAL') FROM read_parquet('{parquet_path}')").fetchone()
    case = con.execute(f"SELECT name, repd_address_display, repd_postcode, county, status, repd_operator_or_applicant FROM read_parquet('{parquet_path}') WHERE repd_ref='16135'").fetchone()
    con.close()
    if stats[0] != stats[1] or stats[0] != len(registry["records"]) or stats[0] != manifest["closure"]["rows"]:
        raise SystemExit(f"row closure failed: {stats}")
    if stats[2] < 10000 or stats[3] < 8500 or stats[4] < 8000:
        raise SystemExit(f"location completeness floor failed: {stats}")
    if case != ("Prologis DC4 Marston Gate, Brockley Way - Solar Panels", "Prologis Marston Gate DC4, Unit 1 Brockley Way, Brogborough", "MK43 0ZY", "Bedfordshire", "awaiting construction", "Prologis UK Limited"):
        raise SystemExit(f"golden case failed: {case}")
    if manifest["v8_oracle"]["oracle_features"] != 10784 or manifest["v8_oracle"]["match_ratio"] < 0.95 or not manifest["v8_untouched"]:
        raise SystemExit("V8 oracle proof failed")
    html = (site / "index.html").read_text(encoding="utf-8")
    app = (site / "assets" / "atlas-v9.mjs").read_text(encoding="utf-8")
    cartridge = (site / "cartridges" / f"{GENERATION}-repd-address-flyto.mjs").read_text(encoding="utf-8")
    required_text = ["GRID ATLAS V9", "Official REPD address", "ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT", "mountRepdAddressFlyTo", "DIRECT_PROJECT_MATCH"]
    joined = html + app + cartridge
    absent = [item for item in required_text if item not in joined]
    if absent:
        raise SystemExit(f"UI contract text missing: {absent}")
    forbidden = ["nominatim", "reverse-geocode", "verified owner", "confirmed owner"]
    found = [item for item in forbidden if item in joined.lower()]
    if found:
        raise SystemExit(f"forbidden inference/provider found: {found}")
    print(json.dumps({"classification": "VERIFIED", "rows": stats[0], "addresses": stats[2], "postcodes": stats[3], "valid_postcodes": stats[4], "withheld_possible_individuals": stats[5], "v8_match_ratio": manifest["v8_oracle"]["match_ratio"], "golden_repd_ref": "16135"}, sort_keys=True))

if __name__ == "__main__":
    main()
