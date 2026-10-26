/**
 * Proof for the owner-boundary module.
 *
 * Two things must hold and are asserted by construction on small products
 * built by hand: an owner is never inferred (a null is unknown, a circuit
 * with an unknown end is undetermined), and a boundary circuit is named
 * with BOTH owners. Then the real product: 62 boundary circuits and 10
 * boundary transformers by node owner, 49 nodes with no published owner
 * all on placeholder site codes, and seven circuits whose own owner
 * matches neither end.
 *
 * The harness builds a PRODUCT, not a fake index, because node ownership
 * is not something the topology graph hands out; the topology module is
 * loaded and the fake product goes through it, so the site, node and
 * voltage discipline under test is the real one.
 *
 * A skip is not a pass: if the sibling data-grid-gb checkout is absent
 * this FAILS.
 *
 *   node tools/proofs/modules/202609012350-owner-boundary.proof.mjs
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

const TOPOLOGY = 'atlas/modules/202609012245-network-topology.js';
const OWNER = 'atlas/modules/202609012350-owner-boundary.js';

const window = { __GRIDATLAS_MODULES__: {} };
for (const rel of [TOPOLOGY, OWNER]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.error(`missing module: ${rel}`); process.exit(1); }
  new Function('window', readFileSync(path, 'utf8'))(window);
}
const NS = window.__GRIDATLAS_MODULES__;
const owner = NS.ownerBoundary;

console.log('\nthe module is what it says it is\n');

check('the module registered and froze its surface', !!owner && Object.isFrozen(owner));
check('it names the one product it reads', owner.accepts === 'data-grid-gb.transmission-network.v1');
check('it says ownership is not a counterparty', /not a statement about who a project would contract with/.test(owner.not_a_counterparty));
check('it says an owner is never inferred', /nothing is read from a site name, a node code or a neighbour/.test(owner.never_inferred));
check('it carries the not-an-assessment discipline', /says nothing about whether any project can connect/.test(owner.not_an_assessment));

const source = readFileSync(join(ROOT, OWNER), 'utf8');
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

check('the module contains no impedance arithmetic',
  !/(r_pct|x_pct|b_pct)\w*\s*[+\-*/]/.test(codeOnly)
  && !/[+\-*/]\s*\w*(r_pct|x_pct|b_pct)/.test(codeOnly));
