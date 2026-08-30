#!/usr/bin/env python3
"""Run the pinned render-ready compiler with a complete deterministic V8 oracle."""

from __future__ import annotations

import hashlib
import runpy
import subprocess
from pathlib import Path

BASE_COMMIT = "f9864e85ffbc4673d530ce58598ec6a528da8105"
TARGET_PATH = "compiler/202608292311-build-render-ready-v9.py"
EXPECTED_BLOB_SHA1 = "4535a9787905c86746842f8b7404b93c40753f6f"


def git_blob_sha1(payload: bytes) -> str:
    return hashlib.sha1(f"blob {len(payload)}\0".encode("utf-8") + payload).hexdigest()


def replace_exactly_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"compiler repair anchor mismatch for {label}: {count}")
    return source.replace(before, after)


original = subprocess.check_output(
    ["git", "show", f"{BASE_COMMIT}:{TARGET_PATH}"],
    stderr=subprocess.STDOUT,
)
if git_blob_sha1(original) != EXPECTED_BLOB_SHA1:
    raise RuntimeError("pinned render-ready compiler Git blob mismatch")

repaired = original.decode("utf-8")
repaired = replace_exactly_once(
    repaired,
    "import shutil\nfrom pathlib import Path\nfrom typing import Any\n",
    "import shutil\nimport time\nimport urllib.parse\nimport urllib.request\nfrom pathlib import Path\nfrom typing import Any\n",
    "network imports",
)

repaired = replace_exactly_once(
    repaired,
    '''def git_blob_sha1(payload: bytes) -> str:\n    return hashlib.sha1(f"blob {len(payload)}\\0".encode("utf-8") + payload).hexdigest()\n\n\n''',
    '''def git_blob_sha1(payload: bytes) -> str:\n    return hashlib.sha1(f"blob {len(payload)}\\0".encode("utf-8") + payload).hexdigest()\n\n\ndef fetch_bytes(url: str, attempts: int = 5, timeout: int = 180) -> bytes:\n    last_error: Exception | None = None\n    for attempt in range(1, attempts + 1):\n        try:\n            request = urllib.request.Request(\n                url, headers={"User-Agent": "gridatlas-render-ready-compiler/202608292311"}\n            )\n            with urllib.request.urlopen(request, timeout=timeout) as response:\n                require(200 <= response.status < 300, f"HTTP {response.status}: {url}")\n                return response.read()\n        except Exception as error:  # noqa: BLE001 - bounded retry boundary\n            last_error = error\n            if attempt < attempts:\n                time.sleep(min(attempt * 2, 8))\n    raise RuntimeError(f"failed after {attempts} attempts: {url}: {last_error}")\n\n\ndef raw_url(repository: str, commit: str, path: str) -> str:\n    quoted = urllib.parse.quote(path, safe="/")\n    return f"https://raw.githubusercontent.com/{repository}/{commit}/{quoted}"\n\n\ndef write_bytes(path: Path, payload: bytes) -> None:\n    path.parent.mkdir(parents=True, exist_ok=True)\n    path.write_bytes(payload)\n\n\n''',
    "pinned oracle helpers",
)

repaired = replace_exactly_once(
    repaired,
    '''    oracle = contract["product_oracle"]\n    for name in ("index.html", "ventusv8.css", "ventus-corev8engine.js"):\n        source = parent / name\n        require(source.is_file(), f"parent {name} missing")\n        shutil.copyfile(source, oracle_output / name)\n\n''',
    '''    oracle = contract["product_oracle"]\n    oracle_root = str(oracle["root"]).rstrip("/")\n    oracle_files = {\n        "index.html": oracle["index_blob_sha1"],\n        "ventusv8.css": oracle["css_blob_sha1"],\n        "ventus-corev8engine.js": oracle["engine_blob_sha1"],\n    }\n    for relative, expected_blob in oracle_files.items():\n        payload = fetch_bytes(\n            raw_url(\n                oracle["repository"],\n                oracle["commit"],\n                f"{oracle_root}/{relative}",\n            )\n        )\n        require(git_blob_sha1(payload) == expected_blob, f"V8 Git blob mismatch: {relative}")\n        write_bytes(oracle_output / relative, payload)\n\n    # V8 preloads these eleven same-origin sources. A local comparator oracle that\n    # omits them is not V8 and can only time out or emit false performance evidence.\n    oracle_preload_files = (\n        "grid_400kv.geojson",\n        "grid_275kv.geojson",\n        "grid_220kv.geojson",\n        "grid_132kv.geojson",\n        "grid_66kv.geojson",\n        "grid_substations.geojson",\n        "power_plants.geojson",\n        "industrial_offtakers.geojson",\n        "datacentres.geojson",\n        "airports.geojson",\n        "railways.geojson",\n    )\n    for name in oracle_preload_files:\n        payload = fetch_bytes(\n            raw_url(\n                oracle["repository"],\n                oracle["commit"],\n                f"{oracle_root}/data/{name}",\n            )\n        )\n        write_bytes(oracle_output / "data" / name, payload)\n        if name == "grid_400kv.geojson":\n            collection = json.loads(payload)\n            require(\n                isinstance(collection, dict)\n                and isinstance(collection.get("features"), list)\n                and len(collection["features"]) == int(runtime["critical_rows"]),\n                "V8 400 kV oracle row closure mismatch",\n            )\n\n''',
    "complete pinned V8 local oracle",
)

runtime_dir = Path("work/.compiler-runtime")
runtime_dir.mkdir(parents=True, exist_ok=True)
runtime_path = runtime_dir / "202608292311-build-render-ready-v9.repaired.py"
runtime_path.write_text(repaired, encoding="utf-8", newline="\n")
runpy.run_path(str(runtime_path), run_name="__main__")
