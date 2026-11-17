/** Deterministic, pinned-source preview assembly. Never modifies a live pointer. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {deriveCurrent, rerootForPreview} from '../release/lib.mjs';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const G = '202611171525', PARENT = '202611161720', BUDGET = 64000;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const hash = b => createHash('sha256').update(b).digest('hex');
export function assemble() {
  const pin = JSON.parse(read('tools/journey/vendor-pin.json'));
  assert.equal(pin.commit, '65d48a851fc2ac74b13f939a0184e11298e7e5bd');
  const wrappers = [];
  const imports = {
    'network-topology.js': '',
    'journey-evidence.js': "import {index as topologyIndex} from './network-topology.js';",
    'edge-cover-journey.js': "import {canonicalJson, ordinal, prepareJourneyEvidence, sha256} from './journey-evidence.js';"
  };
  const aliases = {'network-topology.js': '', 'journey-evidence.js': 'const topologyIndex = JourneyTopology.index;', 'edge-cover-journey.js': 'const {canonicalJson, ordinal, prepareJourneyEvidence, sha256} = JourneyEvidence;'};
  const names = ['JourneyTopology', 'JourneyEvidence', 'JourneyEngine'];
  for (const [i, p] of pin.files.entries()) {
    const raw = fs.readFileSync(path.join(ROOT, 'tools/journey', p.vendorPath));
    assert.equal(raw.length, p.bytes, p.path); assert.equal(hash(raw), p.sha256, p.path);
    let text = raw.toString('utf8'); const file = path.basename(p.path);
    if (imports[file]) { assert.ok(text.includes(imports[file])); text = text.replace(imports[file], aliases[file]); }
    const exports = [...text.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    text = text.replace(/^export (?=(?:async )?(?:function|const) )/gm, '');
    assert.ok(!/^\s*(?:import|export) /m.test(text), 'Unexpected ESM syntax in pinned module');
    wrappers.push(`const ${names[i]} = (() => {\n${text}\nreturn Object.freeze({${exports.join(',')}});\n})();`);
  }
  assert.equal(hash(fs.readFileSync(path.join(ROOT, 'tools/journey/fixtures/reviewed-pair.v1.json'))), pin.sharedFixture.sha256);
  const fixture = JSON.parse(read('tools/journey/fixtures/synthetic-branch.v1.json'));
  assert.equal(fixture.synthetic, true);
  const controller = read('tools/journey/src/controller.mjs').replace('export function createJourneyController', 'function createJourneyController');
  const body = `/* GJ-03 PREVIEW ONLY. Canonical engine ${pin.repository}@${pin.commit}. No live pointer writes. */\n(() => {\n'use strict';\n${wrappers.join('\n')}\nconst JourneyFixture = ${JSON.stringify(fixture)};\nconst JourneyCSS = ${JSON.stringify(read('tools/journey/src/journey.css'))};\nconst JourneyGeneration = '${G}';\n${controller}\n${read('tools/journey/src/bootstrap.js')}\n})();\n`;
  assert.ok(Buffer.byteLength(body) <= BUDGET, `Preview exceeds proposed ${BUDGET}B budget: ${Buffer.byteLength(body)}`);
  const parentText = read(`atlas/manifests/${PARENT}-composition.json`), parent = JSON.parse(parentText);
  const composition = JSON.parse(deriveCurrent(parentText));
  Object.assign(composition, {generation: G, previous_generation: PARENT, superseded_generation: PARENT, candidate_predecessor: PARENT, composition_version: 'GJ-03-preview-1', composition_id: 'native-grid-journey-preview', composition_manifest: `./manifests/${G}-composition.json`, composition_note: 'Isolated native GJ-03 preview; real routes withheld. No operative release change.'});
  composition.cartridge_order.push('grid-journey-preview');
  composition.cartridges.push({id: 'grid-journey-preview', generation: G, version: 'GJ-03-preview-1', type: 'script', slot: 'after-cartridge', after: 'uk-offtakers-overlay', path: `./modules/${G}-grid-journey-preview.js`, sha256: hash(body), bytes: Buffer.byteLength(body), byte_budget: BUDGET, budget_status: 'PROPOSED_PREVIEW_ONLY_NOT_OWNER_RELEASE_APPROVAL', preview_only: true, real_routes_accepted: 0, capabilities: ['native-maplibre', 'explicit-reviewed-synthetic-seed', 'manual-reduced-motion', 'removable-lifecycle'], immutable_shell_modified: false});
  const manifest = {...composition, parent_generation: PARENT, version: 'GJ-03-preview-1', cut_at_utc: '2026-11-17T15:25:00.000Z', note: 'GJ milestone preview, separate from Pipeline News editions. No owner promotion requested or assumed.', candidate_status: 'PREVIEW_ONLY_REAL_ROUTES_WITHHELD', acceptance: {full_application_copies_created: 0, immutable_shell_modified: false, owner_release_acceptance: 'NOT_RECORDED_BY_AGENT', proposed_preview_budget_bytes: BUDGET, engine_pin: pin, real_routes_accepted: 0}};
  manifest.acceptance.synthetic_fixture = {path: 'tools/journey/fixtures/synthetic-branch.v1.json', sha256: hash(read('tools/journey/fixtures/synthetic-branch.v1.json')), sourceBundleSha: fixture.ledger.sourceBundleSha, synthetic: true};
  assert.equal(parent.generation, PARENT);
  return new Map([
    [`atlas/modules/${G}-grid-journey-preview.js`, body],
    [`atlas/manifests/${G}-composition.json`, JSON.stringify(manifest, null, 1) + '\n'],
    [`atlas/v/${G}/current.json`, rerootForPreview(deriveCurrent(JSON.stringify(manifest)))],
    [`atlas/v/${G}/index.html`, read('atlas/index.html')]
  ]);
}
export function build(check = false) {
  const outputs = assemble();
  for (const [p, bytes] of outputs) {
    if (check) assert.equal(read(p), bytes, `Rebuild drift: ${p}`);
    else { fs.mkdirSync(path.dirname(path.join(ROOT, p)), {recursive: true}); fs.writeFileSync(path.join(ROOT, p), bytes); }
  }
  return {generation: G, cartridgeBytes: Buffer.byteLength(outputs.get(`atlas/modules/${G}-grid-journey-preview.js`)), proposedBudgetBytes: BUDGET, files: [...outputs.keys()]};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(build(process.argv.includes('--check'))));
