/**
 * Proof for the sizing-arithmetic module.
 *
 * The module was lifted out of the sld-sandbox body, so the question that
 * matters is PARITY: on the same inputs, does the module return exactly
 * what the inline arithmetic returned? The inline copy is read from the
 * last cartridge that carried it (v9.68, 202609012141), the block is
 * evaluated in a realm of its own with a state object and the finance
 * defaults handed in the way the body handed them, and the two are run
 * side by side over a battery of inputs, targets and finance cases. A
 * value that differs anywhere fails here, not on a card.
 *
 *   node tools/proofs/modules/202609012205-sizing-arithmetic.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';

const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));
const same = (a, b) => isDeepStrictEqual(plain(a), plain(b));

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const MODULE = join(REPO, 'atlas', 'modules', '202609012205-sizing-arithmetic.js');
const BODY = join(REPO, 'atlas', 'parts', '202609012045-sld-sandbox-body.js');
/* The last served bytes that carried the arithmetic inline. Pinned: this
   is the record the module must reproduce, and it does not move. */
const LAST_INLINE = join(REPO, 'atlas', 'cartridges', '202609012141-sld-sandbox-v9-8.js');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}
function fresh() {
  const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
    Map, Set, Boolean, Error, RegExp };
  box.window.window = box.window;
  vm.createContext(box);
  return box;
}

const moduleSource = await readFile(MODULE, 'utf8');
const body = await readFile(BODY, 'utf8');
const shipped = await readFile(LAST_INLINE, 'utf8');

/* ── the module loads on its own ─────────────────────────────────────── */
console.log('\nit loads, alone, frozen\n');
const box = fresh();
vm.runInContext(moduleSource, box);
const mod = box.window.__GRIDATLAS_MODULES__.sizingArithmetic;
check('registers a frozen surface with the generation it was cut at',
  !!mod && Object.isFrozen(mod) && mod.generation === '202609012205');
check('loading it twice is a no-op', (() => { vm.runInContext(moduleSource, box); return box.window.__GRIDATLAS_MODULES__.sizingArithmetic === mod; })());
for (const name of ['physicalInputs', 'buildStats', 'consistency', 'stringStats', 'centralStats',
  'applyDevelopmentStageDefaults', 'applyMountingBifacial', 'screeningFinance', 'computeStats', 'fitToStatedCapacity', 'financeNumber']) {
  check(`exports ${name}`, typeof mod[name] === 'function');
}
check('the tables are frozen', Object.isFrozen(mod.DEVELOPMENT_STAGES) && Object.isFrozen(mod.DEVELOPMENT_SUCCESS) && Object.isFrozen(mod.BIFACIAL_BY_GCR));
check('no DOM, no fetch, no timers in the module',
  !/\b(document|fetch|setTimeout|setInterval|localStorage|XMLHttpRequest)\b/.test(moduleSource));
/* Comments are stripped first: the note recording the deleted auto-reconciler
   names sld.inputs.z_strings, and that is history, not a read. */
const codeOnly = moduleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
check('the module never reads the body state by name outside the fit it is handed',
  !/\bsld\./.test(codeOnly.replace(/function fitToStatedCapacity[\s\S]*$/, '')) && !/FINANCE_DEFAULTS/.test(codeOnly));

/* ── the inline copy, evaluated as the body evaluated it ─────────────── */
console.log('\nthe last inline copy, evaluated beside the module\n');
function slice(text, from, to, label) {
  const a = text.indexOf(from); if (a < 0) throw new Error(`${label}: start not found`);
  const b = text.indexOf(to, a); if (b < 0) throw new Error(`${label}: end not found`);
  return text.slice(a, b + to.length);
}
const defaultsSrc = slice(shipped, '  const FINANCE_DEFAULTS = Object.freeze({', '  });\n', 'FINANCE_DEFAULTS');
const stateSrc = slice(shipped, '  const sld = {', '  window.__GRIDATLAS_SLD__ = sld;', 'sld').replace('  window.__GRIDATLAS_SLD__ = sld;', '');
const blockSrc = slice(shipped, '  /* ── the sizing arithmetic, carried across unchanged ───', '  sld.fitToStatedCapacity = fitToStatedCapacity;\n', 'block');
check('the shipped cartridge still carries the arithmetic inline (the record this proof reads)', blockSrc.length > 15000 && /function computeCentralStats\(\)/.test(blockSrc));
check('the body no longer carries it inline', !/function computeCentralStats\(\)/.test(body) && /SIZING\.computeStats\(sld\.inputs, sld\.finance, FINANCE_DEFAULTS\)/.test(body));

