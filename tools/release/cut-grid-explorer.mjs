/** Cut additive source-built explorer candidates. Never moves the live pointer. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {deriveCurrent, rerootForPreview} from './lib.mjs';
import {buildSld} from '../sld/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const hash = b => createHash('sha256').update(b).digest('hex');
const json = p => JSON.parse(read(p));
const write = (p, body) => { const f = path.join(root, p); assert.ok(!fs.existsSync(f), `Refusing historical overwrite ${p}`); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, body); };
const arg = k => { const i = process.argv.indexOf(k); return i < 0 ? undefined : process.argv[i + 1]; };
const G = arg('--generation'), version = arg('--version'), stage = arg('--stage');
assert.ok(/^\d{12}$/.test(G || ''), '--generation YYYYMMDDHHMM required');
assert.ok(/^v9\.\d+$/.test(version || ''), '--version v9.N required');
assert.ok(['native', 'vicinity'].includes(stage), '--stage native|vicinity required');
const cutDate = new Date(`${G.slice(0,4)}-${G.slice(4,6)}-${G.slice(6,8)}T${G.slice(8,10)}:${G.slice(10,12)}:00.000Z`);
assert.ok(Number.isFinite(cutDate.getTime()) && cutDate <= new Date(), 'Generation must be an actual, non-future UTC minute');
const parent = json('atlas/current.json'), P = parent.generation;
assert.ok(G > P, 'Generation must follow live parent');
assert.ok(Number(version.slice(3)) > Math.max(...fs.readdirSync(path.join(root, 'atlas/manifests')).filter(n => n.endsWith('-composition.json')).flatMap(n => {
  const m = json(`atlas/manifests/${n}`); return [m.version, m.composition_version].map(v => /^v9\.(\d+)$/.exec(v || '')?.[1]).filter(Boolean).map(Number);
})), 'Version must exceed every committed candidate');
const composition = structuredClone(parent);
Object.assign(composition, {generation: G, previous_generation: P, superseded_generation: P, candidate_predecessor: P,
  composition_version: version, composition_id: `${G}-gridatlas-${version}`, composition_manifest: `./manifests/${G}-composition.json`,
  composition_note: stage === 'native' ? 'Mobile arrival summary and native Journey/Layers. Synthetic learning journeys labelled; existing real assets retain factual identity.' : 'Vicinity spatial explorer: 1–50 km, voltage context, local user model; source connections are never inferred.'});
const own = [];
if (process.argv.includes('--pipeline-lifecycle')) {
  const {buildSubstation} = await import('../pipeline-lifecycle/build.mjs');
  const bytes = buildSubstation(G), c = composition.cartridges.find(c => c.id === 'substation-intelligence');
  assert.ok(c, 'Substation predecessor required');
  delete c.assembled_from;
  Object.assign(c, {generation: G, version, path: `./cartridges/${G}-substation-intelligence-v9-63.js`, sha256: hash(bytes), bytes: bytes.length,
    source_recipe: 'tools/pipeline-lifecycle/generations.json'});
  c.capabilities = [...c.capabilities, 'pipeline-selection-poll-map-removal-cleanup'];
  write('atlas/' + c.path, bytes); own.push(c.id);
}
const extraSldEdits = stage === 'native' ? 'tools/sld/src/mobile-arrival-card-edits.json' : arg('--sld-edits');
if (extraSldEdits) {
  const registryPath = 'tools/sld/generations.json', registry = json(registryPath), base = registry.generations[P];
  assert.ok(base, 'Native release requires source-built SLD parent');
  const editsPath = `tools/sld/src/${G}-mobile-arrival-edits.json`;
  assert.ok(extraSldEdits.startsWith('tools/sld/src/') && extraSldEdits.endsWith('.json'), 'SLD edits must be a declared local source recipe');
  const edits = [...json(base.edits), ...json(extraSldEdits)];
  write(editsPath, JSON.stringify(edits, null, 2) + '\n');
  let source = read(base.base.path);
  for (const [i, edit] of edits.entries()) {
    assert.equal(source.split(edit.before).length - 1, 1, `Edit ${i} must match exactly once`);
    source = source.replace(edit.before, edit.after);
  }
  const bytes = Buffer.from(base.header + read(base.owner.path) + '\n' + source);
  registry.generations[G] = {...base, edits: editsPath, output_sha256: hash(bytes)};
  fs.writeFileSync(path.join(root, registryPath), JSON.stringify(registry, null, 2) + '\n');
  assert.deepEqual(buildSld(G), bytes);
  const c = composition.cartridges.find(c => c.id === 'sld-sandbox');
  Object.assign(c, {generation: G, version, path: `./cartridges/${G}-sld-sandbox-v9-8.js`, sha256: hash(bytes), bytes: bytes.length});
  c.capabilities = [...c.capabilities, ...(stage === 'native' ? ['mobile-nearest-summary-before-details', '44px-labelled-details-map-controls'] : ['map-removal-observer-cleanup'])];
  write('atlas/' + c.path, bytes); own.push(c.id);
}
if (stage === 'native') {
  const {assembleModule} = await import('../journey/build.mjs');
  const result = assembleModule({generation: G});
  const body = result.body;
  assert.ok(Buffer.byteLength(body) <= 72000, 'Journey module budget');
  const journey = {id: 'grid-journey-preview', generation: G, version, type: 'script', slot: 'after-cartridge', after: 'uk-offtakers-overlay',
    path: `./modules/${G}-grid-journey-preview.js`, sha256: hash(body), bytes: Buffer.byteLength(body), byte_budget: 72000,
    immutable_shell_modified: false, real_routes_accepted: 0,
    capabilities: ['native-maplibre', 'native-layers-launcher', 'explicit-synthetic-learning-cursor', 'manual-reduced-motion', 'removable-lifecycle']};
  composition.cartridge_order.push(journey.id); composition.cartridges.push(journey); own.push(journey.id);
  write('atlas/' + journey.path, body);
} else {
  const {assemble, BUDGET: vicinityBudget} = await import('../vicinity/build.mjs');
  const result = assemble({generation: G});
  const vicinity = {id: 'grid-vicinity', generation: G, version, type: 'script', slot: 'after-cartridge', after: 'grid-journey-preview',
    path: `./modules/${G}-grid-vicinity.js`, sha256: result.sha256, bytes: result.bytes, byte_budget: vicinityBudget,
    immutable_shell_modified: false, capabilities: ['spatial-radius-1-50km', 'source-voltage-context', 'native-layers-launcher', 'validated-origin-intent', 'local-user-model']};
  assert.ok(composition.cartridge_order.includes(vicinity.after), 'Native Journey predecessor required');
  composition.cartridge_order.push(vicinity.id); composition.cartridges.push(vicinity); own.push(vicinity.id);
  write('atlas/' + vicinity.path, result.body);
}
const manifest = {...composition, parent_generation: P, version, cut_at_utc: cutDate.toISOString(),
  candidate_status: 'REVIEW_AND_PUBLIC_ACCEPTANCE_PENDING', note: composition.composition_note,
  acceptance: {full_application_copies_created: 0, immutable_shell_modified: false,
    owner_authorization: 'https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6964495738',
    owner_release_acceptance: 'Session owner authorised overnight release execution; no agent ACCEPT comment manufactured',
    immutable_releases_tree: execFileSync('git', ['rev-parse', 'HEAD:atlas/releases'], {cwd: root, encoding: 'utf8'}).trim(),
    stage, real_connections_inferred: 0}};
const manifestText = JSON.stringify(manifest, null, 1) + '\n';
write(`atlas/manifests/${G}-composition.json`, manifestText);
write(`atlas/v/${G}/current.json`, rerootForPreview(deriveCurrent(manifestText)));
write(`atlas/v/${G}/index.html`, read('atlas/index.html'));
for (const id of own) write(`tools/proofs/${G}-${id}.proof.mjs`, `import {proveExplorerGeneration} from '../release/grid-explorer-proof.mjs';\nawait proveExplorerGeneration('${G}', '${id}');\n`);
console.log(JSON.stringify({generation: G, version, stage, parent: P, own, livePointerChanged: false}));
