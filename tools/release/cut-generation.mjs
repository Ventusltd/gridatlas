#!/usr/bin/env node
/**
 * Step 1 of the delivery flow: cut a new immutable candidate generation G of
 * the UK lightning line (the sld-sandbox cartridge with the overlay module
 * appended), from a predecessor candidate P that is already on main.
 *
 *   node tools/release/cut-generation.mjs --gen G --version v9.N --module FILE
 *        [--from P] [--edits FILE.json] [--proof FILE] [--progress FILE --progress-name NAME]
 *        [--report FILE]
 *
 * This is the make-generation.mjs every build lane copied and edited by hand
 * (opus-generation-scaffold, then L, L3, M, M2, M3, M4), with the per-build
 * constants turned into inputs: P, the live pointer and the original
 * sld-sandbox base are read from the repository, and everything a build adds
 * to the composition record comes from --edits.
 *
 * PRE-CONDITIONS (any failure stops before a byte is written)
 *   - run from a clean worktree of main (or a branch off it);
 *   - P has a committed manifest and atlas/v/P/ route, and P's cartridge is
 *     exactly <base sld-sandbox bytes> + "\n" + P's module;
 *   - G is a real UTC minute later than P and later than live; --version is
 *     unused anywhere in the composition record and above every recorded one;
 *   - none of G's files exist (generations are immutable);
 *   - the module is UTF-8, LF only, and the cartridge stays under the ceiling
 *     recorded in tools/scope/loop.mjs.
 *
 * WRITES (flag 'wx': never overwrites)
 *   atlas/modules/G-uk-lightning-overlay.js    the module (P's two identity tokens restamped to G)
 *   atlas/cartridges/G-sld-sandbox-v9-8.js     base bytes + "\n" + module
 *   tools/proofs/G-sld-sandbox.proof.mjs       P's proof with only `const GEN=` changed, or --proof
 *   atlas/manifests/G-composition.json         P's manifest re-identified, then --edits
 *   atlas/v/G/index.html                       byte copy of atlas/index.html
 *   atlas/v/G/current.json                     P's route re-identified, then --edits
 *   docs/lightning/CANDIDATE-G-NAME-progress.md   only with --progress (the 7th, optional file)
 *
 * --edits FILE.json (all keys optional):
 *   { "sld_sandbox": <RFC 7396 merge patch on the sld-sandbox cartridge entry>,
 *     "composition_note_replace": [["exact old text", "new text"], ...],
 *     "acceptance_scope_append": "text appended (after one space) to the manifest's acceptance.scope" }
 *
 * POST-CONDITIONS (checked; a failure exits 1 and names the file)
 *   - every protected file (pointer, STATE.md, loader, P's and live's files) is byte-unchanged;
 *   - atlas/v/G/current.json is exactly the pointer the release will write, re-rooted to ../../
 *     (release-generation.mjs refuses otherwise, so this is caught at the cut, not at release);
 *   - every cartridge either composition names hashes to its recorded sha256;
 *   - no stale P identity or old version is left, apart from candidate_predecessor.
 *
 * It never commits; publish-preview.mjs (step 2) does.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, sha256, deriveCurrent, rerootForPreview } from './lib.mjs';
import { generationFiles, PROGRESS_DOC, STAMP, writeJson } from './flow-lib.mjs';

const TOOL = 'cut-generation';
const die = (m) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(1); };
const need = (ok, m) => { if (!ok) die(m); };

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    gen: {}, version: {}, module: {}, from: {}, edits: {}, proof: {}, progress: {}, 'progress-name': {}, report: {}
  });
} catch (error) { die(error.message); }
for (const k of ['gen', 'version', 'module']) need(args[k], `--${k} is required`);
need(!args.progress === !args['progress-name'], '--progress and --progress-name go together');
if (args['progress-name']) need(/^[A-Za-z0-9._-]+$/.test(args['progress-name']), '--progress-name must be [A-Za-z0-9._-]+');

const G = args.gen;
const VERSION = args.version;
need(STAMP.test(G), `--gen must be YYYYMMDDHHMM, got ${G}`);
const cutAt = `${G.slice(0, 4)}-${G.slice(4, 6)}-${G.slice(6, 8)}T${G.slice(8, 10)}:${G.slice(10, 12)}:00.000Z`;
need(!Number.isNaN(Date.parse(cutAt)) && new Date(cutAt).toISOString() === cutAt, `--gen ${G} is not a real UTC minute`);
need(/^v9\.\d+$/.test(VERSION), `--version must look like v9.N, got ${VERSION}`);

const R = (p) => path.join(ROOT, p);
const has = (p) => fs.existsSync(R(p));
const buf = (p) => fs.readFileSync(R(p));
const text = (p) => fs.readFileSync(R(p), 'utf8');
const json = (o) => `${JSON.stringify(o, null, 1)}\n`;
const count = (hay, needle) => hay.split(needle).length - 1;
const shaLF = (b) => sha256(Buffer.from(b.toString('binary').replace(/\r\n/g, '\n'), 'binary'));
const sldOf = (c) => c.cartridges.find(x => x.id === 'sld-sandbox');

/* ------------------------------------------------------------ the record */
const live = JSON.parse(text('atlas/current.json'));
const LIVE = String(live.generation);
const pinned = fs.readdirSync(R('atlas/v')).filter(n => STAMP.test(n) && has(`atlas/v/${n}/current.json`)).sort();
const isLine = (g) => has(`atlas/manifests/${g}-composition.json`) && has(`atlas/modules/${g}-uk-lightning-overlay.js`)
  && !/"REJECTED"|candidate_status": "REJECTED/.test(text(`atlas/manifests/${g}-composition.json`));
