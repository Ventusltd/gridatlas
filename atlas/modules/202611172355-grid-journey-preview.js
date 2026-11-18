/* GJ-03 PREVIEW ONLY. Canonical engine Ventusltd/ventus-grid-engine@65d48a851fc2ac74b13f939a0184e11298e7e5bd. No live pointer writes. */
(() => {
'use strict';
const JourneyTopology = (() => {
/**
 * Module: network-topology
 *
 * PROMOTED from sources/v9-extracts/network-topology.mjs (itself extracted
 * verbatim from the LATER of two committed gridatlas versions,
 * atlas/modules/202609012245-network-topology.js, 384 lines — a strict
 * superset of 202609012145-network-topology.js, 279 lines: at() is
 * byte-identical between the two; 202609012245 adds physicalUnits() and
 * graph() so electrical-distance.js and rating-envelope.js (both of which
 * require 'gridatlas.module.network-topology.graph.v1') have something to
 * consume). Not one of the six named extraction targets, but promoted
 * because both electrical-distance and rating-envelope are inert without it.
 *
 * What the network operator publishes about ONE site: its nodes, the
 * circuits that land on them, the transformers between them, the changes
 * it has published for future years, and which other sites those circuits
 * reach. Appendix B of the Electricity Ten Year Statement, read as a
 * node/branch model and reported as facts.
 *
 * Depends on: nothing. Topology is not geometry — this module never
 * measures a distance and never touches a coordinate.
 *
 * CHANGED FROM THE SOURCE: the IIFE and `window.__GRIDATLAS_MODULES__`
 * registration are removed. `index()` and its helpers are otherwise
 * unchanged — verified verbatim against
 * gridatlas/atlas/modules/202609012245-network-topology.js at HEAD
 * 64268fd06a0da54ddffbcdaaaee382e314e829f7 (see sources/provenance.json).
 */

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

/* A node's voltage is trusted only where the product says the site
   declares it. Everything else is undeclared — never inferred from the
   digit in the node code, which is a derived convention the product
   itself marks as undocumented. */
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

/* A published branch is seen once from EACH of its ends, so a site that
   owns both ends of a branch publishes it twice. See source comment
   (network-topology.js:96-124) for the Cowley 5-vs-10 case that motivated
   this. Pairs are keyed by the two node names so a branch seen from both
   directions is counted once, and one seen from only one direction (what
   a voltage-filtered query sees of an internal machine) is also counted
   once. */
function physicalUnits(records) {
  const pairs = new Map();
  for (const record of records) {
    const near = String(record.from_node);
    const far = String(record.to_node);
    const forward = near < far;
    const key = forward ? near + ' ' + far : far + ' ' + near;
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

/**
 * @param product  the parsed data-grid-gb transmission-network payload
 * @returns an index, or null if the schema is not the one this reads
 */
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

  /* Branches are indexed by the node they land on, both ends, because a
     circuit is a fact about both of its sites. */
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

  /* The adjacency, handed out rather than rebuilt. Every accessor here is
     a READ of the structures at() already uses, so a traversal cannot
     disagree with a one-hop view about which nodes exist, which site a
     node belongs to, or whether a node's voltage is trustworthy.
     planned_change rows are excluded from edges: a change published for
     2029 is not a path a current can take today. They remain available
     through at(). */
  function graph() {
    return {
      schema: 'gridatlas.module.network-topology.graph.v1',
      has: (name) => nodes.has(name),
      nodeVoltageKv: (name) => voltageOf(nodes.get(name)),
      nodeSiteCode: (name) => {
        const node = nodes.get(name);
        return node ? node.site_code : null;
      },
      /* circuits and transformers only — see above */
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

  /**
   * Everything published about one site, grouped by the voltage of the
   * node each branch lands on. Never a site-wide range.
   *
   * @param key          site code or exact site name
   * @param options      { voltageKv } to restrict to one voltage
   */
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

        /* A neighbour is another SITE this site's circuits reach. An
           internal branch is not a neighbour, and a planned change is
           not a neighbour either — it has not been built. */
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

const schema = 'gridatlas.module.network-topology.v1';

return Object.freeze({ACCEPTS,NOT_AN_ASSESSMENT,IMPEDANCE_BASIS,UNDECLARED,ratingsOf,physicalUnits,parametersOf,index,schema});
})();
const JourneyEvidence = (() => {
/** Byte-pinned, fail-closed Journey evidence. Receipt presence does not
 * authenticate a reviewer or grant rights. No DOM, network, inferred joins or MW. */
const topologyIndex = JourneyTopology.index;

const REVIEW_SCHEMA = 'data-grid-gb.grid-journey-review.v1';
const PRODUCT_SCHEMA = 'data-grid-gb.transmission-network.v1';
const KINDS = Object.freeze({circuit: 'circuits', transformer: 'transformers', planned_change: 'planned_changes'});
const GEOMETRY = Object.freeze(['verified_circuit_and_polyline', 'published_topology_only',
  'published_node_unlocated', 'vicinity_screening_only', 'ambiguous_or_licence_blocked']);
const encoder = new TextEncoder();
const hex = /^[0-9a-f]{64}$/;
const fail = message => { throw new Error(`Grid Journey evidence: ${message}`); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, label) => { if (typeof v !== 'string' || !v.trim()) fail(`${label} must be nonempty text`); };
const ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function canonicalJson(value) {
  const active = new Set();
  function encode(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail('nonfinite JSON number'); return JSON.stringify(v); }
    if (!object(v) && !Array.isArray(v)) fail('non-JSON input');
    if (active.has(v)) fail('cyclic JSON input');
    active.add(v);
    const out = Array.isArray(v) ? '[' + v.map(encode).join(',') + ']'
      : '{' + Object.keys(v).sort(ordinal).map(k => JSON.stringify(k) + ':' + encode(v[k])).join(',') + '}';
    active.delete(v);
    return out;
  }
  return encode(value);
}

async function sha256(bytes) {
  if (typeof bytes === 'string') bytes = encoder.encode(bytes);
  if (!(bytes instanceof Uint8Array)) fail('hash input must be text or bytes');
  if (!globalThis.crypto?.subtle) fail('Web Crypto SHA256 is unavailable');
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

function url(v, label) {
  text(v, label);
  if (/[\s\\]/u.test(v)) fail(`${label} contains URL whitespace or backslash`);
  const match = /^https:\/\/([A-Za-z0-9.-]+)(?::([0-9]+))?(?:[/?#].*)?$/u.exec(v);
  if (!match || match[1].length > 253 || !match[1].split('.').every(s => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/u.test(s))
      || match[2] && (+match[2] < 1 || +match[2] > 65535)) fail(`${label} must be a credential-free HTTPS URL`);
}

function receipt(v, label) {
  if (!object(v)) fail(`${label} requires an explicit review receipt`);
  text(v.id, `${label}.id`); text(v.reviewer, `${label}.reviewer`); url(v.reference, `${label}.reference`);
  if (typeof v.reviewedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u.test(v.reviewedAt)
      || v.reviewedAt.startsWith('0000') || !Number.isFinite(Date.parse(v.reviewedAt))
      || new Date(v.reviewedAt).toISOString().replace('.000Z', 'Z') !== v.reviewedAt) fail(`${label}.reviewedAt is not a valid UTC instant`);
}
function source(v, label) { if (!object(v)) fail(`${label} requires a source locator`); url(v.url, `${label}.url`); text(v.locator, `${label}.locator`); }
function rights(v, label) {
  if (!object(v) || !['accepted', 'unconfirmed', 'blocked'].includes(v.status)) fail(`${label} invalid rights status`);
  if (v.status === 'accepted') { url(v.licenceUrl, `${label}.licenceUrl`); text(v.attribution, `${label}.attribution`); receipt(v.review, `${label}.review`); }
}
function identity(v, label) {
  if (!object(v) || !['confirmed', 'unreviewed', 'ambiguous'].includes(v.status)) fail(`${label} invalid identity status`);
  if (v.status === 'confirmed') receipt(v.review, `${label}.review`);
}
function position(v, label) {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || Math.abs(v[0]) > 180 || Math.abs(v[1]) > 90) fail(`${label} must be finite WGS84 [longitude,latitude]`);
}

function edgeUid(bundleSha, kind, sourceIndex) {
  if (!hex.test(bundleSha) || !Object.hasOwn(KINDS, kind) || !Number.isSafeInteger(sourceIndex) || sourceIndex < 0) fail('invalid source-row identity');
  return `${bundleSha}:${kind}:${sourceIndex}`;
}

function validateProduct(product) {
  if (!object(product) || product.schema !== PRODUCT_SCHEMA) fail('unsupported network product');
  for (const key of ['nodes', ...Object.values(KINDS)]) if (!Array.isArray(product[key])) fail(`network.${key} must be an array`);
  if (product.nodes.length > 100000 || Object.values(KINDS).reduce((n, k) => n + product[k].length, 0) > 200000) fail('network exceeds contract limits');
  const ids = new Set();
  const nodeId = v => { text(v, 'source node ID'); if (/[\x00-\x1f\x7f]/u.test(v)) fail('source node ID contains control characters'); };
  for (const n of product.nodes) {
    if (!object(n)) fail('network node must be an object');
    nodeId(n.node); if (ids.has(n.node)) fail('duplicate source node identity'); ids.add(n.node);
  }
  for (const key of Object.values(KINDS)) for (const row of product[key]) {
    if (!object(row)) fail('network branch must be an object'); nodeId(row.node_1); nodeId(row.node_2);
  }
  return product;
}

function validateLedger(ledger, product = null, expectedSha = null) {
  if (!object(ledger) || ledger.schema !== REVIEW_SCHEMA) fail('unsupported review ledger schema');
  edgeUid(ledger.sourceBundleSha, 'circuit', 0);
  if (expectedSha !== null && ledger.sourceBundleSha !== expectedSha) fail('review ledger source digest does not match actual bytes');
  if (product !== null) validateProduct(product);
  if (!Array.isArray(ledger.nodes) || !Array.isArray(ledger.edges)) fail('review ledger requires node and edge arrays');
  if (ledger.nodes.length > 100000 || ledger.edges.length > 200000) fail('review ledger exceeds contract limits');
  const sourceNodes = product && new Set(product.nodes.map(n => n.node)), nodes = new Set(), edges = new Set();
  for (const n of ledger.nodes) {
    if (!object(n)) fail('node review must be an object'); text(n.nodeId, 'nodeId');
    if (nodes.has(n.nodeId) || sourceNodes && !sourceNodes.has(n.nodeId)) fail('duplicate or unknown node review'); nodes.add(n.nodeId);
    identity(n.identity, 'node.identity'); rights(n.rights, 'node.rights'); source(n.sourceRef, 'node.sourceRef');
    const loc = Object.hasOwn(n, 'location') ? n.location : {status: 'unlocated'};
    if (!object(loc) || !['reviewed', 'unreviewed', 'unlocated', 'ambiguous'].includes(loc.status)) fail('invalid node location state');
    if (loc.status === 'reviewed') { position(loc.coordinates, 'location.coordinates'); source(loc.sourceRef, 'location.sourceRef'); receipt(loc.review, 'location.review'); rights(loc.rights, 'location.rights'); }
  }
  for (const e of ledger.edges) {
    if (!object(e)) fail('edge review must be an object');
    const uid = edgeUid(ledger.sourceBundleSha, e.kind, e.sourceIndex);
    if (e.edgeUid !== uid || edges.has(uid)) fail('duplicate or inconsistent source-row UID'); edges.add(uid);
    text(e.node1, 'node1'); text(e.node2, 'node2');
    if (product) { const row = product[KINDS[e.kind]][e.sourceIndex]; if (!row || e.node1 !== row.node_1 || e.node2 !== row.node_2) fail('review refers to a different source row or endpoint'); }
    identity(e.identity, 'edge.identity'); rights(e.rights, 'edge.rights'); source(e.sourceRef, 'edge.sourceRef');
    if (!['reviewed', 'unreviewed', 'ambiguous'].includes(e.multiplicityStatus)) fail('edge multiplicity review status is required');
    if (e.multiplicityStatus === 'reviewed') receipt(e.multiplicityReview, 'edge.multiplicityReview');
    if (!GEOMETRY.includes(e.geometryStatus)) fail('unknown geometry evidence class');
    if (e.kind === 'transformer' && e.identity.status === 'confirmed') text(e.transformerRef, 'transformerRef');
    if (e.geometryStatus === 'verified_circuit_and_polyline') {
      const g = e.geometry;
      if (!object(g) || !Array.isArray(g.coordinates) || g.coordinates.length < 2) fail('verified polyline needs reviewed coordinates');
      for (const p of g.coordinates) position(p, 'geometry.coordinates');
      source(g.sourceRef, 'geometry.sourceRef'); receipt(g.review, 'geometry.review'); rights(g.rights, 'geometry.rights');
    }
  }
  return ledger;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function classifyEdges(product, ledger, expectedSha = null) {
  validateLedger(ledger, product, expectedSha);
  const nodes = new Map(product.nodes.map(n => [n.node, n])), reviews = new Map(ledger.nodes.map(n => [n.nodeId, n]));
  const edgeReviews = new Map(ledger.edges.map(e => [e.edgeUid, e])), result = [];
  for (const [kind, key] of Object.entries(KINDS)) for (const [sourceIndex, row] of product[key].entries()) {
    const uid = edgeUid(ledger.sourceBundleSha, kind, sourceIndex), e = edgeReviews.get(uid), reasons = [];
    if (kind === 'planned_change') reasons.push('planned');
    if (!e) reasons.push('edge_unreviewed');
    else {
      if (e.identity.status !== 'confirmed') reasons.push('edge_identity');
      if (e.rights.status !== 'accepted') reasons.push('edge_rights');
      if (e.multiplicityStatus !== 'reviewed') reasons.push('multiplicity');
      if (['vicinity_screening_only', 'ambiguous_or_licence_blocked'].includes(e.geometryStatus)) reasons.push('geometry_withheld');
    }
    const positions = [], volts = [];
    for (const nid of [row.node_1, row.node_2]) {
      const n = nodes.get(nid), r = reviews.get(nid); if (!n) reasons.push('orphan_node');
      let voltage = n?.voltage_consistent_with_site === true ? n.voltage_kv : null;
      if (!Number.isFinite(voltage) || voltage <= 0) { voltage = null; reasons.push('unknown_voltage'); } volts.push(voltage);
      if (r?.identity.status !== 'confirmed') reasons.push('node_identity');
      if (r?.rights.status !== 'accepted') reasons.push('node_rights');
      positions.push(r?.location?.status === 'reviewed' && r.location.rights.status === 'accepted' ? r.location.coordinates : null);
    }
    if (kind === 'circuit' && volts.every(v => v !== null) && volts[0] !== volts[1]) reasons.push('illegal_voltage');
    let status = e?.geometryStatus ?? 'ambiguous_or_licence_blocked';
    if (e && status === 'verified_circuit_and_polyline') {
      const line = e.geometry.coordinates;
      if (e.geometry.rights.status !== 'accepted') reasons.push('geometry_rights');
      if (positions.includes(null) || !(same(line[0], positions[0]) && same(line.at(-1), positions[1]) || same(line[0], positions[1]) && same(line.at(-1), positions[0]))) reasons.push('geometry_endpoint_mismatch');
    } else if (status === 'published_topology_only' && positions.includes(null)) status = 'published_node_unlocated';
    result.push({edgeUid: uid, kind, sourceIndex, node1: row.node_1, node2: row.node_2,
      eligible: reasons.length === 0, reasons: [...new Set(reasons)].sort(ordinal), geometryStatus: status});
  }
  return result;
}

async function prepareJourneyEvidence(sourceBytes, ledger) {
  const bytes = typeof sourceBytes === 'string' ? encoder.encode(sourceBytes) : sourceBytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 32 * 1024 * 1024) fail('network must be at most 32 MiB of exact JSON bytes');
  // Snapshot caller-owned bytes/ledger before the first asynchronous boundary.
  const snapshot = Uint8Array.from(bytes), ledgerText = canonicalJson(ledger);
  if (encoder.encode(ledgerText).length > 32 * 1024 * 1024) fail('review ledger exceeds 32 MiB');
  const frozenLedger = JSON.parse(ledgerText), product = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(snapshot));
  const digest = await sha256(snapshot);
  validateLedger(frozenLedger, product, digest);
  const records = classifyEdges(product, frozenLedger, digest);
  return {sourceBundleSha: digest, reviewLedgerSha: await sha256(ledgerText), product,
    ledger: frozenLedger, records, graph: topologyIndex(product).graph()};
}

return Object.freeze({REVIEW_SCHEMA,PRODUCT_SCHEMA,KINDS,GEOMETRY,ordinal,canonicalJson,sha256,edgeUid,validateProduct,validateLedger,classifyEdges,prepareJourneyEvidence});
})();
const JourneyEngine = (() => {
/** Bounded educational itinerary over reviewed source-row edges. No MW solver,
 * current direction, nearest-site connection, inferred transformer or GIS drawing. */
const {canonicalJson, ordinal, prepareJourneyEvidence, sha256} = JourneyEvidence;

const SCHEMA = 'ventus.grid-journey.plan.v1';
const CAVEAT = 'Journey shows documented network connectivity. The travelling light is a learning cursor, not measured current or a power-flow simulation. Dotted links are schematic; missing routes are not invented.';
const defaults = Object.freeze({maxNodes: 250, maxEdges: 500, maxMoves: 1000, maxGeometryBytes: 1000000});
const ceilings = Object.freeze({maxNodes: 100000, maxEdges: 200000, maxMoves: 400000, maxGeometryBytes: 32 * 1024 * 1024});
const encoder = new TextEncoder();

function limits(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('Grid Journey query must be an object');
  if (query.requireReviewedIdentity === false) throw new Error('Grid Journey review gates cannot be disabled');
  if (query.modes !== undefined && (!Array.isArray(query.modes) || query.modes.length !== 1 || query.modes[0] !== 'published_circuits')) throw new Error('Only published_circuits mode is implemented');
  if (query.bounds !== undefined && (!query.bounds || typeof query.bounds !== 'object' || Array.isArray(query.bounds))) throw new Error('Invalid journey bounds');
  for (const k of Object.keys(query.bounds || {})) if (!Object.hasOwn(defaults, k)) throw new Error(`Unsupported journey bound ${k}`);
  const out = {...defaults, ...query.bounds};
  for (const [key, value] of Object.entries(out)) if (!Number.isSafeInteger(value) || value < (key === 'maxNodes' ? 1 : 0) || value > ceilings[key]) throw new Error(`Invalid journey bound ${key}`);
  return out;
}

/** Exact JSON source bytes are required: a caller cannot attach a digest to an
 * unrelated parsed object. Review-ledger hash is over canonical JSON, no newline. */
async function planJourney({sourceBytes, ledger, query = {}}) {
  // Snapshot caller-owned query before hashing introduces an async boundary.
  query = JSON.parse(canonicalJson(query));
  const bounds = limits(query), evidence = await prepareJourneyEvidence(sourceBytes, ledger);
  const {product, graph, records, sourceBundleSha, reviewLedgerSha} = evidence;
  if (query.sourceBundleSha && query.sourceBundleSha !== sourceBundleSha) throw new Error('Query source digest mismatch');
  if (query.crosswalkSha && query.crosswalkSha !== reviewLedgerSha) throw new Error('Query review ledger digest mismatch');
  const nodeReviews = new Map(evidence.ledger.nodes.map(n => [n.nodeId, n]));
  const edgeReviews = new Map(evidence.ledger.edges.map(e => [e.edgeUid, e]));
  const eligible = records.filter(e => e.eligible), rowRecords = new WeakMap(), refusalCounts = {};
  for (const r of records) {
    if (r.kind !== 'planned_change') rowRecords.set(product[r.kind === 'circuit' ? 'circuits' : 'transformers'][r.sourceIndex], r);
    for (const reason of r.reasons) refusalCounts[reason] = (refusalCounts[reason] || 0) + 1;
  }
  const seed = query.seed?.chosenNode ?? null;
  const result = {schema: SCHEMA, sourceBundleSha, reviewLedgerSha, seedNode: seed, endNode: seed,
    bounds, status: 'empty', steps: [], edgeCatalog: [], eligibleEdges: eligible.length,
    eligibleReachableEdges: 0, reachableNodes: 0, visitedUniqueEdges: 0, physicalUnits: null,
    coverage: null, truncated: false, truncationReasons: [],
    excluded: {refusalCounts, disconnectedEligibleEdges: 0, outsideBoundsEdges: 0}, caveats: [CAVEAT]};
  async function finish() { result.planSha256 = await sha256(canonicalJson(result)); return result; }
  const review = nodeReviews.get(seed);
  const seedReason = !seed ? 'chosen_node_required' : !graph.has(seed) ? 'seed_not_in_source'
    : review?.identity.status !== 'confirmed' ? 'seed_identity_unreviewed'
      : review?.rights.status !== 'accepted' ? 'seed_rights_withheld'
        : !Number.isFinite(graph.nodeVoltageKv(seed)) || graph.nodeVoltageKv(seed) <= 0 ? 'seed_voltage_unknown' : null;
  if (seedReason) { result.status = 'refused'; result.refusal = seedReason; return finish(); }

  const adjacency = new Map();
  for (const n of product.nodes) {
    const seen = new Set(), rows = [];
    // Read the incumbent graph; its two landings reference one source row.
    for (const landing of graph.edgesAt(n.node)) {
      const record = rowRecords.get(landing.row);
      if (!record?.eligible || record.kind !== landing.kind || seen.has(record.edgeUid)) continue;
      seen.add(record.edgeUid); rows.push(record);
    }
    rows.sort((a, b) => ordinal(a.edgeUid, b.edgeUid)); adjacency.set(n.node, rows);
  }
  const componentNodes = new Set([seed]), componentEdges = new Set(), pending = [seed];
  for (let i = 0; i < pending.length; i++) for (const e of adjacency.get(pending[i]) || []) {
    componentEdges.add(e.edgeUid);
    const far = e.node1 === pending[i] ? e.node2 : e.node1;
    if (!componentNodes.has(far)) { componentNodes.add(far); pending.push(far); }
  }
  result.reachableNodes = componentNodes.size; result.eligibleReachableEdges = componentEdges.size;
  result.excluded.disconnectedEligibleEdges = eligible.length - componentEdges.size;
  if (!componentEdges.size) return finish();

  function catalogFor(e) {
    const r = edgeReviews.get(e.edgeUid), a = nodeReviews.get(e.node1), b = nodeReviews.get(e.node2);
    let coordinates = null;
    if (e.geometryStatus === 'verified_circuit_and_polyline') {
      coordinates = r.geometry.coordinates.map(p => [...p]);
      if (canonicalJson(coordinates[0]) !== canonicalJson(a.location.coordinates)) coordinates.reverse();
    } else if (e.geometryStatus === 'published_topology_only') coordinates = [[...a.location.coordinates], [...b.location.coordinates]];
    return {edgeUid: e.edgeUid, kind: e.kind, node1: e.node1, node2: e.node2, sourceIndex: e.sourceIndex,
      geometryStatus: e.geometryStatus, coordinates, schematic: e.geometryStatus === 'published_topology_only',
      sourceRef: r.sourceRef, transformerRef: e.kind === 'transformer' ? r.transformerRef : null,
      label: e.geometryStatus === 'published_topology_only' ? 'Schematic topology connector; not a cable route'
        : e.geometryStatus === 'published_node_unlocated' ? 'Published topology; location unavailable — text only'
          : 'Reviewed source circuit/polyline association; precision remains source-specific'};
  }
  const stack = [{node: seed, next: 0, via: null}], visited = new Set(), visitedNodes = new Set([seed]);
  const blocked = new Set(), truncated = new Set(); let geometryBytes = 0;
  const move = (kind, edge, from, to) => {
    result.steps.push({kind: edge.geometryStatus === 'published_node_unlocated' ? 'unlocated' : kind,
      traversal: kind, edgeUid: edge.edgeUid, nearNode: from, farNode: to, order: result.steps.length,
      nearVoltageKv: graph.nodeVoltageKv(from), farVoltageKv: graph.nodeVoltageKv(to),
      geometryStatus: edge.geometryStatus, direction: from === edge.node1 ? 'forward' : 'reverse',
      transformerRef: edge.kind === 'transformer' ? edgeReviews.get(edge.edgeUid).transformerRef : null,
      sourceRef: edgeReviews.get(edge.edgeUid).sourceRef}); result.endNode = to;
  };
  walk: while (stack.length) {
    const frame = stack.at(-1), rows = adjacency.get(frame.node) || [];
    if (frame.next >= rows.length) {
      if (frame.via) {
        if (result.steps.length >= bounds.maxMoves) { truncated.add('maxMoves'); break; }
        move('backtrack', frame.via, frame.node, stack[stack.length - 2].node);
      }
      stack.pop(); continue;
    }
    const e = rows[frame.next++]; if (visited.has(e.edgeUid) || blocked.has(e.edgeUid)) continue;
    if (visited.size >= bounds.maxEdges) { truncated.add('maxEdges'); break; }
    const far = e.node1 === frame.node ? e.node2 : e.node1;
    if (!visitedNodes.has(far) && visitedNodes.size >= bounds.maxNodes) { truncated.add('maxNodes'); blocked.add(e.edgeUid); continue; }
    const catalog = catalogFor(e), addedBytes = catalog.coordinates ? encoder.encode(canonicalJson(catalog.coordinates)).length : 0;
    if (geometryBytes + addedBytes > bounds.maxGeometryBytes) { truncated.add('maxGeometryBytes'); blocked.add(e.edgeUid); continue; }
    if (result.steps.length >= bounds.maxMoves) { truncated.add('maxMoves'); break walk; }
    geometryBytes += addedBytes; visited.add(e.edgeUid); visitedNodes.add(far); result.edgeCatalog.push(catalog);
    move('advance', e, frame.node, far); stack.push({node: far, next: 0, via: e});
  }
  result.visitedUniqueEdges = visited.size; result.coverage = visited.size / componentEdges.size;
  result.truncated = truncated.size > 0; result.truncationReasons = [...truncated].sort(ordinal);
  result.excluded.outsideBoundsEdges = componentEdges.size - visited.size;
  result.status = result.truncated ? 'truncated' : 'complete';
  result.geometryBytes = geometryBytes;
  return finish();
}

return Object.freeze({SCHEMA,CAVEAT,planJourney});
})();
const JourneyFixture = {"schema":"ventus.grid-journey.synthetic-contract-fixture.v1","synthetic":true,"licence":"Invented test data only; no real infrastructure or external rights grant","networkText":"{\"schema\":\"data-grid-gb.transmission-network.v1\",\"sites\":[{\"code\":\"A1\"},{\"code\":\"B1\"},{\"code\":\"C1\"},{\"code\":\"D1\"},{\"code\":\"U1\"}],\"nodes\":[{\"node\":\"A1\",\"site_code\":\"A1\",\"voltage_consistent_with_site\":true,\"voltage_kv\":132},{\"node\":\"B1\",\"site_code\":\"B1\",\"voltage_consistent_with_site\":true,\"voltage_kv\":132},{\"node\":\"C1\",\"site_code\":\"C1\",\"voltage_consistent_with_site\":true,\"voltage_kv\":132},{\"node\":\"D1\",\"site_code\":\"D1\",\"voltage_consistent_with_site\":true,\"voltage_kv\":132},{\"node\":\"U1\",\"site_code\":\"U1\",\"voltage_consistent_with_site\":true,\"voltage_kv\":132}],\"circuits\":[{\"node_1\":\"A1\",\"node_2\":\"B1\"},{\"node_1\":\"B1\",\"node_2\":\"C1\"},{\"node_1\":\"B1\",\"node_2\":\"D1\"},{\"node_1\":\"D1\",\"node_2\":\"U1\"}],\"transformers\":[],\"planned_changes\":[]}\n","ledger":{"schema":"data-grid-gb.grid-journey-review.v1","sourceBundleSha":"b288e90cb106567c9e6373ed2409e4bc65e495d4f790d1ea44b4a47497b87afe","nodes":[{"identity":{"review":{"id":"A1","reference":"https://fixture.invalid/reviews/A1","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"location":{"coordinates":[-1.6,52.4],"review":{"id":"location","reference":"https://fixture.invalid/reviews/location","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/0/coordinates","url":"https://fixture.invalid/network.json"},"status":"reviewed"},"nodeId":"A1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/0","url":"https://fixture.invalid/network.json"}},{"identity":{"review":{"id":"A1","reference":"https://fixture.invalid/reviews/A1","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"location":{"coordinates":[-1.3,52.4],"review":{"id":"location","reference":"https://fixture.invalid/reviews/location","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/0/coordinates","url":"https://fixture.invalid/network.json"},"status":"reviewed"},"nodeId":"B1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/1","url":"https://fixture.invalid/network.json"}},{"identity":{"review":{"id":"A1","reference":"https://fixture.invalid/reviews/A1","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"location":{"coordinates":[-1,52.6],"review":{"id":"location","reference":"https://fixture.invalid/reviews/location","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/0/coordinates","url":"https://fixture.invalid/network.json"},"status":"reviewed"},"nodeId":"C1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/2","url":"https://fixture.invalid/network.json"}},{"identity":{"review":{"id":"A1","reference":"https://fixture.invalid/reviews/A1","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"location":{"coordinates":[-1,52.2],"review":{"id":"location","reference":"https://fixture.invalid/reviews/location","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/0/coordinates","url":"https://fixture.invalid/network.json"},"status":"reviewed"},"nodeId":"D1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/3","url":"https://fixture.invalid/network.json"}},{"identity":{"review":{"id":"A1","reference":"https://fixture.invalid/reviews/A1","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"location":{"status":"unlocated"},"nodeId":"U1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceRef":{"locator":"/nodes/4","url":"https://fixture.invalid/network.json"}}],"edges":[{"edgeUid":"b288e90cb106567c9e6373ed2409e4bc65e495d4f790d1ea44b4a47497b87afe:circuit:0","geometryStatus":"verified_circuit_and_polyline","identity":{"review":{"id":"edge","reference":"https://fixture.invalid/reviews/edge","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"kind":"circuit","multiplicityReview":{"id":"source-record-multiplicity","reference":"https://fixture.invalid/reviews/source-record-multiplicity","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"multiplicityStatus":"reviewed","node1":"A1","node2":"B1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceIndex":0,"sourceRef":{"locator":"/circuits/0","url":"https://fixture.invalid/network.json"},"geometry":{"coordinates":[[-1.6,52.4],[-1.45,52.45],[-1.3,52.4]],"sourceRef":{"locator":"/circuits/0","url":"https://fixture.invalid/network.json"},"review":{"id":"edge","reference":"https://fixture.invalid/reviews/edge","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"}}},{"edgeUid":"b288e90cb106567c9e6373ed2409e4bc65e495d4f790d1ea44b4a47497b87afe:circuit:1","geometryStatus":"published_topology_only","identity":{"review":{"id":"edge","reference":"https://fixture.invalid/reviews/edge","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"kind":"circuit","multiplicityReview":{"id":"source-record-multiplicity","reference":"https://fixture.invalid/reviews/source-record-multiplicity","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"multiplicityStatus":"reviewed","node1":"B1","node2":"C1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceIndex":1,"sourceRef":{"locator":"/circuits/1","url":"https://fixture.invalid/network.json"}},{"edgeUid":"b288e90cb106567c9e6373ed2409e4bc65e495d4f790d1ea44b4a47497b87afe:circuit:2","geometryStatus":"published_topology_only","identity":{"review":{"id":"edge","reference":"https://fixture.invalid/reviews/edge","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"kind":"circuit","multiplicityReview":{"id":"source-record-multiplicity","reference":"https://fixture.invalid/reviews/source-record-multiplicity","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"multiplicityStatus":"reviewed","node1":"B1","node2":"D1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceIndex":2,"sourceRef":{"locator":"/circuits/2","url":"https://fixture.invalid/network.json"}},{"edgeUid":"b288e90cb106567c9e6373ed2409e4bc65e495d4f790d1ea44b4a47497b87afe:circuit:3","geometryStatus":"published_node_unlocated","identity":{"review":{"id":"edge","reference":"https://fixture.invalid/reviews/edge","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"confirmed"},"kind":"circuit","multiplicityReview":{"id":"source-record-multiplicity","reference":"https://fixture.invalid/reviews/source-record-multiplicity","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"multiplicityStatus":"reviewed","node1":"D1","node2":"U1","rights":{"attribution":"Synthetic test fixture; no real asset or third-party data approval","licenceUrl":"https://fixture.invalid/synthetic-licence","review":{"id":"rights","reference":"https://fixture.invalid/reviews/rights","reviewedAt":"2026-11-17T00:00:00Z","reviewer":"SYNTHETIC TEST ONLY"},"status":"accepted"},"sourceIndex":3,"sourceRef":{"locator":"/circuits/3","url":"https://fixture.invalid/network.json"}}]}};
const JourneyCSS = "#gridatlas-gj03{font:12px/1.4 monospace;color:#0ff;position:absolute;inset:0;pointer-events:none;z-index:30}#gridatlas-gj03 *{box-sizing:border-box}#gridatlas-gj03 button,#gridatlas-gj03 select,#gridatlas-gj03 summary{font:inherit;min-height:44px;color:#0ff;background:#070d10;border:1px solid #477078;padding:8px;cursor:pointer;pointer-events:auto}#gridatlas-gj03 button:disabled{opacity:.45;cursor:default}#gridatlas-gj03 :focus-visible{outline:3px solid #ffd84d;outline-offset:2px}#gridatlas-gj03 .gj-launch{position:absolute;right:10px;top:120px;max-width:190px}#gridatlas-gj03 .gj-panel{pointer-events:auto;position:absolute;right:8px;top:170px;width:min(410px,calc(100% - 16px));max-height:calc(100% - 180px);overflow:auto;background:#020608f5;border:1px solid #0ff;padding:10px;box-shadow:0 4px 20px #000}#gridatlas-gj03 [hidden]{display:none!important}#gridatlas-gj03 .gj-heading{position:sticky;top:0;background:#020608;z-index:1;display:flex;align-items:center;gap:8px;justify-content:space-between}#gridatlas-gj03 .gj-caveat{color:#ffd84d;border-bottom:1px dotted #8b7934;padding-bottom:8px}#gridatlas-gj03 p{margin:8px 0}#gridatlas-gj03 .gj-node{display:block;margin:8px 0}#gridatlas-gj03 select{display:block;width:100%;margin-top:5px}#gridatlas-gj03 .gj-controls{display:flex;flex-wrap:wrap;gap:5px}#gridatlas-gj03 .gj-controls button{flex:1}#gridatlas-gj03 pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#b6d4d6;font:11px/1.4 monospace}#gridatlas-gj03 summary{margin-top:8px}@media(max-width:480px){#gridatlas-gj03 .gj-panel{top:170px;max-height:min(40vh,calc(100% - 176px))}#gridatlas-gj03 .gj-launch{top:120px}}@media(max-height:480px){#gridatlas-gj03 .gj-panel{top:48px;right:6px;width:min(410px,calc(100% - 65px));max-height:calc(100% - 54px)}}@media(prefers-reduced-motion:reduce){#gridatlas-gj03 *{animation:none!important;transition:none!important}}\n";
const JourneyGeneration = '202611172355';
/** Native MapLibre presentation only. The pinned engine owns evidence and traversal. */
function createJourneyController({map, document: D, window: W, planner, fixture, css, generation}) {
  const NS = 'gridatlas-gj03', source = NS + '-route', cursor = NS + '-cursor';
  const layerIds = [NS + '-verified', NS + '-schematic', NS + '-cursor'];
  const empty = () => ({type: 'FeatureCollection', features: []});
  const caveat = 'The travelling light is a learning cursor, not measured current or a power-flow simulation. Dotted links are schematic, not cable routes. Flow direction unavailable.';
  const layerGroups = [], layerLaunchers = [];
  let layerObserver = null, returnFocus = null, originContext = null;
  const on = [], ownedSources = new Map(), ownedLayers = new Map();
  let alive = true, opened = false, plan = null, step = 0, raf = null, playing = false, epoch = 0, demo = false, routeData = empty(), cursorData = empty();
  if (!map || !['addSource', 'addLayer', 'getSource', 'getLayer', 'removeSource', 'removeLayer', 'on', 'off'].every(k => typeof map[k] === 'function')) throw new Error('Native MapLibre map unavailable');
  if (D.getElementById(NS)) throw new Error('Journey already mounted');
  const container = D.getElementById('map-container') || map.getContainer?.();
  const initialPadding = map.getPadding?.();
  if (!container) throw new Error('Native map container unavailable');
  function el(tag, text, parent, attrs = {}) { const e = D.createElement(tag); if (text) e.textContent = text; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; }
  function listen(e, type, fn) { e.addEventListener(type, fn); on.push(() => e.removeEventListener(type, fn)); }
  const root = el('div', null, container, {id: NS, 'data-generation': generation});
  const style = el('style', css, root);
  const opener = el('button', 'Grid Journeys', root, {type: 'button', 'aria-expanded': 'false', 'aria-controls': NS + '-panel', class: 'gj-launch'});
  const panel = el('section', null, root, {id: NS + '-panel', 'aria-label': 'Grid Journeys', hidden: '', class: 'gj-panel'});
  const heading = el('div', null, panel, {class: 'gj-heading'});
  el('strong', 'GRID JOURNEYS', heading);
  const close = el('button', 'Close', heading, {type: 'button', 'aria-label': 'Close Grid Journey'});
  const caption = el('p', caveat, panel, {class: 'gj-caveat'});
  const state = el('p', 'Explore the physical grid on the map, or choose a learning demonstration below.', panel, {role: 'status', 'aria-live': 'polite', class: 'gj-status'});
  const context = el('p', 'Select an asset on the map to explore its surroundings.', panel, {class: 'gj-origin'});
  const realGrid = el('button', 'Explore real grid nearby', panel, {type: 'button'});
  const demoButton = el('button', 'Load SYNTHETIC demonstration', panel, {type: 'button'});
  const label = el('label', 'Explicit starting node ', panel, {class: 'gj-node'});
  const select = el('select', null, label, {'aria-label': 'Explicit starting node', disabled: ''});
  el('option', 'Choose a reviewed node…', select, {value: ''});
  const controls = el('div', null, panel, {class: 'gj-controls'});
  const start = el('button', 'Start', controls, {type: 'button', disabled: ''});
  const pause = el('button', 'Pause', controls, {type: 'button', disabled: ''});
  const next = el('button', 'Next', controls, {type: 'button', disabled: ''});
  const reset = el('button', 'Reset', controls, {type: 'button', disabled: ''});
  const evidence = el('details', null, panel, {class: 'gj-evidence'});
  el('summary', 'Input evidence and limits', evidence);
  evidence.appendChild(caption);
  const receipt = el('pre', 'Real routes: 0 accepted. No measured or modelled MW inputs. Synthetic data loads only on explicit request.', evidence);
  const media = W.matchMedia?.('(prefers-reduced-motion: reduce)');
  function isReduced() { return media?.matches === true; }
  function report(s) { if (alive) state.textContent = s; }
  function pauseMotion() { playing = false; if (raf !== null) W.cancelAnimationFrame(raf); raf = null; pause.disabled = true; start.disabled = !plan?.steps.length || step >= plan.steps.length; }
  function controlsState() { const usable = !!plan?.steps.length; start.disabled = !usable || step >= plan.steps.length || playing; next.disabled = !usable || playing || step >= plan.steps.length; reset.disabled = !plan; pause.disabled = !playing; start.textContent = isReduced() ? 'Start · manual' : 'Start'; }
  function removeMap() {
    for (const [id, object] of [...ownedLayers].reverse()) { if (map.getLayer(id) === object) map.removeLayer(id); ownedLayers.delete(id); }
    for (const [id, object] of ownedSources) { if (map.getSource(id) === object) map.removeSource(id); } ownedSources.clear();
  }
  function installMap() {
    if (!alive || !opened || !plan) return false;
    // isStyleLoaded also waits on map resources; a loaded stylesheet can accept sources earlier.
    if (typeof map.getStyle === 'function' && !map.getStyle()) return true;
    try {
      for (const id of [source, cursor]) if (map.getSource(id) && ownedSources.get(id) !== map.getSource(id)) throw new Error('Journey source collision; existing map source preserved');
      for (const id of layerIds) if (map.getLayer(id) && ownedLayers.get(id) !== map.getLayer(id)) throw new Error('Journey layer collision; existing map layer preserved');
      for (const [id, data] of [[source, routeData], [cursor, cursorData]]) { if (!map.getSource(id)) { map.addSource(id, {type: 'geojson', data}); ownedSources.set(id, map.getSource(id)); } else map.getSource(id).setData(data); }
      const layers = [
        {id: layerIds[0], type: 'line', source, filter: ['==', ['get', 'schematic'], false], paint: {'line-color': '#00ffff', 'line-width': 3}},
        {id: layerIds[1], type: 'line', source, filter: ['==', ['get', 'schematic'], true], paint: {'line-color': '#ffd84d', 'line-width': 3, 'line-dasharray': [1, 3]}},
        {id: layerIds[2], type: 'circle', source: cursor, paint: {'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#00ffff', 'circle-stroke-width': 3}}
      ];
      for (const l of layers) if (!map.getLayer(l.id)) { map.addLayer(l); ownedLayers.set(l.id, map.getLayer(l.id)); }
      return true;
    } catch (e) { pauseMotion(); report('WITHHELD: ' + e.message); removeMap(); plan = null; controlsState(); return false; }
  }
  function writeCursor(coordinates) {
    cursorData = {type: 'FeatureCollection', features: coordinates ? [{type: 'Feature', properties: {meaning: 'learning cursor only'}, geometry: {type: 'Point', coordinates}}] : []};
    if (ownedSources.has(cursor) && ownedSources.get(cursor) === map.getSource(cursor)) map.getSource(cursor).setData(cursorData);
  }
  function lineFor(s) { const e = plan.edgeCatalog.find(e => e.edgeUid === s.edgeUid); if (!e?.coordinates) return null; const coords = e.coordinates.map(p => [...p]); if (s.direction === 'reverse') coords.reverse(); return {e, coords}; }
  function frameRoute() {
    if (!alive || !opened || !plan) return;
    const pts = plan.edgeCatalog.flatMap(e => e.coordinates || []);
    const r = map.getContainer?.().getBoundingClientRect?.(), q = panel.getBoundingClientRect?.();
    let padding = 65;
    if (r && q) { const top = Math.max(45, q.bottom - r.top + 12); padding = q.width > r.width * .6 && r.height - top > 130 ? {left: 35, right: 35, top, bottom: 50} : {left: 45, right: Math.min(r.width * .6, q.width + 25), top: 55, bottom: 55}; }
    if (pts.length && map.fitBounds) { map.setPadding?.({top: 0, right: 0, bottom: 0, left: 0}); map.fitBounds([[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]], {padding, maxZoom: 9, duration: 0}); }
  }
  function showStep(index) {
    const s = plan.steps[index], line = lineFor(s);
    writeCursor(line?.coords.at(-1) || null);
    report(`SYNTHETIC ONLY · ${index + 1}/${plan.steps.length} · ${s.traversal} ${s.nearNode} → ${s.farNode} · ${s.geometryStatus === 'published_node_unlocated' ? 'UNLOCATED: text only' : line?.e.schematic ? 'DOTTED SCHEMATIC: not a cable route' : 'synthetic reviewed polyline'} · journey heading, flow direction unavailable`);
    step = index + 1; controlsState();
  }
  function advance() { pauseMotion(); if (plan && step < plan.steps.length) showStep(step); }
  function resetPlan() { pauseMotion(); step = 0; writeCursor(null); if (plan) report(`SYNTHETIC ONLY · ready · ${plan.visitedUniqueEdges} source-row edges; ${plan.steps.length} moves including explicit backtracking; physical units unknown`); controlsState(); }
  function animate() {
    if (!alive || !opened || !plan || step >= plan.steps.length) { pauseMotion(); controlsState(); return; }
    if (isReduced()) { pauseMotion(); controlsState(); return; }
    const index = step, s = plan.steps[index], line = lineFor(s); let began;
    function frame(now) {
      if (!alive || !opened || !playing) return;
      if (isReduced()) { pauseMotion(); controlsState(); return; }
      began ??= now; const t = Math.min(1, (now - began) / 1000);
      // Only a reviewed polyline gets a travelling light. Schematic/unlocated moves are discrete.
      if (line && !line.e.schematic) {
        const p = t * (line.coords.length - 1), i = Math.min(line.coords.length - 2, Math.floor(p)), f = p - i;
        writeCursor(line.coords[i].map((v, k) => v + (line.coords[i + 1][k] - v) * f));
      }
      if (t < 1) raf = W.requestAnimationFrame(frame);
      else { showStep(index); if (playing) animate(); }
    }
    raf = W.requestAnimationFrame(frame);
  }
  async function choose() {
    const ticket = ++epoch; pauseMotion(); plan = null; routeData = empty(); cursorData = empty(); removeMap(); controlsState();
    if (!select.value || !demo) { report('Choose an explicit reviewed synthetic node. No nearest-node or project connection is inferred.'); return; }
    report('Checking exact source bytes and review ledger…');
    try {
      const candidate = await planner({sourceBytes: fixture.networkText, ledger: fixture.ledger, query: {seed: {chosenNode: select.value}, bounds: {maxNodes: 25, maxEdges: 30, maxMoves: 60, maxGeometryBytes: 16000}}});
      if (!alive || ticket !== epoch || !opened) return;
      if (candidate.status === 'refused' || !candidate.steps.length) { report('WITHHELD: ' + (candidate.refusal || 'no eligible reviewed edges')); return; }
      // The engine classifies evidence. Presentation refuses unsupported output as well.
      if (candidate.edgeCatalog.some(e => !['verified_circuit_and_polyline', 'published_topology_only', 'published_node_unlocated'].includes(e.geometryStatus))) throw new Error('Unsupported geometry evidence');
      plan = candidate;
      routeData = {type: 'FeatureCollection', features: plan.edgeCatalog.filter(e => e.coordinates).map(e => ({type: 'Feature', properties: {edgeUid: e.edgeUid, schematic: e.schematic, meaning: e.label}, geometry: {type: 'LineString', coordinates: e.coordinates}}))};
      receipt.textContent = `SYNTHETIC TEST ONLY; no real assets or third-party approval\nsource SHA256 ${plan.sourceBundleSha}\nreview SHA256 ${plan.reviewLedgerSha}\nplan SHA256 ${plan.planSha256}\n${plan.edgeCatalog.filter(e => e.geometryStatus === 'verified_circuit_and_polyline').length} synthetic polylines; ${plan.edgeCatalog.filter(e => e.schematic).length} schematic; ${plan.edgeCatalog.filter(e => !e.coordinates).length} text-only\nEligible source rows ${plan.visitedUniqueEdges}/${plan.eligibleReachableEdges} in chosen component; excludes disconnected/withheld rows. Physical units and MW unknown.\nBounds: 25 nodes / 30 edges / 60 moves / 16000 geometry bytes.\nSource and receipts: https://fixture.invalid/ — synthetic, not an official source.`;
      if (!installMap()) return;
      resetPlan();
      frameRoute();
    } catch (e) { if (alive && ticket === epoch) report('WITHHELD: ' + e.message); }
  }
  function installLayerControls() {
    const hosts = ['scada-ui-container', 'fs-curtain-keys'].map(id => [id, D.getElementById(id)]);
    hosts.push(['native-grid-menu', D.querySelector?.('#gridatlas-menu-bar-panel-4 .gm-panel-body')]);
    for (const [id, host] of hosts) {
      if (!host || layerGroups.some(g => g.parentNode === host || g.parent === host)) continue;
      // Other native modules use .key-group as the engine-dashboard ready marker.
      // Never create that marker before the engine's original controls exist.
      if (id !== 'native-grid-menu' && !host.querySelector?.('input[data-layer-id]')) continue;
      const group = el('div', null, host, {class: 'key-group', 'data-journey-group': id});
      const title = el('div', 'Grid Journeys', group, {class: 'key-title'});
      const button = el('button', 'Open Grid Journey', group, {type: 'button', class: 'map-ctrl-btn', 'aria-controls': NS + '-panel', 'aria-expanded': String(opened)});
      button.style.cssText = 'min-height:44px;min-width:44px;';
      el('p', 'Exploratory only; real routes require reviewed circuit evidence.', group);
      listen(button, 'click', e => { e.stopPropagation?.(); returnFocus = button; W.__GRIDATLAS_MODULES__?.menuBar?.closeAll?.(); const curtain = D.getElementById('fs-curtain'); if (id === 'fs-curtain-keys' && curtain?.classList?.contains('curtain-open')) D.getElementById('fs-curtain-tab')?.click(); open(); });
      layerGroups.push(group); layerLaunchers.push(button);
    }
  }
  function setOrigin(origin) {
    originContext = null;
    if (origin && typeof origin === 'object') {
      const name = typeof origin.name === 'string' ? origin.name.slice(0, 160) : '';
      const id = typeof origin.id === 'string' || typeof origin.id === 'number' ? String(origin.id).slice(0, 80) : '';
      if (name || id) { originContext = {name, id}; if (Array.isArray(origin.at) && origin.at.length === 2 && origin.at.every(Number.isFinite) && Math.abs(origin.at[0]) <= 180 && Math.abs(origin.at[1]) <= 90 && (origin.at[0] !== 0 || origin.at[1] !== 0)) originContext.at = [...origin.at]; if (['repd', 'datacentre', 'substation'].includes(origin.type)) originContext.type = origin.type; }
    }
    context.textContent = originContext ? 'Selected asset: ' + [originContext.name, originContext.id].filter(Boolean).join(' ? ') + '. Nearby assets are map context; connections need source evidence.' : 'Select an asset on the map to explore its surroundings.';
    realSelection(false);
  }
  function shut() { ++epoch; pauseMotion(); opened = false; panel.hidden = true; opener.setAttribute('aria-expanded', 'false'); removeMap(); if (initialPadding) map.setPadding(initialPadding); for (const b of layerLaunchers) b.setAttribute('aria-expanded', 'false'); const target = returnFocus?.isConnected === false || (returnFocus?.getClientRects && !returnFocus.getClientRects().length) ? D.getElementById('gridatlas-menu-bar-title-4') || opener : returnFocus || opener; target.focus(); }
  function open(options) { if (!alive) return; if (options?.origin) setOrigin(options.origin); opened = true; panel.hidden = false; opener.setAttribute('aria-expanded', 'true'); for (const b of layerLaunchers) b.setAttribute('aria-expanded', 'true'); installMap(); frameRoute(); close.focus(); }
  function realSelection(clearContext = true) { if (clearContext) { originContext = null; context.textContent = 'Selected asset has no reviewed circuit identity. Real circuit journeys remain withheld.'; } ++epoch; pauseMotion(); plan = null; demo = false; select.value = ''; select.disabled = true; removeMap(); controlsState(); report('Explore this asset and the surrounding grid. Nearby assets do not establish a connection.'); }
  listen(opener, 'click', () => {returnFocus = opener; opened ? shut() : open();}); listen(close, 'click', shut);
  listen(panel, 'keydown', e => { if (e.key === 'Escape') { e.preventDefault(); shut(); } });
  listen(demoButton, 'click', () => { ++epoch; pauseMotion(); plan = null; removeMap(); demo = true; select.disabled = false; select.replaceChildren(); el('option', 'Choose a reviewed synthetic node…', select, {value: ''}); for (const n of fixture.ledger.nodes) el('option', 'SYNTHETIC ' + n.nodeId, select, {value: n.nodeId}); report('SYNTHETIC DEMONSTRATION LOADED. These are invented assets; choose a starting node explicitly.'); controlsState(); });
  listen(realGrid, 'click', event => {
    event.stopPropagation?.();
    const vicinity = W.__GRIDATLAS_MODULES__?.gridVicinity;
    if (!vicinity?.open) {
      const grid = D.getElementById('gridatlas-menu-bar-title-4');
      if (!grid?.click) {
        const layers = D.getElementById('scada-ui-container');
        if (!layers?.scrollIntoView) { report('Grid layers are loading. Try Explore grid again when the map controls appear.'); return; }
        if (originContext?.at) map.flyTo?.({center: [...originContext.at], duration: 0});
        shut(); layers.scrollIntoView({block: 'start', behavior: 'instant'});
        layers.querySelector?.('input[data-layer-id]')?.focus();
        return;
      }
      if (originContext?.at) map.flyTo?.({center: [...originContext.at], duration: 0});
      shut();
      if (grid.getAttribute?.('aria-expanded') !== 'true') grid.click();
      grid.focus();
      return;
    }
    pauseMotion(); vicinity.open({origin: originContext?.at ? {...originContext, at: [...originContext.at]} : undefined, radiusKm: 10}); shut();
  });
  listen(select, 'change', choose); listen(next, 'click', advance); listen(reset, 'click', resetPlan);
  listen(start, 'click', () => { if (!plan) return; if (isReduced()) { advance(); return; } playing = true; controlsState(); animate(); });
  listen(pause, 'click', () => { pauseMotion(); controlsState(); });
  listen(W, 'gridatlas:card-open', e => { if (e.detail?.origin) setOrigin(e.detail.origin); else realSelection(); });
  listen(W, 'gridatlas:journey-open', e => open(e.detail));
  installLayerControls();
  if (W.MutationObserver && D.documentElement) { layerObserver = new W.MutationObserver(installLayerControls); layerObserver.observe(D.documentElement, {childList: true, subtree: true}); }
  const styleLoad = () => { pauseMotion(); installMap(); controlsState(); }; map.on('style.load', styleLoad);
  map.on('resize', frameRoute);
  const preferenceChange = () => { if (isReduced()) pauseMotion(); controlsState(); };
  if (media?.addEventListener) { media.addEventListener('change', preferenceChange); on.push(() => media.removeEventListener('change', preferenceChange)); }
  function mapRemoved() { destroy(true); }
  function destroy(mapWasRemoved = false) {
    if (!alive) return; alive = false; ++epoch; pauseMotion();
    try {
      map.off('style.load', styleLoad); map.off('resize', frameRoute); map.off('remove', mapRemoved); for (const off of on.splice(0)) off();
      // MapLibre fires remove AFTER destroying its style. Its layers/sources have already gone.
      if (mapWasRemoved) { ownedLayers.clear(); ownedSources.clear(); } else { removeMap(); if (initialPadding) map.setPadding(initialPadding); }
    } finally { layerObserver?.disconnect(); for (const group of layerGroups) group.remove(); root.remove(); }
  }
  map.on('remove', mapRemoved);
  controlsState();
  return Object.freeze({open, setOrigin, close: shut, snapshot: () => ({alive, opened, playing, step, status: plan?.status || 'withheld', synthetic: demo, origin: originContext ? {...originContext} : null, layerControls: layerGroups.length, steps: plan?.steps.length || 0, edgeCount: plan?.edgeCatalog.length || 0}), destroy});
}

// Bounded public-map attachment. No private card closures, new map or network fetch.
const registry = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (!registry.gridJourneyPreview) {
  let controller = null, timer = null, attempts = 0, stopped = false;
  function mount(map = window.__GRIDATLAS_V9_MAP__) {
    stopped = false;
    if (controller?.snapshot().alive) return controller;
    controller = null;
    controller = createJourneyController({map, document, window, planner: JourneyEngine.planJourney, fixture: JourneyFixture, css: JourneyCSS, generation: JourneyGeneration});
    return controller;
  }
  function attach() {
    if (stopped) return;
    if (window.__GRIDATLAS_V9_MAP__) { try { mount(); } catch (e) { console.warn('[Grid Journey preview]', e.message); } return; }
    if (++attempts < 120) timer = setTimeout(attach, 250);
    else console.warn('[Grid Journey preview] native map unavailable; no replacement map created');
  }
  registry.gridJourneyPreview = Object.freeze({schema: 'gridatlas.journey.preview.v1', generation: JourneyGeneration, mount, open(options) { return mount().open(options); }, setOrigin(origin) { return mount().setOrigin(origin); }, snapshot: () => controller?.snapshot() || {status: 'map-unavailable'}, destroy() { stopped = true; clearTimeout(timer); controller?.destroy(); controller = null; }});
  attach();
}

})();