/* a factory: fresh inline state + functions per call, so runs never share state */
const inlineFactory = vm.runInContext(`(function () {
${defaultsSrc}
  const freshFinanceInputs = () => ({ ...FINANCE_DEFAULTS });
${stateSrc}
${blockSrc}
  return { sld, FINANCE_DEFAULTS, computeSldStats, fitToStatedCapacity, computeScreeningFinance,
    applyDevelopmentStageDefaults, applyMountingBifacial, activePhysicalInputs, consistency,
    DEVELOPMENT_STAGES, DEVELOPMENT_SUCCESS, BIFACIAL_BY_GCR };
})`, fresh());
const inline0 = inlineFactory();
check('the inline copy evaluates and exposes its functions', typeof inline0.computeSldStats === 'function' && typeof inline0.fitToStatedCapacity === 'function');

/* module-side state: the same initial state literal, evaluated in the module's realm */
const stateFactory = vm.runInContext(`(function () {
${defaultsSrc}
  const freshFinanceInputs = () => ({ ...FINANCE_DEFAULTS });
${stateSrc}
  return { sld, FINANCE_DEFAULTS };
})`, box);

check('the three tables are identical', same(mod.DEVELOPMENT_STAGES, inline0.DEVELOPMENT_STAGES) && same(mod.DEVELOPMENT_SUCCESS, inline0.DEVELOPMENT_SUCCESS) && same(mod.BIFACIAL_BY_GCR, inline0.BIFACIAL_BY_GCR));

/* ── the battery ─────────────────────────────────────────────────────── */
console.log('\nvalue for value, over a battery of inputs\n');
const variations = [
  {},
  { mode: 'central' },
  { z_strings: 23 }, { z_strings: 12, y_invs: 20 }, { string_inv_kva: 600 }, { string_inv_kva: 250, string_skid_mva: 4.4 },
  { b_cols: 1, s_subs: 1 }, { b_cols: 12, s_subs: 3 }, { mod_wp: 720, mod_l: 2.4, mod_w: 1.13 }, { gcr: 0.35 }, { gcr: 0.75, gross_factor: 1.5 },
  { dc_ac_ratio: 1.0 }, { dc_ac_ratio: 1.45 }, { mod_wp: 0 }, { x_mods: 0 },
  { mode: 'central', inv_per_mv_c: 2 }, { mode: 'central', inv_per_mv_c: 3, central_skid_mva_c: 8.8 }, { mode: 'central', inv_ac_mw_c: 12, inv_dc_mw_c: 14.4 },
  { mode: 'central', rings_c: 1, mv_per_ring_c: 1 }, { mode: 'central', rings_c: 9, mv_per_ring_c: 12 }, { mode: 'central', mod_wp_c: 0 }, { mode: 'central', x_mods_c: 0 },
  { mode: 'central', gcr_c: 0.35 }, { mode: 'central', inv_ac_mw_c: 0 },
];
const financeCases = [
  {}, { price: 80, other: 5 }, { yield: 1100, bifacial: 8, losses: 3, deg: 0.5 }, { opex: 30000, epc_ex: 0.35, modules: 0.12 },
  { flood: true, flood_rate: 0.05 }, { bess_mw: 20, bess_mwh: 40, bess_capex: 300000, bess_cycles: 365, bess_spread: 60, bess_eff: 85 },
  { dev_stage: '0.035', dev_cost_mw: 0.035, dev_success: 30 }, { loss_dc_string: 1, loss_lv_dc: 1, loss_lv_ac: 1, loss_tx: 1, loss_other: 1 },
  { fixed_capex: 0, cont: 0 }, { yield: 'abc', price: null },
];
let compared = 0; let diffs = 0;
for (const v of variations) {
  const a = inlineFactory();
  const b = stateFactory();
  Object.assign(a.sld.inputs, v); Object.assign(b.sld.inputs, v);
  for (const fc of financeCases) {
    const mode = a.sld.inputs.mode;
    Object.assign(a.sld.finance[mode], fc); Object.assign(b.sld.finance[mode], fc);
    const sa = a.computeSldStats();
    const sb = mod.computeStats(b.sld.inputs, b.sld.finance, b.FINANCE_DEFAULTS);
    compared += 1;
    if (!same(sa, sb)) { diffs += 1; if (diffs < 4) console.log('    differs on', JSON.stringify(v), JSON.stringify(fc), '\n     inline', JSON.stringify(plain(sa)).slice(0, 300), '\n     module', JSON.stringify(plain(sb)).slice(0, 300)); }
  }
}
check(`computeStats agrees with the inline copy on ${compared} input/finance combinations`, diffs === 0, `${diffs} differ`);

/* consistency and physical inputs directly */
{
  let d = 0;
  for (const v of variations) {
    const a = inlineFactory(); const b = stateFactory();
    Object.assign(a.sld.inputs, v); Object.assign(b.sld.inputs, v);
    if (!same(a.activePhysicalInputs(), mod.physicalInputs(b.sld.inputs))) d += 1;
    const s = a.computeSldStats();
    if (!same(a.consistency(a.sld.inputs, s), mod.consistency(b.sld.inputs, s))) d += 1;
  }
  check('physicalInputs and consistency agree on every variation', d === 0, `${d} differ`);
}

