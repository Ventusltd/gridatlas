/**
 * The proof of a generation that composes the potential-offtakers overlay as its OWN cartridge ('uk-offtakers-overlay',
 * slot after-cartridge, after uk-lightning-overlay). docs/OFFTAKERS-SOURCE.md. Each such generation has a two-line
 * tools/proofs/<G>-uk-offtakers-overlay.proof.mjs that calls this with G.
 *
 *   identity  G, the slot, the anchor (directly after uk-lightning-overlay, last in cartridge_order), every hash;
 *   module    the cartridge IS atlas/modules/<M>-uk-offtakers-overlay.js (no copy), within its 40,000-byte budget, names
 *             generation M, rebuilds from tools/offtakers/src byte for byte while listed in generations.json, parses, one strict IIFE that is one expression;
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

export const OFFTAKERS_ID = 'uk-offtakers-overlay', ANCHOR = 'uk-lightning-overlay', BUDGET = 72000; // 40,000 until 202610291044; 72,000 proposed with #73 steps 7-8 (tools/scope/lib.mjs)
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
  // Files this site serves itself (data/...) are declared in site_data_sources: data_sources is read by the data-contract
  // parity proof (202609012214) as Ventusltd product repositories, and a same-site entry there crashed it once G was live.
  // Each one is named by the bytes; a declared SHA-256 is pinned in the bytes and is the hash of the file in this tree.
  if (G > '202610290400') assert.ok(Array.isArray(e.site_data_sources) && e.site_data_sources.length, 'site_data_sources declared');
  for (const d of e.data_sources || []) if (e.site_data_sources) assert.ok(d.repository && d.product, 'data_sources lists Ventusltd product repositories only; same-site files go in site_data_sources');
  for (const d of e.site_data_sources || []) {
    assert.match(d.url, /^https:\/\/ventusltd\.github\.io\/gridatlas\/data\//, 'a same-site data file');
    assert.ok(text.includes(d.url), `the bytes name ${d.url}`);
    if (d.sha256) {
      assert.ok(text.includes(d.sha256), `the bytes pin ${d.id || d.url} by its SHA-256`);
      assert.equal(sha(fs.readFileSync(path.join(ROOT, new URL(d.url).pathname.replace(/^\/gridatlas\//, '')))), d.sha256, `${d.url} in this tree hashes to the pin`);
    }
  }
  // while M is listed in tools/offtakers/generations.json, it must rebuild from the committed source (the PR gate's
  // offtakers-source step checks the same); a generation the source has moved past is pinned by its hash alone
  const regM = (JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/offtakers/generations.json'), 'utf8')).generations || {})[M], listed = !!regM && !regM.historical;
  if (listed) assert.equal(build(M), text, 'rebuilds from tools/offtakers/src byte for byte');
  new vm.Script(text, { filename: modulePath });
  const body = text.replace(/^(\s*\/\*[\s\S]*?\*\/)*\s*/, '');
  assert.ok(body.startsWith("(()=>{'use strict';") && /\}\)\(\);\s*$/.test(body), 'one strict arrow IIFE');
  assert.equal((text.match(/\(\(\)=>\{'use strict'/g) || []).length, 1);
  new vm.Script(`(${body.trim().replace(/;\s*$/, '')}\n)`, { filename: modulePath + '#single-expression' });

  assert.equal(/ukConfig|initVentusMap|window\.fetch|data-layer-id|data-pn-layer|data-gridatlas-layer|lbl-|prepend\(|name=["']bm|<style|createElement\(['"]style|localStorage|sessionStorage|document\.cookie|ukLightning|gridatlas-lightning|__GRIDATLAS_PLACE_SEARCH__/.test(text), false, 'touches another contract');
  assert.equal(/tCO2e|emission_tco2e/.test(text), false, 'no emission figure (method unverified)');
  assert.equal(BANNED.test(text.replace("'Not shown here: electricity use, connection terms, consent, viability.'", '')), false, 'banned wording: ' + (text.match(BANNED) || [])[0]);
  for (const needle of ['data-offtakers-control="toggle"', 'scada-ui-container', 'fs-curtain-keys', 'NS.ukOfftakers=Object.freeze(', "on:false", 'nearestSubstations', 'XMLHttpRequest', 'SHA-256',
    'A listing is not electricity demand', 'Vicinity only', 'not a cable route', 'address not in register', 'not a confirmed demand, contract or connection'])
    assert.ok(text.includes(needle), 'module must contain ' + JSON.stringify(needle));
  /* data: the module's one data URL is a file in this repository, and its pinned SHA-256 matches the committed bytes */
  const du = text.match(/DATA='https:\/\/ventusltd\.github\.io\/gridatlas\/(data\/offtakers_filtered_\d{12}\.geojson)',DSHA='([0-9a-f]{64})'/);
  assert.ok(du, 'one pinned data URL under https://ventusltd.github.io/gridatlas/data/ with its SHA-256');
  assert.equal(sha(fs.readFileSync(path.join(ROOT, du[1]))), du[2], du[1] + ' is committed and matches the pin');
  // the URLs in the bytes: the data file and the two REPD record files of the M5 join, plus (from #73 steps 7-8) only
  // same-site data files declared in site_data_sources with a SHA-256 pinned in the bytes (checked above)
  const pinned = new Set((e.site_data_sources || []).filter(d => d.sha256).map(d => d.url)), urls = text.match(/https:\/\/[^'"`\s)]+/g) || [];
  assert.equal(urls.filter(u => !pinned.has(u) || u === 'https://ventusltd.github.io/gridatlas/' + du[1]).length, 3, 'three URLs besides pinned same-site data files: the data file and the two REPD record files of the M5 join');

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
  console.log(`${G} uk-offtakers-overlay: atlas/modules/${M}-uk-offtakers-overlay.js (${module.length} B <= ${BUDGET}), ${listed ? 'rebuilt from source' : regM && regM.historical ? `historical (source: ${regM.historical})` : 'not listed, not rebuilt'}; after ${ANCHOR}; loader ${loader.name}; ${ids.length} scripts composed, every other cartridge unchanged. PASS`);
}
