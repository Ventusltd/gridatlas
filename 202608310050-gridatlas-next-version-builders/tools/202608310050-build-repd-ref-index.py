#!/usr/bin/env python3
"""Build the N2 static exact-REPD reference index as an isolated test artefact."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import duckdb

EXPECTED_PARQUET_SHA256 = "174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b"
EXPECTED_ROWS = 11069
EXPECTED_COLUMNS = ["name", "technology", "status", "capacity_mw", "longitude", "latitude"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, value: Any, *, compact: bool = False) -> None:
    if compact:
        write_text(path, json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=False))
    else:
        write_text(path, json.dumps(value, indent=2, ensure_ascii=False, sort_keys=False))


def normal(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        if value != value:
            return None
        return round(value, 7)
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--parquet", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--generation", required=True)
    parser.add_argument("--build-plan", type=Path, default=Path("_build-plan"))
    args = parser.parse_args()

    parquet = args.parquet.resolve()
    output = (args.output / "repd-ref-index").resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not parquet.is_file():
        raise SystemExit(f"missing Parquet {parquet}")
    parquet_sha = sha256(parquet)
    if parquet_sha != EXPECTED_PARQUET_SHA256:
        raise SystemExit(f"Parquet SHA-256 mismatch: {parquet_sha}")

    connection = duckdb.connect(database=":memory:", read_only=False, config={"threads": "1"})
    try:
        rows = connection.execute(
            """
            SELECT
              CAST(repd_ref AS VARCHAR) AS repd_ref,
              CAST(name AS VARCHAR) AS name,
              CAST(technology AS VARCHAR) AS technology,
              CAST(status AS VARCHAR) AS status,
              CAST(capacity_mw AS DOUBLE) AS capacity_mw,
              CAST(longitude AS DOUBLE) AS longitude,
              CAST(latitude AS DOUBLE) AS latitude
            FROM read_parquet(?)
            ORDER BY TRY_CAST(repd_ref AS BIGINT) ASC NULLS LAST, repd_ref ASC
            """,
            [str(parquet)],
        ).fetchall()
    finally:
        connection.close()

    if len(rows) != EXPECTED_ROWS:
        raise SystemExit(f"row closure mismatch: {len(rows)} != {EXPECTED_ROWS}")

    records: dict[str, list[Any]] = {}
    false_origins = 0
    unmapped = 0
    for repd_ref, name, technology, status, capacity_mw, longitude, latitude in rows:
        ref = str(repd_ref).strip()
        if not ref:
            raise SystemExit("empty repd_ref")
        if ref in records:
            raise SystemExit(f"duplicate repd_ref {ref}")
        lon = normal(longitude)
        lat = normal(latitude)
        if lon is None or lat is None:
            unmapped += 1
        if lon is not None and lat is not None and abs(lat - 49.766807) < 1e-9 and abs(lon + 7.55716) < 1e-9:
            false_origins += 1
        records[ref] = [
            str(name or ""),
            str(technology or ""),
            str(status or ""),
            normal(capacity_mw),
            lon,
            lat,
        ]

    index = {
        "schema": "gridatlas.repd-ref-index.v1",
        "generation": args.generation,
        "source": {
            "path": "data/repd_projects_202608290716.parquet",
            "sha256": parquet_sha,
            "rows": EXPECTED_ROWS,
        },
        "identity": "EXACT_REPD_REF_ONLY",
        "row_format": EXPECTED_COLUMNS,
        "rows": len(records),
        "records": records,
    }
    json_path = output / f"repd_ref_index_{args.generation}.json"
    write_json(json_path, index, compact=True)

    gzip_path = output / f"repd_ref_index_{args.generation}.json.gz"
    with gzip.GzipFile(filename="", mode="wb", fileobj=gzip_path.open("wb"), compresslevel=9, mtime=0) as target:
        target.write(json_path.read_bytes())

    golden = records.get("13599")
    if not golden or "Beacon Fen" not in golden[0]:
        raise SystemExit("golden REPD 13599 missing or unexpected")

    manifest = {
        "schema": "gridatlas.repd-ref-index-manifest.v1",
        "generation": args.generation,
        "classification": "TEST_DATA_ARTEFACT_NOT_INSTALLED",
        "source_parquet": {
            "path": "data/repd_projects_202608290716.parquet",
            "bytes": parquet.stat().st_size,
            "sha256": parquet_sha,
        },
        "index": {
            "path": json_path.name,
            "bytes": json_path.stat().st_size,
            "sha256": sha256(json_path),
            "gzip_path": gzip_path.name,
            "gzip_bytes": gzip_path.stat().st_size,
            "gzip_sha256": sha256(gzip_path),
            "rows": len(records),
            "unique_repd_refs": len(records),
            "row_format": EXPECTED_COLUMNS,
            "unmapped_rows": unmapped,
            "false_origin_rows": false_origins,
        },
        "golden": {
            "repd_ref": "13599",
            "name": golden[0],
            "longitude": golden[4],
            "latitude": golden[5],
        },
        "contracts": {
            "deep_link_uses_duckdb": False,
            "free_text_search_still_uses_duckdb_lazily": True,
            "live_pointer_changed": False,
            "cartridge_installed": False,
            "full_application_copy_created": False,
        },
    }
    write_json(output / "manifest.json", manifest)

    required_drafts = [
        args.build_plan / "DRAFT-CARTRIDGES" / "exact-ref-index.spec.md",
        args.build_plan / "DRAFT-CARTRIDGES" / "exact-ref-index.js.txt",
    ]
    missing = [str(path) for path in required_drafts if not path.is_file()]
    copied: list[dict[str, Any]] = []
    if not missing:
        draft_output = output / "draft-inputs"
        draft_output.mkdir(parents=True, exist_ok=True)
        for source in required_drafts:
            target = draft_output / source.name
            shutil.copyfile(source, target)
            copied.append({"source": str(source), "target": target.name, "sha256": sha256(target)})
    write_json(
        output / "cartridge-installation-readiness.json",
        {
            "schema": "gridatlas.exact-ref-index-installation-readiness.v1",
            "generation": args.generation,
            "status": "READY_FOR_ANCHORED_CARTRIDGE_BUILD" if not missing else "BLOCKED_MISSING_DRAFT_INPUTS",
            "missing": missing,
            "copied_drafts": copied,
            "rule": "Do not infer or rewrite the anchored search-cartridge patch when the reviewed draft is absent.",
        },
    )
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
