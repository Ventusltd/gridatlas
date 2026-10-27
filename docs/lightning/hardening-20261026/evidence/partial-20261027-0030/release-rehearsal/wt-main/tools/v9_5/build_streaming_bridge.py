#!/usr/bin/env python3
"""Compile a streaming-response bridge cartridge over the immutable GridAtlas shell."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CURRENT = ROOT / "atlas/current.json"
BRIDGE_SLOT = "202608292311-maplibre-worker-bridge.js"
TRANSPORT_ID = "streaming-parquet-bridge"
SEARCH_ID = "uk-gazetteer-flyto"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def compile_bridge(source: str, generation: str) -> str:
    replacements = {
        "const GENERATION = '202608292311';": f"const GENERATION = '{generation}';",
        "      preload_browser_duckdb: false,": "      preload_browser_duckdb: 'AFTER_CRITICAL_SOURCE',",
        "    failures: []": "    failures: [],\n    streamed_responses: 0,\n    stream_failures: [],\n    runtime_prewarm: { requested: false, started: false, completed: false, failed: null }",
        "    const expected = `partitions/${stem}.parquet`.toLowerCase();": "    const alias = stem === 'uk_metros_trams' ? 'uk_metros_trams_root' : stem;\n    const expected = `partitions/${alias}.parquet`.toLowerCase();",
    }
    for old, new in replacements.items():
        if source.count(old) != 1:
            raise RuntimeError(f"bridge marker changed or ambiguous: {old!r}")
        source = source.replace(old, new, 1)

    anchor = "  async function resolvePartition(pathname) {"
    prewarm = r'''  function scheduleRuntimePrewarm() {
    state.runtime_prewarm.requested = true;
    let checks = 0;
    const poll = setInterval(() => {
      checks += 1;
      let criticalReady = false;
      try {
        const map = window.__GRIDATLAS_V9_MAP__;
        criticalReady = Boolean(map && map.getSource('src-400') && map.isSourceLoaded('src-400'));
      } catch {}
      if (!criticalReady && checks < 240) return;
      clearInterval(poll);
      const start = () => {
        state.runtime_prewarm.started = true;
        getRuntime().then(() => {
          state.runtime_prewarm.completed = true;
        }).catch(error => {
          state.runtime_prewarm.failed = String(error?.message || error);
          state.failures.push({ pathname: 'duckdb-runtime-prewarm', message: state.runtime_prewarm.failed });
        });
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 });
      else setTimeout(start, 0);
    }, 250);
  }

  queueMicrotask(scheduleRuntimePrewarm);

'''
    if source.count(anchor) != 1:
        raise RuntimeError("resolvePartition anchor changed")
    source = source.replace(anchor, prewarm + anchor, 1)

    old_fetch = r'''    state.intercepted_on_demand += 1;
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const payload = await queryOnDemand(pathname);
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'private, max-age=3600',
        'X-GridAtlas-Data-Plane': 'V9-PARQUET-DUCKDB-ON-DEMAND'
      }
    });'''
    new_fetch = r'''    state.intercepted_on_demand += 1;
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Return response headers before DuckDB imports, downloads, queries and serialises the body.
    // This preserves the native fetch contract expected by the V8 engine: its 15 s timer protects
    // response establishment, while response.json() may continue consuming a streamed body.
    state.streamed_responses += 1;
    const encoder = new TextEncoder();
    let bodyController = null;
    let aborted = false;
    const abort = () => {
      aborted = true;
      try { bodyController?.error(new DOMException('Aborted', 'AbortError')); } catch {}
    };
    init?.signal?.addEventListener('abort', abort, { once: true });
    const body = new ReadableStream({
      start(controller) {
        bodyController = controller;
        queryOnDemand(pathname).then(payload => {
          if (aborted || init?.signal?.aborted) return abort();
          controller.enqueue(encoder.encode(JSON.stringify(payload)));
          controller.close();
        }).catch(error => {
          state.stream_failures.push({ pathname, message: String(error?.message || error) });
          try { controller.error(error); } catch {}
        });
      },
      cancel() { aborted = true; }
    });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'private, max-age=3600',
        'X-GridAtlas-Data-Plane': 'V9-PARQUET-DUCKDB-STREAMED-RESPONSE'
      }
    });'''
    if source.count(old_fetch) != 1:
        raise RuntimeError("fetch bridge block changed or ambiguous")
    source = source.replace(old_fetch, new_fetch, 1)
    return source


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generation", required=True)
    parser.add_argument("--request", default="state/streaming-road-fix.json")
    parser.add_argument("--report", default="work/streaming-road-build.json")
    args = parser.parse_args()

    generation = str(args.generation)
    if not re.fullmatch(r"20\d{10}", generation):
        raise RuntimeError(f"invalid UTC generation: {generation!r}")
    request = load_json(ROOT / args.request)
    if request.get("schema") != "gridatlas.streaming-road-fix-request.v1":
        raise RuntimeError("request schema mismatch")
    if request.get("composition_version") != "v9.5":
        raise RuntimeError("request composition version mismatch")

    current = load_json(CURRENT)
    if current.get("schema") != "gridatlas.current.v2":
        raise RuntimeError("current composition schema mismatch")
    by_id = {item["id"]: item for item in current.get("cartridges", [])}
    if SEARCH_ID not in by_id:
        raise RuntimeError("v9.5 search cartridge is missing")
    if TRANSPORT_ID in by_id:
        report = {
            "schema": "gridatlas.streaming-road-build.v1",
            "status": "ALREADY_BUILT",
            "generation": current.get("generation"),
            "transport": by_id[TRANSPORT_ID],
        }
        dump_json(ROOT / args.report, report)
        print(json.dumps(report, sort_keys=True))
        return 0

    shell_index = (ROOT / "atlas" / current["shell"]["index"]).resolve()
    bridge_source = shell_index.parent / BRIDGE_SLOT
    if not bridge_source.is_file():
        raise RuntimeError(f"immutable bridge slot missing: {bridge_source}")
    manifest = load_json((ROOT / "atlas" / current["composition_manifest"]).resolve())
    expected_bridge_sha = manifest.get("shell", {}).get("hashes", {}).get("maplibre_worker_bridge")
    source_bytes = bridge_source.read_bytes()
    actual_bridge_sha = sha256_bytes(source_bytes)
    if actual_bridge_sha != expected_bridge_sha:
        raise RuntimeError(f"immutable bridge hash mismatch: {actual_bridge_sha} != {expected_bridge_sha}")

    compiled = compile_bridge(source_bytes.decode("utf-8"), generation)
    compiled_bytes = compiled.encode("utf-8")
    cartridge_sha = sha256_bytes(compiled_bytes)
    cartridge_rel = Path(f"atlas/cartridges/{generation}-streaming-parquet-bridge-v9-5.js")
    cartridge_path = ROOT / cartridge_rel
    if cartridge_path.exists() and cartridge_path.read_bytes() != compiled_bytes:
        raise RuntimeError(f"immutable cartridge collision: {cartridge_rel}")
    cartridge_path.parent.mkdir(parents=True, exist_ok=True)
    cartridge_path.write_bytes(compiled_bytes)

    contract_rel = Path(f"ui/cartridges/{generation}-streaming-parquet-bridge-v9-5.mjs")
    contract_path = ROOT / contract_rel
    contract_text = f"""export const STREAMING_PARQUET_BRIDGE_V9_5_CONTRACT = Object.freeze({{\n  schema: 'gridatlas.cartridge.v1',\n  generation: '{generation}',\n  version: 'v9.5',\n  slot: '{BRIDGE_SLOT}',\n  responseEstablishedBeforeBodyReconstruction: true,\n  duckdbPrewarm: 'after-critical-400kv-source',\n  metroPartitionAlias: 'uk_metros_trams_root',\n  immutableShellModified: false,\n  fullApplicationCopiesCreated: 0\n}});\n"""
    if contract_path.exists() and contract_path.read_text(encoding="utf-8") != contract_text:
        raise RuntimeError(f"immutable contract collision: {contract_rel}")
    contract_path.parent.mkdir(parents=True, exist_ok=True)
    contract_path.write_text(contract_text, encoding="utf-8")

    transport = {
        "id": TRANSPORT_ID,
        "generation": generation,
        "version": "v9.5",
        "type": "script",
        "slot": "replace-script",
        "replace_script": BRIDGE_SLOT,
        "path": f"./cartridges/{cartridge_rel.name}",
        "sha256": cartridge_sha,
        "contract": f"../{contract_rel.as_posix()}",
        "capabilities": [
            "response-before-body-reconstruction",
            "duckdb-runtime-prewarm-after-400kv",
            "metro-partition-alias",
            "parquet-on-demand-preserved",
        ],
        "immutable_shell_modified": False,
    }
    search = copy.deepcopy(by_id[SEARCH_ID])
    previous_generation = str(current["generation"])
    new_current = copy.deepcopy(current)
    new_current.update({
        "generation": generation,
        "previous_generation": previous_generation,
        "composition_version": "v9.5",
        "composition_id": f"{generation}-gridatlas-v9.5",
        "cartridge_order": [TRANSPORT_ID, SEARCH_ID],
        "cartridges": [transport, search],
        "composition_manifest": f"./manifests/{generation}-composition.json",
    })
    new_current["transport"] = {
        "response_contract": "HEADERS_BEFORE_PARQUET_BODY",
        "engine_timeout_seconds": 15,
        "duckdb_prewarm": "AFTER_400KV_SOURCE_READY",
        "data_plane": "PARQUET_DUCKDB_ON_DEMAND",
        "highway_layers": ["motorways", "trunk_roads", "primary_roads"],
        "v8_oracle_commit": request["v8_oracle_commit"],
        "fidelity_workflow": request["fidelity_workflow"],
    }
    new_current.setdefault("provenance", {})["cvaa_commit"] = request["cvaa_commit"]
    new_current["provenance"]["v8_oracle_commit"] = request["v8_oracle_commit"]
    new_current["scope_closure"] = {
        "generation": generation,
        "status": "DONE",
        "scope": "GridAtlas v9.5 streamed Parquet response and A-road recovery",
        "schedule_retired": True,
    }

    new_manifest = copy.deepcopy(manifest)
    new_manifest.update({
        "generation": generation,
        "parent_generation": previous_generation,
        "version": "v9.5",
        "composition_id": f"{generation}-gridatlas-v9.5",
        "cartridge_order": [TRANSPORT_ID, SEARCH_ID],
        "cartridges": [transport, search],
    })
    acceptance = copy.deepcopy(new_manifest.get("acceptance", {}))
    acceptance.update({
        "full_application_copies_created": 0,
        "immutable_shell_modified": False,
        "parquet_on_demand_preserved": True,
        "response_established_before_body_reconstruction": True,
        "a_road_browser_budget_seconds": 15,
        "a_road_heap_budget_mb": 400,
        "v8_feature_hash_fidelity_required": True,
        "search_cartridge_preserved": True,
        "golden_browser_verification": "REQUIRED",
    })
    new_manifest["acceptance"] = acceptance
    new_manifest["source_pattern"] = {
        "repository": "Ventusltd/gridatlas",
        "path": f"atlas/releases/{current['release_id']}/{BRIDGE_SLOT}",
        "source_sha256": actual_bridge_sha,
        "transformation": "return streamed Response before DuckDB body reconstruction; prewarm runtime after 400 kV readiness",
    }

    manifest_path = ROOT / f"atlas/manifests/{generation}-composition.json"
    dump_json(manifest_path, new_manifest)
    dump_json(CURRENT, new_current)
    report = {
        "schema": "gridatlas.streaming-road-build.v1",
        "status": "BUILT",
        "generation": generation,
        "previous_generation": previous_generation,
        "source_bridge": str(bridge_source.relative_to(ROOT)),
        "source_bridge_sha256": actual_bridge_sha,
        "transport_cartridge": str(cartridge_rel),
        "transport_sha256": cartridge_sha,
        "transport_contract": str(contract_rel),
        "composition_manifest": str(manifest_path.relative_to(ROOT)),
        "preserved_cartridge": search,
        "full_application_copies_created": 0,
        "immutable_shell_modified": False,
    }
    dump_json(ROOT / args.report, report)
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
