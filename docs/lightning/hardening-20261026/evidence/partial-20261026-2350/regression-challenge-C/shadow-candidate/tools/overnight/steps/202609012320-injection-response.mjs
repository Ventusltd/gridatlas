/**
 * Step: the Atlas answers where a project's power would actually go.
 *
 * This is the powerflow, and it is the first computation in this estate
 * that solves anything rather than reporting a published figure.
 *
 * The standing rule has been that R, X and B are carried and never
 * computed with, because the ETYS node/branch dataset is not a solved
 * power-flow model merely because it contains them. That rule stands. What
 * it forbids is calling published parameters a solution; what it always
 * pointed at is a model that DECLARES itself - its equations, base, slack,
 * assumptions and validation - and is honest about what it cannot produce.
 *
 * A full AC load flow needs generation and load at every node, tap
 * positions, voltage set points and contingencies. None are published, so
 * none are invented and no load flow is claimed. An INJECTION RESPONSE
 * needs none of them: it is the linear sensitivity of branch flows to a
 * transfer between two declared points, and it depends only on topology
 * and series reactance, both of which are published.
 *
 * It is validated against networks whose answers are exact by hand -
 * parallel paths dividing inversely as their reactances, a symmetric ring
 * dividing two-thirds and one-third, reciprocity under reversal - to 1e-9,
 * and then power conservation is checked at all 339 intermediate buses of
 * the real 400 kV network. There is no commercial solver in this estate
 * and pretending one had been used would be worse than having none.
 *
 * The card uses the capacity Pipeline News already sends in the deep link,
 * so the journey from a project to "which circuits would carry my output"
 * is one click. What it never says is whether there is room: existing
 * flows are published nowhere, so the total - which is what decides
 * whether a circuit is full - cannot be computed by anyone here.
 */

