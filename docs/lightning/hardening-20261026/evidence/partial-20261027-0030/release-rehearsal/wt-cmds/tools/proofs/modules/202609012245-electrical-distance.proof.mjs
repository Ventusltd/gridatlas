/**
 * Proof for the electrical-distance module.
 *
 * Run against the REAL published payload, not a fixture. A fixture proves
 * the code agrees with a shape I wrote, and the defect class this estate
 * keeps finding is code agreeing with itself. The counts below were read
 * off the product by survey before this file was written:
 *
 *   921 sites, 2,679 nodes, 1,392 circuits, 1,472 transformers,
 *   2,230 planned changes; 649 nodes publish a null voltage_kv and
 *   voltage_consistent_with_site is false on roughly a quarter of them;
 *   voltage_ratio_kv is published on 140 of 1,472 transformers; and
 *   NO field anywhere in either product expresses headroom, spare
 *   capacity or availability.
 *
 * A skip is not a pass: if the sibling data-grid-gb checkout is absent
 * this proof FAILS. It does not quietly report success on the half of
 * itself it could still run.
 *
 *   node tools/proofs/modules/202609012245-electrical-distance.proof.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const PRODUCT = resolve(ROOT, '..', 'data-grid-gb', 'derived', 'gb-transmission-network.v1.json');

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  [PASS] ${name}`); }
  else { failures.push(`${name}${detail ? ' - ' + detail : ''}`); console.log(`  [FAIL] ${name}${detail ? ' - ' + detail : ''}`); }
}

/* ── load the two modules into a window, as the page does ───────────── */
const TOPOLOGY = process.env.GRIDATLAS_TOPOLOGY_MODULE
  || 'atlas/modules/202609012245-network-topology.js';
const DISTANCE = 'atlas/modules/202609012245-electrical-distance.js';

const window = { __GRIDATLAS_MODULES__: {} };
for (const rel of [TOPOLOGY, DISTANCE]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.error(`missing module: ${rel}`); process.exit(1); }
  new Function('window', readFileSync(path, 'utf8'))(window);
}
const NS = window.__GRIDATLAS_MODULES__;
const topology = NS.networkTopology;
const distance = NS.electricalDistance;

console.log('\nthe module is what it says it is\n');

check('both modules registered', !!topology && !!distance);
check('the distance module declares the graph contract it requires',
  distance.requires === 'gridatlas.module.network-topology.graph.v1');
check('it says a hop is not a distance', /not a distance/i.test(distance.not_a_distance));
check('it says a path is not a capacity', /says nothing about whether/i.test(distance.not_a_capacity));

/* The structural discipline: no arithmetic over the impedance fields.
   Carrying a published parameter is publishing; adding them is the first
   line of a load flow, and a load flow needs a declared model, base
   values, taps, generation and load assumptions, contingencies and
   validation against a trusted solver - none of which are in this file. */
const source = readFileSync(join(ROOT, DISTANCE), 'utf8');
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
check('the module contains no impedance arithmetic',
  !/(r_pct|x_pct|b_pct)\w*\s*[+\-*/]/.test(codeOnly)
  && !/[+\-*/]\s*\w*(r_pct|x_pct|b_pct)/.test(codeOnly));
