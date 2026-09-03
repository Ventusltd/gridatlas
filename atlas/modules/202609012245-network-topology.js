/**
 * Module: network-topology
 *
 * What the network operator publishes about ONE site: its nodes, the
 * circuits that land on them, the transformers between them, the changes
 * it has published for future years, and which other sites those circuits
 * reach. Appendix B of the Electricity Ten Year Statement, read as a
 * node/branch model and reported as facts.
 *
 * Successor at generation 202609012245: the node-level adjacency this module
 * already builds is now handed OUT, so that the electrical-distance module
 * can traverse it instead of building a second one. A second implementation
 * of voltageOf would be a second opinion about which voltages are real, and
 * this estate has already shipped one cartridge carrying two geodesies that
 * disagreed in the last place. Nothing else changed: at() is byte-for-byte
 * the incumbent's, and the parity proof holds the two to identical answers
 * on the published payload.
 *
 * It answers "what is here, and what is it connected to". It does not
 * answer "can this project connect", and it cannot: that depends on queue
 * position, committed connections, consent and commercial terms which no
 * published appendix contains. The product says so itself and the refusal
 * travels inside every result, in the same object as the numbers, because
 * a caveat in a different place from the figure is a caveat nobody reads.
 *
 * Three disciplines, each of them a defect this estate has already shipped:
 *
 *   VOLTAGE IS NEVER MIXED. A card printed "5.1-49.6 kA" across a 132 kV
 *   and a 400 kV busbar and an engineer would have read it as one number
 *   for one point. So every answer here is grouped by the voltage of the
 *   node the circuit lands on, and a caller asking for one voltage gets
 *   only that voltage. There is no site-wide range in this module at all.
 *
 *   VOLTAGE IS NEVER DECODED. The node-code convention (digit 1->132,
 *   2->275, 4->400) is derived, not documented, and the product reports
 *   726 of 2,679 nodes whose voltage their site does not declare. This
 *   reads `voltage_kv` and honours `voltage_consistent_with_site`; where
 *   that is false the voltage is `null` and the node is grouped under
 *   'undeclared', never guessed from its name.
 *
 *   R, X AND B ARE NOT A LOAD FLOW. They are published percentages on a
 *   100 MVA base. Carrying them is publishing; solving with them would
 *   need a declared model, generation and load assumptions, tap positions
 *   and contingencies, and validation against a trusted solver. This
 *   module carries them and says what base they are on. It computes
 *   nothing from them.
 *
 * Fail closed: an unrecognised schema yields no index and therefore no
 * answers, rather than plausible ones from a shape that has moved.
 *
 * Depends on: nothing. Topology is not geometry - this module never
 * measures a distance and never touches a coordinate.
 */
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

  /* A node's voltage is trusted only where the product says the site
     declares it. Everything else is undeclared - never inferred from the
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
     owns both ends of a branch publishes it twice.
     ------------------------------------------------------------------
     A transformer's two windings are at the same site by construction, so
     almost every transformer lands twice: 1,394 of the 1,472 published
     transformers have both ends at one site. Counting landings therefore
     reported 2,944 machines where 1,550 site-held machines exist, and
     Cowley - five machines, COWL41 to COWL11 and COWL12, 269 to 278 MVA -
     said ten.

     It is NOT only transformers. Measured against
     gb-transmission-network.v1 on 2026-09-03:

       transformers      2,944 landings -> 1,550 units, 484 of 525 sites differ
       circuits          2,784 landings -> 2,638 units,  78 of 636 sites differ
       planned changes   4,460 landings -> 3,696 units, 282 of 645 sites differ

     so the same correction is applied to all three site-wide aggregates.
     The PER-VOLTAGE lists are untouched and must stay as they are: "at
     400 kV, 5 transformers" and "at 132 kV, 5 transformers" are the same
     five machines seen from each winding, which is what a reader standing
     at a busbar is asking for.

     Halving was rejected: it is wrong at 57 of the 525 sites that hold a
     transformer, and 24 of them publish an odd number of landings, so
     halving would invent a fractional machine. The pair is keyed instead,
     and a pair seen from BOTH directions was published twice while a pair
     seen from one - which is what a voltage-filtered query sees of an
     internal machine - was published once. */
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

    /* The adjacency, handed out rather than rebuilt.
       ------------------------------------------------------------------
       Every accessor here is a READ of the structures at() already uses,
       so a traversal cannot disagree with a one-hop view about which
       nodes exist, which site a node belongs to, or whether a node's
       voltage is trustworthy. planned_change rows are excluded from
       edges: a change published for 2029 is not a path a current can
       take today, and treating it as one would be the headroom lie in a
       new costume. They remain available through at(). */
    function graph() {
      return {
        schema: 'gridatlas.module.network-topology.graph.v1',
        has: (name) => nodes.has(name),
        nodeVoltageKv: (name) => voltageOf(nodes.get(name)),
        nodeSiteCode: (name) => {
          const node = nodes.get(name);
          return node ? node.site_code : null;
        },
        /* circuits and transformers only - see above */
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
             not a neighbour either - it has not been built. */
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
          /* Physical units, deduplicated across the two ends a site may
             hold of the same branch. The landing tallies are published
             beside them so a reader can see the difference rather than
             wonder which number the per-voltage lists add up to. */
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
