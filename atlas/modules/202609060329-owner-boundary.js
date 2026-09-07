/* Compact successor of atlas/modules/202609012350-owner-boundary.js; original source retained, tokens and AST verified. */

(() => {
'use strict';
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.ownerBoundary) return;
const SCHEMA = 'gridatlas.module.owner-boundary.v1';
const ACCEPTS = 'data-grid-gb.transmission-network.v1';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const NOT_A_COUNTERPARTY =
'The transmission owner is the party the network operator publishes '
+ 'as owning an asset. It is not a statement about who a project would '
+ 'contract with, under what process, or on what terms; none of that '
+ 'is in any published appendix.';
const NOT_AN_ASSESSMENT =
'An ownership boundary is a fact about who publishes which asset. It '
+ 'says nothing about whether any project can connect on either side '
+ 'of it, and a rating on a boundary circuit is that circuit\'s rating, '
+ 'not a spare allowance across the boundary.';
const NEVER_INFERRED =
'An owner is reported only where the product publishes one on the '
+ 'record in question. A node with no published owner is unknown, a '
+ 'circuit with an unknown end is undetermined, and nothing is read '
+ 'from a site name, a node code or a neighbour.';
const UNKNOWN = 'unknown';
const UNDECLARED = 'undeclared';
const asString = (v) => (typeof v === 'string' && v.length ? v : null);
const asNumber = (v) => (Number.isFinite(v) ? v : null);
const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));
function index(product) {
if (!product || product.schema !== ACCEPTS) return null;
const topology = NS.networkTopology;
if (!topology || typeof topology.index !== 'function') return null;
const base = topology.index(product);
if (!base || typeof base.graph !== 'function') return null;
const graph = base.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const nodeOwner = new Map();
for (const node of product.nodes || []) {
if (node && node.node) nodeOwner.set(node.node, asString(node.transmission_owner));
}
const ownerOfNode = (name) => (nodeOwner.has(name) ? nodeOwner.get(name) : null);
function relation(nearOwner, farOwner) {
if (nearOwner == null || farOwner == null) return 'undetermined';
return nearOwner === farOwner ? 'internal' : 'boundary';
}
function describe(entry, nearNode) {
const row = entry.row;
const farNode = row[entry.far];
const nearOwner = ownerOfNode(nearNode);
const farOwner = graph.has(farNode) ? ownerOfNode(farNode) : null;
const assetOwner = asString(row.transmission_owner);
const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
const farSiteCode = graph.has(farNode) ? graph.nodeSiteCode(farNode) || null : null;
const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
const out = {
kind: entry.kind,
from_node: nearNode,
to_node: farNode,
from_site_code: nearSiteCode,
to_site_code: farSiteCode,
to_site_name: farSite ? farSite.name : null,
within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
from_voltage_kv: graph.nodeVoltageKv(nearNode),
to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
from_owner: nearOwner || UNKNOWN,
to_owner: farOwner || UNKNOWN,
asset_owner: assetOwner || UNKNOWN,
ends: relation(nearOwner, farOwner),
asset_owner_matches_an_end: assetOwner && nearOwner && farOwner
? (assetOwner === nearOwner || assetOwner === farOwner)
: null,
parameters_pct_100mva: graph.parametersOf(row)
};
if (entry.kind === 'circuit') {
out.circuit_type = asString(row.circuit_type);
out.ohl_km = asNumber(row.ohl_km);
out.cable_km = asNumber(row.cable_km);
out.ratings_mva = graph.ratingsOf(row);
} else {
out.rating_mva = asNumber(row.rating_mva);
out.voltage_ratio_kv = asString(row.voltage_ratio_kv);
}
return out;
}
function at(key, options) {
const site = base.site(key);
if (!site) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const nodeNames = graph.nodesOfSite(site.code)
.filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);
const nodes = nodeNames.map((name) => ({
node: name,
voltage_kv: graph.nodeVoltageKv(name),
transmission_owner: ownerOfNode(name) || UNKNOWN
}));
const seen = new Set();
const bands = new Map();
const boundary_circuits = [];
const boundary_transformers = [];
const undetermined = [];
const asset_owner_differs = [];
function band(kv) {
const k = bandKey(kv);
if (!bands.has(k)) {
bands.set(k, { voltage_kv: kv, by_owner: {}, circuits: 0, transformers: 0, nodes: 0 });
}
return bands.get(k);
}
function count(b, owner, what) {
const o = owner || UNKNOWN;
if (!b.by_owner[o]) b.by_owner[o] = { nodes: 0, circuits: 0, transformers: 0 };
b.by_owner[o][what] += 1;
b[what] += 1;
}
for (const n of nodes) count(band(n.voltage_kv), n.transmission_owner, 'nodes');
for (const nodeName of nodeNames) {
for (const entry of graph.edgesAt(nodeName)) {
if (seen.has(entry.row)) continue;
seen.add(entry.row);
const d = describe(entry, nodeName);
const b = band(d.from_voltage_kv);
count(b, d.asset_owner === UNKNOWN ? null : d.asset_owner,
entry.kind === 'circuit' ? 'circuits' : 'transformers');
if (d.ends === 'boundary') {
(entry.kind === 'circuit' ? boundary_circuits : boundary_transformers).push(d);
} else if (d.ends === 'undetermined') {
undetermined.push(d);
}
if (d.asset_owner_matches_an_end === false) asset_owner_differs.push(d);
}
}
const by_voltage = [...bands.entries()]
.sort((a, b) => {
if (a[0] === UNDECLARED) return 1;
if (b[0] === UNDECLARED) return -1;
return Number(b[0]) - Number(a[0]);
})
.map(([, b]) => b);
const owners = new Set();
for (const b of by_voltage) for (const o of Object.keys(b.by_owner)) owners.add(o);
const byPair = (list) => list.sort((a, b) =>
String(a.from_node).localeCompare(String(b.from_node))
|| String(a.to_node).localeCompare(String(b.to_node)));
return {
schema: SCHEMA,
source: ACCEPTS,
site: {
code: site.code,
name: site.name,
transmission_owner: asString(site.transmission_owner) || UNKNOWN
},
requested_voltage_kv: voltageKv,
scope: voltageKv == null
? 'every node of this site, counted within its own declared voltage; '
+ 'no count here spans two voltages'
: 'nodes this site declares at ' + voltageKv + ' kV only',
nodes,
by_voltage,
owners_present: [...owners].sort(),
boundary_circuits: byPair(boundary_circuits),
boundary_transformers: byPair(boundary_transformers),
undetermined: byPair(undetermined),
asset_owner_differs_from_both_ends: byPair(asset_owner_differs),
counts: {
nodes: nodes.length,
nodes_with_unknown_owner: nodes.filter((n) => n.transmission_owner === UNKNOWN).length,
owners_present: owners.size,
circuits: by_voltage.reduce((s, b) => s + b.circuits, 0),
transformers: by_voltage.reduce((s, b) => s + b.transformers, 0),
boundary_circuits: boundary_circuits.length,
boundary_transformers: boundary_transformers.length,
undetermined: undetermined.length,
asset_owner_differs_from_both_ends: asset_owner_differs.length
},
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
function boundaries() {
const out = [];
const seen = new Set();
const pairs = {};
for (const [kind, rows] of [['circuit', product.circuits], ['transformer', product.transformers]]) {
for (const row of rows || []) {
if (!row || seen.has(row)) continue;
seen.add(row);
const d = describe({ kind, row, near: 'node_1', far: 'node_2' }, row.node_1);
if (d.ends !== 'boundary') continue;
out.push(d);
const pair = [d.from_owner, d.to_owner].sort().join('/');
pairs[pair] = (pairs[pair] || 0) + 1;
}
}
return {
schema: SCHEMA,
source: ACCEPTS,
branches: out.sort((a, b) =>
String(a.from_node).localeCompare(String(b.from_node))
|| String(a.to_node).localeCompare(String(b.to_node))),
counts: {
boundary_circuits: out.filter((d) => d.kind === 'circuit').length,
boundary_transformers: out.filter((d) => d.kind === 'transformer').length,
by_owner_pair: pairs
},
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
const ownerTally = {};
for (const node of product.nodes || []) {
const o = (node && asString(node.transmission_owner)) || UNKNOWN;
ownerTally[o] = (ownerTally[o] || 0) + 1;
}
return {
schema: SCHEMA,
source: ACCEPTS,
counts: {
nodes: nodeOwner.size,
nodes_by_owner: ownerTally
},
site: base.site,
at,
boundaries
};
}
NS.ownerBoundary = Object.freeze({
schema: SCHEMA,
accepts: ACCEPTS,
requires: REQUIRES,
unknown: UNKNOWN,
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT,
index
});
})();
