/**
 * Step: Codex's powerflow stop-ship, closed.
 *
 * I asked for an adversarial review of the powerflow in the handshake at
 * 202609012325 and got one at 202609020030. Both findings are real, both
 * are P0, and both are the same shape: the proof tested a case the
 * production caller never takes.
 *
 * FINDING 1 - THE CALLER CHOSE A DISCONNECTED SLACK
 * -------------------------------------------------
 * The card asked for the first bus that was not the injection bus. The
 * 400 kV induced graph is not connected - 573 buses, 238 components - so
 * that bus is normally in a different component, and a transfer between
 * two components does not exist. West Burton was paired with ABHA41,
 * which is disconnected from 572 of 573 buses; the solve ran 2,292
 * iterations to a residual of about 1.7e13.
 *
 * The proof did not catch it because the proof picked a CONNECTED distant
 * slack by hand. That gap is the whole reason a broken composition
 * shipped with a green proof, and the successor proof now runs the
 * production path itself against the real product.
 *
 * Worse: acceptance checked Kirchhoff at the injection bus only, which a
 * disconnected pair can satisfy while the solve has not converged at all.
 * The card was gated on exactly that, so it could have printed an
 * impossible transfer. It did not for West Burton - the error was 1.5e11
 * and the card suppressed itself - but that was luck, not the gate.
 *
 * FINDING 2 - PARALLEL CIRCUITS COLLAPSED
 * ---------------------------------------
 * Edges were de-duplicated by endpoints, kind and reactance, so two
 * genuine parallel circuits publishing the same reactance became one: 22
 * groups covering 45 published rows at 400 kV. Two parallel circuits
 * carry twice what one carries at the same angle. The model went from 437
 * modelled branches to 459 when the row itself became the identity.
 *
 * WHAT SHIPS
 * ----------
 *   - the successor module: components computed and named, a DECLARED
 *     sink rule, acceptance requiring convergence AND a global residual
 *     AND Kirchhoff at EVERY bus, and row-identity edges;
 *   - the card asks for the declared sink instead of an arbitrary bus,
 *     gates on `publishable` rather than one bus balancing, and says so
 *     plainly when the answer is not available rather than going quiet.
 *
 * A field called `available` was renamed `publishable` on the way: on a
 * grid computation "available" reads as available CAPACITY, which is the
 * one thing this module refuses to claim. My own headroom check caught it.
 */

