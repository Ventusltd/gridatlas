#!/usr/bin/env python3
"""EXPERIMENT 3 (pr2-data-verifier): D12 storm-day stress on PR #2 history.py.

ALL FEATURES HERE ARE SYNTHETIC TEST FIXTURES (ids start with "SYNTHETIC-TEST-"); they live only
under the verifier's evidence folder and are never published. Harness: self-fixture, offline.
Case A: 100,000 flashes spread uniformly over one UTC day (real feature shape, real constants).
Case B: 100,000 flashes inside ONE hour (burst) - what happens at the 25 MB hard cap.
Case C: the largest single-hour burst that still fits (binary search on count).
"""
import hashlib, json, shutil, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

WT = Path(sys.argv[1]); OUT = Path(sys.argv[2])
sys.path.insert(0, str(WT))
from collect import build_feature  # noqa: E402
import history  # noqa: E402
from history import MAX_SHARD_BYTES, TARGET_SHARD_BYTES, ShardTooLarge, archive_observations, successful_scan, verify_archive  # noqa: E402

NOW = datetime(2026, 10, 26, 14, 0, tzinfo=timezone.utc)
DAY = datetime(2026, 10, 24, tzinfo=timezone.utc)
PRODUCT = ("SYNTHETIC-TEST-W_XX-EUMETSAT-Darmstadt,IMG+SAT,MTI1+LI-2-LFL--FD--x-x--ARC-x_C_EUMT_20261024010026_L2PF_OPE_"
           "20261024000009_20261024001009_N__O_0001_0000")


def synth(n, span_seconds):
    step = span_seconds / n
    return [build_feature(-2.0 + (i % 1000) / 1000, 51.0 + (i // 1000) / 1000, DAY + timedelta(seconds=i * step), PRODUCT, i) for i in range(n)]


def fresh(name):
    d = OUT / name
    if d.exists():
        shutil.rmtree(d)
    return d


print("constants: MAX_SHARD_BYTES", MAX_SHARD_BYTES, "TARGET_SHARD_BYTES", TARGET_SHARD_BYTES)
# --- Case A: 100k uniform over the day ---
root = fresh("caseA-100k-uniform")
feats = synth(100_000, 86400)
t0 = time.time()
res = archive_observations(root, feats, now=NOW, scanned_window=successful_scan(DAY.isoformat(), (DAY + timedelta(days=1)).isoformat(), 144))
dt = time.time() - t0
row = {r["date"]: r for r in res["index"]["days"]}["2026-10-24"]
parts = row["parts"]
print(f"A: {dt:.1f}s, split_days={res['split_days']}, count={row['count']}, bytes(sum)={row['bytes']:,}, path={row['path']}, sha256={row['sha256']}, parts={len(parts)}")
print(f"A: part bytes min={min(p['bytes'] for p in parts):,} max={max(p['bytes'] for p in parts):,}; all <= 25,000,000: {all(p['bytes'] <= MAX_SHARD_BYTES for p in parts)}; any > 8 MiB target: {any(p['bytes'] > TARGET_SHARD_BYTES for p in parts)}")
print("A: part keys:", list(parts[0].keys()))
for p in parts:
    raw = (root / p["path"]).read_bytes()
    assert len(raw) == p["bytes"] and hashlib.sha256(raw).hexdigest() == p["sha256"], p["path"]
    shard = json.loads(raw)
    assert shard["metadata"]["hour_utc"] == p["hour"] and shard["metadata"]["part_of_day"] is True and shard["metadata"]["count"] == p["count"] == len(shard["features"])
    assert all(f["properties"]["time_utc"][11:13] == p["hour"] for f in shard["features"])
assert sum(p["count"] for p in parts) == 100_000 and sum(p["bytes"] for p in parts) == row["bytes"]
print("A: every part verified (bytes, sha256, hour_utc, part_of_day, counts); verify_archive:", verify_archive(root))
idx_bytes = len(json.dumps(res["index"], separators=(",", ":")).encode())
print(f"A: index.json size with one 24-part day: {idx_bytes:,} bytes")
# idempotent re-run
res2 = archive_observations(root, feats[:10], now=NOW)
print("A: re-ingest of 10 known ids -> files_changed", res2["files_changed"], "(index only expected = 1)")

# --- Case B: 100k in one hour ---
root = fresh("caseB-100k-one-hour-burst")
feats = synth(100_000, 3600)
try:
    archive_observations(root, feats, now=NOW, scanned_window=successful_scan(DAY.isoformat(), (DAY + timedelta(days=1)).isoformat(), 144))
    print("B: UNEXPECTED success")
except ShardTooLarge as e:
    print("B: ShardTooLarge raised ->", str(e)[:160])
print("B: files written before the raise:", sorted(str(p.relative_to(root)) for p in root.rglob('*')) if root.exists() else "none (dir absent)")

# --- Case C: largest one-hour burst that fits in 25 MB ---
lo, hi = 10_000, 100_000
while hi - lo > 500:
    mid = (lo + hi) // 2
    content = history._serialise(history._day_collection("2026-10-24", synth(mid, 3600), hour=0))
    if len(content.encode()) > MAX_SHARD_BYTES:
        hi = mid
    else:
        lo = mid
print(f"C: one-hour burst capacity at the real shape: ~{lo:,} flashes per hour before ShardTooLarge (25 MB)")
print(f"C: whole-day single-file capacity (8 MiB target): ~{TARGET_SHARD_BYTES // 531:,} flashes; split kicks in above that")
# ratio per feature in the synthetic shape
content = history._serialise(history._day_collection("2026-10-24", synth(1000, 3600), hour=0))
print(f"C: synthetic shape bytes/feature: {len(content.encode()) / 1000:.1f}")
print("OK experiment 3 (synthetic fixtures only)")
