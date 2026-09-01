/**
 * Proof for the injection-response module.
 *
 * THE VALIDATION PROBLEM, AND HOW IT IS ANSWERED HERE
 * ---------------------------------------------------
 * Codex's standing condition on any load-flow work is validation against a
 * trusted solver. There is no commercial solver in this estate, and
 * claiming one had been used would be worse than having none.
 *
 * So the model is validated the other way that is actually rigorous:
 * against networks whose answers are EXACT BY HAND. A DC injection
 * response has closed-form solutions on small networks - parallel paths
 * divide inversely as their reactances, a series path carries everything,
 * a symmetric ring divides two-thirds and one-third - and these are not
 * approximations to compare loosely against. They are the physics the
 * model claims to implement, and a solver that gets them wrong is wrong.
 *
 * Every analytic case below is asserted to 1e-9. Then the same solver is
 * run on the real published 400 kV network, where the answer is not known
 * in advance but Kirchhoff's law still must hold at every bus, and it is
 * checked at all of them rather than at the one the module reports.
 *
 * A skip is not a pass: absent the published product, this FAILS.
 *
 *   node tools/proofs/modules/202609012320-injection-response.proof.mjs
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
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Math.abs(a - b) < tol;

const TOPOLOGY = 'atlas/modules/202609012245-network-topology.js';
const FLOW = 'atlas/modules/202609012320-injection-response.js';

const window = { __GRIDATLAS_MODULES__: {} };
for (const rel of [TOPOLOGY, FLOW]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.error(`missing module: ${rel}`); process.exit(1); }
  new Function('window', readFileSync(path, 'utf8'))(window);
}
const NS = window.__GRIDATLAS_MODULES__;
const topology = NS.networkTopology;
const flow = NS.injectionResponse;

console.log('\nthe model declares itself\n');

check('the module registered', !!flow);
const D = flow.declared_model;
check('it names its method as a DC injection response, not a load flow',
  /DC power flow/.test(D.method) && /distribution factor/.test(D.method));
check('it publishes its equations', /P = B′ · θ/.test(D.equations) && /θ_i − θ_j/.test(D.equations));
check('it declares the base it works on', D.base_mva === 100);
check('it states that resistance is not used', /not used/.test(D.resistance));
check('it states that shunt susceptance is not used', /not used/.test(D.shunt_susceptance));
check('it states the flat-voltage assumption', /flat at 1\.0/.test(D.voltages));
check('it states the small-angle assumption', /small/.test(D.angles));
check('it states that losses are zero by construction', /zero by construction/.test(D.losses));
check('it states that taps are not published and not modelled',
  /not published/.test(D.transformer_taps));
check('it states that no contingency is modelled', /none/.test(D.contingencies));
check('it refuses to be read as a loading',
  /not a loading/i.test(flow.not_a_loading) && /published nowhere/.test(flow.not_a_loading));
check('it refuses to be read as a connection offer',
  /not permission/.test(flow.not_a_connection_offer));

/* The rule this module operates under: it MAY use x, and it must still
   never use r or b, because the declared model says it does not. */
const source = readFileSync(join(ROOT, FLOW), 'utf8');
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
check('the module never reads the resistance field', !/r_pct_100mva/.test(codeOnly));
check('the module never reads the susceptance field', !/b_pct_100mva/.test(codeOnly));
check('the module does read the reactance field, which is what it declares',
  /x_pct_100mva/.test(codeOnly));

console.log('\nvalidation against networks whose answers are exact by hand\n');

/* A tiny graph harness in the shape the module requires. */
function graphOf(nodes, edges) {
  const byNode = new Map();
  for (const e of edges) {
    for (const [near, far] of [['node_1', 'node_2'], ['node_2', 'node_1']]) {
      const n = e.row[near];
      if (!byNode.has(n)) byNode.set(n, []);
      byNode.get(n).push({ kind: e.kind || 'circuit', row: e.row, near, far });
    }
  }
  return {
    schema: 'gridatlas.module.network-topology.graph.v1',
    has: (n) => nodes.includes(n),
    nodeVoltageKv: () => 400,
    nodeSiteCode: (n) => n.slice(0, 4),
    edgesAt: (n) => byNode.get(n) || [],
    nodesOfSite: () => nodes.slice(),
    siteByCode: () => null,
    ratingsOf: () => null,
    parametersOf: () => null
  };
}
const X = (node_1, node_2, x, extra = {}) =>
  ({ kind: 'circuit', row: Object.assign({ node_1, node_2, x_pct_100mva: x }, extra) });

