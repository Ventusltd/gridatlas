// Shared by the three twin tools. Node built-ins only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const STAMP = /^\d{12}$/;
export const abs = rel => path.join(ROOT, rel);
export const exists = rel => fs.existsSync(abs(rel));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const sha256Of = file => sha256(fs.readFileSync(path.isAbsolute(file) ? file : abs(file)));
export const readJson = rel => JSON.parse(fs.readFileSync(path.isAbsolute(rel) ? rel : abs(rel), 'utf8'));
export const sources = () => readJson('tools/twin/sources.json').generations;
export const liveGeneration = () => String(readJson('atlas/current.json').generation);
export const tmpDir = tag => fs.mkdtempSync(path.join(os.tmpdir(), `gridatlas-${tag}-`));

export function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i < 0 ? fallback : process.argv[i + 1];
}
export const has = flag => process.argv.includes(flag);

export function run(argv, opts = {}) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error.message) : '') };
}

/** The key of a statement: the first line of a file that contains the needle,
    as { file, line }. A needle that is not there has no key, and the caller
    must treat the claim as not holding (kuiper-belt README, the first law). */
export function keyOf(rel, needle) {
  const lines = fs.readFileSync(abs(rel), 'utf8').split('\n');
  const i = lines.findIndex(l => l.includes(needle));
  return i < 0 ? null : { file: rel, line: i + 1 };
}

/** The composition a generation pins, and each cartridge's file in the repository. */
export function composition(gen) {
  const rel = `atlas/v/${gen}/current.json`;
  const pointer = readJson(rel);
  const byId = new Map((pointer.cartridges || []).map(c => [c.id, c]));
  const cartridges = (pointer.cartridge_order || []).map(id => {
    const c = byId.get(id);
    return c ? { ...c, file: path.posix.normalize(path.posix.join(`atlas/v/${gen}`, c.path)) } : { id, missing: true };
  });
  return { rel, pointer, cartridges };
}

/** Outcome classes, kept apart as docs/CI-CD-PLAN.md keeps them. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, REFUSED: 2, BLOCKED_HARNESS: 3, BLOCKED_DEPENDENCY: 4 });

export function reporter(title) {
  const rows = [];
  const say = (state, name, detail = '') => { rows.push({ state, name, detail }); console.log(`${state.padEnd(5)} ${name}${detail ? `  ${detail}` : ''}`); };
  return {
    rows,
    pass: (n, d) => say('PASS', n, d),
    fail: (n, d) => say('FAIL', n, d),
    note: (n, d) => say('note', n, d),
    failed: () => rows.filter(r => r.state === 'FAIL'),
    finish(extra = '') {
      const bad = rows.filter(r => r.state === 'FAIL'), ok = rows.filter(r => r.state === 'PASS');
      console.log(`\n${title}: ${ok.length} passed, ${bad.length} failed${extra ? `; ${extra}` : ''}`);
      for (const b of bad) console.error(`  FAIL ${b.name}  ${b.detail}`);
      return bad.length ? EXIT.FAIL : EXIT.PASS;
    }
  };
}
