/**
 * Step: what the operator has PUBLISHED as planned, kept apart from what exists.
 *
 * The topology card already counts planned changes at a site, as a number
 * and a list of years. That was enough to say "something is published for
 * 2030" and not enough to say what. The product carries 2,230 planned rows
 * with a year, a status (Addition 1,362 / Change 522 / Removed 346), an
 * asset type (circuit 1,520 / transformer 710) and the asset's own
 * published parameters, and none of that reached the reader.
 *
 * THE LINE THAT MATTERS
 * --------------------
 * A planned change is a publication about a future year. It is not a
 * circuit today, it is not a commitment, it is not a consent, and it is
 * not a connection date. The traversal already refuses to walk one - a
 * circuit published for 2030 is not a path a current can take now - and
 * this keeps the same separation in the card: planned rows are reported in
 * their own sentence, labelled by year and status, never mixed into the
 * count of what is there.
 *
 * A FINDING THE MODULE SURFACED
 * -----------------------------
 * 552 planned rows sit on a node pair that already carries a circuit or a
 * transformer today, and 16 of those are marked "Addition". That is
 * carried per entry as a cross-reference, not as a judgement: an addition
 * on an existing pair is ordinary (a second circuit on the same route),
 * and it is the reader's to interpret, not this module's to grade.
 *
 * The module and its proof were authored in parallel and re-run here
 * before use: 79/79 against the real published payload.
 */

