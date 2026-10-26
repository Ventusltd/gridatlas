#!/usr/bin/env python3
"""performance lane: build TIME-SHIFTED / SYNTHETIC lightning archives so that the candidate's DEFAULT
period (24h, end = real now) contains N flashes and a plain tap ON draws them without a fake clock
(a fake clock would distort the timings this lane measures).

Each variant = byte copy of the lead's genuine fixture (lightning/fixtures/lightning-archive/data) with
the 2026-10-26 row replaced by one day shard of N features timed in [now-20h, now-30min]:
  P408   the 408 GENUINE features (ids, coordinates, properties unchanged) with time_utc/name SHIFTED
         onto that window -- SYNTHETIC times, genuine shape and positions.
  S10000 / S10001 / S40000  SYNTHETIC points in the real feature shape (~150-char product ids,
         same seven properties, raw_tech says SYNTHETIC), 85 % in 14 Gaussian storm cells, 15 % uniform
         in the UK box. Never publish.
Index row count/bytes/sha256/first/last recomputed; coverage full; one scan window covering the day.
usage: python3 -I build_perf_fixtures.py   (writes ./fixtures/<variant>/data, prints summary)
"""
import hashlib, json, os, random, shutil
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data'))
OUT = os.path.join(HERE, 'fixtures')
SEP = (',', ':')
NOW = datetime.now(timezone.utc).replace(microsecond=0)
DAY = '2026-10-26'
D0 = datetime(2026, 10, 26, tzinfo=timezone.utc)


def iso(t):
    return t.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def load(p):
    with open(p, 'rb') as f:
        return json.loads(f.read())


def dump(p, o):
    b = json.dumps(o, separators=SEP, ensure_ascii=False).encode()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'wb') as f:
        f.write(b)
    return b


def genuine():
    out = []
    for d in ('21', '22', '23', '24', '25'):
        out += load(os.path.join(SRC, 'history', 'days', '2026', '10', d + '.json'))['features']
    assert len(out) == 408
    return out


def times(n):
    a, b = max(NOW - timedelta(hours=20), D0 + timedelta(minutes=1)), NOW - timedelta(minutes=30)
    span = (b - a).total_seconds()
    return [a + timedelta(seconds=span * i / n) for i in range(n)]


def synth(n, seed):
    rnd = random.Random(seed)
    cells = [(rnd.uniform(-9.5, 1.5), rnd.uniform(50.2, 59.5)) for _ in range(14)]
    feats = []
    for i, t in enumerate(times(n)):
        if rnd.random() < 0.85:
            cx, cy = cells[i * 14 // n]
            x, y = rnd.gauss(cx, 0.35), rnd.gauss(cy, 0.25)
        else:
            x, y = rnd.uniform(-10.9, 2.9), rnd.uniform(49.6, 61.4)
        x, y = min(2.99, max(-10.99, x)), min(61.49, max(49.51, y))
        ts = iso(t)
        fid = ('W_XX-EUMETSAT-Darmstadt,IMG+SAT,MTI1+LI-2-LFL--FD--x-x--ARC-x_C_EUMT_%s_L2PF_OPE_%s_%s_N__O_%04d_0000:%d'
               % (t.strftime('%Y%m%d%H%M%S'), t.strftime('%Y%m%d%H%M00'), t.strftime('%Y%m%d%H%M59'), i // 1000, i))
        feats.append({'type': 'Feature', 'id': fid, 'geometry': {'type': 'Point', 'coordinates': [round(x, 6), round(y, 6)]},
                      'properties': {'name': 'Lightning flash ' + ts[:16].replace('T', ' ') + ' UTC',
                                     'raw_tech': 'SYNTHETIC perf-lane record, not an observation',
                                     'status': 'Satellite detection', 'time_utc': ts, 'source': 'EUMETSAT',
                                     'source_product': 'MTG LI L2-LFL', 'observation_kind': 'optical_lightning_flash'}})
    return feats


def build(name, feats, note):
    root = os.path.join(OUT, name)
    shutil.rmtree(root, ignore_errors=True)
    d = os.path.join(root, 'data')
    shutil.copytree(SRC, d)
    ts = sorted(f['properties']['time_utc'] for f in feats)
    shard = {'schema': 'uk-lightning-history-day.v1', 'type': 'FeatureCollection',
             'metadata': {'date_utc': DAY, 'source': 'EUMETSAT MTG Lightning Imager L2-LFL',
                          'observation': 'optical satellite flash; not a confirmed ground strike', 'count': len(feats),
                          'first_observation_utc': ts[0], 'last_observation_utc': ts[-1], 'fixture_synthetic': note},
             'features': feats}
    b = dump(os.path.join(d, 'history', 'days', '2026', '10', '26.json'), shard)
    ip = os.path.join(d, 'history', 'index.json')
    idx = load(ip)
    row = next(r for r in idx['days'] if r['date'] == DAY)
    row.update(coverage='full', scanned_seconds=86400, count=len(feats), bytes=len(b), path='days/2026/10/26.json',
               sealed=False, sha256=hashlib.sha256(b).hexdigest(), first_observation_utc=ts[0], last_observation_utc=ts[-1],
               fixture_synthetic=note)
    if not any(r['date'] == '2026-10-27' for r in idx['days']):
        idx['days'].append({'date': '2026-10-27', 'coverage': 'partial', 'scanned_seconds': 3600, 'count': 0, 'bytes': None,
                            'path': None, 'sealed': False, 'first_observation_utc': None, 'last_observation_utc': None,
                            'sha256': None, 'fixture_synthetic': 'perf lane: placeholder so a run past midnight has a row'})
    idx['scan_windows'].append({'start_utc': iso(D0 - timedelta(hours=1)), 'end_utc': iso(NOW + timedelta(hours=4)), 'successful_runs': 1})
    idx['generated_utc'] = iso(NOW)
    idx['next_update_due_utc'] = iso(NOW + timedelta(hours=5))
    idx['last_successful_scan_end_utc'] = iso(NOW + timedelta(hours=4))
    idx['fixture_note'] = 'SYNTHETIC (performance lane): ' + note
    dump(ip, idx)
    return {'variant': name, 'features': len(feats), 'shard_bytes': len(b), 'bytes_per_feature': round(len(b) / len(feats), 1),
            'first': ts[0], 'last': ts[-1]}


def main():
    g = genuine()
    shifted = []
    for f, t in zip(sorted(g, key=lambda f: f['properties']['time_utc']), times(408)):
        f = json.loads(json.dumps(f))
        f['properties']['time_utc'] = iso(t)
        f['properties']['name'] = 'Lightning flash ' + iso(t)[:16].replace('T', ' ') + ' UTC'
        shifted.append(f)
    out = [build('P408', shifted, '408 genuine features; time_utc/name SHIFTED into [now-20h, now-30min]'),
           build('S10000', synth(10000, 10000), '10,000 SYNTHETIC points, real feature shape'),
           build('S10001', synth(10001, 10001), '10,001 SYNTHETIC points, real feature shape (phone cap + 1)'),
           build('S40000', synth(40000, 40000), '40,000 SYNTHETIC points, real feature shape')]
    print(json.dumps({'built_utc': iso(NOW), 'valid_until_utc': iso(NOW + timedelta(hours=4)), 'variants': out}, indent=1))


if __name__ == '__main__':
    main()
