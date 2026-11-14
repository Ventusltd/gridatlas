#!/usr/bin/env node
/**
 * The register of keys of a generation, in the Kuiper manner (Ventusltd/kuiper-belt
 * README.md, "The first law: no claim without a key": a statement with a key
 * is a fact anyone can recompute; a statement without one is a candidate).
 * Every claim about the generation is measured here from the files in the
 * repository and carries the file and line, or the command, that proves it.
 *
 *   node tools/twin/keys.mjs --check     # measure again; fail on a claim that no longer holds, or on a
 *                                        # register that differs from the committed one (the CI check)
 *   node tools/twin/keys.mjs --write     # write tools/twin/keys/<G>.json and <G>.txt
 *   node tools/twin/keys.mjs --pipeline-refs DIR | --pipeline-refs-network
 *                                        # rebuild the Pipeline News ref list from a local release folder,
 *                                        # or from the commit-pinned URLs, verifying every sha256; with
 *                                        # --check it must equal the committed list, with --write it is written
 *   --generation G                       # default: the newest generation that has a register, else the live one
 *
 * The register carries no clock and no machine path, so two runs on the same
 * tree are byte-identical. Node built-ins only; no network unless
 * --pipeline-refs-network is given (offline first, then network).
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { STAMP, EXIT, abs, exists, sha256, sha256Of, readJson, sources, liveGeneration, tmpDir, arg, has, run, keyOf, composition } from './lib.mjs';
import { compose } from '../proofs/loader-composition.mjs';

const registers = fs.existsSync(abs('tools/twin/keys')) ? fs.readdirSync(abs('tools/twin/keys')).filter(f => /^\d{12}\.json$/.test(f)).map(f => f.slice(0, 12)).sort() : [];
const G = arg('--generation', registers.at(-1) || liveGeneration());
const WRITE = has('--write'), CHECK = has('--check');
if (!STAMP.test(G) || WRITE === CHECK) { console.error('usage: keys.mjs --check | --write [--generation G] [--pipeline-refs DIR | --pipeline-refs-network]'); process.exit(EXIT.REFUSED); }
const pin = sources()[G];
if (!pin) { console.error(`refused: tools/twin/sources.json has no entry for ${G}, so there is nothing to key`); process.exit(EXIT.REFUSED); }

const claims = [];
/** keys: [{file,line}|{command}]; a null key (needle not found) makes the claim fail. */
function claim(id, text, holds, keys, measured = {}) {
  const missing = keys.some(k => !k);
  claims.push({ id, claim: text, holds: Boolean(holds) && !missing, measured, keys: keys.filter(Boolean), ...(missing ? { key_missing: true } : {}) });
}
const n = v => Number(v).toLocaleString('en-GB');

const P = `atlas/v/${G}/current.json`;
const comp = composition(G), prevGen = pin.previous_generation, prev = composition(prevGen);
const manifest = readJson(pin.data_manifest);
const registry = readJson(`data/${manifest.browser_registry.path}`);
const records = new Map(registry.records.map(r => [String(r.repd_ref), r]));

// ---------------------------------------------------------------- K01 source
claim('K01', `The records of ${G} are compiled from ${pin.source.name}, sha256 ${pin.source.sha256}, ${n(pin.source.bytes)} bytes, and from no other register.`,
  manifest.source.sha256 === pin.source.sha256 && registry.source.sha256 === pin.source.sha256,
  [keyOf('tools/twin/sources.json', pin.source.sha256), keyOf(pin.compiler, `SOURCE_SHA256 = "${pin.source.sha256}"`), keyOf(pin.data_manifest, pin.source.sha256),
    { command: `curl -fsSL ${pin.source.url} | sha256sum` }],
  { sha256: pin.source.sha256, bytes: pin.source.bytes });

// ---------------------------------------------------------------- K02 rows
{
  const rows = registry.records.length;
  claim('K02', `The record snapshot holds ${n(manifest.closure.rows)} rows, one per REPD ref.`,
    rows === manifest.closure.rows && records.size === rows && manifest.closure.unique_repd_refs === rows && manifest.parquet.typed_readback[0] === rows,
    [keyOf(pin.data_manifest, `"rows": ${manifest.closure.rows}`), keyOf(pin.data_manifest, `"unique_repd_refs": ${manifest.closure.unique_repd_refs}`),
      { command: `node -e "console.log(require('./data/${manifest.browser_registry.path}').records.length)"` }],
    { manifest_rows: manifest.closure.rows, registry_records: rows, distinct_refs: records.size, status_counts: manifest.closure.status_counts });
}