/* finance with a null inputs object falls back to the defaults, as the body's did */
{
  const a = inlineFactory(); const b = stateFactory();
  const s = a.computeSldStats();
  check('screeningFinance with no inputs uses the defaults, as the inline copy did',
    same(a.computeScreeningFinance(null, s), mod.screeningFinance(null, s, { fallbackMode: b.sld.inputs.mode, defaults: b.FINANCE_DEFAULTS })));
  const bare = { dc_mwp: 50, ac_mw: 40 };
  a.sld.inputs.mode = 'central';
  check('screeningFinance with stats lacking a mode falls back to the state mode',
    same(a.computeScreeningFinance(a.sld.finance.central, bare), mod.screeningFinance(b.sld.finance.central, bare, { fallbackMode: 'central', defaults: b.FINANCE_DEFAULTS })));
}

/* the fit: targets across the register's range, both bases, both modes */
{
  let d = 0; let runs = 0;
  for (const mode of ['string', 'central']) {
    for (const basis of ['ac', 'dc', 'unstated']) {
      for (const target of [1, 2.5, 5, 9.9, 30, 49.9, 50, 100, 249, 600, 0, -1, NaN]) {
        const a = inlineFactory(); const b = stateFactory();
        a.sld.inputs.mode = mode; b.sld.inputs.mode = mode;
        a.sld.targetMw = target; b.sld.targetMw = target;
        a.sld.targetBasis = basis; b.sld.targetBasis = basis;
        a.fitToStatedCapacity();
        mod.fitToStatedCapacity(b.sld, () => mod.computeStats(b.sld.inputs, b.sld.finance, b.FINANCE_DEFAULTS));
        runs += 1;
        const pick = (s) => ({ inputs: s.inputs, residual: s.fitResidualPct, quantum: s.fitQuantumMw });
        if (!same(pick(a.sld), pick(b.sld))) { d += 1; if (d < 4) console.log('    fit differs', mode, basis, target, JSON.stringify(plain(pick(a.sld))).slice(0, 200), JSON.stringify(plain(pick(b.sld))).slice(0, 200)); }
      }
    }
  }
  check(`fitToStatedCapacity lands on the same layout, residual and quantum in ${runs} fits`, d === 0, `${d} differ`);
}

/* the stage and mounting handlers */
{
  let d = 0;
  for (const stage of ['0.003', '0.015', '0.035', '0.055', '0.070', '0.080', '0.100', '0.5', 'x', 0.07]) {
    const fa = { dev_stage: 'old', dev_cost_mw: 9, dev_success: 9 }; const fb = { ...fa };
    const ra = inline0.applyDevelopmentStageDefaults(fa, stage); const rb = mod.applyDevelopmentStageDefaults(fb, stage);
    if (ra !== rb || !same(fa, fb)) d += 1;
  }
  check('applyDevelopmentStageDefaults agrees, including on stages that do not exist', d === 0, `${d} differ`);
  let e = 0;
  for (const [mode, gcr] of [['string', 0.35], ['string', '0.45'], ['central', 0.75], ['central', 0.5], ['nowhere', 0.35], ['string', 'abc']]) {
    const a = inlineFactory(); const b = stateFactory();
    const ra = a.applyMountingBifacial(mode, gcr); const rb = mod.applyMountingBifacial(b.sld.finance, mode, gcr);
    if (ra !== rb || !same(a.sld.finance, b.sld.finance)) e += 1;
  }
  check('applyMountingBifacial agrees, including on a mode that does not exist and a GCR with no preset', e === 0, `${e} differ`);
}

/* ── the body delegates, and fails by name without the module ────────── */
console.log('\nthe body delegates\n');
check('the body binds the module and throws by name if it is absent',
  /const SIZING = \(window\.__GRIDATLAS_MODULES__ \|\| \{\}\)\.sizingArithmetic;/.test(body)
  && /throw new Error\('sld-sandbox: the sizing-arithmetic module is not composed'\)/.test(body));
for (const name of ['activePhysicalInputs', 'applyDevelopmentStageDefaults', 'applyMountingBifacial', 'computeScreeningFinance', 'fitToStatedCapacity']) {
  check(`the body keeps ${name} as a delegation`, new RegExp(`function ${name}\\([^)]*\\) \\{[^}]*SIZING\\.`).test(body));
}
check('the body still publishes computeFinance, applyDevelopmentStage, applyMountingBifacial and fitToStatedCapacity on the state',
  ['sld.computeFinance = computeScreeningFinance;', 'sld.applyDevelopmentStage = applyDevelopmentStageDefaults;', 'sld.applyMountingBifacial = applyMountingBifacial;', 'sld.fitToStatedCapacity = fitToStatedCapacity;'].every(s => body.includes(s)));
check('the body no longer defines the tables', !/const DEVELOPMENT_STAGES = Object\.freeze/.test(body) && !/const BIFACIAL_BY_GCR/.test(body));

console.log(`\n${passed}/${passed + failures.length} passed`);
if (failures.length) { console.log('\nFAILED:'); for (const f of failures) console.log('  - ' + f); process.exit(1); }