check('the module never reduces a parameter or rating list',
  !/parameters[\s\S]{0,80}\.reduce\(/.test(codeOnly) && !/ratings[\s\S]{0,80}\.reduce\(/.test(codeOnly));
check('no arithmetic operator is applied to a rating value', !/_mva\s*[+\-*/]/.test(codeOnly));
check('it never fetches, never renders and never waits',
  !/\b(fetch|document|innerHTML|XMLHttpRequest|setTimeout|setInterval|requestAnimationFrame)\b/.test(codeOnly));
check('it never decodes a voltage from a node code',
  !/voltage_digit|charAt|\.slice\(4|node_code_convention/.test(codeOnly));
/* An owner may come from a transmission_owner field and nowhere else. The
   module must not consult a site NAME, a node NAME or any lookup table of
   its own to fill one in. */
check('the only source of an owner is a transmission_owner field',
  !/\bsite_name\b|\.site_name\b|\.name\s*[=!]==?|OFFSHORE|ONSHORE/.test(codeOnly)
  && !/(NGET|SHET|SPT|OFTO)\s*[:=]/.test(codeOnly));
check('the owner values are not hard-coded as a list to default to',
  !/\[\s*'(NGET|SHET|SPT|OFTO)'/.test(codeOnly));
const denials = (codeOnly.match(/const (?:NOT_[A-Z_]+|NEVER_INFERRED)\s*=[\s\S]*?;/g) || []).join('\n');
const outsideDenials = codeOnly.split(/const (?:NOT_[A-Z_]+|NEVER_INFERRED)\s*=[\s\S]*?;/).join(' ');
check('the denials were found and they deny spare capacity',
  denials.length > 200 && /spare allowance/.test(denials));
check('nothing outside the denials speaks of headroom, spare or availability',
  !/headroom|spare|available|availability/i.test(outsideDenials));
check('no key or identifier in the module names headroom',
  !/\b\w*(headroom|spare_|available_)\w*\b/i.test(codeOnly));

console.log('\nit fails closed\n');

check('an unrecognised schema yields no index', owner.index({ schema: 'something.else.v9' }) === null);
check('a v2 of the same product is refused until it is read for',
  owner.index({ schema: 'data-grid-gb.transmission-network.v2', nodes: [] }) === null);
check('null and undefined are refused', owner.index(null) === null && owner.index(undefined) === null);

/* ── behaviour, on products built by hand ───────────────────────────── */
console.log('\nbehaviour, on products built for the edge cases\n');

const N = (node, site_code, voltage_kv, transmission_owner, ok = true) =>
  ({ node, site_code, site_name: null, transmission_owner, voltage_kv, voltage_consistent_with_site: ok });
const S = (code, name, transmission_owner) => ({ code, name, transmission_owner, voltages_kv: [] });
function fakeProduct({ nodes = [], sites = [], circuits = [], transformers = [], planned_changes = [] }) {
  return { schema: 'data-grid-gb.transmission-network.v1', nodes, sites, circuits, transformers, planned_changes };
}

/* A: a boundary circuit, both owners named. */
{
  const idx = owner.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400, 'SHET'), N('BBB4-', 'BBB', 400, 'SPT'), N('CCC4-', 'CCC', 400, 'SHET')],
    sites: [S('AAA', 'ALPHA', 'SHET'), S('BBB', 'BETA', 'SPT'), S('CCC', 'GAMMA', 'SHET')],
    circuits: [
      { node_1: 'AAA4-', node_2: 'BBB4-', transmission_owner: 'SPT', winter_mva: 1500, circuit_type: 'OHL', ohl_km: 30, x_pct_100mva: 2.1 },
      { node_1: 'AAA4-', node_2: 'CCC4-', transmission_owner: 'SHET', winter_mva: 1200 }
    ]
  }));
  const r = idx.at('AAA');
  check('the site reports its own published owner', r.site.transmission_owner === 'SHET');
  check('exactly one circuit is a boundary', r.counts.boundary_circuits === 1 && r.boundary_circuits.length === 1);
  const b = r.boundary_circuits[0];
  check('the boundary circuit names both owners', b.from_owner === 'SHET' && b.to_owner === 'SPT' && b.ends === 'boundary');
  check('the boundary circuit names both sites', b.from_site_code === 'AAA' && b.to_site_code === 'BBB' && b.to_site_name === 'BETA');
  check('the circuit\'s own owner is carried separately from the owners of its ends',
    b.asset_owner === 'SPT' && b.asset_owner_matches_an_end === true);
  check('its rating and parameter are carried, unaltered',
    b.ratings_mva.winter === 1500 && b.parameters_pct_100mva.x_pct === 2.1 && b.ohl_km === 30);
  check('the internal circuit is not listed as a boundary', !r.boundary_circuits.some(c => c.to_node === 'CCC4-'));
  check('assets are counted per owner at the site: one SPT circuit and one SHET circuit',
    r.by_voltage[0].by_owner.SPT.circuits === 1 && r.by_voltage[0].by_owner.SHET.circuits === 1);
  check('the node is counted under its own owner', r.by_voltage[0].by_owner.SHET.nodes === 1);
  check('both owners are listed as present', r.owners_present.join(',') === 'SHET,SPT');
  check('the far site sees the same boundary from its side',
    idx.at('BBB').boundary_circuits[0].from_owner === 'SPT' && idx.at('BBB').boundary_circuits[0].to_owner === 'SHET');
  check('the answer carries the counterparty denial', /not a statement about who a project would contract with/.test(r.not_a_counterparty));
}

