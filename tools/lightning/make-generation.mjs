#!/usr/bin/env node
/**
 * make-generation.mjs: cut a NEW immutable candidate generation of the UK lightning overlay from tools/lightning/src.
 * It is the scaffolder the M-series builds used (make-generation-M4.mjs, kept in tools/lightning/lineage/), made
 * generic: the module is built from the source instead of being passed in, and the generation-specific prose is copied
 * from a template generation of the same variant instead of being written into the script. Node built-ins only.
 *
 *   node tools/lightning/make-generation.mjs --gen 202610300900 --version v9.178 --variant dots \
 *        --scope "M5b (202610300900): <what changed, one sentence>" [--label M5b] [--predecessor <gen>] [--template <gen>] [--dry-run]
 *
 *   --predecessor  the candidate this one is built on (manifest candidate_predecessor); default: the newest lightning
 *                  generation in atlas/modules/.
 *   --template     the generation whose proof, manifest and route current.json are re-identified; default: the newest
 *                  generation of the same variant in tools/lightning/generations.json. Its prose (composition_note,
 *                  uk_lightning.*) is copied as is: when the behaviour it describes changes, edit those strings in the
 *                  new manifest AND the new route current.json in the same commit (the proof and the gate check them).
 *   --scope        appended to acceptance.scope of the manifest: what this generation changes.
 *
 * Writes the six generation files with flag 'wx' (an existing file is never overwritten) and adds the generation to
 * tools/lightning/generations.json, dropping from it every listed generation the edited source no longer rebuilds:
 *   atlas/modules/<GEN>-uk-lightning-overlay.js   node tools/lightning/build.mjs output for --variant, stamped <GEN>
 *   atlas/cartridges/<GEN>-sld-sandbox-v9-8.js    the template's base sld-sandbox bytes + "\n" + module
 *   tools/proofs/<GEN>-sld-sandbox.proof.mjs      the template proof with only `const GEN=` changed
 *   atlas/manifests/<GEN>-composition.json        the template manifest re-identified
 *   atlas/v/<GEN>/index.html                      byte copy of atlas/index.html
 *   atlas/v/<GEN>/current.json                    the template route current.json re-identified
 * Deterministic: cut_at_utc is derived from --gen, not the clock. atlas/current.json, STATE.md, atlas/index.html and
 * every file of the live, template and predecessor generations are hashed before and after; any change aborts.
 * It never moves the live pointer: that is tools/release/release-generation.mjs (docs/RELEASE.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assemble, readGenerations, newestModule, GENERATIONS } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULE_CEILING = 64781;     // 500,000 - 435,218 base sld-sandbox bytes - 1 newline (owner, 28 Oct 2026)
const CARTRIDGE_CEILING = 500000; // tools/scope/loop.mjs (raised from 480 kB by the owner, 28 Oct 2026)

const die = msg => { console.error(`make-generation: FAIL ${msg}`); process.exit(1); };
const need = (ok, msg) => { if (!ok) die(msg); };
const args = { 'dry-run': false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--dry-run') { args['dry-run'] = true; continue; }
  need(/^--(gen|version|variant|scope|predecessor|template|label)$/.test(k) && process.argv[i + 1] !== undefined, `bad argument ${k}`);
  args[k.slice(2)] = process.argv[++i];
}
for (const k of ['gen', 'version', 'variant', 'scope']) need(args[k], `--${k} is required`);
const { gen: GEN, version: VERSION, variant: VARIANT } = args, DRY = args['dry-run'];

const R = p => path.join(ROOT, p);
const readBuf = p => fs.readFileSync(R(p));
const readText = p => fs.readFileSync(R(p), 'utf8');
const sha = buf => createHash('sha256').update(buf).digest('hex');
const shaLF = buf => sha(Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary')); // tools/scope/lib.mjs sha256PublishedFile
const json = obj => JSON.stringify(obj, null, 1) + '\n';
const countOf = (hay, needle) => hay.split(needle).length - 1;
const files = g => ({
  module: `atlas/modules/${g}-uk-lightning-overlay.js`, cartridge: `atlas/cartridges/${g}-sld-sandbox-v9-8.js`,
  proof: `tools/proofs/${g}-sld-sandbox.proof.mjs`, manifest: `atlas/manifests/${g}-composition.json`,
  routeIndex: `atlas/v/${g}/index.html`, routeCurrent: `atlas/v/${g}/current.json`
});

/* ---------- arguments ---------- */
const reg = readGenerations();
need(reg.variants.includes(VARIANT), `--variant must be one of ${reg.variants.join(', ')}`);
need(/^\d{12}$/.test(GEN), `--gen must be YYYYMMDDHHMM, got ${GEN}`);
const cutAt = `${GEN.slice(0, 4)}-${GEN.slice(4, 6)}-${GEN.slice(6, 8)}T${GEN.slice(8, 10)}:${GEN.slice(10, 12)}:00.000Z`;
need(!Number.isNaN(Date.parse(cutAt)) && new Date(cutAt).toISOString() === cutAt, `--gen ${GEN} is not a real UTC minute`);
need(/^v9\.\d+$/.test(VERSION), `--version must look like v9.N, got ${VERSION}`);
const PRED = args.predecessor || newestModule();
const sameVariant = Object.keys(reg.generations).filter(g => reg.generations[g].variant === VARIANT).sort();
const TPL = args.template || sameVariant[sameVariant.length - 1];
need(TPL, `no generation of variant ${VARIANT} in generations.json to use as the template; pass --template <gen>`);
need(GEN > PRED && GEN > TPL && GEN > newestModule(), `--gen ${GEN} must advance beyond ${[PRED, TPL, newestModule()].sort().pop()}`);
for (const g of new Set([PRED, TPL])) for (const p of Object.values(files(g))) need(fs.existsSync(R(p)), `${p} missing (generation ${g})`);

