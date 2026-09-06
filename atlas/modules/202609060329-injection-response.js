/* Compact successor of atlas/modules/202609020015-injection-response.js; original source retained, tokens and AST verified. */

(() => {
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.injectionResponse) return;
const SCHEMA = 'gridatlas.module.injection-response.v2';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const BASE_MVA = 100;
const DECLARED_MODEL = Object.freeze({
method: 'linear DC power flow (injection response / power transfer distribution factor)',
equations: 'P = B′ · θ ; branch flow f_ij = (θ_i − θ_j) / x_ij',
base_mva: BASE_MVA,
reactance: 'x = x_pct_100mva / 100, per unit, as published',
resistance: 'not used; the DC approximation neglects series resistance',
shunt_susceptance: 'not used; line charging does not appear in a DC model',
voltages: 'assumed flat at 1.0 per unit; not published and not solved',
angles: 'assumed small, so sin θ ≈ θ',
losses: 'zero by construction; real losses are of order 1-2% and are not represented',
transformer_taps: 'not published, therefore not modelled; transformers are their series reactance only',
contingencies: 'none; this is the intact network',
slack: 'declared explicitly on every answer, never inferred silently'
});
const NOT_A_LOADING =
'This is the response to a NEW injection, not a loading. What is '
+ 'already flowing on these circuits is published nowhere in this '
+ 'product, so the total flow - which is what decides whether a '
+ 'circuit is full - cannot be computed here by anyone.';
const NOT_A_CONNECTION_OFFER =
'A fraction of an injection appearing on a circuit is not permission '
+ 'to use that circuit. Queue position, committed connections, outage '
+ 'conditions, consent and commercial terms decide what a project may '
+ 'connect, and no published appendix contains any of them.';
function makeUnionFind() {
const parent = new Map();
function find(x) {
if (!parent.has(x)) { parent.set(x, x); return x; }
let root = x;
while (parent.get(root) !== root) root = parent.get(root);
let cursor = x;
while (parent.get(cursor) !== cursor) {
const next = parent.get(cursor);
parent.set(cursor, root);
cursor = next;
}
return root;
}
return {
find,
union(a, b) {
const ra = find(a);
const rb = find(b);
if (ra === rb) return false;
parent.set(ra, rb);
return true;
}
};
}
function assemble(graph, nodeNames, { voltageKv, includeTransformers }) {
const inScope = new Set(nodeNames);
const uf = makeUnionFind();
for (const n of nodeNames) uf.find(n);
const branches = [];
const seen = new Set();
let shorted = 0;
let skippedNoReactance = 0;
for (const name of nodeNames) {
for (const entry of graph.edgesAt(name)) {
if (entry.kind === 'transformer' && !includeTransformers) continue;
const far = entry.row[entry.far];
if (!inScope.has(far)) continue;
if (seen.has(entry.row)) continue;
seen.add(entry.row);
const xPct = entry.row.x_pct_100mva;
if (!Number.isFinite(xPct)) { skippedNoReactance += 1; continue; }
if (xPct === 0) {
if (uf.union(name, far)) shorted += 1;
continue;
}
branches.push({
from: name, to: far, kind: entry.kind,
x_pu: xPct / 100,
row: entry.row
});
}
}
const busOf = (name) => uf.find(name);
const buses = [...new Set(nodeNames.map(busOf))].sort();
const busIndex = new Map(buses.map((b, i) => [b, i]));
const edges = [];
for (const b of branches) {
const i = busIndex.get(busOf(b.from));
const j = busIndex.get(busOf(b.to));
if (i === undefined || j === undefined || i === j) continue;
edges.push({ i, j, b: 1 / b.x_pu, meta: b });
}
const comp = makeUnionFind();
for (const b of buses) comp.find(b);
for (const e of edges) comp.union(buses[e.i], buses[e.j]);
const componentOf = (bus) => comp.find(bus);
const componentSizes = new Map();
for (const b of buses) {
const root = componentOf(b);
componentSizes.set(root, (componentSizes.get(root) || 0) + 1);
}
const degree = new Map();
for (const e of edges) {
degree.set(buses[e.i], (degree.get(buses[e.i]) || 0) + 1);
degree.set(buses[e.j], (degree.get(buses[e.j]) || 0) + 1);
}
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
componentOf,
componentSize: (bus) => componentSizes.get(componentOf(bus)) || 0,
degreeOf: (bus) => degree.get(bus) || 0,
voltage_kv: voltageKv,
includes_transformers: includeTransformers,
buses, busIndex, busOf, edges,
counts: {
nodes: nodeNames.length,
buses: buses.length,
branches: edges.length,
shorted_zero_reactance: shorted,
skipped_no_published_reactance: skippedNoReactance,
components: componentSizes.size,
largest_component: Math.max(0, ...componentSizes.values())
}
};
}
function multiply(model, x, slackIndex) {
const y = new Float64Array(x.length);
for (const e of model.edges) {
if (e.i === slackIndex || e.j === slackIndex) {
if (e.i !== slackIndex) y[e.i] += e.b * x[e.i];
if (e.j !== slackIndex) y[e.j] += e.b * x[e.j];
continue;
}
const d = x[e.i] - x[e.j];
y[e.i] += e.b * d;
y[e.j] -= e.b * d;
}
return y;
}
function solve(model, injection, slackIndex, tolerance, maxIterations) {
const n = model.buses.length;
const x = new Float64Array(n);
let r = new Float64Array(injection);
r[slackIndex] = 0;
let p = new Float64Array(r);
let rr = 0;
for (let k = 0; k < n; k += 1) rr += r[k] * r[k];
const target = tolerance * tolerance * Math.max(rr, 1e-30);
let iterations = 0;
for (; iterations < maxIterations && rr > target; iterations += 1) {
const ap = multiply(model, p, slackIndex);
let pap = 0;
for (let k = 0; k < n; k += 1) pap += p[k] * ap[k];
if (!(Math.abs(pap) > 1e-30)) break;
const alpha = rr / pap;
let rrNext = 0;
for (let k = 0; k < n; k += 1) {
x[k] += alpha * p[k];
r[k] -= alpha * ap[k];
rrNext += r[k] * r[k];
}
const beta = rrNext / rr;
for (let k = 0; k < n; k += 1) p[k] = r[k] + beta * p[k];
rr = rrNext;
}
x[slackIndex] = 0;
return { theta: x, iterations, residual: Math.sqrt(rr) };
}
const SINK_RULE =
'Where no withdrawal bus is declared, the sink is the most connected '
+ 'bus in the SAME component as the injection - the bus with the most '
+ 'published branches landing on it. It is a stated rule, not a '
+ 'convenience: a transfer has two ends and the answer is meaningless '
+ 'without naming both. Declare a sink to override it.';
function sinkFor(model, atNode) {
if (!model || typeof model.componentOf !== 'function') return null;
const atBus = model.busOf(atNode);
const component = model.componentOf(atBus);
let best = null;
let bestDegree = -1;
for (const bus of model.buses) {
if (bus === atBus) continue;
if (model.componentOf(bus) !== component) continue;
const d = model.degreeOf(bus);
if (d > bestDegree || (d === bestDegree && best !== null && bus < best)) {
best = bus;
bestDegree = d;
}
}
return best;
}
function respond(model, options) {
const opts = options || {};
const mw = Number.isFinite(opts.mw) ? opts.mw : 100;
const atBus = model.busOf(opts.atNode);
const slackBus = model.busOf(opts.slackNode);
const i = model.busIndex.get(atBus);
const s = model.busIndex.get(slackBus);
if (i === undefined || s === undefined) return null;
if (i === s) {
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: true,
reason: 'the injection point and the slack are the same electrical '
+ 'bus once zero-reactance branches are shorted, so there is no '
+ 'transfer to distribute',
branches: [],
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
if (typeof model.componentOf === 'function'
&& model.componentOf(atBus) !== model.componentOf(slackBus)) {
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: false,
publishable: false,
reason: 'the injection bus and the withdrawal bus are in different '
+ 'connected components of the published network at this voltage, '
+ 'so there is no transfer between them to distribute. The model '
+ 'has ' + (model.counts ? model.counts.components : 'several')
+ ' components at this voltage; a transfer must be solved within one.',
branches: [],
component: {
injection: model.componentOf(atBus),
slack: model.componentOf(slackBus),
injection_component_buses: model.componentSize(atBus)
},
sink_rule: SINK_RULE,
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
const n = model.buses.length;
const p = new Float64Array(n);
p[i] = mw / BASE_MVA;
p[s] = -mw / BASE_MVA;
const solved = solve(model, p, s, 1e-10, Math.min(4 * n, 20000));
const minimumShare = Number.isFinite(opts.minimumShare) ? opts.minimumShare : 0.01;
const flows = [];
for (const e of model.edges) {
const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
const flowMw = flowPu * BASE_MVA;
const share = mw === 0 ? 0 : flowMw / mw;
if (Math.abs(share) < minimumShare) continue;
const row = e.meta.row;
const ratings = {};
for (const [season, field] of [['winter', 'winter_mva'], ['spring', 'spring_mva'],
['summer', 'summer_mva'], ['autumn', 'autumn_mva']]) {
if (Number.isFinite(row[field])) ratings[season] = row[field];
}
flows.push({
from_node: e.meta.from,
to_node: e.meta.to,
kind: e.meta.kind,
x_pct_100mva: e.meta.x_pu * 100,
flow_mw: flowMw,
share_of_injection: share,
published_ratings_mva: Object.keys(ratings).length ? ratings : null,
transformer_rating_mva: e.meta.kind === 'transformer'
&& Number.isFinite(row.rating_mva) ? row.rating_mva : null
});
}
flows.sort((a, b) => Math.abs(b.share_of_injection) - Math.abs(a.share_of_injection));
const net = new Float64Array(model.buses.length);
for (const e of model.edges) {
const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
net[e.i] += flowPu;
net[e.j] -= flowPu;
}
const kirchhoff = net[i] * BASE_MVA / (mw || 1);
let worstBusError = 0;
let worstBus = null;
for (let k = 0; k < net.length; k += 1) {
const expected = k === i ? mw / BASE_MVA : (k === s ? -mw / BASE_MVA : 0);
const error = Math.abs(net[k] - expected);
if (error > worstBusError) { worstBusError = error; worstBus = model.buses[k]; }
}
const worstBusMw = worstBusError * BASE_MVA;
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: false,
branches: flows,
counts: {
branches_in_model: model.edges.length,
branches_carrying_at_least: minimumShare,
branches_reported: flows.length
},
convergence: {
iterations: solved.iterations,
residual: solved.residual,
converged: solved.residual < 1e-6
},
publishable: solved.residual < 1e-6 && worstBusMw < 1e-6 * Math.max(1, mw)
&& Math.abs(kirchhoff - 1) < 1e-6,
sink_rule: SINK_RULE,
component: {
solved_in: typeof model.componentOf === 'function' ? model.componentOf(atBus) : null,
buses_in_component: typeof model.componentSize === 'function' ? model.componentSize(atBus) : null
},
validation: {
kirchhoff_at_injection: kirchhoff,
kirchhoff_error: Math.abs(kirchhoff - 1),
worst_bus_error_mw: worstBusMw,
worst_bus: worstBus,
passes: Math.abs(kirchhoff - 1) < 1e-6
&& worstBusMw < 1e-6 * Math.max(1, mw)
&& solved.residual < 1e-6,
what_it_checks: 'the shares leaving the injection bus must sum to 1.0, '
+ 'AND net flow must be zero at every other bus, AND the solve '
+ 'must have converged. Any one of the three alone can hold while '
+ 'the answer is wrong.'
},
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
function modelFor(index, options) {
if (!index || typeof index.graph !== 'function') return null;
const graph = index.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const includeTransformers = opts.includeTransformers === true;
const names = [];
for (const name of (opts.nodeNames || [])) {
if (voltageKv == null || graph.nodeVoltageKv(name) === voltageKv) names.push(name);
}
if (!names.length) return null;
return assemble(graph, names, { voltageKv, includeTransformers });
}
NS.injectionResponse = Object.freeze({
schema: SCHEMA,
requires: REQUIRES,
base_mva: BASE_MVA,
declared_model: DECLARED_MODEL,
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER,
sink_rule: SINK_RULE,
modelFor,
assemble,
sinkFor,
respond
});
})();
