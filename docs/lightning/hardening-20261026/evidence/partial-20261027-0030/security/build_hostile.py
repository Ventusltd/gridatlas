# build_hostile.py -- SYNTHETIC hostile fixtures for the security lane. Never publish.
# Base: lead's genuine fixture lightning/fixtures/lightning-archive/data (copied, then mutated).
import json, shutil, sys, os, random, hashlib
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data'))
FX = os.path.join(HERE, 'fixtures')
XSS = '<img src=x onerror="window.__PWN=(window.__PWN||0)+1"><script>window.__PWN=99</script>"\'><svg onload=window.__PWN=7>'
def base(name):
    d = os.path.join(FX, name, 'data'); shutil.rmtree(os.path.join(FX, name), ignore_errors=True); shutil.copytree(SRC, d); return d
def ld(p): return json.load(open(p))
def dump(p, o): open(p, 'w').write(json.dumps(o, separators=(',', ':')))
def idxp(d): return os.path.join(d, 'history', 'index.json')
def feedp(d): return os.path.join(d, 'uk_lightning.geojson')
def row(ix, date): return next(r for r in ix['days'] if r['date'] == date)
def feat(i, t, lon=-1.5, lat=53.0, fid=True):
    f = {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}, 'properties': {'time_utc': t, 'observation_kind': 'optical_lightning_flash'}}
    if fid: f['id'] = 'SYN-%d' % i
    return f
which = sys.argv[1:] or ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S4c', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']

if 'S1' in which:  # XSS strings in every field the module echoes; index invalid so the feed path renders ie + metadata
    d = base('S1-xss'); ix = ld(idxp(d)); ix['days'][0]['date'] = XSS; ix['fixture_synthetic'] = 'S1 days[0].date = XSS'; dump(idxp(d), ix)
    fd = ld(feedp(d)); m = fd['metadata']
    for k in ('query_end_utc', 'query_start_utc', 'latest_detection_utc', 'status', 'source'): m[k] = XSS
    fd['features'] = [feat(i, '2026-10-26T1%d:00:00Z' % i) for i in range(5)]
    for f in fd['features']: f['id'] = XSS + f['id']; f['properties'][XSS] = XSS; f['properties']['name'] = XSS
    dump(feedp(d), fd)
if 'S2' in which:  # XSS in schema (second echo path)
    d = base('S2-xss-schema'); ix = ld(idxp(d)); ix['schema'] = XSS; dump(idxp(d), ix)
if 'S3' in which:  # prototype pollution keys at every level; index stays valid
    d = base('S3-proto'); raw = open(idxp(d)).read()
    P = '"__proto__":{"polluted":"idx","count":7,"path":"../../evil.json","sealed":true},"constructor":{"prototype":{"polluted":"ctor"}},'
    raw = raw.replace('{"schema"', '{' + P + '"schema"', 1).replace('{"date":"2026-10-25"', '{' + P + '"date":"2026-10-25"', 1)
    open(idxp(d), 'w').write(raw)
    fd = open(feedp(d)).read().replace('"properties":{', '"properties":{"__proto__":{"polluted":"feat"},"constructor":{"prototype":{"polluted":"fc"}},')
    open(feedp(d), 'w').write(fd)
    dp = os.path.join(d, 'history', 'days', '2026', '10', '25.json')  # day file mutated -> recompute index bytes/sha so it is accepted
    s = open(dp).read().replace('"properties":{', '"properties":{"__proto__":{"polluted":"day"},', ); open(dp, 'w').write(s)
    b = s.encode(); ix = json.loads(open(idxp(d)).read())
    raw = open(idxp(d)).read()
    r = row(ix, '2026-10-25'); raw = raw.replace('"bytes":%d' % r['bytes'], '"bytes":%d' % len(b), 1).replace(r['sha256'], hashlib.sha256(b).hexdigest(), 1)
    open(idxp(d), 'w').write(raw)
if 'S4a' in which:  # count = 1e999 (JSON.parse -> Infinity) on the in-window row
    d = base('S4a-count-inf'); ix = ld(idxp(d)); r = row(ix, '2026-10-25'); r['count'] = 123456789
    open(idxp(d), 'w').write(json.dumps(ix, separators=(',', ':')).replace('"count":123456789', '"count":1e999'))
if 'S4b' in which:  # count as a string, -0, true
    d = base('S4b-count-types'); ix = ld(idxp(d)); r = row(ix, '2026-10-25'); r['count'] = str(r['count'])
    r24 = row(ix, '2026-10-24'); r24['count'] = True
    dump(idxp(d), ix)