/* B: a null owner is unknown, never guessed - not from the site, not from
   the far end, not from the circuit. */
{
  const idx = owner.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400, 'NGET'), N('OFFSHORE 220KV-1', 'OFFS', null, null, false)],
    sites: [S('AAA', 'ALPHA', 'NGET')],
    circuits: [{ node_1: 'AAA4-', node_2: 'OFFSHORE 220KV-1', transmission_owner: 'OFTO', winter_mva: 400 }]
  }));
  const r = idx.at('AAA');
  check('a circuit to a node with no published owner is undetermined, not a boundary',
    r.counts.boundary_circuits === 0 && r.counts.undetermined === 1);
  const u = r.undetermined[0];
  check('the unknown end is reported as unknown, not as OFTO from the circuit and not as NGET from the site',
    u.to_owner === 'unknown' && u.ends === 'undetermined');
  check('whether the asset owner matches an end is null when an end is unknown',
    u.asset_owner_matches_an_end === null);
  check('the asset is still counted under its own published owner', r.by_voltage[0].by_owner.OFTO.circuits === 1);
  check('the far node with no site is carried with its code and no invented name',
    u.to_site_code === 'OFFS' && u.to_site_name === null);
  check('its voltage is undeclared, not decoded from "220KV" in the node name', u.to_voltage_kv === null);
  /* and a null owner ON the queried site's own node */
  const idx2 = owner.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400, null)],
    sites: [S('AAA', 'ALPHA', 'NGET')]
  }));
  const r2 = idx2.at('AAA');
  check('a node with no published owner is unknown even when its site publishes one',
    r2.nodes[0].transmission_owner === 'unknown' && r2.counts.nodes_with_unknown_owner === 1
    && r2.by_voltage[0].by_owner.unknown.nodes === 1);
}

/* C: an asset whose owner matches neither end. */
{
  const idx = owner.index(fakeProduct({
    nodes: [N('HUNN2A', 'HUNN', 275, 'SHET'), N('HUNN2C', 'HUNN', 275, 'SHET')],
    sites: [S('HUNN', 'HUNTERSTON', 'SHET')],
    circuits: [{ node_1: 'HUNN2A', node_2: 'HUNN2C', transmission_owner: 'SPT' }]
  }));
  const r = idx.at('HUNN');
  check('an internal circuit between two SHET nodes is not a boundary', r.counts.boundary_circuits === 0);
  check('but its own owner differing from both ends is reported as exactly that',
    r.counts.asset_owner_differs_from_both_ends === 1
    && r.asset_owner_differs_from_both_ends[0].asset_owner === 'SPT'
    && r.asset_owner_differs_from_both_ends[0].asset_owner_matches_an_end === false);
  check('the circuit is counted under SPT, its published owner, not under the site\'s',
    r.by_voltage[0].by_owner.SPT.circuits === 1 && !r.by_voltage[0].by_owner.SHET.circuits);
}

/* D: per voltage, never across; a boundary transformer. */
{
  const idx = owner.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400, 'NGET'), N('AAA1-', 'AAA', 132, 'NGET'), N('AAA2-', 'AAA', 275, 'NGET', false),
      N('BBB4-', 'BBB', 400, 'SPT'), N('CCC1-', 'CCC', 132, 'NGET'), N('DDD1-', 'DDD', 132, 'OFTO')],
    sites: [S('AAA', 'ALPHA', 'NGET'), S('BBB', 'BETA', 'SPT'), S('CCC', 'GAMMA', 'NGET'), S('DDD', 'DELTA', 'OFTO')],
    circuits: [
      { node_1: 'AAA4-', node_2: 'BBB4-', transmission_owner: 'NGET' },
      { node_1: 'AAA1-', node_2: 'CCC1-', transmission_owner: 'NGET' }
    ],
    transformers: [
      { node_1: 'AAA4-', node_2: 'AAA1-', transmission_owner: 'NGET', rating_mva: 240 },
      { node_1: 'AAA1-', node_2: 'DDD1-', transmission_owner: 'OFTO', rating_mva: 90, voltage_ratio_kv: '132/33' }
    ]
  }));
  const all = idx.at('AAA');
  const at400 = idx.at('AAA', { voltageKv: 400 });
  const at132 = idx.at('AAA', { voltageKv: 132 });
  check('voltages are bands, highest first, undeclared last',
    all.by_voltage.map(b => b.voltage_kv).join(',') === '400,132,');
  /* the internal 400/132 transformer is met first at AAA1- in sorted
     node order, so it is counted in the 132 kV band and not the 400 */
  check('the 400 kV band counts one circuit and no transformer, the 132 kV band one circuit and two transformers',
    all.by_voltage[0].circuits === 1 && all.by_voltage[0].transformers === 0
    && all.by_voltage[1].circuits === 1 && all.by_voltage[1].transformers === 2);
  check('an internal transformer is counted once, under the voltage it was first met at',
    all.counts.transformers === 2);
  check('scoped to 400 kV, only the 400 kV boundary is reported',
    at400.counts.boundary_circuits === 1 && at400.boundary_circuits[0].to_owner === 'SPT'
    && at400.counts.boundary_transformers === 0);
  check('scoped to 132 kV, the boundary transformer to OFTO is reported with both owners',
    at132.counts.boundary_transformers === 1 && at132.boundary_transformers[0].from_owner === 'NGET'
    && at132.boundary_transformers[0].to_owner === 'OFTO' && at132.boundary_transformers[0].rating_mva === 90
    && at132.boundary_transformers[0].voltage_ratio_kv === '132/33');
  check('a node the site does not vouch for is counted as undeclared, never as 275',
    all.by_voltage[2].voltage_kv === null && all.by_voltage[2].nodes === 1
    && idx.at('AAA', { voltageKv: 275 }).counts.nodes === 0);
  check('the unscoped scope says no count spans two voltages', /no count here spans two voltages/.test(all.scope));
  check('an unknown site is null', idx.at('ZZZ') === null);
  const list = idx.boundaries();
  check('the product-wide list names each boundary branch once with both owners',
    list.counts.boundary_circuits === 1 && list.counts.boundary_transformers === 1
    && list.counts.by_owner_pair['NGET/SPT'] === 1 && list.counts.by_owner_pair['NGET/OFTO'] === 1);
}

