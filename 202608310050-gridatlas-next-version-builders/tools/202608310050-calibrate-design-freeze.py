#!/usr/bin/env python3
"""N4: deterministic design-freeze calibration over the frozen PipelineNews project spine."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import statistics
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

TECHNOLOGIES = ["solar", "bess", "wind_onshore", "wind_offshore"]
BANDS = [
    ("1-5", 1.0, 5.0),
    ("5-20", 5.0, 20.0),
    ("20-50", 20.0, 50.0),
    ("50-100", 50.0, 100.0),
    ("100-250", 100.0, 250.0),
    ("250+", 250.0, float("inf")),
]
MIN_SAMPLES = 30


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, value: Any) -> None:
    write_text(path, json.dumps(value, indent=2, ensure_ascii=False, sort_keys=False))


def parse_date(value: Any) -> dt.date | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return dt.date.fromisoformat(text[:10])
    except ValueError:
        return None


def capacity_band(capacity: float) -> str | None:
    for label, lower, upper in BANDS:
        if lower <= capacity < upper:
            return label
    return None


def records_from_file(path: Path) -> Iterable[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, list):
        yield from (item for item in value if isinstance(item, dict))
        return
    if isinstance(value, dict):
        for key in ("projects", "records", "items", "features"):
            items = value.get(key)
            if isinstance(items, list):
                yield from (item for item in items if isinstance(item, dict))
                return
    raise ValueError(f"unsupported project partition shape: {path}")


def sha256_paths(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pipelinenews", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--generation", required=True)
    args = parser.parse_args()

    repo = args.pipelinenews.resolve()
    output = (args.output / "design-freeze").resolve()
    output.mkdir(parents=True, exist_ok=True)
    partitions = sorted((repo / "data" / "projects").glob("*-project-partition-v9-1-*.json"))
    if not partitions:
        raise SystemExit("no PipelineNews v9.1 project partitions found")

    samples: dict[tuple[str, str], list[int]] = defaultdict(list)
    total_projects = 0
    eligible = 0
    malformed_dates = 0
    negative_intervals = 0
    out_of_universe = 0
    duplicate_ids: set[str] = set()
    seen_ids: set[str] = set()
    examples: list[dict[str, Any]] = []

    for partition in partitions:
        for project in records_from_file(partition):
            total_projects += 1
            project_id = str(project.get("gg_project_id") or "").strip()
            if project_id:
                if project_id in seen_ids:
                    duplicate_ids.add(project_id)
                seen_ids.add(project_id)
            technology = str(project.get("technology") or "").strip()
            try:
                capacity = float(project.get("capacity_mw"))
            except (TypeError, ValueError):
                continue
            band = capacity_band(capacity)
            if technology not in TECHNOLOGIES or band is None:
                out_of_universe += 1
                continue
            permission = parse_date(project.get("planning_permission_granted"))
            construction = parse_date(project.get("under_construction"))
            if project.get("planning_permission_granted") not in (None, "") and permission is None:
                malformed_dates += 1
            if project.get("under_construction") not in (None, "") and construction is None:
                malformed_dates += 1
            if not permission or not construction:
                continue
            delta = (construction - permission).days
            if delta < 0:
                negative_intervals += 1
                continue
            eligible += 1
            samples[(technology, band)].append(delta)
            if len(examples) < 20:
                examples.append({
                    "gg_project_id": project_id,
                    "repd_ref": str(project.get("repd_ref") or ""),
                    "technology": technology,
                    "capacity_mw": capacity,
                    "capacity_band": band,
                    "planning_permission_granted": permission.isoformat(),
                    "under_construction": construction.isoformat(),
                    "days": delta,
                })

    cells = []
    for technology in TECHNOLOGIES:
        for label, _, _ in BANDS:
            values = sorted(samples.get((technology, label), []))
            median = statistics.median(values) if len(values) >= MIN_SAMPLES else None
            cells.append({
                "technology": technology,
                "capacity_band": label,
                "samples": len(values),
                "median_days_permission_to_construction": median,
                "status": "PUBLISHED_MEDIAN" if median is not None else "NULL_INSUFFICIENT_SAMPLE",
                "minimum_samples": MIN_SAMPLES,
                "min_days": values[0] if values else None,
                "max_days": values[-1] if values else None,
            })

    try:
        source_commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        source_commit = None

    calibration = {
        "schema": "pipelinenews.design-freeze-calibration.v1",
        "generation": args.generation,
        "classification": "CANDIDATE_DERIVED_NOT_PUBLISHED",
        "method": "median(under_construction - planning_permission_granted) by technology and capacity band",
        "source": {
            "repository": "Ventusltd/pipelinenews",
            "commit": source_commit,
            "partition_pattern": "data/projects/*-project-partition-v9-1-*.json",
            "partition_count": len(partitions),
            "partition_set_sha256": sha256_paths(partitions),
            "project_rows": total_projects,
        },
        "rules": {
            "minimum_samples": MIN_SAMPLES,
            "insufficient_cell_value": None,
            "negative_interval_policy": "exclude-and-count",
            "estimate_label": "DERIVED_NOT_PUBLISHED",
            "network_requests": 0,
        },
        "closure": {
            "eligible_intervals": eligible,
            "duplicate_project_ids": sorted(duplicate_ids),
            "malformed_dates": malformed_dates,
            "negative_intervals": negative_intervals,
            "out_of_universe": out_of_universe,
            "cells": len(cells),
            "published_cells": sum(1 for cell in cells if cell["median_days_permission_to_construction"] is not None),
            "null_cells": sum(1 for cell in cells if cell["median_days_permission_to_construction"] is None),
        },
        "cells": cells,
        "examples": examples,
        "promotion_eligible": False,
    }
    write_json(output / "calibration.json", calibration)

    contract = {
        "schema": "pipelinenews.design-freeze-calibration-contract.v1",
        "generation": args.generation,
        "deployment": "not-authorised",
        "source_commit": source_commit,
        "source_partition_set_sha256": calibration["source"]["partition_set_sha256"],
        "declared_key": ["technology", "capacity_band"],
        "hard_gates": {
            "cells": 24,
            "minimum_samples_or_null": True,
            "duplicate_project_ids": 0,
            "negative_intervals_retained_as_count": True,
            "deterministic_rebuild_required": True,
            "promotion_eligible": False,
        },
        "recovery_rule": "Never overwrite this calibration; create a later Europe/London timestamped successor.",
    }
    write_json(output / f"{args.generation}-design-freeze-calibration-contract.json", contract)
    print(json.dumps(calibration["closure"], indent=2))
    if duplicate_ids:
        raise SystemExit(f"duplicate project ids found: {len(duplicate_ids)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
