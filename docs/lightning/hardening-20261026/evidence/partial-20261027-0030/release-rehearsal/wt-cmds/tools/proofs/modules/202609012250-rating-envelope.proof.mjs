/**
 * Proof for the rating-envelope module.
 *
 * The load-bearing check in this file is a NEGATIVE one: that no code
 * path anywhere in the module produces a sum of circuit ratings. Every
 * other check could pass while the module quietly printed a site total,
 * and that total is the exact number a reader would take as headroom.
 *
 * Run against the real published payload. A skip is not a pass: if the
 * sibling data-grid-gb checkout is absent this FAILS.
 *
 *   node tools/proofs/modules/202609012250-rating-envelope.proof.mjs
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
const ENVELOPE = 'atlas/modules/202609012250-rating-envelope.js';

const window = { __GRIDATLAS_MODULES__: {} };
for (const rel of [TOPOLOGY, ENVELOPE]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.error(`missing module: ${rel}`); process.exit(1); }
  new Function('window', readFileSync(path, 'utf8'))(window);
}
const NS = window.__GRIDATLAS_MODULES__;
const topology = NS.networkTopology;
const envelope = NS.ratingEnvelope;

console.log('\nthe refusal to sum, asserted structurally\n');

const source = readFileSync(join(ROOT, ENVELOPE), 'utf8');
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

check('the module registered', !!envelope);
/* The whole point. A reduce over ratings, a `+=` accumulating them, or a
   field whose name contains total/sum - any of the three would be the
   number that must not exist. */
check('no reduce anywhere in the module', !/\.reduce\(/.test(codeOnly));
/* The denial constant is literally called NEVER_SUMMED and the field that
   carries it is `never_summed`, so a check that bans the substring "sum"
   fires on the very thing that makes the refusal legible. The words are
   permitted only where they are prefixed by `never`. */
/* Naming a sum is banned; naming a SEASON is not. "summer_mva" contains
   the letters s-u-m and is the most important field in this module, so
   the test is on WORDS and on camelCase humps, never on substrings:
   `\bsum\b` does not fire inside "summer", and `[a-z]Sum` catches
   `siteSum` where a word boundary cannot. The check is self-tested below
   against both a name that must fail and one that must pass, because a
   pattern this fiddly is exactly the kind that silently matches nothing
   and reports success forever. */
const banned = (text) =>
  /(?:^|[^A-Za-z])(total|totals|sum|sums|aggregate|combined|cumulative)(?![A-Za-z])/i.test(text)
  || /[a-z](Total|Sum|Aggregate|Combined)(?![a-z])/.test(text);

/* The two denial constants must SAY "sum" in order to deny it, so they
   are removed before the scan - the same distinction as everywhere else
   in this estate: a denial is not a claim. */
const withoutDenials = codeOnly
  .split(/const (?:NEVER_SUMMED|NOT_A_CAPACITY)\s*=[\s\S]*?;/).join(' ');
check('the denials were actually found and removed, not silently absent',
  withoutDenials.length < codeOnly.length - 200);
check('nothing in the module outside the denials names a total or a sum',
  !banned(withoutDenials));
check('the denial does say "sum", which is why it had to be excluded',
  /(?:^|[^A-Za-z])sum(?![A-Za-z])/i.test(codeOnly));
check('the pattern fires on a real total', banned('const siteTotal = 0;'));
check('the pattern fires on a snake-case total', banned('const site_total = 0;'));
check('the pattern does NOT fire on the season it must not break', !banned('summer_mva'));
check('the pattern does NOT fire on the denial that must stay legible', !banned('never_summed'));
check('no accumulator assigns into anything named like a total',
  !/\b\w*(total|aggregate)\w*\s*\+?=/i.test(codeOnly));
check('no arithmetic operator is applied to a rating value',
  !/ratings_mva\[[^\]]+\]\s*[+\-*/]/.test(codeOnly)
  && !/_mva\s*[+*]/.test(codeOnly));
