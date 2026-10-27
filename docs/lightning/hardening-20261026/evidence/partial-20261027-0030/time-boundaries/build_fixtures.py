#!/usr/bin/env python3
"""time-boundaries lane: SYNTHETIC lightning history day files (not EUMETSAT data).
Every UTC hour HH of every listed date holds exactly two flashes, at HH:00:00.000Z and HH:30:00.000Z,
so any half-open window [s,e) holds exactly (number of half-hour marks in it) flashes. Some dates are split
into hourly parts (days/YYYY/MM/DD/HH.json) like the v2 producer. Writes fixtures/synthetic/data/history/days/**
and fixtures/synthetic/rows.json (index rows; the test generates index.json per case)."""
import json, hashlib, datetime as dt, pathlib, sys
OUT = pathlib.Path(__file__).resolve().parent / 'fixtures' / 'synthetic'
SPLIT = {'2026-10-25', '2027-01-01', '2028-02-29'}
def ser(o): return json.dumps(o, separators=(',', ':'), ensure_ascii=False) + '\n'
def coll(day, recs, hour=None):
    md = {'date_utc': day, 'source': 'SYNTHETIC time-boundaries fixture (not EUMETSAT data)', 'synthetic': True,
          'observation': 'optical satellite flash; not a confirmed ground strike', 'count': len(recs),
          'first_observation_utc': recs[0]['properties']['time_utc'], 'last_observation_utc': recs[-1]['properties']['time_utc']}
    if hour is not None: md['hour_utc'] = f'{hour:02d}'; md['part_of_day'] = True
    return {'schema': 'uk-lightning-history-day.v1', 'type': 'FeatureCollection', 'metadata': md, 'features': recs}
def feat(day, h, m):
    t = f'{day}T{h:02d}:{m:02d}:00.000Z'
    return {'type': 'Feature', 'id': f'syn-{day}-{h:02d}{m:02d}', 'geometry': {'type': 'Point', 'coordinates': [-1.5, 53.0]},
            'properties': {'name': 'SYNTHETIC flash ' + t, 'time_utc': t, 'observation_kind': 'optical_lightning_flash', 'synthetic': True}}
def dates(a, b):
    d = dt.date.fromisoformat(a)
    while d <= dt.date.fromisoformat(b): yield d; d += dt.timedelta(days=1)
rows = {}
for d in list(dates('2026-09-25', '2027-01-10')) + list(dates('2028-02-01', '2028-03-05')):
    day = d.isoformat(); recs = [feat(day, h, m) for h in range(24) for m in (0, 30)]
    base = OUT / 'data' / 'history'
    row = {'date': day, 'coverage': 'full', 'scanned_seconds': 86400, 'count': 48, 'sealed': False,
           'first_observation_utc': recs[0]['properties']['time_utc'], 'last_observation_utc': recs[-1]['properties']['time_utc']}
    if day in SPLIT:
        parts = []
        for h in range(24):
            c = ser(coll(day, recs[2*h:2*h+2], h)); rel = f'days/{d:%Y/%m/%d}/{h:02d}.json'
            p = base / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(c)
            parts.append({'hour': f'{h:02d}', 'path': rel, 'count': 2, 'bytes': len(c.encode()), 'sha256': hashlib.sha256(c.encode()).hexdigest()})
        row.update(path=None, parts=parts, bytes=sum(p['bytes'] for p in parts), sha256=None)
    else:
        c = ser(coll(day, recs)); rel = f'days/{d:%Y/%m/%d}.json'
        p = base / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(c)
        row.update(path=rel, bytes=len(c.encode()), sha256=hashlib.sha256(c.encode()).hexdigest())
    rows[day] = row
# zone-less variant (malformed on purpose): 2026-09-20 times WITHOUT 'Z'; producer format_utc always writes Z
day='2026-09-20'; recs=[feat(day,h,m) for h in range(24) for m in (0,30)]
for r in recs: r['properties']['time_utc']=r['properties']['time_utc'][:-1]
c=ser(coll(day,recs)); rel='days/2026/09/20.json'; p=OUT/'data'/'history'/rel; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(c)
rows[day]={'date':day,'coverage':'full','scanned_seconds':86400,'count':48,'sealed':False,'path':rel,'bytes':len(c.encode()),'sha256':hashlib.sha256(c.encode()).hexdigest(),
 'first_observation_utc':recs[0]['properties']['time_utc'],'last_observation_utc':recs[-1]['properties']['time_utc'],'note':'zone-less times, malformed on purpose'}
(OUT / 'rows.json').write_text(json.dumps(rows, indent=0))
(OUT / 'README.txt').write_text('SYNTHETIC fixtures for the time-boundaries lane. Not EUMETSAT data. Built by ../../build_fixtures.py\n')
print(len(rows), 'rows written to', OUT)