/* ── the real payload ────────────────────────────────────────────────── */
console.log('\nthe published network, four owners\n');

if (!existsSync(PRODUCT)) {
  console.error(`\nFAILED: the published product is not at ${PRODUCT}.`);
  console.error('A skip is not a pass. Check out Ventusltd/data-grid-gb beside this repository;');
  console.error('this proof does not report success on half of itself.');
  process.exit(1);
}

const product = JSON.parse(readFileSync(PRODUCT, 'utf8'));
const idx = owner.index(product);
check('the module accepts the published schema', !!idx);
check('the index counts every published node', idx.counts.nodes === 2679);
check('the four owners and unknown are the only node owner values',
  Object.keys(idx.counts.nodes_by_owner).sort().join(',') === 'NGET,OFTO,SHET,SPT,unknown');
check('49 nodes publish no owner', idx.counts.nodes_by_owner.unknown === 49, String(idx.counts.nodes_by_owner.unknown));

/* The 49 are all on codes the product does not list as sites, so no
   listed site can ever have a node of unknown owner. Verified on the
   product, then asserted through the module. */
const siteCodes = new Set(product.sites.map(s => s.code));
const nullNodes = product.nodes.filter(n => !n.transmission_owner);
check('every unowned node is on a code the product does not list as a site',
  nullNodes.every(n => !siteCodes.has(n.site_code)),
  [...new Set(nullNodes.map(n => n.site_code))].join(','));

/* Independent recount of the boundary branches. */
const nodeOwner = new Map(product.nodes.map(n => [n.node, n.transmission_owner || null]));
const isBoundary = (r) => {
  const a = nodeOwner.get(r.node_1), b = nodeOwner.get(r.node_2);
  return a && b && a !== b;
};
const expectedCircuits = product.circuits.filter(isBoundary).length;
const expectedTransformers = product.transformers.filter(isBoundary).length;
const list = idx.boundaries();
check(`the module finds every boundary circuit (${list.counts.boundary_circuits})`,
  list.counts.boundary_circuits === expectedCircuits, `${list.counts.boundary_circuits} vs ${expectedCircuits}`);
check(`the module finds every boundary transformer (${list.counts.boundary_transformers})`,
  list.counts.boundary_transformers === expectedTransformers, `${list.counts.boundary_transformers} vs ${expectedTransformers}`);
check('the survey figure of 62 boundary circuits holds', expectedCircuits === 62, String(expectedCircuits));
check('every boundary branch names two different published owners, neither unknown',
  list.branches.every(b => b.from_owner !== b.to_owner && b.from_owner !== 'unknown' && b.to_owner !== 'unknown'));
check('no existing branch has an undetermined end on the real network',
  product.circuits.every(r => nodeOwner.get(r.node_1) && nodeOwner.get(r.node_2))
  && product.transformers.every(r => nodeOwner.get(r.node_1) && nodeOwner.get(r.node_2)));
check('the owner pairs are the seams one would expect: SHET/SPT, NGET/SPT, and each with OFTO',
  ['SHET/SPT', 'NGET/SPT', 'NGET/OFTO', 'OFTO/SHET'].every(p => list.counts.by_owner_pair[p] > 0),
  JSON.stringify(list.counts.by_owner_pair));
check('there is no NGET/SHET seam - they do not share a border',
  !list.counts.by_owner_pair['NGET/SHET']);