if 'S4c' in which:  # extreme numbers / dates in index header and scan windows
    d = base('S4c-extreme-header'); ix = ld(idxp(d))
    ix['collection_interval_hours'] = 1e308; ix['generated_utc'] = '-271821-04-20T00:00:00.000Z'; ix['next_update_due_utc'] = '+275760-09-13T00:00:00.000Z'
    ix['coverage_start_utc'] = 'garbage'; ix['cutoff_date_utc'] = '2025-99-99'
    for w in ix['scan_windows']: w['successful_runs'] = 1e308
    dump(idxp(d), ix)
if 'S5' in which:  # parts[] with traversal / absolute / protocol-relative / encoded / query paths
    d = base('S5-parts-traversal'); ix = ld(idxp(d)); r = row(ix, '2026-10-26')
    paths = ['../../../../../evil-owner/evil-repo/main/x.json', 'https://evil.example/abs.json', '//evil.example/proto-rel.json',
             '%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/enc-owner/enc-repo/main/enc.json', '..\\..\\..\\..\\..\\bs-owner\\bs-repo\\main\\bs.json',
             'days/2026/10/26/05.json?q=1#frag', '@evil.example/at.json']
    r.update(coverage='full', scanned_seconds=86400, count=7, path=None, bytes=None, sha256=None, sealed=False,
             parts=[{'hour': '%02d' % (i + 1), 'path': p, 'count': 1, 'bytes': 10, 'sha256': '0' * 64} for i, p in enumerate(paths)])
    dump(idxp(d), ix)
if 'S6' in which:  # 20,000 parts with no count/bytes: index budget sums to 0 -> every part fetched
    d = base('S6-parts-flood'); ix = ld(idxp(d)); r = row(ix, '2026-10-26')
    r.update(coverage='full', scanned_seconds=86400, count=1, path=None, bytes=None, sha256=None, sealed=False,
             parts=[{'hour': '00', 'path': 'days/2026/10/26/flood-%05d.json' % i} for i in range(20000)])
    dump(idxp(d), ix)
if 'S7' in which:  # ~1.2M index rows (~85 MB): main-thread JSON.parse + Map + forEach
    d = base('S7-giant-index'); ix = ld(idxp(d)); extra = ['{"date":"1900-01-01","coverage":"none","count":null,"sealed":true}'] * 1200000
    s = json.dumps(ix, separators=(',', ':')); s = s.replace('"days":[', '"days":[' + ','.join(extra) + ',', 1); open(idxp(d), 'w').write(s)
if 'S8' in which:  # 250,000 scan_windows -> Math.max(...spread) RangeError
    d = base('S8-scanwindow-spread'); ix = ld(idxp(d))
    ix['scan_windows'] = ix['scan_windows'] + [{'start_utc': '2026-10-26T00:00:00Z', 'end_utc': '2026-10-26T00:00:01Z', 'successful_runs': 1}] * 250000
    dump(idxp(d), ix)
if 'S9' in which:  # no index + live feed with 300,000 valid in-window points (feed has no budget)
    d = base('S9-giant-feed'); os.remove(idxp(d)); fd = ld(feedp(d)); random.seed(1)
    fd['features'] = [feat(i, '2026-10-26T%02d:%02d:%02dZ' % (6 + i % 12, i % 60, (i // 60) % 60), -10 + 12 * random.random(), 50 + 11 * random.random()) for i in range(300000)]
    dump(feedp(d), fd)
if 'S10' in which:  # no index + feed: 20 valid features, one with 1,000,000 coordinates, and 30 valid features without id
    d = base('S10-feed-coords-ids'); os.remove(idxp(d)); fd = ld(feedp(d))
    good = [feat(i, '2026-10-26T1%d:00:00Z' % (i % 8)) for i in range(20)]
    noid = [feat(1000 + i, '2026-10-26T1%d:30:00Z' % (i % 8), -2 + i * 0.01, 52, fid=False) for i in range(30)]
    big = feat(999, '2026-10-26T12:00:00Z'); big['geometry']['coordinates'] = [-1.0] * 1000000
    fd['features'] = good + noid + [big]; dump(feedp(d), fd)
    d2 = base('S10b-feed-noid-only'); os.remove(idxp(d2)); fd = ld(feedp(d2)); fd['features'] = good + noid; dump(feedp(d2), fd)
if 'S11' in which:  # no index + feed: points carrying project-like props (tech/name/repd_ref XSS) -> sld-sandbox click handler picks up any visible l-* layer
    d = base('S11-click-props'); os.remove(idxp(d)); fd = ld(feedp(d))
    fs = [feat(i, '2026-10-26T1%d:00:00Z' % (i % 8), -1.5, 53.0) for i in range(3)]
    for f in fs: f['properties'].update(tech='solar', type=XSS, name=XSS, SiteName=XSS, repd_ref=XSS, capacity=50, point_count=99999, description=XSS)
    fd['features'] = fs; fd['metadata']['source'] = XSS; dump(feedp(d), fd)
print('built', which)