check('no mean or average is computed',
  !/\/\s*values\.length|\baverage\b|\bmean\b/i.test(codeOnly));
check('the only reductions over values are Math.min and Math.max, which are published values',
  /Math\.min\.apply/.test(codeOnly) && /Math\.max\.apply/.test(codeOnly));
check('the refusal is stated in words the page can print',
  /not additive/.test(envelope.never_summed) && /no code that produces one/.test(envelope.never_summed));
check('a rating is distinguished from what is free on it',
  /not what is free on it/.test(envelope.not_a_capacity));
check('it never fetches and never renders',
  !/\b(fetch|document|innerHTML)\b/.test(codeOnly));

console.log('\nbehaviour, on circuits built for the edge cases\n');

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
      ratingsOf: () => null,
      parametersOf: (row) => (Number.isFinite(row.x_pct_100mva) ? { x_pct: row.x_pct_100mva } : null)
    })
  };
}
const N = (node, site_code, voltage_kv, ok = true) =>
  ({ node, site_code, voltage_kv, voltage_consistent_with_site: ok });

/* Two circuits, all four seasons published. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400), N('CCC4-', 'CCC', 400)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 3000, spring_mva: 2800, summer_mva: 2500, autumn_mva: 2800, circuit_type: 'OHL', ohl_km: 40, cable_km: 0 } },
     { kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'CCC4-', winter_mva: 1800, spring_mva: 1700, summer_mva: 1500, autumn_mva: 1700, circuit_type: 'Cable', ohl_km: 0, cable_km: 12 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }, { code: 'CCC', name: 'GAMMA' }]);
  const r = envelope.at(idx, 'AAA', { voltageKv: 400 });
  check('both circuits are reported individually', r.circuits.length === 2);
  check('each circuit keeps its own four seasonal ratings',
    r.circuits[0].ratings_mva.summer === 2500 && r.circuits[1].ratings_mva.summer === 1500);
  check('the season range is a lowest and a highest, both real published values',
    r.by_season.summer.lowest_circuit_mva === 1500
    && r.by_season.summer.highest_circuit_mva === 2500);
  check('the answer contains no total of 4800 anywhere',
    !JSON.stringify(r).includes('4800'));
  check('summer is reported separately from winter, not folded into it',
    r.by_season.winter.highest_circuit_mva === 3000
    && r.by_season.summer.highest_circuit_mva === 2500);
  check('circuit type and length are carried as published',
    r.circuits[0].circuit_type === 'OHL' && r.circuits[1].cable_km === 12);
}

/* A circuit publishing only winter - the other seasons are named absent. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 900 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }]);
  const r = envelope.at(idx, 'AAA');
  check('a season the product does not publish is named absent, not filled in',
    r.circuits[0].seasons_not_published.join(',') === 'spring,summer,autumn');
  check('an unpublished season reports published:false rather than a number',
    r.by_season.summer.published === false && r.by_season.summer.circuits === 0);
  check('the count of circuits missing a season is surfaced',
    r.counts.with_a_season_not_published === 1);
}

/* The placeholder value. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('BBB4-', 'BBB', 400), N('CCC4-', 'CCC', 400)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 9999, ohl_km: 0, cable_km: 1 } },
     { kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'CCC4-', winter_mva: 2000 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }, { code: 'CCC', name: 'GAMMA' }]);
  const r = envelope.at(idx, 'AAA');
  check('a 9999 MVA rating is flagged, not silently used',
    r.counts.with_a_flagged_value === 1
    && /placeholder/.test(r.circuits.find(c => c.flags.length).flags[0].reason));
  check('the flagged value is excluded from the highest, which would otherwise be 9999',
    r.by_season.winter.highest_circuit_mva === 2000
    && r.by_season.winter.excluded_as_implausible === 1);
  check('the flagged value is still reported on its own circuit, not deleted',
    r.circuits.some(c => c.ratings_mva.winter === 9999));
}

/* Voltage scoping. */
{
  const idx = fakeIndex(
    [N('AAA4-', 'AAA', 400), N('AAA1-', 'AAA', 132), N('BBB4-', 'BBB', 400), N('CCC1-', 'CCC', 132)],
    [{ kind: 'circuit', row: { node_1: 'AAA4-', node_2: 'BBB4-', winter_mva: 3000 } },
     { kind: 'circuit', row: { node_1: 'AAA1-', node_2: 'CCC1-', winter_mva: 130 } }],
    [{ code: 'AAA', name: 'ALPHA' }, { code: 'BBB', name: 'BETA' }, { code: 'CCC', name: 'GAMMA' }]);
  const at400 = envelope.at(idx, 'AAA', { voltageKv: 400 });
  const all = envelope.at(idx, 'AAA');
  check('scoped to 400 kV, only the 400 kV circuit is reported',
    at400.circuits.length === 1 && at400.circuits[0].ratings_mva.winter === 3000);
  check('a 130 MVA 132 kV circuit never widens a 400 kV range',
    at400.by_season.winter.lowest_circuit_mva === 3000);
  check('unscoped, the answer says plainly that it spans voltages',
    all.circuits.length === 2 && /a number about neither of them/.test(all.scope));
}

