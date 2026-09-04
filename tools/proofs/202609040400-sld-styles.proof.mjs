/**
 * v9.107 stylesheet-hoist proof.
 *
 * The cut is deliberately mechanical: seven template-literal CSS values move
 * from sld-sandbox into the earlier-loading substation-intelligence cartridge.
 * Installation timing and DOM ownership stay in the sandbox. This proof uses
 * the preserved v9.106 part as the oracle and fails if any CSS value changes,
 * either concatenated style is moved, the module is absent from served bytes,
 * or either cartridge crosses the existing ceiling.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OLD_PART = 'atlas/parts/202609040229-sld-sandbox-arrival-identity.js';
const NEW_PART = 'atlas/parts/202609040400-sld-sandbox-style-hoist.js';
const STYLE_MODULE = 'atlas/modules/202609040400-sld-styles.js';
const CARRIED_ENGINE =
  'atlas/parts/202609040229-ventus-corev8engine-exact-repd-delegation.js';
const ATTRIBUTES = '.gitattributes';
const OLD_SLD = 'atlas/cartridges/202609040337-sld-sandbox-v9-8.js';
const OLD_SUBSTATION =
  'atlas/cartridges/202609040337-substation-intelligence-v9-63.js';
const BOUNDARY = 409600;
const CEILING = Math.floor(BOUNDARY * 0.9);

const lf = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
  .replace(/\r\n/g, '\n');
const raw = relative => fs.readFileSync(path.join(ROOT, relative));
const json = relative => JSON.parse(lf(relative));
const digest = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const rawDigest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const oldPart = lf(OLD_PART);
const newPart = lf(NEW_PART);
const moduleSource = lf(STYLE_MODULE);
const templateAssignment = /style\.textContent\s*=\s*(`(?:\\.|[^`])*`);/g;
const legacyExpressions = [...oldPart.matchAll(templateAssignment)].map(match => match[1]);

assert.equal(legacyExpressions.length, 7,
  'the preserved v9.106 body must contain exactly seven authorised templates');
assert.equal([...newPart.matchAll(templateAssignment)].length, 0,
  'no template style assignment may remain in the successor body');

const context = vm.createContext({ window: {} });
vm.runInContext(moduleSource, context, { filename: STYLE_MODULE });
const styles = context.window.__GRIDATLAS_MODULES__?.sldStyles;
assert.equal(styles?.schema, 'gridatlas.module.sld-styles.v1');
assert.equal(Object.isFrozen(styles), true, 'the style API is immutable');
assert.deepEqual(
  [...Object.keys(styles)],
  ['schema', 'neonBlock', 'bootStatus', 'versionLedger', 'mobileTray',
    'gbConditions', 'sldPanel', 'fullscreenLayers'],
  'the module exposes only the seven authorised factories'
);
assert.throws(
  () => vm.runInContext(moduleSource, context, { filename: STYLE_MODULE }),
  /sld-styles module registered twice/,
  'a duplicate module must not silently replace the first one'
);

const cases = [
  { call: 'neonBlock', name: 'BLOCK_CLASS', value: 'gridatlas-neon-block',
    selector: '.gridatlas-neon-block' },
  { call: 'bootStatus', name: 'STATUS_ID', value: 'gridatlas-boot-status',
    selector: '#gridatlas-boot-status' },
  { call: 'versionLedger', name: 'LEDGER_ID', value: 'gridatlas-version-ledger',
    selector: '#gridatlas-version-ledger' },
  { call: 'mobileTray', name: 'TRAY_ID', value: 'gridatlas-mobile-tray',
    selector: '#gridatlas-mobile-tray' },
  { call: 'gbConditions', name: 'GB_ID', value: 'gridatlas-gb-conditions',
    selector: '#gridatlas-gb-conditions' },
  { call: 'sldPanel', name: 'PANEL_ID', value: 'gridatlas-sld-panel',
    selector: '#gridatlas-sld-panel' },
  { call: 'fullscreenLayers', name: null, value: null,
    selector: '.gridatlas-fs-layers' }
];

const cssDigests = {};
for (let index = 0; index < cases.length; index += 1) {
  const item = cases[index];
  const legacy = vm.runInNewContext(`(${legacyExpressions[index]})`,
    item.name ? { [item.name]: item.value } : {});
  const moved = item.name ? styles[item.call](item.value) : styles[item.call]();
  assert.equal(moved, legacy, `${item.call} CSS differs from v9.106`);
  assert.ok(moved.includes(item.selector), `${item.call} lost ${item.selector}`);
  cssDigests[item.call] = digest(moved);
}

const expectedCalls = [
  'style.textContent = SLD_STYLES.neonBlock(BLOCK_CLASS);',
  'style.textContent = SLD_STYLES.bootStatus(STATUS_ID);',
  'style.textContent = SLD_STYLES.versionLedger(LEDGER_ID);',
  'style.textContent = SLD_STYLES.mobileTray(TRAY_ID);',
  'style.textContent = SLD_STYLES.gbConditions(GB_ID);',
  'style.textContent = SLD_STYLES.sldPanel(PANEL_ID);',
  'style.textContent = SLD_STYLES.fullscreenLayers();'
];
const actualCalls = newPart.split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith('style.textContent = SLD_STYLES.'));
assert.deepEqual(actualCalls, expectedCalls,
  'each authorised call site must be one exact line');

const binding = "\n  const SLD_STYLES = (window.__GRIDATLAS_MODULES__ || {}).sldStyles;\n"
  + "  if (SLD_STYLES?.schema !== 'gridatlas.module.sld-styles.v1') {\n"
  + "    throw new Error('sld-sandbox requires the sld-styles module');\n"
  + '  }\n';
assert.equal(newPart.includes(binding), true, 'the fail-fast binding is exact');
assert.throws(
  () => vm.runInNewContext(newPart, { window: {} }, { filename: NEW_PART }),
  /sld-sandbox requires the sld-styles module/,
  'an absent module must fail before the sandbox creates an unstyled surface'
);
assert.throws(
  () => vm.runInNewContext(newPart,
    { window: { __GRIDATLAS_MODULES__: { sldStyles: { schema: 'wrong' } } } },
    { filename: NEW_PART }),
  /sld-sandbox requires the sld-styles module/,
  'an incompatible module must fail rather than silently render unstyled'
);

/* Reconstruct the old body. Exact equality proves the binding and seven call
   substitutions are the whole source change, including the two concatenated
   corridor/dash style assignments that were not authorised to move. */
