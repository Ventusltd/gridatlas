/**
 * Proof for the planned-change module.
 *
 * The load-bearing checks are the negative ones: that a planned row is
 * never presented as a circuit that exists, never walked as a path, and
 * never made into a capacity claim. The positive ones - grouping by year
 * then status with real counts, and every published parameter carried -
 * are checked on small products built by hand and then on the real one.
 *
 * The harness here builds a PRODUCT rather than a fake index, because the
 * module reads planned rows that the topology graph deliberately does not
 * hand out; the topology module is loaded and the fake product goes
 * through it, so the site, node and voltage discipline under test is the
 * real one and not a copy.
 *
 * Read off the product by survey before this file was written: 2,230
 * planned rows; years 2026 (180), 2028 (648), 2030 (864), 2033 (538);
 * statuses Addition (1,362), Change (522), Removed (346); assets circuit
 * (1,520), transformer (710); 552 rows on a node pair published today.
 *
 * A skip is not a pass: if the sibling data-grid-gb checkout is absent
 * this FAILS.
 *
 *   node tools/proofs/modules/202609012345-planned-change.proof.mjs
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
const DISTANCE = 'atlas/modules/202609012245-electrical-distance.js';
const PLANNED = 'atlas/modules/202609012345-planned-change.js';

const window = { __GRIDATLAS_MODULES__: {} };
for (const rel of [TOPOLOGY, DISTANCE, PLANNED]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.error(`missing module: ${rel}`); process.exit(1); }
  new Function('window', readFileSync(path, 'utf8'))(window);
}
const NS = window.__GRIDATLAS_MODULES__;
const topology = NS.networkTopology;
const distance = NS.electricalDistance;
const planned = NS.plannedChange;

console.log('\nthe module is what it says it is\n');

check('the module registered and froze its surface', !!planned && Object.isFrozen(planned));
check('it names the one product it reads', planned.accepts === 'data-grid-gb.transmission-network.v1');
check('it declares the graph contract it borrows', planned.requires === 'gridatlas.module.network-topology.graph.v1');
check('it says a plan is not existing infrastructure', /none of it is a path/i.test(planned.not_existing));
check('it says a plan is not a commitment, a consent or a connection date',
  /not a commitment to build, not a consent/.test(planned.not_a_commitment)
  && /not a date on which anything could connect/.test(planned.not_a_commitment));
check('it carries the not-an-assessment discipline', /no published appendix contains/.test(planned.not_an_assessment));

const source = readFileSync(join(ROOT, PLANNED), 'utf8');
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
/* Headroom words are permitted only inside the denial constants. */
const denials = (codeOnly.match(/const NOT_[A-Z_]+\s*=[\s\S]*?;/g) || []).join('\n');
const outsideDenials = codeOnly.split(/const NOT_[A-Z_]+\s*=[\s\S]*?;/).join(' ');
/* The denial says "none of it is a path" - so, outside the denials, the
   module must have no path, hop, frontier or neighbour at all. */
check('it has no traversal: no path, hop, frontier or neighbour',
  !/\b(path|hops?|frontier|neighbours?|reached)\b/.test(outsideDenials));
check('the denials were found and they deny spare capacity',
  denials.length > 200 && /spare allowance/.test(denials));
check('nothing outside the denials speaks of headroom, spare or availability',
  !/headroom|spare|available|availability/i.test(outsideDenials));
check('no key or identifier in the module names headroom',
  !/\b\w*(headroom|spare_|available_)\w*\b/i.test(codeOnly));

console.log('\nit fails closed\n');

check('an unrecognised schema yields no index', planned.index({ schema: 'something.else.v9' }) === null);
check('a v2 of the same product is refused until it is read for',
  planned.index({ schema: 'data-grid-gb.transmission-network.v2', planned_changes: [] }) === null);
check('null and undefined are refused', planned.index(null) === null && planned.index(undefined) === null);

/* ── behaviour, on products built by hand ───────────────────────────── */
console.log('\nbehaviour, on products built for the edge cases\n');

const N = (node, site_code, voltage_kv, ok = true, transmission_owner = 'NGET') =>
  ({ node, site_code, site_name: null, transmission_owner, voltage_kv, voltage_consistent_with_site: ok });
const S = (code, name, owner = 'NGET') => ({ code, name, transmission_owner: owner, voltages_kv: [] });
function fakeProduct({ nodes = [], sites = [], circuits = [], transformers = [], planned_changes = [] }) {
  return { schema: 'data-grid-gb.transmission-network.v1', nodes, sites, circuits, transformers, planned_changes };
}