// ---------------------------------------------------------------- K03 data files
{
  const files = [['parquet', `data/${manifest.parquet.path}`, manifest.parquet.sha256], ['browser_registry', `data/${manifest.browser_registry.path}`, manifest.browser_registry.sha256], ['manifest', pin.data_manifest, null]];
  const measured = Object.fromEntries(files.map(([k, f]) => [k, { file: f, sha256: sha256Of(f), bytes: fs.statSync(abs(f)).size }]));
  const own = comp.cartridges.filter(c => String(c.generation) === G);
  const carriers = own.filter(c => [measured.manifest.sha256, measured.parquet.sha256].every(h => fs.readFileSync(abs(c.file), 'utf8').includes(h)));
  claim('K03', `The three data files hash to the values the manifest records, and ${carriers.length} cartridge(s) cut at ${G} refuse any other manifest or parquet.`,
    files.every(([k, , want]) => !want || measured[k].sha256 === want) && carriers.length > 0 && carriers.length === own.length,
    [keyOf(pin.data_manifest, measured.parquet.sha256), keyOf(pin.data_manifest, measured.browser_registry.sha256),
      ...carriers.flatMap(c => [keyOf(c.file, measured.manifest.sha256), keyOf(c.file, measured.parquet.sha256)]),
      { command: `sha256sum ${files.map(f => f[1]).join(' ')}` }],
    { ...measured, carried_by: carriers.map(c => c.id) });
}

// ---------------------------------------------------------------- K04 cartridges
{
  const rows = comp.cartridges.map(c => ({ id: c.id, generation: String(c.generation), file: c.file, pinned: c.sha256, sha256: exists(c.file) ? sha256Of(c.file) : null }));
  claim('K04', `The ${rows.length} cartridges of ${G} are in the repository with the sha256 its pointer records.`,
    rows.length > 0 && rows.every(r => r.sha256 === r.pinned),
    [...rows.map(r => keyOf(P, `"sha256": "${r.pinned}"`)), { command: 'node tools/twin/preserve.mjs' }],
    { cartridges: rows.map(({ pinned, ...r }) => r) });
}

// ---------------------------------------------------------------- K05 it loads
{
  const out = await compose({ loaderHtml: fs.readFileSync(abs(`atlas/v/${G}/index.html`), 'utf8'), route: `atlas/v/${G}/` });
  claim('K05', `${G} composes through its own committed loader: every cartridge is fetched, hash-verified and handed to the shell.`,
    !out.failed && out.scripts.length === comp.cartridges.length,
    [keyOf(P, `"generation": "${G}"`), { command: `node tools/twin/keys.mjs --check   # compose() of tools/proofs/loader-composition.mjs on atlas/v/${G}/` }],
    out.failed ? { failed: String(out.message).slice(0, 200) } : { cartridges_composed: out.scripts.length, html_bytes: out.html.length, html_sha256: sha256(Buffer.from(out.html)) });
}

// ---------------------------------------------------------------- K06 the older GridAtlas stays a version
{
  const files = [`atlas/v/${prevGen}/current.json`, `atlas/v/${prevGen}/index.html`];
  const out = files.every(exists) ? await compose({ loaderHtml: fs.readFileSync(abs(files[1]), 'utf8'), route: `atlas/v/${prevGen}/` }) : { failed: true, message: 'not published' };
  claim('K06', `The previous live generation ${prevGen} is still published under atlas/v/${prevGen}/ with the bytes recorded here, and still composes through its own loader.`,
    !out.failed && String(comp.pointer.previous_generation) === prevGen,
    [keyOf(P, `"previous_generation": "${prevGen}"`), { command: `sha256sum ${files.join(' ')}` }, { command: 'node tools/twin/preserve.mjs' }],
    out.failed ? { failed: String(out.message).slice(0, 200) }
      : { files: files.map(f => ({ file: f, sha256: sha256Of(f), bytes: fs.statSync(abs(f)).size })), cartridges_composed: out.scripts.length, html_sha256: sha256(Buffer.from(out.html)) });
}