const P = args.from || [...pinned].reverse().find(isLine);
need(P && STAMP.test(P), 'no predecessor: pass --from P');
need(isLine(P), `${P} is not a published lightning-line candidate (manifest, module and route required, not REJECTED)`);
need(G > P && G > LIVE, `--gen ${G} must be later than the predecessor ${P} and live ${LIVE}`);
console.log(`predecessor ${P}; live ${LIVE}; new ${G} ${VERSION}`);

const versionFiles = ['atlas/current.json',
  ...fs.readdirSync(R('atlas/manifests')).filter(n => n.endsWith('-composition.json')).map(n => `atlas/manifests/${n}`),
  ...pinned.map(n => `atlas/v/${n}/current.json`)];
let maxUsed = 0;
for (const p of versionFiles) {
  const t = text(p);
  need(!t.includes(`"${VERSION}"`) && !t.includes(`-gridatlas-${VERSION}"`), `${VERSION} is already used in ${p}`);
  for (const m of t.matchAll(/"(?:composition_version|version)": "v9\.(\d+)"/g)) maxUsed = Math.max(maxUsed, Number(m[1]));
}
need(Number(VERSION.split('.')[1]) > maxUsed, `${VERSION} does not advance beyond the highest recorded version v9.${maxUsed}`);

const OUT = generationFiles(G);
if (args.progress) OUT.progress = PROGRESS_DOC(G, args['progress-name']);
for (const p of Object.values(OUT)) need(!has(p), `${p} already exists; generations are immutable, pick a new --gen`);
need(!has(`atlas/v/${G}`), `atlas/v/${G} already exists`);

/* ------------------------------------------------------- lineage of P */
const PF = generationFiles(P);
const pManifest = JSON.parse(text(PF.manifest));
const pRoute = JSON.parse(text(PF.routeCurrent));
const pSld = sldOf(pManifest);
need(pManifest.generation === P && pSld?.generation === P && pSld.uk_lightning, `${PF.manifest} does not cut an sld-sandbox + uk_lightning cartridge at ${P}`);
const baseMatch = /^\.\/cartridges\/(\d{12})-sld-sandbox-v9-8\.js$/.exec(pSld.derived_from || '');
need(baseMatch, `${P} sld-sandbox has no derived_from base cartridge`);
const BASE_REL = `atlas/cartridges/${baseMatch[1]}-sld-sandbox-v9-8.js`;
const baseBuf = buf(BASE_REL);
need(!baseBuf.includes(13), `${BASE_REL} contains CR`);
const lineOk = (g) => buf(`atlas/cartridges/${g}-sld-sandbox-v9-8.js`)
  .equals(Buffer.concat([baseBuf, Buffer.from('\n'), buf(`atlas/modules/${g}-uk-lightning-overlay.js`)]));
need(lineOk(P), `${P} cartridge is not ${BASE_REL} + "\\n" + its module`);
const liveSld = sldOf(live);
const liveIsLine = has(`atlas/modules/${LIVE}-uk-lightning-overlay.js`);
if (liveIsLine) need(lineOk(LIVE), `live ${LIVE} cartridge is not the same base + its module`);
need(shaLF(buf(`atlas/${liveSld.path.replace(/^\.\//, '')}`)) === liveSld.sha256, 'live sld-sandbox does not match atlas/current.json');

