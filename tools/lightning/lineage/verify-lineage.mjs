#!/usr/bin/env node
// verify-lineage.mjs: replay the M-series build scripts on the committed modules and show that each committed
// generation is exactly its predecessor plus that build step (after the generation restamp the scaffolder made).
// Node built-ins only, except build-M (L3 -> M), which needs acorn for const2let and is skipped without it.
// Not part of CI: the gate checks tools/lightning/src instead (build.mjs --check). docs/LIGHTNING-SOURCE.md.
//   node tools/lightning/lineage/verify-lineage.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..', '..');
const mod = g => path.join(ROOT, 'atlas', 'modules', `${g}-uk-lightning-overlay.js`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lightning-lineage-'));
const steps = [
  // [label, script, from, to, extra args]
  ['L3 -> M  (build-M.mjs, const2let)', 'build-M.mjs', '202610281340', '202610281950'],
  ['M  -> M2 (build-M2.mjs + repd-m2.part.js)', 'build-M2.mjs', '202610281950', '202610282100'],
  ['M2 -> M3 (build-M3.mjs + layers-m3/repd-m3.part.js)', 'build-M3.mjs', '202610282100', '202610282215'],
  ['M3 -> M4 (build-M4.mjs + fixes-m4.mjs)', 'build-M4.mjs', '202610282215', '202610290045'],
  ['M4 -> M4b (build-M4b.mjs)', 'build-M4b.mjs', '202610290045', '202610290050'],
];
let bad = 0;
for (const [label, script, from, to] of steps) {
  let out = path.join(tmp, `${to}.js`), argv;
  if (script === 'build-M.mjs') {
    if (!fs.existsSync(path.join(HERE, 'deps', 'node_modules', 'acorn'))) { console.log(`skip ${label}: needs tools/lightning/lineage/deps/node_modules/acorn (npm i --prefix deps acorn@8.11.3 acorn-walk)`); continue; }
    argv = [path.join(HERE, script), mod(from), tmp, to]; out = path.join(tmp, 'module-M.js');
  } else argv = [path.join(HERE, script), mod(from), out];
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  if (r.status !== 0) { console.log(`FAIL ${label}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`); bad++; continue; }
  const got = fs.readFileSync(out, 'utf8').split(from).join(to), want = fs.readFileSync(mod(to), 'utf8');
  if (got === want) console.log(`ok   ${label}: ${to} reproduced (${Buffer.byteLength(want)} B)`);
  else { console.log(`FAIL ${label}: output differs from ${path.relative(ROOT, mod(to))}`); bad++; }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
