/** Pinned producer delivery and native Journey DOM extension; no extraction or network collection. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {ROOT} from '../journey/build.mjs';
import {deriveCurrent, rerootForPreview} from '../release/lib.mjs';
export {ROOT};
export const G = '202611171600', PARENT = '202611171525', SCRIPT_BUDGET = 16000, INPUT_BUDGET = 8000, TOTAL_BUDGET = 24000;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function inputs() {
  const pin = JSON.parse(read('tools/journey-context/producer-pin.json'));
  assert.equal(pin.schema, 'gridatlas.journey.official-context.producer-pin.v1');
  assert.equal(pin.repository, 'Ventusltd/globalgrid2050'); assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.artifact.previewPath, `modules/${G}-official-planning-context.notice.json`);
  const load = item => { const local = path.resolve(ROOT, 'tools/journey-context', item.localPath); assert.ok(local.startsWith(path.join(ROOT, 'tools/journey-context/inputs') + path.sep)); const bytes = fs.readFileSync(local); assert.equal(bytes.length, item.bytes); assert.equal(hash(bytes), item.sha256); return bytes; };
  const model = load(pin.model), artifact = load(pin.artifact);
  assert.ok(artifact.length <= INPUT_BUDGET, 'Context source input exceeds proposed delivery budget');
  assert.equal(JSON.parse(artifact).facts_sha256, pin.factsSha256);
  return {pin, model, artifact};
}
export function assemble() {
  const {pin, model, artifact} = inputs();
  let modelText = model.toString('utf8');
  const names = [...modelText.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  assert.ok(names.includes('acceptedNotice') && names.includes('factsHash'));
  modelText = modelText.replace(/^export (?=(?:async )?(?:function|const) )/gm, '');
  assert.ok(!/^\s*(?:import|export) /m.test(modelText), 'Unexpected canonical consumer ESM syntax');
  const view = read('tools/journey-context/src/view.mjs').replace('export function renderOfficialContext', 'function renderOfficialContext');
  const bridge = read('tools/journey-context/src/bridge.mjs').replace('export function createOfficialContextBridge', 'function createOfficialContextBridge');
  const body = `/* GJ-04 PREVIEW ONLY. Official planning facts are not real circuit evidence. Producer ${pin.repository}@${pin.commit}. */\n(() => {\n'use strict';\nconst ContextModel = (() => {\n${modelText}\nreturn Object.freeze({${names.join(',')}});\n})();\nconst ContextPin = ${JSON.stringify(pin)};\nconst ContextGeneration = '${G}';\nconst ContextCSS = ${JSON.stringify(read('tools/journey-context/src/context.css'))};\n${view}\n${bridge}\n${read('tools/journey-context/src/bootstrap.js')}\n})();\n`;
  assert.ok(Buffer.byteLength(body) <= SCRIPT_BUDGET, `Script ${Buffer.byteLength(body)} exceeds proposed ${SCRIPT_BUDGET}B`);
  assert.ok(Buffer.byteLength(body) + artifact.length <= TOTAL_BUDGET);
  const parentText = read(`atlas/manifests/${PARENT}-composition.json`), parent = JSON.parse(parentText);
  const comp = JSON.parse(deriveCurrent(parentText));
  Object.assign(comp, {generation: G, previous_generation: PARENT, superseded_generation: PARENT, candidate_predecessor: PARENT, composition_version: 'GJ-04-context-preview-1', composition_id: 'official-planning-context-preview', composition_manifest: `./manifests/${G}-composition.json`, composition_note: 'One pinned government planning-fact context; zero real circuit routes or asset joins created.'});
  comp.cartridge_order.push('grid-journey-official-context');
  comp.cartridges.push({id: 'grid-journey-official-context', generation: G, version: 'GJ-04-context-preview-1', type: 'script', slot: 'after-cartridge', after: 'grid-journey-preview', path: `./modules/${G}-grid-journey-official-context.js`, sha256: hash(body), bytes: Buffer.byteLength(body), byte_budget: SCRIPT_BUDGET, budget_status: 'PROPOSED_PREVIEW_ONLY_NOT_OWNER_RELEASE_APPROVAL', preview_only: true, real_routes_accepted: 0, immutable_shell_modified: false, local_input: {path: `./${pin.artifact.previewPath}`, sha256: pin.artifact.sha256, bytes: artifact.length, byte_budget: INPUT_BUDGET}, combined_preview_bytes: Buffer.byteLength(body) + artifact.length, combined_preview_byte_budget: TOTAL_BUDGET});
  const manifest = {...comp, parent_generation: PARENT, version: 'GJ-04-context-preview-1', cut_at_utc: '2026-11-17T16:00:00.000Z', candidate_status: 'PREVIEW_ONLY_PLANNING_CONTEXT_REAL_ROUTES_WITHHELD', note: 'Partial GJ-04 source context; documentary consent is not built/energised infrastructure or circuit geometry.', acceptance: {full_application_copies_created: 0, immutable_shell_modified: false, owner_release_acceptance: 'NOT_RECORDED_BY_AGENT', real_routes_accepted: 0, repd_etys_joins_created: 0, producer_pin: pin}};
  assert.equal(parent.generation, PARENT);
  return new Map([[`atlas/modules/${G}-grid-journey-official-context.js`, body], [`atlas/${pin.artifact.previewPath}`, artifact], [`atlas/manifests/${G}-composition.json`, JSON.stringify(manifest, null, 1) + '\n'], [`atlas/v/${G}/current.json`, rerootForPreview(deriveCurrent(JSON.stringify(manifest)))], [`atlas/v/${G}/index.html`, read('atlas/index.html')]]);
}
export function build(check = false) {
  const outputs = assemble();
  for (const [p, value] of outputs) { const bytes = Buffer.from(value); if (check) assert.ok(fs.readFileSync(path.join(ROOT, p)).equals(bytes), `Rebuild drift: ${p}`); else { fs.mkdirSync(path.dirname(path.join(ROOT, p)), {recursive: true}); fs.writeFileSync(path.join(ROOT, p), bytes); } }
  return {generation: G, scriptBytes: Buffer.byteLength(outputs.get(`atlas/modules/${G}-grid-journey-official-context.js`)), inputBytes: inputs().artifact.length, proposedScriptBudget: SCRIPT_BUDGET, proposedInputBudget: INPUT_BUDGET, proposedCombinedBudget: TOTAL_BUDGET, files: [...outputs.keys()]};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(build(process.argv.includes('--check'))));
