#!/usr/bin/env python3
"""Evaluate the governed Atlas V9 publication/deep-link chain across four repositories."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MIN_GENERATION = "202608292311"


def load_optional(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else None


def sha(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def milestone(identifier: str, passed: bool, observed: Any, gate: Any) -> dict[str, Any]:
    return {
        "id": identifier,
        "passed": bool(passed),
        "observed": observed,
        "gate": gate,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gridatlas", required=True, type=Path)
    parser.add_argument("--globalgrid", required=True, type=Path)
    parser.add_argument("--pipelinenews", required=True, type=Path)
    parser.add_argument("--companies", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    atlas_path = args.gridatlas / "state/live-set.json"
    global_path = args.globalgrid / "state/gridatlas-v9-current.json"
    pipeline_pointer_path = args.pipelinenews / "state/atlas-v9-current.json"
    pipeline_audit_path = args.pipelinenews / "reports/atlas-v9-deep-link-audit.json"
    companies_pointer_path = args.companies / "state/atlas-v9-current.json"
    companies_manifest_path = args.companies / "reports/atlas-v9-company-repd-links-manifest.json"
    contract_path = args.gridatlas / "contracts/atlas-v9-deep-link-contract.v1.json"

    atlas = load_optional(atlas_path) or {}
    global_pointer = load_optional(global_path) or {}
    pipeline_pointer = load_optional(pipeline_pointer_path) or {}
    pipeline_audit = load_optional(pipeline_audit_path) or {}
    companies_pointer = load_optional(companies_pointer_path) or {}
    companies_manifest = load_optional(companies_manifest_path) or {}
    contract = load_optional(contract_path) or {}

    generation = str(atlas.get("generation") or "")
    current = atlas.get("current") or {}
    verification = atlas.get("verification") or {}
    release_id = str(current.get("release_id") or "")

    m0 = milestone(
        "M0_FROZEN_BASELINE",
        bool((current.get("product_oracle") or {}).get("commit") and (atlas.get("rollback") or {}).get("release_id")),
        {
            "oracle_commit": (current.get("product_oracle") or {}).get("commit"),
            "rollback_release_id": (atlas.get("rollback") or {}).get("release_id"),
        },
        {"oracle_pinned": True, "rollback_recorded": True},
    )
    m1 = milestone(
        "M1_RENDER_COMPARATOR_PROMOTED",
        generation >= MIN_GENERATION
        and verification.get("promotion_eligible") is True
        and int(verification.get("failed_gates", -1)) == 0,
        {
            "generation": generation,
            "release_id": release_id,
            "classification": atlas.get("classification"),
            "promotion_eligible": verification.get("promotion_eligible"),
            "failed_gates": verification.get("failed_gates"),
            "public_400kv_click_p95_ms": verification.get("public_400kv_click_p95_ms"),
            "public_400kv_render_p95_ms": verification.get("public_400kv_render_p95_ms"),
        },
        {"generation_min": MIN_GENERATION, "promotion_eligible": True, "failed_gates": 0},
    )
    m2 = milestone(
        "M2_GLOBALGRID_MIRROR_AND_ORDER",
        global_pointer.get("classification") == "MIRRORED_PROMOTED_GRIDATLAS_V9"
        and global_pointer.get("release_id") == release_id,
        {
            "release_id": global_pointer.get("release_id"),
            "live_url": global_pointer.get("globalgrid_live_url"),
            "files": global_pointer.get("files"),
        },
        {"release_id": release_id, "classification": "MIRRORED_PROMOTED_GRIDATLAS_V9"},
    )
    m3 = milestone(
        "M3_CANONICAL_DEEP_LINK_CONTRACT",
        contract.get("schema") == "gridatlas.deep-link-contract.v1"
        and (contract.get("identity") or {}).get("required") == ["repd_ref", "technology"],
        {
            "schema": contract.get("schema"),
            "required_identity": (contract.get("identity") or {}).get("required"),
            "sha256": sha(contract_path),
        },
        {"schema": "gridatlas.deep-link-contract.v1", "required_identity": ["repd_ref", "technology"]},
    )
    sentinel_refs = {
        str(item.get("repd_ref"))
        for item in pipeline_audit.get("sentinels", [])
        if isinstance(item, dict)
    }
    m4 = milestone(
        "M4_PIPELINENEWS_CANONICAL_LINKS",
        pipeline_pointer.get("release_id") == release_id
        and pipeline_audit.get("classification") == "CANONICAL_DEEP_LINKS_READY"
        and {"13599", "17494"}.issubset(sentinel_refs)
        and int(pipeline_audit.get("immutable_releases_modified", -1)) == 0,
        {
            "release_id": pipeline_pointer.get("release_id"),
            "base_url": pipeline_pointer.get("base_url"),
            "sentinel_refs": sorted(sentinel_refs),
            "replacements": pipeline_audit.get("replacement_count"),
            "immutable_releases_modified": pipeline_audit.get("immutable_releases_modified"),
        },
        {"release_id": release_id, "sentinels": ["13599", "17494"], "immutable_releases_modified": 0},
    )
    m5 = milestone(
        "M5_COMPANIES_COMPACT_RELATION",
        companies_pointer.get("release_id") == release_id
        and companies_manifest.get("classification") == "DETERMINISTIC_COMPACT_RELATION_BUILT"
        and companies_manifest.get("raw_companies_house_data_stored") is False
        and companies_manifest.get("personal_data") is False,
        {
            "release_id": companies_pointer.get("release_id"),
            "output_rows": companies_manifest.get("output_rows"),
            "output_bytes": companies_manifest.get("output_bytes"),
            "output_sha256": companies_manifest.get("output_sha256"),
            "abstentions": companies_manifest.get("source_rows_abstained"),
            "raw_companies_house_data_stored": companies_manifest.get("raw_companies_house_data_stored"),
            "personal_data": companies_manifest.get("personal_data"),
        },
        {"release_id": release_id, "raw_companies_house_data_stored": False, "personal_data": False},
    )

    milestones = [m0, m1, m2, m3, m4, m5]
    all_green = all(item["passed"] for item in milestones)
    m6 = milestone(
        "M6_END_TO_END_GREEN",
        all_green,
        {"passed": sum(1 for item in milestones if item["passed"]), "total": len(milestones)},
        {"passed": len(milestones), "total": len(milestones)},
    )
    milestones.append(m6)

    payload = {
        "schema": "gridatlas.cross-repo-atlas-v9-milestones.v1",
        "classification": "CROSS_REPO_ATLAS_V9_GREEN" if m6["passed"] else "CROSS_REPO_ATLAS_V9_IN_PROGRESS",
        "evaluated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "generation": generation or None,
        "release_id": release_id or None,
        "milestones": milestones,
        "passed": sum(1 for item in milestones if item["passed"]),
        "total": len(milestones),
        "next_milestone": next((item["id"] for item in milestones if not item["passed"]), None),
        "sources": {
            "gridatlas_live_set_sha256": sha(atlas_path),
            "globalgrid_pointer_sha256": sha(global_path),
            "pipelinenews_pointer_sha256": sha(pipeline_pointer_path),
            "pipelinenews_audit_sha256": sha(pipeline_audit_path),
            "companies_pointer_sha256": sha(companies_pointer_path),
            "companies_manifest_sha256": sha(companies_manifest_path),
            "deep_link_contract_sha256": sha(contract_path),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(payload, sort_keys=True))


if __name__ == "__main__":
    main()
