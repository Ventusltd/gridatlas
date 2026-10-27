"""Z1 probe: archive with no searched time. Prints what the store publishes."""
import json, os, sys, tempfile, time
from pathlib import Path
WT = Path(os.environ["WT"]); sys.path[:0] = [str(WT), str(WT / "tests")]
import history, parquet_store as ps, verify_parquet as vp
import pyarrow.parquet as pq
from test_parquet_store import NOW
t0 = time.time()
with tempfile.TemporaryDirectory() as d:
    a = Path(d) / "history"
    history.archive_observations(a, [], now=NOW)
    print("archived", round(time.time()-t0,1), "s"); sys.stdout.flush()
    idx = json.loads((a / "index.json").read_text())
    print("index days:", len(idx["days"]), [ (r["date"], r["coverage"]) for r in idx["days"][:3]])
    s = Path(d) / "parquet"
    ps.build(a, s, run_id="r", synthetic=True)
    print("built", round(time.time()-t0,1), "s"); sys.stdout.flush()
    print("verify:", vp.verify(a, s, allow_synthetic=True))
    r = pq.read_table(s / "rollups/substation_optical_flash_proximity.parquet").to_pylist()[0]
    print("prox row:", {k: r[k] for k in ("optical_flash_proximity_10km", "hours_observed", "hours_expected", "count_state")})
    h = json.loads((s / "rollups/headline.json").read_text())
    print("headline archive:", h["archive"]["flashes"], h["archive"]["hours_observed"], h["archive"]["hours_expected"], h["archive"]["count_state"])
    print("headline substations:", h["substations"]["count_state"], h["substations"]["with_any_within_10km"])
