#!/usr/bin/env python3
"""Compile the immutable timestamp-folder Atlas V9 successor."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

RELEASE_ID = "202608291237-atlas-v9"
SOURCE_ROOT = Path("ui/successor")
CONTRACT = Path("contracts/202608291237-atlas-v9-live-release.json")
SOURCE_FILES = (
    "assets/atlas-v9.css",
    "assets/atlas-v9.mjs",
    "assets/data-gridatlas-client.mjs",
    "cartridges/202608290716-repd-address-flyto.mjs",
    "index.html",
)
SHA40 = re.compile(r"^[a-f0-9]{40}$")


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


def placeholders(value: object, location: str = "contract") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            found.extend(placeholders(item, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(placeholders(item, f"{location}[{index}]"))
    elif isinstance(value, str) and value.startswith("__DATA_RELEASE_"):
        found.append(f"{location}={value}")
    return found


def compile_release(args: argparse.Namespace) -> None:
    repository = args.repository.resolve()
    source_root = repository / SOURCE_ROOT
    contract_path = repository / CONTRACT
    output = args.output.resolve()
    require(SHA40.fullmatch(args.source_commit) is not None, "source commit must be an exact SHA-1")
    require(re.match(r"^\d{4}-\d{2}-\d{2}T", args.source_committed_at) is not None, "source commit time must be ISO-8601")
    require(not output.exists(), f"refusing existing output: {output}")
    require(output.name == RELEASE_ID, f"output folder must be named {RELEASE_ID}")

    actual_source = tuple(
        sorted(path.relative_to(source_root).as_posix() for path in source_root.rglob("*") if path.is_file())
    )
    require(actual_source == SOURCE_FILES, f"successor source allowlist mismatch: {actual_source}")
    contract = read_json(contract_path)
    require(contract.get("release_id") == RELEASE_ID, "release contract identity mismatch")
    unresolved = placeholders(contract)
    require(args.allow_unsealed or not unresolved, "unresolved data release placeholders: " + ", ".join(unresolved))

    output.mkdir(parents=True)
    for relative in SOURCE_FILES:
        source = source_root / relative
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)

    release = json.loads(json.dumps(contract))
    release["source_commit"] = args.source_commit
    release["committed_at"] = args.source_committed_at
    (output / "release-manifest.json").write_bytes(canonical_json(release))

    content_files = []
    for path in sorted(item for item in output.rglob("*") if item.is_file()):
        content_files.append({
            "path": path.relative_to(output).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    source_inputs = []
    for path in [*(source_root / item for item in SOURCE_FILES), contract_path]:
        source_inputs.append({
            "path": path.relative_to(repository).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    build_manifest = {
        "schema": "gridatlas.timestamped-live-build.v1",
        "release_id": RELEASE_ID,
        "source_commit": args.source_commit,
        "source_committed_at": args.source_committed_at,
        "deterministic": True,
        "source_inputs": source_inputs,
        "files": content_files,
    }
    (output / "build-manifest.json").write_bytes(canonical_json(build_manifest))
    print(json.dumps({
        "classification": "COMPILED_TIMESTAMPED_ATLAS_V9",
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