// ---------------------------------------------------------------- K07 the grid engine is the same bytes
const SUBS = 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson';
{
  const before = new Map(prev.cartridges.map(c => [c.id, c]));
  const carried = comp.cartridges.filter(c => String(c.generation) !== G);
  const rows = carried.map(c => ({ id: c.id, file: c.file, sha256: c.sha256, same_as_previous: before.get(c.id)?.sha256 === c.sha256 && before.get(c.id)?.file === c.file }));
  const recut = comp.cartridges.filter(c => String(c.generation) === G).map(c => c.id);
  const subsSha = sha256Of(SUBS);
  claim('K07', `The grid engine did not change: ${rows.length} cartridges (${rows.map(r => r.id).join(', ')}) are the same files with the same sha256 in ${prevGen} and ${G}, and the substation payload is the released file. Only ${recut.join(' and ')} were re-cut.`,
    rows.length > 0 && rows.every(r => r.same_as_previous) && rows.some(r => r.id === 'sld-sandbox'),
    [...rows.flatMap(r => [keyOf(P, `"sha256": "${r.sha256}"`), keyOf(prev.rel, `"sha256": "${r.sha256}"`)]),
      keyOf('atlas/releases/202608300453-atlas-v9/sha256sums.txt', `${subsSha}  data/grid_substations.geojson`)],
    { carried: rows, recut, substations: { file: SUBS, sha256: subsSha } });
}

// ---------------------------------------------------------------- K08 nearest substation, retained refs
{
  // The shipped code, not a copy of it: distanceKm from the geodesy module, voltagesKv, representativePoint and the
  // constants from the composed sld-sandbox cartridge (as FIXES/NL-016 tools/nearest_substation_check.mjs does).
  const sldFile = comp.cartridges.find(c => c.id === 'sld-sandbox').file, sld = fs.readFileSync(abs(sldFile), 'utf8');
  const ctx = { window: {}, Math, Number, String, Array, Object, JSON };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(abs('atlas/modules/202609011950-geodesy.js'), 'utf8'), ctx);
  const distanceKm = ctx.window.__GRIDATLAS_MODULES__.geodesy.distanceKm;
  const grab = name => { const i = sld.indexOf(`function ${name}(`); let d = 0; for (let k = sld.indexOf('{', i); k < sld.length; k++) { if (sld[k] === '{') d++; else if (sld[k] === '}' && --d === 0) return sld.slice(i, k + 1); } };
  const voltagesKv = new Function(`${grab('voltagesKv')}; return voltagesKv;`)(), representativePoint = new Function(`${grab('representativePoint')}; return representativePoint;`)();
  const MIN_KV = Number(sld.match(/const MIN_KV = (\d+);/)[1]);
  const subs = [];
  for (const f of readJson(SUBS).features) {
    const kv = voltagesKv(f.properties); if (!kv.length || Math.max(...kv) < MIN_KV - 0.5) continue;
    const at = representativePoint(f.geometry); if (!at) continue;
    subs.push({ at, kv: Math.max(...kv), name: f.properties?.name || 'Unnamed substation' });
  }
  const nearest = (lon, lat) => { let best = null, km = Infinity; for (const s of subs) { const d = distanceKm(lon, lat, s.at[0], s.at[1]); if (d < km) { km = d; best = s; } } return { name: best.name, kv: best.kv, km: Number(km.toFixed(3)) }; };
  const oldReg = readJson(`data/repd_browser_registry_${pin.previous_records}.json`).records;
  const retained = oldReg.filter(r => records.has(String(r.repd_ref)));
  const moved = [];
  for (const o of retained) {
    const r = records.get(String(o.repd_ref));
    if (o.longitude === r.longitude && o.latitude === r.latitude) continue;
    const a = nearest(o.longitude, o.latitude), b = nearest(r.longitude, r.latitude);
    moved.push({ repd_ref: String(o.repd_ref), moved_km: Number(distanceKm(o.longitude, o.latitude, r.longitude, r.latitude).toFixed(3)), before: a, after: b, same_substation: a.name === b.name && a.kv === b.kv && Math.abs(a.km - b.km) < 0.0005 });
  }
  moved.sort((x, y) => Number(x.repd_ref) - Number(y.repd_ref));
  const changed = moved.filter(m => !m.same_substation);
  const still = retained.length - moved.length;
  // Evidence that the engine really ran: one retained ref measured from its unchanged coordinate.
  const golden = records.get(manifest.golden_case.repd_ref);
  claim('K08', `Nearest substation for retained REPD refs: of ${n(retained.length)} refs in both ${pin.previous_records} and ${G}, ${n(still)} have the identical coordinate, so the unchanged engine (K07) returns the identical answer; ${moved.length} were moved by the source register, and ${changed.length} of those now measure to a different nearest substation (listed).`,
    retained.length > 0 && subs.length > 0 && still + moved.length === retained.length,
    [keyOf(sldFile, `const MIN_KV = ${MIN_KV};`), keyOf(sldFile, 'function voltagesKv(properties)'), keyOf('atlas/releases/202608300453-atlas-v9/sha256sums.txt', 'data/grid_substations.geojson'),
      { command: 'node tools/twin/keys.mjs --check   # K08 recomputes every moved ref with the shipped geodesy and sld-sandbox functions' }],
    { retained: retained.length, added: records.size - retained.length, dropped: oldReg.length - retained.length, identical_coordinate: still, moved: moved.length, moved_nearest_changed: changed.length,
      substations_qualifying: subs.length, min_kv: MIN_KV, golden: { repd_ref: manifest.golden_case.repd_ref, nearest: nearest(golden.longitude, golden.latitude) }, moved_refs: moved });
}

