/**
 * Module: planned-change
 *
 * What the network operator has PUBLISHED as planned for the circuits and
 * transformers that touch one site: additions, changes and removals, by
 * the year they are published against.
 *
 * WHY THIS EXISTS
 * ---------------
 * Appendix B carries 2,230 rows that are not the network. They are the
 * operator's statement of what the network is planned to look like in
 * 2026, 2028, 2030 and 2033: a circuit to be added, a circuit whose
 * parameters are to change, a transformer to be removed. The topology
 * module carries them and the graph it hands out deliberately refuses to
 * walk them, which is right - a circuit published for 2030 is not a path
 * a current can take today. But refusing to walk them is not the same as
 * reporting them, and a reader looking at a site with four published
 * additions in 2028 is entitled to be told so, with the year and the
 * status and the published parameters, in the operator's own words.
 *
 * So this module reports the planned rows that land at a site, grouped by
 * year and then by status, with real counts. It reads the same product the
 * topology module reads and resolves sites, nodes and voltages through the
 * topology index rather than through a second opinion of its own.
 *
 * WHAT IT IS NOT
 * --------------
 * A published plan is not infrastructure. Every entry this module returns
 * is marked as a publication about a future year, it is never mixed into
 * a list of circuits that exist, and nothing here can be traversed: the
 * module contains no path, no hop and no neighbour, and the graph it
 * borrows excludes these rows from its edges by construction.
 *
 * A published plan is not a commitment either. The operator publishes
 * planned changes as its current view of network development; the view
 * moves between editions, an addition can be deferred or dropped, and a
 * year against a row is the year the row is published for, not a
 * consent, not a delivery date and not a date on which anything could
 * connect. A "Removed" row says a circuit is planned to be taken out; it
 * does not say why, and it does not say what replaces it.
 *
 * And, as everywhere in this estate: nothing here states whether a project
 * can connect. R, X and B on a planned row are carried as published on a
 * 100 MVA base and never computed with; ratings on a planned row are the
 * planned circuit's, not a spare allowance; voltages are trusted only where
 * the product says the site declares them and are never decoded from a
 * node code.
 *
 * ONE PUBLISHED FACT THAT IS WORTH CARRYING
 * -----------------------------------------
 * 552 of the 2,230 planned rows sit on a node pair that already has a
 * circuit or transformer published for today, and 16 of those are marked
 * "Addition" - a second circuit on an existing pair, on the face of it.
 * Whether a pair is published today is a fact from the same product, so
 * each entry carries it. It is a cross-reference, not a judgement about
 * what the addition means.
 *
 *   node tools/proofs/modules/202609012345-planned-change.proof.mjs
 */
