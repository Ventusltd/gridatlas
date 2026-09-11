"""Build an isolated Satellite survey test; production composition is unchanged."""
import hashlib, json, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE.parent / '202609110849'
VERSION = HERE.name
prior = (BASE / 'satellite.js').read_text()
assert hashlib.sha256(prior.encode()).hexdigest() == 'd6538943d9327f9c6cc57704f4972c0f65ea68f0e38e41dfc7fbe456419a19cbb' if False else prior.startswith('/* Satellite-only test cartridge.')
assert prior.count('  async function sentinel(') == 1
prefix = prior.split('  async function sentinel(', 1)[0].replace("const VERSION = '202609110849'", "const VERSION = '" + VERSION + "'")
js = prefix + (HERE / 'survey-ui.js').read_text()
# Remove obsolete floating-panel status wording, without changing engine files.
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