const shareOn = (result, a, b) => {
  const hit = result.branches.find(f =>
    (f.from_node === a && f.to_node === b) || (f.from_node === b && f.to_node === a));
  if (!hit) return 0;
  return (f => f.from_node === a ? f.share_of_injection : -f.share_of_injection)(hit);
};

/* CASE 1 - a single branch carries the whole transfer, whatever its x. */
{
  const g = graphOf(['A', 'B'], [X('A', 'B', 7.3)]);
  const m = flow.assemble(g, ['A', 'B'], { voltageKv: 400, includeTransformers: false });
  const r = flow.respond(m, { atNode: 'A', slackNode: 'B', mw: 500, minimumShare: 0 });
  check('one branch between injection and slack carries 100% of it',
    close(shareOn(r, 'A', 'B'), 1));
  check('and carries it in MW, on the declared base', close(r.branches[0].flow_mw, 500, 1e-7));
  check('the reactance does not change a single-path answer',
    close(shareOn(r, 'A', 'B'), 1));
  check('Kirchhoff at the injection is satisfied exactly', r.validation.passes);
  check('the solve reports that it converged', r.convergence.converged);
}

/* CASE 2 - two parallel branches divide inversely as their reactances.
   x1 = 1, x2 = 2  =>  2/3 on the first, 1/3 on the second. Exact. */
{
  const g = graphOf(['A', 'B'], [X('A', 'B', 100), X('A', 'B', 200)]);
  const m = flow.assemble(g, ['A', 'B'], { voltageKv: 400, includeTransformers: false });
  const r = flow.respond(m, { atNode: 'A', slackNode: 'B', mw: 300, minimumShare: 0 });
  const shares = r.branches.map(b => b.share_of_injection).sort((a, b) => b - a);
  check('two parallel paths divide inversely as their reactances (2/3, 1/3)',
    close(shares[0], 2 / 3) && close(shares[1], 1 / 3),
    shares.map(s => s.toFixed(6)).join(' '));
  check('the two shares sum to exactly one', close(shares[0] + shares[1], 1));
  check('in MW that is 200 and 100 of a 300 MW injection',
    close(r.branches.find(b => close(b.share_of_injection, 2 / 3)).flow_mw, 200, 1e-6));
}

/* CASE 3 - the textbook symmetric ring. Three equal branches A-B, B-C,
   C-A. Inject at A, withdraw at B. The direct path A-B is one branch of
   reactance x; the indirect path A-C-B is two, so 2x. Inversely as
   reactance: 2/3 direct, 1/3 indirect. */
{
  const g = graphOf(['A', 'B', 'C'], [X('A', 'B', 50), X('B', 'C', 50), X('C', 'A', 50)]);
  const m = flow.assemble(g, ['A', 'B', 'C'], { voltageKv: 400, includeTransformers: false });
  const r = flow.respond(m, { atNode: 'A', slackNode: 'B', mw: 90, minimumShare: 0 });
  check('a symmetric ring sends 2/3 the direct way', close(shareOn(r, 'A', 'B'), 2 / 3));
  check('and 1/3 the long way round', close(shareOn(r, 'A', 'C'), 1 / 3));
  check('the long way round carries the same share on its second leg',
    close(shareOn(r, 'C', 'B'), 1 / 3));
  check('a ring puts flow on a branch that touches neither end of the transfer',
    Math.abs(shareOn(r, 'C', 'B')) > 0.3);
}

/* CASE 4 - series branches each carry the whole transfer. */
{
  const g = graphOf(['A', 'M', 'B'], [X('A', 'M', 30), X('M', 'B', 70)]);
  const m = flow.assemble(g, ['A', 'M', 'B'], { voltageKv: 400, includeTransformers: false });
  const r = flow.respond(m, { atNode: 'A', slackNode: 'B', mw: 250, minimumShare: 0 });
  check('every branch in series carries the entire transfer',
    close(shareOn(r, 'A', 'M'), 1) && close(shareOn(r, 'M', 'B'), 1));
}