/* ---------- version: unused anywhere in the composition record, and advancing ---------- */
const versionFiles = ['atlas/current.json',
  ...fs.readdirSync(R('atlas/manifests')).filter(n => n.endsWith('-composition.json')).map(n => `atlas/manifests/${n}`),
  ...fs.readdirSync(R('atlas/v')).map(n => `atlas/v/${n}/current.json`).filter(p => fs.existsSync(R(p)))];
let maxUsed = 0;
for (const p of versionFiles) {
  const text = readText(p);
  need(!text.includes(`"${VERSION}"`) && !text.includes(`-gridatlas-${VERSION}"`), `${VERSION} is already used in ${p}`);
  for (const m of text.matchAll(/"(?:composition_version|version)": "v9\.(\d+)"/g)) maxUsed = Math.max(maxUsed, Number(m[1]));
}
need(Number(VERSION.split('.')[1]) > maxUsed, `${VERSION} does not advance beyond the highest recorded version v9.${maxUsed}`);

/* ---------- outputs must not exist ---------- */
const OUT = files(GEN);
for (const p of Object.values(OUT)) need(!fs.existsSync(R(p)), `${p} already exists; generations are immutable, pick a new --gen`);
need(!reg.generations[GEN], `${GEN} is already in generations.json`);

/* ---------- protected set ---------- */
const live = JSON.parse(readText('atlas/current.json'));
const LIVE_PTR = String(live.generation);
const PROTECTED = [...new Set(['atlas/current.json', 'STATE.md', 'atlas/index.html',
  ...live.cartridge_order.map(id => 'atlas/' + live.cartridges.find(c => c.id === id).path.replace(/^\.\//, '')),
  ...[PRED, TPL].flatMap(g => Object.values(files(g))),
  ...(fs.existsSync(R(files(LIVE_PTR).module)) ? Object.values(files(LIVE_PTR)).filter(p => fs.existsSync(R(p))) : [])])];
const before = Object.fromEntries(PROTECTED.map(p => [p, sha(readBuf(p))]));

/* ---------- 1. module, from the source ---------- */
const moduleBuf = Buffer.from(assemble({ variant: VARIANT, gen: GEN, variants: reg.variants }), 'utf8');
need(moduleBuf.length <= MODULE_CEILING, `module is ${moduleBuf.length} B; the ceiling is ${MODULE_CEILING} B`);
need(countOf(moduleBuf.toString('utf8'), GEN) === 2, 'the module must carry the generation exactly twice (header and GEN)');

/* ---------- 2. cartridge = base + "\n" + module, the lineage proven on the template and the predecessor ---------- */
const tplManifest = JSON.parse(readText(files(TPL).manifest));
const tplSld = tplManifest.cartridges.find(c => c.id === 'sld-sandbox');
need(tplSld && /^\.\/cartridges\/\d{12}-sld-sandbox-v9-8\.js$/.test(tplSld.derived_from || ''), 'template sld-sandbox entry has no derived_from base');
const BASE = 'atlas/' + tplSld.derived_from.slice(2), baseBuf = readBuf(BASE);
need(!baseBuf.includes(13), `${BASE} contains CR`);
for (const g of new Set([PRED, TPL])) need(readBuf(files(g).cartridge).equals(Buffer.concat([baseBuf, Buffer.from('\n'), readBuf(files(g).module)])),
  `${g} cartridge is not ${BASE} + \\n + its module`);
const cartridgeBuf = Buffer.concat([baseBuf, Buffer.from('\n'), moduleBuf]);
need(cartridgeBuf.length <= CARTRIDGE_CEILING, `cartridge is ${cartridgeBuf.length} B; the ceiling is ${CARTRIDGE_CEILING} B`);
const cartridgeSha = shaLF(cartridgeBuf);
need(cartridgeSha === sha(cartridgeBuf), 'raw and LF hashes differ (CR present)');

/* ---------- 3. proof: only `const GEN=` changes ---------- */
const tplProof = readText(files(TPL).proof);
need(countOf(tplProof, TPL) === 1 && countOf(tplProof, `const GEN='${TPL}';`) === 1, `template proof ${files(TPL).proof} must carry its generation exactly once, as const GEN='${TPL}';`);
const proofText = tplProof.replace(`const GEN='${TPL}';`, `const GEN='${GEN}';`);

/* ---------- 4/5. manifest and route current.json ---------- */
function derive(src, prefix, kind) {
  const c = structuredClone(src), oldVersion = c.composition_version;
  need(c.generation === TPL, `${kind}: template generation is ${c.generation}`);
  c.generation = GEN;
  c.previous_generation = LIVE_PTR;
  c.superseded_generation = LIVE_PTR;
  c.candidate_predecessor = PRED;
  c.composition_manifest = `${prefix}manifests/${GEN}-composition.json`;
  c.composition_version = VERSION;
  c.composition_id = `${GEN}-gridatlas-${VERSION}`;
  if (typeof c.composition_note === 'string' && c.composition_note.startsWith(`${oldVersion}:`)) c.composition_note = VERSION + c.composition_note.slice(oldVersion.length);
  const sld = c.cartridges.find(x => x.id === 'sld-sandbox');
  need(sld && sld.generation === TPL && sld.derived_from === `${prefix}cartridges/${path.basename(BASE)}`, `${kind}: sld-sandbox entry is not the template's`);
  Object.assign(sld, { generation: GEN, version: VERSION, path: `${prefix}cartridges/${GEN}-sld-sandbox-v9-8.js`, sha256: cartridgeSha, bytes: cartridgeBuf.length });
  need(sld.uk_lightning && sld.uk_lightning.module === `${prefix}modules/${TPL}-uk-lightning-overlay.js`, `${kind}: uk_lightning.module is not the template's`);
  sld.uk_lightning.module = `${prefix}modules/${GEN}-uk-lightning-overlay.js`;
  sld.uk_lightning.module_bytes = moduleBuf.length;
  if (kind === 'manifest') {
    c.parent_generation = LIVE_PTR;
    c.version = VERSION;
    c.cut_at_utc = cutAt;
    c.acceptance.scope += ' ' + args.scope;
    c.acceptance.proof = `tools/proofs/${GEN}-sld-sandbox.proof.mjs`;
    c.acceptance.golden_browser_verification = 'PENDING_THIS_GENERATION';
    need(c.acceptance.full_application_copies_created === 0, 'manifest full_application_copies_created must be 0');
  }
  const text = json(c);
  // no stale identity: the template generation survives only as a predecessor or in history prose, its paths and version never
  for (const bad of [`${TPL}-sld-sandbox`, `${TPL}-uk-lightning-overlay`, `${TPL}-composition`, `${TPL}-gridatlas`, `"${oldVersion}"`, `-${oldVersion}"`])
    need(!text.includes(bad), `${kind}: stale ${bad} remains`);
  need(countOf(text, `"${TPL}"`) === (PRED === TPL ? 1 : 0), `${kind}: the template generation remains as an identity value`);
  return text;
}
const manifestText = derive(tplManifest, './', 'manifest');
const routeText = derive(JSON.parse(readText(files(TPL).routeCurrent)), '../../', 'route');
const indexBuf = readBuf('atlas/index.html');

const summary = { result: DRY ? 'DRY-RUN (nothing written)' : 'WRITTEN', generation: GEN, version: VERSION, variant: VARIANT,
  candidate_predecessor: PRED, template: TPL, live: LIVE_PTR, cut_at_utc: cutAt,
  module: { path: OUT.module, bytes: moduleBuf.length, sha256: sha(moduleBuf), spare: MODULE_CEILING - moduleBuf.length },
  cartridge: { path: OUT.cartridge, bytes: cartridgeBuf.length, sha256_lf: cartridgeSha, base: BASE },
  proof: OUT.proof, manifest: OUT.manifest, route: [OUT.routeIndex, OUT.routeCurrent] };
if (DRY) { console.log(JSON.stringify(summary, null, 1)); process.exit(0); }

/* ---------- write (never overwrite) ---------- */
fs.mkdirSync(R(`atlas/v/${GEN}`));
const write = (p, data) => fs.writeFileSync(R(p), data, { flag: 'wx' });
write(OUT.module, moduleBuf);
write(OUT.cartridge, cartridgeBuf);
write(OUT.proof, proofText);
write(OUT.manifest, manifestText);
write(OUT.routeIndex, indexBuf);
write(OUT.routeCurrent, routeText);
// register the new generation; a listed generation the edited source no longer rebuilds is dropped (its source is the
// commit that cut it), so build.mjs --check keeps passing
const regText = JSON.parse(fs.readFileSync(GENERATIONS, 'utf8'));
regText.generations[GEN] = { variant: VARIANT, label: args.label || args.scope.split(/[ :(]/)[0] };
const dropped = Object.keys(regText.generations).filter(g => g !== GEN && !readBuf(files(g).module)
  .equals(Buffer.from(assemble({ variant: regText.generations[g].variant, gen: g, variants: reg.variants }), 'utf8')));
for (const g of dropped) delete regText.generations[g];
fs.writeFileSync(GENERATIONS, json(regText));

/* ---------- post-checks ---------- */
for (const p of PROTECTED) need(sha(readBuf(p)) === before[p], `protected file changed: ${p}`);
need(readBuf(OUT.cartridge).equals(Buffer.concat([baseBuf, Buffer.from('\n'), readBuf(OUT.module)])), 'cartridge is not base + \\n + module');
for (const [label, p, base] of [['manifest', OUT.manifest, R('atlas')], ['route', OUT.routeCurrent, R(`atlas/v/${GEN}`)]]) {
  const c = JSON.parse(readText(p));
  for (const id of c.cartridge_order) {
    const e = c.cartridges.find(x => x.id === id);
    need(shaLF(fs.readFileSync(path.resolve(base, e.path))) === e.sha256, `${label}: ${id} sha256 does not match ${e.path}`);
  }
}
console.log(JSON.stringify({ ...summary, protected_unchanged: PROTECTED.length, generations_json_dropped: dropped }, null, 1));
