import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = await readFile(join(ROOT, 'atlas/modules/202609011941-click-computation.js'), 'utf8');
const box = { window: {}, Object, Array, String, Number };
vm.createContext(box); vm.runInContext(source, box);
const module = box.window.__GRIDATLAS_MODULES__.clickComputation;
let passed = 0; const failed = [];
function check(label, condition) {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed.push(label); console.log(`  [FAIL] ${label}`); }
}

const networkProduct = { schema: 'owner.v1' };
const deps = {
  declaredConnections: { resolve: (ref, origin) => ({ ref, origin, poc: 'Cottam' }) },
  gridScope: { compute: origin => ({ origin, bands: [] }) },
  mapClickNetwork: { index: product => product.schema === 'owner.v1' ? {
    at: (code, { connectionKv }) => code === 'COTT' && connectionKv === 400
      ? { site: code, voltage_kv: connectionKv, circuits: 4 } : null
  } : null },
  sourceRegistry: { survey: () => ({ counts: { declared: 3, ready: 3, missing: 0 } }) }
};
const engine = module.create(deps);
check('module and created engine are frozen', Object.isFrozen(module) && Object.isFrozen(engine));
check('invalid and out-of-range coordinates fail closed',
  engine.compute({ lon: NaN, lat: 53 }) === null
  && engine.compute({ lon: 0, lat: 91 }) === null);

const full = engine.compute({ lon: -0.7, lat: 53.3, repdRef: 10914,
  siteCode: 'cott', connectionKv: 400, mappedSubstations: [], networkProduct });
check('a complete click coordinates all three fact lanes', full.complete === true
  && full.sources.declared_connection.state === 'answered'
  && full.sources.mapped_measurement.state === 'answered'
  && full.sources.published_network.state === 'answered');
check('site identity is canonicalised without guessing it', full.site_code === 'COTT'
  && full.sources.published_network.value.site === 'COTT');
check('the declared voltage is passed exactly',
  full.sources.published_network.value.voltage_kv === 400);
check('source completeness travels beside the answer',
  full.source_survey.counts.missing === 0 && full.missing.length === 0);

const absentProduct = engine.compute({ lon: 0, lat: 52, siteCode: 'COTT', connectionKv: 400 });
check('an absent owner product is explicit, never an empty network answer',
  absentProduct.complete === false
  && absentProduct.sources.published_network.state === 'product-unavailable'
  && absentProduct.sources.published_network.value === null);
const future = engine.compute({ lon: 0, lat: 52, siteCode: 'COTT', connectionKv: 400,
  networkProduct: { schema: 'owner.v2' } });
check('an unknown owner schema is distinguished from absent data',
  future.sources.published_network.state === 'schema-refused');
const noIdentity = engine.compute({ lon: 0, lat: 52, connectionKv: 400, networkProduct });
check('missing identity cannot silently become nearest-site identity',
  noIdentity.sources.published_network.state === 'identity-unavailable');
const noVoltage = engine.compute({ lon: 0, lat: 52, siteCode: 'COTT', networkProduct });
check('missing voltage cannot produce a mixed-voltage answer',
  noVoltage.sources.published_network.state === 'voltage-unavailable');
check('the refusal names every forbidden inference', /not solved power flow/.test(full.not_an_assessment)
  && /available headroom/.test(full.not_an_assessment)
  && /queue position/.test(full.not_an_assessment)
  && /connection assessment/.test(full.not_an_assessment));
check('the coordinator is pure orchestration',
  !/fetch\(|innerHTML|insertAdjacentHTML|6378|6371|Math\.(sqrt|atan|asin)/.test(source));
check('the coordinator carries no voltage decoder',
  !/slice\(|substring\(|charAt\(|parseInt\(/.test(source));

console.log(`\n${passed}/${passed + failed.length} checks passed`);
if (failed.length) process.exit(1);
console.log('a click coordinates available facts and makes every missing lane explicit.');
