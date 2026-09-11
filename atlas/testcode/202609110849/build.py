"""Build a satellite-only successor from the verified, unchanged test renderer."""
from pathlib import Path
import hashlib, json, re
HERE = Path(__file__).resolve().parent
OLD = HERE.parent / '202609110242'
assert hashlib.sha256((OLD/'satellite.js').read_bytes()).hexdigest() == '8bff3b7b1c5e26038f5229066863486be32cf8b0124badad28a7326723d4fe4a', 'Unexpected baseline renderer'
s = (OLD/'satellite.js').read_text().split('  let scheduled = false;')[0]
s = s.replace("const VERSION = '202609110242';", "const VERSION = '202609110849';\n  let catalogue = [], selectionPolicy = 'latest';")
s = s.replace('async function sentinel() {', 'async function sentinel(preferredId = null, force = false) {')
s = s.replace('if (active && covers(active.item, point)', 'if (!preferredId && !force && active && covers(active.item, point)')
s = s.replace("const key = point.map(x => x.toFixed(3)).join(',');", "const key = point.map(x => x.toFixed(3)).join(',') + '|' + selectionPolicy + '|' + (preferredId || '');")
s = s.replace("limit: '50'", "limit: '100'")
s = s.replace("metrics.searches++;\n        const found = await json(ROOT + '/api/stac/v1/search?' + query, signal);", "let found;\n        if (preferredId && catalogue.some(f => f.id === preferredId && covers(f, point))) found = {features: catalogue};\n        else { metrics.searches++; found = await json(ROOT + '/api/stac/v1/search?' + query, signal); }")
s = s.replace("const item = rows.find(f => finite(f.properties['eo:cloud_cover']) && f.properties['eo:cloud_cover'] <= 35) || rows[0];", "catalogue = rows;\n        const item = preferredId ? rows.find(f => f.id === preferredId) : selectionPolicy === 'latest' ? rows[0] : (rows.find(f => finite(f.properties['eo:cloud_cover']) && f.properties['eo:cloud_cover'] <= 35) || rows[0]);")
s = s.replace("if (!item.assets?.tilejson?.href)", "sceneOptions(item.id);\n        if (!item.assets?.tilejson?.href)")
s = s.replace("'Finding recent S2 at map centre; current map retained…'", "'Finding dated S2 scenes at map centre; current map retained…'")
s += (HERE/'dock-ui.js').read_text()
assert 'async function sentinel(preferredId' in s
assert 'let scheduled = false;' in s
(HERE/'satellite.js').write_text(s)
h = hashlib.sha256((HERE/'satellite.js').read_bytes()).hexdigest()
index = (OLD/'index.html').read_text().replace('202609110242','202609110849')
index = index.replace('8bff3b7b1c5e26038f5229066863486be32cf8b0124badad28a7326723d4fe4a', h)
index = index.replace('Isolated successor to 202609110310.', 'Isolated draggable-control successor to 202609110242.')
(HERE/'index.html').write_text(index)
manifest = {'schema':'gridatlas.satellite-test.v2','generation':'202609110849','base_composition':'202609080850','base_commit':'19588c2dbae435c826e48d6cdd271c7fe64e0d54','renderer_sha256':h,'production_files_changed':False,'scope':['same native GRID/SUBS nodes in draggable imagery dock','clear search results','dated Sentinel scene selector; latest versus lower scene cloud'],'status':'TEST_ONLY'}
(HERE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
