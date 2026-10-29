/**
 * The proof of a generation that composes the potential-offtakers overlay as its OWN cartridge ('uk-offtakers-overlay',
 * slot after-cartridge, after uk-lightning-overlay). docs/OFFTAKERS-SOURCE.md. Each such generation has a two-line
 * tools/proofs/<G>-uk-offtakers-overlay.proof.mjs that calls this with G.
 *
 *   identity  G, the slot, the anchor (directly after uk-lightning-overlay, last in cartridge_order), every hash;
 *   module    the cartridge IS atlas/modules/<M>-uk-offtakers-overlay.js (no copy), within its 40,000-byte budget, names
 *             generation M, rebuilds from tools/offtakers/src byte for byte, parses, one strict IIFE that is one expression;
 *   contract  static negatives (no engine, menu, layer-control, storage, lightning or place-search contract; no emission
 *             figure; the banned vicinity words) and positives (OFF by default, the pinned SHA-256s, the original measure);
 *   loader    the route's loader is registered and supports the slots, and composes it: the offtakers tag directly after
 *             the uk-lightning-overlay tag, its blob byte-identical to the module, every other script unchanged and in order.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { compose, ROOT } from './loader-composition.mjs';

export const OFFTAKERS_ID = 'uk-offtakers-overlay', ANCHOR = 'uk-lightning-overlay', BUDGET = 40000;
const sha = b => createHash('sha256').update(b).digest('hex');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const BANNED = /\b(viable|feasible|opportunity|offtake agreement|PPA|private wire|supply|capacity available|demand of|consumes|MWh|large user|best|recommended|suitable)\b/i;

export async function proveOfftakersCartridge(G) {
  process.chdir(ROOT);
  const { registeredLoader, slotsUsed, CARTRIDGE_BYTE_BUDGETS } = await import('../scope/lib.mjs');
  const { build } = await import('../offtakers/build.mjs');
  const live = readJson('atlas/current.json'), route = String(live.generation) === G ? 'atlas/' : `atlas/v/${G}/`;
  const current = readJson(`${route}current.json`), at = p => path.resolve(ROOT, route, p);
  assert.equal(String(current.generation), G);
  const order = current.cartridge_order, e = current.cartridges.find(c => c.id === OFFTAKERS_ID);
  assert.ok(e, 'the offtakers cartridge is composed');
  assert.equal(order.filter(id => id === OFFTAKERS_ID).length, 1);
  assert.equal(order.indexOf(OFFTAKERS_ID), order.indexOf(ANCHOR) + 1, 'directly after the lightning overlay');
  assert.equal(order.at(-1), OFFTAKERS_ID, 'last in cartridge_order');
  assert.equal(e.type, 'script'); assert.equal(e.slot, 'after-cartridge'); assert.equal(e.after, ANCHOR); assert.equal(e.generation, G);

  const M = String(e.module_generation || ''); assert.match(M, /^\d{12}$/);
  const modulePath = path.join(ROOT, 'atlas', 'modules', `${M}-uk-offtakers-overlay.js`);
  assert.equal(at(e.path), modulePath, 'the cartridge path is the module itself');
  const module = fs.readFileSync(modulePath), text = module.toString('utf8');
  assert.equal(sha(module), e.sha256); assert.equal(module.length, e.bytes);
  assert.ok(module.length <= BUDGET && module.length <= CARTRIDGE_BYTE_BUDGETS[OFFTAKERS_ID], `${module.length} B over the ${BUDGET}-byte budget`);
  assert.ok(text.startsWith(`/* uk-offtakers-overlay, generation ${M} (UTC).`), 'header names the generation');
  assert.equal(build(M), text, 'rebuilds from tools/offtakers/src byte for byte');
  new vm.Script(text, { filename: modulePath });
  const body = text.replace(/^(\s*\/\*[\s\S]*?\*\/)*\s*/, '');
  assert.ok(body.startsWith("(()=>{'use strict';") && /\}\)\(\);\s*$/.test(body), 'one strict arrow IIFE');
  assert.equal((text.match(/\(\(\)=>\{'use strict'/g) || []).length, 1);
  new vm.Script(`(${body.trim().replace(/;\s*$/, '')}\n)`, { filename: modulePath + '#single-expression' });

  assert.equal(/ukConfig|initVentusMap|window\.fetch|data-layer-id|data-pn-layer|data-gridatlas-layer|lbl-|prepend\(|name=["']bm|<style|createElement\(['"]style|localStorage|sessionStorage|document\.cookie|ukLightning|gridatlas-lightning|__GRIDATLAS_PLACE_SEARCH__/.test(text), false, 'touches another contract');
  assert.equal(/tCO2e|emission_tco2e/.test(text), false, 'no emission figure (method unverified)');
  assert.equal(BANNED.test(text.replace("'Not shown here: electricity use, connection terms, consent, viability.'", '')), false, 'banned wording: ' + (text.match(BANNED) || [])[0]);
  for (const needle of ['data-offtakers-control="toggle"', 'scada-ui-container', 'fs-curtain-keys', 'NS.ukOfftakers=Object.freeze(', "on:false", 'nearestSubstations', 'XMLHttpRequest', 'SHA-256',
    'b8973334303709067ef1408b6ff971d323a876ef', '9d603ac9a7dd5b831b94c01b1e25b4f0a434e299489a680d9b4461ce5f1a63f3', 'c4b3fff1c1da07cf1638e3f1d619ac70ec36be9093a9ca1512329a78ec713919',
    'a686a2e00253bbf30c9f5262439bc2332524e8d5cb34481529c6a711c73acab4', 'A listing is not electricity demand', 'Vicinity only', 'not a cable route', 'address not in register'])
    assert.ok(text.includes(needle), 'module must contain ' + JSON.stringify(needle));

  const loader = registeredLoader(path.join(ROOT, route, 'index.html'));
  assert.ok(loader, `${route}index.html is not a registered loader`);
  for (const slot of slotsUsed(current)) assert.ok(loader.slots.includes(slot), `${loader.name} does not support ${slot}`);
  const g = await compose({ loaderHtml: fs.readFileSync(path.join(ROOT, route, 'index.html'), 'utf8'), route });
  assert.equal(g.failed, false, `${route}: ${g.message} ${g.errors.join(' ')}`);
  const ids = g.scripts.map(s => s.id), k = ids.indexOf(ANCHOR);
  assert.equal(ids[k + 1], OFFTAKERS_ID, 'the offtakers script runs directly after the lightning overlay');
  assert.equal(sha(g.scripts[k + 1].source), e.sha256, 'composed blob == module');
  const tagL = g.html.match(/<script data-gridatlas-cartridge="uk-lightning-overlay" src="blob:gridatlas\/\d+"><\/script>/)[0];
  const tagO = g.html.match(/\n<script data-gridatlas-cartridge="uk-offtakers-overlay" src="blob:gridatlas\/\d+"><\/script>/g);
  assert.equal(tagO?.length, 1); assert.ok(g.html.includes(tagL + tagO[0]), 'tag directly after the lightning tag');
  for (const c of current.cartridges.filter(c => c.id !== OFFTAKERS_ID)) {
    const s = g.scripts.find(x => x.id === c.id); assert.ok(s, c.id + ' composed'); assert.equal(sha(s.source), c.sha256, c.id + ' unchanged');
  }
  console.log(`${G} uk-offtakers-overlay: atlas/modules/${M}-uk-offtakers-overlay.js (${module.length} B <= ${BUDGET}), rebuilt from source; after ${ANCHOR}; loader ${loader.name}; ${ids.length} scripts composed, every other cartridge unchanged. PASS`);
}