/* A: three rows at one site across two years and two statuses. */
{
  const idx = planned.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400), N('CCC4-', 'CCC', 400)],
    sites: [S('AAA', 'ALPHA'), S('BBB', 'BETA'), S('CCC', 'GAMMA')],
    circuits: [{ node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 3000, transmission_owner: 'NGET' }],
    planned_changes: [
      { node_1: 'AAA4-', node_2: 'BBB4-', year: '2028', status: 'Change', asset: 'circuit', winter_mva: 3400, summer_mva: 3000, r_pct_100mva: 0.1, x_pct_100mva: 1.2, b_pct_100mva: 5, circuit_type: 'OHL', ohl_km: 40, cable_km: 0, transmission_owner: 'NGET' },
      { node_1: 'AAA4-', node_2: 'CCC4-', year: '2028', status: 'Addition', asset: 'circuit', winter_mva: 2000, x_pct_100mva: 0.8, transmission_owner: 'NGET' },
      { node_1: 'CCC4-', node_2: 'AAA4-', year: '2033', status: 'Removed', asset: 'circuit', transmission_owner: 'NGET' }
    ]
  }));
  check('the index accepts the schema and counts every row once',
    !!idx && idx.counts.planned_changes === 3 && idx.counts.by_year['2028'] === 2 && idx.counts.by_status.Removed === 1);
  const r = idx.at('AAA');
  check('three rows land at the site', r.counts.planned_changes === 3);
  check('years are grouped in ascending order', r.by_year.map(y => y.year).join(',') === '2028,2033');
  check('within a year, statuses are grouped Addition before Change',
    r.by_year[0].by_status.map(s => s.status).join(',') === 'Addition,Change');
  check('the year counts are real', r.by_year[0].counts.entries === 2 && r.by_year[0].counts.by_status.Change === 1);
  check('the top-level tallies agree with the groups',
    r.counts.by_year['2028'] === 2 && r.counts.by_year['2033'] === 1
    && r.counts.by_status.Addition === 1 && r.counts.by_asset.circuit === 3);
  const change = r.by_year[0].by_status.find(s => s.status === 'Change').entries[0];
  check('a change carries its published ratings, unaltered',
    change.ratings_mva.winter === 3400 && change.ratings_mva.summer === 3000);
  check('a change carries R, X and B as published and nothing derived from them',
    change.parameters_pct_100mva.r_pct === 0.1 && change.parameters_pct_100mva.x_pct === 1.2
    && change.parameters_pct_100mva.b_pct === 5);
  check('a change carries circuit type and lengths', change.circuit_type === 'OHL' && change.ohl_km === 40);
  check('every entry is marked as a publication, not as a circuit',
    r.by_year.every(y => y.by_status.every(s => s.entries.every(e => e.publication === 'planned'))));
  check('the change on the existing pair says the pair is published today',
    change.pair_published_today.circuit === true);
  const addition = r.by_year[0].by_status.find(s => s.status === 'Addition').entries[0];
  check('the addition on a pair with nothing today says so', addition.pair_published_today.circuit === false);
  check('the count of rows on a pair published today is surfaced', r.counts.on_a_pair_published_today === 1);
  check('the answer carries all three denials',
    /not a commitment/.test(r.not_a_commitment) && /none of it is a path/i.test(r.not_existing)
    && /no published appendix/.test(r.not_an_assessment));

  /* The same rows must be reported from BBB and CCC too - a plan is a
     fact about both of its ends. */
  check('the far site sees the same row', idx.at('CCC').counts.planned_changes === 2);
}

/* B: a planned row is NOT a circuit, NOT a neighbour, NOT a path. */
{
  const product = fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400)],
    sites: [S('AAA', 'ALPHA'), S('BBB', 'BETA')],
    planned_changes: [{ node_1: 'AAA4-', node_2: 'BBB4-', year: '2030', status: 'Addition', asset: 'circuit', winter_mva: 3000 }]
  });
  const idx = planned.index(product);
  const r = idx.at('AAA');
  check('the planned addition is reported', r.counts.planned_changes === 1 && r.by_year[0].year === '2030');
  const topo = topology.index(product);
  const view = topo.at('AAA');
  check('the topology view counts zero circuits at the site', view.counts.circuits === 0);
  check('the topology view names no neighbour', view.counts.neighbour_sites === 0);
  check('the electrical-distance traversal cannot walk it',
    distance.between(topo, 'AAA', 'BBB').reached === false);
  check('the planned entry says the pair is NOT published today',
    r.by_year[0].by_status[0].entries[0].pair_published_today.circuit === false
    && r.by_year[0].by_status[0].entries[0].pair_published_today.transformer === false);
  check('no key in the answer is called circuits or transformers',
    !JSON.stringify(r).includes('"circuits":') && !JSON.stringify(r).includes('"transformers":'));
}