let reconstructed = newPart.replace(binding, '');
for (let index = 0; index < expectedCalls.length; index += 1) {
  reconstructed = reconstructed.replace(expectedCalls[index],
    `style.textContent = ${legacyExpressions[index]};`);
}
assert.equal(reconstructed, oldPart,
  'the successor body contains a change outside the authorised mechanical move');
assert.equal((newPart.match(/style\.textContent\s*=/g) || []).length, 9,
  'seven module calls plus the two retained concatenated styles must remain');
assert.equal(newPart.includes("style.textContent =\n      '.gridatlas-corridor-open"), true,
  'the corridor style remains in the sandbox');
assert.equal(newPart.includes(
  "style.textContent = '.scada-wrapper[data-gridatlas-collapsed=\"1\"]"), true,
  'the dash style remains in the sandbox');

const current = json('atlas/current.json');
assert.equal(current.composition_version, 'v9.107');
assert.ok(current.cartridge_order.indexOf('substation-intelligence')
  < current.cartridge_order.indexOf('sld-sandbox'),
  'the style owner must execute before its consumer');
const byId = new Map(current.cartridges.map(entry => [entry.id, entry]));
const sld = byId.get('sld-sandbox');
const substation = byId.get('substation-intelligence');
assert.equal(sld?.generation, current.generation);
assert.equal(substation?.generation, current.generation);

