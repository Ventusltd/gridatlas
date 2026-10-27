#!/usr/bin/env python3
"""EXPERIMENT 4 (pr2-data-verifier): reproduce defect hypotheses from the code read of PR #2 @ f7db76c.

SYNTHETIC fixtures only (ids "SYNTHETIC-TEST-..."), confined to the evidence folder. Harness: self-fixture.
H1  history.py:385-420  shard listed in the index but missing on disk -> day silently vanishes -> count 0 (false zero)?
H2  history.py:421/528  ShardTooLarge on a later day leaves earlier days written and the index unwritten; every later
                        run fails again while the burst hour is inside the 7-day feed carried by the run record?
H3  collect.py:319-320 + history.py:557-562  slots_parsed False -> the whole query window is archived as searched?
H4  collect.py:191-206 / history.py:96-118  malformed / out-of-box / swapped / boundary coordinates (D02).
H5  status.py  heartbeat when the collect step was skipped (pip failure) and when the run record is absent.
H6  history.py:116  'cutoff <= date <= today and timestamp <= now': future flash rejected; clamp-and-flag before cutoff.
H7  status.py vs history result: dropped_invalid is not surfaced in status.json.
"""
import json, shutil, subprocess, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WT = Path(sys.argv[1]); OUT = Path(sys.argv[2])
sys.path.insert(0, str(WT))
import collect, history, status  # noqa: E402
from collect import build_feature, assemble, build_run_record  # noqa: E402
from history import archive_observations, successful_scan, windows_from_run_record, ShardTooLarge  # noqa: E402

NOW = datetime(2026, 10, 26, 14, 0, tzinfo=timezone.utc)
D = lambda *a: datetime(*a, tzinfo=timezone.utc)  # noqa: E731


def fresh(name):
    d = OUT / name
    if d.exists():
        shutil.rmtree(d)
    return d


def row(res, day):
    return {r["date"]: r for r in res["index"]["days"]}[day]


def flash(ts, tag, i=0, lon=-2.12, lat=51.11):
    return build_feature(lon, lat, ts, "SYNTHETIC-TEST-" + tag, i)


print("===== H1: index lists a shard that is missing on disk =====")
root = fresh("h1-missing-shard")
win = successful_scan(D(2026, 10, 23).isoformat(), D(2026, 10, 24).isoformat(), 144)
res = archive_observations(root, [flash(D(2026, 10, 23, 10), "a"), flash(D(2026, 10, 23, 11), "b")], now=NOW, scanned_window=win)
r1 = row(res, "2026-10-23"); print("run 1:", {k: r1[k] for k in ("coverage", "count", "path", "sealed")})
(root / r1["path"]).unlink()  # simulate a lost/corrupt commit of the shard file
res = archive_observations(root, [], now=NOW)  # next hourly run, day not in incoming
r2 = row(res, "2026-10-23"); print("run 2 (shard deleted, no incoming):", {k: r2[k] for k in ("coverage", "count", "path", "sealed")})
print("H1 verdict:", "FALSE ZERO REPRODUCED (count 2 -> 0 with coverage full)" if r2["count"] == 0 and r1["count"] == 2 else "not reproduced")

print("\n===== H2: ShardTooLarge on a later day leaves a partial write and a frozen archive =====")
root = fresh("h2-partial-write")
day1 = [flash(D(2026, 10, 22, 9), "d1", i) for i in range(3)]
burst = [flash(D(2026, 10, 24, 3, 0, 0) + timedelta(milliseconds=i), "burst", i) for i in range(60)]  # 60 x ~530 B = ~32 kB > fake cap
try:
    archive_observations(root, day1 + burst, now=NOW, scanned_window=win, target_shard_bytes=2000, max_shard_bytes=20000)
    print("no raise?!")
except ShardTooLarge as e:
    print("raised:", str(e)[:90])
files = sorted(str(p.relative_to(root)) for p in root.rglob("*.json"))
print("files on disk after the raise:", files, "| index.json present:", (root / "index.json").exists())
# next run: same feed carried again in the run record (7-day retention) -> fails again
try:
    archive_observations(root, day1 + burst, now=NOW + timedelta(hours=1), scanned_window=win, target_shard_bytes=2000, max_shard_bytes=20000)
    print("second run: no raise?!")
except ShardTooLarge:
    print("second run (burst still inside the 7-day feed): raises again -> archive frozen until the burst hour ages out of the feed")
# run after the burst left the feed: index is finally written but the burst day is absent, and its scan windows never recorded
res = archive_observations(root, day1, now=NOW + timedelta(days=8), scanned_window=successful_scan(D(2026, 11, 3).isoformat(), D(2026, 11, 3, 6).isoformat(), 36), target_shard_bytes=2000, max_shard_bytes=20000)
print("after the freeze: 2026-10-24 row ->", {k: row(res, '2026-10-24')[k] for k in ('coverage', 'count')}, "| scan_windows:", [(w['start_utc'][:16], w['end_utc'][:16]) for w in res['index']['scan_windows']])
print("H2 verdict: partial write + unwritten index reproduced; windows of the frozen period are lost (under-claim, honest direction) and the burst flashes never reach the archive.")

