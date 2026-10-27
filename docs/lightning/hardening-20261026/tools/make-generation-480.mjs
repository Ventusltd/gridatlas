#!/usr/bin/env node
/**
 * make-generation.mjs -- cut a NEW immutable candidate generation of the UK lightning implant (issue #32 §8 Step F, §12 E).
 * Author: opus-generation-scaffold (Claude lane). Harness: Node only, no browser. Derived from candidate SHA fda6b10.
 *
 *   node make-generation.mjs --repo <worktree> --module <fixed-module.js> --gen <YYYYMMDDHHMM> --version v9.159
 *                            [--proof-budget <24001..24781>]
 *
 * --proof-budget is OPT-IN. The predecessor proof asserts module <= 24,000 bytes (proof line 23) while the real ceiling is
 * 24,781 (460,000 - 435,218 live sld-sandbox - 1 newline). The unmodified module is 23,973 bytes: 27 bytes of headroom
 * under the proof. Without the flag a module over 24,000 bytes is refused; with it, exactly that one proof line changes.
 *
 * Writes SIX new files inside <worktree> and nothing else (every write uses flag 'wx', so an existing file is never
 * overwritten):
 *   atlas/modules/<GEN>-uk-lightning-overlay.js     the module (restamped 202610261949 -> GEN in its two identity tokens)
 *   atlas/cartridges/<GEN>-sld-sandbox-v9-8.js       LIVE 202609241334 sld-sandbox bytes + "\n" + module
 *   tools/proofs/<GEN>-sld-sandbox.proof.mjs         202610261949 proof with only `const GEN=` changed (module path follows GEN)
 *   atlas/manifests/<GEN>-composition.json           202610261949 manifest re-identified (see deriveComposition)
 *   atlas/v/<GEN>/index.html                         byte copy of atlas/index.html
 *   atlas/v/<GEN>/current.json                       202610261949 route current.json re-identified, ../../ paths
 *
 * Deterministic: output depends only on the inputs (cut_at_utc is derived from GEN, not the clock).
 * Protected files (issue §2) and every 202610261949 file are hashed before and after; any change aborts with exit 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const CAND = '202610261949';            // the pinned, immutable predecessor candidate (never modified)
const LIVE = '202609241334';            // the live generation; its sld-sandbox bytes are the base
const LIVE_SLD = `atlas/cartridges/${LIVE}-sld-sandbox-v9-8.js`;
const LIVE_SLD_SHA = '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca';
const PROOF_BUDGET = 24000;             // asserted by tools/proofs/202610261949-sld-sandbox.proof.mjs:23
const HARD_CEILING = 44781;             // 480,000 - 435,218 - 1 (owner raised the cartridge gate to 480 kB, 27 Oct 2026 02:3x UTC)
const CARTRIDGE_CEILING = 480000;       // tools/scope/loop.mjs:194 (raised from 460 kB by the owner)

const die = (msg) => { console.error(`make-generation: FAIL ${msg}`); process.exit(1); };
const need = (ok, msg) => { if (!ok) die(msg); };

/* ---------- arguments ---------- */
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i], v = process.argv[i + 1];
  need(/^--(repo|module|gen|version|proof-budget)$/.test(k) && v !== undefined, `bad argument ${k}`);
  args[k.slice(2)] = v;
}
for (const k of ['repo', 'module', 'gen', 'version']) need(args[k], `--${k} is required`);
const REPO = path.resolve(args.repo), GEN = args.gen, VERSION = args.version;
need(/^\d{12}$/.test(GEN), `--gen must be YYYYMMDDHHMM, got ${GEN}`);
const cutAt = `${GEN.slice(0, 4)}-${GEN.slice(4, 6)}-${GEN.slice(6, 8)}T${GEN.slice(8, 10)}:${GEN.slice(10, 12)}:00.000Z`;
need(!Number.isNaN(Date.parse(cutAt)) && new Date(cutAt).toISOString() === cutAt, `--gen ${GEN} is not a real UTC minute`);
need(GEN > CAND, `--gen ${GEN} must advance beyond the predecessor candidate ${CAND}`);
need(/^v9\.\d+$/.test(VERSION), `--version must look like v9.N, got ${VERSION}`);
const MODULE_BUDGET = args['proof-budget'] === undefined ? PROOF_BUDGET : Number(args['proof-budget']);
need(Number.isInteger(MODULE_BUDGET) && MODULE_BUDGET >= PROOF_BUDGET && MODULE_BUDGET <= HARD_CEILING,
  `--proof-budget must be an integer in ${PROOF_BUDGET}..${HARD_CEILING}`);

