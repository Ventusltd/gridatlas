#!/usr/bin/env python3
"""Classify every Atlas V9 live-successor promotion goal."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ALLOWED = {"MATCH", "EXPECTED_CHANGE", "REGRESSION", "UNKNOWN"}
RELEASE_ID = "202608291239-atlas-v9"
ROOT_INDEX_SHA256 = "4d059a6963ee73378b21bf378a3590292bbced0bba6f3cacf4acd9c6bc695533"
REPD_REGISTRY_SHA256 = "c8a5c59be878c52014a272eb0e4d09af06a0d301d10a8d6b5d0b116b5d1bb6bc"
TRANSPORT_LAYERS = {
    "rail", "elizabeth", "lu", "dlr", "metro", "tram", "mainline_rail",
    "hs2", "eurostar_route", "eurostar_station",
}


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_keys)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree(directory: Path) -> dict[str, tuple[int, str]]:
    return {
        path.relative_to(directory).as_posix(): (path.stat().st_size, sha256(path))
        for path in sorted(item for item in directory.rglob("*") if item.is_file())
    }


def goal(status: str, evidence: object) -> dict:
    if status not in ALLOWED:
        raise ValueError(status)
    return {"status": status, "evidence": evidence}


def classified(condition: bool, evidence: object, *, expected_change: bool = False) -> dict:
    return goal("EXPECTED_CHANGE" if condition and expected_change else "MATCH" if condition else "REGRESSION", evidence)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--build-a", type=Path, required=True)
    parser.add_argument("--build-b", type=Path, required=True)
    parser.add_argument("--data-release", type=Path, required=True)
    parser.add_argument("--browser-proof", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repository = args.repository.resolve()
    build_a = args.build_a.resolve()
    build_b = args.build_b.resolve()
    data = args.data_release.resolve()
    browser = read_json(args.browser_proof.resolve()) if args.browser_proof.is_file() else None
    release = read_json(build_a / "release-manifest.json")
    data_manifest = read_json(data / "data/manifest.json")
    data_registry = read_json(data / "browser-layer-registry.json")
    repd_registry = read_json(repository / "data/repd_browser_registry_202608290716.json")
    flat_layers = [layer for group in data_registry.get("groups", []) for layer in group.get("layers", [])]
    layer_ids = {layer.get("id") for layer in flat_layers}
    app_source = (build_a / "assets/atlas-v9.mjs").read_text(encoding="utf-8")
    client_source = (build_a / "assets/data-gridatlas-client.mjs").read_text(encoding="utf-8")
    golden = next((row for row in repd_registry.get("records", []) if str(row.get("repd_ref")) == "16135"), None)
    build_a_tree = tree(build_a)
    build_b_tree = tree(build_b)

    sections = {
        "source_closure": {
            "timestamp_identity": classified(release.get("release_id") == RELEASE_ID, release.get("release_id")),
            "superseded_public_candidate": classified(release.get("supersedes_candidate", {}).get("release_id") == "202608291237-atlas-v9" and release.get("supersedes_candidate", {}).get("classification") == "PUBLIC_PROOF_REJECTED_NO_POINTER" and release.get("supersedes_candidate", {}).get("pointer_created") is False, release.get("supersedes_candidate"), expected_change=True),
            "data_generation": classified(release.get("data_release", {}).get("source_generation") == "202608291015", release.get("data_release", {}).get("source_generation")),
            "v8_oracle": classified(data_manifest.get("source", {}).get("commit") == "f2f343a92ee972cc74ed23b4b99d8a22896791ad" and data_manifest.get("v8_untouched") is True, data_manifest.get("source")),
        },
        "v8_layer_semantics": {
            "layer_count": classified(len(flat_layers) == 60 and len(layer_ids) == 60, len(flat_layers)),
            "group_count": classified(len(data_registry.get("groups", [])) == 11, len(data_registry.get("groups", []))),
            "exact_membership": classified(data_manifest.get("closure", {}).get("layer_membership_rows") == 526388, data_manifest.get("closure", {}).get("layer_membership_rows")),
            "full_parquet_consumer": classified("SEMI JOIN read_parquet" in client_source and "layer_membership.parquet" in client_source, "partition + exact membership join", expected_change=True),
        },
        "repd_incumbent_regression": {
            "registry_identity": classified(sha256(repository / "data/repd_browser_registry_202608290716.json") == REPD_REGISTRY_SHA256, REPD_REGISTRY_SHA256),
            "row_closure": classified(len(repd_registry.get("records", [])) == 11069, len(repd_registry.get("records", []))),
            "golden_16135": classified(golden is not None and golden.get("repd_postcode") == "MK43 0ZY" and golden.get("county") == "Bedfordshire", golden),
            "address_cartridge": classified(sha256(build_a / "cartridges/202608290716-repd-address-flyto.mjs") == "b4dcfcb9cf815012dab6cc634c099179a155ea2f0120f6c61797087fbef1f64a", "byte-identical incumbent cartridge"),
            "cluster_count_labels": classified('id: "repd-clusters"' in app_source and 'id: "repd-points"' in app_source and 'id: "repd-selected"' in app_source and 'map.on("click", "repd-clusters"' in app_source and 'id: "repd-cluster-count"' not in app_source and '"text-field"' not in app_source, "cluster circles, expansion click, points and selection retained; glyph-dependent numeric label omitted", expected_change=True),
            "deep_link_query_contract": classified(release.get("route_contract", {}).get("query_parameter") == "repd_ref", release.get("route_contract")),
            "golden_deep_link": classified(release.get("route_contract", {}).get("golden_deep_link") == "https://ventusltd.github.io/gridatlas/202608291239-atlas-v9/?repd_ref=16135", release.get("route_contract", {}).get("golden_deep_link"), expected_change=True),
        },
        "lazy_runtime": {
            "zero_boot_parquet": classified(release.get("loading_contract", {}).get("parquet_on_boot") == 0 and app_source.count("dataClient.queryLayer(") == 1, release.get("loading_contract")),
            "user_activation": classified("EXPLICIT_USER_LAYER_TOGGLE" in client_source and 'input.addEventListener("change"' in app_source, "explicit checkbox activation"),
            "bounded_query": classified(all(token in client_source for token in ("p.max_x", "p.min_x", "p.max_y", "p.min_y")), "map-bounds predicate"),
            "browser_compute": classified("duckdb-wasm@1.29.0" in json.dumps(release), "DuckDB-WASM 1.29.0", expected_change=True),
            "heavy_layer_zoom_gate": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("heavy_layer_zoom_gate") is True, browser.get("heavy_layer_zoom_gate")),
            "failed_query_isolation": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("failed_query_isolated") is True, browser.get("failed_query_isolated")),
            "unload_release": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("unload_released_render_and_handlers") is True, browser.get("unload_released_render_and_handlers")),
        },
        "rendered_desktop_mobile": {
            "browser_classification": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("classification") == "VERIFIED_RENDERED_BROWSER" and browser.get("failed") == 0, browser.get("classification")),
            "desktop_1440": goal("UNKNOWN", "browser proof missing") if browser is None else classified("1440x900" in browser.get("viewports", []), browser.get("viewports")),
            "mobile_390": goal("UNKNOWN", "browser proof missing") if browser is None else classified("390x844" in browser.get("viewports", []), browser.get("viewports")),
            "initial_payload": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("initial_v8_parquet_requests") == 0 and browser.get("initial_v8_parquet_bytes") == 0, {"requests": browser.get("initial_v8_parquet_requests"), "bytes": browser.get("initial_v8_parquet_bytes")}),
            "visible_quarantine_provenance": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("quarantined_visible_badges") == 5, browser.get("quarantined_visible_badges")),
            "glyphless_style_symbol_guard": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("glyphless_style_symbol_guard") is True, browser.get("glyphless_style_symbol_guard")),
            "repd_cluster_expansion": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("repd_cluster_expand_click") is True and browser.get("repd_cluster_layers") == ["repd-clusters", "repd-points", "repd-selected"], {"click": browser.get("repd_cluster_expand_click"), "layers": browser.get("repd_cluster_layers")}),
            "map_load_stall_deep_link": goal("UNKNOWN", "browser proof missing") if browser is None else classified(browser.get("map_load_stall_deep_link") is True, browser.get("map_load_stall_deep_link")),
        },
        "public_transport": {
            "layer_closure": classified(TRANSPORT_LAYERS.issubset(layer_ids), sorted(TRANSPORT_LAYERS & layer_ids)),
            "lazy_transport": classified("item.preload" not in app_source and release.get("loading_contract", {}).get("automatic_v8_layer_loads") == 0, "no automatic transport payload"),
        },
        "output_closure": {
            "deterministic_ab": classified(build_a_tree == build_b_tree, {"a_files": len(build_a_tree), "b_files": len(build_b_tree)}),
            "timestamp_index": classified((build_a / "index.html").is_file() and build_a.name == RELEASE_ID, str(build_a / "index.html"), expected_change=True),
            "seven_files": classified(len(build_a_tree) == 7, sorted(build_a_tree)),
        },
        "rollback": {
            "root_index_unchanged": classified(sha256(repository / "index.html") == ROOT_INDEX_SHA256, ROOT_INDEX_SHA256),
            "last_green_parent": classified(release.get("parent_release", {}).get("commit") == "514fce2f3605ae53267c5ee955b301604a91b2fd", release.get("parent_release")),
            "separate_route": classified(release.get("route_contract", {}).get("route") == f"/gridatlas/{RELEASE_ID}/", release.get("route_contract"), expected_change=True),
        },
    }
    statuses = [item["status"] for section in sections.values() for item in section.values()]
    failed = sum(status in {"REGRESSION", "UNKNOWN"} for status in statuses)
    status_counts = {status: statuses.count(status) for status in sorted(ALLOWED)}
    report = {
        "schema": "gridatlas.incumbent-successor-comparator.v1",
        "classification": "VERIFIED_LIVE_ATLAS_V9" if failed == 0 else "REJECTED_LIVE_ATLAS_V9",
        "release_id": RELEASE_ID,
        "failed": failed,
        "promotion_eligible": failed == 0,
        "allowed_statuses": sorted(ALLOWED),
        "baseline_vs_successor": {
            "baseline": {
                "name": "Atlas V8-backed last-green root",
                "generation": "202608290716",
                "commit": "514fce2f3605ae53267c5ee955b301604a91b2fd",
                "route": "/gridatlas/",
                "root_index_sha256": ROOT_INDEX_SHA256,
            },
            "successor": {
                "name": "Atlas V9 timestamp-folder release",
                "generation": "202608291239",
                "release_id": RELEASE_ID,
                "route": release.get("route_contract", {}).get("route"),
                "query_parameter": release.get("route_contract", {}).get("query_parameter"),
                "golden_deep_link": release.get("route_contract", {}).get("golden_deep_link"),
            },
            "status_counts": status_counts,
            "expected_changes": [
                "timestamped immutable route",
                "full V8 Parquet queried lazily in-browser",
                "desktop/mobile live rendering",
                "REPD cluster circles retained without undeclared glyph-dependent count labels",
                "failed 202608291237 public candidate retained immutable without a current pointer",
            ],
        },
        "sections": sections,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    if failed:
        raise SystemExit(f"successor comparator rejected {failed} goals")


if __name__ == "__main__":
    main()
