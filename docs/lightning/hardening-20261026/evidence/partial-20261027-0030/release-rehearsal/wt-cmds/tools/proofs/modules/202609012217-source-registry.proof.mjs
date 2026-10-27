/**
 * Proof for the source-registry module.
 *
 * The registry's whole value is that it tells the truth about ABSENCE, so
 * most of these checks build a window with a source deliberately missing,
 * half-loaded or broken, and assert that the answer says so. A registry that
 * only works when everything is present would be worth nothing: everything
 * present is the case nobody needs help with.
 *
 *   node tools/proofs/modules/202609012217-source-registry.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
  Map, Set, Boolean, Error, RegExp };
box.window.window = box.window;
vm.createContext(box);
const source = await readFile(
  join(REPO, 'atlas', 'modules', '202609012217-source-registry.js'), 'utf8');
vm.runInContext(source, box, { filename: 'source-registry.js' });
const registry = box.window.__GRIDATLAS_MODULES__.sourceRegistry;

console.log('\nit declares what it knows about\n');
check('the module loaded and froze its surface',
  !!registry && Object.isFrozen(registry));
check('it declares seven sources by name',
  registry.declared.length === 7
  && registry.declared.includes('gb-electricity-conditions')
  && registry.declared.includes('neso-connection-points')
  && registry.declared.includes('mapped-substations')
  && registry.declared.includes('network-topology'));
check('the declared list is in the module, not scanned off window', (() => {
  /* Enumerating window would report whatever happens to be there and would
     start consuming a new global the day someone added one. */
  const scanned = /for\s*\(\s*const\s+\w+\s+(of|in)\s+Object\.keys\(\s*w(indow)?\s*\)/;
  return !scanned.test(source) && /const SOURCES = \[/.test(source);
})());

console.log('\nan empty page: everything is missing, and it says which\n');
const empty = registry.survey({});
check('nothing is reported ready', empty.counts.ready === 0);
check('every declared source is reported missing',
  empty.counts.missing === empty.counts.declared);
check('the sentence names what did not answer',
  /Not answering/.test(empty.sentence)
  && /neso-connection-points/.test(empty.sentence));
check('and refuses to let an absence read as an absence in the world',
  /missing from this answer, not/.test(empty.sentence)
  && /absent from the world/.test(empty.sentence));

console.log('\nloaded is not the same as useful\n');
/* The state that actually occurs on a phone: the cartridge has evaluated,
   its global exists, and its payload has not arrived. A probe that tested
   only for the global would call this ready and answer with nothing. */
const halfway = registry.survey({
  __GRIDATLAS_NEON_LINKS__: { measure: { distanceKm: () => 0 }, substations_loaded: 0 },
  __GRIDATLAS_NETWORK__: { loaded: false },
  __GRIDATLAS_MODULES__: {}
});
const state = (survey, id) => survey.sources.find(s => s.id === id).state;
check('a link cartridge with no substations yet is not ready',
  state(halfway, 'mapped-substations') === 'loaded, no substations yet');
check('a network cartridge still fetching is reported as loading',
  state(halfway, 'neso-connection-points') === 'loading');
check('neither counts towards ready', halfway.counts.ready === 0);

console.log('\na failure is distinguished from an absence\n');
const broken = registry.survey({
  __GRIDATLAS_NETWORK__: { loaded: false, failed: true },
  __GRIDATLAS_NEON_LINKS__: { substations_loaded: 5800 }
});
check('a failed fetch says failed, not absent',
  state(broken, 'neso-connection-points') === 'failed to load');
check('a link cartridge that cannot measure says so, not "ready"',
  state(broken, 'mapped-substations') === 'loaded, cannot measure');
check('a probe that throws is caught and reported, not fatal', (() => {
  const hostile = registry.survey({
    get __GRIDATLAS_NETWORK__() { throw new Error('hostile getter'); }
  });
  return /probe threw/.test(state(hostile, 'neso-connection-points'));
})());

