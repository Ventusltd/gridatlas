/**
 * The proof of a modular lightning generation: the UK lightning overlay
 * composed as its OWN cartridge ('uk-lightning-overlay', slot after-cartridge,
 * after sld-sandbox), with sld-sandbox back to the original 202609241334
 * bytes. docs/LIGHTNING-CARTRIDGE.md. Each such generation has a two-line
 * tools/proofs/<G>-uk-lightning-overlay.proof.mjs that calls this with G.
 *
 * It asserts, against the composition that names G (atlas/current.json once
 * released, atlas/v/G/current.json until then):
 *
 *   identity   G, the order [..., sld-sandbox, uk-lightning-overlay], the
 *              slot, the anchor, and every hash;
 *   sld        sld-sandbox is the original 202609241334 cartridge, 435,218
 *              bytes, sha256 7812953671d8...; nothing of the overlay is in it;
 *   module     the overlay cartridge IS atlas/modules/<M>-uk-lightning-overlay.js
 *              (no copy), within its 64,781-byte budget, names generation M,
 *              parses, and is one strict IIFE with nothing else at top level,
 *              so it declares no global binding and its strictness does not
 *              depend on the script it used to share;
 *   loader     the route's served loader is registered and supports the slots;
 *   parity     against M's monolithic composition (sld-sandbox = original +
 *              '\n' + the same module), both composed by their own served
 *              loaders in node:vm: the same scripts run in the same order,
 *              sld-sandbox(M) == sld-sandbox(G) + '\n' + overlay(G) byte for
 *              byte, and the composed HTML is identical except for the one
 *              overlay tag directly after the sld-sandbox tag and the
 *              published composition state. That is arrival parity: the
 *              arrival code (sld-sandbox) is byte-identical, at the same place
 *              in the document, before the same overlay bytes.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { compose, ROOT } from './loader-composition.mjs';

export const ORIGINAL_SLD = Object.freeze({
  generation: '202609241334',
  path: 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js',
  sha256: '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca',
  bytes: 435218
});
export const OVERLAY_ID = 'uk-lightning-overlay';
export const OVERLAY_BUDGET = 64781;

const sha = (b) => createHash('sha256').update(b).digest('hex');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** The route ('atlas/' or 'atlas/v/G/') whose current.json composes G. */
export function routeOf(G) {
  const live = readJson('atlas/current.json');
  if (String(live.generation) === G) return 'atlas/';
  return `atlas/v/${G}/`;
}

