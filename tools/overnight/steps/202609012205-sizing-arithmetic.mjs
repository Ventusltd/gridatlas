/**
 * Step: the sizing arithmetic leaves the body for a module.
 *
 * 529 lines of the sld-sandbox body (activePhysicalInputs through
 * fitToStatedCapacity) are pure arithmetic over an inputs object, plus the
 * finance port and the two-variable capacity fit. They close over `sld`
 * and FINANCE_DEFAULTS and nothing else, so they can be parameterised on
 * those and lifted out verbatim. The extraction is MECHANICAL: this step
 * slices the block out of the body at run time and applies a fixed list of
 * signature substitutions, each of which must match exactly once, so the
 * module carries every comment and every expression the body carried. The
 * parity proof then evaluates the last inline copy and the module side by
 * side on the same inputs and compares value for value.
 *
 * The body keeps one-line delegations under the same names, so every
 * caller in the layout and the finance panel is untouched.
 */

const MODULE = 'atlas/modules/202609012205-sizing-arithmetic.js';
const PROOF = 'tools/proofs/modules/202609012205-sizing-arithmetic.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';

const BLOCK_START = '  /* ── the sizing arithmetic, carried across unchanged ─────────────────── */\n';
const BLOCK_END = '  sld.fitToStatedCapacity = fitToStatedCapacity;\n';

const HEADER = `/**
 * Module: sizing-arithmetic
 *
 * The screening arithmetic of the SLD sandbox: physical inputs to array
 * statistics, the three named ratios (design, export, headroom), the
 * string and central topologies with their corrected nameplates, the
 * finance port of gis-sld-v5-finance.js, and the two-variable fit that
 * lands a layout on the capacity the register states.
 *
 * Lifted out of the sld-sandbox body at generation 202609012205 (UTC),
 * expression for expression. The body closed over its state object and
 * its finance defaults; here both are parameters. Nothing else changed,
 * and the parity proof evaluates the last inline copy beside this module
 * on the same inputs and asserts identical values.
 *
 * WHAT IT WILL NOT DO
 * It grades nothing. A ratio below one is stated with its meaning; an
 * export set by the transformers is stated as the design fact it is. The
 * finance figures are a screening model with the reference's own inputs
 * and are labelled as such by the panel that shows them.
 *
 * Pure. No DOM, no network, no state of its own: fitToStatedCapacity
 * mutates the state object it is handed, as the body's did, and says so.
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.sizingArithmetic) return;

`;

const FOOTER = `
  NS.sizingArithmetic = Object.freeze({
    generation: '202609012205',
    DEVELOPMENT_STAGES,
    DEVELOPMENT_SUCCESS,
    BIFACIAL_BY_GCR,
    FIT_OUTER_MAX,
    FIT_INNER_MAX,
    financeNumber,
    physicalInputs,
    buildStats,
    consistency,
    stringStats,
    centralStats,
    applyDevelopmentStageDefaults,
    applyMountingBifacial,
    screeningFinance,
    computeStats,
    fitToStatedCapacity
  });
})();
`;

/* Each substitution must match exactly once, or the extraction stops. */
const SUBSTITUTIONS = [
  ['function activePhysicalInputs() {\n    const i = sld.inputs;', 'function physicalInputs(inputs) {\n    const i = inputs;'],
  ['function buildStats(o) {\n    const p = activePhysicalInputs();', 'function buildStats(inputs, o) {\n    const p = physicalInputs(inputs);'],
  ['function computeStringStats() {\n    const i = sld.inputs;', 'function stringStats(inputs) {\n    const i = inputs;'],
  ['function computeCentralStats() {\n    const i = sld.inputs;', 'function centralStats(inputs) {\n    const i = inputs;'],
  ['function applyMountingBifacial(mode, gcrValue) {\n    const values = sld.finance[mode];', 'function applyMountingBifacial(financeByMode, mode, gcrValue) {\n    const values = (financeByMode || {})[mode];'],
  ['function computeScreeningFinance(financeInputs, stats) {\n    const f = financeInputs || FINANCE_DEFAULTS;', 'function screeningFinance(financeInputs, stats, context) {\n    const f = financeInputs || (context && context.defaults) || {};'],
  ["const centralInverterAc = (stats?.mode || sld.inputs.mode) === 'central'", "const centralInverterAc = (stats?.mode || (context && context.fallbackMode)) === 'central'"],
  [`  const computeSldStats = () => {
    const stats = sld.inputs.mode === 'string'
      ? computeStringStats() : computeCentralStats();
    // Same object, so nothing can read a capacity without the check that says
    // whether the capacities agree with each other.
    stats.mode = sld.inputs.mode;
    stats.consistency = consistency(sld.inputs, stats);
    stats.finance = computeScreeningFinance(sld.finance[sld.inputs.mode], stats);
    return stats;
  };
  sld.computeFinance = computeScreeningFinance;
  sld.applyDevelopmentStage = applyDevelopmentStageDefaults;
  sld.applyMountingBifacial = applyMountingBifacial;
`, `  function computeStats(inputs, financeByMode, defaults) {
    const stats = inputs.mode === 'string'
      ? stringStats(inputs) : centralStats(inputs);
    // Same object, so nothing can read a capacity without the check that says
    // whether the capacities agree with each other.
    stats.mode = inputs.mode;
    stats.consistency = consistency(inputs, stats);
    stats.finance = screeningFinance((financeByMode || {})[inputs.mode], stats,
      { fallbackMode: inputs.mode, defaults });
    return stats;
  }
`],
  ['function fitToStatedCapacity() {\n    sld.fitResidualPct = null;', 'function fitToStatedCapacity(sld, computeSldStats) {\n    sld.fitResidualPct = null;'],
];

