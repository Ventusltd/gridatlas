/**
 * Loader v2 (tools/scope/payloads/atlas-loader-v2.html) adds one slot type,
 * 'after-cartridge': a verified cartridge as its own script tag straight after
 * a cartridge composed before it. docs/LIGHTNING-CARTRIDGE.md. This proves:
 *
 * 1. Served loaders. atlas/index.html and every atlas/v/<gen>/index.html is
 *    byte-identical to a registered loader (tools/scope/lib.mjs ATLAS_LOADERS)
 *    that supports every slot its own current.json uses.
 * 2. Equivalence. For atlas/current.json and every pinned composition that
 *    uses only 'replace-script', v2 writes byte-for-byte the HTML v1 writes,
 *    pointing at byte-identical cartridge blobs. So moving the live
 *    atlas/index.html from v1 to v2 changes nothing for any of them, and a
 *    rollback to any of them is safe under either loader.
 * 3. Fail-closed. v1 refuses a composition that uses 'after-cartridge' (its
 *    failure screen, nothing written). v2 refuses an after-cartridge entry
 *    whose anchor is missing or composed later, whose bytes do not hash to the
 *    record, whose file is missing, or whose slot is unknown.
 * 4. Order. An after-cartridge entry executes immediately after its anchor;
 *    two entries on one anchor keep cartridge_order.
 *
 * The loaders' own module scripts run verbatim in node:vm
 * (tools/proofs/loader-composition.mjs); only fetch, WebCrypto and blob URLs
 * are platform stubs.
 *
 *   node tools/proofs/loader-equivalence.proof.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compose, ROOT } from './loader-composition.mjs';

process.chdir(ROOT); // tools/scope/lib.mjs resolves from the working directory
const { ATLAS_LOADERS, registeredLoader, slotsUsed } = await import('../scope/lib.mjs');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const v1 = read(ATLAS_LOADERS.v1.payload);
const v2 = read(ATLAS_LOADERS.v2.payload);
assert.notEqual(sha(v1), sha(v2), 'v1 and v2 payloads must differ');
for (const marker of ['crypto.subtle.digest', 'cartridge_order', 'replace-script', 'after-cartridge', 'document.write']) {
  assert.ok(v2.includes(marker), `loader v2 missing ${marker}`);
}

/* ------------------------------------------------ 1 and 2: every route */
const routes = ['atlas/'];
const vDir = path.join(ROOT, 'atlas', 'v');
for (const d of fs.readdirSync(vDir).filter(d => /^\d{12}$/.test(d)).sort()) {
  if (fs.existsSync(path.join(vDir, d, 'current.json'))) routes.push(`atlas/v/${d}/`);
}
const served = { v1: 0, v2: 0 };
let equal = 0, modular = 0;
for (const route of routes) {
  const pointer = JSON.parse(read(`${route}current.json`));
  const slots = slotsUsed(pointer);
  const loader = registeredLoader(path.join(ROOT, route, 'index.html'));
  assert.ok(loader, `${route}index.html is not byte-identical to a registered loader`);
  for (const slot of slots) assert.ok(loader.slots.includes(slot), `${route}index.html is loader ${loader.name}, which does not support ${slot}`);
  served[loader.name] += 1;

  const now = await compose({ loaderHtml: v2, route });
  assert.equal(now.failed, false, `${route}: loader v2 failed: ${now.message} ${now.errors.join(' ')}`);
  const before = await compose({ loaderHtml: v1, route });
  if (slots.every(s => s === 'replace-script')) {
    assert.equal(before.failed, false, `${route}: loader v1 failed: ${before.message}`);
    assert.equal(now.html, before.html, `${route}: v2 composes different HTML from v1`);
    assert.deepEqual(now.scripts.map(s => [s.id, sha(s.source)]), before.scripts.map(s => [s.id, sha(s.source)]), `${route}: cartridge blobs differ`);
    equal += 1;
  } else {
    assert.equal(before.failed, true, `${route}: loader v1 must refuse a slot it does not know`);
    assert.match(before.message, /unsupported cartridge slot/);
    assert.equal(before.html, '', `${route}: v1 must write nothing`);
    modular += 1;
  }
}
console.log(`served loaders: ${routes.length} route(s), v1 ${served.v1}, v2 ${served.v2}; each supports the slots of its own current.json`);
console.log(`equivalence: ${equal} replace-script-only composition(s) compose byte-identically under v1 and v2; ${modular} modular composition(s) refused by v1, as designed`);