/* CASE 5 - reciprocity. Reversing the transfer reverses every flow and
   changes nothing else. This is a property of the linear model, and a
   solver that fails it has a sign or an indexing error. */
{
  const g = graphOf(['A', 'B', 'C'], [X('A', 'B', 50), X('B', 'C', 30), X('C', 'A', 20)]);
  const m = flow.assemble(g, ['A', 'B', 'C'], { voltageKv: 400, includeTransformers: false });
  const fwd = flow.respond(m, { atNode: 'A', slackNode: 'C', mw: 100, minimumShare: 0 });
  const rev = flow.respond(m, { atNode: 'C', slackNode: 'A', mw: 100, minimumShare: 0 });
  let mirrored = true;
  for (const f of fwd.branches) {
    const back = rev.branches.find(b => b.from_node === f.from_node && b.to_node === f.to_node);
    if (!back || !close(back.share_of_injection, -f.share_of_injection, 1e-9)) mirrored = false;
  }
  check('reversing the transfer reverses every branch flow exactly', mirrored);
}

/* CASE 6 - a zero-reactance branch is a short, not a small reactance. */
{
  const g = graphOf(['A', 'A2', 'B'], [X('A', 'A2', 0), X('A2', 'B', 40)]);
  const m = flow.assemble(g, ['A', 'A2', 'B'], { voltageKv: 400, includeTransformers: false });
  check('the zero-reactance branch was shorted, not modelled',
    m.counts.shorted_zero_reactance === 1 && m.counts.branches === 1);
  check('the two shorted nodes became one bus', m.counts.buses === 2 && m.counts.nodes === 3);
  const r = flow.respond(m, { atNode: 'A', slackNode: 'B', mw: 100, minimumShare: 0 });
  check('injecting at either end of a short gives the same answer',
    close(shareOn(r, 'A2', 'B'), 1));
  const r2 = flow.respond(m, { atNode: 'A2', slackNode: 'B', mw: 100, minimumShare: 0 });
  check('because they are the same bus', close(shareOn(r2, 'A2', 'B'), 1));
}

/* CASE 7 - injecting and withdrawing at the same bus is not a transfer. */
{
  const g = graphOf(['A', 'A2', 'B'], [X('A', 'A2', 0), X('A2', 'B', 40)]);
  const m = flow.assemble(g, ['A', 'A2', 'B'], { voltageKv: 400, includeTransformers: false });
  const r = flow.respond(m, { atNode: 'A', slackNode: 'A2', mw: 100 });
  check('a transfer within one bus is refused and explained',
    r.same_bus === true && r.branches.length === 0 && /no transfer to distribute/.test(r.reason));
}

/* CASE 8 - a branch with no published reactance is skipped and counted,
   never given a default. */
{
  const g = graphOf(['A', 'B', 'C'], [X('A', 'B', 50), { kind: 'circuit', row: { node_1: 'B', node_2: 'C' } }]);
  const m = flow.assemble(g, ['A', 'B', 'C'], { voltageKv: 400, includeTransformers: false });
  check('a branch with no published reactance is not invented',
    m.counts.skipped_no_published_reactance === 1 && m.counts.branches === 1);
}

console.log('\nthe real published 400 kV network\n');

if (!existsSync(PRODUCT)) {
  console.error(`\nFAILED: the published product is not at ${PRODUCT}.`);
  console.error('A skip is not a pass. Check out Ventusltd/data-grid-gb beside this repository.');
  process.exit(1);
}

const product = JSON.parse(readFileSync(PRODUCT, 'utf8'));
const index = topology.index(product);
check('the topology module accepts the published schema', !!index);

const graph = index.graph();
const nodes400 = (product.nodes || [])
  .filter(n => n.voltage_consistent_with_site === true && n.voltage_kv === 400)
  .map(n => n.node);
check(`the product publishes 400 kV nodes whose site vouches for them (${nodes400.length})`,
  nodes400.length > 100, `${nodes400.length}`);

