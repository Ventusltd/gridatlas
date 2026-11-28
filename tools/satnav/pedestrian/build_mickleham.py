"""Build the dated Mickleham footpath pack from Surrey's published GeoPackage.

Usage: python build_mickleham.py RoW_OpenData_September_2026.zip output.geojson
Requires GDAL's ogr2ogr. The browser reads only the generated local GeoJSON.
"""

import hashlib
import json
from collections import defaultdict
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile


PORTAL = (
    'https://www.surreycc.gov.uk/culture-and-leisure/countryside/management/'
    'footpaths-byways-and-bridleways/rights-of-way/open-data'
)
SOURCE = 'https://www.surreycc.gov.uk/__data/assets/file/0011/267428/RoW_OpenData_September_2026.zip'
DIGEST = 'e2ad1dfaecb0e522172af916f3ebbd4fde8c606fdb87f142a696c6bce97f6fdf'
NOTICES = PORTAL.removesuffix('/rights-of-way/open-data') + '/rights-of-way-public-notices'


def features(gpkg, reproject):
    args = [
        'ogr2ogr', '-f', 'GeoJSON', '-dim', 'XY', '-preserve_fid',
        '-where', "LocArea = 'Mickleham' AND PROWStat = '01' AND Stat_Text = 'Footpath'",
        '-select', 'PROWNo,LocArea,Stat_Text,PROWStat,date_pblsh',
    ]
    if reproject:
        args += ['-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=7']
    else:
        args += ['-lco', 'SIGNIFICANT_FIGURES=17']
    args += ['/vsistdout/', str(gpkg), 'Rights_of_Way_Surrey']
    output = subprocess.run(args, check=True, stdout=subprocess.PIPE)
    return {f['id']: f for f in json.loads(output.stdout)['features']}


def order_continuous_sections(records):
    """Order each non-branching component using the unrounded source endpoint IDs."""
    at = defaultdict(list)
    for record in records:
        props = record['properties']
        at[props['fromNode']].append(record)
        at[props['toNode']].append(record)
    if any(len(edges) > 2 for edges in at.values()):
        raise ValueError('Footpath has a branch without an explicit traversal order')
    visited = set()
    for start in sorted(node for node, edges in at.items() if len(edges) == 1):
        node = start
        position = 0
        while True:
            next_records = [r for r in at[node] if r['id'] not in visited]
            if not next_records:
                break
            record, = next_records
            props = record['properties']
            forward = props['fromNode'] == node
            node = props['toNode'] if forward else props['fromNode']
            props.update(chain=start, position=position, forward=forward)
            position += 1
            visited.add(record['id'])
    if len(visited) != len(records):
        raise ValueError('Unordered closed loop in footpath source')


def build(archive, output):
    with archive.open('rb') as src:
        if hashlib.file_digest(src, 'sha256').hexdigest() != DIGEST:
            raise ValueError('Source archive differs from the published September 2026 snapshot')
    with tempfile.TemporaryDirectory() as temp:
        gpkg = Path(temp) / 'rights.gpkg'
        with zipfile.ZipFile(archive) as bundle, bundle.open('RoW_OpenData.gpkg') as src, gpkg.open('wb') as dst:
            shutil.copyfileobj(src, dst)
        original = features(gpkg, reproject=False)
        wgs84 = features(gpkg, reproject=True)

    if original.keys() != wgs84.keys() or len(original) != 39:
        raise ValueError('Unexpected extent or source feature IDs')

    # The council supplies path identifiers but no cross-path junction records.
    # Preserve continuity only within the same numbered path at exact original
    # endpoints. WGS84 rounding, crossings and adjacent paths cannot create links.
    junctions = {}
    result = []
    for fid in sorted(original):
        feature = original[fid]
        geom = feature['geometry']
        if geom['type'] != 'LineString' or wgs84[fid]['geometry']['type'] != 'LineString':
            raise ValueError(f'Unexpected geometry in source record {fid}')
        points = geom['coordinates']
        number = feature['properties']['PROWNo']
        ends = [(number, tuple(points[0])), (number, tuple(points[-1]))]
        start, end = [junctions.setdefault(p, 'j' + str(len(junctions))) for p in ends]
        result.append({
            'type': 'Feature', 'id': fid,
            'properties': {
                'footpath': number, 'accessCode': '01',
                'fromNode': start, 'toNode': end,
            },
            'geometry': wgs84[fid]['geometry'],
        })

    order_continuous_sections(result)

    metadata = {
        'type': 'FeatureCollection', 'name': 'Mickleham public footpaths',
        'schema': 'ventus.surrey-footpath-pack.v1', 'publisher': 'Surrey County Council',
        'area': 'Mickleham, Surrey, England', 'extracted': '2026-09-07', 'published': '2026-09-18',
        'source': PORTAL, 'archive': SOURCE, 'archiveSha256': DIGEST,
        'licence': 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
        'attribution': 'Surrey County Council. This dataset contains data derived in part from Ordnance Survey data © Crown Copyright and database rights 2026.',
        'closureNotices': NOTICES, 'includesTemporaryClosures': False,
        'accessBasis': 'Surrey public right of way status 01 (Footpath).',
        'topology': 'Exact original endpoints may join records on the same numbered path only. No cross-path junctions or links across gaps.',
    }
    with output.open('w', encoding='utf-8', newline='\n') as dst:
        header = json.dumps(metadata, indent=2, ensure_ascii=False)
        dst.write(header[:-2] + ',\n  "features": [\n')
        dst.write(',\n'.join('    ' + json.dumps(f, ensure_ascii=False, separators=(',', ':')) for f in result))
        dst.write('\n  ]\n}\n')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]), Path(sys.argv[2]))