// ---------------------------------------------------------------- K09 Pipeline News refs
{
  const pn = pin.pipeline_news, ACTIVE = new Set(Object.keys(manifest.closure.status_counts));
  // --pipeline-refs DIR / --pipeline-refs-network: rebuild the list from the release itself, every file checked against the pinned manifest.
  const dir = arg('--pipeline-refs');
  let rebuilt = null;
  if (dir || has('--pipeline-refs-network')) {
    const work = tmpDir('keys');
    const get = rel => {
      if (dir) return fs.readFileSync(path.join(path.resolve(dir), rel));
      const to = path.join(work, path.basename(rel)), r = run(['curl', '-fsSL', '--retry', '2', '--max-time', '120', '-o', to, pn.base_url + rel]);
      if (r.code !== 0) { console.error(`BLOCKED_DEPENDENCY: ${pn.base_url + rel} did not answer (curl exit ${r.code})`); process.exit(EXIT.BLOCKED_DEPENDENCY); }
      return fs.readFileSync(to);
    };
    const mBytes = get(pn.manifest);
    if (sha256(mBytes) !== pn.manifest_sha256) { console.error(`FAIL: ${pn.manifest} is sha256 ${sha256(mBytes)}, the pin is ${pn.manifest_sha256}. Not used.`); process.exit(EXIT.FAIL); }
    const rows = [];
    for (const part of JSON.parse(mBytes).project_partitions) {
      const b = get(part.path);
      if (sha256(b) !== part.sha256) { console.error(`FAIL: ${part.path} is not the sha256 its manifest records. Not used.`); process.exit(EXIT.FAIL); }
      for (const p of JSON.parse(b).projects) rows.push([String(p.repd_ref), p.status]);
    }
    fs.rmSync(work, { recursive: true, force: true });
    rows.sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]));
    rebuilt = `# Pipeline News ${pn.release}: repd_ref<TAB>status, every project of ${pn.manifest} (sha256 ${pn.manifest_sha256}), sorted by ref. Written by tools/twin/keys.mjs; do not edit.\n` + rows.map(r => r.join('\t')).join('\n') + '\n';
    if (WRITE) fs.writeFileSync(abs(pn.refs), rebuilt);
    console.log(`pipeline refs: ${rows.length} rows rebuilt from ${dir ? 'the local release folder' : 'the pinned URLs'}, every file hash-verified`);
  }
  const listed = exists(pn.refs) ? fs.readFileSync(abs(pn.refs), 'utf8') : '';
  const rows = listed.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
  const resolved = rows.filter(([ref]) => records.has(ref));
  const absent = rows.filter(([ref]) => !records.has(ref));
  const absentActive = absent.filter(([, status]) => ACTIVE.has(String(status).toLowerCase())).map(([ref, status]) => ({ repd_ref: ref, status }));
  const byStatus = {};
  for (const [, s] of absent) byStatus[s] = (byStatus[s] || 0) + 1;
  claim('K09', `Pipeline News ${pn.release} lists ${n(rows.length)} REPD refs. ${n(resolved.length)} resolve to a record of ${G} by exact ref. ${n(absent.length)} do not, because the snapshot keeps the four active statuses only; ${absentActive.length} of those have an active status in Pipeline News and still have no record (${absentActive.map(a => a.repd_ref).join(', ') || 'none'}).`,
    rows.length > 0 && new Set(rows.map(r => r[0])).size === rows.length && resolved.length + absent.length === rows.length && (rebuilt === null || rebuilt === listed),
    [keyOf(pn.refs, `sha256 ${pn.manifest_sha256}`), keyOf('tools/twin/sources.json', pn.manifest_sha256),
      { command: `node tools/twin/keys.mjs --check --pipeline-refs-network   # rebuilds the list from ${pn.base_url}${pn.manifest}` }],
    { release: pn.release, refs: rows.length, resolved: resolved.length, not_in_snapshot: absent.length, not_in_snapshot_by_status: Object.fromEntries(Object.entries(byStatus).sort()),
      active_without_record: absentActive, list: { file: pn.refs, sha256: listed ? sha256(Buffer.from(listed)) : null }, ...(rebuilt !== null && rebuilt !== listed ? { list_differs_from_release: true } : {}) });
}