check('the module never reduces or sums a parameter list',
  !/parameters[\s\S]{0,80}\.reduce\(/.test(codeOnly));
check('it never fetches and never renders',
  !/\b(fetch|document|innerHTML|XMLHttpRequest)\b/.test(codeOnly));
check('it never decodes a voltage from a node code',
  !/voltage_digit|charAt|\.slice\(4/.test(codeOnly));
/* Not "the word never appears" - the whole point of the disclaimers is to
   use those words in order to deny them, and a check that bans the word
   outright is a check that gets the denial deleted rather than the claim.
   What must never exist is an ASSERTION: a field, variable or key naming
   headroom. The words are permitted only inside the NOT_A_* constants. */
const denials = (codeOnly.match(/const NOT_A_[A-Z_]+\s*=[\s\S]*?;/g) || []).join('\n');
const outsideDenials = codeOnly.split(/const NOT_A_[A-Z_]+\s*=[\s\S]*?;/).join(' ');
check('the denials do deny headroom rather than staying silent about it',
  /spare/i.test(denials) && /says nothing about whether/i.test(denials));
check('nothing outside the denials speaks of headroom, spare or availability',
  !/headroom|spare|available/i.test(outsideDenials));
check('no key or identifier in the module names headroom',
  !/\b\w*(headroom|spare_|available_)\w*\b/i.test(codeOnly));

/* ── behaviour, on a graph built by hand for the edge cases ─────────── */
console.log('\nthe rule that only a transformer may change voltage\n');

function fakeIndex(nodes, edges, sites) {
  const byNode = new Map();
  for (const e of edges) {
    for (const [near, far] of [['node_1', 'node_2'], ['node_2', 'node_1']]) {
      const n = e.row[near];
      if (!byNode.has(n)) byNode.set(n, []);
      byNode.get(n).push({ kind: e.kind, row: e.row, near, far });
    }
  }
  return {
    site: (key) => sites.find(s => s.code === String(key).toUpperCase()) || null,
    graph: () => ({
      schema: 'gridatlas.module.network-topology.graph.v1',
      has: (n) => nodes.some(x => x.node === n),
      nodeVoltageKv: (n) => {
        const node = nodes.find(x => x.node === n);
        if (!node || node.voltage_consistent_with_site !== true) return null;
        return Number.isFinite(node.voltage_kv) ? node.voltage_kv : null;
      },
      nodeSiteCode: (n) => (nodes.find(x => x.node === n) || {}).site_code || null,
      edgesAt: (n) => (byNode.get(n) || []).filter(e => e.kind !== 'planned_change'),
      nodesOfSite: (c) => nodes.filter(x => x.site_code === c).map(x => x.node).sort(),
      siteByCode: (c) => sites.find(s => s.code === c) || null,
      ratingsOf: (row) => (Number.isFinite(row.winter_mva) ? { winter: row.winter_mva } : null),
      parametersOf: (row) => (Number.isFinite(row.x_pct_100mva) ? { x_pct: row.x_pct_100mva } : null)
    })
  };
}

const N = (node, site_code, voltage_kv, ok = true) =>
  ({ node, site_code, voltage_kv, voltage_consistent_with_site: ok });

/* A: two 400 kV nodes joined by a circuit - one legal hop. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 3000, x_pct_100mva: 1.2 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB');
  check('a circuit between two 400 kV nodes is one hop', r.reached === true && r.hops === 1);
  check('the hop names both nodes and both sites',
    r.path[0].from_node === 'AAA4-' && r.path[0].to_site_code === 'BBB');
  check('the hop carries the published rating and parameter, unaltered',
    r.path[0].ratings_mva.winter === 3000 && r.path[0].parameters_pct_100mva.x_pct === 1.2);
  check('no voltage changed and no transformer was crossed',
    r.voltage_changes === 0 && r.transformers_crossed === 0);
}

/* B: a CIRCUIT whose two ends declare different voltages - refused. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB1-', 'BBB', 132)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB1-', winter_mva: 100 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB');
  check('a circuit that appears to change voltage is NOT walked', r.reached === false);
  check('the refusal is recorded, not swallowed',
    r.refusals.length === 1 && /only a transformer may change voltage/.test(r.refusals[0].reason));
  check('the refusal names both voltages it saw',
    /400 kV and 132 kV/.test(r.refusals[0].reason));
}

/* C: the SAME voltage change, across a transformer - legal and named. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('AAA1-', 'AAA', 132), N('BBB1-', 'BBB', 132)],
    [{ kind: 'transformer', row: { node_1: 'AAA4-', node_2: 'AAA1-', rating_mva: 240, voltage_ratio_kv: '400/132', x_pct_100mva: 24.7 } },
     { kind: 'circuit', row: { node_1: 'AAA1-', node_2: 'BBB1-', winter_mva: 200 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB', { voltageKv: 400 });
  check('from a 400 kV node the path reaches a 132 kV site through the transformer',
    r.reached === true && r.hops === 2);
  check('the transformer is named as the thing that changed the voltage',
    r.path[0].kind === 'transformer' && r.path[0].voltage_changed === true
    && r.transformers_crossed === 1 && r.voltage_changes === 1);
  check('the transformer carries its PUBLISHED ratio, not a reconstructed one',
    r.path[0].voltage_ratio_kv === '400/132');
  check('the transformer carries its own rating field',
    r.path[0].transformer_rating_mva === 240);
}

/* D: a transformer with no published ratio reports null, never a guess. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB1-', 'BBB', 132)],
    [{ kind: 'transformer', row: { node_1: 'AAA4-', node_2: 'BBB1-', rating_mva: 120 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB');
  check('an unpublished voltage ratio is null, not reconstructed from the nodes',
    r.reached === true && r.path[0].voltage_ratio_kv === null
    && r.path[0].from_voltage_kv === 400 && r.path[0].to_voltage_kv === 132);
}

/* E: an UNDECLARED voltage is not a voltage change. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB2-', 'BBB', 275, false)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB2-', winter_mva: 500 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB');
  check('a node whose site does not vouch for its voltage is undeclared, not 275',
    r.reached === true && r.path[0].to_voltage_kv === null);
  check('an undeclared end is not treated as a voltage change',
    r.path[0].voltage_changed === false && r.refusals.length === 0);
}

/* F: planned changes are not paths. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400)],
    [{ kind: 'planned_change', row: { node_1: 'AAA4-', node_2: 'BBB4-', year: '2030', status: 'Addition' } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = distance.between(idx, 'AAA', 'BBB');
  check('a circuit published for 2030 is not a path a current can take today',
    r.reached === false);
}

/* G: hop limits and unknown sites fail closed. */
{
  const idx = fakeIndex([N('AAA4-', 'AAA', 400)], [], [{ code: 'AAA', name: 'ALPHA' }]);
  check('an unknown site is null, not an empty answer', distance.between(idx, 'AAA', 'ZZZ') === null);
  check('an index without a graph is refused', distance.between({ site: () => ({}) }, 'AAA', 'AAA') === null);
  const same = distance.between(idx, 'AAA', 'AAA');
  check('the same site is zero hops and says so', same.reached === true && same.hops === 0);
}

/* ── the real payload ────────────────────────────────────────────────── */
console.log('\nthe published network, 921 sites and 2,679 nodes\n');

if (!existsSync(PRODUCT)) {
  console.error(`\nFAILED: the published product is not at ${PRODUCT}.`);
  console.error('A skip is not a pass. Check out Ventusltd/data-grid-gb beside this');
  console.error('repository; this proof does not report success on half of itself.');
  process.exit(1);
}

const product = JSON.parse(readFileSync(PRODUCT, 'utf8'));
const index = topology.index(product);
check('the topology module accepts the published schema', !!index);
check('the index hands out a graph', typeof index.graph === 'function'
  && index.graph().schema === 'gridatlas.module.network-topology.graph.v1');

const graph = index.graph();
check('the graph reports the published node count', index.counts.nodes === 2679);
check('the graph reports the published site count', index.counts.sites === 921);

/* The one-hop view and the traversal must agree about the first hop. A
   disagreement here is the two-implementations bug this estate has paid
   for once already, so it is asserted rather than assumed. */
const WB = index.at('WBUR', { voltageKv: 400 });
check('West Burton resolves at 400 kV', !!WB && WB.counts.nodes > 0);
const oneHopSites = new Set((WB.neighbours || []).map(n => n.code).filter(Boolean));
const walked = distance.within(index, 'WBUR', { hops: 1, voltageKv: 400 });
check('the traversal finds neighbours at one hop', walked && walked.sites.length > 0);
check('every site the traversal reaches in one hop is a site the one-hop view already named',
  walked.sites.every(s => oneHopSites.size === 0 || oneHopSites.has(s.code)),
  `walked=${walked.sites.map(s => s.code).join(',')} view=${[...oneHopSites].join(',')}`);
check('every one-hop site is reported at exactly one hop',
  walked.sites.every(s => s.hops === 1));

const two = distance.within(index, 'WBUR', { hops: 2, voltageKv: 400 });
check('two hops reaches at least as many sites as one', two.sites.length >= walked.sites.length);
check('the hop at which each site was first reached is recorded',
  two.sites.every(s => s.hops === 1 || s.hops === 2));
/* Same distinction in the answer: no KEY may name headroom, and the words
   may appear only inside the two denial fields the answer carries. */
check('no key in the neighbourhood answer names headroom or spare capacity',
  !Object.keys(two).some(k => /headroom|spare|available/i.test(k))
  && !two.sites.some(s => Object.keys(s).some(k => /headroom|spare|available/i.test(k))));
check('the only mention of spare capacity in the answer is the denial of it', (() => {
  const stripped = JSON.stringify(Object.assign({}, two,
    { not_a_capacity: '', not_a_distance: '' }));
  return !/headroom|spare|available/i.test(stripped);
})());
check('the neighbourhood carries its own refusal to imply capacity',
  /says nothing about whether/i.test(two.not_a_capacity));

/* A real path between two real sites, every hop citable. */
const target = two.sites.find(s => s.hops === 2) || two.sites[0];
if (target) {
  const path = distance.between(index, 'WBUR', target.code, { voltageKv: 400, maxHops: 4 });
  check(`a path from WBUR to ${target.code} is found and is citable`,
    path.reached === true && path.path.length > 0);
  check('every hop names two real nodes',
    path.path.every(h => graph.has(h.from_node) && graph.has(h.to_node)));
  check('every hop is a circuit or a transformer, never a planned change',
    path.path.every(h => h.kind === 'circuit' || h.kind === 'transformer'));
  check('every voltage change on the path is across a transformer',
    path.path.every(h => !h.voltage_changed || h.kind === 'transformer'));
  check('the path carries no summed impedance anywhere in its answer',
    !('total_impedance' in path) && !('x_total' in path)
    && !JSON.stringify(path).includes('"impedance_sum"'));
} else {
  check('a real path was available to test', false, 'no neighbour found');
}

/* ── the successor answers exactly as the incumbent ──────────────────
   202609012245-network-topology.js was produced FROM the bytes of
   202609012145 by insertion only, and this is the assertion that says so
   behaviourally rather than by inspection. Both are loaded, both index
   the same 10 MB payload, and at() is compared value for value across
   every site the product publishes. A successor that answered even one
   site differently would be a silent change to a shipped computation. */
console.log('\nthe successor is the incumbent, plus a handle\n');

const INCUMBENT = 'atlas/modules/202609012145-network-topology.js';
if (!existsSync(join(ROOT, INCUMBENT))) {
  check('the incumbent module is present to compare against', false, INCUMBENT);
} else {
  const w2 = { __GRIDATLAS_MODULES__: {} };
  new Function('window', readFileSync(join(ROOT, INCUMBENT), 'utf8'))(w2);
  const old = w2.__GRIDATLAS_MODULES__.networkTopology;
  const oldIndex = old.index(product);

  check('the incumbent has no graph handle, and the successor does',
    typeof oldIndex.graph !== 'function' && typeof index.graph === 'function');
  check('both index the same counts', JSON.stringify(oldIndex.counts) === JSON.stringify(index.counts));

  let compared = 0;
  const differed = [];
  for (const site of product.sites) {
    const a = JSON.stringify(oldIndex.at(site.code));
    const b = JSON.stringify(index.at(site.code));
    compared += 1;
    if (a !== b) differed.push(site.code);
    if (differed.length > 3) break;
  }
  check(`at() is identical on all ${compared} published sites`,
    differed.length === 0, differed.join(','));
  check('every published site was actually compared, not a sample',
    compared === product.sites.length);
}

/* The whole point: electrical distance and geographic distance are
   different questions, and the module must not be quietly reproducing
   the geographic one. */
check('the answer never carries a kilometre figure',
  !/_km\b/.test(JSON.stringify(distance.within(index, 'WBUR', { hops: 1 }))));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('a hop is a published circuit, a voltage changes only across a named');
console.log('transformer, and nothing here is a distance or a capacity.');
