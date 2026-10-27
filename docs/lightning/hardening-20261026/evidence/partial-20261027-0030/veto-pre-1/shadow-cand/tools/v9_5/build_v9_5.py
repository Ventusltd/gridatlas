#!/usr/bin/env python3
"""Build GridAtlas v9.5 as one immutable-shell search cartridge.

This is deliberately a compiler, not a hand-written application copy. It takes the
last accepted search cartridge, applies asserted transformations, writes one new
content-addressed cartridge, and advances atlas/current.json plus its manifest.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path
from typing import Any

from compiler import compile_cartridge, dump_json, load_json, sha256_bytes

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "atlas/cartridges/202608301136-place-postcode-search.js"
SOURCE_SHA256 = "7f8e91c5ed54152f5ae4cd999ec501caed8d6625fdf0df20cc418805dec3e1fa"
CURRENT = ROOT / "atlas/current.json"
OLD_CONTRACT = ROOT / "ui/cartridges/202608301136-uk-gazetteer-flyto.mjs"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", default="state/v9-5-request.json")
    parser.add_argument("--report", default="work/v9-5-build.json")
    args = parser.parse_args()

    request_path = ROOT / args.request
    request = load_json(request_path)
    generation = str(request.get("generation", ""))
    if not re.fullmatch(r"20\d{10}", generation):
        raise RuntimeError(f"invalid 12-digit generation: {generation!r}")
    if request.get("version") != "v9.5":
        raise RuntimeError("request version must be v9.5")

    source_bytes = SOURCE.read_bytes()
    have_source_sha = sha256_bytes(source_bytes)
    if have_source_sha != SOURCE_SHA256:
        raise RuntimeError(f"source cartridge changed: {have_source_sha} != {SOURCE_SHA256}")

    current = load_json(CURRENT)
    if current.get("generation") == generation and current.get("composition_version") == "v9.5":
        report = {
            "schema": "gridatlas.v9-5-build.v1",
            "status": "ALREADY_BUILT",
            "generation": generation,
            "current": str(CURRENT.relative_to(ROOT)),
        }
        dump_json(ROOT / args.report, report)
        print(json.dumps(report))
        return 0

    previous_generation = str(current["generation"])
    source_text = source_bytes.decode("utf-8")
    compiled = compile_cartridge(source_text, generation)
    compiled_bytes = compiled.encode("utf-8")
    cartridge_sha = sha256_bytes(compiled_bytes)
    cartridge_rel = Path(f"atlas/cartridges/{generation}-place-global-search-v9-5.js")
    cartridge_path = ROOT / cartridge_rel
    if cartridge_path.exists() and cartridge_path.read_bytes() != compiled_bytes:
        raise RuntimeError(f"immutable target already exists with different bytes: {cartridge_rel}")
    cartridge_path.parent.mkdir(parents=True, exist_ok=True)
    cartridge_path.write_bytes(compiled_bytes)

    contract_rel = Path(f"ui/cartridges/{generation}-global-gazetteer-flyto-v9-5.mjs")
    contract_path = ROOT / contract_rel
    contract = f"""export const ATLAS_V9_5_GLOBAL_GAZETTEER_FLYTO_CONTRACT = Object.freeze({{\n  schema: 'gridatlas.cartridge.v1',\n  generation: '{generation}',\n  version: 'v9.5',\n  activation: 'explicit-user-query',\n  providers: ['postcodes.io', 'Nominatim / OpenStreetMap'],\n  repdResultsFirst: true,\n  staleResponseGuard: true,\n  resultClass: 'LOCATION_ONLY',\n  proximityEstablishesIdentity: false,\n  setsDeepLink: false\n}});\n"""
    if contract_path.exists() and contract_path.read_text(encoding="utf-8") != contract:
        raise RuntimeError(f"immutable target already exists with different bytes: {contract_rel}")
    contract_path.parent.mkdir(parents=True, exist_ok=True)
    contract_path.write_text(contract, encoding="utf-8")

    previous_manifest_path = (ROOT / "atlas" / str(current["composition_manifest"])).resolve()
    previous_manifest = load_json(previous_manifest_path)
    cartridge = {
        "id": "uk-gazetteer-flyto",
        "generation": generation,
        "version": "v9.5",
        "type": "script",
        "slot": "replace-script",
        "replace_script": "202608291818-place-postcode-search.js",
        "path": f"./cartridges/{cartridge_rel.name}",
        "sha256": cartridge_sha,
        "contract": f"../{contract_rel.as_posix()}",
        "capabilities": ["exact-repd-first", "uk-postcode", "uk-place", "global-address", "global-place"],
        "result_class": "LOCATION_ONLY",
        "sets_deep_link": False,
    }

    new_current = copy.deepcopy(current)
    new_current.update(
        {
            "generation": generation,
            "previous_generation": previous_generation,
            "composition_version": "v9.5",
            "composition_id": f"{generation}-gridatlas-v9.5",
            "cartridge_order": ["uk-gazetteer-flyto"],
            "cartridges": [cartridge],
            "composition_manifest": f"./manifests/{generation}-composition.json",
        }
    )
    new_current["search_lanes"] = {
        "repd": {"external_requests": 0, "identity_claims": "EXACT_REPD_REF_ONLY", "first": True},
        "uk_gazetteer": {
            "provider": "postcodes.io",
            "endpoints": ["postcodes", "outcodes", "places"],
            "identity_claims": "none",
            "result_class": "LOCATION_ONLY",
        },
        "global_gazetteer": {
            "provider": "Nominatim / OpenStreetMap",
            "endpoint": "search",
            "activation": "Enter or search button",
            "identity_claims": "none",
            "result_class": "LOCATION_ONLY",
        },
    }
    new_current["scope_closure"] = {
        "generation": generation,
        "status": "DONE",
        "scope": "GridAtlas v9.5 global address fly-to",
        "schedule_retired": True,
    }
    new_current.setdefault("provenance", {})["sandbox_source"] = (
        "https://github.com/Ventusltd/globalgrid2050/blob/main/"
        "solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js"
    )
    new_current["provenance"]["cvaa_commit"] = str(request.get("cvaa_commit", ""))

    manifest = copy.deepcopy(previous_manifest)
    manifest.update(
        {
            "schema": "gridatlas.composition-manifest.v1",
            "generation": generation,
            "parent_generation": previous_generation,
            "version": "v9.5",
            "composition_id": f"{generation}-gridatlas-v9.5",
            "cartridge_order": ["uk-gazetteer-flyto"],
            "cartridges": [cartridge],
            "source_pattern": {
                "repository": "Ventusltd/globalgrid2050",
                "path": "solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js",
                "behaviour": "Nominatim search then MapLibre flyTo",
            },
            "acceptance": {
                "full_application_copies_created": 0,
                "immutable_shell_modified": False,
                "exact_repd_identity_lane_preserved": True,
                "repd_results_first": True,
                "postcode_stale_response_guard": True,
                "uk_location_result_class": "LOCATION_ONLY",
                "global_location_result_class": "LOCATION_ONLY",
                "external_location_failure_isolated": True,
                "golden_browser_verification": "REQUIRED",
            },
        }
    )
    manifest.pop("scope_file", None)

    manifest_path = ROOT / f"atlas/manifests/{generation}-composition.json"
    dump_json(manifest_path, manifest)
    dump_json(CURRENT, new_current)

    # Existing durable verifier should wait for this exact generation, not merely an old closed scope.
    verifier_path = ROOT / "tools/scope/verify-live.mjs"
    verifier = verifier_path.read_text(encoding="utf-8")
    old_wait = "current?.schema === 'gridatlas.current.v2' && current?.scope_closure?.status === 'DONE' && current?.cartridge_order?.includes('uk-gazetteer-flyto')"
    new_wait = f"current?.schema === 'gridatlas.current.v2' && current?.generation === '{generation}' && current?.composition_version === 'v9.5' && current?.scope_closure?.status === 'DONE' && current?.cartridge_order?.includes('uk-gazetteer-flyto')"
    if old_wait in verifier:
        verifier = verifier.replace(old_wait, new_wait, 1)
    elif new_wait not in verifier:
        raise RuntimeError("durable live verifier wait marker changed unexpectedly")
    verifier_path.write_text(verifier, encoding="utf-8")

    report = {
        "schema": "gridatlas.v9-5-build.v1",
        "status": "BUILT",
        "generation": generation,
        "version": "v9.5",
        "previous_generation": previous_generation,
        "source_cartridge": str(SOURCE.relative_to(ROOT)),
        "source_sha256": have_source_sha,
        "cartridge": str(cartridge_rel),
        "cartridge_sha256": cartridge_sha,
        "contract": str(contract_rel),
        "manifest": str(manifest_path.relative_to(ROOT)),
        "full_application_copies_created": 0,
    }
    dump_json(ROOT / args.report, report)
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
