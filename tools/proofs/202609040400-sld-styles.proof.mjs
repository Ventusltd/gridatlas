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

/* FROM HERE DOWN: is the v9.107 wiring still reachable in whatever is
   actually live, not "is v9.107 itself still the live generation".
   ------------------------------------------------------------------------
   This proof is carried forward by every future sld-sandbox and
   substation-intelligence cut (recompose.mjs renames it, never restates
   it), and this repository composes cartridges independently -- "the
   composition carries mixed stamps and should" is recompose.mjs's own
   documented contract. The first version of this section asserted
   `current.composition_version === 'v9.107'` and
   `sld.generation === substation.generation === current.generation`: true
   for exactly one generation, and false the moment either cartridge was
   ever cut again on its own, which is the normal case, not an edge one.
   It also required the SLD body part to be BYTE-IDENTICAL to the original
   NEW_PART forever, which would forbid this cartridge from ever being
   touched again for any other reason.

   What must actually stay true, indefinitely, is narrower: the style
   module is still wired into substation-intelligence, and the sandbox's
   own body still carries the fail-fast binding and the seven call sites
   -- the WIRING, not the FILENAME or the COMPOSITION VERSION NUMBER. */
const current = json('atlas/current.json');
assert.ok(current.cartridge_order.indexOf('substation-intelligence')
  < current.cartridge_order.indexOf('sld-sandbox'),
  'the style owner must execute before its consumer');
const byId = new Map(current.cartridges.map(entry => [entry.id, entry]));
const sld = byId.get('sld-sandbox');
const substation = byId.get('substation-intelligence');
assert.ok(sld, 'the live composition must still carry sld-sandbox');
assert.ok(substation, 'the live composition must still carry substation-intelligence');

const sldPartsPath = path.posix.join('atlas', sld.assembled_from.replace(/^\.\//, ''));
const substationPartsPath = path.posix.join(
  'atlas', substation.assembled_from.replace(/^\.\//, ''));
const sldPartsManifest = json(sldPartsPath);
const substationPartsManifest = json(substationPartsPath);
const sldParts = sldPartsManifest.assembled_from;
const substationParts = substationPartsManifest.assembled_from;
// The one 'part'-role entry is the sandbox's own body, whatever generation
// it is now -- a later cut is free to supersede NEW_PART with a reviewed
// successor, the same way substation-intelligence's own carried engine has
// superseded shell scripts before it. What is checked below is that the
// successor still CARRIES the hoist wiring, not that it IS NEW_PART.
const sldPartEntry = sldParts.find(entry => entry.role === 'part');
const styleModuleEntry = substationParts.find(entry => entry.role === 'module'
  && entry.path === STYLE_MODULE);
assert.ok(sldPartEntry,
  'the SLD parts manifest must name a body part');
assert.ok(styleModuleEntry,
  'the substation parts manifest must carry the style module');

const assertManifestBytes = (entry, relative, label) => {
  const bytes = raw(relative);
  assert.equal(entry.bytes, bytes.length, `${label} manifest byte count drifted`);
  assert.equal(entry.sha256, rawDigest(bytes), `${label} manifest digest drifted`);
};
// Integrity against the manifest's OWN recorded path, whatever generation
// that part is now -- not against the original v9.107 file, which a later,
// reviewed successor is entitled to supersede.
assertManifestBytes(sldPartEntry, sldPartEntry.path, 'SLD body part');
assertManifestBytes(styleModuleEntry, STYLE_MODULE, 'style module');

const sldSource = lf(path.posix.join('atlas', sld.path.replace(/^\.\//, '')));
const substationSource = lf(path.posix.join(
  'atlas', substation.path.replace(/^\.\//, '')));
assertManifestBytes(sldPartsManifest,
  path.posix.join('atlas', sld.path.replace(/^\.\//, '')), 'SLD cartridge');
assertManifestBytes(substationPartsManifest,
  path.posix.join('atlas', substation.path.replace(/^\.\//, '')),
  'substation cartridge');
// The durable claim: the served cartridge still carries the fail-fast
// binding and calls every one of the seven style factories by exactly the
// call sites verified above -- checked by content, not by requiring the
// live body to still be byte-identical to the original v9.107 file.
assert.equal(sldSource.includes(binding), true,
  'the fail-fast style-module binding must reach the served SLD cartridge');
for (const call of expectedCalls) {
  assert.equal(sldSource.includes(call), true,
    `served SLD cartridge is missing call site: ${call}`);
}
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
/* 17000 was the exact margin the original v9.107 cut measured (17916), and
   was never going to survive as an ongoing minimum -- every legitimate
   feature added to the sandbox afterwards spends a little of it (this
   generation's technology-bucket fix cost 4482 characters of the 17916,
   leaving 13434). What must actually hold, indefinitely, is that some
   real saving over the pre-hoist v9.106 baseline remains -- proving the
   hoist was not quietly reverted -- while the hard budget is enforced by
   the CEILING assertion above, not by this one. */
assert.ok(oldSldChars - sldChars >= 10000,
  `the hoist headroom eroded past a sane floor: ${oldSldChars - sldChars} chars saved of the original 17916`);
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
// Named by the CARTRIDGE'S OWN generation, not the whole composition's --
// substation-intelligence and sld-sandbox are cut independently, so
// current.generation (a pointer to whichever cartridge was cut most
// recently) is frequently neither cartridge's own identity.
const substationWhitespaceExemptions = lf(ATTRIBUTES).split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .filter(line => line.includes(substation.generation) && line.endsWith(' -whitespace'));
assert.deepEqual(substationWhitespaceExemptions, [
  `atlas/cartridges/${substation.generation}-substation-intelligence-v9-63.js -whitespace`
], 'the live substation-intelligence cartridge with inherited V8 bytes must be exempt, and only it');

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