(() => {
  'use strict';

  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.plannedChange) return;

  const SCHEMA = 'gridatlas.module.planned-change.v1';
  const ACCEPTS = 'data-grid-gb.transmission-network.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const NOT_EXISTING =
    'Every entry here is a change the network operator has published for '
    + 'a future year. None of it is a circuit or a transformer that exists '
    + 'today, none of it is a path, and none of it is counted among the '
    + 'site\'s circuits anywhere in this estate.';

  const NOT_A_COMMITMENT =
    'A published plan is the operator\'s current view of network '
    + 'development, and the view moves between editions. It is not a '
    + 'commitment to build, not a consent, and the year on a row is the '
    + 'year it is published for - not a delivery date and not a date on '
    + 'which anything could connect.';

  const NOT_AN_ASSESSMENT =
    'Nothing here states whether any project can connect at this site, '
    + 'before or after a planned change. That depends on queue position, '
    + 'committed connections, consent and commercial terms which no '
    + 'published appendix contains. A rating on a planned row is the '
    + 'planned asset\'s rating, not a spare allowance.';

  const IMPEDANCE_BASIS =
    'R, X and B on a planned row are percentages on a 100 MVA base, as '
    + 'published for the planned asset. They are carried and not computed '
    + 'with.';

  /* The order the statuses are presented in. Anything the product
     publishes that is not one of these three is kept and sorted after
     them by name, never dropped. */
  const STATUS_ORDER = Object.freeze(['Addition', 'Change', 'Removed']);
  const ASSETS = Object.freeze(['circuit', 'transformer']);

  const asString = (v) => (typeof v === 'string' && v.length ? v : null);
  const asNumber = (v) => (Number.isFinite(v) ? v : null);

  function statusRank(status) {
    const i = STATUS_ORDER.indexOf(status);
    return i === -1 ? STATUS_ORDER.length : i;
  }

  /* Years are published as strings ("2026"). They are sorted numerically
     where they parse and left in their published form on the entry. */
  function yearRank(year) {
    const n = Number(year);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  /**
   * Is there a circuit or a transformer published for TODAY between
   * these two nodes? Read off the graph's edges, which are circuits and
   * transformers only, so a planned row can never vouch for itself.
   */
  function publishedToday(graph, nearNode, farNode) {
    const today = { circuit: false, transformer: false };
    for (const entry of graph.edgesAt(nearNode)) {
      if (entry.row[entry.far] !== farNode) continue;
      if (entry.kind === 'circuit') today.circuit = true;
      if (entry.kind === 'transformer') today.transformer = true;
    }
    return today;
  }

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

    const rows = Array.isArray(product.planned_changes) ? product.planned_changes : [];

    /* Planned rows land on their two nodes exactly as branches do in the
       topology module, so that a site query is a lookup and not a scan. */
    const byNode = new Map();
    for (const row of rows) {
      if (!row) continue;
      for (const [near, far] of [['node_1', 'node_2'], ['node_2', 'node_1']]) {
        const name = row[near];
        if (!name) continue;
        if (!byNode.has(name)) byNode.set(name, []);
        byNode.get(name).push({ row, near, far });
      }
    }

    /* Product-wide tallies. These are counts of published rows, each
       counted once, and they are the only place in this module where a
       row is counted without reference to a site. */
    const tally = { by_year: {}, by_status: {}, by_asset: {} };
    for (const row of rows) {
      if (!row) continue;
      const y = asString(row.year) || 'unstated';
      const s = asString(row.status) || 'unstated';
      const a = asString(row.asset) || 'unstated';
      tally.by_year[y] = (tally.by_year[y] || 0) + 1;
      tally.by_status[s] = (tally.by_status[s] || 0) + 1;
      tally.by_asset[a] = (tally.by_asset[a] || 0) + 1;
    }

    function describe(landing, nearNode) {
      const row = landing.row;
      const farNode = row[landing.far];
      const farSiteCode = graph.nodeSiteCode(farNode) || null;
      const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
      const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
      const asset = asString(row.asset);
      const entry = {
        publication: 'planned',
        year: asString(row.year),
        status: asString(row.status),
        asset,
        from_node: nearNode,
        to_node: farNode,
        from_site_code: nearSiteCode,
        to_site_code: farSiteCode,
        to_site_name: farSite ? farSite.name : null,
        within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
        /* trusted only where the site declares it; null otherwise */
        from_voltage_kv: graph.nodeVoltageKv(nearNode),
        to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
        transmission_owner: asString(row.transmission_owner),
        labels: Array.isArray(row.labels) ? row.labels.slice() : [],
        /* carried, never computed with */
        parameters_pct_100mva: graph.parametersOf(row),
        pair_published_today: graph.has(farNode)
          ? publishedToday(graph, nearNode, farNode)
          : { circuit: false, transformer: false }
      };
      if (asset === 'transformer') {
        entry.rating_mva = asNumber(row.rating_mva);
        entry.voltage_ratio_kv = asString(row.voltage_ratio_kv);
      } else {
        entry.circuit_type = asString(row.circuit_type);
        entry.ohl_km = asNumber(row.ohl_km);
        entry.cable_km = asNumber(row.cable_km);
        entry.ratings_mva = graph.ratingsOf(row);
      }
      return entry;
    }

    /**
     * Every planned change landing at one site, grouped by year and then
     * by status. A row landing on two nodes of the same site is reported
     * once, from the first node it is met at in sorted node order.
     *
     * @param key      site code or exact site name
     * @param options  { voltageKv } to restrict to rows landing on a node
     *                 the site declares at that voltage
     */
    function at(key, options) {
      const site = base.site(key);
      if (!site) return null;
      const opts = options || {};
      const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;

      const nodes = graph.nodesOfSite(site.code)
        .filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);

      const seen = new Set();
      const entries = [];
      for (const nodeName of nodes) {
        for (const landing of byNode.get(nodeName) || []) {
          if (seen.has(landing.row)) continue;
          seen.add(landing.row);
          entries.push(describe(landing, nodeName));
        }
      }

      /* year -> status -> entries, in a stable presentation order */
      const years = new Map();
      for (const entry of entries) {
        const y = entry.year || 'unstated';
        if (!years.has(y)) years.set(y, new Map());
        const statuses = years.get(y);
        const s = entry.status || 'unstated';
        if (!statuses.has(s)) statuses.set(s, []);
        statuses.get(s).push(entry);
      }

      const by_year = [...years.entries()]
        .sort((a, b) => yearRank(a[0]) - yearRank(b[0]) || a[0].localeCompare(b[0]))
        .map(([year, statuses]) => {
          const by_status = [...statuses.entries()]
            .sort((a, b) => statusRank(a[0]) - statusRank(b[0]) || a[0].localeCompare(b[0]))
            .map(([status, list]) => {
              list.sort((a, b) => String(a.to_node).localeCompare(String(b.to_node)));
              const by_asset = {};
              for (const a of ASSETS) by_asset[a] = list.filter((e) => e.asset === a).length;
              return { status, entries: list, counts: { entries: list.length, by_asset } };
            });
          const counts = { entries: 0, by_status: {} };
          for (const group of by_status) {
            counts.entries += group.counts.entries;
            counts.by_status[group.status] = group.counts.entries;
          }
          return { year, by_status, counts };
        });

      const counts = { planned_changes: entries.length, by_year: {}, by_status: {}, by_asset: {} };
      for (const y of by_year) counts.by_year[y.year] = y.counts.entries;
      for (const e of entries) {
        const s = e.status || 'unstated';
        const a = e.asset || 'unstated';
        counts.by_status[s] = (counts.by_status[s] || 0) + 1;
        counts.by_asset[a] = (counts.by_asset[a] || 0) + 1;
      }
      counts.on_a_pair_published_today = entries
        .filter((e) => e.pair_published_today.circuit || e.pair_published_today.transformer).length;

      return {
        schema: SCHEMA,
        source: ACCEPTS,
        site: { code: site.code, name: site.name },
        requested_voltage_kv: voltageKv,
        scope: voltageKv == null
          ? 'rows landing on any node of this site; each entry carries the '
            + 'declared voltage of the node it lands on, and undeclared is '
            + 'undeclared'
          : 'rows landing on a node this site declares at ' + voltageKv + ' kV only',
        nodes_considered: nodes.length,
        by_year,
        counts,
        not_existing: NOT_EXISTING,
        not_a_commitment: NOT_A_COMMITMENT,
        not_an_assessment: NOT_AN_ASSESSMENT,
        impedance_basis: IMPEDANCE_BASIS
      };
    }

    return {
      schema: SCHEMA,
      source: ACCEPTS,
      counts: Object.assign({ planned_changes: rows.length }, tally),
      site: base.site,
      at
    };
  }

  NS.plannedChange = Object.freeze({
    schema: SCHEMA,
    accepts: ACCEPTS,
    requires: REQUIRES,
    status_order: STATUS_ORDER,
    not_existing: NOT_EXISTING,
    not_a_commitment: NOT_A_COMMITMENT,
    not_an_assessment: NOT_AN_ASSESSMENT,
    impedance_basis: IMPEDANCE_BASIS,
    index
  });
})();
