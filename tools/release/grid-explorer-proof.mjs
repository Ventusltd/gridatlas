import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {deriveCurrent, rerootForPreview} from './lib.mjs';
import {buildSld} from '../sld/build.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const hash = b => createHash('sha256').update(b).digest('hex');
export async function proveExplorerGeneration(G, id) {
  const manifestText = read(`atlas/manifests/${G}-composition.json`), m = JSON.parse(manifestText);
  const parent = JSON.parse(read(`atlas/manifests/${m.parent_generation}-composition.json`));
  assert.equal(m.generation, G); assert.equal(m.version, m.composition_version);
  for (const field of ['previous_generation', 'superseded_generation', 'candidate_predecessor']) assert.equal(m[field], parent.generation);
  assert.equal(read(`atlas/v/${G}/current.json`), rerootForPreview(deriveCurrent(manifestText)));
  assert.equal(read(`atlas/v/${G}/index.html`), read('atlas/index.html'));
  assert.equal(m.acceptance.full_application_copies_created, 0); assert.equal(m.acceptance.immutable_shell_modified, false);
  assert.equal(m.acceptance.real_connections_inferred, 0);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD:atlas/releases'], {cwd: root, encoding: 'utf8'}).trim(), m.acceptance.immutable_releases_tree);
  assert.deepEqual(fs.readdirSync(path.join(root, `atlas/v/${G}`)).sort(), ['current.json', 'index.html']);
  for (const c of m.cartridges) {
    const source = read('atlas/' + c.path); assert.equal(hash(source), c.sha256, c.id);
    if (String(c.generation) !== G) assert.deepEqual(c, parent.cartridges.find(p => p.id === c.id), `Parent cartridge ${c.id}`);
    if (c.bytes != null) assert.equal(Buffer.byteLength(source), c.bytes, c.id);
  }
  const cartridge = m.cartridges.find(c => c.id === id); assert.ok(cartridge); assert.equal(cartridge.generation, G);
  const source = read('atlas/' + cartridge.path); new vm.Script(source);
  if (id === 'sld-sandbox') {
    assert.equal(buildSld(G).toString('utf8'), source);
    assert.ok(source.includes("'Nearest mapped ' + kind")); assert.ok(source.includes('Details'));
  } else if (id === 'grid-journey-preview') {
    const {assembleModule} = await import('../journey/build.mjs');
    assert.equal(assembleModule({generation: G}).body, source); assert.ok(Buffer.byteLength(source) <= cartridge.byte_budget);
  } else if (id === 'grid-vicinity') {
    const {assemble} = await import('../vicinity/build.mjs');
    assert.equal(assemble({generation: G}).body, source); assert.ok(Buffer.byteLength(source) <= cartridge.byte_budget);
  } else throw new Error('Unknown explorer source builder ' + id);
  console.log(`Explorer ${G} ${id}: source rebuild, parent lineage, preview derivation, immutable releases and budget PASS`);
}
