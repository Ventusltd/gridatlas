#!/usr/bin/env python3
"""Rebuild and print a compact summary + conflict list (used by the 10-minute poll)."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
r = subprocess.run([sys.executable, os.path.join(HERE, "dcingest.py")], capture_output=True, text=True)
print(r.stdout[-3000:] if r.returncode else "", r.stderr[-3000:])
if r.returncode: sys.exit("BUILD FAILED")
d = json.load(open(os.path.join(HERE, "uk_datacentre_pipeline.geojson")))
m = d["metadata"]
print(json.dumps({"inputs": m["inputs"], "summary": m["summary"]}, indent=1))
for f in d["features"]:
    p = f["properties"]
    for c in p["conflicts"]:
        print("CONFLICT", p["id"], p["name"][:40], c["kind"], c["field"],
              [(v["value"], v["source_id"].split(":")[0]) for v in c["values"]][:6])
