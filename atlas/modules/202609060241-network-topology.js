/* Compact successor of atlas/modules/202609012245-network-topology.js; original source retained, tokens and AST verified. */

(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.networkTopology) return;
const ACCEPTS = 'data-grid-gb.transmission-network.v1';
const NOT_AN_ASSESSMENT =
'Counts, lengths, ratings and impedances are what the network operator '
+ 'publishes about this site. None of them states whether any project can '
+ 'connect here, which depends on queue position, committed connections, '
+ 'consent and commercial terms that no published appendix contains.';
const IMPEDANCE_BASIS =
'R, X and B are percentages on a 100 MVA base, as published. They are '
+ 'network parameters, not a solved power flow.';
const UNDECLARED = 'undeclared';
function voltageOf(node) {
if (!node) return null;
if (node.voltage_consistent_with_site !== true) return null;
return Number.isFinite(node.voltage_kv) ? node.voltage_kv : null;
}
const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));
function ratingsOf(row) {
const seasons = { winter: row.winter_mva, spring: row.spring_mva,
summer: row.summer_mva, autumn: row.autumn_mva };
const published = {};
for (const [season, value] of Object.entries(seasons)) {
if (Number.isFinite(value)) published[season] = value;
}
return Object.keys(published).length ? published : null;
}
function physicalUnits(records) {
const pairs = new Map();
for (const record of records) {
const near = String(record.from_node);
const far = String(record.to_node);
const forward = near < far;
const key = forward ? near + '\u0000' + far : far + '\u0000' + near;
if (!pairs.has(key)) pairs.set(key, { forward: 0, reverse: 0 });
const seen = pairs.get(key);
if (forward) seen.forward += 1; else seen.reverse += 1;
}
let units = 0;
for (const seen of pairs.values()) {
units += (seen.forward && seen.reverse)
? Math.max(seen.forward, seen.reverse)
: seen.forward + seen.reverse;
}
return units;
}
function parametersOf(row) {
const published = {};
for (const [key, field] of [['r_pct', 'r_pct_100mva'], ['x_pct', 'x_pct_100mva'],
['b_pct', 'b_pct_100mva']]) {
if (Number.isFinite(row[field])) published[key] = row[field];
}
return Object.keys(published).length ? published : null;
}
function index(product) {
if (!product || product.schema !== ACCEPTS) return null;
const nodes = new Map();
for (const node of product.nodes || []) {
if (node && node.node) nodes.set(node.node, node);
}
const sitesByCode = new Map();
const sitesByName = new Map();
for (const site of product.sites || []) {
if (!site || !site.code) continue;
sitesByCode.set(String(site.code).toUpperCase(), site);
if (site.name) sitesByName.set(String(site.name).toUpperCase().trim(), site);
}
const byNode = new Map();
function land(nodeName, entry) {
if (!nodeName) return;
if (!byNode.has(nodeName)) byNode.set(nodeName, []);
byNode.get(nodeName).push(entry);
}
for (const [kind, rows] of [['circuit', product.circuits],
['transformer', product.transformers], ['planned_change', product.planned_changes]]) {
for (const row of rows || []) {
if (!row) continue;
land(row.node_1, { kind, row, near: 'node_1', far: 'node_2' });
land(row.node_2, { kind, row, near: 'node_2', far: 'node_1' });
}
}
function siteOf(nodeName) {
const node = nodes.get(nodeName);
return node ? node.site_code : null;
}
function graph() {
return {
schema: 'gridatlas.module.network-topology.graph.v1',
has: (name) => nodes.has(name),
nodeVoltageKv: (name) => voltageOf(nodes.get(name)),
nodeSiteCode: (name) => {
const node = nodes.get(name);
return node ? node.site_code : null;
},
edgesAt: (name) => (byNode.get(name) || [])
.filter((entry) => entry.kind !== 'planned_change'),
nodesOfSite: (code) => {
const wanted = String(code || '').toUpperCase();
const out = [];
for (const node of nodes.values()) {
if (String(node.site_code || '').toUpperCase() === wanted) out.push(node.node);
}
return out.sort();
},
siteByCode: (code) => sitesByCode.get(String(code || '').toUpperCase()) || null,
ratingsOf,
parametersOf
};
}
function resolve(key) {
if (!key) return null;
const wanted = String(key).toUpperCase().trim();
return sitesByCode.get(wanted) || sitesByName.get(wanted) || null;
}
function at(key, options) {
const site = resolve(key);
if (!site) return null;
const wantedKv = options && Number.isFinite(options.voltageKv)
? options.voltageKv : null;
const siteNodes = [];
for (const node of nodes.values()) {
if (node.site_code !== site.code) continue;
const kv = voltageOf(node);
if (wantedKv != null && kv !== wantedKv) continue;
siteNodes.push({ node: node.node, voltage_kv: kv });
}
siteNodes.sort((a, b) => a.node.localeCompare(b.node));
const byVoltage = new Map();
const neighbours = new Map();
for (const entry of siteNodes) {
for (const landing of byNode.get(entry.node) || []) {
const farNode = landing.row[landing.far];
const farSiteCode = siteOf(farNode);
const farSite = farSiteCode ? sitesByCode.get(farSiteCode) : null;
const internal = farSiteCode === site.code;
const key2 = bandKey(entry.voltage_kv);
if (!byVoltage.has(key2)) {
byVoltage.set(key2, { voltage_kv: entry.voltage_kv,
circuits: [], transformers: [], planned_changes: [] });
}
const band = byVoltage.get(key2);
const published = {
from_node: entry.node,
to_node: farNode,
to_site_code: farSiteCode,
to_site_name: farSite ? farSite.name : null,
within_this_site: internal,
transmission_owner: landing.row.transmission_owner || null,
parameters_pct_100mva: parametersOf(landing.row),
ratings_mva: ratingsOf(landing.row)
};
if (landing.kind === 'circuit') {
published.circuit_type = landing.row.circuit_type || null;
if (Number.isFinite(landing.row.ohl_km)) published.ohl_km = landing.row.ohl_km;
if (Number.isFinite(landing.row.cable_km)) published.cable_km = landing.row.cable_km;
band.circuits.push(published);
} else if (landing.kind === 'transformer') {
if (Number.isFinite(landing.row.rating_mva)) published.rating_mva = landing.row.rating_mva;
delete published.ratings_mva;
band.transformers.push(published);
} else {
published.year = landing.row.year || null;
published.status = landing.row.status || null;
published.asset = landing.row.asset || null;
band.planned_changes.push(published);
}
if (landing.kind === 'circuit' && !internal && farSiteCode) {
if (!neighbours.has(farSiteCode)) {
neighbours.set(farSiteCode, {
site_code: farSiteCode,
site_name: farSite ? farSite.name : null,
circuits: 0
});
}
neighbours.get(farSiteCode).circuits += 1;
}
}
}
const voltages = [...byVoltage.entries()]
.sort((a, b) => {
if (a[0] === UNDECLARED) return 1;
if (b[0] === UNDECLARED) return -1;
return Number(b[0]) - Number(a[0]);
})
.map(([, band]) => band);
return {
schema: 'gridatlas.module.network-topology.v1',
source: ACCEPTS,
site: {
code: site.code,
name: site.name,
transmission_owner: site.transmission_owner || null,
voltages_kv: Array.isArray(site.voltages_kv) ? site.voltages_kv.slice() : []
},
requested_voltage_kv: wantedKv,
nodes: siteNodes,
by_voltage: voltages,
neighbours: [...neighbours.values()].sort((a, b) => b.circuits - a.circuits),
counts: {
nodes: siteNodes.length,
circuits: physicalUnits(voltages.flatMap(band => band.circuits)),
transformers: physicalUnits(voltages.flatMap(band => band.transformers)),
planned_changes: physicalUnits(voltages.flatMap(band => band.planned_changes)),
circuit_landings: voltages.reduce((sum, band) => sum + band.circuits.length, 0),
transformer_landings: voltages.reduce((sum, band) => sum + band.transformers.length, 0),
planned_change_landings: voltages.reduce((sum, band) => sum + band.planned_changes.length, 0),
neighbour_sites: neighbours.size
},
counts_are_units: 'A site holds both ends of a transformer and of any '
+ 'internal circuit, so the same branch lands twice. The counts above '
+ 'are physical units; the landing tallies beside them are what the '
+ 'per-voltage lists contain.',
impedance_basis: IMPEDANCE_BASIS,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
return {
schema: 'gridatlas.module.network-topology.v1',
source: ACCEPTS,
counts: {
sites: sitesByCode.size,
nodes: nodes.size,
branch_landings: byNode.size
},
site: resolve,
at,
graph
};
}
NS.networkTopology = Object.freeze({
schema: 'gridatlas.module.network-topology.v1',
accepts: ACCEPTS,
not_an_assessment: NOT_AN_ASSESSMENT,
impedance_basis: IMPEDANCE_BASIS,
index
});
})();
