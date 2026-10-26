#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

import duckdb


def load_manifest(site):
    matches = sorted((site / "data").glob("repd_v9_manifest_*.json"))
    if len(matches) != 1:
        raise SystemExit(f"expected one V9 manifest in {site}, found {len(matches)}")
    path = matches[0]
    manifest = json.loads(path.read_text(encoding="utf-8"))
    parquet = site / "data" / manifest["parquet"]["path"]
    if not parquet.is_file():
        raise SystemExit(f"missing Parquet declared by {path}: {parquet}")
    digest = hashlib.sha256(parquet.read_bytes()).hexdigest()
    if digest != manifest["parquet"]["sha256"] or parquet.stat().st_size != manifest["parquet"]["bytes"]:
        raise SystemExit(f"Parquet identity mismatch for {site}")
    return manifest, parquet


def metrics(connection, relation):
    row = connection.execute(
        f"""
        SELECT
          count(*) AS rows,
          count(DISTINCT repd_ref) AS unique_repd_refs,
          count(repd_address_display) AS addresses,
          count(repd_postcode_raw) AS postcodes,
          count(*) FILTER (WHERE postcode_valid) AS valid_postcodes,
          round(sum(capacity_mw), 6) AS capacity_mw
        FROM {relation}
        """
    ).fetchone()
    return dict(zip(("rows", "unique_repd_refs", "addresses", "postcodes", "valid_postcodes", "capacity_mw"), row))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--incumbent-site", required=True)
    parser.add_argument("--candidate-site", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    incumbent_site = Path(args.incumbent_site)
    candidate_site = Path(args.candidate_site)
    incumbent_manifest, incumbent_parquet = load_manifest(incumbent_site)
    candidate_manifest, candidate_parquet = load_manifest(candidate_site)

    con = duckdb.connect()
    con.execute("PRAGMA threads=1")
    incumbent_sql = str(incumbent_parquet).replace("'", "''")
    candidate_sql = str(candidate_parquet).replace("'", "''")
    con.execute(f"CREATE VIEW incumbent AS SELECT * FROM read_parquet('{incumbent_sql}')")
    con.execute(f"CREATE VIEW candidate AS SELECT * FROM read_parquet('{candidate_sql}')")
    incumbent = metrics(con, "incumbent")
    candidate = metrics(con, "candidate")
    added = con.execute("SELECT count(*) FROM candidate c ANTI JOIN incumbent i USING (repd_ref)").fetchone()[0]
    removed = con.execute("SELECT count(*) FROM incumbent i ANTI JOIN candidate c USING (repd_ref)").fetchone()[0]
    changed = con.execute(
        """
        SELECT count(*)
        FROM candidate c
        JOIN incumbent i USING (repd_ref)
        WHERE c.source_row_sha256 IS DISTINCT FROM i.source_row_sha256
           OR c.longitude IS DISTINCT FROM i.longitude
           OR c.latitude IS DISTINCT FROM i.latitude
           OR c.capacity_mw IS DISTINCT FROM i.capacity_mw
           OR c.repd_address_display IS DISTINCT FROM i.repd_address_display
           OR c.repd_postcode IS DISTINCT FROM i.repd_postcode
        """
    ).fetchone()[0]
    con.close()

    same_source = incumbent_manifest["source"]["sha256"] == candidate_manifest["source"]["sha256"]
    failures = []
    if candidate["rows"] != candidate["unique_repd_refs"]:
        failures.append("candidate REPD identity is not unique")
    if candidate_manifest["v8_oracle"]["match_ratio"] < 0.95:
        failures.append("candidate V8 oracle parity is below 95%")
    if same_source and (added or removed or changed):
        failures.append("same-source candidate changed typed REPD truth")
    if not same_source:
        incumbent_rows = max(incumbent["rows"], 1)
        if removed / incumbent_rows > 0.05:
            failures.append("candidate removes more than 5% of incumbent REPD refs")
        for field in ("addresses", "valid_postcodes"):
            old_rate = incumbent[field] / incumbent_rows
            new_rate = candidate[field] / max(candidate["rows"], 1)
            if new_rate < old_rate - 0.01:
                failures.append(f"candidate {field} coverage falls by more than one percentage point")

    report = {
        "schema": "gridatlas.incumbent-candidate.v1",
        "classification": "REJECTED" if failures else "VERIFIED_NO_DATA_REGRESSION",
        "incumbent_generation": incumbent_manifest["generation"],
        "candidate_generation": candidate_manifest["generation"],
        "same_official_source": same_source,
        "incumbent": incumbent,
        "candidate": candidate,
        "delta": {
            "rows": candidate["rows"] - incumbent["rows"],
            "addresses": candidate["addresses"] - incumbent["addresses"],
            "postcodes": candidate["postcodes"] - incumbent["postcodes"],
            "valid_postcodes": candidate["valid_postcodes"] - incumbent["valid_postcodes"],
            "capacity_mw": round(candidate["capacity_mw"] - incumbent["capacity_mw"], 6),
            "added_repd_refs": added,
            "removed_repd_refs": removed,
            "changed_repd_refs": changed,
        },
        "v8_oracle_match_ratio": candidate_manifest["v8_oracle"]["match_ratio"],
        "failures": failures,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    if failures:
        raise SystemExit("incumbent-versus-candidate gate failed")


if __name__ == "__main__":
    main()
