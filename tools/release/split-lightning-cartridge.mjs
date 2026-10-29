#!/usr/bin/env node
/**
 * Cut a MODULAR lightning generation G from a monolithic one R: the same
 * composition, with the UK lightning overlay as its own cartridge
 * ('uk-lightning-overlay', slot after-cartridge, after sld-sandbox) and
 * sld-sandbox back to the original 202609241334 cartridge (435,218 bytes).
 * docs/LIGHTNING-CARTRIDGE.md.
 *
 *   node tools/release/split-lightning-cartridge.mjs --from R --generation G --version vX [--check]
 *
 * R must be a pinned preview whose sld-sandbox is exactly
 *   original 202609241334 bytes + '\n' + atlas/modules/R-uk-lightning-overlay.js
 * (the shape every lightning generation since 202610261949 has). Nothing is
 * rebuilt: the overlay cartridge IS that module file, referenced by path and
 * hash, so no bytes are copied.
 *
 * It writes only G's preview files:
 *   atlas/manifests/G-composition.json
 *   atlas/v/G/current.json   the derived pointer re-rooted to ../../ (tools/release/lib.mjs)
 *   atlas/v/G/index.html     loader v2 (tools/scope/payloads/atlas-loader-v2.html)
 *   tools/proofs/G-uk-lightning-overlay.proof.mjs
 * It never writes atlas/current.json, STATE.md, atlas/index.html or
 * atlas/releases/**, and never commits. previous_generation is the live
 * generation, so tools/release/release-generation.mjs can release G later.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, die as dieWith, sha256, deriveCurrent, rerootForPreview } from './lib.mjs';

const TOOL = 'split-lightning-cartridge';
const die = (m) => dieWith(TOOL, m);
const ORIGINAL = '202609241334';
const ORIGINAL_SHA = '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca';
const OVERLAY = 'uk-lightning-overlay';
const BUDGET = 64781;
const LOADER_V2 = 'tools/scope/payloads/atlas-loader-v2.html';

let args;
try {
  args = parseArgs(process.argv.slice(2), { from: {}, generation: {}, version: {}, check: { bool: true } });
} catch (error) { die(error.message); }
const R = args.from, G = args.generation, VERSION = args.version;
if (!/^\d{12}$/.test(R || '')) die('--from must be the 12-digit monolithic generation');
if (!/^\d{12}$/.test(G || '') || G <= R) die('--generation must be a 12-digit generation later than --from');
if (!/^v\d+\.\d+[a-z]*$/.test(VERSION || '')) die('--version must look like v9.178');

const rel = (...p) => path.posix.join(...p);
const abs = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(abs(p), 'utf8'));
const outputs = [rel('atlas/manifests', `${G}-composition.json`), rel('atlas/v', G, 'current.json'), rel('atlas/v', G, 'index.html'), rel('tools/proofs', `${G}-${OVERLAY}.proof.mjs`)];
for (const o of outputs) if (fs.existsSync(abs(o))) die(`${o} already exists; a generation is cut once`);

const live = readJson('atlas/current.json');
const ref = readJson(`atlas/manifests/${R}-composition.json`);
const original = readJson(`atlas/manifests/${ORIGINAL}-composition.json`).cartridges.find(c => c.id === 'sld-sandbox');
const refSld = ref.cartridges.find(c => c.id === 'sld-sandbox');
if (!refSld || !original) die('sld-sandbox missing from a manifest');
if (ref.cartridge_order.includes(OVERLAY)) die(`${R} is already modular`);
if (original.sha256 !== ORIGINAL_SHA) die(`the ${ORIGINAL} manifest no longer records the original sld-sandbox`);

const moduleRel = `atlas/modules/${R}-uk-lightning-overlay.js`;
const moduleBytes = fs.readFileSync(abs(moduleRel));
const originalBytes = fs.readFileSync(abs(rel('atlas', original.path)));
const refBytes = fs.readFileSync(abs(rel('atlas', refSld.path)));
if (sha256(originalBytes) !== ORIGINAL_SHA) die(`${original.path} is not the original bytes`);
if (sha256(refBytes) !== refSld.sha256) die(`${refSld.path} does not hash to ${R}'s record`);
if (Buffer.compare(refBytes, Buffer.concat([originalBytes, Buffer.from('\n'), moduleBytes])) !== 0) {
  die(`${R}'s sld-sandbox is not original + '\\n' + ${moduleRel}; this tool splits only that shape`);
}
if (moduleBytes.length > BUDGET) die(`${moduleRel} is ${moduleBytes.length} B, over the ${BUDGET}-byte overlay budget`);
console.log(`OK    ${R} sld-sandbox (${refBytes.length} B) = original ${ORIGINAL} (${originalBytes.length} B) + '\\n' + ${moduleRel} (${moduleBytes.length} B)`);

const lightningCaps = refSld.capabilities.filter(x => !original.capabilities.includes(x));
const lightningSources = (refSld.data_sources || []).filter(x => !(original.data_sources || []).some(o => JSON.stringify(o) === JSON.stringify(x)));
const overlay = {
  id: OVERLAY,
  generation: G,
  version: VERSION,
  type: 'script',
  slot: 'after-cartridge',
  after: 'sld-sandbox',
  path: `./modules/${R}-uk-lightning-overlay.js`,
  sha256: sha256(moduleBytes),
  bytes: moduleBytes.length,
  byte_budget: BUDGET,
  module_generation: R,
  parity_reference: R,
  immutable_shell_modified: false,
  capabilities: lightningCaps,
  reads_at_runtime: {
    'window.__GRIDATLAS_MODULES__.menuBar': 'substation-intelligence; polled (MutationObserver + 250 ms) until installed',
    'window.__GRIDATLAS_PIPELINE_LAYERS__': 'substation-intelligence; polled until installed',
    'the MapLibre map': 'polled until present',
    '#scada-ui-container .key-group, #fs-curtain-keys': 'the immutable shell and engine; polled until present',
    'input[data-layer-id] (REPD layers)': 'the engine; read and ticked through its own change path on a tap'
  },
  writes: ['window.__GRIDATLAS_MODULES__.ukLightning'],
  isolation: 'its own script element: a parse or top-level error in the overlay no longer stops sld-sandbox, and an sld-sandbox top-level throw no longer stops the overlay',
  data_sources: lightningSources,
  uk_lightning: { ...refSld.uk_lightning, module: `./modules/${R}-uk-lightning-overlay.js`,
    delta: `its own cartridge (after-cartridge, after sld-sandbox), the module file itself; sld-sandbox is the original ${ORIGINAL} bytes` }
};

const manifest = {
  ...ref,
  generation: G,
  previous_generation: String(live.generation),
  superseded_generation: String(live.generation),
  candidate_predecessor: R,
  composition_manifest: `./manifests/${G}-composition.json`,
  composition_version: VERSION,
  composition_id: `${G}-gridatlas-${VERSION}`,
  cartridge_order: [...ref.cartridge_order, OVERLAY],
  cartridges: [...ref.cartridges.map(c => (c.id === 'sld-sandbox' ? original : c)), overlay],
  composition_note: `${VERSION}: ${R} recomposed, behaviour unchanged. The lightning overlay is its own cartridge (slot after-cartridge, its own script tag directly after sld-sandbox, where the appended module ran), and sld-sandbox is the original ${ORIGINAL} cartridge again (${originalBytes.length} bytes). Served by loader v2.`,
  loader: 'v2',
  parent_generation: String(live.generation),
  version: VERSION,
  cut_at_utc: new Date().toISOString(),
  candidate_status: 'PROTOTYPE_NOT_PUBLISHED',
  note: `Modular split of ${R} by tools/release/split-lightning-cartridge.mjs. atlas/current.json is untouched.`,
  acceptance: { ...ref.acceptance, scope: `Recompose ${R} with the lightning overlay as its own after-cartridge cartridge; sld-sandbox returns to ${ORIGINAL}.`, full_application_copies_created: 0 }
};
const manifestText = `${JSON.stringify(manifest, null, 1)}\n`;
const pointerText = rerootForPreview(deriveCurrent(manifestText));
const proofText = `/** ${G}: the UK lightning overlay as its own cartridge (module ${R}); sld-sandbox is the original ${ORIGINAL}. tools/proofs/lightning-cartridge.mjs */\nimport { proveLightningCartridge } from './lightning-cartridge.mjs';\nawait proveLightningCartridge('${G}');\n`;

if (args.check) { console.log(`CHECK PASS: ${G} can be split from ${R}; nothing written.`); process.exit(0); }
fs.mkdirSync(abs(rel('atlas/v', G)), { recursive: true });
fs.writeFileSync(abs(outputs[0]), manifestText);
fs.writeFileSync(abs(outputs[1]), pointerText);
fs.copyFileSync(abs(LOADER_V2), abs(outputs[2]));
fs.writeFileSync(abs(outputs[3]), proofText);
for (const o of outputs) console.log(`WROTE ${o}  sha256 ${sha256(fs.readFileSync(abs(o))).slice(0, 16)}…`);
console.log(JSON.stringify({ G, from: R, overlay: { path: overlay.path, bytes: overlay.bytes, sha256: overlay.sha256 }, sld: { path: original.path, bytes: originalBytes.length, sha256: original.sha256 } }));