const PROTECTED = ['atlas/current.json', 'STATE.md', 'atlas/index.html', BASE_REL,
  ...Object.values(PF),
  ...(liveIsLine ? Object.values(generationFiles(LIVE)).filter(has) : []),
  ...live.cartridge_order.map(id => `atlas/${live.cartridges.find(c => c.id === id).path.replace(/^\.\//, '')}`)];
const before = Object.fromEntries([...new Set(PROTECTED)].map(p => [p, sha256(buf(p))]));

/* ----------------------------------------------------------- 1. module */
const moduleIn = fs.readFileSync(path.resolve(args.module));
let moduleText = moduleIn.toString('utf8');
need(Buffer.from(moduleText, 'utf8').equals(moduleIn), 'module is not valid UTF-8');
need(!moduleText.includes('\r'), 'module contains CR; supply LF-only bytes');
const restamped = [];
for (const [from, to] of [[`generation ${P}`, `generation ${G}`], [`GEN='${P}'`, `GEN='${G}'`]]) {
  if (moduleText.includes(to)) continue;
  if (count(moduleText, from) === 0) continue;
  need(count(moduleText, from) === 1, `module carries ${JSON.stringify(from)} more than once`);
  moduleText = moduleText.replace(from, to);
  restamped.push(`${from} -> ${to}`);
}
need(!new RegExp(`GEN='(?!${G})\\d{12}'`).test(moduleText), 'module identity GEN= names another generation');
const moduleBuf = Buffer.from(moduleText, 'utf8');

/* ---------------------------------------------------------- 2. cartridge */
const ceilingMatch = /size <= (\d{3})_000/.exec(text('tools/scope/loop.mjs'));
need(ceilingMatch, 'cannot read the recorded cartridge ceiling from tools/scope/loop.mjs');
const CEILING = Number(ceilingMatch[1]) * 1000;
const cartridgeBuf = Buffer.concat([baseBuf, Buffer.from('\n'), moduleBuf]);
need(cartridgeBuf.length <= CEILING, `cartridge is ${cartridgeBuf.length} bytes; the recorded ceiling is ${CEILING}`);
const cartridgeSha = shaLF(cartridgeBuf);

/* -------------------------------------------------------------- 3. proof */
let proofText;
if (args.proof) {
  proofText = fs.readFileSync(path.resolve(args.proof), 'utf8');
  need(count(proofText, `const GEN='${G}';`) === 1, `--proof must declare const GEN='${G}'; exactly once`);
} else {
  const pProof = text(PF.proof);
  need(count(pProof, P) === 1 && count(pProof, `const GEN='${P}';`) === 1, `${PF.proof} does not carry exactly one const GEN='${P}'; pass --proof`);
  need(pProof.includes("'atlas/modules/'+GEN+'-uk-lightning-overlay.js'"), `${PF.proof} module path is not GEN-derived; pass --proof`);
  proofText = pProof.replace(`const GEN='${P}';`, `const GEN='${G}';`);
}

/* ---------------------------------------------- 4/5. manifest and route */
const edits = args.edits ? JSON.parse(fs.readFileSync(path.resolve(args.edits), 'utf8')) : {};
for (const k of Object.keys(edits)) need(['sld_sandbox', 'composition_note_replace', 'acceptance_scope_append'].includes(k), `--edits: unknown key ${k}`);

function mergePatch(target, patch) {               // RFC 7396
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = (target && typeof target === 'object' && !Array.isArray(target)) ? target : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]; else out[k] = mergePatch(out[k], v);
  }
  return out;
}