const R = (p) => path.join(REPO, p);
const readBuf = (p) => fs.readFileSync(R(p));
const readText = (p) => fs.readFileSync(R(p), 'utf8');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
/* The loader and lint hash the PUBLISHED (LF) bytes: tools/scope/lib.mjs:195-203 sha256PublishedFile. */
const shaLF = (buf) => sha(Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary'));
const json = (obj) => JSON.stringify(obj, null, 1) + '\n';   // the format of every 202610261949 JSON file (verified)
const countOf = (hay, needle) => hay.split(needle).length - 1;

need(fs.existsSync(R('atlas/current.json')) && fs.existsSync(R('tools/scope/loop.mjs')), `${REPO} is not a gridatlas worktree`);

/* ---------- version: must be unused anywhere in the composition record ---------- */
const versionFiles = [
  'atlas/current.json',
  ...fs.readdirSync(R('atlas/manifests')).filter(n => n.endsWith('-composition.json')).map(n => `atlas/manifests/${n}`),
  ...fs.readdirSync(R('atlas/v')).map(n => `atlas/v/${n}/current.json`).filter(p => fs.existsSync(R(p)))
];
const versionNum = (v) => Number(v.split('.')[1]);
let maxUsed = 0;
for (const p of versionFiles) {
  const text = readText(p);
  need(!new RegExp(`"${VERSION.replace('.', '\\.')}"`).test(text) && !text.includes(`-gridatlas-${VERSION}"`),
    `${VERSION} is already used in ${p}`);
  for (const m of text.matchAll(/"(?:composition_version|version)": "v9\.(\d+)"/g)) maxUsed = Math.max(maxUsed, Number(m[1]));
}
/* v9.157 was burned by the rolled-back V1 (atlas/manifests/202610221600-composition.json); it is caught by the scan. */
need(versionNum(VERSION) > maxUsed, `${VERSION} does not advance beyond the highest recorded version v9.${maxUsed}`);

/* ---------- outputs must not exist (immutability) ---------- */
const OUT = {
  module: `atlas/modules/${GEN}-uk-lightning-overlay.js`,
  cartridge: `atlas/cartridges/${GEN}-sld-sandbox-v9-8.js`,
  proof: `tools/proofs/${GEN}-sld-sandbox.proof.mjs`,
  manifest: `atlas/manifests/${GEN}-composition.json`,
  routeIndex: `atlas/v/${GEN}/index.html`,
  routeCurrent: `atlas/v/${GEN}/current.json`
};
for (const p of Object.values(OUT)) need(!fs.existsSync(R(p)), `${p} already exists; generations are immutable, pick a new --gen`);

/* ---------- protected set: hashed before, re-hashed after ---------- */
const live = JSON.parse(readText('atlas/current.json'));
need(live.generation === LIVE, `atlas/current.json generation is ${live.generation}, expected the live ${LIVE}`);
const liveSldEntry = live.cartridges.find(c => c.id === 'sld-sandbox');
need(liveSldEntry && liveSldEntry.path === `./${LIVE_SLD.slice('atlas/'.length)}`, `live sld-sandbox entry does not name ${LIVE_SLD}`);
const PROTECTED = [
  'atlas/current.json', 'STATE.md', 'atlas/index.html', `atlas/manifests/${LIVE}-composition.json`,
  'releases/current-v5.json', 'state/live-set.json',
  ...live.cartridge_order.map(id => 'atlas/' + live.cartridges.find(c => c.id === id).path.replace(/^\.\//, '')),
  `atlas/modules/${CAND}-uk-lightning-overlay.js`, `atlas/cartridges/${CAND}-sld-sandbox-v9-8.js`,
  `tools/proofs/${CAND}-sld-sandbox.proof.mjs`, `atlas/manifests/${CAND}-composition.json`,
  `atlas/v/${CAND}/index.html`, `atlas/v/${CAND}/current.json`
];
const before = Object.fromEntries(PROTECTED.map(p => [p, sha(readBuf(p))]));

/* ---------- 1. module ---------- */
let moduleText = fs.readFileSync(path.resolve(args.module), 'utf8');
need(Buffer.from(moduleText, 'utf8').equals(fs.readFileSync(path.resolve(args.module))), 'module is not valid UTF-8');
need(!moduleText.includes('\r'), 'module contains CR; supply LF-only bytes (the proof hashes raw bytes, the loader hashes LF)');
const restamped = [];
for (const [from, to] of [[`generation ${CAND}`, `generation ${GEN}`], [`GEN='${CAND}'`, `GEN='${GEN}'`]]) {
  if (moduleText.includes(to)) continue;                            // already stamped by the caller
  need(countOf(moduleText, from) === 1, `module must carry exactly one ${JSON.stringify(from)} or ${JSON.stringify(to)}`);
  moduleText = moduleText.replace(from, to);
  restamped.push(`${from} -> ${to}`);
}
const moduleBuf = Buffer.from(moduleText, 'utf8');
need(moduleBuf.length <= MODULE_BUDGET, `module is ${moduleBuf.length} bytes; the proof budget is ${MODULE_BUDGET}`
  + (MODULE_BUDGET === PROOF_BUDGET ? ` (pass --proof-budget <=${HARD_CEILING} to raise it in the new proof only)` : ''));

/* ---------- 2. cartridge = LIVE bytes + "\n" + module ---------- */
const baseBuf = readBuf(LIVE_SLD);
need(sha(baseBuf) === LIVE_SLD_SHA, `${LIVE_SLD} is not the pinned live bytes`);
need(shaLF(baseBuf) === liveSldEntry.sha256, `${LIVE_SLD} does not match atlas/current.json`);
need(!baseBuf.includes(13), `${LIVE_SLD} contains CR`);
const cartridgeBuf = Buffer.concat([baseBuf, Buffer.from('\n'), moduleBuf]);
need(cartridgeBuf.length <= CARTRIDGE_CEILING, `cartridge is ${cartridgeBuf.length} bytes; ceiling ${CARTRIDGE_CEILING}`);
const cartridgeSha = shaLF(cartridgeBuf);
need(cartridgeSha === sha(cartridgeBuf), 'raw and LF hashes differ (CR present)');

/* ---------- 3. proof: only `const GEN=` changes; the module path is 'atlas/modules/'+GEN+... ---------- */
const candProof = readText(`tools/proofs/${CAND}-sld-sandbox.proof.mjs`);
need(countOf(candProof, CAND) === 1 && countOf(candProof, `const GEN='${CAND}';`) === 1,
  'predecessor proof no longer has exactly one generation literal; re-derive by hand');
need(candProof.includes("'atlas/modules/'+GEN+'-uk-lightning-overlay.js'"), 'predecessor proof module path is not GEN-derived');
let proofText = candProof.replace(`const GEN='${CAND}';`, `const GEN='${GEN}';`);
const BUDGET_LINE = "assert.ok(Buffer.byteLength(module,'utf8')<=24000,'module exceeds the 24,000-byte budget');";
need(countOf(candProof, BUDGET_LINE) === 1, 'predecessor proof budget line changed; re-derive by hand');
if (MODULE_BUDGET !== PROOF_BUDGET) proofText = proofText.replace(BUDGET_LINE,
  `assert.ok(Buffer.byteLength(module,'utf8')<=${MODULE_BUDGET},'module exceeds the ${MODULE_BUDGET.toLocaleString('en-GB')}-byte budget');`);

/* ---------- 4/5. composition manifest and route current.json ---------- */
function deriveComposition(src, prefix, kind) {
  const c = structuredClone(src);
  const oldVersion = c.composition_version;
  need(c.generation === CAND && c.previous_generation === LIVE, `${kind}: predecessor identity changed`);
  c.generation = GEN;
  c.previous_generation = LIVE;                       // the live pointer this candidate would replace
  c.composition_manifest = `${prefix}manifests/${GEN}-composition.json`;
  c.composition_version = VERSION;
  c.composition_id = `${GEN}-gridatlas-${VERSION}`;
  need(c.superseded_generation === LIVE, `${kind}: superseded_generation is not ${LIVE}`);
  c.candidate_predecessor = CAND;                     // honest lineage: the pinned candidate this one supersedes
  if (typeof c.composition_note === 'string' && c.composition_note.startsWith(`${oldVersion}:`))
    c.composition_note = VERSION + c.composition_note.slice(oldVersion.length);
  const sld = c.cartridges.find(x => x.id === 'sld-sandbox');
  need(sld && sld.generation === CAND && sld.derived_from === `${prefix}cartridges/${LIVE}-sld-sandbox-v9-8.js`,
    `${kind}: sld-sandbox entry is not derived from the live ${LIVE} cartridge`);
  sld.generation = GEN;
  sld.version = VERSION;
  sld.path = `${prefix}cartridges/${GEN}-sld-sandbox-v9-8.js`;
  sld.sha256 = cartridgeSha;
  sld.bytes = cartridgeBuf.length;
  sld.uk_lightning.module = `${prefix}modules/${GEN}-uk-lightning-overlay.js`;
  sld.uk_lightning.module_bytes = moduleBuf.length;
  if (kind === 'manifest') {
    need(c.parent_generation === LIVE, 'manifest parent_generation is not the live generation');
    c.version = VERSION;
    c.cut_at_utc = cutAt;
    c.acceptance.proof = `tools/proofs/${GEN}-sld-sandbox.proof.mjs`;
    /* Repository vocabulary for "pending": tools/recompose.mjs:417, tools/rollback.mjs:222. */
    c.acceptance.golden_browser_verification = 'PENDING_THIS_GENERATION';
    need(c.acceptance.full_application_copies_created === 0, 'manifest full_application_copies_created must be 0');
  }
  const text = json(c);
  /* No stale identity may survive: the only 202610261949 left is candidate_predecessor, no old version anywhere. */
  need(countOf(text, CAND) === 1 && text.includes(`"candidate_predecessor": "${CAND}"`), `${kind}: stale ${CAND} remains`);
  need(!text.includes(`"${oldVersion}"`) && !text.includes(`${oldVersion}:`) && !text.includes(`-${oldVersion}"`), `${kind}: stale ${oldVersion} remains`);
  return text;
}
const manifestText = deriveComposition(JSON.parse(readText(`atlas/manifests/${CAND}-composition.json`)), './', 'manifest');
const routeText = deriveComposition(JSON.parse(readText(`atlas/v/${CAND}/current.json`)), '../../', 'route');
const indexBuf = readBuf('atlas/index.html');

/* ---------- write (never overwrite) ---------- */
fs.mkdirSync(R(`atlas/v/${GEN}`));
const write = (p, data) => fs.writeFileSync(R(p), data, {flag: 'wx'});
write(OUT.module, moduleBuf);
write(OUT.cartridge, cartridgeBuf);
write(OUT.proof, proofText);
write(OUT.manifest, manifestText);
write(OUT.routeIndex, indexBuf);
write(OUT.routeCurrent, routeText);

/* ---------- post-checks ---------- */
for (const p of PROTECTED) need(sha(readBuf(p)) === before[p], `protected file changed: ${p}`);
need(readBuf(OUT.routeIndex).equals(readBuf('atlas/index.html')), 'route index.html differs from atlas/index.html');
need(readBuf(OUT.cartridge).equals(Buffer.concat([readBuf(LIVE_SLD), Buffer.from('\n'), readBuf(OUT.module)])), 'cartridge is not live + \\n + module');
const m = JSON.parse(readText(OUT.manifest)), rc = JSON.parse(readText(OUT.routeCurrent));
for (const [label, c, base] of [['manifest', m, R('atlas')], ['route', rc, R(`atlas/v/${GEN}`)]]) {
  for (const id of c.cartridge_order) {
    const e = c.cartridges.find(x => x.id === id);
    need(shaLF(fs.readFileSync(path.resolve(base, e.path))) === e.sha256, `${label}: ${id} sha256 does not match ${e.path}`);
  }
}
need(JSON.stringify(m.cartridge_order) === JSON.stringify(rc.cartridge_order), 'manifest and route cartridge_order differ');

console.log(JSON.stringify({
  result: 'WRITTEN', generation: GEN, version: VERSION, candidate_predecessor: CAND, parent_generation: LIVE,
  module: {path: OUT.module, bytes: moduleBuf.length, sha256: sha(moduleBuf), restamped,
    proof_budget: MODULE_BUDGET, headroom_to_proof_budget: MODULE_BUDGET - moduleBuf.length, headroom_to_24781: HARD_CEILING - moduleBuf.length},
  cartridge: {path: OUT.cartridge, bytes: cartridgeBuf.length, sha256_lf: cartridgeSha, base: LIVE_SLD},
  proof: OUT.proof, manifest: OUT.manifest, route: [OUT.routeIndex, OUT.routeCurrent],
  protected_unchanged: PROTECTED.length
}, null, 1));
