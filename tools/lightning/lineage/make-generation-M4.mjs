#!/usr/bin/env node
/**
 * make-generation.mjs -- cut a NEW immutable candidate generation of the UK lightning implant (issue #32 §8 Step F, §12 E).
 * Author: opus-generation-scaffold (Claude lane); reused by L-build/L3-build; M-build adaptation: live is now L3
 * M4-build adaptation: the predecessor candidate is Build M3 (202610282215, merged on main 77fca87), live is still L3; --variant m4
 *   (M3 + the camera fixes; layers as M3) or m4b (owner option: only the listed sites drawn as REPD-styled dots, no Layers
 *   control touched, so the proof's original static negative for data-layer-id / lbl- is restored).
 * M3-build adaptation: the predecessor candidate is Build M2 (202610282100, published on main fa992a6), live is still L3;
 *   the M2 proof already carries the 64,781 B / 500 kB lines, so only GEN changes in the proof.
 * M2-build adaptation (500 kB gate, module cap 64,781 B): the predecessor candidate is Build M (202610281950) while the live pointer stays L3 (202610281340);
 * both lineages are proven (L3 cartridge = BASE + "\n" + L3 module, M cartridge = BASE + "\n" + M module).
 * (atlas/current.json = 202610281340), so CAND = LIVE_PTR = 202610281340 while the cartridge BASE bytes stay the original
 * 202609241334 sld-sandbox (the L3 cartridge is proven to be BASE + "\n" + L3 module before anything is written).
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

const CAND = '202610282215';            // M4-build: predecessor is the candidate Build M3 (not live)
const PREV_CAND = '202610282100';       // M3's own candidate_predecessor (Build M2)
const LIVE_PTR = '202610281340';        // atlas/current.json generation (live since 28 Oct 18:53 UTC)
const LIVE = '202609241334';            // the ORIGINAL sld-sandbox generation; its bytes stay the base
const LIVE_SLD = `atlas/cartridges/${LIVE}-sld-sandbox-v9-8.js`;
const LIVE_SLD_SHA = '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca';
const PROOF_BUDGET = 24000;             // asserted by tools/proofs/202610261949-sld-sandbox.proof.mjs:23
const HARD_CEILING = 64781;             // 500,000 - 435,218 - 1 (owner raised the cartridge gate to 500 kB, 28 Oct 2026 20:51 UTC)
const CARTRIDGE_CEILING = 500000;       // tools/scope/loop.mjs:194 (raised from 480 kB by the owner, 28 Oct 2026)

const die = (msg) => { console.error(`make-generation: FAIL ${msg}`); process.exit(1); };
const need = (ok, msg) => { if (!ok) die(msg); };

/* ---------- arguments ---------- */
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i], v = process.argv[i + 1];
  need(/^--(repo|module|gen|version|proof-budget|variant)$/.test(k) && v !== undefined, `bad argument ${k}`);
  args[k.slice(2)] = v;
}
for (const k of ['repo', 'module', 'gen', 'version']) need(args[k], `--${k} is required`);
const REPO = path.resolve(args.repo), GEN = args.gen, VERSION = args.version, VARIANT = args.variant || 'm4';
need(VARIANT === 'm4' || VARIANT === 'm4b', '--variant must be m4 or m4b');
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
need(live.generation === LIVE_PTR, `atlas/current.json generation is ${live.generation}, expected the live ${LIVE_PTR}`);
const liveSldEntry = live.cartridges.find(c => c.id === 'sld-sandbox');
need(liveSldEntry && liveSldEntry.path === `./cartridges/${LIVE_PTR}-sld-sandbox-v9-8.js` && liveSldEntry.generation === LIVE_PTR, `live sld-sandbox entry does not name the ${LIVE_PTR} cartridge`);
const PROTECTED = [
  'atlas/current.json', 'STATE.md', 'atlas/index.html', `atlas/manifests/${LIVE}-composition.json`, LIVE_SLD,
  'releases/current-v5.json', 'state/live-set.json',
  ...live.cartridge_order.map(id => 'atlas/' + live.cartridges.find(c => c.id === id).path.replace(/^\.\//, '')),
  `atlas/modules/${CAND}-uk-lightning-overlay.js`, `atlas/cartridges/${CAND}-sld-sandbox-v9-8.js`,
  `tools/proofs/${CAND}-sld-sandbox.proof.mjs`, `atlas/manifests/${CAND}-composition.json`,
  `atlas/v/${CAND}/index.html`, `atlas/v/${CAND}/current.json`,
  `atlas/modules/${LIVE_PTR}-uk-lightning-overlay.js`, `atlas/cartridges/${LIVE_PTR}-sld-sandbox-v9-8.js`,
  `tools/proofs/${LIVE_PTR}-sld-sandbox.proof.mjs`, `atlas/manifests/${LIVE_PTR}-composition.json`,
  `atlas/v/${LIVE_PTR}/index.html`, `atlas/v/${LIVE_PTR}/current.json`
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
/* lineage: the live L3 cartridge (sha in atlas/current.json) is exactly BASE + "\n" + the L3 module */
need(shaLF(readBuf(`atlas/cartridges/${LIVE_PTR}-sld-sandbox-v9-8.js`)) === liveSldEntry.sha256, 'live L3 cartridge does not match atlas/current.json');
for (const g of [LIVE_PTR, CAND]) need(readBuf(`atlas/cartridges/${g}-sld-sandbox-v9-8.js`).equals(Buffer.concat([baseBuf, Buffer.from('\n'), readBuf(`atlas/modules/${g}-uk-lightning-overlay.js`)])), `${g} cartridge is not BASE + \\n + its module`);
need(JSON.parse(readText(`atlas/v/${CAND}/current.json`)).cartridges.find(c => c.id === 'sld-sandbox').sha256 === shaLF(readBuf(`atlas/cartridges/${CAND}-sld-sandbox-v9-8.js`)), 'M route current.json does not pin the M cartridge');
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
const BUDGET_64 = "assert.ok(Buffer.byteLength(module,'utf8')<=64781,'module exceeds the 64,781-byte budget');";
const CART_500 = "assert.ok(Buffer.byteLength(source,'utf8')<=500000,'cartridge exceeds the 500 kB ceiling (raised from 480 kB by the owner, 28 Oct 2026)');";
need(countOf(proofText, BUDGET_64) === 1 && countOf(proofText, CART_500) === 1 && MODULE_BUDGET === HARD_CEILING, 'predecessor proof 64,781 B / 500 kB lines changed; re-derive by hand');

/* M4 keeps M3's proof as it is (the module still ticks the REPD layer checkboxes: the narrowed negative and the three
   read-site assertions). M4b names no such control, so its proof restores the original negative (data-layer-id and lbl-
   banned outright) and drops the M3 read-site comment and assertions. */
const NEG_OLD = "const negatives=/ukConfig|initVentusMap|window\\.fetch|data-layer-id|data-pn-layer|data-gridatlas-layer-proxy|data-gridatlas-layer-key|prepend\\(|lbl-|name=[\"']bm|<style|createElement\\(['\"]style|localStorage|sessionStorage|document\\.cookie/;";
const NEG_M3 = "const negatives=/ukConfig|initVentusMap|window\\.fetch|data-pn-layer|data-gridatlas-layer-proxy|data-gridatlas-layer-key|prepend\\(|name=[\"']bm|<style|createElement\\(['\"]style|localStorage|sessionStorage|document\\.cookie/;";
const M3_SITES = ["/* M3: the REPD layer checkboxes", "assert.deepEqual(module.match(/data-layer-id|lbl-/g)", "assert.equal((module.match(/input", "assert.equal(/setAttribute"];
need(countOf(proofText, NEG_M3) === 1 && M3_SITES.every(a => proofText.split('\n').filter(l => l.startsWith(a)).length === 1), 'predecessor (M3) proof negatives changed; re-derive by hand');
if (VARIANT === 'm4b') {
  proofText = proofText.split('\n').filter(l => !M3_SITES.some(a => l.startsWith(a))).join('\n').replace(NEG_M3, NEG_OLD);
  need(countOf(proofText, NEG_OLD) === 1 && !proofText.includes('M3: the REPD layer'), 'm4b proof: original negative not restored');
  need(!/data-layer-id|lbl-/.test(moduleText), 'm4b module names data-layer-id or lbl-');
}

/* ---------- 4/5. composition manifest and route current.json ---------- */
function deriveComposition(src, prefix, kind) {
  const c = structuredClone(src);
  const oldVersion = c.composition_version;
  need(c.generation === CAND && c.previous_generation === LIVE_PTR && c.candidate_predecessor === PREV_CAND, `${kind}: predecessor identity changed`);
  c.generation = GEN;
  c.previous_generation = LIVE_PTR;                   // the live pointer this candidate would replace (L3)
  c.composition_manifest = `${prefix}manifests/${GEN}-composition.json`;
  c.composition_version = VERSION;
  c.composition_id = `${GEN}-gridatlas-${VERSION}`;
  need(c.superseded_generation === LIVE_PTR, `${kind}: superseded_generation is not ${LIVE_PTR}`);
  c.superseded_generation = LIVE_PTR;
  c.candidate_predecessor = CAND;                     // honest lineage: built on candidate M2; it would replace the live L3
  if (typeof c.composition_note === 'string' && c.composition_note.startsWith(`${oldVersion}:`))
    c.composition_note = VERSION + c.composition_note.slice(oldVersion.length);
  for (const [a, b] of (VARIANT === 'm4b' ? NOTE : [])) { need(countOf(c.composition_note, a) === 1, `${kind}: note anchor ${a}`); c.composition_note = c.composition_note.replace(a, b); }
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
  need(sld.uk_lightning.repd_projects === REPD_NOTE, 'repd_projects note changed (M3)');
  need(typeof sld.uk_lightning.transport === 'string' && sld.uk_lightning.transport.includes('same 15 s timeout'), 'transport');
  need(sld.uk_lightning.contract === M3_CONTRACT && sld.uk_lightning.repd_layers === REPD_LAYERS && typeof sld.uk_lightning.repd_source === 'object', 'M3 contract / repd_layers / repd_source changed');
  need(!('camera' in sld.uk_lightning) && !('repd_dots' in sld.uk_lightning), 'camera/repd_dots already present');
  sld.uk_lightning.camera = CAMERA;
  if (VARIANT === 'm4b') { sld.uk_lightning.contract = M2_CONTRACT; delete sld.uk_lightning.repd_layers; sld.uk_lightning.repd_dots = REPD_DOTS; }
  if (kind === 'manifest') {
    need(c.parent_generation === LIVE_PTR, 'manifest parent_generation changed');
    c.parent_generation = LIVE_PTR;                   // verify-candidate: parent is the live generation
    need(c.acceptance.scope.includes('M3 (' + CAND + '):'), 'M3 scope note missing'); c.acceptance.scope += ' ' + SCOPE_NOTE;
    c.version = VERSION;
    c.cut_at_utc = cutAt;
    c.acceptance.proof = `tools/proofs/${GEN}-sld-sandbox.proof.mjs`;
    /* Repository vocabulary for "pending": tools/recompose.mjs:417, tools/rollback.mjs:222. */
    c.acceptance.golden_browser_verification = 'PENDING_THIS_GENERATION';
    need(c.acceptance.full_application_copies_created === 0, 'manifest full_application_copies_created must be 0');
  }
  const text = json(c);
  /* No stale identity may survive: the only 202610261949 left is candidate_predecessor, no old version anywhere. */
  const want = kind === 'manifest' ? 3 : 2;           // LIVE_PTR: previous_generation, superseded_generation (+ parent_generation)
  need(countOf(text, `"${LIVE_PTR}"`) === want && countOf(text, `"${CAND}"`) === 1 && countOf(text, CAND) === (kind === 'manifest' ? 2 : 1) && text.includes(`"candidate_predecessor": "${CAND}"`), `${kind}: stale ${CAND} remains (${countOf(text, CAND)})`);
  need(!text.includes(`"${oldVersion}"`) && !text.includes(`${oldVersion}:`) && !text.includes(`-${oldVersion}"`), `${kind}: stale ${oldVersion} remains`);
  return text;
}
const REPD_NOTE = 'on a flash or cell tap, besides the 5 nearest substations: the 10 nearest REPD project sites within 40 km by straight-line distance (the original link.measure.distanceKm), a site being the projects at one registered point (rows within about 10 m of a nearer row join its site; e.g. solar + battery share one link, one label "<km> km · Battery + Solar <MW> MW" and one card row "<n> projects at this point:" with every project listed beneath), plus any site at exactly the 10th site\'s distance, re-ranked within the card\'s status filter (All / Operational / Consented / Planning; an explicit table of the register\'s four statuses) and technology filter (All / Solar / Wind / BESS / Other), with a summary line (projects within 10 km with their stated MW and how many have no stated capacity, never shown as 0 MW; projects within 40 km; repeated records of one scheme counted once) and an explicit statement when fewer than 10 sites lie within the fixed 40 km search radius, over every distinct, well-formed row of the register the map already holds (10,784 rows, of which 12 are exact duplicates counted once; all 13 technologies; operational, under construction, awaiting construction and application submitted), drawn as dashed orange-to-red links coloured by capacity (the engine REPD glow ramp), labelled "<km> km · <technology> <MW> MW", listed on the card; a row tap stays in the page (a Ctrl, Cmd or Shift click keeps the browser default): the map flies to the project (zoom 12) and draws the 5 nearest substations from it with the original link.measure.nearestSubstations (straight-line; not the declared connection), and ◀ back restores the lightning card, its links and the filter; the row href keeps the original coordinate deep link (longitude, latitude, technology, project, capacity_mw, status) for opening in a new tab; each card carries one polite status region that announces loading, the list and any failure, and focus follows chip, row and back. The register carries no repd_ref, so none is sent. Nearest by distance only: not affected, not struck.';
const REPD_LAYERS = 'while a REPD list is shown, the original REPD layer of each technology in that list (within the card filter; the register tech is the layer id: solar, solar_roof, wind, bess, biomass, tidal, hydrogen, hydro, flywheel, act, geothermal, caes) is switched on exactly as a reader tap would: the #scada-ui-container checkbox is ticked and a bubbling change is dispatched, so the engine\'s own listener syncs the fullscreen-curtain copy and runs handleLayerToggle, and the menu bar syncs its proxy; menuBar.inspect() is unchanged. Only layers the overlay switched on are recorded, and only those are switched off again on close, a tap on empty map, lightning OFF, a period or page change, LATEST, or a new list that no longer needs them; a layer the reader already had on is never touched, and one the reader ticks or unticks meanwhile becomes the reader\'s. Nothing is switched before a tap.';
const REPD_SOURCE = {
  register: 'Renewable Energy Planning Database (REPD), April 2026 (Q1 2026) quarterly extract',
  publisher: 'Department for Energy Security and Net Zero (DESNZ), compiled by Barbour ABI',
  published: '2026-05-06 (gov.uk update history: January 2026 files replaced with April 2026, Q1)',
  upstream_file: 'REPD_publication_Q1_2026.csv',
  licence: 'Open Government Licence v3.0; contains public sector information licensed under the Open Government Licence v3.0',
  served_as: 'partitions/repd_master_v8_oracle.parquet (sha256 a737d00d54dbee0ccb46be07f18277cb1c5c111acefbfda43f3d34ce3d53416c, 10,784 rows) in data-gridatlas manifest 3246dbda, from globalgrid2050 dist/repd_master.json (synced 2026-06-01; operational, under construction, awaiting construction, application submitted only)',
  currency: 'a snapshot: DESNZ has since published July 2026 (Q2, 3 Aug 2026); rows are not refreshed by this module'
};
const M2_CONTRACT = 'no data-layer-id, data-pn-layer, data-gridatlas-layer-proxy, data-gridatlas-layer-key, lbl-* id or name=bm; menuBar.inspect() stays {60,3,63,63,true}';
const M3_CONTRACT = 'creates no data-layer-id, data-pn-layer, data-gridatlas-layer-proxy or data-gridatlas-layer-key control, lbl-* id or name=bm; reads and ticks the original REPD layer checkboxes (input[data-layer-id]) through the engine\'s own change path only while a REPD list is shown (repd_layers); menuBar.inspect() stays {60,3,63,63,true}';
const NOTE = [["the original REPD map layers of the listed technologies are switched on through their own Layers checkboxes while the list is shown, and only those the overlay switched on are switched off again),",
  "only the listed sites are drawn on the map as REPD-styled dots (the engine's own glow and core paint), and the Layers controls are never touched),"]];
const CAMERA = 'a module camera move (tap, row, back, card toggle, cluster zoom, fit) first drops the module\'s pending framing, and the framing queued for the end of a flight runs after the stop that fired moveend and only when the map is not moving, so no camera move ever starts inside another (MapLibre 3.6.2 fires moveend synchronously from stop(); a nested fitBounds left an orphan render frame that froze map redraws after fast row/back cycles, M2R-taps T1); framing tests each end\'s screen pixel against the free area below the search bar and above the card; on a map under 500 px tall with at least 300 px beside the card, the card docks to the right edge and the camera frames the area to its left (M2R-camera fix C)';
const REPD_DOTS = 'while a REPD list is shown, each listed project (and, in the project view, that site\'s projects) is drawn at its site as a dot in the original engine REPD style (ventus-corev8engine.js:1305-1337: the solar and rooftop-solar glow by capacity, the capacity-graded core, every other technology in its own layer colour, stacked in the engine REPD layer order), in the overlay\'s own gridatlas-lightning-neon-p-glow / -p-dot layers (source -pdots, removed with the card); a tap on a dot opens that site\'s project view as its row does; no Layers control, REPD layer or src-repd data is changed. Nothing is drawn before a tap.';
const SCOPE_NOTE = (VARIANT === 'm4b' ? 'M4b (' : 'M4 (') + GEN + '): Build M3 with the camera race fixed (M2R-taps MAJOR T1: no camera move starts inside another; fast row/back cycles no longer freeze map redraws) and M2R-camera fix C (screen-pixel framing; the card docks right on short or landscape maps)'
  + (VARIANT === 'm4b' ? '; owner option M4b: instead of switching on whole REPD layers, only the listed sites are drawn as REPD-styled dots and the Layers controls are never touched' : '; the REPD layers of the listed technologies are switched on as in M3') + '; module cap 64,781 B under the 500 kB cartridge gate.';
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
  result: 'WRITTEN', generation: GEN, version: VERSION, candidate_predecessor: CAND, parent_generation: LIVE_PTR,
  module: {path: OUT.module, bytes: moduleBuf.length, sha256: sha(moduleBuf), restamped,
    proof_budget: MODULE_BUDGET, headroom_to_proof_budget: MODULE_BUDGET - moduleBuf.length, headroom_to_24781: HARD_CEILING - moduleBuf.length},
  cartridge: {path: OUT.cartridge, bytes: cartridgeBuf.length, sha256_lf: cartridgeSha, base: LIVE_SLD},
  proof: OUT.proof, manifest: OUT.manifest, route: [OUT.routeIndex, OUT.routeCurrent],
  protected_unchanged: PROTECTED.length
}, null, 1));
