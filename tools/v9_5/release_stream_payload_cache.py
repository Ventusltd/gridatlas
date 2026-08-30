#!/usr/bin/env python3
"""Release the bridge's reconstructed payload after serialisation and re-pin the cartridge.

This is a deterministic post-compiler pass. It changes only the generated transport
cartridge, its generated contract, current.json, the composition manifest and build report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generation", required=True)
    parser.add_argument("--report", default="work/streaming-road-build.json")
    args = parser.parse_args()
    generation = args.generation

    cartridge = ROOT / f"atlas/cartridges/{generation}-streaming-parquet-bridge-v9-5.js"
    contract = ROOT / f"ui/cartridges/{generation}-streaming-parquet-bridge-v9-5.mjs"
    current_path = ROOT / "atlas/current.json"
    report_path = ROOT / args.report
    current = load(current_path)
    manifest_path = (ROOT / "atlas" / current["composition_manifest"]).resolve()
    manifest = load(manifest_path)
    report = load(report_path)

    text = cartridge.read_text(encoding="utf-8")
    state_old = "    streamed_responses: 0,\n    stream_failures: [],"
    state_new = "    streamed_responses: 0,\n    released_payloads: 0,\n    stream_failures: [],"
    if state_new not in text:
        if text.count(state_old) != 1:
            raise RuntimeError("stream state marker changed")
        text = text.replace(state_old, state_new, 1)

    body_old = """          controller.enqueue(encoder.encode(JSON.stringify(payload)));
          controller.close();
        }).catch(error => {
          state.stream_failures.push({ pathname, message: String(error?.message || error) });"""
    body_new = """          const serialised = JSON.stringify(payload);
          sourceCache.delete(pathname);
          state.released_payloads += 1;
          controller.enqueue(encoder.encode(serialised));
          controller.close();
        }).catch(error => {
          sourceCache.delete(pathname);
          state.stream_failures.push({ pathname, message: String(error?.message || error) });"""
    if body_new not in text:
        if text.count(body_old) != 1:
            raise RuntimeError("stream serialisation marker changed")
        text = text.replace(body_old, body_new, 1)
    cartridge.write_text(text, encoding="utf-8")
    digest = hashlib.sha256(cartridge.read_bytes()).hexdigest()

    contract_text = contract.read_text(encoding="utf-8")
    marker = "  responseEstablishedBeforeBodyReconstruction: true,\n"
    addition = marker + "  payloadCacheReleasedAfterSerialisation: true,\n"
    if addition not in contract_text:
        if contract_text.count(marker) != 1:
            raise RuntimeError("transport contract marker changed")
        contract_text = contract_text.replace(marker, addition, 1)
    contract.write_text(contract_text, encoding="utf-8")

    def patch_registry(document: dict) -> None:
        rows = document.get("cartridges", [])
        transport = next((row for row in rows if row.get("id") == "streaming-parquet-bridge"), None)
        if transport is None:
            raise RuntimeError("transport cartridge missing from registry")
        transport["sha256"] = digest
        capabilities = transport.setdefault("capabilities", [])
        if "payload-cache-release-after-serialisation" not in capabilities:
            capabilities.append("payload-cache-release-after-serialisation")

    patch_registry(current)
    patch_registry(manifest)
    manifest.setdefault("acceptance", {})["bridge_payload_cache_released_after_serialisation"] = True
    current.setdefault("transport", {})["payload_cache"] = "RELEASE_AFTER_SERIALISATION"
    report["transport_sha256"] = digest
    report["payload_cache_released_after_serialisation"] = True

    dump(current_path, current)
    dump(manifest_path, manifest)
    dump(report_path, report)
    print(json.dumps({
        "schema": "gridatlas.streaming-payload-release.v1",
        "generation": generation,
        "cartridge": str(cartridge.relative_to(ROOT)),
        "sha256": digest,
        "status": "PATCHED",
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
