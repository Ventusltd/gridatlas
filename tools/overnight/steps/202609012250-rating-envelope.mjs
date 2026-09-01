/**
 * Step: the card reports summer as well as winter, and refuses to add up.
 *
 * The owner product publishes a site-wide WINTER envelope, and the card
 * has been printing it. Two things are wrong with stopping there.
 *
 * First, summer is the binding season for a thermally limited circuit,
 * and the product publishes it on 1,276 of 1,392 circuits. Measured
 * against the payload, summer differs from winter on 1,081 of the 1,276
 * that publish both - so a card that shows only winter is showing the
 * more generous number on the great majority of circuits it describes.
 *
 * Second, the shape of the number invites a sum. Eight circuits rated
 * 3,000 MVA is not 24,000 MVA of anything, but nothing in the code has
 * ever prevented that figure from being produced, and it is the single
 * most persuasive wrong number available from this data.
 *
 * So the module reports each circuit in each season and contains no code
 * path that produces a total; its proof asserts the absence structurally,
 * not the intention. It also names the four circuits the product
 * publishes at 9,999 MVA - each on a span of a kilometre or less with
 * zero impedance, which is the shape of a placeholder rather than a
 * rating - and excludes them from the range while still reporting them.
 */

const MODULE = 'atlas/modules/202609012250-rating-envelope.js';
const PROOF = 'tools/proofs/modules/202609012250-rating-envelope.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';