console.log('\na fully loaded page\n');
const full = registry.survey({
  __GRIDATLAS_V9_MAP__: {},
  __GRIDATLAS_NEON_LINKS__: { measure: { distanceKm: () => 0 }, substations_loaded: 5800 },
  __GRIDATLAS_NETWORK__: { loaded: true, count: 886, schema: 'data-grid-gb.connection-points.v3' },
  __GRIDATLAS_MODULES__: { gridScope: {}, networkTopology: {}, declaredConnections: { count: 19 } },
  __GRIDATLAS_TOPOLOGY__: { state: 'ready', sites: 921, bytes: 10069966, schema: 'data-grid-gb.transmission-network.v1' },
  __GRIDATLAS_GB_CONDITIONS__: { state: 'ready', schema: 'data-gb-electricity.price-decade-rollup.v2', renders: 1 }
});
check('all seven answer', full.counts.ready === 7 && full.counts.missing === 0);
check('the sentence says so plainly', /All 7 sources answered/.test(full.sentence));
check('a ready source carries its detail',
  full.sources.find(s => s.id === 'neso-connection-points').detail.connection_points === 886);
check('a source that is not ready carries no detail',
  empty.sources.every(s => s.detail === null));

console.log('\na module on the shelf is not a source (the v9.67 false ready)\n');
/* At v9.67 the topology probe reported ready because the module object
   existed, while nothing in the page had ever fetched the product it
   indexes. The registry told the reader a source answered that had
   answered nothing. These are the states the loader can be in. */
const withModuleOnly = registry.survey({ __GRIDATLAS_MODULES__: { networkTopology: {} } });
check('a topology module with no loader is not ready, and says why',
  state(withModuleOnly, 'network-topology') === 'module present, no loader in this composition');
check('idle is reported as idle, not absent and not ready',
  state(registry.survey({ __GRIDATLAS_MODULES__: { networkTopology: {} },
    __GRIDATLAS_TOPOLOGY__: { state: 'idle' } }), 'network-topology') === 'idle, loads on first use');
check('loading is reported as loading',
  state(registry.survey({ __GRIDATLAS_MODULES__: { networkTopology: {} },
    __GRIDATLAS_TOPOLOGY__: { state: 'loading' } }), 'network-topology') === 'loading');
check('a failed product fetch is reported as failed, not absent',
  state(registry.survey({ __GRIDATLAS_MODULES__: { networkTopology: {} },
    __GRIDATLAS_TOPOLOGY__: { state: 'failed', error: 'HTTP 404' } }), 'network-topology') === 'failed to load');
check('ready carries the site count and the schema it indexed',
  full.sources.find(s => s.id === 'network-topology').detail.sites === 921
  && full.sources.find(s => s.id === 'network-topology').detail.schema === 'data-grid-gb.transmission-network.v1');
check('the declared-connections source is the module, and carries its record count',
  full.sources.find(s => s.id === 'declared-connections').detail.records === 19
  && state(registry.survey({ __GRIDATLAS_MODULES__: { declaredConnections: { count: 0 } } }), 'declared-connections') === 'absent');

console.log('\nwhat each source REQUIRES is declared, whatever its state\n');
/* Generation 202609012217: current.json had declared connection-points v2
   for six generations while the cartridge required v3. The manifest is
   proven against the bytes elsewhere; here the registry itself states, for
   every source that fetches a product, which product and which schema, so
   a reader of the survey sees the contract before and after the load. */
const requiring = ['neso-connection-points', 'network-topology', 'gb-electricity-conditions'];
check('the three fetching sources declare repository, product and schema',
  requiring.every(id => {
    const r = empty.sources.find(s => s.id === id).requires;
    return r && /^Ventusltd\//.test(r.repository) && /\.json$/.test(r.product) && /\.v\d+$/.test(r.schema);
  }));
check('the requirement is carried in the survey when the source is absent, not only when ready',
  requiring.every(id => empty.sources.find(s => s.id === id).requires
    && JSON.stringify(empty.sources.find(s => s.id === id).requires)
      === JSON.stringify(full.sources.find(s => s.id === id).requires)));
