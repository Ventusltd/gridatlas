/**
 * Module: owner-boundary
 *
 * Which transmission owner the published assets at a site belong to, and
 * which circuits cross from one owner's network into another's.
 *
 * WHY THIS EXISTS
 * ---------------
 * Great Britain's transmission network is not one network. Appendix B
 * publishes a `transmission_owner` on every site, node, circuit and
 * transformer, and four values occur: NGET in England and Wales, SPT in
 * southern Scotland, SHET in the north of Scotland, and OFTO for the
 * offshore assets. Most circuits sit wholly inside one owner's network.
 * Sixty-two do not: their two ends are nodes that different owners
 * publish, and a circuit like that is the seam between two networks.
 *
 * That seam is worth naming because a connection near it involves more
 * than one party. It is a fact about who publishes what, read straight
 * off the product, and it is reported here with both owners named on
 * every boundary circuit so that nobody has to infer it from a map colour.
 *
 * WHAT IT IS NOT
 * --------------
 * Ownership is not a statement about who a project would contract with.
 * Connection agreements in Great Britain are made with the system operator
 * and the relevant owner under a framework this data does not describe,
 * and a site being NGET's says nothing about the counterparty, the process
 * or the terms of any connection at it. This module reports the published
 * owner of the published assets and stops there.
 *
 * Nor is an owner ever inferred. Forty-nine nodes publish no owner - all
 * of them on placeholder site codes such as OFFS and ONSH that the product
 * does not list as sites - and where a node's owner is not published it is
 * reported as unknown. A circuit with an unknown end is reported as
 * undetermined, not as a boundary and not as internal. Nothing is read
 * from a site name, a node code or a neighbour.
 *
 * TWO DIFFERENT FACTS, KEPT APART
 * -------------------------------
 * A circuit carries its own `transmission_owner`, and so do the nodes at
 * its two ends. A BOUNDARY circuit is one whose two END nodes belong to
 * different owners. Separately, seven circuits in the product carry an
 * owner that matches neither end - SPT and OFTO circuits between SHET
 * nodes at Hunterston, Inverness and Nedd. That is not a boundary by the
 * definition above; it is the asset's own published owner differing from
 * the owner of the nodes it lands on, and it is reported as exactly that.
 *
 * Voltages are trusted only where the site declares them and never decoded
 * from a node code; assets are counted per voltage and never across
 * voltages. R, X and B are carried and never computed with. No rating here
 * is headroom.
 *
 *   node tools/proofs/modules/202609012350-owner-boundary.proof.mjs
 */
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

  /**
   * @param product  the parsed data-grid-gb transmission-network payload
   * @returns an index, or null if the schema is not the one this reads
   */
  function index(product) {
    if (!product || product.schema !== ACCEPTS) return null;
    const topology = NS.networkTopology;
    if (!topology || typeof topology.index !== 'function') return null;
    const base = topology.index(product);
    if (!base || typeof base.graph !== 'function') return null;
    const graph = base.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    /* The owner of a NODE, from the node record and nowhere else. The
       graph does not hand this out, so it is read from the product here;
       the graph is still the only authority on which nodes exist, which
       site they belong to and what voltage may be trusted. */
    const nodeOwner = new Map();
    for (const node of product.nodes || []) {
      if (node && node.node) nodeOwner.set(node.node, asString(node.transmission_owner));
    }
    const ownerOfNode = (name) => (nodeOwner.has(name) ? nodeOwner.get(name) : null);

    /**
     * The relation between the two ends of a branch, by published owner.
     *   'boundary'     both ends published, and they differ
     *   'internal'     both ends published, and they agree
     *   'undetermined' at least one end publishes no owner
     */
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
        /* the three published owners, each named for what it is */
        from_owner: nearOwner || UNKNOWN,
        to_owner: farOwner || UNKNOWN,
        asset_owner: assetOwner || UNKNOWN,
        ends: relation(nearOwner, farOwner),
        /* the asset's own owner set against the ends it lands on; null
           where either end is unknown, because "matches neither" cannot
           be said of an end that has not been published */
        asset_owner_matches_an_end: assetOwner && nearOwner && farOwner
          ? (assetOwner === nearOwner || assetOwner === farOwner)
          : null,
        /* carried, never computed with */
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

    /**
     * Ownership at one site: the site's own published owner, the owner of
     * each of its nodes, the assets landing on those nodes counted per
     * owner within each voltage, and every boundary branch named with both
     * owners.
     *
     * @param key      site code or exact site name
     * @param options  { voltageKv } to restrict to nodes the site declares
     *                 at that voltage
     */
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

      /* Assets are counted once per site even when both ends are here,
         and grouped under the declared voltage of the node they were
         first met at in sorted node order. */
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

    /**
     * Every boundary branch in the product, each reported once, with both
     * owners named. The seam between the networks as a list.
     */
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
