#!/usr/bin/env python3
"""data-contract lane: run the COLLECTOR's own history.py (PR #2 == PR #3 bytes) on the REAL feed.

Harness: self-fixture, offline. EUMETSAT download cannot run here, so the run record is CONSTRUCTED
from the committed feed metadata (query window, products_examined) using collect.build_run_record,
with the examined range reconstructed by the seed file's own "one slot short" rule. Features are the
genuine flashes in the feed. Output is what history.py writes; nothing is hand-edited.
usage: build_archive.py <src tree> <feed.geojson> <seed.json> <out dir> <now ISO>
"""
import json, subprocess, sys, os
from pathlib import Path

SRC, FEED, SEED, OUT = (Path(a).resolve() for a in sys.argv[1:5]); NOW = sys.argv[5]
sys.path.insert(0, str(SRC))
sys.dont_write_bytecode = True
import collect  # noqa: E402

feed = json.loads(FEED.read_text())
m = feed["metadata"]
q0, q1 = collect.parse_utc(m["query_start_utc"]), collect.parse_utc(m["query_end_utc"])
rec = collect.build_run_record(now=q1, beginning=q0, lookback_source="explicit", lookback_capped=False,
                               last_success_before=None, product_names=[], products_examined=m["products_examined"],
                               incoming=[], existing=feed["features"], feed=feed)
# slot-parsed range: slots start HH:M0:09; the slot containing query end is unpublished (seed rule)
end = q1.replace(minute=(q1.minute // 10) * 10, second=9, microsecond=0)
if end > q1:
    from datetime import timedelta
    end -= timedelta(minutes=10)
rec["scanned_ranges"] = [{"start_utc": collect.iso_utc(q0), "end_utc": collect.iso_utc(end)}]
rec["scanned_end_utc"] = collect.iso_utc(end)
rec["slots_parsed"] = True
rec["_data_contract_note"] = "CONSTRUCTED run record from committed feed metadata; flashes genuine"
OUT.mkdir(parents=True, exist_ok=True)
rr = OUT / "run-record.constructed.json"
rr.write_text(json.dumps(rec, indent=1) + "\n")
arch = OUT / "data" / "history"
env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
for cmd in ([sys.executable, str(SRC / "history.py"), "ingest", "--archive-dir", str(arch), "--run-record", str(rr),
             "--seed-scan-windows", str(SEED), "--result-out", str(OUT / "ingest-result.json"), "--now", NOW],
            [sys.executable, str(SRC / "history.py"), "verify", "--archive-dir", str(arch)]):
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=str(OUT), env=env)
    print("$", " ".join(cmd[1:3]), "->", p.returncode, p.stdout.strip()[-400:], p.stderr.strip()[-400:])
    assert p.returncode == 0
(OUT / "data" / "uk_lightning.geojson").write_bytes(FEED.read_bytes())