export default {
  id: 'rating-envelope',
  version: 'v9.72',
  scope: 'the card reports every season the operator publishes rather than winter alone, each circuit keeping its own rating and its own season, scoped to the connection voltage; four circuits published at 9,999 MVA on spans of a kilometre or less are named as placeholders and excluded from the range while still being reported; and the module that produces all of this contains no code path that adds two ratings together, which its proof asserts structurally',
  note: 'summer differs from winter on 1,081 of the 1,276 circuits that publish both, so winter alone was the more generous number on the great majority of them; a sum of circuit ratings is not a quantity that exists in the network and is now impossible to produce here',

  brings: [MODULE, PROOF],
  addModules: [MODULE],
  proofs: [PROOF],

  apply({ read, write, patch, sandboxProof }) {
    let body = read(BODY);

    /* ── the accessor, beside the other two ──────────────────────────── */
    const ANCHOR = `  function topologyBlockHtml(queries) {`;
    if (body.split(ANCHOR).length - 1 !== 1) throw new Error('topologyBlockHtml anchor is not unique');
    body = body.replace(ANCHOR, `  function ratingModule() {
    try { return window.__GRIDATLAS_MODULES__?.ratingEnvelope || null; }
    catch (_) { return null; }
  }

${ANCHOR}`);

    /* ── the seasonal sentence, before the electrical one ────────────── */
    const REACH_ANCHOR = `      /* Electrical distance, beside the one-hop view.`;
    if (body.split(REACH_ANCHOR).length - 1 !== 1) throw new Error('electrical anchor is not unique');
    body = body.replace(REACH_ANCHOR, `      /* Seasonal ratings, per circuit, never added together.
         ---------------------------------------------------------------
         The lowest and the highest are two REAL published values, not a
         range around a mean, and each is labelled with the season it
         belongs to. Where the operator publishes a placeholder rather
         than a rating, the card says so rather than quietly carrying the
         larger number into the maximum. */
      const ratings = (() => {
        const mod = ratingModule();
        if (!mod) return null;
        try { return mod.at(topology.index, point.site_code, kv != null ? { voltageKv: kv } : undefined); }
        catch (_) { return null; }
      })();
      if (ratings && ratings.circuits.length) {
        const said = [];
        for (const season of ['winter', 'summer']) {
          const band = ratings.by_season[season];
          if (!band || !band.circuits) continue;
          said.push(\`\${season} \${band.lowest_circuit_mva === band.highest_circuit_mva
            ? band.lowest_circuit_mva
            : \`\${band.lowest_circuit_mva}-\${band.highest_circuit_mva}\`} MVA\`);
        }
        if (said.length) {
          const flagged = ratings.counts.with_a_flagged_value;
          out += caveat(\`<b>Circuit ratings:</b> \${escapeHtml(said.join(', '))}, \`
            + \`across \${ratings.counts.circuits} circuit\${ratings.counts.circuits === 1 ? '' : 's'}. \`
            + \`Each figure is one circuit's rating in that season. They are not added \`
            + \`together: the sum of the circuits at a site is not a quantity that exists \`
            + \`in the network, and a rating is not what is free on the circuit.\`
            + (flagged ? \` \${flagged} circuit\${flagged === 1 ? ' publishes a value' : 's publish values'} \`
              + \`at or above 9,999 MVA on spans of a kilometre or less; \`
              + \`\${flagged === 1 ? 'it reads' : 'they read'} as a placeholder and \`
              + \`\${flagged === 1 ? 'is' : 'are'} excluded from the range above.\` : ''));
          rating.answered += 1;
          rating.flagged += flagged;
        }
      }

${REACH_ANCHOR}`);

    /* ── published state, beside the electrical state ────────────────── */
    const STATE = `  window.__GRIDATLAS_ELECTRICAL__ = electrical;`;
    if (body.split(STATE).length - 1 !== 1) throw new Error('electrical state anchor is not unique');
    body = body.replace(STATE, `${STATE}

  /* How many cards quoted a seasonal rating, and how many placeholder
     values the published record turned out to contain. */
  const rating = { answered: 0, flagged: 0 };
  window.__GRIDATLAS_RATINGS__ = rating;`);

    write(BODY, body);

    patch(CI, [
      [`  ['electrical distance', ['tools/proofs/modules/202609012245-electrical-distance.proof.mjs']]
];`,
       `  ['electrical distance', ['tools/proofs/modules/202609012245-electrical-distance.proof.mjs']],
  ['rating envelope', ['tools/proofs/modules/202609012250-rating-envelope.proof.mjs']]
];`, 'CI gate list'],
    ]);

    const proof = read(sandboxProof);
    const TAIL = `console.log(\`\\n\${passed}/\${passed + failures.length} checks passed\`);`;
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, `console.log('\\nevery season the operator publishes, and no total\\n');

check('the rating-envelope module is in the served cartridge',
  /gridatlas\\.module\\.rating-envelope\\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.rating-envelope.v1')
    < cartridgeSource.indexOf('function ratingModule('));
check('the card asks for summer, not winter alone',
  /for \\(const season of \\['winter', 'summer'\\]\\)/.test(cartridgeSource));
check('the card is scoped to the connection voltage when there is one',
  /mod\\.at\\(topology\\.index, point\\.site_code, kv != null \\? \\{ voltageKv: kv \\}/.test(cartridgeSource));
check('the page states plainly that the ratings are not added together',
  /not a quantity that exists/.test(cartridgeSource));
check('the page distinguishes a rating from what is free on the circuit',
  /a rating is not what is free on the circuit/.test(cartridgeSource));
/* The sentence is split across a template interpolation for the
   singular/plural, so the words "reads as a placeholder" never appear
   adjacent in the source. Pin the two halves that do ship verbatim. */
check('a placeholder value is named to the reader, not hidden',
  /as a placeholder and/.test(cartridgeSource)
  && /at or above 9,999 MVA on spans of a kilometre or less/.test(cartridgeSource)
  && /excluded from the range above/.test(cartridgeSource));
check('the served bytes contain no site total of circuit ratings', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.rating-envelope.v1');
  const end = cartridgeSource.indexOf('NS.ratingEnvelope = Object.freeze');
  if (start < 0 || end < 0) return false;
  const module = cartridgeSource.slice(start, end)
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/[^\\n]*/g, '')
    .split(/const (?:NEVER_SUMMED|NOT_A_CAPACITY)\\s*=[\\s\\S]*?;/).join(' ');
  return !/(?:^|[^A-Za-z])(total|sum|aggregate)(?![A-Za-z])/i.test(module)
    && !/\\.reduce\\(/.test(module);
})());
check('the rating state is published for review',
  /window\\.__GRIDATLAS_RATINGS__ = rating;/.test(cartridgeSource));

${TAIL}`));
  }
};