const MODULE = 'atlas/modules/202609012320-injection-response.js';
const PROOF = 'tools/proofs/modules/202609012320-injection-response.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'injection-response',
  version: 'v9.73',
  scope: 'the Atlas solves a declared DC injection response on the published node/branch model and reports which circuits would carry a project\'s stated capacity and what fraction each takes, with the equations, the 100 MVA base, the named slack and every assumption carried in the answer; validated to 1e-9 against networks whose solutions are exact by hand and checked for power conservation at every intermediate bus of the real 400 kV network; it never states a loading, because existing flows are published nowhere',
  note: 'the first computation here that solves rather than reports; resistance and susceptance are untouched because the declared DC model says they are, a zero-reactance branch is shorted as the busbar it physically is rather than given an invented reactance, and a branch with no published reactance is skipped and counted',

  brings: [MODULE, PROOF],
  addModules: [MODULE],
  proofs: [PROOF],

  apply({ read, write, patch, sandboxProof }) {
    let body = read(BODY);

    const ANCHOR = `  function ratingModule() {`;
    if (body.split(ANCHOR).length - 1 !== 1) throw new Error('ratingModule anchor is not unique');
    body = body.replace(ANCHOR, `  function flowModule() {
    try { return window.__GRIDATLAS_MODULES__?.injectionResponse || null; }
    catch (_) { return null; }
  }

  /* The 400 kV model is built once per session and kept: assembling it
     walks every published node, and a card that rebuilt it per click
     would be doing that work again for an answer it already had.

     The node list comes from topology.nodes400, which ensureTopology
     records while it already has the parsed product in hand. Rebuilding
     it here would mean either keeping a second copy of the 10 MB payload
     alive or asking the graph for something it does not expose. */
  let flowModel = null;
  function flowModelFor(index) {
    if (flowModel) return flowModel;
    const mod = flowModule();
    if (!mod || !index || typeof index.graph !== 'function') return null;
    const names = topology.nodes400;
    if (!Array.isArray(names) || !names.length) return null;
    try {
      flowModel = mod.assemble(index.graph(), names,
        { voltageKv: 400, includeTransformers: false });
      return flowModel;
    } catch (_) { return null; }
  }

${ANCHOR}`);

    /* the injection sentence, after the ratings and the reach */
    const REACH = `      /* Electrical distance, beside the one-hop view.`;
    if (body.split(REACH).length - 1 !== 1) throw new Error('electrical anchor is not unique');
    body = body.replace(REACH, `      /* Where the project's own power would go.
         ---------------------------------------------------------------
         Pipeline News sends capacity_mw on every deep link, so the
         question "where would MY output flow" is answerable the moment a
         project is selected. The slack is NAMED in the sentence: a
         transfer has two ends and quoting one of them is meaningless.
         What is deliberately absent is any statement about room. */
      const injection = (() => {
        const mod = flowModule();
        if (!mod || kv !== 400) return null;
        /* The project's own stated capacity where the deep link carried
           one, and a declared 100 MW probe otherwise - labelled as such in
           the sentence, never presented as the project's figure. */
        const mw = Number.isFinite(currentCapacityMw) && currentCapacityMw > 0
          ? currentCapacityMw : 100;
        const model = flowModelFor(topology.index);
        if (!model) return null;
        try {
          const graph = topology.index.graph();
          const here = graph.nodesOfSite(point.site_code)
            .filter(n => graph.nodeVoltageKv(n) === 400).sort()[0];
          if (!here) return null;
          const slackNode = model.buses.find(b => b !== model.busOf(here));
          if (!slackNode) return null;
          const r = mod.respond(model, { atNode: here, slackNode, mw, minimumShare: 0.05 });
          return r && r.validation && r.validation.passes ? r : null;
        } catch (_) { return null; }
      })();
      if (injection && injection.branches.length) {
        const top = injection.branches.slice(0, 3);
        out += caveat(\`<b>Where \${injection.injected_mw} MW would flow</b> \`
          + \`(declared DC model, 100 MVA base, transfer to \${escapeHtml(injection.slack_node)}): \`
          + top.map(b => \`\${escapeHtml(b.from_node)}-\${escapeHtml(b.to_node)} \`
            + \`\${Math.round(Math.abs(b.share_of_injection) * 100)}%\`
            + (b.published_ratings_mva && b.published_ratings_mva.summer
              ? \` (summer rating \${b.published_ratings_mva.summer} MVA)\` : '')).join(', ')
          + \`. Flat 1.0 pu voltages, small angles, no losses, no taps, intact network. \`
          + \`This is the response to a NEW injection, not a loading: what is already \`
          + \`flowing on these circuits is published nowhere, so whether there is room \`
          + \`for it cannot be computed here by anyone.\`);
        powerflow.answered += 1;
        powerflow.worst_kirchhoff_error = Math.max(powerflow.worst_kirchhoff_error,
          injection.validation.kirchhoff_error);
      }

${REACH}`);

    const STATE = `  window.__GRIDATLAS_RATINGS__ = rating;`;
    if (body.split(STATE).length - 1 !== 1) throw new Error('ratings state anchor is not unique');
    body = body.replace(STATE, `${STATE}

  /* Published so a reviewer can ask the page whether any answer it gave
     failed its own conservation check. A solve that has not converged
     produces plausible-looking flows that are wrong, so the error is
     surfaced rather than trusted. */
  const powerflow = { answered: 0, worst_kirchhoff_error: 0 };
  window.__GRIDATLAS_POWERFLOW__ = powerflow;`);

    /* The in-memory edits land first. Everything below reads BODY from
       disk, so a patch() called before this write would be silently
       discarded by it - which is exactly what happened on the first run
       of this step, and the sandbox proof caught it. */
    write(BODY, body);

    /* ── the 400 kV node list, recorded where the product is parsed ──
       ensureTopology already holds the whole 10 MB payload for one tick.
       Taking the node list there costs one pass and keeps no second copy
       of the payload alive; asking for it later would mean either
       re-fetching or exposing something the graph does not offer. */
    patch(BODY, [
      [`        topology.index = index;`,
       `        topology.index = index;
        /* the buses the declared DC model is built over. 400 kV only:
           a DC model that walks a transformer without its tap position
           is modelling something the product does not describe, and the
           taps are not published. */
        topology.nodes400 = (product.nodes || [])
          .filter(n => n && n.voltage_consistent_with_site === true && n.voltage_kv === 400)
          .map(n => n.node);`,
       'ensureTopology records the 400 kV nodes'],
    ]);

    /* ── the capacity the deep link carried, at module scope ─────────── */
    patch(BODY, [
      [`  let currentNearest400 = null;`,
       `  let currentNearest400 = null;
  /* The capacity Pipeline News sent, kept where the network card can
     reach it. Without this the powerflow answer would have to invent a
     figure, and an invented megawatt is exactly the kind of number that
     gets quoted back as the project's own. */
  let currentCapacityMw = null;`,
       'module-scope capacity slot'],
      [`        let stated = Number(q.get('capacity_mw'));`,
       `        let stated = Number(q.get('capacity_mw'));
        currentCapacityMw = Number.isFinite(stated) && stated > 0 ? stated : null;`,
       'capacity captured on arrival'],
      [`            if (Number.isFinite(cap) && cap > 0) stated = cap;`,
       `            if (Number.isFinite(cap) && cap > 0) stated = cap;
            currentCapacityMw = Number.isFinite(stated) && stated > 0 ? stated : null;`,
       'capacity updated when the search lane resolves it'],
    ]);

    patch(CI, [
      [`  ['rating envelope', ['tools/proofs/modules/202609012250-rating-envelope.proof.mjs']]
];`,
       `  ['rating envelope', ['tools/proofs/modules/202609012250-rating-envelope.proof.mjs']],
  ['injection response (powerflow)', ['tools/proofs/modules/202609012320-injection-response.proof.mjs']]
];`, 'CI gate list'],
    ]);

    const proof = read(sandboxProof);
    const TAIL = `console.log(\`\\n\${passed}/\${passed + failures.length} checks passed\`);`;
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, `console.log('\\na declared powerflow, and what it refuses to say\\n');

check('the injection-response module is in the served cartridge',
  /gridatlas\\.module\\.injection-response\\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.injection-response.v1')
    < cartridgeSource.indexOf('function flowModule('));
check('the served bytes never read resistance or susceptance into the flow model', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.injection-response.v1');
  const end = cartridgeSource.indexOf('NS.injectionResponse = Object.freeze');
  if (start < 0 || end < 0) return false;
  const mod = cartridgeSource.slice(start, end);
  return !/r_pct_100mva/.test(mod) && !/b_pct_100mva/.test(mod) && /x_pct_100mva/.test(mod);
})());
check('the card names the slack, because a transfer has two ends',
  /transfer to \\\$\\{escapeHtml\\(injection\\.slack_node\\)\\}/.test(cartridgeSource));
check('the card states the model assumptions where the reader sees them',
  /Flat 1\\.0 pu voltages, small angles, no losses, no taps, intact network/.test(cartridgeSource));
check('the card says plainly it is not a loading',
  /not a loading/.test(cartridgeSource)
  && /whether there is room/.test(cartridgeSource));
check('an answer that fails its own Kirchhoff check is discarded, not printed',
  /r\\.validation && r\\.validation\\.passes \\? r : null/.test(cartridgeSource));
check('the powerflow uses the capacity the deep link carries',
  /currentCapacityMw/.test(cartridgeSource)
  && /currentCapacityMw = Number\\.isFinite\\(stated\\)/.test(cartridgeSource));
check('the 400 kV node list is recorded once, where the product is already parsed',
  /topology\\.nodes400 = \\(product\\.nodes/.test(cartridgeSource));
check('the powerflow is scoped to 400 kV, never walked through an unmodelled tap',
  /kv !== 400\\) return null;/.test(cartridgeSource));
check('the conservation error is published for review',
  /window\\.__GRIDATLAS_POWERFLOW__ = powerflow;/.test(cartridgeSource));
check('the served bytes claim no headroom anywhere in the flow module', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.injection-response.v1');
  const end = cartridgeSource.indexOf('NS.injectionResponse = Object.freeze');
  const mod = cartridgeSource.slice(start, end)
    .split(/const NOT_A_[A-Z_]+ =[\\s\\S]*?';/).join(' ');
  return !/headroom/i.test(mod);
})());

${TAIL}`));
  }
};