const sldPartsPath = path.posix.join('atlas', sld.assembled_from.replace(/^\.\//, ''));
const substationPartsPath = path.posix.join(
  'atlas', substation.assembled_from.replace(/^\.\//, ''));
const sldPartsManifest = json(sldPartsPath);
const substationPartsManifest = json(substationPartsPath);
const sldParts = sldPartsManifest.assembled_from;
const substationParts = substationPartsManifest.assembled_from;
const sldPartEntry = sldParts.find(entry => entry.role === 'part'
  && entry.path === NEW_PART);
const styleModuleEntry = substationParts.find(entry => entry.role === 'module'
  && entry.path === STYLE_MODULE);
assert.ok(sldPartEntry,
  'the SLD parts manifest must name the immutable successor body');
assert.ok(styleModuleEntry,
  'the substation parts manifest must carry the style module');

const assertManifestBytes = (entry, relative, label) => {
  const bytes = raw(relative);
  assert.equal(entry.bytes, bytes.length, `${label} manifest byte count drifted`);
  assert.equal(entry.sha256, rawDigest(bytes), `${label} manifest digest drifted`);
};
assertManifestBytes(sldPartEntry, NEW_PART, 'SLD successor part');
assertManifestBytes(styleModuleEntry, STYLE_MODULE, 'style module');

const sldSource = lf(path.posix.join('atlas', sld.path.replace(/^\.\//, '')));
const substationSource = lf(path.posix.join(
  'atlas', substation.path.replace(/^\.\//, '')));
assertManifestBytes(sldPartsManifest,
  path.posix.join('atlas', sld.path.replace(/^\.\//, '')), 'SLD cartridge');
assertManifestBytes(substationPartsManifest,
  path.posix.join('atlas', substation.path.replace(/^\.\//, '')),
  'substation cartridge');
assert.equal(sldSource.includes(newPart.trimEnd()), true,
  'the successor body must reach the served SLD cartridge');
assert.equal(substationSource.includes(moduleSource.trimEnd()), true,
  'the style module must reach the served earlier cartridge');
const substationBody = substationParts.find(entry => entry.role === 'part');
assert.ok(substationBody, 'the receiving cartridge must still have its body part');
const substationBodySource = lf(substationBody.path).trimEnd();
assert.equal(substationSource.indexOf(moduleSource.trimEnd())
  < substationSource.indexOf(substationBodySource), true,
  'the style module must be evaluated before the substation body ends');

const oldSldChars = lf(OLD_SLD).length;
const oldSubstationChars = lf(OLD_SUBSTATION).length;
const sldChars = sldSource.length;
const substationChars = substationSource.length;
assert.ok(sldChars < CEILING, `SLD ${sldChars} crosses ${CEILING}`);
assert.ok(substationChars < CEILING,
  `substation ${substationChars} crosses ${CEILING}`);
assert.ok(oldSldChars - sldChars >= 17000,
  'the hoist did not create the promised SLD headroom');
assert.ok(substationChars > oldSubstationChars,
  'the receiving cartridge did not grow, so the module likely missed served bytes');

const trailingWhitespaceLines = source => source.split('\n')
  .filter(line => /[ \t]+$/.test(line));
const inheritedTrailingWhitespace = trailingWhitespaceLines(lf(CARRIED_ENGINE));
assert.equal(inheritedTrailingWhitespace.length, 58,
  'the preserved V8 receiver trailing-whitespace inventory changed');
assert.deepEqual(trailingWhitespaceLines(lf(OLD_SUBSTATION)),
  inheritedTrailingWhitespace,
  'the prior cartridge did not preserve exactly the receiver whitespace');
assert.deepEqual(trailingWhitespaceLines(substationSource),
  inheritedTrailingWhitespace,
  'the new cartridge introduced or removed trailing whitespace');
const generationWhitespaceExemptions = lf(ATTRIBUTES).split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .filter(line => line.includes(current.generation) && line.endsWith(' -whitespace'));
assert.deepEqual(generationWhitespaceExemptions, [
  'atlas/cartridges/202609040403-substation-intelligence-v9-63.js -whitespace'
], 'only the exact generated cartridge with inherited V8 bytes may be exempt');

console.log(JSON.stringify({
  status: 'PASS',
  generation: current.generation,
  version: current.composition_version,
  css_exact_parity: cssDigests,
  call_sites: actualCalls.length,
  inherited_v8_trailing_whitespace_lines: inheritedTrailingWhitespace.length,
  sld: {
    chars: sldChars,
    enforced_headroom: CEILING - sldChars,
    boundary_headroom: BOUNDARY - sldChars,
    previous_chars: oldSldChars
  },
  substation: {
    chars: substationChars,
    enforced_headroom: CEILING - substationChars,
    boundary_headroom: BOUNDARY - substationChars,
    previous_chars: oldSubstationChars
  }
}, null, 2));
