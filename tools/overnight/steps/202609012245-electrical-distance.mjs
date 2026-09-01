/**
 * Step: the map learns to measure in circuits, not only in kilometres.
 *
 * Everything this Atlas has measured until now has been geometry. The
 * geodesy module answers "how many kilometres to that substation" and
 * answers it to the last place - but a kilometre is not a connection, and
 * a card that shows only the kilometre invites a reader to infer one.
 *
 * This step lands the other measurement, from the other source: on the
 * network NESO publishes in Appendix B, how many circuits lie between two
 * sites, and which ones. Every hop is a published row. A voltage changes
 * only across a named transformer, and a circuit whose two ends declare
 * different voltages is refused and reported rather than walked.
 *
 * Three artefacts:
 *   - 202609012245-network-topology.js, the incumbent's own bytes plus a
 *     graph() handle, proven to answer identically on all 921 sites;
 *   - 202609012245-electrical-distance.js, the traversal;
 *   - the card gains one sentence naming what is two hops away.
 *
 * The successor exists so there is ONE implementation of "which voltages
 * are real". A second copy of voltageOf inside the traversal would be a
 * second opinion, and this estate has already shipped one cartridge
 * carrying two geodesies that disagreed in the last place.
 */

const MODULES = 'atlas/modules';
const OLD_TOPOLOGY = `${MODULES}/202609012145-network-topology.js`;
const NEW_TOPOLOGY = `${MODULES}/202609012245-network-topology.js`;
const DISTANCE = `${MODULES}/202609012245-electrical-distance.js`;
const PROOF = 'tools/proofs/modules/202609012245-electrical-distance.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const REGISTRY = `${MODULES}/202609012217-source-registry.js`;
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'electrical-distance',
  version: 'v9.71',
  scope: 'the Atlas measures in the operator\'s own circuits as well as in kilometres: an electrical-distance module traverses the published node/branch model, a voltage changes only across a named transformer and a circuit that appears to change voltage is refused and recorded, planned changes are never walked as if they existed today, every hop carries its published rating and its R/X/B untouched, and the card names what lies two hops away',
  note: 'a hop is a published circuit, not a distance and not a capacity; the topology module hands out its graph so there is one implementation of which voltages are real, proven identical to the incumbent on all 921 published sites',

  brings: [NEW_TOPOLOGY, DISTANCE, PROOF],
  replaceModules: [`${OLD_TOPOLOGY}=${NEW_TOPOLOGY}`],
  addModules: [DISTANCE],
  proofs: [PROOF],

  apply({ read, write, patch, sandboxProof }) {
    /* ── 1. the body reaches the new module and publishes its state ─── */
    patch(BODY, [
      [`    try { return window.__GRIDATLAS_MODULES__?.networkTopology || null; }`,
       `    try { return window.__GRIDATLAS_MODULES__?.networkTopology || null; }`,
       'topology accessor present'],
    ]);

    let body = read(BODY);

    const ACCESSOR_ANCHOR = `  function topologyBlockHtml(queries) {`;
    if (body.split(ACCESSOR_ANCHOR).length - 1 !== 1) {
      throw new Error('topologyBlockHtml anchor is not unique');
    }
    body = body.replace(ACCESSOR_ANCHOR, `  /* The electrical-distance module, read the same way the topology
     module is read: absent is absent, never an excuse to guess. */
  function distanceModule() {
    try { return window.__GRIDATLAS_MODULES__?.electricalDistance || null; }
    catch (_) { return null; }
  }

${ACCESSOR_ANCHOR}`);

    /* ── 2. one sentence: what is two hops away ──────────────────────── */
    const NEIGHBOUR_ANCHOR = `      if (facts.neighbours.length) {`;
    if (body.split(NEIGHBOUR_ANCHOR).length - 1 !== 1) {
      throw new Error('neighbours anchor is not unique');
    }
    body = body.replace(NEIGHBOUR_ANCHOR, `      /* Electrical distance, beside the one-hop view.
         ---------------------------------------------------------------
         "Circuits reach" above is one hop. This is the second, and it is
         reported as a COUNT of sites at each hop rather than as a claim
         about any of them: naming a site two hops away and nothing else
         would read as a recommendation, which no published appendix
         supports. The hop count is never called a distance. */
      const reach = (() => {
        const mod = distanceModule();
        if (!mod) return null;
        try { return mod.within(topology.index, point.site_code, { hops: 2, voltageKv: kv }); }
        catch (_) { return null; }
      })();
      if (reach && reach.sites.length) {
        const atOne = reach.counts.by_hop[1] || 0;
        const atTwo = reach.counts.by_hop[2] || 0;
        out += caveat(\`<b>On the published network:</b> \${atOne} site\${atOne === 1 ? '' : 's'} \`
          + \`one circuit away\${atTwo ? \`, \${atTwo} more at two\` : ''}. \`
          + \`A hop is a published circuit, not a distance - a site one hop away may be a \`
          + \`hundred kilometres away.\${reach.refusals.length
            ? \` \${reach.refusals.length} branch\${reach.refusals.length === 1 ? ' was' : 'es were'} \`
              + \`not walked because a circuit cannot change voltage; only a transformer can.\`
            : ''}\`);
        electrical.answered += 1;
        electrical.refusals += reach.refusals.length;
      }
${NEIGHBOUR_ANCHOR}`);

    /* ── 3. the state the source registry and the proofs can see ─────── */
    const STATE_ANCHOR = `  window.__GRIDATLAS_TOPOLOGY__ = topology;`;
    if (body.split(STATE_ANCHOR).length - 1 !== 1) {
      throw new Error('topology state anchor is not unique');
    }
    body = body.replace(STATE_ANCHOR, `${STATE_ANCHOR}

  /* Published so a reviewer can ask the page how many cards the traversal
     actually answered, and how many published branches it refused to walk.
     A refusal is a finding about the data, not a failure of the page. */
  const electrical = { answered: 0, refusals: 0 };
  window.__GRIDATLAS_ELECTRICAL__ = electrical;`);

    write(BODY, body);

    /* ── 4. the registry needs no change, and that is worth stating ───
       It probes `__GRIDATLAS_MODULES__.networkTopology` by GLOBAL name,
       not by file name, so the successor registers under exactly the same
       key and the registry keeps working without being restamped. What
       the registry does NOT yet know about is the traversal itself: it
       has no `electrical-distance` source, so a page where the module
       failed to load would report every source healthy. That is a real
       gap, it is recorded here rather than quietly left, and closing it
       means a successor registry - which is its own generation, not a
       silent edit to one that has shipped. */

    /* ── 5. the CI carries the new proof ─────────────────────────────── */
    patch(CI, [
      [`  ['data-contract parity', ['tools/proofs/202609012214-data-contract-parity.proof.mjs']]
];`,
       `  ['data-contract parity', ['tools/proofs/202609012214-data-contract-parity.proof.mjs']],
  ['electrical distance', ['tools/proofs/modules/202609012245-electrical-distance.proof.mjs']]
];`, 'CI gate list'],
    ]);

    /* ── 6. the sandbox proof holds the wiring ───────────────────────── */
    const proof = read(sandboxProof);
    const TAIL = `console.log(\`\\n\${passed}/\${passed + failures.length} checks passed\`);`;
    if (proof.split(TAIL).length - 1 !== 1) {
      throw new Error('sandbox proof tail anchor is not unique');
    }
    write(sandboxProof, proof.replace(TAIL, `console.log('\\nthe map measures in circuits as well as in kilometres\\n');

/* The module can be perfect and composed into nothing - that is exactly
   what happened to network-topology at 202609012145, proven 46/46 and
   present in no served cartridge for two generations. These checks are
   about the BYTES that ship. */
check('the electrical-distance module is in the served cartridge',
  /gridatlas\\.module\\.electrical-distance\\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.electrical-distance.v1')
    < cartridgeSource.indexOf('function distanceModule('));
check('the successor topology module ships, not the incumbent',
  /gridatlas\\.module\\.network-topology\\.graph\\.v1/.test(cartridgeSource));
check('the card asks for two hops, scoped to the connection voltage',
  /mod\\.within\\(topology\\.index, point\\.site_code, \\{ hops: 2, voltageKv: kv \\}\\)/.test(cartridgeSource));
check('a missing module is an absence, never a guess',
  /if \\(!mod\\) return null;/.test(cartridgeSource));
check('the page says plainly that a hop is not a distance',
  /A hop is a published circuit, not a distance/.test(cartridgeSource));
check('refusals are surfaced to the reader, not swallowed',
  /not walked because a circuit cannot change voltage/.test(cartridgeSource));
check('the traversal state is published for review',
  /window\\.__GRIDATLAS_ELECTRICAL__ = electrical;/.test(cartridgeSource));
check('no kilometre figure is taken from the topology answer',
  !/reach[\\s\\S]{0,200}_km/.test(cartridgeSource));

${TAIL}`));
  }
};
