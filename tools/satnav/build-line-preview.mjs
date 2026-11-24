import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const write = (path, text) => {
  const output = new URL(path, root);
  mkdirSync(new URL('.', output), { recursive: true });
  writeFileSync(output, text);
};
const currentPreview = 'atlas/v/satnav-native-m1/';
const route = 'atlas/v/satnav-line-preview/';
const manifest = JSON.parse(read(currentPreview + 'current.json'));
const oldId = 'satnav-handoff';
const id = 'satnav-practice-line';
const entry = manifest.cartridges.find(cartridge => cartridge.id === oldId);
assert.ok(entry?.preview_only && manifest.cartridge_order.includes(oldId), 'Expected the existing isolated SatNav composition');

// Agent 24's exact Apache-2.0 follower from SatNav PR1.
const follower = read('tools/satnav/line/route-follower.mjs');
const hash = text => createHash('sha256').update(text).digest('hex');
assert.equal(hash(follower), '6b60f8481d5ff72c2b17bb41b61a9c318dbad375974029f2dbefc617a3581c5c');

const module = '202611242248-satnav-practice-line.js';
const source = read('tools/satnav/line/preview.js');
Object.assign(entry, { id, path: '../../modules/' + module, sha256: hash(source), bytes: Buffer.byteLength(source) });
manifest.cartridge_order[manifest.cartridge_order.indexOf(oldId)] = id;
manifest.generation = '202611242248';
manifest.composition_id = 'satnav-practice-line-preview';
manifest.composition_note = 'Isolated practice-line field positioning. Section drawn by the user.';
write('atlas/modules/' + module, source);
write(route + 'index.html', read(currentPreview + 'index.html'));
write(route + 'current.json', JSON.stringify(manifest, null, 1) + '\n');
console.log('Candidate /' + route + ' overlay SHA256 ' + entry.sha256);
