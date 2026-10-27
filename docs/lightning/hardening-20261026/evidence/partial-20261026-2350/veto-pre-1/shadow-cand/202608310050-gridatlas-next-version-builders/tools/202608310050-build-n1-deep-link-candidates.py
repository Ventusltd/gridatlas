#!/usr/bin/env python3
"""Build isolated N1 candidate files. Never writes into producer repositories."""
from __future__ import annotations

import argparse
import datetime as dt
import difflib
import hashlib
import json
from pathlib import Path
from typing import Any

OLD_BASE = "https://ventusltd.github.io/gridatlas/202608300453-atlas-v9/"
STABLE_BASE = "https://ventusltd.github.io/gridatlas/atlas/"
STATE_URL = "https://ventusltd.github.io/gridatlas/state/live-set.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, value: Any) -> None:
    write_text(path, json.dumps(value, indent=2, sort_keys=False))


def replace_strings(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: replace_strings(item) for key, item in value.items()}
    if isinstance(value, list):
        return [replace_strings(item) for item in value]
    if isinstance(value, str):
        return value.replace(OLD_BASE, STABLE_BASE)
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--generation", required=True)
    parser.add_argument("--pipelinenews", required=True, type=Path)
    parser.add_argument("--companies", required=True, type=Path)
    parser.add_argument("--gridatlas-current", required=True, type=Path)
    args = parser.parse_args()

    output = args.output.resolve()
    pipeline_source = args.pipelinenews / "ui" / "atlas-v9-deep-links.js"
    company_source = args.companies / "state" / "atlas-v9-link-contract.json"
    if not pipeline_source.is_file():
        raise SystemExit(f"missing {pipeline_source}")
    if not company_source.is_file():
        raise SystemExit(f"missing {company_source}")

    current = json.loads(args.gridatlas_current.read_text(encoding="utf-8"))
    composition_generation = str(current.get("generation", ""))
    release_id = str(current.get("release_id", ""))
    if current.get("live_route") != "/gridatlas/atlas/":
        raise SystemExit("gridatlas stable live route is not /gridatlas/atlas/")

    original_js = pipeline_source.read_text(encoding="utf-8")
    if OLD_BASE not in original_js and STABLE_BASE not in original_js:
        raise SystemExit("pipelinenews Atlas base is neither the known stale nor stable route")
    candidate_js = original_js.replace(OLD_BASE, STABLE_BASE)
    candidate_js_path = output / "pipelinenews" / "ui" / "atlas-v9-deep-links.js"
    write_text(candidate_js_path, candidate_js)
    patch = "".join(
        difflib.unified_diff(
            original_js.splitlines(keepends=True),
            candidate_js.splitlines(keepends=True),
            fromfile="a/ui/atlas-v9-deep-links.js",
            tofile="b/ui/atlas-v9-deep-links.js",
        )
    )
    write_text(output / "pipelinenews" / "patches" / f"{args.generation}-stable-gridatlas-route.patch", patch or "# already stable; no textual patch")

    pipeline_state = args.pipelinenews / "state" / "atlas-v9-current.json"
    if pipeline_state.is_file():
        state_original = json.loads(pipeline_state.read_text(encoding="utf-8"))
        state_candidate = replace_strings(state_original)
        if isinstance(state_candidate, dict):
            state_candidate["composition_generation"] = composition_generation
            state_candidate["candidate_generation"] = args.generation
            state_candidate["candidate_classification"] = "STABLE_GRIDATLAS_ROUTE_NOT_PROMOTED"
        write_json(output / "pipelinenews" / "state" / "atlas-v9-current.json", state_candidate)

    receipt = {
        "schema": "pipelinenews.gridatlas-pointer-receipt.v2",
        "generation": args.generation,
        "classification": "CANDIDATE_VERIFIED_GRIDATLAS_LIVE_POINTER_NOT_PROMOTED",
        "repository": "Ventusltd/gridatlas",
        "pointer": {"path": "state/live-set.json", "url": STATE_URL},
        "receiver": {
            "base_url": STABLE_BASE,
            "route": "/gridatlas/atlas/",
            "release_id": release_id,
            "composition_generation": composition_generation,
            "query_parameter": "repd_ref",
            "golden_repd_refs": ["13599", "17494"],
            "required_pointer_state": {"promotion_eligible": True, "failed_gates": 0},
        },
        "immutable_route_is_uncartridged": True,
        "promotion_eligible": False,
    }
    write_json(output / "pipelinenews" / "receipts" / f"{args.generation}-gridatlas-pointer-receipt.v2.json", receipt)

    company_original = json.loads(company_source.read_text(encoding="utf-8"))
    company_candidate = replace_strings(company_original)
    company_candidate["schema"] = "companies.gridatlas-v9-link-contract.v2"
    company_candidate["classification"] = "CANDIDATE_STABLE_GRIDATLAS_LINK_TEMPLATE_NOT_PROMOTED"
    company_candidate["generated_at"] = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    company_candidate["generation"] = args.generation
    atlas = company_candidate.setdefault("atlas", {})
    atlas["base_url"] = STABLE_BASE
    atlas["route"] = "/gridatlas/atlas/"
    atlas["state_url"] = STATE_URL
    atlas["composition_generation"] = composition_generation
    atlas["release_id"] = release_id
    join = company_candidate.setdefault("join", {})
    join["golden_url"] = f"{STABLE_BASE}?repd_ref=13599"
    join["url_template"] = f"{STABLE_BASE}?repd_ref={{repd_ref}}"
    company_candidate["verification_requirements"] = {
        "pointer_promotion_eligible": True,
        "pointer_failed_gates": 0,
        "golden_repd_refs": ["13599", "17494"],
        "desktop_and_375x667_browser_proof": True,
        "route_interceptions": 0,
        "synthetic_receiver": False,
    }
    company_candidate["promotion_eligible"] = False
    write_json(output / "companies" / "state" / f"{args.generation}-atlas-v9-link-contract.json", company_candidate)

    sentinels = {
        "schema": "gridatlas.federated-deep-link-sentinels.v1",
        "generation": args.generation,
        "stable_base": STABLE_BASE,
        "tests": [
            {"id": "stable-beacon-fen", "url": f"{STABLE_BASE}?repd_ref=13599", "expected": "resolved"},
            {"id": "root-redirect-beacon-fen", "url": "https://ventusltd.github.io/gridatlas/?repd_ref=13599", "expected": "resolved"},
            {"id": "stable-east-pye", "url": f"{STABLE_BASE}?repd_ref=17494", "expected": "resolved"},
            {"id": "stale-root-release", "url": f"{OLD_BASE}?repd_ref=13599", "expected_http": 404},
        ],
    }
    write_json(output / "tests" / f"{args.generation}-federated-deep-link-sentinels.json", sentinels)

    manifest = {
        "schema": "gridatlas.n1-candidate-manifest.v1",
        "generation": args.generation,
        "classification": "CANDIDATE_ONLY_NO_PRODUCER_REPOSITORY_CHANGED",
        "inputs": {
            "pipelinenews_source": str(pipeline_source),
            "pipelinenews_source_sha256": sha256(pipeline_source),
            "companies_source": str(company_source),
            "companies_source_sha256": sha256(company_source),
            "gridatlas_composition_generation": composition_generation,
            "gridatlas_release_id": release_id,
        },
        "outputs": {
            "pipelinenews_candidate_sha256": sha256(candidate_js_path),
            "stable_base": STABLE_BASE,
            "live_pointer_changed": False,
            "producer_main_changed": False,
        },
    }
    write_json(output / "n1-manifest.json", manifest)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
