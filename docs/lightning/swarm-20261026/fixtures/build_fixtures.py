#!/usr/bin/env python3
"""Build the local lightning-archive fixtures for GridAtlas phase-4 tests.

Every point in every fixture is a genuine EUMETSAT observation taken unchanged
from data/uk_lightning.geojson (408 flashes, 21-25 Oct 2026). The archive is
produced by running the branch's history.py over those flashes with the 17
search windows reconstructed from the committed feed history, so per-day
coverage is honest (some days partial). The broken variants alter only index
fields and are labelled inside the files; no point is ever fabricated.

Usage: python3 build_fixtures.py <worktree> <fixtures dir> [--now ISO-8601Z]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("worktree", type=Path)
    parser.add_argument("fixtures", type=Path)
    parser.add_argument("--now", default=None)
    args = parser.parse_args()
    wt = args.worktree.resolve()
    sys.path.insert(0, str(wt))
    from collect import parse_utc  # noqa: E402
    from history import archive_observations, load_seed_windows  # noqa: E402
    from status import build_status  # noqa: E402

    now = parse_utc(args.now) if args.now else datetime.now(timezone.utc).replace(microsecond=0)
    fixtures = args.fixtures.resolve()
    feed_path = wt / "data" / "uk_lightning.geojson"
    feed = json.loads(feed_path.read_text(encoding="utf-8"))
    seeds = load_seed_windows(wt / "data" / "seed_scan_windows.json")
    assert len(feed["features"]) == 408, len(feed["features"])

    good = fixtures / "lightning-archive" / "data"
    for name in ("lightning-archive", "lightning-archive-broken-json", "lightning-archive-missing-shard",
                 "lightning-archive-no-index", "lightning-archive-stale", "lightning-archive-big-count"):
        shutil.rmtree(fixtures / name, ignore_errors=True)
    good.mkdir(parents=True)
    shutil.copyfile(feed_path, good / "uk_lightning.geojson")

    # The genuine archive: 408 flashes sliced by UTC day, coverage from the reconstructed windows.
    last = seeds[-1]
    result = archive_observations(good / "history", feed["features"], now=now, seed_scan_windows=seeds, lookback_hours=3.0)
    index = result["index"]
    assert index["archived_observations"] == 408
    record = {
        "schema": "uk-lightning-run-record.v1", "run_utc": feed["metadata"]["query_end_utc"], "outcome": "success", "error": None,
        "query_start_utc": feed["metadata"]["query_start_utc"], "query_end_utc": feed["metadata"]["query_end_utc"],
        "lookback_hours": 3.0, "lookback_source": "explicit", "lookback_capped": False,
        "products_examined": feed["metadata"]["products_examined"], "slots_examined": feed["metadata"]["products_examined"],
        "slots_examined_utc": [], "scanned_ranges": [{"start_utc": last["start_utc"], "end_utc": last["end_utc"]}],
        "unscanned_ranges": [], "tail_unobserved_seconds": int((parse_utc(feed["metadata"]["query_end_utc"]) - parse_utc(last["end_utc"])).total_seconds()),
        "incoming_features": 0, "feed_features": 408, "feed_total_before_display_cap": 408,
        "feed_latest_detection_utc": feed["metadata"]["latest_detection_utc"],
    }
    status = build_status(now=now, previous=None, record=record, archive_result={
        "outcome": "success", "archived_observations": 408, "files_changed": result["files_changed"],
        "index_generated_utc": index["generated_utc"]}, collect_outcome="success", archive_outcome="success")
    (good / "status.json").write_text(json.dumps(status, indent=1) + "\n", encoding="utf-8")

    def clone(name: str) -> Path:
        target = fixtures / name / "data"
        shutil.copytree(good, target)
        return target

    # 1. index.json is not JSON (an HTML error page), shards intact.
    broken = clone("lightning-archive-broken-json")
    (broken / "history" / "index.json").write_text(
        "<!doctype html><html><head><title>502 Bad Gateway</title></head><body>FIXTURE: deliberately not JSON</body></html>\n")

    # 2. The index lists 2026-10-23 (189 flashes) but its shard is absent -> HTTP 404 for that day only.
    missing = clone("lightning-archive-missing-shard")
    (missing / "history" / "days" / "2026" / "10" / "23.json").unlink()

    # 3. Only the live feed exists (archive not yet published -> fallback path).
    no_index = fixtures / "lightning-archive-no-index" / "data"
    no_index.mkdir(parents=True)
    shutil.copyfile(feed_path, no_index / "uk_lightning.geojson")

    # 4. Stale: generated 9 h before the build time; shards real.
    stale = clone("lightning-archive-stale")
    stale_index = json.loads((stale / "history" / "index.json").read_text())
    shifted = now - timedelta(hours=9)
    stale_index["generated_utc"] = shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    stale_index["next_update_due_utc"] = (shifted + timedelta(hours=3)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    stale_index["fixture_note"] = "SYNTHETIC generated_utc/next_update_due_utc (9 h before the build time); every point is genuine"
    stale_index["fixture_synthetic_fields"] = ["generated_utc", "next_update_due_utc"]
    (stale / "history" / "index.json").write_text(json.dumps(stale_index, separators=(",", ":"), ensure_ascii=False) + "\n")

    # 5. Big count: the 30-day window sums to exactly 120,000 flashes / 48,000,000 bytes in the index
    #    while the shards stay the real small ones (overview gate without fabricated points).
    big = clone("lightning-archive-big-count")
    big_index = json.loads((big / "history" / "index.json").read_text())
    rows = {row["date"]: row for row in big_index["days"]}
    others_count = sum(r["count"] for d, r in rows.items() if d != "2026-10-23" and r["count"])
    others_bytes = sum(r["bytes"] for d, r in rows.items() if d != "2026-10-23" and r["bytes"])
    target = rows["2026-10-23"]
    target["fixture_synthetic_fields"] = ["count", "bytes"]
    target["fixture_real_count"] = target["count"]
    target["fixture_real_bytes"] = target["bytes"]
    target["count"] = 120_000 - others_count
    target["bytes"] = 48_000_000 - others_bytes
    big_index["fixture_note"] = ("SYNTHETIC count/bytes on the 2026-10-23 row so that the last-30-day window sums to 120,000 "
                                 "flashes and 48,000,000 bytes; the shard at that path is the real one (189 flashes). "
                                 "archived_observations keeps the genuine 408.")
    (big / "history" / "index.json").write_text(json.dumps(big_index, separators=(",", ":"), ensure_ascii=False) + "\n")

    # Manifest of every fixture file.
    lines = []
    for file in sorted(fixtures.rglob("*")):
        if file.is_file() and file.name not in ("MANIFEST.sha256",) and file.suffix != ".py" and file.name != "README.md":
            lines.append(f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(fixtures).as_posix()}")
    (fixtures / "MANIFEST.sha256").write_text("\n".join(lines) + "\n")

    summary = {
        "built_utc": now.isoformat().replace("+00:00", "Z"),
        "generated_utc": index["generated_utc"],
        "archived_observations": index["archived_observations"],
        "days": [{k: r[k] for k in ("date", "coverage", "scanned_seconds", "count", "bytes", "sealed", "path")}
                 for r in index["days"] if r["coverage"] != "none"],
        "big_count_row": {k: rows["2026-10-23"][k] for k in ("count", "bytes", "fixture_real_count", "fixture_real_bytes")},
        "stale_generated_utc": stale_index["generated_utc"],
        "files": len(lines),
    }
    print(json.dumps(summary, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