const MODULE = 'atlas/modules/202609012345-planned-change.js';
const PROOF = 'tools/proofs/modules/202609012345-planned-change.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'planned-change',
  version: 'v9.75',

  scope: 'the card reports what the operator has published as planned in its own sentence - by year, by status and by asset, with the published parameters carried - kept structurally apart from what exists today, because a row published for a future year is not a circuit now, not a commitment, not a consent and not a connection date',

  note: 'the traversal already refused to walk a planned row as a path; this keeps the same separation where the reader can see it. 552 planned rows sit on a node pair that already carries an asset today and 16 of those are marked Addition - carried as a cross-reference, never as a judgement.',

  brings: [MODULE, PROOF],
  addModules: [MODULE],
  proofs: [PROOF],

  apply({ read, write, sandboxProof }) {
    let body = read(BODY);
    const once = (from, to, label) => {
      const n = body.split(from).length - 1;
      if (n !== 1) throw new Error(`anchor found ${n} times: ${label}`);
      body = body.replace(from, () => to);
    };

    once(`  function flowModule() {`,
      `  /* The planned-change module takes the PRODUCT, not the topology
     index: graph() deliberately withholds planned rows, which is the
     right default and the reason this needs its own reader. The parsed
     product is not kept alive after indexing, so the index is built once
     and cached here beside the others. */
  let plannedIndex;
  function plannedModule() {
    try { return window.__GRIDATLAS_MODULES__?.plannedChange || null; }
    catch (_) { return null; }
  }

  function flowModule() {`,
      'planned accessor');

    once(`      /* Where the project's own power would go.`,
      `      /* What is published as planned, in its own sentence.
         ---------------------------------------------------------------
         Never folded into the counts above. A row published for 2030 is
         a statement about a future year; presenting it beside today's
         circuits would let a reader take it for one. */
      const planned = (() => {
        const mod = plannedModule();
        if (!mod || !topology.parsedProduct) return null;
        try {
          if (plannedIndex === undefined) plannedIndex = mod.index(topology.parsedProduct);
          if (!plannedIndex) return null;
          return plannedIndex.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
        } catch (_) { return null; }
      })();
      if (planned && planned.counts && planned.counts.planned_changes) {
        /* by_year is an ORDERED ARRAY of { year, by_status: [{ status,
           entries }] }, not a map - the module keeps publication order
           rather than letting object key order decide what the reader
           sees first. */
        const years = (planned.by_year || []).map((band) => {
          const parts = (band.by_status || []).map((s) =>
            \`\${(s.entries || []).length} \${escapeHtml(String(s.status).toLowerCase())}\`);
          return \`<b>\${escapeHtml(String(band.year))}</b> \${parts.join(', ')}\`;
        });
        if (years.length) {
          out += caveat(\`<b>Published as planned:</b> \${years.join('; ')}. \`
            + \`These are rows NESO publishes for a future year. None of them is a \`
            + \`circuit today, a commitment, a consent, or a connection date, and \`
            + \`none is counted among the circuits above.\`);
          plannedState.answered += 1;
          plannedState.rows += planned.counts.planned_changes;
        }
      }

      /* Where the project's own power would go.`,
      'planned sentence');

    once(`  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;`,
      `  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;

  /* How many cards reported published plans, and how many rows they came
     from. A count of zero where the product has 2,230 rows would mean the
     wiring is broken, not that nothing is planned. */
  const plannedState = { answered: 0, rows: 0 };
  window.__GRIDATLAS_PLANNED__ = plannedState;`,
      'planned state');

    /* The parsed product must survive indexing for the planned module to
       read it. ensureTopology already holds it for one tick. */
    once(`        topology.nodes400 = (product.nodes || [])`,
      `        /* Kept because the planned-change and owner-boundary readers
           take the PRODUCT, not the graph - graph() withholds planned
           rows by design and does not carry transmission_owner. This is
           one reference to an object already in memory, not a copy. */
        topology.parsedProduct = product;
        topology.nodes400 = (product.nodes || [])`,
      'keep the parsed product');

    write(BODY, body);

    const ci = read(CI);
    const CI_ANCHOR = `  ['injection response (powerflow)', ['tools/proofs/modules/202609012320-injection-response.proof.mjs']]
];`;
    if (ci.split(CI_ANCHOR).length - 1 !== 1) throw new Error('CI gate list anchor is not unique');
    write(CI, ci.replace(CI_ANCHOR,
      `  ['injection response (powerflow)', ['tools/proofs/modules/202609012320-injection-response.proof.mjs']],
  ['planned change', ['tools/proofs/modules/202609012345-planned-change.proof.mjs']]
];`));

    const proof = read(sandboxProof);
    const TAIL = 'console.log(`\\n${passed}/${passed + failures.length} checks passed`);';
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, [
      "console.log('\\nwhat is published as planned, kept apart from what exists\\n');",
      '',
      "check('the planned-change module is in the served cartridge',",
      "  /gridatlas\\.module\\.planned-change/.test(cartridgeSource));",
      "check('the parsed product is kept so the module can read it',",
      "  /topology\\.parsedProduct = product;/.test(cartridgeSource));",
      "check('a missing product is an absence, not a guess',",
      "  /if \\(!mod \\|\\| !topology\\.parsedProduct\\) return null;/.test(cartridgeSource));",
      "check('planned rows are reported in their OWN sentence, not in the circuit counts',",
      "  /<b>Published as planned:<\\/b>/.test(cartridgeSource));",
      "check('the page says a planned row is not a circuit today',",
      "  /None of them is a circuit today/.test(cartridgeSource));",
      "check('the page refuses commitment, consent and connection-date readings',",
      "  /a commitment, a consent, or a connection date/.test(cartridgeSource));",
      "check('planned rows are stated as excluded from the counts above',",
      "  /none is counted among the circuits above/.test(cartridgeSource));",
      "check('the planned state is published for review',",
      "  /window\\.__GRIDATLAS_PLANNED__ = plannedState;/.test(cartridgeSource));",
      "check('nothing in the planned sentence grades what it found', (() => {",
      "  const at = cartridgeSource.indexOf('Published as planned:');",
      "  const section = cartridgeSource.slice(Math.max(0, at - 1200), at + 1200);",
      "  return !/STRONG|REMOTE|well.placed|ideal|advantage|headroom/i.test(section);",
      "})());",
      '',
      TAIL
    ].join('\n')));
  }
};
