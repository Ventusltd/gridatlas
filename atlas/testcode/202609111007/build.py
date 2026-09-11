"""Build an isolated Satellite survey test; production composition is unchanged."""
import hashlib, json, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE.parent / '202609110849'
VERSION = HERE.name
raw = (BASE / 'satellite.js').read_bytes()
assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == '7c47ce3035e31ef62ee75238d676e442344c9aae', 'Inherited helper file changed'
prior = raw.decode()
assert prior.count('  async function sentinel(') == 1
prefix = prior.split('  async function sentinel(', 1)[0].replace("const VERSION = '202609110849'", "const VERSION = '" + VERSION + "'")
js = prefix + (HERE / 'survey-ui.js').read_text()
js = js.replace("'Dark map · satellite test ' + VERSION", "'Dark map | Satellite survey ' + VERSION")
(HERE / 'satellite.js').write_text(js)
html = (BASE / 'index.html').read_text().replace('202609110849', VERSION)
new_hash = hashlib.sha256(js.encode()).hexdigest()
html, n = re.subn(r"(const addon=await script\(new URL\('satellite.js',testBase\),')[a-f0-9]{64}('\);)", lambda m: m[1] + new_hash + m[2], html)
assert n == 1, 'Loader addon hash slot not found'
html = html.replace('GridAtlas satellite test', 'GridAtlas Satellite survey test')
(HERE / 'index.html').write_text(html)
manifest = {'schema':'gridatlas.satellite-survey-test.v1','generation':VERSION,'production_generation':'202609080850','production_modified':False,'sha256':new_hash,'ui':'Grid > Satellite survey','native_grid_subs':'unchanged','imagery':['Esri World Imagery','Copernicus Sentinel-2 L2A via Microsoft Planetary Computer'],'scope':'Domestic and public-interest surveying of renewable projects'}
(HERE / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
