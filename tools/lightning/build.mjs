#!/usr/bin/env node
/**
 * Build the UK lightning overlay module (atlas/modules/<GEN>-uk-lightning-overlay.js) from its readable source in
 * tools/lightning/src/. Node built-ins only. docs/LIGHTNING-SOURCE.md explains the source format and how to cut a
 * generation from it.
 *
 *   node tools/lightning/build.mjs --gen 202610290050              # build the variant generations.json names; print size + sha256
 *   node tools/lightning/build.mjs --gen <GEN> --variant m4b --out <file>
 *   node tools/lightning/build.mjs --check                         # the CI check (tools/ci/pr-gate.mjs, "lightning-source")
 *
 * The build is a deterministic text transform, not a minifier. The shipped bytes are the source with its source-only
 * layer taken out, in this order:
 *   1. the files src/*.js are concatenated in file-name order (each must end in "\n"; no CR anywhere);
 *   2. variant blocks: a line `///#if <variant>[,<variant>…]`, an optional `///#else` and `///#endif` (whole lines,
 *      not nested) keep the lines of the branch that names the variant being built and drop the others;
 *   3. every remaining line whose first non-blank characters are `///` is a source-only comment and is dropped;
 *   4. a line that ends in `///` continues on the next line: the three slashes, the line break and the next line's
 *      leading blanks are removed. This is how a long golfed line is laid out readably and stays byte-identical;
 *   5. every `@@GEN@@` becomes the generation stamp (the header comment and `GEN='…'`).
 * Nothing else changes: `//` and `/* … *\/` comments without a third slash ship as they are.
 *
 * --check: the newest lightning generation in atlas/modules/ must be listed in tools/lightning/generations.json, and
 * every listed generation must rebuild from src/ byte for byte (sha256 of the raw bytes, which are LF-only). Exit 1
 * otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const SRC_DIR = path.join(HERE, 'src');
export const GENERATIONS = path.join(HERE, 'generations.json');
const MODULE_RE = /^(\d{12})-uk-lightning-overlay\.js$/;

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const modulePath = gen => path.join(ROOT, 'atlas', 'modules', `${gen}-uk-lightning-overlay.js`);

export function readGenerations(file = GENERATIONS) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(j.variants) || !j.variants.length) throw new Error(`${path.relative(ROOT, file)}: "variants" must list the variant names`);
  for (const [g, e] of Object.entries(j.generations || {})) {
    if (!/^\d{12}$/.test(g)) throw new Error(`generations.json: bad generation ${g}`);
    if (!j.variants.includes(e.variant)) throw new Error(`generations.json: ${g} names unknown variant ${e.variant}`);
  }
  return j;
}

/** The source files, in build order. */
export function sourceFiles(srcDir = SRC_DIR) {
  const names = fs.readdirSync(srcDir).filter(n => n.endsWith('.js')).sort();
  if (!names.length) throw new Error(`no *.js in ${srcDir}`);
  return names.map(n => path.join(srcDir, n));
}

/** Assemble the module text for one variant and generation stamp. Throws on any malformed source. */
export function assemble({ variant, gen, variants, srcDir = SRC_DIR }) {
  if (!/^\d{12}$/.test(gen)) throw new Error(`--gen must be YYYYMMDDHHMM, got ${gen}`);
  if (variants && !variants.includes(variant)) throw new Error(`unknown variant ${variant} (known: ${variants.join(', ')})`);
  const lines = [], where = [];
  for (const f of sourceFiles(srcDir)) {
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes('\r')) throw new Error(`${path.basename(f)}: contains CR (the module is LF-only)`);
    if (!t.endsWith('\n')) throw new Error(`${path.basename(f)}: must end with a newline`);
    t.slice(0, -1).split('\n').forEach((l, i) => { lines.push(l); where.push(`${path.basename(f)}:${i + 1}`); });
  }
  const kept = [];
  let block = null; // { on: boolean, seenElse: boolean, line: string }
  lines.forEach((line, i) => {
    const t = line.trimStart(), at = where[i];
    let m;
    if ((m = /^\/\/\/#if ([\w,]+)\s*$/.exec(t))) {
      if (block) throw new Error(`${at}: nested ///#if (block opened at ${block.line})`);
      const names = m[1].split(',');
      for (const n of names) if (variants && !variants.includes(n)) throw new Error(`${at}: ///#if names unknown variant ${n}`);
      block = { on: names.includes(variant), seenElse: false, line: at };
    } else if (/^\/\/\/#else\s*$/.test(t)) {
      if (!block || block.seenElse) throw new Error(`${at}: stray ///#else`);
      block.on = !block.on; block.seenElse = true;
    } else if (/^\/\/\/#endif\s*$/.test(t)) {
      if (!block) throw new Error(`${at}: stray ///#endif`);
      block = null;
    } else if (/^\/\/\/#/.test(t)) {
      throw new Error(`${at}: unknown directive ${t.slice(0, 40)}`);
    } else if (block && !block.on) {
      // the other variant's line
    } else if (t.startsWith('///')) {
      // source-only comment
    } else kept.push(line);
  });
  if (block) throw new Error(`///#if at ${block.line} is never closed`);
  let out = '', cont = false;
  for (const line of kept) {
    const piece = cont ? line.trimStart() : line;
    if (piece.endsWith('///')) { out += piece.slice(0, -3); cont = true; } else { out += piece + '\n'; cont = false; }
  }
  if (cont) throw new Error('the last line ends in a /// continuation');
  if (out.includes('@@') && out.split('@@GEN@@').join('').includes('@@')) throw new Error('a stray @@ placeholder remains');
  return out.split('@@GEN@@').join(gen);
}