export async function proveLightningCartridge(G) {
  process.chdir(ROOT); // tools/scope/lib.mjs resolves from the working directory
  const { registeredLoader, slotsUsed, CARTRIDGE_BYTE_BUDGETS } = await import('../scope/lib.mjs');
  const route = routeOf(G);
  const current = readJson(`${route}current.json`);
  const at = (p) => path.resolve(ROOT, route, p);

  /* identity */
  assert.equal(String(current.generation), G, `${route}current.json declares ${current.generation}`);
  const order = current.cartridge_order;
  const byId = new Map(current.cartridges.map(c => [c.id, c]));
  assert.equal(order.indexOf(OVERLAY_ID), order.indexOf('sld-sandbox') + 1, 'the overlay is ordered directly after sld-sandbox');
  assert.equal(order.filter(id => id === OVERLAY_ID).length, 1);
  const sld = byId.get('sld-sandbox');
  const overlay = byId.get(OVERLAY_ID);
  assert.ok(sld && overlay, 'sld-sandbox and the overlay are both composed');
  assert.equal(overlay.type, 'script');
  assert.equal(overlay.slot, 'after-cartridge');
  assert.equal(overlay.after, 'sld-sandbox');
  assert.equal(overlay.generation, G, 'the overlay cartridge is cut at G (run-current finds this proof by it)');

  /* sld: the original cartridge, untouched */
  assert.equal(sld.slot, 'replace-script');
  assert.equal(sld.generation, ORIGINAL_SLD.generation);
  assert.equal(at(sld.path), path.join(ROOT, ORIGINAL_SLD.path), 'sld-sandbox is the original file, not a copy');
  const sldBytes = fs.readFileSync(at(sld.path));
  assert.equal(sha(sldBytes), ORIGINAL_SLD.sha256, 'the original 202609241334 sld-sandbox bytes are unchanged');
  assert.equal(sld.sha256, ORIGINAL_SLD.sha256);
  assert.equal(sldBytes.length, ORIGINAL_SLD.bytes);
  assert.equal(sldBytes.includes('uk-lightning-overlay'), false, 'nothing of the overlay is inside sld-sandbox');

  /* module: the overlay cartridge is the module file itself */
  const M = String(overlay.module_generation || '');
  assert.match(M, /^\d{12}$/, 'module_generation names the module stamp');
  const modulePath = path.join(ROOT, 'atlas', 'modules', `${M}-uk-lightning-overlay.js`);
  assert.equal(at(overlay.path), modulePath, 'the overlay cartridge path is the module itself (no copy)');
  const module = fs.readFileSync(modulePath);
  assert.equal(sha(module), overlay.sha256, 'overlay SHA-256');
  assert.equal(module.length, overlay.bytes, 'overlay bytes');
  assert.ok(module.length <= OVERLAY_BUDGET && module.length <= CARTRIDGE_BYTE_BUDGETS[OVERLAY_ID], `overlay ${module.length} B exceeds the ${OVERLAY_BUDGET}-byte budget`);
  const text = module.toString('utf8');
  assert.ok(text.includes(`generation ${M}`), 'module header names its generation');
  new vm.Script(text, { filename: modulePath });
  const body = text.replace(/^(\s*\/\*[\s\S]*?\*\/)*\s*/, '');
  assert.ok(body.startsWith("(()=>{'use strict';"), 'top level is one strict arrow IIFE');
  assert.ok(/\}\)\(\);\s*$/.test(body), 'and ends with its call');
  assert.equal((text.match(/\(\(\)=>\{'use strict'/g) || []).length, 1, 'exactly one IIFE');
  // Wrapped in parentheses the top level parses only if it is ONE expression:
  // a second statement, or a top-level let/const/function, is a SyntaxError.
  new vm.Script(`(${body.trim().replace(/;\s*$/, '')}\n)`, { filename: `${modulePath}#single-expression` });

  /* loader */
  const loader = registeredLoader(path.join(ROOT, route, 'index.html'));
  assert.ok(loader, `${route}index.html is not a registered loader`);
  for (const slot of slotsUsed(current)) assert.ok(loader.slots.includes(slot), `${route}index.html (${loader.name}) does not support ${slot}`);

  /* parity with the monolithic composition of the same module */
  const R = String(overlay.parity_reference || M);
  const refRoute = `atlas/v/${R}/`;
  const ref = readJson(`${refRoute}current.json`);
  const refSld = ref.cartridges.find(c => c.id === 'sld-sandbox');
  const refLoader = registeredLoader(path.join(ROOT, refRoute, 'index.html'));
  assert.ok(refLoader, `${refRoute}index.html is not a registered loader`);
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const [g0, r] = await Promise.all([
    compose({ loaderHtml: read(path.join(route, 'index.html')), route }),
    compose({ loaderHtml: read(path.join(refRoute, 'index.html')), route: refRoute })
  ]);
  // Further after-cartridge overlays chained after this one (e.g. uk-offtakers-overlay, after uk-lightning-overlay) carry
  // their own proofs; they are taken out here, tag and script, so this parity is about the lightning overlay alone.
  const extra = current.cartridges.filter(c => c.slot === 'after-cartridge' && c.id !== OVERLAY_ID).map(c => c.id);
  const g = { ...g0, scripts: g0.scripts.filter(s => !extra.includes(s.id)),
    html: extra.reduce((h, id) => h.replace(new RegExp(`\\n<script data-gridatlas-cartridge="${id}" src="blob:gridatlas\\/\\d+"><\\/script>`), ''), g0.html) };
  for (const id of extra) assert.equal(g0.scripts.filter(s => s.id === id).length, 1, `${id}: one tag`);
  assert.equal(g.failed, false, `${route}: ${g.message} ${g.errors.join(' ')}`);
  assert.equal(r.failed, false, `${refRoute}: ${r.message} ${r.errors.join(' ')}`);
  const gIds = g.scripts.map(s => s.id), rIds = r.scripts.map(s => s.id);
  const k = rIds.indexOf('sld-sandbox');
  assert.deepEqual(gIds, [...rIds.slice(0, k + 1), OVERLAY_ID, ...rIds.slice(k + 1)], 'the same scripts in the same order, the overlay straight after sld-sandbox');
  for (let i = 0; i < k; i += 1) assert.equal(sha(g.scripts[i].source), sha(r.scripts[i].source), `${rIds[i]} differs from ${R}`);
  const joined = Buffer.concat([g.scripts[k].source, Buffer.from('\n'), g.scripts[k + 1].source]);
  assert.equal(sha(joined), refSld.sha256, `sld-sandbox(${R}) == sld-sandbox(${G}) + '\\n' + overlay(${G}), byte for byte`);
  for (let i = k + 1; i < rIds.length; i += 1) assert.equal(sha(g.scripts[i + 1].source), sha(r.scripts[i].source), `${rIds[i]} differs from ${R}`);
  // HTML: drop the one inserted overlay tag and the published state script;
  // everything else, every blob URL included, is the same document.
  const overlayTag = g.html.match(/\n<script data-gridatlas-cartridge="uk-lightning-overlay" src="blob:gridatlas\/\d+"><\/script>/g);
  assert.equal(overlayTag?.length, 1, 'one overlay tag');
  const sldTag = g.html.match(/<script data-gridatlas-cartridge="sld-sandbox" src="blob:gridatlas\/\d+"><\/script>/)[0];
  assert.ok(g.html.includes(sldTag + overlayTag[0]), 'the overlay tag sits directly after the sld-sandbox tag');
  const state = /<script>window\.__GRIDATLAS_ATLAS__=[^\n]*?<\/script>/;
  const gHtml = g.html.replace(overlayTag[0], '').replace(state, '<STATE>');
  const rHtml = r.html.replace(state, '<STATE>');
  assert.equal(gHtml, rHtml, `the composed document equals ${R}'s apart from the overlay tag and the published state`);
  console.log(`${G} uk-lightning-overlay: sld-sandbox is the original ${ORIGINAL_SLD.generation} (${ORIGINAL_SLD.bytes} B); overlay = atlas/modules/${M}-uk-lightning-overlay.js (${module.length} B <= ${OVERLAY_BUDGET}); loader ${loader.name}; arrival parity with ${R}: ${gIds.length} scripts, sld+'\\n'+overlay == ${R} sld-sandbox, document identical but for the overlay tag. PASS`);
}
