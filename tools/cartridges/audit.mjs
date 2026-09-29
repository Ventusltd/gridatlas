#!/usr/bin/env node
// Audit atlas/cartridges: which timestamped copies are live, which are only
// reachable through a published versioned route, and which exist only so a
// past composition can be rolled back to.
//
// WHY THIS EXISTS
//
// Every cut of a cartridge lands as a new timestamped file next to the old one
// (141 files, 44 MB, seventy of them sld-sandbox-v9-8.js at ~17k lines each on
// 2026-09-29). Nothing here deletes anything: atlas/releases/ is immutable,
// tools/rollback.mjs refuses a generation whose cartridges are absent, and the
// routes under atlas/v/<generation>/ are published. This script only tells you
// what each file is for, so a decision to retire one is made with the facts.
//
// Usage:
//   node tools/cartridges/audit.mjs            human-readable table
//   node tools/cartridges/audit.mjs --json     machine-readable
//   node tools/cartridges/audit.mjs --rollback-only   list only the files that
//                                              exist solely for rollback
//
// Classes, most to least protected:
//   LIVE       named in atlas/current.json (served at the live route)
//   VERSIONED  named in atlas/v/<generation>/current.json (a published route)
//   TOOLING    named by a proof, CI script, .gitattributes or a workflow
//   ROLLBACK   named only by atlas/manifests/*-composition.json (rollback target)
//   ORPHAN     named by nothing at all outside its own directory

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARTRIDGES = path.join(ROOT, 'atlas', 'cartridges');
const args = new Set(process.argv.slice(2));

const SKIP_DIRS = new Set(['.git', 'node_modules', 'cartridges']);
const IGNORE_PREFIXES = ['nightly/', 'reports/', 'governance/', 'docs/', 'scope-of-works/', 'STATE.md', 'tools/overnight/shift-log.json'];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) && dir !== ROOT) continue;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function classify(refs) {
  const rel = refs.map(r => r.split(path.sep).join('/'));
  if (rel.includes('atlas/current.json')) return 'LIVE';
  if (rel.some(r => /^atlas\/v\/\d{12}\/current\.json$/.test(r))) return 'VERSIONED';
  const tooling = rel.filter(r => !r.startsWith('atlas/manifests/') && !IGNORE_PREFIXES.some(p => r.startsWith(p)));
  if (tooling.length) return 'TOOLING';
  if (rel.some(r => r.startsWith('atlas/manifests/'))) return 'ROLLBACK';
  return 'ORPHAN';
}

const cartridges = fs.readdirSync(CARTRIDGES).filter(name => name.endsWith('.js')).sort();
const files = walk(ROOT, []).filter(file => !file.startsWith(CARTRIDGES + path.sep));
const texts = new Map();
for (const file of files) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > 50 * 1024 * 1024) continue;
    texts.set(path.relative(ROOT, file), fs.readFileSync(file, 'latin1'));
  } catch {
    // unreadable files cannot reference anything we can act on
  }
}

const rows = cartridges.map(name => {
  const size = fs.statSync(path.join(CARTRIDGES, name)).size;
  const refs = [];
  for (const [rel, text] of texts) if (text.includes(name)) refs.push(rel);
  const family = name.replace(/^\d{12}-/, '').replace(/\.js$/, '');
  return { name, family, bytes: size, class: classify(refs), refs: refs.sort() };
});

if (args.has('--json')) {
  process.stdout.write(JSON.stringify(rows, null, 1) + '\n');
  process.exit(0);
}

const selected = args.has('--rollback-only') ? rows.filter(r => r.class === 'ROLLBACK') : rows;
const mb = bytes => (bytes / 1048576).toFixed(2).padStart(6);
for (const row of selected) {
  const first = row.refs.find(r => !r.startsWith('atlas/manifests/')) || row.refs[0] || '-';
  console.log(`${row.class.padEnd(10)} ${mb(row.bytes)} MB  ${row.name.padEnd(48)} ${first}`);
}

if (!args.has('--rollback-only')) {
  const byClass = {};
  for (const row of rows) {
    byClass[row.class] ??= { count: 0, bytes: 0 };
    byClass[row.class].count += 1;
    byClass[row.class].bytes += row.bytes;
  }
  console.log('');
  for (const cls of ['LIVE', 'VERSIONED', 'TOOLING', 'ROLLBACK', 'ORPHAN']) {
    const item = byClass[cls] || { count: 0, bytes: 0 };
    console.log(`${cls.padEnd(10)} ${String(item.count).padStart(4)} files ${mb(item.bytes)} MB`);
  }
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`${'TOTAL'.padEnd(10)} ${String(rows.length).padStart(4)} files ${mb(total)} MB`);
  console.log('\nROLLBACK files exist only so tools/rollback.mjs can restore that generation; removing one makes that generation unrestorable. See atlas/cartridges/README.md.');
}
