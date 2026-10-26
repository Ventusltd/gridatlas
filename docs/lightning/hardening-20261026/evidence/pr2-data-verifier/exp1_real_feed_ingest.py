#!/usr/bin/env python3
"""EXPERIMENT 1 (pr2-data-verifier): run PR #2 history.py on the REAL 408-flash feed.

Harness: self-fixture, offline. The collector download cannot run here (no EUMETSAT
credentials, netCDF4/eumdac absent), so the run record is CONSTRUCTED from the real feed
and its committed metadata exactly as collect.build_run_record would shape it, using the
real product names present in the 408 feature ids. It is labelled as such. Nothing is
written outside the evidence folder.
"""
import hashlib, json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

WT = Path(sys.argv[1])          # PR #2 worktree (read-only)
OUT = Path(sys.argv[2])         # evidence output dir
sys.path.insert(0, str(WT))
import collect, history  # noqa: E402  (PR #2 code under test)

OUT.mkdir(parents=True, exist_ok=True)
feed = json.loads((WT / "data/uk_lightning.geojson").read_text(encoding="utf-8"))
meta = feed["metadata"]
features = feed["features"]
assert len(features) == 408, len(features)
now = collect.parse_utc(meta["query_end_utc"])          # 2026-10-26T13:05:58.649Z (real run end)
beginning = collect.parse_utc(meta["query_start_utc"])  # 2026-10-26T10:05:58.649Z
# Real product names: the id prefix before ':' of every feature (products that had UK flashes).
# The last run (10:05-13:05 UTC) had 18 products but none with UK flashes, so for the run's
# scanned range we use the seed file's reconstruction for commit 21c3e567 (what the collector
# would have recorded: slots 10:00:09 .. 13:00:09, 18 products).
seed = json.loads((WT / "data/seed_scan_windows.json").read_text())
last = [w for w in seed["scan_windows"] if w["feed_commit"] == "21c3e567"][0]
record = collect.build_run_record(
    now=now, beginning=beginning, lookback_source="explicit", lookback_capped=False,
    last_success_before=None, product_names=[], products_examined=meta["products_examined"],
    incoming=[], existing=features, feed=feed,
)
# build_run_record with no parseable names falls back to the whole query window (slots_parsed False);
# replace with the reconstructed examined-slot range so the record matches a real slot-parsed run.
record["scanned_ranges"] = [{"start_utc": last["start_utc"], "end_utc": last["end_utc"]}]
record["scanned_end_utc"] = last["end_utc"]
record["slots_parsed"] = True
record["slots_examined"] = 18
record["lookback_hours"] = 3.0
record["_verifier_note"] = ("CONSTRUCTED by pr2-data-verifier from the committed feed metadata of 21c3e56; "
                            "not a live collector output. Features are the 408 genuine flashes.")
rr = OUT / "run-record.constructed.json"
rr.write_text(json.dumps(record) + "\n")

archive = OUT / "archive"
if archive.exists():
    import shutil; shutil.rmtree(archive)
result_out = OUT / "archive-result.json"
cmd = [sys.executable, str(WT / "history.py"), "ingest", "--archive-dir", str(archive), "--run-record", str(rr),
       "--seed-scan-windows", str(WT / "data/seed_scan_windows.json"), "--result-out", str(result_out),
       "--now", now.isoformat()]
print("$", " ".join(cmd))
p = subprocess.run(cmd, capture_output=True, text=True, cwd=str(WT))
print(p.stdout, p.stderr, "exit", p.returncode)
assert p.returncode == 0

index = json.loads((archive / "index.json").read_text())
print("schema:", index["schema"], "| has 'version' key:", "version" in index)
print("rows:", len(index["days"]), index["days"][0]["date"], "->", index["days"][-1]["date"], "| cutoff", index["cutoff_date_utc"])
# one row per UTC date, contiguous
from datetime import date, timedelta
d0 = date.fromisoformat(index["days"][0]["date"])
assert [r["date"] for r in index["days"]] == [(d0 + timedelta(days=i)).isoformat() for i in range(len(index["days"]))]
keys = [list(r.keys()) for r in index["days"]]
print("row key sets:", sorted({tuple(k) for k in keys}, key=len))
# invariants
for r in index["days"]:
    assert (r["count"] is None) == (r["coverage"] == "none"), r
    if r["count"] == 0:
        assert r["scanned_seconds"] > 0, r
    if r["coverage"] == "none":
        assert r["bytes"] is None and r["path"] is None and r["sha256"] is None, r
    if r["count"]:
        assert r["path"] or r.get("parts"), r
    assert 0 <= r["scanned_seconds"] <= 86400
    assert isinstance(r["sealed"], bool)
# bytes/sha256 vs disk
checked = 0
for r in index["days"]:
    targets = [(r["path"], r["bytes"], r["sha256"])] if r["path"] else [(p["path"], p["bytes"], p["sha256"]) for p in r.get("parts") or []]
    for rel, nbytes, sha in targets:
        raw = (archive / rel).read_bytes()
        assert len(raw) == nbytes, (rel, len(raw), nbytes)
        assert hashlib.sha256(raw).hexdigest() == sha, rel
        shard = json.loads(raw)
        assert shard["schema"] == "uk-lightning-history-day.v1" and shard["type"] == "FeatureCollection"
        assert shard["metadata"]["date_utc"] == r["date"] and shard["metadata"]["count"] == len(shard["features"]) == r["count"]
        assert list(shard["metadata"].keys()) == ["date_utc", "source", "observation", "count", "first_observation_utc", "last_observation_utc"], shard["metadata"].keys()
        checked += 1
print("shards checked against index bytes/sha256:", checked)
# files on disk not in the index?
on_disk = sorted(str(p.relative_to(archive)) for p in archive.rglob("*.json") if p.name != "index.json")
listed = sorted([r["path"] for r in index["days"] if r["path"]] + [p["path"] for r in index["days"] for p in r.get("parts") or []])
assert on_disk == listed, (on_disk, listed)
print("day files on disk == listed:", on_disk)
print("per-day rows with coverage != none:")
for r in index["days"]:
    if r["coverage"] != "none":
        print(f'  {r["date"]} cov={r["coverage"]:7s} scanned={r["scanned_seconds"]:6d} ({r["scanned_seconds"]/864:.1f}%) count={r["count"]} sealed={r["sealed"]} bytes={r["bytes"]} path={r["path"]}')
print("archived_observations", index["archived_observations"], "scanned_days", index["scanned_days"],
      "archived_days_with_flashes", index["archived_days_with_flashes"])
print("scan_windows:", len(index["scan_windows"]), "coverage_start", index["coverage_start_utc"], "last_scan_end", index["last_successful_scan_end_utc"])
print("first/last obs", index["first_observation_utc"], index["last_observation_utc"])
print("next_update_due_utc", index["next_update_due_utc"], "generated", index["generated_utc"])
# the verify subcommand
p = subprocess.run([sys.executable, str(WT / "history.py"), "verify", "--archive-dir", str(archive)], capture_output=True, text=True, cwd=str(WT))
print("verify:", p.stdout.strip(), p.stderr.strip(), "exit", p.returncode)
# bytes per feature of the real shape
total_feat = sum(r["count"] or 0 for r in index["days"]); total_bytes = sum(r["bytes"] or 0 for r in index["days"])
print(f"real shape: {total_bytes} bytes / {total_feat} features = {total_bytes/total_feat:.1f} bytes per feature (incl. metadata)")
(OUT / "index.copy.json").write_text(json.dumps(index, indent=1))
print("OK experiment 1")
