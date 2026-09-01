/**
 * Module: electrical-distance
 *
 * How far away a substation is, measured in the network operator's own
 * published circuits rather than in kilometres.
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything this estate has measured until now has been geometry. The
 * geodesy module answers "how many kilometres from this project to that
 * substation", and it answers it correctly, to the last place. But a
 * kilometre is not a connection. Two substations 7 km apart can be on
 * opposite sides of a network boundary with no circuit between them; two
 * substations 90 km apart can be the two ends of a single published
 * circuit. A map that shows only the first number invites the reader to
 * infer the second, and that inference is wrong often enough to be
 * dangerous in a document someone spends money on.
 *
 * So this module answers a different question, from a different source:
 * on the network Appendix B actually publishes, how many circuits lie
 * between these two sites, and which ones? Every hop is a published row
 * with an identity. The answer is a citation, not an estimate.
 *
 * WHAT IT IS NOT
 * --------------
 * A hop count is not a distance. Two hops is not "twice as far" as one,
 * and a site one hop away is not thereby available to connect to. It is
 * not an impedance either: R, X and B are carried on every hop exactly as
 * published, and this module contains no arithmetic over them at all -
 * summing impedance along a path is the first step of a load flow, and a
 * load flow needs a declared model, base values, taps, generation and load
 * assumptions, contingencies and validation against a trusted solver. None
 * of those are in this file, so neither is the sum.
 *
 * THE ONE RULE THAT SHAPES THE TRAVERSAL
 * --------------------------------------
 * A voltage may only change across a transformer, and when it does the
 * transformer is named in the path. A circuit whose two ends carry
 * different declared voltages is not a voltage change - it is a
 * contradiction in the data, and the traversal refuses it and says so
 * rather than quietly walking through. Undeclared voltages are carried as
 * undeclared and never guessed from a node code.
 *
 *   node tools/proofs/modules/202609012245-electrical-distance.proof.mjs
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.electricalDistance) return;

  const SCHEMA = 'gridatlas.module.electrical-distance.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const NOT_A_DISTANCE =
    'Hops are published circuits between two sites, not a distance. A site '
    + 'one hop away may be a hundred kilometres away, and a site ten '
    + 'kilometres away may be on no shared circuit at all.';

  const NOT_A_CAPACITY =
    'A path existing on the published network says nothing about whether '
    + 'anything can flow along it for a new project. Ratings are the '
    + 'circuit\'s, not a spare allowance, and queue position, committed '
    + 'connections, consent and commercial terms appear in no appendix.';

  const IMPEDANCE_CARRIED =
    'R, X and B are reproduced on each hop exactly as published, on a '
    + '100 MVA base. They are not added, scaled or combined anywhere in '
    + 'this module. A sum of them would be the beginning of a load flow, '
    + 'which needs a declared model this data does not contain.';

  const UNDECLARED = 'undeclared';

  /* A traversal must not invent a voltage, so the two ends of an edge are
     compared only when BOTH are declared. */
  function crossing(graph, nearNode, farNode) {
    const near = graph.nodeVoltageKv(nearNode);
    const far = graph.nodeVoltageKv(farNode);
    return {
      near_kv: near,
      far_kv: far,
      both_declared: near != null && far != null,
      changes: near != null && far != null && near !== far
    };
  }

  function describe(graph, entry, nearNode) {
    const farNode = entry.row[entry.far];
    const cross = crossing(graph, nearNode, farNode);
    return {
      kind: entry.kind,
      from_node: nearNode,
      to_node: farNode,
      from_site_code: graph.nodeSiteCode(nearNode) || null,
      to_site_code: graph.nodeSiteCode(farNode) || null,
      from_voltage_kv: cross.near_kv,
      to_voltage_kv: cross.far_kv,
      voltage_changed: cross.changes,
      /* The transformer's own published ratio, where it has one. Only 140
         of 1,472 transformers carry it, so it is reported when present and
         never reconstructed from the two node voltages when absent - a
         reconstructed ratio would be this module's opinion wearing the
         product's authority. */
      voltage_ratio_kv: entry.kind === 'transformer'
        && typeof entry.row.voltage_ratio_kv === 'string'
        ? entry.row.voltage_ratio_kv : null,
      /* carried, never computed with */
      ratings_mva: graph.ratingsOf(entry.row),
      transformer_rating_mva: entry.kind === 'transformer'
        && Number.isFinite(entry.row.rating_mva) ? entry.row.rating_mva : null,
      parameters_pct_100mva: graph.parametersOf(entry.row)
    };
  }

  /**
   * Is this edge legal to walk?
   *
   * A transformer is the only thing that may change voltage. A circuit
   * that appears to change voltage is a contradiction between two
   * published node records, and it is refused and reported rather than
   * traversed - a silent walk through it would mix voltages, which is the
   * exact failure this estate holds itself to never repeating.
   */
  function legality(kind, cross) {
    if (!cross.changes) return { legal: true, refusal: null };
    if (kind === 'transformer') return { legal: true, refusal: null };
    return {
      legal: false,
      refusal: 'a ' + kind + ' whose two ends carry different declared '
        + 'voltages (' + cross.near_kv + ' kV and ' + cross.far_kv + ' kV); '
        + 'only a transformer may change voltage, so this edge is not walked'
    };
  }

  function startNodes(graph, site, voltageKv) {
    const nodes = graph.nodesOfSite(site.code);
    if (voltageKv == null) return nodes;
    return nodes.filter((name) => graph.nodeVoltageKv(name) === voltageKv);
  }

  /**
   * The shortest published path between two sites, in circuits.
   *
   * Breadth-first, so the first arrival is a fewest-hop path. Where
   * several paths tie, the one found first by sorted node order is
   * returned and `ties` says how many others arrived at the same depth,
   * because "the" path implies a uniqueness the network does not have.
   *
   * @param index      a network-topology index (must expose graph())
   * @param fromKey    site code or exact site name
   * @param toKey      site code or exact site name
   * @param options    { voltageKv, maxHops }
   * @returns a result object, or null if either site is unknown
   */
  function between(index, fromKey, toKey, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const from = index.site(fromKey);
    const to = index.site(toKey);
    if (!from || !to) return null;

    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
    const maxHops = Number.isFinite(opts.maxHops) ? opts.maxHops : 6;

    const targets = new Set(graph.nodesOfSite(to.code));
    const origins = startNodes(graph, from, voltageKv);

    const base = {
      schema: SCHEMA,
      from: { code: from.code, name: from.name },
      to: { code: to.code, name: to.name },
      requested_voltage_kv: voltageKv,
      max_hops: maxHops,
      not_a_distance: NOT_A_DISTANCE,
      not_a_capacity: NOT_A_CAPACITY,
      impedance_basis: IMPEDANCE_CARRIED
    };

    if (!origins.length) {
      return Object.assign({}, base, {
        reached: false,
        reason: voltageKv == null
          ? 'the origin site publishes no nodes in this product'
          : 'the origin site publishes no node at ' + voltageKv + ' kV',
        hops: null, path: [], refusals: [], ties: 0, explored_nodes: 0
      });
    }

    if (from.code === to.code) {
      return Object.assign({}, base, {
        reached: true, hops: 0, path: [], refusals: [], ties: 0,
        explored_nodes: origins.length,
        reason: 'the same site'
      });
    }

    const seen = new Map();
    const refusals = [];
    let frontier = [];
    for (const name of origins.slice().sort()) {
      if (targets.has(name)) {
        return Object.assign({}, base, {
          reached: true, hops: 0, path: [], refusals: [], ties: 0,
          explored_nodes: 1,
          reason: 'both site codes resolve to the same node'
        });
      }
      seen.set(name, null);
      frontier.push(name);
    }

    for (let depth = 1; depth <= maxHops; depth += 1) {
      const next = [];
      const arrivals = [];
      for (const nearNode of frontier) {
        for (const entry of graph.edgesAt(nearNode)) {
          const farNode = entry.row[entry.far];
          if (!farNode || !graph.has(farNode)) continue;
          const cross = crossing(graph, nearNode, farNode);
          const verdict = legality(entry.kind, cross);
          if (!verdict.legal) {
            refusals.push({
              at_node: nearNode, to_node: farNode,
              kind: entry.kind, reason: verdict.refusal
            });
            continue;
          }
          if (seen.has(farNode)) continue;
          seen.set(farNode, { via: entry, from: nearNode });
          if (targets.has(farNode)) arrivals.push(farNode);
          else next.push(farNode);
        }
      }

      if (arrivals.length) {
        arrivals.sort();
        const path = [];
        let cursor = arrivals[0];
        while (cursor) {
          const step = seen.get(cursor);
          if (!step) break;
          path.unshift(describe(graph, step.via, step.from));
          cursor = step.from;
        }
        return Object.assign({}, base, {
          reached: true,
          hops: path.length,
          path,
          transformers_crossed: path.filter((h) => h.kind === 'transformer').length,
          voltage_changes: path.filter((h) => h.voltage_changed).length,
          ties: arrivals.length - 1,
          refusals,
          explored_nodes: seen.size,
          arrival_node: arrivals[0]
        });
      }

      if (!next.length) break;
      frontier = next.sort();
    }

    return Object.assign({}, base, {
      reached: false,
      reason: 'no published path within ' + maxHops + ' hops'
        + (voltageKv == null ? '' : ' from a ' + voltageKv + ' kV node')
        + '; this is a statement about the published network, not about '
        + 'whether the two sites are connected in reality',
      hops: null, path: [], refusals, ties: 0, explored_nodes: seen.size
    });
  }

  /**
   * Every site reachable within N hops, with the hop count at which it was
   * first reached. The neighbourhood a click is actually in, electrically.
   *
   * @param index    a network-topology index
   * @param key      site code or exact site name
   * @param options  { hops, voltageKv }
   */
  function within(index, key, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const site = index.site(key);
    if (!site) return null;

    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
    const limit = Number.isFinite(opts.hops) ? opts.hops : 2;

    const origins = startNodes(graph, site, voltageKv);
    const seen = new Set(origins);
    const bySite = new Map();
    const refusals = [];
    let frontier = origins.slice().sort();

    for (let depth = 1; depth <= limit; depth += 1) {
      const next = [];
      for (const nearNode of frontier) {
        for (const entry of graph.edgesAt(nearNode)) {
          const farNode = entry.row[entry.far];
          if (!farNode || !graph.has(farNode) || seen.has(farNode)) continue;
          const cross = crossing(graph, nearNode, farNode);
          const verdict = legality(entry.kind, cross);
          if (!verdict.legal) {
            refusals.push({ at_node: nearNode, to_node: farNode,
              kind: entry.kind, reason: verdict.refusal });
            continue;
          }
          seen.add(farNode);
          next.push(farNode);
          const code = graph.nodeSiteCode(farNode);
          if (!code || String(code).toUpperCase() === String(site.code).toUpperCase()) continue;
          if (bySite.has(code)) continue;
          const far = graph.siteByCode(code);
          bySite.set(code, {
            code,
            name: far ? far.name : null,
            hops: depth,
            first_node: farNode,
            voltage_kv: cross.far_kv,
            via: entry.kind
          });
        }
      }
      if (!next.length) break;
      frontier = next.sort();
    }

    const sites = [...bySite.values()].sort((a, b) =>
      a.hops - b.hops || String(a.code).localeCompare(String(b.code)));

    return {
      schema: SCHEMA,
      site: { code: site.code, name: site.name },
      requested_voltage_kv: voltageKv,
      hop_limit: limit,
      origin_nodes: origins.length,
      sites,
      counts: {
        sites: sites.length,
        by_hop: sites.reduce((acc, s) => {
          acc[s.hops] = (acc[s.hops] || 0) + 1;
          return acc;
        }, {})
      },
      refusals,
      not_a_distance: NOT_A_DISTANCE,
      not_a_capacity: NOT_A_CAPACITY
    };
  }

  NS.electricalDistance = Object.freeze({
    schema: SCHEMA,
    requires: REQUIRES,
    not_a_distance: NOT_A_DISTANCE,
    not_a_capacity: NOT_A_CAPACITY,
    impedance_basis: IMPEDANCE_CARRIED,
    undeclared: UNDECLARED,
    between,
    within
  });
})();