function derive(src, prefix, kind) {
  const c = structuredClone(src);
  const oldVersion = c.composition_version;
  need(c.generation === P, `${kind}: ${P} identity changed`);
  c.generation = G;
  c.previous_generation = LIVE;
  c.superseded_generation = LIVE;
  c.candidate_predecessor = P;
  c.composition_manifest = `${prefix}manifests/${G}-composition.json`;
  c.composition_version = VERSION;
  c.composition_id = `${G}-gridatlas-${VERSION}`;
  if (typeof c.composition_note === 'string' && c.composition_note.startsWith(`${oldVersion}:`))
    c.composition_note = VERSION + c.composition_note.slice(oldVersion.length);
  for (const [a, b] of edits.composition_note_replace || []) {
    need(count(c.composition_note, a) === 1, `${kind}: composition_note_replace anchor not found exactly once: ${a.slice(0, 60)}`);
    c.composition_note = c.composition_note.replace(a, b);
  }
  const sld = sldOf(c);
  need(sld.derived_from === `${prefix}cartridges/${baseMatch[1]}-sld-sandbox-v9-8.js`, `${kind}: sld-sandbox derived_from changed`);
  Object.assign(sld, { generation: G, version: VERSION, path: `${prefix}cartridges/${G}-sld-sandbox-v9-8.js`, sha256: cartridgeSha, bytes: cartridgeBuf.length });
  sld.uk_lightning.module = `${prefix}modules/${G}-uk-lightning-overlay.js`;
  sld.uk_lightning.module_bytes = moduleBuf.length;
  if (edits.sld_sandbox) {
    for (const k of ['id', 'generation', 'version', 'path', 'sha256', 'bytes', 'derived_from'])
      need(!(k in edits.sld_sandbox), `--edits sld_sandbox may not set ${k}`);
    mergePatch(sld, structuredClone(edits.sld_sandbox));
  }
  if (kind === 'manifest') {
    c.parent_generation = LIVE;
    if (edits.acceptance_scope_append) c.acceptance.scope += ` ${edits.acceptance_scope_append}`;
    c.version = VERSION;
    c.cut_at_utc = cutAt;
    c.acceptance.proof = OUT.proof;
    c.acceptance.golden_browser_verification = 'PENDING_THIS_GENERATION';
    need(c.acceptance.full_application_copies_created === 0, 'manifest full_application_copies_created must be 0');
    delete c.candidate_status;
  }
  const out = json(c);
  need(count(out, `"${P}"`) === 1 && out.includes(`"candidate_predecessor": "${P}"`), `${kind}: a stale "${P}" identity remains`);
  need(!out.includes(`"${oldVersion}"`) && !out.includes(`-${oldVersion}"`), `${kind}: stale ${oldVersion} remains`);
  return out;
}
const manifestText = derive(pManifest, './', 'manifest');
const routeText = derive(pRoute, '../../', 'route');
need(routeText === rerootForPreview(deriveCurrent(manifestText)),
  `atlas/v/${G}/current.json would not equal the derived pointer re-rooted to ../../ (P's route and manifest disagree, or --edits differ between them)`);

/* ---------------------------------------------------------------- write */
fs.mkdirSync(R(`atlas/v/${G}`));
const write = (p, data) => fs.writeFileSync(R(p), data, { flag: 'wx' });
write(OUT.module, moduleBuf);
write(OUT.cartridge, cartridgeBuf);
write(OUT.proof, proofText);
write(OUT.manifest, manifestText);
write(OUT.routeIndex, buf('atlas/index.html'));
write(OUT.routeCurrent, routeText);
if (OUT.progress) write(OUT.progress, fs.readFileSync(path.resolve(args.progress)));

/* ----------------------------------------------------------- post-checks */
for (const [p, h] of Object.entries(before)) need(sha256(buf(p)) === h, `protected file changed: ${p}`);
need(buf(OUT.routeIndex).equals(buf('atlas/index.html')), 'route index.html differs from atlas/index.html');
for (const [label, c, base] of [['manifest', JSON.parse(manifestText), R('atlas')], ['route', JSON.parse(routeText), R(`atlas/v/${G}`)]]) {
  for (const id of c.cartridge_order) {
    const e = c.cartridges.find(x => x.id === id);
    need(shaLF(fs.readFileSync(path.resolve(base, e.path))) === e.sha256, `${label}: ${id} sha256 does not match ${e.path}`);
  }
}

const report = {
  result: 'WRITTEN', generation: G, version: VERSION, candidate_predecessor: P, live: LIVE, base: BASE_REL,
  module: { path: OUT.module, bytes: moduleBuf.length, sha256: sha256(moduleBuf), restamped },
  cartridge: { path: OUT.cartridge, bytes: cartridgeBuf.length, sha256_lf: cartridgeSha, ceiling: CEILING },
  proof: { path: OUT.proof, from: args.proof ? path.resolve(args.proof) : PF.proof },
  files: Object.values(OUT).map(p => ({ path: p, sha256: sha256(buf(p)), bytes: buf(p).length })),
  protected_unchanged: Object.keys(before).length,
  next: `node ${OUT.proof} && node tools/release/publish-preview.mjs --generation ${G}`
};
if (args.report) writeJson(args.report, report);
console.log(JSON.stringify(report, null, 1));
