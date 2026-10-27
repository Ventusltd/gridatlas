#!/usr/bin/env node

/**
 * Execute the original GlobalGrid2050 GIS SLD electrical and finance engines
 * against a deliberately small DOM, then emit a deterministic JSON oracle.
 *
 * This is not a transcription of the formulas. The functions under test are
 * evaluated directly from the original repository so drift is visible in the
 * recorded source hashes and in the output comparison.
 *
 * Usage:
 *   node tools/proofs/202609010002-original-sld-finance-fixture.mjs \
 *     --original <gis-sld-financial-sandbox-directory>
 *   node tools/proofs/202609010002-original-sld-finance-fixture.mjs \
 *     --original <directory> --check tools/proofs/fixtures/202609010002-original-sld-finance.json
 *   node tools/proofs/202609010002-original-sld-finance-fixture.mjs \
 *     --original <directory> --write tools/proofs/fixtures/202609010002-original-sld-finance.json
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const valueAfter = flag => {
  const at = args.indexOf(flag);
  if (at < 0 || !args[at + 1]) throw new Error(`missing ${flag} value`);
  return args[at + 1];
};

const originalDir = path.resolve(valueAfter("--original"));
const checkAt = args.indexOf("--check");
const checkPath = checkAt >= 0 ? path.resolve(valueAfter("--check")) : null;
const writeAt = args.indexOf("--write");
const writePath = writeAt >= 0 ? path.resolve(valueAfter("--write")) : null;
assert.ok(!(checkPath && writePath), "use either --check or --write, not both");

const SOURCE_FILES = [
  "index.html",
  "gis-sld-v5-helpers.js",
  "gis-sld-v5-state.js",
  "gis-sld-v5-calculations.js",
  "gis-sld-v5-finance.js",
];

const sources = Object.fromEntries(SOURCE_FILES.map(name => {
  const absolute = path.join(originalDir, name);
  return [name, fs.readFileSync(absolute, "utf8")];
}));

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function attributes(markup) {
  const out = {};
  for (const match of markup.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const [, key, doubleQuoted, singleQuoted, bare] = match;
    out[key.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bare ?? true;
  }
  return out;
}

function makeElement(id, attrs = {}) {
  return {
    id,
    type: String(attrs.type || "text"),
    value: attrs.value === true || attrs.value == null ? "" : String(attrs.value),
    checked: attrs.checked === true,
    step: attrs.step == null ? "" : String(attrs.step),
    options: [],
    selectedIndex: -1,
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    closest() { return null; },
    addEventListener() {},
    dispatchEvent() { return true; },
  };
}

function parseElements(html) {
  const elements = new Map();

  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = attributes(match[1]);
    if (!attrs.id) continue;
    elements.set(String(attrs.id), makeElement(String(attrs.id), attrs));
  }

  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const attrs = attributes(match[1]);
    if (!attrs.id) continue;
    const el = makeElement(String(attrs.id), attrs);
    el.options = [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(optionMatch => {
      const optionAttrs = attributes(optionMatch[1]);
      return {
        value: optionAttrs.value === true || optionAttrs.value == null ? "" : String(optionAttrs.value),
        text: optionMatch[2].replace(/<[^>]+>/g, "").trim(),
        selected: optionAttrs.selected === true,
      };
    });
    el.selectedIndex = Math.max(0, el.options.findIndex(option => option.selected));
    el.value = el.options[el.selectedIndex]?.value || "";
    elements.set(el.id, el);
  }

  return elements;
}

function makeHarness() {
  const elements = parseElements(sources["index.html"]);
  const used = new Set();
  const document = {
    readyState: "loading",
    getElementById(id) {
      used.add(String(id));
      return elements.get(String(id)) || null;
    },
    addEventListener() {},
  };
  const context = vm.createContext({
    Array,
    console,
    document,
    Event: class Event {},
    Math,
    Number,
    parseFloat,
    parseInt,
    setTimeout,
    clearTimeout,
  });

  for (const name of SOURCE_FILES.slice(1)) {
    vm.runInContext(sources[name], context, { filename: name });
  }
  vm.runInContext("migrateFinanceUnitsToWp()", context);

  return { context, elements, used };
}

function applyOverrides(elements, overrides) {
  for (const [id, override] of Object.entries(overrides)) {
    const el = elements.get(id);
    assert.ok(el, `fixture override references missing original element ${id}`);
    if (typeof override === "object" && override !== null) {
      if ("selectedIndex" in override) {
        assert.ok(el.options[override.selectedIndex], `${id} selectedIndex is outside its options`);
        el.selectedIndex = override.selectedIndex;
        el.value = el.options[override.selectedIndex].value;
      }
      if ("value" in override) el.value = String(override.value);
      if ("checked" in override) el.checked = Boolean(override.checked);
    } else {
      el.value = String(override);
    }
  }
}

const FINANCE_STRESS = {
  price: 72,
  other: 8,
  yield: 1050,
  bifacial: 7.5,
  losses: 1.5,
  deg: 0.45,
  opex: 18000,
  epc_ex: 0.31,
  flood: { checked: true },
  flood_rate: 0.04,
  modules: 0.17,
  other_capex: 0.11,
  fixed_capex: 2500000,
  cont: 9,
  loss_dc_string: 0.4,
  loss_lv_dc: 0.2,
  loss_lv_ac: 0.3,
  loss_tx: 0.8,
  loss_other: 0.2,
  bess_mw: 50,
  bess_mwh: 100,
  bess_capex: 250000,
  bess_cycles: 250,
  bess_spread: 60,
  bess_eff: 88,
  dev_stage: { selectedIndex: 3 },
  dev_cost_mw: 0.055,
  dev_module_mwp: 0.18,
  dev_epc_mw: 0.65,
  dev_owner_mw: 0.11,
  dev_grid_mw: 0.25,
  dev_exit_mwp: 1.3,
  dev_npv_mwp: 1.15,
  dev_success: 55,
  dev_years: 5,
};

function prefixed(prefix, values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`${prefix}_${key}`, value]));
}

const CASES = [
  { id: "string_reference_defaults", mode: "string", prefix: "fin_string", overrides: {} },
  { id: "central_reference_defaults", mode: "central", prefix: "fin_central", overrides: {} },
  {
    id: "string_full_finance_path",
    mode: "string",
    prefix: "fin_string",
    overrides: {
      mod_wp: 700,
      mod_l: 2.42,
      mod_w: 1.31,
      mounting_type: 0.35,
      gross_factor: 1.5,
      dc_ac_ratio: 1.25,
      string_inv_kva: 330,
      string_skid_mva: 8.5,
      x_mods: 28,
      z_strings: 20,
      y_invs: 24,
      s_subs: 4,
      b_cols: 5,
      mods_pallet: 31,
      mods_container: 620,
      spare_pct: 1.5,
      ...prefixed("fin_string", FINANCE_STRESS),
    },
  },
  {
    id: "central_full_finance_path",
    mode: "central",
    prefix: "fin_central",
    overrides: {
      mod_wp_c: 700,
      mod_l_c: 2.42,
      mod_w_c: 1.31,
      mounting_type_c: 0.35,
      gross_factor_c: 1.5,
      inv_dc_mw_c: 5.6,
      inv_ac_mw_c: 4.5,
      central_skid_mva_c: 4.5,
      x_mods_c: 28,
      str_per_cb_c: 24,
      combiner_limit_kwdc_c: 500,
      // Deliberately greater than one so the original central AC double-count
      // is captured and a corrected port cannot accidentally claim parity.
      inv_per_mv_c: 2,
      mv_per_ring_c: 3,
      rings_c: 5,
      mods_pallet_c: 31,
      mods_container_c: 620,
      spare_pct_c: 1.5,
      ...prefixed("fin_central", FINANCE_STRESS),
    },
    centralReferenceDoubleCount: true,
  },
];

function runCase(spec) {
  const { context, elements, used } = makeHarness();
  applyOverrides(elements, spec.overrides);
  used.clear();
  const expression = spec.mode === "string"
    ? `(() => { const stats = computeStringStats(); return JSON.stringify({ stats, finance: computeFinance(${JSON.stringify(spec.prefix)}, stats) }); })()`
    : `(() => { const stats = computeCentralStats(); return JSON.stringify({ stats, finance: computeFinance(${JSON.stringify(spec.prefix)}, stats) }); })()`;
  const result = JSON.parse(vm.runInContext(expression, context));
  const inputs = Object.fromEntries([...used].sort().map(id => {
    const el = elements.get(id);
    // Optional controls are deliberately observable: the original central
    // engine probes central_rating_mode even though the V7 page does not ship
    // that element, then falls back to preset mode.
    return [id, el ? (el.type === "checkbox" ? el.checked : el.value) : null];
  }));
  const output = { id: spec.id, mode: spec.mode, inputs, ...result };
  if (spec.centralReferenceDoubleCount) {
    const invPerSkid = Number(inputs.inv_per_mv_c);
    const correctedAcMw = result.stats.ac_mw / invPerSkid;
    const excessAnnualOpex = (result.stats.ac_mw - correctedAcMw) * result.finance.opexRate;
    output.reference_defect = {
      code: "CENTRAL_AC_DOUBLE_COUNT",
      original_ac_mw: result.stats.ac_mw,
      corrected_ac_mw: correctedAcMw,
      corrected_dc_ac_ratio: result.stats.dc_mwp / correctedAcMw,
      corrected_surplus25: result.finance.surplus25 + excessAnnualOpex * 25,
      corrected_surplus35: result.finance.surplus35 + excessAnnualOpex * 35,
      contract: "The port must match the original inputs and unaffected outputs, but must use the corrected values above instead of reproducing the known AC double-count.",
    };
  }
  return output;
}

const calculations = sources["gis-sld-v5-calculations.js"];
const allExecutableSource = Object.entries(sources)
  .filter(([name]) => name.endsWith(".js"))
  .map(([, source]) => source)
  .join("\n");
const stringDefault = Number(sources["index.html"].match(/id="z_strings"\s+value="([^"]+)"/)?.[1]);
const declaredStringRatio = Number(sources["index.html"].match(/id="dc_ac_ratio"\s+value="([^"]+)"/)?.[1]);

assert.equal(stringDefault, 18, "original z_strings default drifted");
assert.equal(declaredStringRatio, 1.2, "original declared string ratio drifted");
assert.match(calculations, /const x = intVal\("x_mods"\), z = intVal\("z_strings"\)/);
assert.match(calculations, /ac_mw_direct != null \? ac_mw_direct/);
assert.match(calculations, /dc_ac_ratio: actual_dc_ac/);
assert.doesNotMatch(allExecutableSource, /setInputValue\("z_strings"/);
assert.doesNotMatch(allExecutableSource, /\$\("z_strings"\)\s*\.value\s*=/);

const executedCases = CASES.map(runCase);
const defaultStringCase = executedCases.find(item => item.id === "string_reference_defaults");
const centralDefectCase = executedCases.find(item => item.id === "central_full_finance_path");
assert.equal(defaultStringCase.inputs.z_strings, "18");
assert.notEqual(defaultStringCase.stats.dc_ac_ratio, declaredStringRatio,
  "the original must expose its calculated ratio rather than silently presenting the declared ratio");
assert.equal(centralDefectCase.reference_defect.original_ac_mw,
  centralDefectCase.reference_defect.corrected_ac_mw * Number(centralDefectCase.inputs.inv_per_mv_c));
assert.ok(centralDefectCase.finance.bessMwh > 0 && centralDefectCase.finance.totalLoss > 0,
  "full-path case must exercise BESS and specialist electrical losses");

const fixture = {
  schema: "globalgrid2050.original-sld-electrical-finance-fixture.v1",
  provenance: {
    original_directory_name: path.basename(originalDir),
    sha256: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, sha256(source)])),
    execution: "Original helper, state, calculation and finance JavaScript evaluated in a minimal DOM parsed from the original index.html.",
  },
  reference_behavior: {
    z_strings_default: stringDefault,
    declared_string_dc_ac_ratio: declaredStringRatio,
    z_strings_is_independent_input: true,
    reason: "The original reads z_strings directly. Its string AC is supplied by skid export, so buildStats recomputes actual DC/AC and does not use the declared ratio to alter z_strings.",
    known_central_defect: "Original central ac_mw_direct multiplies total_blocks by both central_skid_mva and inv_per_mv even though total_blocks already includes inv_per_mv. A corrected port must encode an explicit expected divergence for inv_per_mv greater than one.",
  },
  cases: executedCases,
};

const rendered = JSON.stringify(fixture, null, 2) + "\n";
if (checkPath) {
  const expected = fs.readFileSync(checkPath, "utf8").replace(/\r\n/g, "\n");
  assert.equal(rendered, expected, `fixture drift: regenerate ${checkPath} only after reviewing original source changes`);
  console.log(`PASS: original SLD electrical/finance fixture matches ${checkPath}`);
  console.log(`PASS: ${fixture.cases.length} cases execute the original engine; z_strings remains independent`);
} else if (writePath) {
  fs.mkdirSync(path.dirname(writePath), { recursive: true });
  fs.writeFileSync(writePath, rendered, "utf8");
  console.log(`WROTE: ${writePath}`);
  console.log(`PASS: ${fixture.cases.length} cases execute the original engine; central defect divergence is explicit`);
} else {
  process.stdout.write(rendered);
}
