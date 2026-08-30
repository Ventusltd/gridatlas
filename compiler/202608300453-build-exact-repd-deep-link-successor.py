#!/usr/bin/env python3
"""Build an immutable GridAtlas successor that receives exact REPD deep links."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

SEARCH_FILE = "202608291818-place-postcode-search.js"
GENERATION = "202608300453"
SHARED_CARTRIDGE = Path(
    "cartridges/5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993/grid_400kv.geojson"
)


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--parent-release-id", required=True)
    parser.add_argument("--source-commit", required=True)
    args = parser.parse_args()

    if args.output.exists():
        raise RuntimeError(f"output already exists: {args.output}")
    if args.parent.name != args.parent_release_id:
        raise RuntimeError("parent folder and parent release id disagree")
    if not args.parent.is_dir():
        raise RuntimeError("immutable parent is missing")
    if not SHARED_CARTRIDGE.is_file():
        raise RuntimeError(f"shared 400 kV cartridge is missing: {SHARED_CARTRIDGE}")

    shutil.copytree(args.parent, args.output)
    local_cartridge = args.output.parent / SHARED_CARTRIDGE
    local_cartridge.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SHARED_CARTRIDGE, local_cartridge)
    if sha256(local_cartridge) != sha256(SHARED_CARTRIDGE):
        raise RuntimeError("local shared 400 kV cartridge digest mismatch")

    search_path = args.output / SEARCH_FILE
    source = search_path.read_text(encoding="utf-8")

    source = replace_once(
        source,
        "    generation: '202608291818',",
        f"    generation: '{GENERATION}',",
        "search generation",
    )
    source = replace_once(
        source,
        "    failures: []\n",
        "    failures: [],\n"
        "    deep_link: { status: 'IDLE', repd_ref: null, resolved: false, mapped: false }\n",
        "deep-link state",
    )

    receiver = r'''
  async function waitForCapturedMap(timeoutMs = 60000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const map = window.__GRIDATLAS_V9_MAP__;
      if (map && typeof map.flyTo === 'function') return map;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('GridAtlas map was not captured for exact REPD deep link');
  }

  async function receiveExactRepdDeepLink(input, resultsEl) {
    const repdRef = String(new URLSearchParams(window.location.search).get('repd_ref') || '').trim();
    if (!repdRef) {
      state.deep_link = { status: 'ABSENT', repd_ref: null, resolved: false, mapped: false };
      return;
    }

    state.deep_link = { status: 'RECEIVING', repd_ref: repdRef, resolved: false, mapped: false };
    try {
      invariant(/^[A-Za-z0-9-]{1,40}$/.test(repdRef), 'invalid exact REPD deep-link identity');
      input.value = repdRef;
      const results = await queryOfficialRepd(repdRef);
      const exact = results.find(result => String(result.repd_ref) === repdRef);
      invariant(exact, `official REPD identity ${repdRef} was not found`);
      renderResults(results, resultsEl);
      await waitForCapturedMap();
      selectResult(exact);
      invariant(state.last_selection?.repd_ref === repdRef, 'exact REPD selection was not retained');
      invariant(state.last_selection?.mapped === true, 'exact REPD identity did not fly to a safe map point');
      document.body.dataset.gridatlasRepdRef = repdRef;
      document.body.dataset.gridatlasRepdDeepLink = 'resolved';
      state.deep_link = {
        status: 'RESOLVED',
        repd_ref: repdRef,
        resolved: true,
        mapped: true,
        name: exact.name,
        postcode: exact.postcode,
        longitude: exact.longitude,
        latitude: exact.latitude
      };
    } catch (error) {
      const message = String(error?.message || error);
      state.failures.push({ phase: 'exact_repd_deep_link', repd_ref: repdRef, message });
      state.deep_link = { status: 'FAILED', repd_ref: repdRef, resolved: false, mapped: false, message };
      document.body.dataset.gridatlasRepdDeepLink = 'failed';
      console.error('[V9 EXACT REPD DEEP LINK]', error);
    }
  }
'''
    source = replace_once(source, "  function bindSearch() {", receiver + "\n  function bindSearch() {", "receiver insertion")

    old_boot = """  window.addEventListener('DOMContentLoaded', () => {
    try {
      bindSearch();
    } catch (error) {
      state.failures.push({ phase: 'bind', message: String(error?.message || error) });
      console.error('[V9 PLACE SEARCH INIT]', error);
    }
  }, { once: true });
"""
    new_boot = """  window.addEventListener('DOMContentLoaded', () => {
    try {
      bindSearch();
      const input = document.getElementById('search-input');
      const resultsEl = document.getElementById('search-results');
      void receiveExactRepdDeepLink(input, resultsEl);
    } catch (error) {
      state.failures.push({ phase: 'bind', message: String(error?.message || error) });
      console.error('[V9 PLACE SEARCH INIT]', error);
    }
  }, { once: true });
