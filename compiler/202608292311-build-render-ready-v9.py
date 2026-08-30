#!/usr/bin/env python3
"""Build a deterministic V8-surface successor with direct MapLibre-worker 400 kV delivery."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(payload: bytes) -> str:
    return hashlib.sha1(f"blob {len(payload)}\0".encode("utf-8") + payload).hexdigest()


def write_sha256sums(root: Path) -> None:
    rows = []
    for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "sha256sums.txt"):
        rows.append((sha256_file(path), path.relative_to(root).as_posix()))
    (root / "sha256sums.txt").write_text("".join(f"{digest}  {name}\n" for digest, name in rows), encoding="utf-8", newline="\n")


def replace_exactly_once(source: str, before: str, after: str, label: str) -> str:
    require(source.count(before) == 1, f"engine patch anchor mismatch: {label}")
    return source.replace(before, after)


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
    contract = json.loads(contract_path.read_text(encoding="utf-8"))

    require(contract.get("schema") == "gridatlas.render-ready-runtime-contract.v1", "contract schema mismatch")
    require(output.name == contract["release_id"], "output directory must equal release id")
    require(not output.exists(), f"immutable output already exists: {output}")
    require(not oracle_output.exists(), f"oracle output already exists: {oracle_output}")

    parent = Path(contract["parent_release_id"])
    require(parent.is_dir(), f"missing parent release: {parent}")
    require((parent / "sha256sums.txt").is_file(), "parent sha256 manifest missing")

    output.mkdir(parents=True)
    oracle_output.mkdir(parents=True)
    shutil.copytree(parent, output, dirs_exist_ok=True)

    runtime = contract["runtime"]
    shared_path = Path(runtime["shared_cartridge_path"])
    source_400 = parent / "data/grid_400kv.geojson"
    require(source_400.is_file(), "parent 400 kV cartridge missing")
    require(sha256_file(source_400) == runtime["shared_cartridge_sha256"], "parent 400 kV SHA mismatch")
    shared_target = output.parent / shared_path
    shared_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_400, shared_target)
    require(sha256_file(shared_target) == runtime["shared_cartridge_sha256"], "shared cartridge SHA mismatch")

    oracle = contract["product_oracle"]
    for name in ("index.html", "ventusv8.css", "ventus-corev8engine.js"):
        source = parent / name
        require(source.is_file(), f"parent {name} missing")
        shutil.copyfile(source, oracle_output / name)

    bridge_name = "202608292311-maplibre-worker-bridge.js"
    shutil.copyfile(Path("ui/v8-mirror") / bridge_name, output / bridge_name)

    html_path = output / "index.html"
    html = html_path.read_text(encoding="utf-8")
    old_bridge = '<script src="202608292126-map-ready-fetch-bridge.js"></script>'
    require(html.count(old_bridge) == 1, "parent bridge tag mismatch")
    html = html.replace(old_bridge, f'<script src="{bridge_name}"></script>')
    html_path.write_text(html, encoding="utf-8", newline="\n")

    engine_path = output / "ventus-corev8engine.js"
    engine = engine_path.read_text(encoding="utf-8")
    anchors = 0

    before = """        if (isVisible) hydrateLayer(layerId);\n"""
    after = """        if (isVisible && layerId !== '400') hydrateLayer(layerId);\n"""
    engine = replace_exactly_once(engine, before, after, "skip main-thread 400 hydrate")
    anchors += 1

    before = """                map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });\n"""
    after = """                if (layer.id === '400') {\n                    map.addSource('src-400', {\n                        type: 'geojson',\n                        data: '../cartridges/5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993/grid_400kv.geojson'\n                    });\n                } else {\n                    map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });\n                }\n"""
    engine = replace_exactly_once(engine, before, after, "direct 400 MapLibre worker source")
    anchors += 1

    before = """        GRID_CONFIG.forEach(group => { group.layers.forEach(layer => { if (layer.preload) hydrateLayer(layer.id); }); });\n"""
    after = """        GRID_CONFIG.forEach(group => { group.layers.forEach(layer => { if (layer.preload && layer.id !== '400') hydrateLayer(layer.id); }); });\n        const state400 = RUNTIME_STATE['400'];\n        if (state400) { state400.loaded = true; state400.loading = false; updateUIState('400', 'OK'); }\n"""
    engine = replace_exactly_once(engine, before, after, "skip preload fetch and mark worker-backed source ready")
    anchors += 1

    engine_path.write_text(engine, encoding="utf-8", newline="\n")

    parent_map_ready = json.loads((parent / "map-ready-manifest.json").read_text(encoding="utf-8"))
    parent_map_ready["schema"] = "gridatlas.map-ready-cartridge-manifest.v2"
    parent_map_ready["generation"] = contract["generation"]
    parent_map_ready["release_id"] = contract["release_id"]
    parent_map_ready["source_commit"] = source_commit
    architecture = parent_map_ready.setdefault("architecture", {})
    architecture.update({
        "critical_400kv_delivery": runtime["delivery"],
        "critical_400kv_window_prefetch": runtime["window_prefetch"],
        "critical_400kv_main_thread_json_parse": runtime["main_thread_json_parse"],
        "critical_400kv_duplicate_fetch": runtime["duplicate_fetch"],
        "critical_400kv_cache_identity": runtime["cache_identity"],
        "critical_400kv_shared_cartridge_path": runtime["shared_cartridge_path"],
    })
    (output / "map-ready-manifest.json").write_text(json.dumps(parent_map_ready, indent=2) + "\n", encoding="utf-8", newline="\n")

    release_manifest = {
        "schema": "gridatlas.v8-render-ready-release.v1",
        "classification": "V8_RENDER_READY_PERFORMANCE_CANDIDATE",
        "generation": contract["generation"],
        "release_id": contract["release_id"],
        "parent_release_id": contract["parent_release_id"],
        "source_commit": source_commit,
        "immutable_after_publication": True,
        "product_surface": "PINNED_V8_WITH_WORKER_SOURCE_400KV",
        "critical_400kv_delivery": runtime["delivery"],
        "shared_cartridge_path": runtime["shared_cartridge_path"],
        "machine_learning_record": contract["machine_learning_record"],
        "promotion_policy": "AUTOMATIC_ONLY_AFTER_ACTUAL_RENDER_LOCAL_AND_PUBLIC_GATES",
    }
    (output / "release-manifest.json").write_text(json.dumps(release_manifest, indent=2) + "\n", encoding="utf-8", newline="\n")

    build_manifest = {
        "schema": "gridatlas.render-ready-build-manifest.v1",
        "classification": "DETERMINISTIC_BUILD_COMPLETE",
        "generation": contract["generation"],
        "release_id": contract["release_id"],
        "source_commit": source_commit,
        "contract_sha256": sha256_file(contract_path),
        "compiler_sha256": sha256_file(Path(__file__)),
        "engine_patch_anchors": anchors,
        "delivery": runtime["delivery"],
        "shared_cartridge": runtime["shared_cartridge_path"],
        "shared_cartridge_sha256": runtime["shared_cartridge_sha256"],
        "v8_css_blob_sha1": git_blob_sha1((output / "ventusv8.css").read_bytes()),
        "parent_release_id": contract["parent_release_id"],
    }
    (output / "build-manifest.json").write_text(json.dumps(build_manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    write_sha256sums(output)

    print(canonical({
        "classification": "DETERMINISTIC_RENDER_READY_RELEASE_BUILT",
        "release_id": contract["release_id"],
        "critical_400kv_rows": runtime["critical_rows"],
        "engine_patch_anchors": anchors,
        "delivery": runtime["delivery"],
        "shared_cartridge": runtime["shared_cartridge_path"],
        "shared_cartridge_sha256": runtime["shared_cartridge_sha256"],
        "output": output.as_posix(),
    }))


if __name__ == "__main__":
    main()