/* C: a transformer row carries its own rating and ratio; nothing is
   reconstructed from the two node voltages. */
{
  const idx = planned.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400), N('AAA1-', 'AAA', 132), N('AAA2-', 'AAA', 275)],
    sites: [S('AAA', 'ALPHA')],
    planned_changes: [
      { node_1: 'AAA4-', node_2: 'AAA1-', year: '2026', status: 'Addition', asset: 'transformer', rating_mva: 240, voltage_ratio_kv: '400/132', x_pct_100mva: 24.7 },
      { node_1: 'AAA4-', node_2: 'AAA2-', year: '2026', status: 'Addition', asset: 'transformer', rating_mva: 1000 }
    ]
  }));
  const r = idx.at('AAA');
  check('an internal transformer row is reported once, not once per end', r.counts.planned_changes === 2);
  const entries = r.by_year[0].by_status[0].entries;
  /* an internal row is met first at the lowest-sorted node, so it is
     found by its pair and not by which end came first */
  const pair = (e) => [e.from_node, e.to_node].sort().join('|');
  const withRatio = entries.find(e => pair(e) === 'AAA1-|AAA4-');
  const without = entries.find(e => pair(e) === 'AAA2-|AAA4-');
  check('the transformer carries its published rating and ratio',
    withRatio.rating_mva === 240 && withRatio.voltage_ratio_kv === '400/132');
  check('an unpublished ratio is null, never reconstructed from 400 and 275',
    without.voltage_ratio_kv === null
    && [without.from_voltage_kv, without.to_voltage_kv].sort().join(',') === '275,400');
  check('a transformer entry carries no seasonal circuit ratings',
    !('ratings_mva' in withRatio) && !('circuit_type' in withRatio));
  check('the internal row is marked as within this site', withRatio.within_this_site === true);
  check('the count by asset is real', r.counts.by_asset.transformer === 2);
}

/* D: voltage scoping never mixes, and an undeclared voltage stays undeclared. */
{
  const idx = planned.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400), N('AAA1-', 'AAA', 132), N('AAA2-', 'AAA', 275, false), N('BBB4-', 'BBB', 400), N('CCC1-', 'CCC', 132), N('DDD2-', 'DDD', 275)],
    sites: [S('AAA', 'ALPHA'), S('BBB', 'BETA'), S('CCC', 'GAMMA'), S('DDD', 'DELTA')],
    planned_changes: [
      { node_1: 'AAA4-', node_2: 'BBB4-', year: '2028', status: 'Addition', asset: 'circuit' },
      { node_1: 'AAA1-', node_2: 'CCC1-', year: '2028', status: 'Addition', asset: 'circuit' },
      { node_1: 'AAA2-', node_2: 'DDD2-', year: '2028', status: 'Addition', asset: 'circuit' }
    ]
  }));
  const at400 = idx.at('AAA', { voltageKv: 400 });
  const all = idx.at('AAA');
  check('scoped to 400 kV, only the 400 kV row is reported',
    at400.counts.planned_changes === 1 && at400.by_year[0].by_status[0].entries[0].to_node === 'BBB4-');
  check('the scope says which voltage it is', /400 kV only/.test(at400.scope));
  check('unscoped, all three rows are reported and each carries its own voltage',
    all.counts.planned_changes === 3);
  const undeclared = all.by_year[0].by_status[0].entries.find(e => e.from_node === 'AAA2-');
  check('a node whose site does not vouch for its voltage is undeclared, not 275',
    undeclared.from_voltage_kv === null);
  check('scoped to 275 kV, the undeclared node is not counted as 275',
    idx.at('AAA', { voltageKv: 275 }).counts.planned_changes === 0);
}