"""
    source = replace_once(source, old_boot, new_boot, "DOMContentLoaded receiver")
    search_path.write_text(source, encoding="utf-8", newline="\n")

    build_path = args.output / "build-manifest.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build.update(
        generation=GENERATION,
        release_id=args.release_id,
        source_commit=args.source_commit,
        parent_release_id=args.parent_release_id,
        classification="DETERMINISTIC_BUILD_COMPLETE",
        exact_repd_deep_link_receiver=True,
        exact_repd_identity_parameter="repd_ref",
        exact_repd_search_cartridge=SEARCH_FILE,
    )
    write_json(build_path, build)

    map_path = args.output / "map-ready-manifest.json"
    map_ready = json.loads(map_path.read_text(encoding="utf-8"))
    map_ready.update(generation=GENERATION, release_id=args.release_id, source_commit=args.source_commit)
    map_ready.setdefault("architecture", {})["exact_repd_deep_link_receiver"] = True
    write_json(map_path, map_ready)

    release_path = args.output / "release-manifest.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    release.update(
        generation=GENERATION,
        release_id=args.release_id,
        parent_release_id=args.parent_release_id,
        source_commit=args.source_commit,
        classification="V8_RENDER_READY_EXACT_REPD_DEEP_LINK_CANDIDATE",
        product_surface="PINNED_V8_WITH_WORKER_SOURCE_400KV_AND_EXACT_REPD_RECEIVER",
    )
    release["deep_link_receiver"] = {
        "schema": "gridatlas.exact-repd-deep-link-receiver.v1",
        "identity_parameter": "repd_ref",
        "identity_rule": "EXACT_REPD_REF_ONLY",
        "official_source": "DESNZ_REPD_Q2_2026_PARQUET",
        "automatic_search": True,
        "automatic_fly_to": True,
        "synthetic_receiver": False,
        "route_interceptions": 0,
        "privacy": "NO_PERSONAL_DATA",
    }
    release["machine_learning_record"] = {
        "schema": "gridatlas.ml.render-ready-performance-record.v1",
        "path": f"machine-learning/records/{GENERATION}-render-ready-performance.jsonl",
        "task": "binary_release_promotion",
        "positive_label": "PROMOTE",
        "negative_label": "REJECT",
        "privacy": "NO_PERSONAL_DATA",
    }
    write_json(release_path, release)

    receiver_manifest = {
        "schema": "gridatlas.exact-repd-deep-link-build.v1",
        "classification": "DETERMINISTIC_EXACT_REPD_RECEIVER_BUILT",
        "generation": GENERATION,
        "release_id": args.release_id,
        "parent_release_id": args.parent_release_id,
        "source_commit": args.source_commit,
        "identity_parameter": "repd_ref",
        "identity_rule": "EXACT_REPD_REF_ONLY",
        "search_cartridge": SEARCH_FILE,
        "search_cartridge_sha256": sha256(search_path),
        "local_test_shared_cartridge": SHARED_CARTRIDGE.as_posix(),
        "local_test_shared_cartridge_sha256": sha256(local_cartridge),
        "immutable_parent_files_changed": [
            SEARCH_FILE,
            "build-manifest.json",
            "map-ready-manifest.json",
            "release-manifest.json",
            "sha256sums.txt",
        ],
        "v8_html_changed": False,
        "v8_css_changed": False,
        "v8_engine_changed": False,
        "map_ready_data_changed": False,
        "privacy": "NO_PERSONAL_DATA",
    }
    write_json(args.output / "deep-link-receiver-manifest.json", receiver_manifest)

    sums: list[str] = []
    for path in sorted(item for item in args.output.rglob("*") if item.is_file()):
        relative = path.relative_to(args.output).as_posix()
        if relative == "sha256sums.txt":
            continue
        sums.append(f"{sha256(path)}  {relative}")
    (args.output / "sha256sums.txt").write_text("\n".join(sums) + "\n", encoding="utf-8", newline="\n")

    result = {
        "classification": "DETERMINISTIC_EXACT_REPD_RECEIVER_BUILT",
        "generation": GENERATION,
        "release_id": args.release_id,
        "parent_release_id": args.parent_release_id,
        "search_cartridge_sha256": sha256(search_path),
        "local_test_shared_cartridge": local_cartridge.as_posix(),
        "local_test_shared_cartridge_sha256": sha256(local_cartridge),
        "v8_html_changed": False,
        "v8_css_changed": False,
        "v8_engine_changed": False,
        "map_ready_data_changed": False,
    }
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
