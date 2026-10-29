#!/usr/bin/env python3
"""DC-B1: the offtakers data file with one correction from DC-A6 (reports/DC-A6.md item 1): OT-B-0823 Marchwood Power
Station is a gas CCGT (its own GPPD record GBR1000311: fuel Gas, 842 MW, CC BY 4.0), not biomass. Byte-level: the
subclass "biomass" -> "gas_ccgt_large" (the class's existing CCGT subclass, every other one >= 395 MW) in that one feature, and a
top-level "corrections" record after "generation"; every other byte is the input's. Deterministic.
usage: fix_marchwood.py IN OUT"""
import json, sys, hashlib
src = open(sys.argv[1], 'rb').read()
old = b'"id":"OT-B-0823","class":"B","class_label":"Power station","subclass":"biomass",'
assert src.count(old) == 1
out = src.replace(old, old.replace(b'"biomass"', b'"gas_ccgt_large"'))
g = b'"generation":"OT-filter-2026-10-29+R-otdata",'
assert out.count(g) == 1
corr = {'id': 'OT-B-0823', 'field': 'subclass', 'from': 'biomass', 'to': 'gas_ccgt_large', 'basis': 'its GPPD v1.3.0 record GBR1000311 (fuel Gas, 842 MW, CC BY 4.0); DC-A6 reconciliation, GridAtlas issue #73 step 5', 'input_sha256': hashlib.sha256(src).hexdigest()}
out = out.replace(g, b'"generation":"OT-filter-2026-10-29+R-otdata+DC-B1-marchwood","corrections":[' + json.dumps(corr, separators=(',', ':')).encode() + b'],')
d = json.loads(out)
m = [f for f in d['features'] if f['properties']['id'] == 'OT-B-0823'][0]['properties']
assert m['subclass'] == 'gas_ccgt_large' and len(d['features']) == 1568
open(sys.argv[2], 'wb').write(out)
print(hashlib.sha256(out).hexdigest(), len(out))
