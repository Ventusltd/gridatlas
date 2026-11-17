import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {build, ROOT, G, PARENT, BUDGET} from '../journey/build.mjs';
import {registeredLoaderOf} from '../release/lib.mjs';
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const result = build(true);
const current = JSON.parse(read(`atlas/v/${G}/current.json`));
const parent = JSON.parse(read(`atlas/v/${PARENT}/current.json`));
assert.deepEqual(current.cartridges.slice(0, -1), parent.cartridges);
assert.deepEqual(current.cartridge_order.slice(0, -1), parent.cartridge_order);
assert.equal(current.cartridges.at(-1).after, 'uk-offtakers-overlay');
assert.equal(current.cartridges.at(-1).real_routes_accepted, 0);
assert.ok(result.cartridgeBytes <= BUDGET && BUDGET < 500000);
assert.equal(registeredLoaderOf(Buffer.from(read(`atlas/v/${G}/index.html`)))?.name, registeredLoaderOf(Buffer.from(read('atlas/index.html')))?.name);
new vm.Script(read(`atlas/modules/${G}-grid-journey-preview.js`));
for (const p of ['atlas/current.json', 'STATE.md', 'atlas/index.html']) {
  const base = execFileSync('git', ['show', `1de35f9eca360a5d80d81542230fef546917f5c5:${p}`], {cwd: ROOT, encoding: 'utf8'}).replace(/\r\n/g, '\n');
  assert.equal(read(p), base, `${p} is protected`);
}
console.log('GJ03 deterministic canonical engine pins, native composition, preview budget, unchanged parent cartridges and protected live files PASS', result);