/* --------------------------------------- 3 and 4: synthetic compositions */
// Served from memory beside the pinned routes; nothing is written to disk.
const tmpRoute = 'atlas/v/loader-proof/';
const live = JSON.parse(read('atlas/current.json'));
const extras = { [`${tmpRoute}a.js`]: '/* extra A */\n', [`${tmpRoute}b.js`]: '/* extra B */\n' };
const up = (p) => p.replace(/^\.\//, '../../');
const baseCartridges = live.cartridges.map(c => ({ ...c, path: up(c.path) }));
const anchor = live.cartridge_order[live.cartridge_order.length - 1];
const extra = (id, file, after, digest) => ({ id, type: 'script', slot: 'after-cartridge', after, path: `./${file}`,
  sha256: digest ?? sha(Buffer.from(extras[`${tmpRoute}${file}`])) });
const run = (loaderHtml, cartridges, order) => compose({ loaderHtml, route: tmpRoute, files: {
  ...extras,
  [`${tmpRoute}current.json`]: JSON.stringify({ ...live, shell: { ...live.shell, index: up(live.shell.index), base: up(live.shell.base) }, cartridges, cartridge_order: order })
} });

const ok = await run(v2, [...baseCartridges, extra('a', 'a.js', anchor), extra('b', 'b.js', anchor)], [...live.cartridge_order, 'a', 'b']);
assert.equal(ok.failed, false, ok.message);
const ids = ok.scripts.map(s => s.id);
const at = ids.indexOf(anchor);
assert.deepEqual(ids.slice(at, at + 3), [anchor, 'a', 'b'], 'after-cartridge entries follow their anchor in cartridge_order');
assert.match(ok.html, new RegExp(`data-gridatlas-cartridge="${anchor}" src="blob:gridatlas/\\d+"></script>\\n<script data-gridatlas-cartridge="a" src="blob:gridatlas/\\d+"></script>\\n<script data-gridatlas-cartridge="b"`), 'A sits directly after the anchor tag, B directly after A');
assert.equal(ok.scripts.find(s => s.id === 'a').source.toString(), extras[`${tmpRoute}a.js`]);

const refusedByV1 = await run(v1, [...baseCartridges, extra('a', 'a.js', anchor)], [...live.cartridge_order, 'a']);
assert.equal(refusedByV1.failed, true, 'v1 must refuse after-cartridge');
assert.equal(refusedByV1.html, '', 'v1 must write nothing');

const failures = [
  ['anchor absent', [...baseCartridges, extra('a', 'a.js', 'no-such-cartridge')], [...live.cartridge_order, 'a'], /anchor no-such-cartridge is not composed before it/],
  ['anchor later in order', [...baseCartridges, extra('a', 'a.js', anchor)], ['a', ...live.cartridge_order], /is not composed before it/],
  ['digest mismatch', [...baseCartridges, extra('a', 'a.js', anchor, '0'.repeat(64))], [...live.cartridge_order, 'a'], /a: SHA-256 mismatch/],
  ['file missing', [...baseCartridges, { ...extra('a', 'a.js', anchor), path: './missing.js' }], [...live.cartridge_order, 'a'], /a: HTTP 404/],
  ['unknown slot', [...baseCartridges, { ...extra('a', 'a.js', anchor), slot: 'append-body' }], [...live.cartridge_order, 'a'], /a: unsupported cartridge slot/]
];
for (const [name, cartridges, order, pattern] of failures) {
  const r = await run(v2, cartridges, order);
  assert.equal(r.failed, true, `${name}: must fail closed`);
  assert.match(r.message, pattern, `${name}: ${r.message}`);
  assert.equal(r.html, '', `${name}: nothing may be written`);
}
console.log(`after-cartridge: order kept; v1 refuses it; ${failures.length} malformed compositions fail closed under v2 with nothing written`);
console.log('loader registry, equivalence and fail-closed PASS');
