#!/usr/bin/env node
/**
 * Preservation: every published generation stays a version. Node built-ins
 * only, no network. Nothing is written.
 *
 *   node tools/twin/preserve.mjs                 # the working tree
 *   node tools/twin/preserve.mjs --base <rev>    # and nothing published at <rev> was changed or removed
 *
 * Fails when any of these does not hold:
 *
 *   pinned cartridges   every cartridge of every atlas/v/<G>/current.json is in
 *                       the repository with the sha256 that pointer records
 *   loaders             every atlas/v/<G>/ has its index.html, a registered loader
 *   release shells      every atlas/releases/<id>/sha256sums.txt verifies
 *   data manifests      every data/repd_v9_manifest_<G>.json describes the parquet
 *                       and registry beside it
 *   assembled           every atlas/manifests/*-parts.json names a cartridge file
 *                       with the sha256 it records
 *   previous live       the generation the live pointer superseded is still
 *                       published under atlas/v/, and its own committed loader,
 *                       run in node:vm (tools/proofs/loader-composition.mjs),
 *                       composes it: every cartridge fetched and hash-verified
 *   immutable (--base)  no file that existed at <rev> under atlas/v/,
 *                       atlas/releases/, atlas/cartridges/, atlas/modules/,
 *                       atlas/parts/, atlas/manifests/ or data/ is modified,
 *                       deleted or renamed. New files are welcome: a change is
 *                       a new generation (kuiper-belt editions/README.md:
 *                       "Earlier dated folders are kept unchanged as history").
 *
 * Reported, not failed: part files and composition manifests whose recorded
 * sha256 no longer matches. Those drifts predate this check (175 parts and 3
 * composition manifests at main b0a3a938); the --base rule stops new ones.
 */

import fs from 'node:fs';
import path from 'node:path';
import { STAMP, abs, exists, sha256Of, readJson, liveGeneration, arg, run, composition, reporter } from './lib.mjs';
import { sha256PublishedFile, registeredLoader, slotsUsed } from '../scope/lib.mjs';
import { compose } from '../proofs/loader-composition.mjs';

const BASE = arg('--base');
const R = reporter('preservation');
const gens = fs.readdirSync(abs('atlas/v')).filter(d => STAMP.test(d)).sort();
const live = liveGeneration();

// ---------------------------------------------------------------- pinned cartridges, loaders
{
  const bad = [], badLoader = [];
  let n = 0;
  for (const g of gens) {
    if (!exists(`atlas/v/${g}/current.json`)) { bad.push(`atlas/v/${g}/current.json missing`); continue; }
    let comp;
    try { comp = composition(g); } catch (e) { bad.push(`atlas/v/${g}/current.json unreadable: ${e.message}`); continue; }
    if (String(comp.pointer.generation) !== g) bad.push(`atlas/v/${g}/current.json declares generation ${comp.pointer.generation}`);
    for (const c of comp.cartridges) {
      n++;
      if (c.missing) bad.push(`${g} ${c.id}: ordered but not described`);
      else if (!exists(c.file)) bad.push(`${g} ${c.id}: ${c.file} missing`);
      else if (sha256PublishedFile(abs(c.file)) !== c.sha256) bad.push(`${g} ${c.id}: ${c.file} is not the sha256 atlas/v/${g}/current.json records`);
    }
    const index = `atlas/v/${g}/index.html`;
    if (!exists(index)) { badLoader.push(`${index} missing`); continue; }
    const loader = registeredLoader(abs(index));
    if (!loader) badLoader.push(`${index} is not a registered loader`);
    else for (const s of slotsUsed(comp.pointer)) if (!loader.slots.includes(s)) badLoader.push(`${index} (loader ${loader.name}) cannot compose slot ${s}`);
  }
  if (!gens.length) R.fail('pinned cartridges', 'no generation under atlas/v/: nothing examined');
  else if (bad.length) R.fail('pinned cartridges', bad.join('; '));
  else R.pass('pinned cartridges', `${n} cartridge pins of ${gens.length} generations (${gens[0]} to ${gens.at(-1)}) hold`);
  if (badLoader.length) R.fail('loaders', badLoader.join('; '));
  else R.pass('loaders', `${gens.length} generations each have a registered loader that supports their slots`);
}

// ---------------------------------------------------------------- release shells
{
  const bad = [];
  let files = 0, sums = 0;
  for (const id of fs.readdirSync(abs('atlas/releases')).sort()) {
    const rel = `atlas/releases/${id}/sha256sums.txt`;
    if (!exists(rel)) continue;
    sums++;
    for (const line of fs.readFileSync(abs(rel), 'utf8').split('\n').filter(Boolean)) {
      const m = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
      if (!m) { bad.push(`${rel}: unreadable line`); continue; }
      files++;
      const f = `atlas/releases/${id}/${m[2].trim()}`;
      if (!exists(f)) bad.push(`${f} missing`);
      else if (sha256PublishedFile(abs(f)) !== m[1] && sha256Of(f) !== m[1]) bad.push(`${f} is not the sha256 in ${rel}`);
    }
  }
  if (!files) R.fail('release shells', 'no sha256sums.txt lines: nothing examined');
  else if (bad.length) R.fail('release shells', bad.join('; '));
  else R.pass('release shells', `${files} files of ${sums} release sha256sums.txt verify`);
}

