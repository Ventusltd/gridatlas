#!/usr/bin/env python3
"""Build the GridAtlas v9.5 highway transport repair as one hashed cartridge.

The immutable shell is never edited. The existing map bridge is copied from the
frozen shell, patched deterministically, and installed through atlas/current.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

CVAA_SHA = "d2ebc01f6eab41f2a84b0c53c4cfae0d2625ec5e"
GLOBALGRID_SHA = "6afd5dea721648e3ef14d5705d9f2dc3589af100"
CARTRIDGE_ID = "highway-static-transport"
REPLACE_SCRIPT = "202608292311-maplibre-worker-bridge.js"
GEN_RE = re.compile(r"^[0-9]{12}$")
STATIC_NAMES = (
    "uk_motorways.geojson",
    "uk_trunk_roads.geojson",
    "uk_primary_roads.geojson",
)

class BuildError(RuntimeError):
    pass

def require(condition: bool, message: str) -> None:
    if not condition:
        raise BuildError(message)

def read_json(path: Path) -> dict[str, Any]:
    require(path.is_file(), f"missing JSON: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(value, dict), f"JSON root must be object: {path}")
    return value

def canonical_json(value: dict[str, Any]) -> str:
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    tmp.write_text(content, encoding="utf-8", newline="\n")
    tmp.replace(path)

def patch_bridge(source: str, generation: str) -> str:
    original = source
    source, n = re.subn(r"const GENERATION = '[0-9]{12}';", f"const GENERATION = '{generation}';", source, count=1)
    require(n == 1, "immutable bridge generation marker missing")
    duckdb_line = "  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';\n"
    require(source.count(duckdb_line) == 1, "immutable bridge DuckDB marker missing")
    static_block = f"""  const HIGHWAY_SOURCE_COMMIT = '{GLOBALGRID_SHA}';
  const HIGHWAY_STATIC = new Map([
    ['uk_motorways.geojson', 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/{GLOBALGRID_SHA}/uk_motorways.geojson'],
    ['uk_trunk_roads.geojson', 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/{GLOBALGRID_SHA}/uk_trunk_roads.geojson'],
    ['uk_primary_roads.geojson', 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/{GLOBALGRID_SHA}/uk_primary_roads.geojson']
  ]);
"""
    source = source.replace(duckdb_line, duckdb_line + static_block, 1)
    architecture_marker = "      analytical_search_duckdb_retained: true\n"
    require(source.count(architecture_marker) == 1, "bridge architecture marker missing")
    source = source.replace(architecture_marker, architecture_marker + "      visual_highways_static_geojson: true,\n" + "      primary_roads_duckdb_rehydration: false\n", 1)
    source = source.replace("      analytical_search_duckdb_retained: true\n      visual_highways_static_geojson:", "      analytical_search_duckdb_retained: true,\n      visual_highways_static_geojson:", 1)
    state_marker = "    loaded_on_demand: {},\n"
    require(source.count(state_marker) == 1, "bridge state marker missing")
    source = source.replace(state_marker, state_marker + "    highway_static_requests: 0,\n" + "    highway_static_sources: {},\n", 1)
    legacy_function_end = """  function legacyStem(pathname) {
    const name = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase();
    if (name === 'repd_master.json') return 'repd_master_v8_oracle';
    if (name === 'heavy_emitters_uk.json') return 'heavy_emitters_uk';
    if (name.endsWith('.geojson')) return name.slice(0, -8);
    return '';
  }
"""
    require(source.count(legacy_function_end) == 1, "legacyStem block changed unexpectedly")
    helper = """
  function highwayStatic(pathname) {
    const name = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase();
    const url = HIGHWAY_STATIC.get(name);
    return url ? { name, url } : null;
  }
"""
    source = source.replace(legacy_function_end, legacy_function_end + helper, 1)
    fetch_marker = """  window.fetch = async function gridAtlasMaplibreWorkerFetch(input, init = undefined) {
    const pathname = requestPath(input);
    const readyKey = mapReadyKey(pathname);

"""
    require(source.count(fetch_marker) == 1, "window.fetch bridge marker missing")
    static_fetch = """  window.fetch = async function gridAtlasMaplibreWorkerFetch(input, init = undefined) {
    const pathname = requestPath(input);
    const readyKey = mapReadyKey(pathname);
    const highway = highwayStatic(pathname);

    if (highway) {
      state.highway_static_requests += 1;
      state.highway_static_sources[highway.name] = {
        source_commit: HIGHWAY_SOURCE_COMMIT,
        url: highway.url,
        delivery: 'PINNED_V8_STATIC_GEOJSON',
        duckdb: false
      };
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const response = await nativeFetch(highway.url, { ...(init || {}), cache: 'force-cache', mode: 'cors' });
      invariant(response.ok, `${highway.name} static HTTP ${response.status}`);
      return response;
    }

"""
    source = source.replace(fetch_marker, static_fetch, 1)
    require(source != original, "bridge patch made no changes")
    for name in STATIC_NAMES:
        require(name in source, f"missing static source {name}")
    require("table.toArray().map" in source, "analytical DuckDB fallback was lost")
    require("primary_roads_duckdb_rehydration: false" in source, "repair contract missing")
    return source

def make_contract(generation: str, cartridge_sha: str) -> str:
    urls = {name: f"https://raw.githubusercontent.com/Ventusltd/globalgrid2050/{GLOBALGRID_SHA}/{name}" for name in STATIC_NAMES}
    payload = {
        "schema": "gridatlas.highway-static-transport-contract.v1",
        "generation": generation,
        "version": "v9.5",
        "cartridge_id": CARTRIDGE_ID,
        "cartridge_sha256": cartridge_sha,
        "replace_script": REPLACE_SCRIPT,
        "source_repository": "Ventusltd/globalgrid2050",
        "source_commit": GLOBALGRID_SHA,
        "sources": urls,
        "transport": "PINNED_V8_STATIC_GEOJSON",
        "duckdb_for_visual_highways": False,
        "analytical_duckdb_fallback_retained": True,
        "immutable_shell_mutated": False,
        "full_application_copies_created": 0,
    }
    return "export default " + json.dumps(payload, indent=2, sort_keys=True) + ";\n"

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generation", required=True)
    parser.add_argument("--current", default="atlas/current.json")
    parser.add_argument("--shell-bridge", default="atlas/releases/202608300453-atlas-v9/202608292311-maplibre-worker-bridge.js")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    generation = args.generation
    require(bool(GEN_RE.fullmatch(generation)), "generation must be UTC YYYYMMDDHHMM")
    current_path = Path(args.current)
    current = read_json(current_path)
    require(current.get("schema") == "gridatlas.current.v2", "unexpected current schema")
    require(current.get("architecture") == "IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES", "composition architecture changed")
    require(current.get("composition_version") == "v9.5", "not a v9.5 composition")
    require(current.get("release_id") == "202608300453-atlas-v9", "unexpected shell")
    require(current.get("contracts", {}).get("shell_mutation_forbidden") is True, "shell not frozen")
    existing = next((item for item in current.get("cartridges", []) if item.get("id") == CARTRIDGE_ID), None)
    if existing:
        existing_path = Path("atlas") / str(existing["path"]).removeprefix("./")
        require(existing_path.is_file(), f"installed cartridge missing: {existing_path}")
        require(sha256_bytes(existing_path.read_bytes()) == existing.get("sha256"), "installed cartridge hash mismatch")
        report = {"schema": "gridatlas.highway-transport-build.v1", "status": "ALREADY_INSTALLED", "changed": False, "generation": current["generation"], "composition_id": current["composition_id"], "cartridge": existing, "full_application_copies_created": 0, "shell_mutated": False}
        write_atomic(Path(args.report), canonical_json(report))
        print(json.dumps(report, sort_keys=True))
        return 0
    shell_bridge_path = Path(args.shell_bridge)
    require(shell_bridge_path.is_file(), f"immutable bridge missing: {shell_bridge_path}")
    shell_bridge = shell_bridge_path.read_text(encoding="utf-8")
    shell_bridge_sha = sha256_bytes(shell_bridge.encode("utf-8"))
    cartridge_text = patch_bridge(shell_bridge, generation)
    cartridge_sha = sha256_bytes(cartridge_text.encode("utf-8"))
    cartridge_rel = f"cartridges/{generation}-highway-static-transport-v9-5.js"
    cartridge_path = Path("atlas") / cartridge_rel
    contract_rel = f"../ui/cartridges/{generation}-highway-static-transport-v9-5.mjs"
    contract_path = Path("ui/cartridges") / f"{generation}-highway-static-transport-v9-5.mjs"
    manifest_rel = f"./manifests/{generation}-composition.json"
    manifest_path = Path("atlas/manifests") / f"{generation}-composition.json"
    write_atomic(cartridge_path, cartridge_text)
    write_atomic(contract_path, make_contract(generation, cartridge_sha))
    source_shell_path = Path("atlas") / str(current["shell"]["index"]).removeprefix("./")
    require(source_shell_path.is_file(), f"shell index missing: {source_shell_path}")
    shell_bytes = source_shell_path.read_bytes()
    new_cartridge = {
        "id": CARTRIDGE_ID, "generation": generation, "version": "v9.5", "type": "script", "slot": "replace-script", "replace_script": REPLACE_SCRIPT,
        "path": f"./{cartridge_rel}", "sha256": cartridge_sha, "contract": contract_rel,
        "capabilities": ["v8-static-highway-parity", "primary-a-roads", "trunk-a-roads", "motorways", "duckdb-analytical-fallback", "main-thread-memory-reduction"],
        "source_commit": GLOBALGRID_SHA, "transport": "PINNED_V8_STATIC_GEOJSON"
    }
    old_generation = str(current["generation"])
    old_manifest = str(current["composition_manifest"])
    old_cartridges = [item for item in current.get("cartridges", []) if item.get("id") != CARTRIDGE_ID]
    current["previous_generation"] = old_generation
    current["generation"] = generation
    current["cartridge_order"] = [CARTRIDGE_ID] + [item for item in current.get("cartridge_order", []) if item != CARTRIDGE_ID]
    current["cartridges"] = [new_cartridge] + old_cartridges
    current["composition_manifest"] = manifest_rel
    current["composition_id"] = f"{generation}-gridatlas-v9.5-highway-repair"
    current["provenance"]["cvaa_commit"] = CVAA_SHA
    current["provenance"]["highway_source_repository"] = "https://github.com/Ventusltd/globalgrid2050"
    current["provenance"]["highway_source_commit"] = GLOBALGRID_SHA
    current["scope_closure"] = {"generation": generation, "status": "DONE", "scope": "V8/V9.5 A-roads browser forensics and modular transport repair", "schedule_retired": True}
    current["forensics"] = {
        "cause": "The generic on-demand bridge materialised 163790 primary-road rows from a 29292883-byte Parquet partition, expanded Arrow rows into JavaScript objects, stringified a full FeatureCollection, reparsed it in the V8 core, then handed another copy to MapLibre.",
        "classification": "BROWSER_MEMORY_AMPLIFICATION_NOT_SOURCE_CORRUPTION", "v8_transport": "STATIC_GEOJSON", "v9_before_transport": "PARQUET_DUCKDB_FULL_REHYDRATION", "v9_after_transport": "PINNED_V8_STATIC_GEOJSON",
        "primary_roads_rows": 163790, "primary_roads_parquet_bytes": 29292883, "shell_mutated": False, "full_application_copies_created": 0
    }
    manifest_cartridges = []
    for item in current["cartridges"]:
        source_path = Path("atlas") / str(item["path"]).removeprefix("./")
        require(source_path.is_file(), f"composition cartridge missing: {source_path}")
        payload = dict(item)
        payload["source_size_bytes"] = source_path.stat().st_size
        manifest_cartridges.append(payload)
    manifest = {
        "schema": "gridatlas.composition.v1", "generation": generation, "composition_id": current["composition_id"], "architecture": current["architecture"], "composition_version": "v9.5", "release_id": current["release_id"], "release_route": current["release_route"],
        "source_release_index": str(current["shell"]["index"]).removeprefix("./"), "source_shell_sha256": sha256_bytes(shell_bytes), "source_shell_bytes": len(shell_bytes), "previous_composition": old_manifest, "cartridge_order": current["cartridge_order"], "cartridges": manifest_cartridges,
        "invariants": {"immutable_shell_mutated": False, "full_application_copies_created": 0, "shell_release_preserved": True, "search_cartridge_preserved": any(item.get("id") == "uk-gazetteer-flyto" for item in current["cartridges"]), "transport_repair_is_one_cartridge": True, "cvaa_full_history_pin": CVAA_SHA},
        "forensics": current["forensics"],
        "source_evidence": {"immutable_bridge_path": args.shell_bridge, "immutable_bridge_sha256": shell_bridge_sha, "globalgrid_source_commit": GLOBALGRID_SHA, "primary_roads_partition_sha256": "9df875a7791ed5af1c77a40b9872ff32315711eec73b4b9eaa31e7a0882e8a99"}
    }
    write_atomic(current_path, canonical_json(current))
    write_atomic(manifest_path, canonical_json(manifest))
    report = {
        "schema": "gridatlas.highway-transport-build.v1", "status": "BUILT", "changed": True, "generation": generation, "composition_id": current["composition_id"], "previous_generation": old_generation,
        "source_bridge": args.shell_bridge, "source_bridge_sha256": shell_bridge_sha, "cartridge": str(cartridge_path), "cartridge_sha256": cartridge_sha, "contract": str(contract_path), "manifest": str(manifest_path), "cvaa_commit": CVAA_SHA, "globalgrid_source_commit": GLOBALGRID_SHA,
        "primary_roads": {"rows": 163790, "parquet_bytes": 29292883, "parquet_sha256": "9df875a7791ed5af1c77a40b9872ff32315711eec73b4b9eaa31e7a0882e8a99", "before": "PARQUET_DUCKDB_FULL_REHYDRATION", "after": "PINNED_V8_STATIC_GEOJSON"},
        "full_application_copies_created": 0, "shell_mutated": False, "existing_cartridges_preserved": [item.get("id") for item in old_cartridges]
    }
    write_atomic(Path(args.report), canonical_json(report))
    print(json.dumps(report, sort_keys=True))
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BuildError, KeyError, ValueError, json.JSONDecodeError) as error:
        print(f"BUILD FAILED: {error}", file=os.sys.stderr)
        raise SystemExit(1)