const DELEGATIONS = `  /* ── the sizing arithmetic, in its module ────────────────────────────
     Lifted out at 202609012205 into atlas/modules/202609012205-sizing-
     arithmetic.js, proven value-for-value against the last inline copy.
     These delegations keep every caller's name; the module is handed the
     state and the defaults the body used to close over. Absent module:
     fail by name, never quietly compute nothing. */
  const SIZING = (window.__GRIDATLAS_MODULES__ || {}).sizingArithmetic;
  if (!SIZING) throw new Error('sld-sandbox: the sizing-arithmetic module is not composed');
  const { DEVELOPMENT_STAGES, financeNumber } = SIZING;

  function activePhysicalInputs() { return SIZING.physicalInputs(sld.inputs); }
  function applyDevelopmentStageDefaults(financeInputs, stageValue) {
    return SIZING.applyDevelopmentStageDefaults(financeInputs, stageValue);
  }
  function applyMountingBifacial(mode, gcrValue) {
    return SIZING.applyMountingBifacial(sld.finance, mode, gcrValue);
  }
  function computeScreeningFinance(financeInputs, stats) {
    return SIZING.screeningFinance(financeInputs, stats,
      { fallbackMode: sld.inputs.mode, defaults: FINANCE_DEFAULTS });
  }
  const computeSldStats = () => SIZING.computeStats(sld.inputs, sld.finance, FINANCE_DEFAULTS);
  sld.computeFinance = computeScreeningFinance;
  sld.applyDevelopmentStage = applyDevelopmentStageDefaults;
  sld.applyMountingBifacial = applyMountingBifacial;

  function fitToStatedCapacity() { return SIZING.fitToStatedCapacity(sld, computeSldStats); }
  sld.fitToStatedCapacity = fitToStatedCapacity;
`;

export default {
  id: 'sizing-arithmetic',
  version: 'v9.69',
  scope: 'sld-sandbox: the sizing arithmetic (physical inputs, the three named ratios, string and central nameplates, the finance port and the two-variable capacity fit) leaves the body for the sizing-arithmetic module, lifted mechanically expression for expression and proven value-for-value against the last inline copy; the body keeps one-line delegations so no caller changes',
  note: '529 lines of sizing arithmetic become a module, proven equal to the inline copy on every input tried',
  brings: [PROOF],
  addModules: [MODULE],
  proofs: [PROOF],
  apply({ read, write, patch, sandboxProof }) {
    /* the sandbox proof pinned the central-mode fallback by its inline
       spelling; the module spells it on its context parameter */
    patch(sandboxProof, [[
      "/\\(stats\\?\\.mode \\|\\| sld\\.inputs\\.mode\\) === 'central'/.test(cartridgeSource)",
      "/\\(stats\\?\\.mode \\|\\| \\(context && context\\.fallbackMode\\)\\) === 'central'/.test(cartridgeSource)",
      'central OPEX basis check follows the text into the module']]);
    const body = read(BODY);
    const start = body.indexOf(BLOCK_START);
    const end = body.indexOf(BLOCK_END, start);
    if (start < 0 || end < 0) throw new Error('the sizing block is not where the step expects it');
    let block = body.slice(start + BLOCK_START.length, end);
    for (const [from, to] of SUBSTITUTIONS) {
      const count = block.split(from).length - 1;
      if (count !== 1) throw new Error(`substitution matched ${count} times: ${from.slice(0, 60)}`);
      block = block.replace(from, () => to);
    }
    /* four calls into buildStats, all of the same shape */
    const calls = block.split('return buildStats({').length - 1;
    if (calls !== 4) throw new Error(`expected 4 buildStats calls, found ${calls}`);
    block = block.split('return buildStats({').join('return buildStats(i, {');
    /* outside the fit, no CODE line may read the body state; the comment
       recording the deleted auto-reconciler names sld.inputs.z_strings and
       is history, so comment lines are skipped */
    const beforeFit = block.replace(/function fitToStatedCapacity[\s\S]*$/, '');
    const codeOnly = beforeFit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const leak = codeOnly.split('\n').find(l => /\bsld\./.test(l));
    if (leak) throw new Error('the module still reads the body state outside the fit: ' + leak.trim());
    if (/\bFINANCE_DEFAULTS\b/.test(block)) throw new Error('the module still names FINANCE_DEFAULTS');
    write(MODULE, HEADER + block + FOOTER);
    write(BODY, body.slice(0, start) + DELEGATIONS + body.slice(end + BLOCK_END.length));
  }
};