// ---------------------------------------------------------------- data manifests
{
  const bad = [], seen = [];
  for (const f of fs.readdirSync(abs('data')).filter(f => /^repd_v9_manifest_\d{12}\.json$/.test(f)).sort()) {
    const m = readJson(`data/${f}`);
    seen.push(m.generation);
    for (const k of ['parquet', 'browser_registry']) {
      const rel = `data/${m[k].path}`;
      if (!exists(rel)) bad.push(`${rel} missing`);
      else if (sha256Of(rel) !== m[k].sha256) bad.push(`${rel} is not the sha256 in data/${f}`);
    }
  }
  if (!seen.length) R.fail('data manifests', 'no data/repd_v9_manifest_*.json: nothing examined');
  else if (bad.length) R.fail('data manifests', bad.join('; '));
  else R.pass('data manifests', `record snapshots ${seen.join(', ')}: parquet and registry are the files their manifests describe`);
}

// ---------------------------------------------------------------- assembled cartridges; drift notes
{
  const bad = [], partDrift = [], compDrift = [];
  let n = 0;
  for (const f of fs.readdirSync(abs('atlas/manifests')).sort()) {
    const rel = `atlas/manifests/${f}`;
    if (f.endsWith('-parts.json')) {
      const m = readJson(rel), cart = path.posix.normalize(path.posix.join('atlas', m.cartridge));
      n++;
      if (!exists(cart)) bad.push(`${cart} missing (${rel})`);
      else if (sha256PublishedFile(abs(cart)) !== m.sha256) bad.push(`${cart} is not the sha256 in ${rel}`);
      for (const p of m.assembled_from || []) if (!exists(p.path) || sha256PublishedFile(abs(p.path)) !== p.sha256) partDrift.push(`${f}:${p.path}`);
    } else if (f.endsWith('-composition.json')) {
      for (const c of readJson(rel).cartridges || []) {
        if (!c.path || !c.sha256) continue;
        const file = path.posix.normalize(path.posix.join('atlas', c.path));
        if (!exists(file) || sha256PublishedFile(abs(file)) !== c.sha256) compDrift.push(`${f}:${c.id}`);
      }
    }
  }
  if (!n) R.fail('assembled', 'no parts manifest: nothing examined');
  else if (bad.length) R.fail('assembled', bad.join('; '));
  else R.pass('assembled', `${n} parts manifests each name a cartridge with the sha256 they record`);
  if (partDrift.length) R.note('part drift', `${partDrift.length} part or module files no longer hash to what an older parts manifest recorded (the assembled cartridges themselves hold); first: ${partDrift[0]}`);
  if (compDrift.length) R.note('composition drift', `${compDrift.length} cartridge entries of composition manifests never published under atlas/v/ no longer match: ${compDrift.slice(0, 3).join(', ')}`);
}

// ---------------------------------------------------------------- previous live generation
{
  const pointer = readJson('atlas/current.json');
  const prev = String(pointer.previous_generation || pointer.superseded_generation || '');
  const bad = [];
  let detail = '';
  if (!STAMP.test(prev)) bad.push(`atlas/current.json (generation ${live}) names no previous_generation`);
  else if (!exists(`atlas/v/${prev}/current.json`) || !exists(`atlas/v/${prev}/index.html`)) bad.push(`atlas/v/${prev}/ is not published (current.json and index.html)`);
  else {
    const out = await compose({ loaderHtml: fs.readFileSync(abs(`atlas/v/${prev}/index.html`), 'utf8'), route: `atlas/v/${prev}/` });
    const order = composition(prev).pointer.cartridge_order;
    if (out.failed) bad.push(`atlas/v/${prev}/ does not compose through its own loader: ${String(out.message).replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`);
    else if (out.scripts.length !== order.length) bad.push(`atlas/v/${prev}/ composed ${out.scripts.length} cartridges, its pointer orders ${order.length}`);
    else detail = `${prev} is published at atlas/v/${prev}/ and composes through its own loader: ${out.scripts.length} cartridges fetched and hash-verified, ${out.html.length} B of HTML`;
  }
  if (bad.length) R.fail('previous live', bad.join('; '));
  else R.pass('previous live', detail);
}

// ---------------------------------------------------------------- immutable against the base
if (BASE) {
  const roots = ['atlas/v/', 'atlas/releases/', 'atlas/cartridges/', 'atlas/modules/', 'atlas/parts/', 'atlas/manifests/', 'data/'];
  const d = run(['git', 'diff', '--name-status', '--no-renames', BASE, '--', ...roots]);
  if (d.code !== 0) R.fail('immutable', `cannot diff against ${BASE}: ${d.stderr.trim().slice(0, 200)}`);
  else {
    const rows = d.stdout.split('\n').filter(Boolean).map(l => l.split('\t'));
    const touched = rows.filter(([s]) => s !== 'A');
    if (touched.length) R.fail('immutable', `published at ${BASE} and changed or removed: ${touched.map(([s, f]) => `${s} ${f}`).join('; ')}. Published files are never edited; cut a new generation.`);
    else R.pass('immutable', `against ${BASE}: ${rows.length} file(s) added under the published roots, none modified or removed`);
  }
} else R.note('immutable', 'NOT RUN: no --base given, so the working tree was not compared with an earlier commit');

process.exit(R.finish());