// ---------------------------------------------------------------- K10 the twin (proved by its own command)
claim('K10', `${G} is reproducible: its three data files and the cartridges it cut rebuild byte for byte from the pinned source with the repository's own compiler and cut tools.`,
  true, [{ command: `node tools/twin/replicate-generation.mjs --generation ${G} --network` }],
  { proved_by: 'the twin job, not by this register: a claim whose only key is a command holds when that command exits 0' });

// ---------------------------------------------------------------- write or check
const register = { schema: 'gridatlas.keys.v1', generation: G, law: 'no claim without a key: every claim is measured by tools/twin/keys.mjs and names the file and line, or the command, that proves it', claims };
const json = JSON.stringify(register, null, 1) + '\n';
const keyText = k => (k.file ? `${k.file}:${k.line}` : `$ ${k.command}`);
const text = [`Keys of GridAtlas generation ${G}`, 'Written by node tools/twin/keys.mjs --write; checked in CI by --check. Do not edit.', '',
  ...claims.flatMap(c => [`${c.id}  ${c.holds ? 'HOLDS' : 'DOES NOT HOLD'}  ${c.claim}`, ...c.keys.map(k => `      key  ${keyText(k)}`), ''])].join('\n');
const jsonRel = `tools/twin/keys/${G}.json`, textRel = `tools/twin/keys/${G}.txt`;

for (const c of claims) console.log(`${c.holds ? 'PASS ' : 'FAIL '} ${c.id}  ${c.claim}`);
const broken = claims.filter(c => !c.holds);
if (WRITE) {
  fs.mkdirSync(abs('tools/twin/keys'), { recursive: true });
  fs.writeFileSync(abs(jsonRel), json);
  fs.writeFileSync(abs(textRel), text);
  console.log(`\nwrote ${jsonRel} (${json.length} B) and ${textRel}; ${claims.length - broken.length}/${claims.length} claims hold`);
} else {
  const drift = [];
  if (!exists(jsonRel) || fs.readFileSync(abs(jsonRel), 'utf8') !== json) drift.push(jsonRel);
  if (!exists(textRel) || fs.readFileSync(abs(textRel), 'utf8') !== text) drift.push(textRel);
  for (const d of drift) console.error(`FAIL  ${d} is not what the repository now measures; a fact behind a claim moved. Read the claims above, then: node tools/twin/keys.mjs --write`);
  console.log(`\nkeys ${G}: ${claims.length - broken.length}/${claims.length} claims hold; register ${drift.length ? 'DIFFERS from' : 'equals'} the committed one`);
  if (drift.length) process.exit(EXIT.FAIL);
}
process.exit(broken.length ? EXIT.FAIL : EXIT.PASS);
