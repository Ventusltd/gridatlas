#!/usr/bin/env python3
"""Deterministically compile the 202608291430 Atlas V9 coverage successor."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


RELEASE_ID = "202608291430-atlas-v9"
GENERATION = "202608291430"
BASE_ROOT = Path("ui/successor-202608291239")
OVERLAY_ROOT = Path("ui/successor-202608291430")
CONTRACT = Path("contracts/202608291430-atlas-v9-live-release.json")
SHA40 = re.compile(r"^[a-f0-9]{40}$")
BASE_INPUT_SHA256 = {
    "assets/atlas-v9.css": "d244988cb255fb13e2fee2897edd8c8ee709c88dd52043c70762ff3e9f1cbe58",
    "assets/atlas-v9.mjs": "95a9880263afc0ee05b68ec149952b4d1f90de17cfcf13087f4c71074c1d0495",
    "assets/data-gridatlas-client.mjs": "08c9e9cf03b12288ff88c13a53bb92920912c43cbdcb9efa4c6ba77a80e4b66f",
    "cartridges/202608290716-repd-address-flyto.mjs": "b4dcfcb9cf815012dab6cc634c099179a155ea2f0120f6c61797087fbef1f64a",
}
OVERLAY_FILES = (
    "assets/repd-routing-client.mjs",
    "index.html",
)


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_keys)


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    require(source.count(old) == 1, f"base transform anchor drift: {label}:{source.count(old)}")
    return source.replace(old, new, 1)


def unresolved_routing(value: object, location: str = "contract") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            found.extend(unresolved_routing(item, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(unresolved_routing(item, f"{location}[{index}]"))
    elif isinstance(value, str) and value.startswith("__ROUTING_RELEASE_"):
        found.append(f"{location}={value}")
    return found


def transform_data_client(source: str) -> str:
    source = replace_once(source, 'manifest.release_id === "202608291239-atlas-v9"', 'manifest.release_id === "202608291430-atlas-v9"', "client release")
    source = replace_once(source, 'manifest.generation === "202608291239"', 'manifest.generation === "202608291430"', "client generation")
    source = replace_once(source, 'manifest.parent_release?.commit === "514fce2f3605ae53267c5ee955b301604a91b2fd"', 'manifest.parent_release?.publication_commit === "1898184ccbf52ca836cf1482362fc5933baf3e8d"', "client predecessor")
    anchor = '  invariant(manifest.repd?.generation === "202608290716" && manifest.repd.rows === 11069, "REPD preservation contract mismatch");\n'
    routing = anchor + '''  invariant(manifest.repd?.selectable_rows === 11033 && manifest.repd.excluded_false_origin_rows === 36, "safe REPD closure mismatch");
  invariant(manifest.repd?.role === "NORMAL_SEARCH_AND_BASE_MAP", "normal REPD registry role mismatch");
  invariant(manifest.repd_routing?.release_id === "202608291410-repd-routing", "routing release identity mismatch");
  invariant(manifest.repd_routing?.projects === 7680, "routing project closure mismatch");
  invariant(manifest.repd_routing?.map_identities === 7652 && manifest.repd_routing?.no_map_identities === 28, "routing MAP/NO MAP closure mismatch");
  invariant(manifest.repd_routing?.routing_only_map_fallbacks === 2419 && manifest.repd_routing?.normal_plus_fallback_union === 13452, "safe union closure mismatch");
  invariant(manifest.repd_routing?.missing_map_identities === 0 && manifest.repd_routing?.no_map_selectable_intersection === 0, "routing completeness mismatch");
  invariant(manifest.repd_routing?.role === "LAZY_EXACT_DEEP_LINK_FALLBACK_ONLY", "routing role mismatch");
  invariant(manifest.route_contract?.identity_rule === "EXACT_REPD_REF_ONLY", "routing identity rule mismatch");
  invariant(manifest.route_contract?.normal_registry_precedence === true, "normal registry precedence missing");
  invariant(manifest.route_contract?.query_coordinates_ignored === true, "query coordinates must be ignored");
'''
    source = replace_once(source, anchor, routing, "client routing contract")
    sealed_anchor = '      data_registry_sha256: manifest.data_release.browser_registry_sha256,\n'
    sealed_fields = sealed_anchor + '''      routing_publication_commit: manifest.repd_routing.publication_commit,
      routing_source_commit: manifest.repd_routing.source_commit,
      routing_release_sha256: manifest.repd_routing.release_sha256,
      routing_projects_sha256: manifest.repd_routing.projects_sha256,
'''
    source = replace_once(source, sealed_anchor, sealed_fields, "client sealed routing fields")
    digest_anchor = '    invariant(SHA256.test(manifest.data_release.browser_registry_sha256), "browser registry digest is invalid");\n'
    digest_checks = digest_anchor + '''    invariant(SHA256.test(manifest.repd_routing.release_sha256), "routing release digest is invalid");
    invariant(SHA256.test(manifest.repd_routing.projects_sha256), "routing projects digest is invalid");
    invariant(/^[a-f0-9]{40}$/.test(manifest.repd_routing.publication_commit), "routing publication commit is invalid");
    invariant(/^[a-f0-9]{40}$/.test(manifest.repd_routing.source_commit), "routing source commit is invalid");
'''
    return replace_once(source, digest_anchor, digest_checks, "client sealed routing checks")


def transform_atlas(source: str) -> str:
    import_anchor = '''} from "./data-gridatlas-client.mjs";

const RELEASE_ID = "202608291239-atlas-v9";
'''
    import_replacement = '''} from "./data-gridatlas-client.mjs";
import { loadRoutingDeepLinkFallback } from "./repd-routing-client.mjs";

const RELEASE_ID = "202608291430-atlas-v9";
'''
    source = replace_once(source, import_anchor, import_replacement, "app routing import")
    select_anchor = "function select(record) {\n  setSelectedUrl(record);"
    select_replacement = '''function hasMappableGeometry(record) {
  return typeof record?.latitude === "number" && typeof record?.longitude === "number"
    && Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    && record.latitude >= -90 && record.latitude <= 90
    && record.longitude >= -180 && record.longitude <= 180
    && !(record.latitude === 0 && record.longitude === 0)
    && !(record.latitude === 49.766807 && record.longitude === -7.55716);
}

function select(record) {
  if (!hasMappableGeometry(record)) {
    live.textContent = `REPD ${record?.repd_ref || "unknown"} has NO MAP geometry and is not selectable`;
    return false;
  }
  setSelectedUrl(record);'''
    source = replace_once(source, select_anchor, select_replacement, "app mappability guard")
    source = replace_once(source, "    features: records.map(record => ({", "    features: records.filter(hasMappableGeometry).map(record => ({", "app base-map mappability guard")
    map_anchor = '''      if (requested && featureByRef.has(requested)) {
        const record = featureByRef.get(requested);
        map.jumpTo({ center: [record.longitude, record.latitude], zoom: 13 });
        select(record);
      }
'''
    map_replacement = '''      if (requested && featureByRef.has(requested)) {
        const record = featureByRef.get(requested);
        if (hasMappableGeometry(record)) {
          map.jumpTo({ center: [record.longitude, record.latitude], zoom: 13 });
          select(record);
        }
      }
'''
    source = replace_once(source, map_anchor, map_replacement, "app guarded map jump")
    boot_anchor = "async function boot() {\n"
    resolver = '''async function resolveRequestedDeepLink(release) {
  const requested = new URLSearchParams(location.search).get("repd_ref");
  if (!requested) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested: null, source: "none", found: false, selectable: false, latitude: null, longitude: null };
    return null;
  }
  if (!/^\\d+$/.test(requested)) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested, source: "none", found: false, selectable: false, reason: "INVALID_EXACT_REPD_REF", latitude: null, longitude: null };
    live.textContent = `REPD deep link ${requested} is not an exact numeric reference`;
    return null;
  }
  const normal = featureByRef.get(requested);
  if (normal && hasMappableGeometry(normal)) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = {
      requested, source: "normal", found: true, selectable: true,
      latitude: normal.latitude, longitude: normal.longitude
    };
    return normal;
  }
  try {
    const fallback = await loadRoutingDeepLinkFallback(release, requested);
    globalThis.__GRIDATLAS_REPD_ROUTE__ = {
      requested, source: "routing", found: fallback.found,
      selectable: fallback.selectable, reason: fallback.reason,
      geometry_status: fallback.record?.geometry_status || null,
      latitude: fallback.record?.latitude ?? null,
      longitude: fallback.record?.longitude ?? null
    };
    if (fallback.selectable && hasMappableGeometry(fallback.record)) {
      featureByRef.set(requested, fallback.record);
      return fallback.record;
    }
    live.textContent = fallback.found
      ? `REPD ${requested} has NO MAP geometry and is not selectable`
      : `REPD ${requested} is not present in the exact routing oracle`;
  } catch (error) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested, source: "routing", found: false, selectable: false, reason: "ROUTING_FAILED_CLOSED", latitude: null, longitude: null };
    live.textContent = `REPD ${requested} routing failed closed; normal search and map remain active`;
    console.warn("Atlas V9 routing isolated:", error instanceof Error ? error.message : String(error));
  }
  return null;
}

async function boot() {
'''
    source = replace_once(source, boot_anchor, resolver, "app deep-link resolver")
    source = replace_once(
        source,
        "  const records = registry.records;",
        '''  const records = registry.records.filter(hasMappableGeometry);
  globalThis.__GRIDATLAS_RUNTIME__ = Object.freeze({
    normalRegistrySourceRows: registry.records.length,
    normalSelectableRows: records.length,
    excludedFalseOriginRows: registry.records.length - records.length,
    baseMapFeatures: records.length,
    routingProjectsWithoutDeepLink: 0
  });''',
        "app safe normal registry",
    )
    request_anchor = '''  const requested = new URLSearchParams(location.search).get("repd_ref");
  if (requested && featureByRef.has(requested)) select(featureByRef.get(requested));

  try {
'''
    request_replacement = '''  const requested = new URLSearchParams(location.search).get("repd_ref");
  const requestedRecord = await resolveRequestedDeepLink(release);
  if (requestedRecord) select(requestedRecord);

  try {
'''
    return replace_once(source, request_anchor, request_replacement, "app fallback activation")


def compile_release(args: argparse.Namespace) -> None:
    repository = args.repository.resolve()
    base_root = repository / BASE_ROOT
    overlay_root = repository / OVERLAY_ROOT
    contract_path = repository / CONTRACT
    output = args.output.resolve()
    require(SHA40.fullmatch(args.source_commit) is not None, "source commit must be an exact SHA-1")
    require(re.match(r"^\d{4}-\d{2}-\d{2}T", args.source_committed_at) is not None, "source commit time must be ISO-8601")
    require(not output.exists(), f"refusing existing output: {output}")
    require(output.name == RELEASE_ID, f"output folder must be named {RELEASE_ID}")
    actual_overlay = tuple(sorted(path.relative_to(overlay_root).as_posix() for path in overlay_root.rglob("*") if path.is_file()))
    require(actual_overlay == OVERLAY_FILES, f"successor overlay allowlist mismatch: {actual_overlay}")
    for relative, expected in BASE_INPUT_SHA256.items():
        require(sha256(base_root / relative) == expected, f"immutable 202608291239 base input drift: {relative}")

    contract = read_json(contract_path)
    require(contract.get("release_id") == RELEASE_ID and contract.get("generation") == GENERATION, "release contract identity mismatch")
    unresolved = unresolved_routing(contract)
    require(args.allow_unsealed or not unresolved, "unresolved routing release placeholders: " + ", ".join(unresolved))

    output.mkdir(parents=True)
    (output / "assets").mkdir()
    (output / "cartridges").mkdir()
    shutil.copyfile(base_root / "assets/atlas-v9.css", output / "assets/atlas-v9.css")
    shutil.copyfile(base_root / "cartridges/202608290716-repd-address-flyto.mjs", output / "cartridges/202608290716-repd-address-flyto.mjs")
    shutil.copyfile(overlay_root / "assets/repd-routing-client.mjs", output / "assets/repd-routing-client.mjs")
    shutil.copyfile(overlay_root / "index.html", output / "index.html")
    (output / "assets/atlas-v9.mjs").write_text(
        transform_atlas((base_root / "assets/atlas-v9.mjs").read_text(encoding="utf-8")), encoding="utf-8", newline="\n"
    )
    (output / "assets/data-gridatlas-client.mjs").write_text(
        transform_data_client((base_root / "assets/data-gridatlas-client.mjs").read_text(encoding="utf-8")), encoding="utf-8", newline="\n"
    )

    release = json.loads(json.dumps(contract))
    release["source_commit"] = args.source_commit
    release["committed_at"] = args.source_committed_at
    (output / "release-manifest.json").write_bytes(canonical_json(release))
    content_files = [{
        "path": path.relative_to(output).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    } for path in sorted(item for item in output.rglob("*") if item.is_file())]
    source_paths = [*(base_root / item for item in BASE_INPUT_SHA256), *(overlay_root / item for item in OVERLAY_FILES), contract_path]
    source_inputs = [{
        "path": path.relative_to(repository).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    } for path in source_paths]
    build_manifest = {
        "schema": "gridatlas.timestamped-live-build.v2",
        "release_id": RELEASE_ID,
        "source_commit": args.source_commit,
        "source_committed_at": args.source_committed_at,
        "deterministic": True,
        "base_release_source": "202608291239-atlas-v9",
        "transformations": [
            "release_identity",
            "routing_contract_validation",
            "safe_normal_registry_false_origin_exclusion",
            "normal_first_exact_repd_ref_fallback",
            "explicit_authoritative_route_coordinates",
            "null_before_number_guard",
            "zero_initial_routing_and_parquet_fetch",
        ],
        "source_inputs": source_inputs,
        "files": content_files,
    }
    (output / "build-manifest.json").write_bytes(canonical_json(build_manifest))
    print(json.dumps({
        "classification": "COMPILED_TIMESTAMPED_ATLAS_V9_ROUTING_SUCCESSOR",
        "release_id": RELEASE_ID,
        "source_commit": args.source_commit,
        "files": len(content_files) + 1,
        "bytes": sum(item["bytes"] for item in content_files) + (output / "build-manifest.json").stat().st_size,
        "unsealed": bool(unresolved),
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--source-committed-at", required=True)
    parser.add_argument("--allow-unsealed", action="store_true")
    compile_release(parser.parse_args())


if __name__ == "__main__":
    main()