/** The newest lightning overlay generation present in atlas/modules/. */
export function newestModule() {
  const gens = fs.readdirSync(path.join(ROOT, 'atlas', 'modules')).map(n => (MODULE_RE.exec(n) || [])[1]).filter(Boolean).sort();
  return gens[gens.length - 1] || null;
}

/** The CI check. Returns { ok, lines }. */
export function check() {
  const lines = [], bad = [];
  let reg;
  try { reg = readGenerations(); } catch (e) { return { ok: false, lines: [`FAIL ${e.message}`] }; }
  const listed = Object.keys(reg.generations || {}).sort();
  const newest = newestModule();
  if (!newest) bad.push('no lightning overlay module in atlas/modules/');
  else if (!listed.includes(newest)) bad.push(`the newest lightning generation ${newest} is not listed in tools/lightning/generations.json: ` +
    'cut it from tools/lightning/src with tools/lightning/make-generation.mjs (docs/LIGHTNING-SOURCE.md)');
  for (const g of listed) {
    const { variant } = reg.generations[g], file = modulePath(g);
    if (!fs.existsSync(file)) { bad.push(`${g}: ${path.relative(ROOT, file)} missing`); continue; }
    const want = fs.readFileSync(file);
    let got;
    try { got = Buffer.from(assemble({ variant, gen: g, variants: reg.variants }), 'utf8'); }
    catch (e) { bad.push(`${g} (${variant}): source does not assemble: ${e.message}`); continue; }
    if (got.equals(want)) lines.push(`ok   ${g} ${variant}: ${want.length} B sha256 ${sha256(want)} rebuilt byte for byte`);
    else {
      let i = 0; while (i < got.length && i < want.length && got[i] === want[i]) i++;
      const lineNo = want.subarray(0, i).toString('utf8').split('\n').length;
      bad.push(`${g} (${variant}): rebuild differs from the committed module at byte ${i} (module line ${lineNo}); ` +
        `built ${got.length} B ${sha256(got).slice(0, 12)}…, committed ${want.length} B ${sha256(want).slice(0, 12)}…`);
    }
  }
  for (const b of bad) lines.push(`FAIL ${b}`);
  return { ok: bad.length === 0, lines };
}

/* ---------------------------------------------------------------- CLI */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--check') opt.check = true;
    else if (/^--(gen|variant|out)$/.test(a[i]) && a[i + 1] !== undefined) opt[a[i].slice(2)] = a[++i];
    else { console.error(`build.mjs: bad argument ${a[i]}`); process.exit(2); }
  }
  if (opt.check) {
    const r = check();
    for (const l of r.lines) console.log(l);
    process.exit(r.ok ? 0 : 1);
  }
  if (!opt.gen) { console.error('build.mjs: --gen <YYYYMMDDHHMM> or --check is required'); process.exit(2); }
  const reg = readGenerations();
  const variant = opt.variant || (reg.generations[opt.gen] || {}).variant;
  if (!variant) { console.error(`build.mjs: ${opt.gen} is not in generations.json; pass --variant (${reg.variants.join('|')})`); process.exit(2); }
  const buf = Buffer.from(assemble({ variant, gen: opt.gen, variants: reg.variants }), 'utf8');
  if (opt.out) fs.writeFileSync(opt.out, buf);
  const committed = fs.existsSync(modulePath(opt.gen)) ? fs.readFileSync(modulePath(opt.gen)) : null;
  console.log(JSON.stringify({ gen: opt.gen, variant, bytes: buf.length, sha256: sha256(buf), out: opt.out || null,
    matches_committed_module: committed ? committed.equals(buf) : null }));
}