/* Each boundary branch must be visible from BOTH of its sites. */
let bothSides = 0;
let oneSided = [];
for (const b of list.branches) {
  const sides = [b.from_site_code, b.to_site_code].filter(c => siteCodes.has(c));
  let seen = 0;
  for (const code of sides) {
    const r = idx.at(code);
    const pool = b.kind === 'circuit' ? r.boundary_circuits : r.boundary_transformers;
    if (pool.some(x => [x.from_node, x.to_node].sort().join('|') === [b.from_node, b.to_node].sort().join('|'))) seen += 1;
  }
  if (seen === sides.length) bothSides += 1; else oneSided.push(`${b.from_node}-${b.to_node}`);
}
check(`every boundary branch is reported from every listed site it touches (${bothSides} of ${list.branches.length})`,
  oneSided.length === 0, oneSided.join(','));

/* The seven circuits whose own owner matches neither end. */
const neither = product.circuits.filter(r => {
  const a = nodeOwner.get(r.node_1), b = nodeOwner.get(r.node_2);
  return a && b && r.transmission_owner !== a && r.transmission_owner !== b;
});
check(`the product publishes circuits whose owner matches neither end (${neither.length})`, neither.length === 7, String(neither.length));
const hunn = idx.at('HUNN');
check('Hunterston reports them as asset-owner-differs, not as boundaries',
  !!hunn && hunn.counts.asset_owner_differs_from_both_ends >= 2
  && hunn.asset_owner_differs_from_both_ends.every(c => c.asset_owner === 'SPT' && c.from_owner === 'SHET' && c.to_owner === 'SHET'));

/* One real seam, in full. */
const bonb = idx.at('BONB');
check('Bonnybridge is a SHET site with a boundary circuit to an SPT node',
  !!bonb && bonb.site.transmission_owner === 'SHET' && bonb.counts.boundary_circuits > 0
  && bonb.boundary_circuits.every(c => c.from_owner === 'SHET' && c.to_owner === 'SPT'));
check('its boundary circuits carry their ratings and parameters as published',
  bonb.boundary_circuits.every(c => c.ratings_mva && Number.isFinite(c.ratings_mva.winter) && c.parameters_pct_100mva));
check('no boundary circuit at Bonnybridge mixes voltages: both ends declared and equal, or an end undeclared',
  bonb.boundary_circuits.every(c => c.from_voltage_kv === null || c.to_voltage_kv === null || c.from_voltage_kv === c.to_voltage_kv));
check('the 400 kV scope reports only 400 kV nodes and their branches',
  idx.at('BONB', { voltageKv: 400 }).nodes.every(n => n.voltage_kv === 400));

/* A wholly internal NGET site has no boundary at all. */
const wbur = idx.at('WBUR');
check('West Burton is NGET throughout with no boundary branch',
  wbur.owners_present.join(',') === 'NGET' && wbur.counts.boundary_circuits === 0 && wbur.counts.boundary_transformers === 0);

/* Per-voltage counts reconcile with the topology view, which counts the
   same branches under the same voltages; a disagreement here would be
   two implementations of "what lands at this voltage". */
const topoWbur = NS.networkTopology.index(product).at('WBUR', { voltageKv: 400 });
const own400 = idx.at('WBUR', { voltageKv: 400 });
/* The topology view counts LANDINGS, so a circuit between two 400 kV
   nodes of the same site appears twice there; this module counts each
   asset once. The reconciliation is on distinct node pairs. */
const topoPairs = new Set(topoWbur.by_voltage.flatMap(b => b.circuits)
  .map(c => [c.from_node, c.to_node].sort().join('|')));
check('the 400 kV circuits at West Burton are the distinct pairs the topology view lands on',
  own400.counts.circuits === topoPairs.size && own400.counts.circuits <= topoWbur.counts.circuits,
  `${own400.counts.circuits} vs ${topoPairs.size} pairs / ${topoWbur.counts.circuits} landings`);

check('no key in a site answer names headroom, spare capacity or availability',
  !JSON.stringify(bonb).replace(/"not_an_assessment":"[^"]*"/, '').match(/headroom|spare|availab/i));
check('the answer carries no kilometre total and no summed rating',
  !/total|_sum\b/i.test(JSON.stringify(bonb)));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('every owner is the published one, every boundary names both of them, and');
console.log('none of it says who anyone would contract with.');
