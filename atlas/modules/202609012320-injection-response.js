/**
 * Module: injection-response
 *
 * A DECLARED DC power-flow model of the published GB transmission network,
 * used to answer one question: if power is injected here, which circuits
 * carry it, and what fraction of it does each one carry?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A POWER FLOW AND NOT A PRETENDED ONE
 * ─────────────────────────────────────────────────────────────────────
 *
 * The standing rule in this estate has been that R, X and B are carried
 * and never computed with, because "the ETYS node/branch dataset is not a
 * solved power-flow model merely because it contains R/X/B". That rule is
 * right, and it is not repealed here. What it forbids is calling published
 * parameters a solution. What it permits - what it was always pointing at -
 * is a model that DECLARES itself: states its equations, its base, its
 * slack, its assumptions and its validation, and is honest about which
 * quantities it cannot produce.
 *
 * A full AC load flow of GB needs generation and load at every node,
 * transformer tap positions, voltage set points, contingency definitions
 * and validation against a trusted solver. None of those are published in
 * Appendix B, and this module does not invent them, so it does not
 * pretend to a load flow.
 *
 * An INJECTION RESPONSE needs none of them. It is the linear sensitivity
 * of branch flows to a transfer between two points - the power-transfer
 * distribution factor - and it depends only on the network's topology and
 * its series reactances, both of which ARE published. It is the quantity a
 * connection engineer wants first: not "what is flowing today", which
 * nobody publishes, but "where would my power go".
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE DECLARED MODEL
 * ─────────────────────────────────────────────────────────────────────
 *
 *   Equations   DC approximation:  P = B' · θ,  and for each branch
 *               f_ij = (θ_i − θ_j) / x_ij
 *   Base        100 MVA, the base the product publishes R/X/B on.
 *   Reactance   x = x_pct_100mva / 100, per unit. Resistance is NOT used:
 *               the DC approximation neglects it, and saying so is part of
 *               the declaration.
 *   Voltages    Assumed flat at 1.0 per unit. Not published, not solved.
 *   Angles      Assumed small, so sin θ ≈ θ. Valid for a transmission
 *               network under normal conditions; it is an approximation
 *               and it is named as one.
 *   Losses      Zero, by construction of the DC approximation. Real losses
 *               are of order 1-2% and are not represented.
 *   Slack       DECLARED explicitly, never inferred silently. Every answer
 *               names the node the power is withdrawn at, because a
 *               transfer has two ends and quoting only one is meaningless.
 *   Taps        Not published, therefore not modelled. Transformers are
 *               represented by their series reactance alone.
 *   Shunts      b_pct_100mva is carried by the product and is NOT used:
 *               line charging does not appear in a DC model.
 *   Contingency None. This is the intact network.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THE ANSWER IS NOT
 * ─────────────────────────────────────────────────────────────────────
 *
 * It is not a loading, and it is not headroom. It says what fraction of a
 * NEW injection would appear on each circuit. What is already flowing on
 * that circuit is not published anywhere in this product, so the sum of
 * the two - which is what determines whether the circuit is full - cannot
 * be computed here by anyone, including this module. A circuit carrying
 * 38% of a 500 MW injection is carrying 190 MW of it; whether that
 * circuit can accept 190 MW more depends on facts no appendix contains.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ZERO-REACTANCE BRANCHES
 * ─────────────────────────────────────────────────────────────────────
 *
 * The product publishes circuits with x_pct_100mva of exactly 0 - zero
 * length spans, busbar couplers, some series devices. 1/x is undefined for
 * these, and substituting a small number would silently invent a
 * reactance. They are instead treated as what they physically are: a
 * short, meaning the two nodes are electrically the same bus. The nodes
 * are merged before the matrix is built, the merge is counted, and the
 * count is reported in the answer.
 *
 *   node tools/proofs/modules/202609012320-injection-response.proof.mjs
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.injectionResponse) return;

  const SCHEMA = 'gridatlas.module.injection-response.v1';
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

  /* ── union-find, for shorting zero-reactance branches ──────────────── */
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

  /* The matrix assembly, taking an explicit node list so the caller
     decides the scope - one site, one voltage, or the whole product -
     without a second copy of this code existing for each case. */
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
        const id = [name, far].sort().join('|') + '|' + entry.kind
          + '|' + (entry.row.x_pct_100mva ?? 'n');
        if (seen.has(id)) continue;
        seen.add(id);

        const xPct = entry.row.x_pct_100mva;
        if (!Number.isFinite(xPct)) { skippedNoReactance += 1; continue; }
        if (xPct === 0) {
          /* physically a short: the two nodes are the same bus */
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

    /* After shorting, work in terms of bus representatives. */
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

    return {
      schema: SCHEMA,
      declared_model: DECLARED_MODEL,
      voltage_kv: voltageKv,
      includes_transformers: includeTransformers,
      buses, busIndex, busOf, edges,
      counts: {
        nodes: nodeNames.length,
        buses: buses.length,
        branches: edges.length,
        shorted_zero_reactance: shorted,
        skipped_no_published_reactance: skippedNoReactance
      }
    };
  }

  /* ── sparse conjugate gradient on the reduced B' matrix ────────────── */
  function multiply(model, x, slackIndex) {
    const y = new Float64Array(x.length);
    for (const e of model.edges) {
      if (e.i === slackIndex || e.j === slackIndex) {
        /* the slack angle is pinned at zero, so its column contributes
           nothing and its row is not solved */
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

  /**
   * Inject `mw` at one node and withdraw it at the declared slack; report
   * the flow this puts on every branch that carries a meaningful share.
   *
   * @param model     from modelFor()
   * @param options   { atNode, slackNode, mw, minimumShare }
   */
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

    const n = model.buses.length;
    const p = new Float64Array(n);
    p[i] = mw / BASE_MVA;      /* per unit on the declared base */
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

    /* Validation carried in the answer, not asserted in a comment.
       Kirchhoff at the injection bus: the shares leaving it must sum to
       one, or the solve did not converge and the answer is not usable. */
    let leavingInjection = 0;
    for (const e of model.edges) {
      const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
      if (e.i === i) leavingInjection += flowPu;
      if (e.j === i) leavingInjection -= flowPu;
    }
    const kirchhoff = leavingInjection * BASE_MVA / (mw || 1);

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
      validation: {
        kirchhoff_at_injection: kirchhoff,
        kirchhoff_error: Math.abs(kirchhoff - 1),
        passes: Math.abs(kirchhoff - 1) < 1e-6,
        /* Exact by Kirchhoff's current law under the DC model: everything
           injected at a bus must leave it along the branches. It is
           checked at runtime and carried in the answer rather than
           asserted in a comment, because a solve that has not converged
           produces a plausible-looking set of flows that are wrong. */
        what_it_checks: 'the shares leaving the injection bus must sum to 1.0'
      },
      not_a_loading: NOT_A_LOADING,
      not_a_connection_offer: NOT_A_CONNECTION_OFFER
    };
  }

  /**
   * Convenience: build a model over every node at one voltage.
   */
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
    modelFor,
    assemble,
    respond
  });
})();