/* E: unknown sites and odd rows fail closed rather than plausibly. */
{
  const idx = planned.index(fakeProduct({
    nodes: [N('AAA4-', 'AAA', 400)],
    sites: [S('AAA', 'ALPHA')],
    planned_changes: [
      { node_1: 'AAA4-', node_2: 'ZZZ4-', year: '2030', status: 'Addition', asset: 'circuit' },
      { node_1: 'AAA4-', node_2: 'AAA4X', status: 'Weird', asset: 'circuit' }
    ]
  }));
  check('an unknown site is null, not an empty answer', idx.at('ZZZ') === null);
  const r = idx.at('AAA');
  check('a row to a node the product does not list is still reported, with no invented site',
    r.counts.planned_changes === 2
    && r.by_year.find(y => y.year === '2030').by_status[0].entries[0].to_site_code === null);
  check('a row with no year is grouped as unstated, after the real years',
    r.by_year.map(y => y.year).join(',') === '2030,unstated');
  check('an unrecognised status is kept and named, not dropped',
    r.counts.by_status.Weird === 1);
  check('an empty site answers with zero and says so', (() => {
    const empty = planned.index(fakeProduct({ nodes: [N('QQQ4-', 'QQQ', 400)], sites: [S('QQQ', 'QUIET')] })).at('QQQ');
    return empty.counts.planned_changes === 0 && empty.by_year.length === 0;
  })());
}

/* ── the real payload ────────────────────────────────────────────────── */
console.log('\nthe published network, 2,230 planned rows\n');

if (!existsSync(PRODUCT)) {
  console.error(`\nFAILED: the published product is not at ${PRODUCT}.`);
  console.error('A skip is not a pass. Check out Ventusltd/data-grid-gb beside this repository;');
  console.error('this proof does not report success on half of itself.');
  process.exit(1);
}

const product = JSON.parse(readFileSync(PRODUCT, 'utf8'));
const idx = planned.index(product);
check('the module accepts the published schema', !!idx);
check('the index counts every published planned row', idx.counts.planned_changes === 2230);

/* The tallies, recomputed here independently of the module. */
const tally = (field) => product.planned_changes.reduce((m, r) => { m[r[field]] = (m[r[field]] || 0) + 1; return m; }, {});
check('the year tally matches the product, row for row',
  JSON.stringify(idx.counts.by_year) === JSON.stringify(tally('year')), JSON.stringify(idx.counts.by_year));
check('the status tally matches the product', JSON.stringify(idx.counts.by_status) === JSON.stringify(tally('status')));
check('the asset tally matches the product', JSON.stringify(idx.counts.by_asset) === JSON.stringify(tally('asset')));
check('the four published years are the four the module was written for',
  Object.keys(idx.counts.by_year).sort().join(',') === '2026,2028,2030,2033');
check('every status is one of Addition, Change, Removed',
  Object.keys(idx.counts.by_status).every(s => planned.status_order.includes(s)));

/* Every row that lands on a listed site must be reported by that site,
   and reported exactly once there. Summing site counts double-counts the
   rows with both ends on listed sites, so the check is per row, not a
   sum. */
const nodeSite = new Map(product.nodes.map(n => [n.node, n.site_code]));
const siteCodes = new Set(product.sites.map(s => s.code));
let expectedLandings = 0;
for (const r of product.planned_changes) {
  const ends = new Set([nodeSite.get(r.node_1), nodeSite.get(r.node_2)].filter(c => siteCodes.has(c)));
  expectedLandings += ends.size;
}
let reportedLandings = 0;
let sitesWithPlans = 0;
let topSite = null;
for (const s of product.sites) {
  const r = idx.at(s.code);
  reportedLandings += r.counts.planned_changes;
  if (r.counts.planned_changes) sitesWithPlans += 1;
  if (!topSite || r.counts.planned_changes > topSite.counts.planned_changes) topSite = r;
}
check(`every row is reported once at each listed site it touches (${reportedLandings} landings)`,
  reportedLandings === expectedLandings, `${reportedLandings} vs ${expectedLandings}`);
check(`a real share of sites carry a planned row (${sitesWithPlans} of ${product.sites.length})`,
  sitesWithPlans > 100);

/* The placeholder sites. 429 of the 2,230 rows land on OFFS or ONSH,
   codes the product does not list as sites; they must not be resolvable
   as sites and must still be carried as the far end of a real site's
   row. */
check('OFFS and ONSH are not sites, and asking for them is null',
  idx.at('OFFS') === null && idx.at('ONSH') === null);
const toPlaceholder = product.planned_changes.filter(r =>
  ['OFFS', 'ONSH'].includes(nodeSite.get(r.node_2)) && siteCodes.has(nodeSite.get(r.node_1)));
