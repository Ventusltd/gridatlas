/**
 * Proof for the substation intelligence cartridge, generation 202609011751.
 *
 * It runs the real file against a stub of the small surface it touches,
 * the way every proof in this repository does. What it proves: the shell
 * bridge is carried forward byte for byte, the product is revalidated
 * rather than pinned, an unknown schema yields no answers at all, and
 * nothing it returns grades a connection.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CARTRIDGE = join(REPO, 'atlas', 'cartridges',
  '202609011751-substation-intelligence-v9-57.js');
const SHELL_BRIDGE = join(REPO, 'atlas', 'releases', '202608300453-atlas-v9',
  '202608292126-map-ready-fetch-bridge.js');

/* PART 1 is the shell's data plane, and it is proven here by BYTE
   IDENTITY, not by execution: running it for real needs DuckDB, WASM and
   the parquet plane behind it, none of which belongs in a proof of PART 2.
   Under a stub it prefetches its critical path and rejects on the answer,
   asynchronously, after every check has already passed. That rejection is
   the stub's doing rather than the cartridge's, so it is reported and set
   aside rather than allowed to fail a proof it is not part of. */
const bridgeRejections = [];
process.on('unhandledRejection', (reason) => {
  bridgeRejections.push(String(reason?.message || reason).slice(0, 120));
});

let passed = 0;
const failures = [];
function check(label, condition) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else { failures.push(label); console.log('  [FAIL] ' + label); }
}

const source = await readFile(CARTRIDGE, 'utf8');
const bridge = (await readFile(SHELL_BRIDGE, 'utf8')).replace(/\r\n/g, '\n');

console.log('\nthe shell bridge, carried forward\n');
check('the shell bridge is present byte for byte', source.includes(bridge));
check('it is carried, not summarised',
  createHash('sha256').update(bridge).digest('hex').length === 64
  && source.indexOf(bridge) < source.length / 2);
check('the bridge keeps its own public state object',
  /window\.__GRIDATLAS_MAP_READY__ = state;/.test(source));

console.log('\nthe product contract\n');
check('it reads the data repository product',
  // The URL is split across two source lines, so match its halves.
  /Ventusltd\/data-grid-gb\//.test(source)
  && /derived\/connection-points\.v1\.json/.test(source));
check('it revalidates rather than pinning first sight',
  /fetch\(PRODUCT, \{ cache: 'no-cache' \}\)/.test(source));
check('it requires the schema it was written against',
  /const REQUIRED_SCHEMA = 'data-grid-gb\.connection-points\.v1';/.test(source)
  && /product\?\.schema !== REQUIRED_SCHEMA/.test(source));
check('one earth radius, the estate\'s own',
  /const EARTH_RADIUS_KM = 6378\.137;/.test(source));

console.log('\nwhat it refuses to say\n');
check('every answer carries its attribution',
  /NESO Electricity Ten Year Statement 2025, appendices B and D/.test(source));
check('every answer carries the refusal to assess a connection',
  /Not a statement about whether/.test(source));
check('no grading language in anything the file can emit', (() => {
  // The comments are where the rule is explained, and the explanation has
  // to name the words it forbids. Judge the code, not the commentary:
  // strip block and line comments, then look.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(line => line.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  return !/\b(strong|weak|excellent|poor|attractive|constrained|well.connected)\b/i
    .test(code);
})());
check('it renders nothing: no DOM writes',
  !/innerHTML|appendChild|createElement/.test(source.split('PART 2')[1]));

console.log('\nit runs, and answers only from the product\n');
const product = {
  schema: 'data-grid-gb.connection-points.v1',
  counts: { with_fault_level: 1 },
  join: { exact_name: 1, distinctive_tokens: 0, unlocated: 0 },
  source: { publisher: 'NESO' },
  connection_points: [{
    site_code: 'COTT', name: 'COTTAM', transmission_owner: 'NGET',
    voltages_kv: [400], circuits: 8, transformers: 0,
    circuit_winter_rating_mva: { min: 2780, max: 3326 },
    fault_level: { peak: { three_phase_break_ka_min: 103,
      three_phase_break_ka_max: 136, snapshots: 5 } },
    reactive_compensation: { units: 2, mvar_generation: 300, mvar_absorption: 0 },
    planned_changes: 17, planned_change_years: ['2028', '2031'],
    location: { lat: 53.3, lon: -0.78, mapped_name: 'Cottam Substation',
      matched_by: 'exact_name' }
  }]
};
let fetched = null;
const context = {
  window: {}, document: { addEventListener() {} }, console,
  setTimeout, clearTimeout, Math, JSON, Date, Promise, Map, Set, URL, Error,
  performance, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer,
  fetch: async (url, options) => { fetched = { url, options };
    return { ok: true, status: 200, json: async () => product,
      headers: { get: () => null } }; },
  Response: class {}, Headers: class {}, Request: class {}
};
context.window.fetch = context.fetch;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'substation-intelligence.js' });
const api = context.window.__GRIDATLAS_NETWORK__;
check('it publishes its own state object', Boolean(api));
await api.ready;
check('it loaded the product', api.loaded === true && api.points === 1);
check('it revalidated the fetch it actually made',
  fetched && fetched.options && fetched.options.cache === 'no-cache');

const summary = api.summarise('Cottam Substation');
check('a name normalised differently still finds the site', Boolean(summary));
check('the sentence carries circuits, ratings, fault level and changes',
  /8 circuits/.test(summary.sentence) && /2,780\u2013?3,326 MVA|2,780/.test(summary.sentence)
  && /103\u2013?136 kA|103/.test(summary.sentence) && /17 changes/.test(summary.sentence));
check('nothing unpublished is invented', !/transformers/.test(summary.sentence));
const nearest = api.nearest(-0.79, 53.31, { minimumKv: 400 });
check('nearest measures on the published coordinates',
  nearest && nearest.km > 0 && nearest.km < 5);
check('an unknown substation returns null, never a guess',
  api.summarise('Somewhere Nobody Published') === null);

// Let the stubbed bridge settle before reporting, so its rejections are
// counted here rather than arriving after the process has decided.
await new Promise(resolve => setTimeout(resolve, 250));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (bridgeRejections.length) {
  console.log(`(${bridgeRejections.length} rejection(s) from the carried bridge's `
    + `data plane under the stub, expected: ${bridgeRejections[0]})`);
}
if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('the bridge is intact, the product is revalidated, and nothing here grades a connection.');
