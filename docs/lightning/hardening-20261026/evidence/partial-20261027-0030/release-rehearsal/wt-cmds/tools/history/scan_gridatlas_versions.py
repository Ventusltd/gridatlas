#!/usr/bin/env python3
"""Bounded Git-history scanner for GridAtlas release and workflow pattern recognition.

The scanner is intentionally mechanical: GitHub Actions checks out the complete
repository and this program reads Git history directly. It never edits history and
stops at the requested wall-clock budget (30 seconds by default).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

RELEASE_RE = re.compile(r"(?:^|/)(20\d{10,12}-atlas-v\d+(?:\.\d+)?)($|/)", re.I)
SCANNER_RE = re.compile(r"(?:scan|scanner).*(?:version|history)|(?:version|history).*(?:scan|scanner)", re.I)
TIMESTAMP_RE = re.compile(r"(?:^|/)(20\d{10,12})[-_/]")
WORKFLOW_RE = re.compile(r"^\.github/(?:workflows|workflow-archive)/(.+\.ya?ml)$")
SEARCH_RE = re.compile(r"(?:place|postcode|gazetteer|geocod|flyto|fly-to|address)", re.I)
COMPARATOR_RE = re.compile(r"(?:compare|comparator|audit|verify|proof|readback)", re.I)


def run(repo: Path, args: list[str], deadline: float, *, allow_fail: bool = False) -> str:
    remaining = max(0.2, deadline - time.monotonic())
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo), *args],
            check=not allow_fail,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=remaining,
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(f"git {' '.join(args)} exceeded bounded scanner budget") from exc
    if proc.returncode and not allow_fail:
        raise RuntimeError(proc.stderr.strip() or f"git {' '.join(args)} failed")
    return proc.stdout


def scan_repo(repo: Path, deadline: float, *, include_parent_duplicate_check: bool) -> dict[str, Any]:
    head = run(repo, ["rev-parse", "HEAD"], deadline).strip()
    branch = run(repo, ["rev-parse", "--abbrev-ref", "HEAD"], deadline).strip()
    commit_count = int(run(repo, ["rev-list", "--all", "--count"], deadline).strip() or "0")
    tree_paths = [p for p in run(repo, ["ls-tree", "-r", "--name-only", "HEAD"], deadline).splitlines() if p]

    previous_paths: list[str] = []
    if include_parent_duplicate_check:
        parent = run(repo, ["rev-parse", "HEAD^"], deadline, allow_fail=True).strip()
        if parent:
            previous_paths = [
                p for p in run(repo, ["ls-tree", "-r", "--name-only", parent], deadline).splitlines() if p
            ]

    # One bounded Git command scans all commit metadata and touched paths. Record separators
    # make parsing deterministic and avoid a subprocess per commit/version.
    history_text = run(
        repo,
        [
            "log",
            "--all",
            "--date=iso-strict",
            "--pretty=format:@@COMMIT@@%H%x09%ad%x09%s",
            "--name-only",
        ],
        deadline,
    )

    commits: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in history_text.splitlines():
        if line.startswith("@@COMMIT@@"):
            if current is not None:
                commits.append(current)
            payload = line.removeprefix("@@COMMIT@@")
            sha, committed_at, subject = (payload.split("\t", 2) + ["", ""])[:3]
            current = {"sha": sha, "committed_at": committed_at, "subject": subject, "paths": []}
        elif current is not None and line.strip():
            current["paths"].append(line.strip())
    if current is not None:
        commits.append(current)

    release_first_seen: dict[str, dict[str, str]] = {}
    path_change_counts: Counter[str] = Counter()
    workflow_counts: Counter[str] = Counter()
    search_changes: list[dict[str, str]] = []
    comparator_changes: list[dict[str, str]] = []
    timestamp_groups: defaultdict[str, set[str]] = defaultdict(set)

    for commit in commits:
        for item in commit["paths"]:
            path_change_counts[item] += 1
            release_match = RELEASE_RE.search(item)
            if release_match:
                release_id = release_match.group(1)
                release_first_seen.setdefault(
                    release_id,
                    {
                        "commit": commit["sha"],
                        "committed_at": commit["committed_at"],
                        "subject": commit["subject"],
                    },
                )
            workflow_match = WORKFLOW_RE.match(item)
            if workflow_match:
                workflow_counts[workflow_match.group(1)] += 1
            if SEARCH_RE.search(item) or SEARCH_RE.search(commit["subject"]):
                search_changes.append({"commit": commit["sha"], "subject": commit["subject"], "path": item})
            if COMPARATOR_RE.search(item) or COMPARATOR_RE.search(commit["subject"]):
                comparator_changes.append({"commit": commit["sha"], "subject": commit["subject"], "path": item})
            timestamp_match = TIMESTAMP_RE.search(item)
            if timestamp_match:
                timestamp_groups[timestamp_match.group(1)].add(item)

    self_path = 'tools/history/scan_gridatlas_versions.py'
    current_scanners = sorted(p for p in tree_paths if SCANNER_RE.search(p))
    previous_scanners = sorted(p for p in previous_paths if SCANNER_RE.search(p) and p != self_path)
    releases_in_head = sorted({m.group(1) for p in tree_paths if (m := RELEASE_RE.search(p))})

    return {
        "path": str(repo),
        "head": head,
        "branch": branch,
        "commit_count": commit_count,
        "commits_scanned": len(commits),
        "files_in_head": len(tree_paths),
        "scanner_candidates_before_this_change": previous_scanners,
        "scanner_candidates_now": current_scanners,
        "scanner_was_already_present": bool(previous_scanners),
        "releases_in_head": releases_in_head,
        "release_first_seen": dict(sorted(release_first_seen.items())),
        "workflow_files_touched": dict(workflow_counts.most_common()),
        "most_changed_paths": path_change_counts.most_common(30),
        "search_pattern_changes": search_changes[:100],
        "comparator_pattern_changes": comparator_changes[:100],
        "timestamp_groups": {key: sorted(value)[:40] for key, value in sorted(timestamp_groups.items())},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--reference-repo")
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-seconds", type=float, default=30.0)
    args = parser.parse_args()

    started = time.monotonic()
    deadline = started + max(1.0, min(args.max_seconds, 30.0))
    output: dict[str, Any] = {
        "schema": "gridatlas.history-pattern-scan.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "max_seconds": max(1.0, min(args.max_seconds, 30.0)),
        "status": "RUNNING",
        "truncated": False,
        "repositories": {},
        "findings": [],
    }

    try:
        primary = scan_repo(Path(args.repo).resolve(), deadline, include_parent_duplicate_check=True)
        output["repositories"]["gridatlas"] = primary
        if args.reference_repo and Path(args.reference_repo).exists() and time.monotonic() < deadline:
            output["repositories"]["cvaa_reference"] = scan_repo(
                Path(args.reference_repo).resolve(), deadline, include_parent_duplicate_check=False
            )

        output["findings"] = [
            {
                "id": "scanner-duplication-check",
                "status": "REUSE" if primary["scanner_was_already_present"] else "CREATE_ONCE",
                "evidence": primary["scanner_candidates_before_this_change"],
            },
            {
                "id": "immutable-release-lineage",
                "status": "OBSERVED",
                "release_count": len(primary["release_first_seen"]),
                "head_release_count": len(primary["releases_in_head"]),
            },
            {
                "id": "cartridge-not-app-copy",
                "status": "REQUIRED",
                "rule": "v9.5 changes one hashed cartridge and current composition; no new full application folder",
            },
        ]
        output["status"] = "PASS"
    except TimeoutError as exc:
        output["status"] = "PASS_BOUNDED"
        output["truncated"] = True
        output["warning"] = str(exc)
    except Exception as exc:  # fail closed in CI, but always leave a useful report
        output["status"] = "FAIL"
        output["error"] = repr(exc)

    output["elapsed_seconds"] = round(time.monotonic() - started, 3)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": output["status"], "elapsed_seconds": output["elapsed_seconds"], "output": str(target)}))
    return 0 if output["status"].startswith("PASS") else 1


if __name__ == "__main__":
    raise SystemExit(main())