check('sources that fetch nothing carry requires: null',
  ['map', 'mapped-substations', 'grid-scope', 'declared-connections']
    .every(id => empty.sources.find(s => s.id === id).requires === null));
check('the connection-points requirement is v3, the version the cartridge answers',
  empty.sources.find(s => s.id === 'neso-connection-points').requires.schema === 'data-grid-gb.connection-points.v3'
  && empty.sources.find(s => s.id === 'neso-connection-points').requires.product === 'derived/connection-points.v3.json');
check('the topology requirement is the v1 transmission network',
  empty.sources.find(s => s.id === 'network-topology').requires.schema === 'data-grid-gb.transmission-network.v1');
check('the GB conditions requirement is the v2 price rollup',
  empty.sources.find(s => s.id === 'gb-electricity-conditions').requires.schema === 'data-gb-electricity.price-decade-rollup.v2'
  && empty.sources.find(s => s.id === 'gb-electricity-conditions').requires.repository === 'Ventusltd/data-gb-electricity');

console.log('\nthe GB conditions source: reached, withheld and failed are three states\n');
const gb = (st) => state(registry.survey({ __GRIDATLAS_GB_CONDITIONS__: st }), 'gb-electricity-conditions');
check('no loader in the page is absent', state(registry.survey({}), 'gb-electricity-conditions') === 'absent');
check('idle loads on first use', gb({ state: 'idle' }) === 'idle, loads on first use');
check('loading is loading', gb({ state: 'loading' }) === 'loading');
check('unreachable is failed, not absent', gb({ state: 'failed', error: 'HTTP 503' }) === 'failed to load');
check('reached but not the required schema is withheld, with the reason',
  gb({ state: 'withheld', reason: 'owner product v2 is not available' }) === 'withheld: owner product v2 is not available');
check('ready carries the schema it rendered from and the render count',
  full.sources.find(s => s.id === 'gb-electricity-conditions').detail.schema === 'data-gb-electricity.price-decade-rollup.v2'
  && full.sources.find(s => s.id === 'gb-electricity-conditions').detail.renders === 1);

console.log('\nthe single-source question\n');
const FULL_WINDOW = {
  __GRIDATLAS_V9_MAP__: {},
  __GRIDATLAS_NEON_LINKS__: { measure: { distanceKm: () => 0 }, substations_loaded: 5800 },
  __GRIDATLAS_NETWORK__: { loaded: true, count: 886, schema: 'data-grid-gb.connection-points.v3' },
  __GRIDATLAS_MODULES__: { gridScope: {}, networkTopology: {}, declaredConnections: { count: 19 } },
  __GRIDATLAS_TOPOLOGY__: { state: 'ready', sites: 921, bytes: 10069966, schema: 'data-grid-gb.transmission-network.v1' },
  __GRIDATLAS_GB_CONDITIONS__: { state: 'ready', schema: 'data-gb-electricity.price-decade-rollup.v2', renders: 1 }
};
check('ready() agrees with the survey on every declared source',
  registry.declared.every(id =>
    registry.ready(id, FULL_WINDOW)
    === full.sources.find(s => s.id === id).ready));
check('ready() is false where the survey reports loading, not just absent',
  registry.ready('neso-connection-points',
    { __GRIDATLAS_NETWORK__: { loaded: false } }) === false);
check('ready() is false for a source that is absent',
  registry.ready('neso-connection-points', {}) === false);
check('ready() is false for a name it does not know',
  registry.ready('not-a-source', {}) === false);

console.log('\nit reads and nothing else\n');
check('it never fetches', !/\bfetch\s*\(/.test(source));
check('it never renders', !/document\.|innerHTML|appendChild/.test(source));
check('it never grades what it finds',
  !/\b(good|poor|strong|weak|sufficient|adequate)\b/i.test(source));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('the registry says what answered, what did not, and why - '
  + 'and never lets a gap in the page read as a gap in the world.');