/* ── the real payload ────────────────────────────────────────────────── */
console.log('\nthe published network\n');

if (!existsSync(PRODUCT)) {
  console.error(`\nFAILED: the published product is not at ${PRODUCT}.`);
  console.error('A skip is not a pass. Check out Ventusltd/data-grid-gb beside this repository.');
  process.exit(1);
}

const product = JSON.parse(readFileSync(PRODUCT, 'utf8'));
const index = topology.index(product);
check('the topology module accepts the published schema', !!index);

const wb = envelope.at(index, 'WBUR', { voltageKv: 400 });
check('West Burton reports circuits at 400 kV', !!wb && wb.circuits.length > 0);
check('every reported circuit carries at least a winter rating',
  wb.circuits.every(c => Number.isFinite(c.ratings_mva.winter)));
check('no circuit at 400 kV carries a rating from another voltage',
  wb.circuits.every(c => c.voltage_kv === 400));
check('the answer carries no summed figure',
  !/total|sum_/i.test(JSON.stringify(wb).replace(/never_summed":"[^"]*"/, '')));

/* The placeholder finding, verified against the whole product rather than
   asserted from the survey. */
const implausible = (product.circuits || [])
  .filter(c => Number.isFinite(c.winter_mva) && c.winter_mva >= 9999);
check(`the product does publish circuits at or above 9999 MVA (${implausible.length} found)`,
  implausible.length > 0, `${implausible.length}`);
check('every one of them is on a short span, which is why they read as placeholders',
  implausible.every(c => (c.ohl_km || 0) + (c.cable_km || 0) <= 5),
  implausible.map(c => `${c.node_1}-${c.node_2}:${(c.ohl_km || 0) + (c.cable_km || 0)}km`).join(' '));

/* Summer is not winter, and the difference is the point of carrying it. */
let differing = 0;
let bothPublished = 0;
for (const c of product.circuits || []) {
  if (!Number.isFinite(c.winter_mva) || !Number.isFinite(c.summer_mva)) continue;
  bothPublished += 1;
  if (c.summer_mva !== c.winter_mva) differing += 1;
}
check(`summer and winter ratings differ on real circuits (${differing} of ${bothPublished})`,
  differing > 0, `${differing}/${bothPublished}`);
check('a majority of circuits publish a summer rating at all',
  bothPublished > (product.circuits || []).length / 2,
  `${bothPublished} of ${(product.circuits || []).length}`);

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('every rating is reported on its own circuit, in its own season, and');
console.log('there is no code path in the module that adds two of them together.');