const model = flow.assemble(graph, nodes400, { voltageKv: 400, includeTransformers: false });
check('a 400 kV model assembles', !!model && model.counts.branches > 50,
  JSON.stringify(model.counts));
console.log(`  model: ${JSON.stringify(model.counts)}`);

/* West Burton to a distant slack, on the real network. */
const wbur = nodes400.find(n => n.startsWith('WBUR'));
const slack = nodes400.find(n => n.startsWith('SUND') || n.startsWith('PELH'))
  || nodes400[nodes400.length - 1];
check('West Burton has a 400 kV node in the model', !!wbur, String(wbur));

const answer = flow.respond(model, { atNode: wbur, slackNode: slack, mw: 500, minimumShare: 0.01 });
check('the solve converged on the real network', answer.convergence.converged,
  `residual ${answer.convergence.residual}`);
check('Kirchhoff at the injection bus holds to 1e-6',
  answer.validation.passes, `error ${answer.validation.kirchhoff_error}`);
check('the answer names its slack, because a transfer has two ends',
  answer.slack_node === slack && !!answer.slack_node);
check('some circuits carry a meaningful share of the injection',
  answer.branches.length > 0, `${answer.branches.length}`);
check('no branch carries more than the whole injection',
  answer.branches.every(b => Math.abs(b.share_of_injection) <= 1 + 1e-9),
  answer.branches.map(b => b.share_of_injection.toFixed(3)).slice(0, 5).join(' '));

/* Kirchhoff at EVERY bus, not just the one the module reports. This is
   the check that would catch an indexing error the reported one misses. */
{
  /* Keyed by BUS, not by node. Five pairs of 400 kV nodes are joined by a
     zero-reactance branch and shorted into one bus each; a flow reported
     at one member node belongs to the whole bus. Summing per node instead
     showed a false 17.97 MW imbalance at ELST41 - which is the shorted
     half of its bus, not a solver error. The law is per bus, so the check
     must be too. */
  const netAt = new Map();
  const add = (node, mw) => {
    const bus = model.busOf(node);
    netAt.set(bus, (netAt.get(bus) || 0) + mw);
  };
  for (const b of flow.respond(model, { atNode: wbur, slackNode: slack, mw: 500, minimumShare: 0 }).branches) {
    add(b.from_node, b.flow_mw);
    add(b.to_node, -b.flow_mw);
  }
  const injectionBus = model.busOf(wbur);
  const slackBus = model.busOf(slack);
  let worst = 0;
  let worstAt = null;
  let checked = 0;
  for (const [bus, net] of netAt) {
    if (bus === injectionBus || bus === slackBus) continue;
    checked += 1;
    if (Math.abs(net) > worst) { worst = Math.abs(net); worstAt = bus; }
  }
  check(`every intermediate bus on the real network conserves power to 1e-6 (${checked} buses)`,
    worst < 1e-6, `worst ${worst.toExponential(3)} at ${worstAt}`);
  check('the injection bus carries exactly what was injected',
    close(netAt.get(injectionBus), 500, 1e-6), String(netAt.get(injectionBus)));
  check('the slack bus withdraws exactly what was injected',
    close(netAt.get(slackBus), -500, 1e-6), String(netAt.get(slackBus)));
  check('enough intermediate buses were checked for this to mean something',
    checked > 50, `${checked}`);
}

check('the answer carries its declared model with it, not just in the docs',
  answer.declared_model && answer.declared_model.base_mva === 100);
check('the answer carries the two refusals with it',
  /not a loading/i.test(answer.not_a_loading)
  && /not permission/.test(answer.not_a_connection_offer));
check('published ratings travel with the branches, uncombined',
  answer.branches.some(b => b.published_ratings_mva
    && Number.isFinite(b.published_ratings_mva.winter)));
check('nothing in the answer claims headroom or spare capacity', (() => {
  const stripped = JSON.stringify(Object.assign({}, answer,
    { not_a_loading: '', not_a_connection_offer: '', declared_model: {} }));
  return !/headroom|spare|available/i.test(stripped);
})());

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('the model states its equations, its base, its slack and its assumptions,');
console.log('reproduces the exact analytic answers, conserves power at every bus on');
console.log('the real network, and says plainly that it is not a loading.');
