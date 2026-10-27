# Builds fixtures/SYNTHETIC-hourly-parts from the lead's genuine lightning-archive fixture.
# Only change: day 2026-10-23 (189 genuine flashes) is split into hourly part files days/2026/10/23/HH.json;
# its index row gets path=null and a 'parts' list with per-part count/bytes/sha256. SYNTHETIC, never publish.
import json, hashlib, shutil, os, sys, collections
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data')
dst = os.path.join(here, 'fixtures', 'SYNTHETIC-hourly-parts', 'data')
if os.path.exists(os.path.dirname(dst)): shutil.rmtree(os.path.dirname(dst))
shutil.copytree(src, dst)
dayp = os.path.join(dst, 'history', 'days', '2026', '10', '23.json')
day = json.load(open(dayp)); os.remove(dayp)
by = collections.defaultdict(list)
for f in day['features']: by[int(f['properties']['time_utc'][11:13])].append(f)
os.makedirs(os.path.join(dst, 'history', 'days', '2026', '10', '23'))
parts = []
for h in sorted(by):
    o = {'schema': day['schema'], 'type': 'FeatureCollection', 'metadata': dict(day['metadata'], count=len(by[h]), hour_utc=h), 'features': by[h]}
    b = json.dumps(o, separators=(',', ':')).encode()
    rel = 'days/2026/10/23/%02d.json' % h
    open(os.path.join(dst, 'history', rel), 'wb').write(b)
    parts.append({'hour': h, 'path': rel, 'count': len(by[h]), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
ip = os.path.join(dst, 'history', 'index.json'); idx = json.load(open(ip))
for r in idx['days']:
    if r['date'] == '2026-10-23':
        r['path'] = None; r['parts'] = parts; r['sha256'] = None; r['bytes'] = sum(p['bytes'] for p in parts)
        r['fixture_synthetic'] = 'flaky-network lane: split into hourly parts'
open(ip, 'w').write(json.dumps(idx, indent=1))
print(len(parts), 'parts', [p['hour'] for p in parts])
