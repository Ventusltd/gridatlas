#!/usr/bin/env node
/**
 * Build the potential-offtakers overlay module (atlas/modules/<GEN>-uk-offtakers-overlay.js) from its readable source in
 * tools/offtakers/src/, with the same deterministic text transform as the lightning overlay (tools/lightning/build.mjs
 * assemble(): files concatenated in name order, `///` source-only lines dropped, `///` line continuations joined,
 * `@@GEN@@` stamped). One variant, "base". docs/OFFTAKERS-SOURCE.md.
 *
 *   node tools/offtakers/build.mjs --gen <GEN> [--out <file>]    # build; print size + sha256
 *   node tools/offtakers/build.mjs --check                       # the CI check (tools/ci/pr-gate.mjs, "offtakers-source")
 *
 * --check: the newest atlas/modules/*-uk-offtakers-overlay.js must be listed in tools/offtakers/generations.json, and every
 * listed generation must rebuild from src/ byte for byte, except one marked {"historical": "<commit that cut it>"}: its source
 * is that commit (it is kept in the registry as a record, and its module must still exist). With no offtakers module and an
 * empty list it passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assemble } from '../lightning/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const SRC_DIR = path.join(HERE, 'src');
export const GENERATIONS = path.join(HERE, 'generations.json');
const MODULE_RE = /^(\d{12})-uk-offtakers-overlay\.js$/, VARIANTS = ['base'];
const sha256 = b => createHash('sha256').update(b).digest('hex');
export const modulePath = gen => path.join(ROOT, 'atlas', 'modules', `${gen}-uk-offtakers-overlay.js`);
export const build = gen => assemble({ variant: 'base', gen, variants: VARIANTS, srcDir: SRC_DIR });

export function check() {
  const lines = [], bad = [];
  const reg = JSON.parse(fs.readFileSync(GENERATIONS, 'utf8')), listed = Object.keys(reg.generations || {}).sort();
  const gens = fs.readdirSync(path.join(ROOT, 'atlas', 'modules')).map(n => (MODULE_RE.exec(n) || [])[1]).filter(Boolean).sort(), newest = gens.at(-1);
  if (newest && reg.generations?.[newest]?.historical) bad.push(`the newest offtakers generation ${newest} is marked historical; it must rebuild from the current source`);
  if (newest && !listed.includes(newest)) bad.push(`the newest offtakers generation ${newest} is not listed in tools/offtakers/generations.json`);
  for (const g of listed) {
    const file = modulePath(g);
    if (!fs.existsSync(file)) { bad.push(`${g}: ${path.relative(ROOT, file)} missing`); continue; }
    if (reg.generations[g].historical) { lines.push(`hist ${g}: historical, built from ${reg.generations[g].historical}; not rebuilt from the current source`); continue; }
    const want = fs.readFileSync(file); let got;
    try { got = Buffer.from(build(g), 'utf8'); } catch (e) { bad.push(`${g}: source does not assemble: ${e.message}`); continue; }
    if (got.equals(want)) lines.push(`ok   ${g}: ${want.length} B sha256 ${sha256(want)} rebuilt byte for byte`);
    else { let i = 0; while (i < got.length && i < want.length && got[i] === want[i]) i++; bad.push(`${g}: rebuild differs from the committed module at byte ${i}`); }
  }
  if (!listed.length && !newest) lines.push('ok   no offtakers generation yet');
  for (const b of bad) lines.push(`FAIL ${b}`);
  return { ok: !bad.length, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--check') opt.check = true;
    else if (/^--(gen|out)$/.test(a[i]) && a[i + 1] !== undefined) opt[a[i].slice(2)] = a[++i];
    else { console.error(`build.mjs: bad argument ${a[i]}`); process.exit(2); }
  }
  if (opt.check) { const r = check(); for (const l of r.lines) console.log(l); process.exit(r.ok ? 0 : 1); }
  if (!opt.gen) { console.error('build.mjs: --gen <YYYYMMDDHHMM> or --check is required'); process.exit(2); }
  const buf = Buffer.from(build(opt.gen), 'utf8');
  if (opt.out) fs.writeFileSync(opt.out, buf);
  console.log(JSON.stringify({ gen: opt.gen, bytes: buf.length, sha256: sha256(buf), out: opt.out || null }));
}