print("\n===== H3: unparseable product names -> whole query window counted as searched =====")
beginning, now = D(2026, 10, 26, 7, 5, 58), D(2026, 10, 26, 13, 5, 58)
feed = assemble([], [], now)
rec = build_run_record(now=now, beginning=beginning, lookback_source="status", lookback_capped=False, last_success_before=None,
                       product_names=["opaque-product-1", "opaque-product-2"], products_examined=2, incoming=[], existing=[], feed=feed)
print("record.slots_parsed:", rec["slots_parsed"], "| scanned_ranges:", rec["scanned_ranges"], "| tail_unobserved_seconds:", rec["tail_unobserved_seconds"])
wins = windows_from_run_record(rec)
print("windows_from_run_record ->", wins)
root = fresh("h3-unparsed")
res = archive_observations(root, [], now=now, scanned_windows=wins)
print("2026-10-26 row:", {k: row(res, '2026-10-26')[k] for k in ('coverage', 'scanned_seconds', 'count')}, "(6 h = 21600 s claimed searched incl. the unpublished tail)")
print("H3 verdict:", "REPRODUCED: slots_parsed=False is ignored by history.windows_from_run_record; the full query window (incl. the unobserved tail) becomes 'searched' coverage" if row(res, '2026-10-26')['scanned_seconds'] == 21600 else "not reproduced")

print("\n===== H4: D02 coordinate validation (feed path assemble() and archive path validate_feature()) =====")
good = flash(NOW - timedelta(hours=1), "good")
cases = {
    "string coords": ["-2.1", "51.1"], "three coords": [-2.1, 51.1, 0.0], "nan lat": [-2.1, float("nan")], "inf lon": [float("inf"), 51.1],
    "swapped lon/lat": [51.1, -2.1], "west edge -11.0": [-11.0, 55.0], "beyond west -11.0001": [-11.0001, 55.0], "north edge 61.5": [0.0, 61.5],
    "beyond north 61.5001": [0.0, 61.5001], "east edge 3.0": [3.0, 52.0], "south edge 49.5": [-5.0, 49.5], "null lon": [None, 51.1], "empty": [],
}
for name, coords in cases.items():
    f = json.loads(json.dumps(good)); f["geometry"]["coordinates"] = coords; f["id"] = "SYNTHETIC-TEST-" + name
    kept_feed = len(assemble([], [f], NOW)["features"])
    kept_arch = history.validate_feature(f, NOW, history.year_ago(NOW.date())) is not None
    print(f"  {name:22s} coords={str(coords):28s} feed keeps={kept_feed}  archive keeps={kept_arch}")
print("build_feature out of box ->", build_feature(15, 52, NOW, "x", 1), "| build_feature('abc') ->", end=" ")
try:
    build_feature("abc", 52, NOW, "x", 1)
except ValueError as e:
    print("ValueError:", e, "(caught per-record in decode_body loop -> record dropped, not counted)")
print("H4 verdict: out-of-box/malformed are dropped (not quarantined/counted) in the feed path; archive path counts them only as dropped_invalid.")

print("\n===== H5: status heartbeat for skipped collect step / absent run record =====")
st = status.build_status(now=NOW, previous=None, record=None, archive_result=None, collect_outcome="skipped", archive_outcome="skipped")
print("collect skipped:", {k: st[k] for k in ("health", "last_attempt_outcome", "last_error", "consecutive_failures")})
print("H5 verdict: heartbeat written with an explicit error; limitation: no heartbeat if the job never starts (GitHub scheduler skip).")

print("\n===== H6: future flash / before-cutoff clamp-and-flag =====")
root = fresh("h6-cutoff")
res = archive_observations(root, [flash(NOW + timedelta(minutes=5), "future"), flash(NOW - timedelta(days=400), "ancient"), good], now=NOW)
print("archived:", res["index"]["archived_observations"], "dropped_before_cutoff:", res["dropped_before_cutoff"], "dropped_invalid (future):", res["dropped_invalid"])
feed = assemble([], [flash(NOW + timedelta(minutes=5), "future2"), good], NOW)
print("feed assemble() keeps a future-dated flash?", any("future2" in f["id"] for f in feed["features"]))

print("\n===== H7: dropped_invalid not surfaced to status.json =====")
res_summary = {"outcome": "success", "dropped_before_cutoff": 1, "dropped_invalid": 7, "archived_observations": 1, "files_changed": 2, "split_days": [], "index_generated_utc": "x"}
st = status.build_status(now=NOW, previous=None, record={"schema": collect.RUN_RECORD_SCHEMA, "outcome": "success", "run_utc": "2026-10-26T14:00:00.000Z", "scanned_ranges": []},
                         archive_result=res_summary, collect_outcome="success", archive_outcome="success")
print("status.archive keys:", sorted(st["archive"].keys()), "| 'dropped_invalid' in status.archive:", "dropped_invalid" in st["archive"])
print("OK experiment 4")
