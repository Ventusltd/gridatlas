/**
 * Step: who owns what lands here, and where two owners meet.
 *
 * Every site, node, circuit and transformer in the published product
 * carries `transmission_owner` - NGET, SHET, SPT or OFTO - and the card
 * has never said any of it. For most sites that is a single name and a
 * small fact. For some it is the most consequential fact on the card,
 * because a circuit whose two ends are published under DIFFERENT owners
 * is a seam, and a connection across a seam involves more than one party.
 *
 * Measured on the payload: 62 circuits and 10 transformers have ends
 * under different owners. The pairs are SHET/SPT 16, NGET/SPT 10,
 * NGET/OFTO 30, OFTO/SHET 4, OFTO/SPT 2 - and no NGET/SHET seam at all,
 * because those two share no border. That last one is a good sign the
 * data means what it appears to: the absence is the geographically
 * correct absence.
 *
 * WHAT IT MUST NOT BECOME
 * -----------------------
 * Ownership is a published fact about an asset. It is NOT a statement
 * about who a project would contract with, which depends on connection
 * agreements, the transmission/distribution split and commercial
 * arrangements that no appendix contains. The module carries that refusal
 * and the card prints it.
 *
 * Two more things the module refuses to smooth over, and the card keeps:
 *   - 49 nodes publish a null owner. They are reported as unknown, never
 *     back-filled from the site, and the count is shown.
 *   - 7 circuits carry an owner matching neither of their ends. That is
 *     reported as its own category rather than being called a boundary,
 *     because it is a different thing and probably a data question.
 *
 * Authored in parallel with its proof and re-run before use: 72/72.
 */

