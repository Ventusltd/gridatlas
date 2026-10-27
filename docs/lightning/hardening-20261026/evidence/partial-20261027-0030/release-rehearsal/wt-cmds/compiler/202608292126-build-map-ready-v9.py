#!/usr/bin/env python3
"""Build a deterministic V8-surface successor with map-ready preload cartridges."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable

import duckdb


def canonical(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(payload: bytes) -> str:
    return hashlib.sha1(f"blob {len(payload)}\0".encode("utf-8") + payload).hexdigest()


def fetch_bytes(url: str, attempts: int = 5, timeout: int = 180) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "gridatlas-map-ready-compiler/202608292126"},
            )
            with urllib.request.urlopen(request, timeout=timeout) as response:
                require(200 <= response.status < 300, f"HTTP {response.status}: {url}")
                return response.read()
        except Exception as error:  # noqa: BLE001 - retry boundary
            last_error = error
            if attempt < attempts:
                time.sleep(min(attempt * 2, 8))
    raise RuntimeError(f"failed after {attempts} attempts: {url}: {last_error}")


def raw_url(repository: str, commit: str, path: str) -> str:
    quoted = urllib.parse.quote(path, safe="/")
    return f"https://raw.githubusercontent.com/{repository}/{commit}/{quoted}"


def write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def load_json_bytes(payload: bytes, label: str) -> dict[str, Any]:
    try:
        result = json.loads(
            payload,
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
        )
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"invalid JSON: {label}: {error}") from error
    require(isinstance(result, dict), f"JSON root is not object: {label}")
    return result


def sql_path(path: Path) -> str:
    return str(path).replace("'", "''")


def parquet_to_geojson(
    parquet_path: Path,
    output_path: Path,
    expected_rows: int,
    expected_source_id: str,
) -> dict[str, Any]:
    connection = duckdb.connect()
    connection.execute("PRAGMA threads=1")
    connection.execute("SET preserve_insertion_order=true")
    escaped = sql_path(parquet_path)
    columns = {
        row[0]
        for row in connection.execute(
            f"DESCRIBE SELECT * FROM read_parquet('{escaped}')"
        ).fetchall()
    }
    required_columns = {
        "source_id",
        "feature_index",
        "feature_id",
        "geometry_json",
        "properties_json",
    }
    require(
        required_columns.issubset(columns),
        f"Parquet columns missing for {parquet_path}: {sorted(required_columns - columns)}",
    )
    projected_column = (
        "projected_feature_sha256"
        if "projected_feature_sha256" in columns
        else "NULL AS projected_feature_sha256"
    )
    cursor = connection.execute(
        f"""
        SELECT source_id, feature_index, feature_id, geometry_json, properties_json,
               {projected_column}
        FROM read_parquet('{escaped}')
        ORDER BY feature_index
        """
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    feature_count = 0
    source_ids: set[str] = set()
    feature_set_digest = hashlib.sha256()
    min_index: int | None = None
    max_index: int | None = None

    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write('{"features":[')
        first = True
        while True:
            rows = cursor.fetchmany(1000)
            if not rows:
                break
            for (
                source_id,
                feature_index,
                feature_id,
                geometry_json,
                properties_json,
                projected_hash,
            ) in rows:
                source_id = str(source_id)
                source_ids.add(source_id)
                index = int(feature_index)
                min_index = index if min_index is None else min(min_index, index)
                max_index = index if max_index is None else max(max_index, index)
                geometry = json.loads(str(geometry_json))
                properties = json.loads(str(properties_json or "{}"))
                require(isinstance(geometry, dict), f"bad geometry at {source_id}:{index}")
                require(isinstance(properties, dict), f"bad properties at {source_id}:{index}")
                feature = {
                    "type": "Feature",
                    "id": str(feature_id) if feature_id not in (None, "") else f"{source_id}:{index}",
                    "geometry": geometry,
                    "properties": properties,
                }
                encoded = canonical(feature)
                if not first:
                    handle.write(",")
                handle.write(encoded)
                first = False
                feature_count += 1
                feature_set_digest.update(
                    (str(projected_hash) if projected_hash else sha256_bytes(encoded.encode("utf-8"))).encode("ascii")
                )
                feature_set_digest.update(b"\n")
        handle.write('],"type":"FeatureCollection"}\n')
    connection.close()

    require(feature_count == expected_rows, f"row mismatch for {output_path}: {feature_count} != {expected_rows}")
    require(source_ids == {expected_source_id}, f"source identity mismatch for {output_path}: {sorted(source_ids)}")
    require(min_index == 0, f"feature index does not start at zero for {output_path}")
    require(max_index == expected_rows - 1, f"feature index is not contiguous for {output_path}")

    return {
        "url": output_path.as_posix(),
        "rows": feature_count,
        "bytes": output_path.stat().st_size,
        "sha256": sha256_file(output_path),
        "feature_set_sha256": feature_set_digest.hexdigest(),
        "source_id": expected_source_id,
        "feature_index_range": [min_index, max_index],
    }


def deterministic_tree_manifest(root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        if path.name == "sha256sums.txt":
            continue
        rows.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return rows


def write_sha256sums(root: Path) -> None:
    rows = deterministic_tree_manifest(root)
    text = "".join(f"{row['sha256']}  {row['path']}\n" for row in rows)
    (root / "sha256sums.txt").write_text(text, encoding="utf-8", newline="\n")


def copy_source(path: str, target: Path) -> None:
    source = Path(path)
    require(source.is_file(), f"missing source file: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--oracle-output", required=True)
    parser.add_argument("--source-commit", required=True)
    args = parser.parse_args()

    contract_path = Path(args.contract)
    output = Path(args.output)
    oracle_output = Path(args.oracle_output)
    source_commit = args.source_commit

    require(contract_path.is_file(), f"missing contract: {contract_path}")
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    require(contract.get("schema") == "gridatlas.map-ready-runtime-contract.v1", "contract schema mismatch")
    require(output.name == contract["release_id"], "output directory must equal release id")
    require(not output.exists(), f"immutable output already exists: {output}")
    require(not oracle_output.exists(), f"oracle output already exists: {oracle_output}")
    output.mkdir(parents=True)
    oracle_output.mkdir(parents=True)

    oracle = contract["product_oracle"]
    oracle_base = f"{oracle['root'].rstrip('/')}/"
    oracle_files = {
        "index.html": oracle["index_blob_sha1"],
        "ventusv8.css": oracle["css_blob_sha1"],
        "ventus-corev8engine.js": oracle["engine_blob_sha1"],
    }
    oracle_payloads: dict[str, bytes] = {}
    for relative, expected_blob in oracle_files.items():
        payload = fetch_bytes(
            raw_url(
                oracle["repository"],
                oracle["commit"],
                f"{oracle_base}{relative}",
            )
        )
        require(git_blob_sha1(payload) == expected_blob, f"V8 Git blob mismatch: {relative}")
        oracle_payloads[relative] = payload
        write_bytes(oracle_output / relative, payload)

    for relative, evidence in oracle["critical_oracle_files"].items():
        payload = fetch_bytes(
            raw_url(
                oracle["repository"],
                oracle["commit"],
                f"{oracle_base}{relative}",
            )
        )
        require(len(payload) == int(evidence["bytes"]), f"V8 critical byte mismatch: {relative}")
        require(git_blob_sha1(payload) == evidence["git_blob_sha1"], f"V8 critical Git blob mismatch: {relative}")
        write_bytes(oracle_output / relative, payload)

    data_plane = contract["data_plane"]
    manifest_payload = fetch_bytes(
        raw_url(
            data_plane["repository"],
            data_plane["commit"],
            data_plane["manifest_path"],
        )
    )
    require(
        sha256_bytes(manifest_payload) == data_plane["manifest_sha256"],
        "pinned data manifest SHA-256 mismatch",
    )
    data_manifest = load_json_bytes(manifest_payload, data_plane["manifest_path"])
    require(data_manifest.get("schema") == "data-gridatlas.v8-transplant-manifest.v1", "data manifest schema mismatch")
    require(data_manifest.get("closure", {}).get("sources") == 56, "data source closure mismatch")
    require(data_manifest.get("closure", {}).get("layers") == 60, "data layer closure mismatch")
    require(data_manifest.get("closure", {}).get("features") == 541282, "data feature closure mismatch")
    artifact_index = {
        item["path"]: item
        for item in data_manifest.get("artifacts", [])
        if isinstance(item, dict) and isinstance(item.get("path"), str)
    }

    downloads = output.parent / f".{output.name}-downloads"
    require(not downloads.exists(), f"download workspace already exists: {downloads}")
    downloads.mkdir(parents=True)
    materialised: list[dict[str, Any]] = []

    try:
        for source in contract["map_ready_sources"]:
            artifact_path = source["artifact"]
            artifact = artifact_index.get(artifact_path)
            require(artifact is not None, f"artifact absent from manifest: {artifact_path}")
            require(int(artifact["rows"]) == int(source["expected_rows"]), f"manifest row mismatch: {artifact_path}")
            parquet_repo_path = (
                Path(data_plane["manifest_path"]).parent / artifact_path
            ).as_posix()
            payload = fetch_bytes(
                raw_url(
                    data_plane["repository"],
                    data_plane["commit"],
                    parquet_repo_path,
                )
            )
            require(len(payload) == int(artifact["bytes"]), f"artifact byte mismatch: {artifact_path}")
            require(sha256_bytes(payload) == artifact["sha256"], f"artifact SHA-256 mismatch: {artifact_path}")
            local_parquet = downloads / Path(artifact_path).name
            write_bytes(local_parquet, payload)
            target = output / source["url"]
            record = parquet_to_geojson(
                local_parquet,
                target,
                int(source["expected_rows"]),
                source["source_id"],
            )
            record.update(
                {
                    "url": source["url"],
                    "artifact": artifact_path,
                    "artifact_bytes": int(artifact["bytes"]),
                    "artifact_sha256": artifact["sha256"],
                    "pre_snapped": bool(source["pre_snapped"]),
                    "critical": bool(source["critical"]),
                }
            )
            materialised.append(record)
    finally:
        shutil.rmtree(downloads, ignore_errors=True)

    require(len(materialised) == 11, "map-ready cartridge count mismatch")
    critical = [row for row in materialised if row["critical"]]
    require(len(critical) == 1 and critical[0]["source_id"] == "grid_400kv", "critical cartridge mismatch")
    require(critical[0]["rows"] == 4106, "400kV row closure mismatch")

    copy_source(
        "ui/v8-mirror/202608292126-map-ready-fetch-bridge.js",
        output / "202608292126-map-ready-fetch-bridge.js",
    )
    copy_source(
        "ui/v8-mirror/202608291818-place-postcode-search.js",
        output / "202608291818-place-postcode-search.js",
    )
    copy_source(
        "ui/v8-mirror/202608292126-pre-snapped-config-adapter.js",
        output / "202608292126-pre-snapped-config-adapter.js",
    )
    write_bytes(output / "ventusv8.css", oracle_payloads["ventusv8.css"])
    write_bytes(output / "ventus-corev8engine.js", oracle_payloads["ventus-corev8engine.js"])

    oracle_html = oracle_payloads["index.html"].decode("utf-8")
    engine_tag = '<script src="ventus-corev8engine.js"></script>'
    require(oracle_html.count(engine_tag) == 1, "V8 engine tag contract changed")
    before = (
        '<script src="202608292126-map-ready-fetch-bridge.js"></script>\n'
        '<script src="202608291818-place-postcode-search.js"></script>\n\n'
    )
    after = '\n<script src="202608292126-pre-snapped-config-adapter.js"></script>'
    candidate_html = oracle_html.replace(engine_tag, before + engine_tag + after)
    require(candidate_html.count("202608292126-map-ready-fetch-bridge.js") == 1, "bridge injection failed")
    require(candidate_html.count("202608292126-pre-snapped-config-adapter.js") == 1, "config adapter injection failed")
    require(candidate_html.replace(before, "").replace(after, "") == oracle_html, "unapproved V8 HTML delta")
    (output / "index.html").write_text(candidate_html, encoding="utf-8", newline="\n")

    map_ready_manifest = {
        "schema": "gridatlas.map-ready-cartridge-manifest.v1",
        "classification": "DETERMINISTIC_MAP_READY_CARTRIDGES",
        "generation": contract["generation"],
        "release_id": contract["release_id"],
        "source_commit": source_commit,
        "product_oracle": {
            "repository": oracle["repository"],
            "commit": oracle["commit"],
            "index_blob_sha1": oracle["index_blob_sha1"],
            "css_blob_sha1": oracle["css_blob_sha1"],
            "engine_blob_sha1": oracle["engine_blob_sha1"],
        },
        "data_plane": {
            "repository": data_plane["repository"],
            "commit": data_plane["commit"],
            "release_id": data_plane["release_id"],
            "manifest_sha256": data_plane["manifest_sha256"],
        },
        "architecture": {
            "map_ready_same_origin_geojson": True,
            "preload_browser_duckdb": False,
            "serialized_preload_queue": False,
            "topology_pre_snapped": True,
            "topology_snap_bypass_layer_ids": contract["topology_snap_bypass_layer_ids"],
            "analytical_search_duckdb_retained": True,
        },
        "cartridges": materialised,
        "closure": {
            "cartridges": len(materialised),
            "rows": sum(int(row["rows"]) for row in materialised),
            "bytes": sum(int(row["bytes"]) for row in materialised),
            "critical_400kv_rows": critical[0]["rows"],
        },
    }
    map_ready_path = output / "map-ready-manifest.json"
    map_ready_path.write_text(json.dumps(map_ready_manifest, indent=2) + "\n", encoding="utf-8", newline="\n")

    release_manifest = {
        "schema": "gridatlas.v8-map-ready-release.v1",
        "classification": "V8_MAP_READY_PERFORMANCE_CANDIDATE",
        "generation": contract["generation"],
        "release_id": contract["release_id"],
        "parent_release_id": contract["parent_release_id"],
        "source_commit": source_commit,
        "immutable_after_publication": True,
        "product_surface": "PINNED_V8_WITH_EXPLICIT_INVISIBLE_ADAPTERS",
        "permitted_product_delta": contract["permitted_product_delta"],
        "map_ready_manifest_sha256": sha256_file(map_ready_path),
        "machine_learning_record": contract["machine_learning_record"],
        "promotion_policy": "AUTOMATIC_ONLY_AFTER_LOCAL_AND_PUBLIC_COMPARATOR_GATES",
    }
    (output / "release-manifest.json").write_text(
        json.dumps(release_manifest, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    build_manifest = {
        "schema": "gridatlas.map-ready-build-manifest.v1",
        "classification": "DETERMINISTIC_BUILD_COMPLETE",
        "generation": contract["generation"],
        "release_id": contract["release_id"],
        "source_commit": source_commit,
        "contract_sha256": sha256_file(contract_path),
        "compiler_sha256": sha256_file(Path(__file__)),
        "map_ready_manifest_sha256": sha256_file(map_ready_path),
        "v8_css_blob_sha1": git_blob_sha1((output / "ventusv8.css").read_bytes()),
        "v8_engine_blob_sha1": git_blob_sha1((output / "ventus-corev8engine.js").read_bytes()),
        "closure": map_ready_manifest["closure"],
    }
    (output / "build-manifest.json").write_text(
        json.dumps(build_manifest, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    write_sha256sums(output)

    print(
        canonical(
            {
                "classification": "DETERMINISTIC_MAP_READY_RELEASE_BUILT",
                "release_id": contract["release_id"],
                "cartridges": len(materialised),
                "rows": map_ready_manifest["closure"]["rows"],
                "bytes": map_ready_manifest["closure"]["bytes"],
                "critical_400kv_rows": critical[0]["rows"],
                "output": output.as_posix(),
            }
        )
    )


if __name__ == "__main__":
    main()
