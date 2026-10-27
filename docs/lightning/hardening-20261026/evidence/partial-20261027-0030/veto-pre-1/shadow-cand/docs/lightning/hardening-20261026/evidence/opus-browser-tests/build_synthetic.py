#!/usr/bin/env python3
"""opus-browser-tests: build SYNTHETIC lightning fixtures for lightning-hardening.browser.mjs.

Every variant starts as a byte copy of the lead's genuine fixture
(../../../lightning/fixtures/lightning-archive/data, built 2026-10-26T18:37:03Z) and changes only
what its README line says. Every changed index row carries `fixture_synthetic` naming the change.
NEVER publish these; they exist only to be served through the lead's offline shim.

usage: python3 -I build_synthetic.py   (writes ./fixtures/SYNTHETIC-*/data)
"""
import hashlib, json, os, random, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data'))
OUT = os.path.join(HERE, 'fixtures')
SEP = (',', ':')


def dump(path, obj):
    b = json.dumps(obj, separators=SEP, ensure_ascii=False).encode('utf-8')
    with open(path, 'wb') as f:
        f.write(b)
    return b


def fresh(name):
    d = os.path.join(OUT, name, 'data')
    if os.path.exists(os.path.join(OUT, name)):
        shutil.rmtree(os.path.join(OUT, name))
    shutil.copytree(SRC, d)
    return d


def load(p):
    with open(p, 'rb') as f:
        return json.loads(f.read())


def row(idx, date):
    return next(r for r in idx['days'] if r['date'] == date)


def rewrite_shard(d, idx, date, features, note):
    """write a shard and make its index row consistent (count, bytes, sha256, first/last)."""
    p = os.path.join(d, 'history', 'days', *date.split('-')) + '.json'
    shard = load(p)
    shard['features'] = features
    times = sorted(f['properties']['time_utc'] for f in features if isinstance(f.get('properties', {}).get('time_utc'), str))
    shard['metadata']['count'] = len(features)
    shard['metadata']['first_observation_utc'] = times[0]
    shard['metadata']['last_observation_utc'] = times[-1]
    b = dump(p, shard)
    r = row(idx, date)
    r.update(count=len(features), bytes=len(b), sha256=hashlib.sha256(b).hexdigest(),
             first_observation_utc=times[0], last_observation_utc=times[-1], fixture_synthetic=note)
    return r


def feat(fid, lon, lat, t):
    return {'type': 'Feature', 'id': fid, 'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {'name': 'SYNTHETIC flash ' + t, 'raw_tech': 'SYNTHETIC test record, not an observation',
                           'status': 'Satellite detection', 'time_utc': t, 'source': 'EUMETSAT',
                           'source_product': 'MTG LI L2-LFL', 'observation_kind': 'optical_lightning_flash'}}


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []

    # 1. hostile timestamp in the index (test 2): one string changed
    d = fresh('SYNTHETIC-hostile-index-timestamp')
    ip = os.path.join(d, 'history', 'index.json'); idx = load(ip)
    r = row(idx, '2026-10-21')
    r['fixture_real_first_observation_utc'] = r['first_observation_utc']
    r['first_observation_utc'] = 'not-a-date'
    r['fixture_synthetic'] = 'first_observation_utc replaced by "not-a-date"'
    dump(ip, idx); made.append(d)

    # 2. out-of-box and NaN coordinates in a shard (test 9): 3 genuine + 3 SYNTHETIC bad records on 2026-10-25
    d = fresh('SYNTHETIC-out-of-box')
    ip = os.path.join(d, 'history', 'index.json'); idx = load(ip)
    feats = load(os.path.join(d, 'history', 'days', '2026', '10', '25.json'))['features']
    bad = [feat('SYNTHETIC-oob-east', 20.0, 40.0, '2026-10-25T05:00:00.000Z'),
           feat('SYNTHETIC-null-coords', None, None, '2026-10-25T05:10:00.000Z'),
           feat('SYNTHETIC-nan-string-coords', 'NaN', 'NaN', '2026-10-25T05:20:00.000Z')]
    rewrite_shard(d, idx, '2026-10-25', feats + bad, '3 SYNTHETIC records appended: lon/lat 20,40 (outside UK box), [null,null], ["NaN","NaN"]; count/bytes/sha256 recomputed')
    dump(ip, idx); made.append(d)

    # 3. shard/index disagreement (test 10): one field per row changed in the INDEX only; shards untouched
    d = fresh('SYNTHETIC-shard-mismatch')
    ip = os.path.join(d, 'history', 'index.json'); idx = load(ip)
    r = row(idx, '2026-10-22'); r['fixture_real_sha256'] = r['sha256']; r['sha256'] = '0' * 64; r['fixture_synthetic'] = 'sha256 replaced by 64 zeros'
    r = row(idx, '2026-10-23'); r['fixture_real_bytes'] = r['bytes']; r['bytes'] = r['bytes'] + 1; r['fixture_synthetic'] = 'bytes +1'
    r = row(idx, '2026-10-24'); r['fixture_real_count'] = r['count']; r['count'] = r['count'] - 1; r['fixture_synthetic'] = 'count -1'
    dump(ip, idx); made.append(d)

    # 4. bulk day (tests 11, 12): 2026-10-25 replaced by 85,000 SYNTHETIC points, 00:00:00-05:49:59 UTC, inside the UK box,
    #    shard > 32,000,000 bytes, index row consistent (count/bytes/sha256)
    d = fresh('SYNTHETIC-bulk-day')
    ip = os.path.join(d, 'history', 'index.json'); idx = load(ip)
    rnd = random.Random(20261026)
    n = 85000; feats = []
    for i in range(n):
        s = i * 21000 // n  # seconds after midnight, < 05:50
        t = '2026-10-25T%02d:%02d:%02d.%03dZ' % (s // 3600, s % 3600 // 60, s % 60, i % 1000)
        feats.append(feat('SYNTHETIC-bulk-%06d' % i, round(rnd.uniform(-10.5, 2.5), 5), round(rnd.uniform(50.0, 61.0), 5), t))
    r = rewrite_shard(d, idx, '2026-10-25', feats, '85,000 SYNTHETIC points replace the 3 genuine ones; count/bytes/sha256 recomputed')
    r['scanned_seconds'] = 86400; r['coverage'] = 'full'
    if r['bytes'] <= 32_000_000:
        sys.exit('bulk shard must exceed 32,000,000 bytes, got %d' % r['bytes'])
    dump(ip, idx); made.append(d)

    with open(os.path.join(OUT, 'MANIFEST.sha256'), 'w') as m:
        for base in sorted(made):
            for root, _, files in os.walk(base):
                for fn in sorted(files):
                    p = os.path.join(root, fn)
                    with open(p, 'rb') as f:
                        m.write('%s  %s\n' % (hashlib.sha256(f.read()).hexdigest(), os.path.relpath(p, OUT)))
    print('built', [os.path.relpath(x, OUT) for x in made])


if __name__ == '__main__':
    main()