const OLD_MODULE = 'atlas/modules/202609012320-injection-response.js';
const NEW_MODULE = 'atlas/modules/202609020015-injection-response.js';
const NEW_PROOF = 'tools/proofs/modules/202609020015-injection-response.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'powerflow-stopship',
  version: 'v9.77',

  restamp: ['substation-intelligence', 'sld-sandbox'],

  scope: 'the powerflow stops choosing an arbitrary withdrawal bus: the published 400 kV network has 238 connected components, a transfer across two of them does not exist, and the card was asking for one - it now uses a declared sink rule, refuses a cross-component transfer before the solver is asked, accepts an answer only on convergence AND a global residual AND Kirchhoff at every bus rather than at the injection bus alone, says plainly when no answer is available, and counts parallel circuits as the separate published rows they are rather than collapsing those that share a reactance',

  note: 'Codex stop-ship 202609020030, both findings accepted in full. The first proof passed while production was broken because it chose a connected slack by hand and the caller chose the first lexicographic bus; the successor proof runs the production path itself. Modelled branches went 437 to 459 when the published row became the edge identity.',

  brings: [NEW_MODULE, NEW_PROOF],
  replaceModules: [`${OLD_MODULE}=${NEW_MODULE}`],
  proofs: [NEW_PROOF],

  apply({ read, write, sandboxProof }) {
    let body = read(BODY);
    const once = (from, to, label) => {
      const n = body.split(from).length - 1;
      if (n !== 1) throw new Error(`anchor found ${n} times: ${label}`);
      body = body.replace(from, () => to);
    };

    /* ── the caller asks for a declared sink, and gates on the right thing ── */
    once(`          const slackNode = model.buses.find(b => b !== model.busOf(here));
          if (!slackNode) return null;
          const r = mod.respond(model, { atNode: here, slackNode, mw, minimumShare: 0.05 });
          return r && r.validation && r.validation.passes ? r : null;`,
      `          /* The withdrawal bus is DECLARED, not the first one to hand.
             ------------------------------------------------------------
             This took model.buses.find(b => b !== injection), which on a
             network with 238 components is almost always a bus the
             injection cannot reach. Codex found it at 202609020030. The
             module now publishes the rule it uses and the component it
             solved in, and refuses a cross-component transfer outright. */
          const slackNode = typeof mod.sinkFor === 'function'
            ? mod.sinkFor(model, here) : null;
          if (!slackNode) return null;
          const r = mod.respond(model, { atNode: here, slackNode, mw, minimumShare: 0.05 });
          /* publishable, not validation.passes: a disconnected pair can
             balance at the injection bus while the solve has not converged
             at all, and the old gate would have let that print. */
          return r && r.publishable === true ? r : (r || null);`,
      'declared sink');

    /* ── an unavailable answer is stated, not silent ─────────────────── */
    once(`      if (injection && injection.branches.length) {`,
      `      if (injection && injection.publishable !== true) {
        /* Saying nothing looks identical to having nothing to say. When
           the model cannot solve this transfer the reader is told, with
           the reason, rather than left with a card that quietly lost a
           section. */
        out += caveat(\`<b>Where the power would flow:</b> not available here. \`
          + escapeHtml(String(injection.reason
            || 'the solve did not meet its acceptance conditions'))
          + \` No figure is shown rather than one that has not converged.\`);
        powerflow.refused += 1;
      }
      if (injection && injection.publishable === true && injection.branches.length) {`,
      'unavailable state');

    once(`        + \`(declared DC model, 100 MVA base, transfer to \${escapeHtml(injection.slack_node)}): \``,
      `        + \`(declared DC model, 100 MVA base, transfer to \${escapeHtml(injection.slack_node)}, \`
          + \`solved in a component of \${injection.component
            ? injection.component.buses_in_component : '?'} buses): \``,
      'name the component');

    once(`  const powerflow = { answered: 0, worst_kirchhoff_error: 0 };`,
      `  const powerflow = { answered: 0, refused: 0, worst_kirchhoff_error: 0 };`,
      'refusal counter');

    write(BODY, body);

    /* ── the CI carries the successor proof ──────────────────────────── */
    const ci = read(CI);
    const OLD_CI = `  ['injection response (powerflow)', ['tools/proofs/modules/202609012320-injection-response.proof.mjs']],`;
    if (ci.split(OLD_CI).length - 1 !== 1) throw new Error('CI powerflow gate anchor is not unique');
    write(CI, ci.replace(OLD_CI,
      `  ['injection response (powerflow)', ['tools/proofs/modules/202609020015-injection-response.proof.mjs']],`));

    /* ── checks that pinned the module's VERSION must follow it ───────
       Several existing checks assert the module is present by matching
       `injection-response.v1`, and one slices the served bytes between
       that marker and the module's export to prove it reads no resistance
       or susceptance. The module is v2 now. Pinning the exact version was
       right - it is how a silent downgrade would be caught - so the
       pattern is moved forward rather than loosened to match any version,
       and the check that the OLD one is gone is kept beside it. */
    {
      const p = read(sandboxProof);
      const swaps = [
        // presence, in the sandbox proof's own module list
        ['/gridatlas\\.module\\.injection-response\\.v1/.test(composedSource)',
         '/gridatlas\\.module\\.injection-response\\.v2/.test(composedSource)'],
        ['/gridatlas\\.module\\.injection-response\\.v1/.test(subSource)',
         '/gridatlas\\.module\\.injection-response\\.v2/.test(subSource)'],
        // the r/b slice markers
        ["const start = composedSource.indexOf('gridatlas.module.injection-response.v1');",
         "const start = composedSource.indexOf('gridatlas.module.injection-response.v2');"],
        // the old acceptance gate, replaced by publishable
        ["check('an answer that fails its own Kirchhoff check is discarded, not printed',\n"
         + '  /r\\.validation && r\\.validation\\.passes \\? r : null/.test(cartridgeSource));',
         "check('an answer that fails its own acceptance is discarded, not printed',\n"
         + '  /r\\.publishable === true \\? r :/.test(cartridgeSource));'],
      ];
      let t = p;
      for (const [from, to] of swaps) {
        if (t.split(from).length - 1 !== 1) {
          throw new Error(`version-pinned check anchor is not unique: ${from.slice(0, 60)}`);
        }
        t = t.replace(from, () => to);
      }
      write(sandboxProof, t);
    }

    /* ── the gate ────────────────────────────────────────────────────── */
    const proof = read(sandboxProof);
    const TAIL = 'console.log(`\\n${passed}/${passed + failures.length} checks passed`);';
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, [
      "console.log('\\nthe powerflow stop-ship, closed\\n');",
      '',
      "check('the successor powerflow module is what ships',",
      "  /gridatlas\\.module\\.injection-response\\.v2/.test(composedSource)",
      "  && !/gridatlas\\.module\\.injection-response\\.v1/.test(composedSource));",
      "check('the card asks for a DECLARED sink, never the first bus to hand',",
      "  /mod\\.sinkFor\\(model, here\\)/.test(cartridgeSource)",
      "  && !/model\\.buses\\.find\\(b => b !== model\\.busOf\\(here\\)\\)/.test(cartridgeSource));",
      "check('the card gates on publishable, not on one bus balancing',",
      "  /r\\.publishable === true \\? r :/.test(cartridgeSource)",
      "  && !/r\\.validation && r\\.validation\\.passes \\? r : null/.test(cartridgeSource));",
      "check('an unavailable answer is stated to the reader, not swallowed',",
      "  /not available here/.test(cartridgeSource)",
      "  && /rather than one that has not converged/.test(cartridgeSource));",
      "check('the card names the component the transfer was solved in',",
      "  /solved in a component of/.test(cartridgeSource));",
      "check('refusals are counted for review',",
      "  /powerflow\\.refused \\+= 1;/.test(cartridgeSource));",
      "/* Pinned in fragments: these are concatenated string literals in the",
      "   module source, so the sentence never appears contiguously there -",
      "   the module proof matches the runtime string, which does. */",
      "check('the served module refuses a cross-component transfer',",
      "  /connected components of the published network/.test(composedSource));",
      "check('the served module accepts on all three conditions, not one',",
      "  /worst_bus_error_mw/.test(composedSource)",
      "  && /solved\\.residual < 1e-6/.test(composedSource));",
      "check('the served module keys edges on the published row, not its values',",
      "  /if \\(seen\\.has\\(entry\\.row\\)\\) continue;/.test(composedSource));",
      "check('the sink rule is published so a reader can see what was assumed',",
      "  /bus in the SAME component as the injection/.test(composedSource));",
      '',
      TAIL
    ].join('\n')));
  }
};