const MODULE = 'atlas/modules/202609012350-owner-boundary.js';
const PROOF = 'tools/proofs/modules/202609012350-owner-boundary.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'owner-boundary',
  version: 'v9.76',

  scope: 'the card names which transmission owners the assets landing at a site belong to, and where two owners meet on one circuit it says so and names both - 62 circuits and 10 transformers in the published network have ends under different owners - while stating plainly that ownership is not a statement about who a project would contract with, reporting a null owner as unknown rather than back-filling it from the site, and keeping an asset whose owner matches neither end as its own category rather than calling it a boundary',

  note: 'the absence of any NGET/SHET seam is the geographically correct absence: those two share no border. 49 nodes publish a null owner, all on placeholder site codes the product does not list as sites, and none of them is an end of any existing circuit or transformer.',

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

    once(`  let plannedIndex;`,
      `  let ownerIndex;
  function ownerModule() {
    try { return window.__GRIDATLAS_MODULES__?.ownerBoundary || null; }
    catch (_) { return null; }
  }

  let plannedIndex;`,
      'owner accessor');

    once(`      /* What is published as planned, in its own sentence.`,
      `      /* Who owns what lands here, and whether two owners meet.
         ---------------------------------------------------------------
         Printed before the planned sentence because it is a fact about
         what is there now. The seam is the part worth reading: a single
         owner is a small fact, two owners on one circuit is not. */
      const ownership = (() => {
        const mod = ownerModule();
        if (!mod || !topology.parsedProduct) return null;
        try {
          if (ownerIndex === undefined) ownerIndex = mod.index(topology.parsedProduct);
          if (!ownerIndex) return null;
          return ownerIndex.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
        } catch (_) { return null; }
      })();
      if (ownership && Array.isArray(ownership.owners_present) && ownership.owners_present.length) {
        const owners = ownership.owners_present.map((o) => escapeHtml(String(o)));
        const seams = (ownership.boundary_circuits || []).length
          + (ownership.boundary_transformers || []).length;
        const unknown = ownership.counts && ownership.counts.nodes_with_unknown_owner;
        const odd = ownership.counts && ownership.counts.asset_owner_differs_from_both_ends;
        out += caveat(\`<b>Transmission owner\${owners.length === 1 ? '' : 's'}:</b> \`
          + \`\${owners.join(', ')}.\`
          + (seams
            ? \` \${seams} branch\${seams === 1 ? '' : 'es'} here \${seams === 1 ? 'is' : 'are'} \`
              + \`a boundary: the two ends are published under different owners.\`
            : '')
          + (unknown
            ? \` \${unknown} node here publishes no owner and is reported as unknown, \`
              + \`never taken from the site.\`
            : '')
          + (odd
            ? \` \${odd} asset carries an owner matching neither of its ends; that is \`
              + \`reported as itself, not as a boundary.\`
            : '')
          + \` Ownership is a published fact about an asset. It is not a statement \`
          + \`about who a project would contract with, which depends on connection \`
          + \`agreements and commercial terms no appendix contains.\`);
        ownerState.answered += 1;
        ownerState.seams += seams;
      }

      /* What is published as planned, in its own sentence.`,
      'ownership sentence');

    once(`  window.__GRIDATLAS_PLANNED__ = plannedState;`,
      `  window.__GRIDATLAS_PLANNED__ = plannedState;

  /* How many cards named an owner, and how many seams they found. */
  const ownerState = { answered: 0, seams: 0 };
  window.__GRIDATLAS_OWNERSHIP__ = ownerState;`,
      'owner state');

    write(BODY, body);

    const ci = read(CI);
    const CI_ANCHOR = `  ['planned change', ['tools/proofs/modules/202609012345-planned-change.proof.mjs']]
];`;
    if (ci.split(CI_ANCHOR).length - 1 !== 1) throw new Error('CI gate list anchor is not unique');
    write(CI, ci.replace(CI_ANCHOR,
      `  ['planned change', ['tools/proofs/modules/202609012345-planned-change.proof.mjs']],
  ['owner boundary', ['tools/proofs/modules/202609012350-owner-boundary.proof.mjs']]
];`));

    const proof = read(sandboxProof);
    const TAIL = 'console.log(`\\n${passed}/${passed + failures.length} checks passed`);';
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, [
      "console.log('\\nwho owns what lands here, and where two owners meet\\n');",
      '',
      "check('the owner-boundary module is in the served cartridge',",
      "  /gridatlas\\.module\\.owner-boundary/.test(cartridgeSource));",
      "check('the card names the owners present',",
      "  /<b>Transmission owner/.test(cartridgeSource)",
      "  && /ownership\\.owners_present/.test(cartridgeSource));",
      "check('a seam is named as a seam, with both ends said to differ',",
      "  /the two ends are published under different owners/.test(cartridgeSource));",
      "check('a null owner is reported as unknown and never taken from the site',",
      "  /publishes no owner and is reported as unknown/.test(cartridgeSource)",
      "  && /never taken from the site/.test(cartridgeSource));",
      "check('an asset whose owner matches neither end is kept out of the boundary count',",
      "  /reported as itself, not as a boundary/.test(cartridgeSource));",
      "check('the page refuses the counterparty reading',",
      "  /not a statement /.test(cartridgeSource)",
      "  && /who a project would contract with/.test(cartridgeSource));",
      "check('a missing product is an absence, not a guess',",
      "  /if \\(!mod \\|\\| !topology\\.parsedProduct\\) return null;/.test(cartridgeSource)",
      "  && (cartridgeSource.match(/if \\(!mod \\|\\| !topology\\.parsedProduct\\) return null;/g) || []).length === 2);",
      "check('the ownership state is published for review',",
      "  /window\\.__GRIDATLAS_OWNERSHIP__ = ownerState;/.test(cartridgeSource));",
      "check('the ownership sentence grades nothing', (() => {",
      "  const at = cartridgeSource.indexOf('<b>Transmission owner');",
      "  const section = cartridgeSource.slice(Math.max(0, at - 800), at + 1600);",
      "  return !/STRONG|REMOTE|well.placed|ideal|advantage|headroom|preferred/i.test(section);",
      "})());",
      '',
      TAIL
    ].join('\n')));
  }
};