check(`rows to the placeholder codes exist (${toPlaceholder.length})`, toPlaceholder.length > 0);
if (toPlaceholder.length) {
  const sample = toPlaceholder[0];
  const r = idx.at(nodeSite.get(sample.node_1));
  const entries = r.by_year.flatMap(y => y.by_status.flatMap(s => s.entries));
  const hit = entries.find(e => e.to_node === sample.node_2 && e.from_node === sample.node_1);
  check('the far end is carried with its code and no invented site name',
    !!hit && hit.to_site_code === nodeSite.get(sample.node_2) && hit.to_site_name === null);
  check('a far node with an undeclared voltage is undeclared, not decoded from "220KV" in its name',
    !!hit && hit.to_voltage_kv === null);
}

/* The busiest listed site, in full. */
check(`the busiest listed site reports its rows grouped by year (${topSite.site.code}, ${topSite.counts.planned_changes} rows)`,
  topSite.by_year.length > 0 && topSite.by_year.every(y => y.by_status.length > 0));
check('year groups are in ascending order',
  topSite.by_year.every((y, i, a) => i === 0 || Number(a[i - 1].year) <= Number(y.year)));
check('the group counts add up to the site count',
  topSite.by_year.reduce((s, y) => s + y.counts.entries, 0) === topSite.counts.planned_changes);
check('every entry carries year, status, asset, both nodes and the publication marker',
  topSite.by_year.every(y => y.by_status.every(s => s.entries.every(e =>
    e.year && e.status && e.asset && e.from_node && e.to_node && e.publication === 'planned'))));
check('every circuit entry carries R, X and B as published, where published',
  topSite.by_year.every(y => y.by_status.every(s => s.entries.every(e =>
    e.asset !== 'circuit' || e.parameters_pct_100mva === null || Number.isFinite(e.parameters_pct_100mva.x_pct)))));
check('no key in the answer names headroom, spare capacity or availability',
  !JSON.stringify(topSite).replace(/"not_an_assessment":"[^"]*"/, '').match(/headroom|spare|availab/i));

/* The cross-reference finding, verified against the product. */
const pairsToday = new Set([...product.circuits, ...product.transformers].map(r => [r.node_1, r.node_2].sort().join('|')));
const onPairToday = product.planned_changes.filter(r => pairsToday.has([r.node_1, r.node_2].sort().join('|')));
check(`the product does publish planned rows on pairs that exist today (${onPairToday.length})`, onPairToday.length > 0);
const additionsOnPair = onPairToday.filter(r => r.status === 'Addition');
check(`some of them are marked Addition (${additionsOnPair.length}), which is why the cross-reference is carried`,
  additionsOnPair.length > 0);
if (additionsOnPair.length) {
  const sample = additionsOnPair.find(r => siteCodes.has(nodeSite.get(r.node_1))) || additionsOnPair[0];
  const r = idx.at(nodeSite.get(sample.node_1));
  const entries = r ? r.by_year.flatMap(y => y.by_status.flatMap(s => s.entries)) : [];
  const hit = entries.find(e => e.status === 'Addition'
    && [e.from_node, e.to_node].sort().join('|') === [sample.node_1, sample.node_2].sort().join('|'));
  check('such an addition reports the pair as published today',
    !!hit && (hit.pair_published_today.circuit || hit.pair_published_today.transformer));
}

/* And once more on the real network: nothing planned can be walked. */
const topo = topology.index(product);
const wbur = idx.at('WBUR');
check('West Burton reports its planned rows', wbur && wbur.counts.planned_changes > 0);
const onlyPlanned = (() => {
  /* a far site reached ONLY by a planned row from WBUR, if one exists */
  const entries = wbur.by_year.flatMap(y => y.by_status.flatMap(s => s.entries));
  const neighbours = new Set(topo.at('WBUR').neighbours.map(n => n.site_code));
  return entries.find(e => e.to_site_code && !e.within_this_site && !neighbours.has(e.to_site_code)
    && siteCodes.has(e.to_site_code));
})();
if (onlyPlanned) {
  const walk = distance.between(topo, 'WBUR', onlyPlanned.to_site_code, { maxHops: 1 });
  check(`a site reached from WBUR only by a planned row (${onlyPlanned.to_site_code}) is not one hop away`,
    walk.reached === false);
} else {
  check('every planned far site from WBUR already has a circuit today, so the walk check is moot here', true);
}

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('a planned row is reported by year and status with its published parameters,');
console.log('and it is never a circuit, never a path and never a commitment.');
