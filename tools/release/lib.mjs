/**
 * Shared helpers for tools/release/release-generation.mjs and
 * tools/release/rollback-generation.mjs.
 *
 * Both scripts automate what was done by hand for the 202610270024 rehearsal
 * and the 202610281340 (Build L3) release, recorded in
 * docs/lightning/hardening-20261026/evidence/release-rehearsal-E/RELEASE-COMMANDS.md.
 * They never push, never open a PR and never touch atlas/releases/**. They
 * work in whatever checkout they live in, so run them from a worktree.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ATLAS_LOADERS } from '../scope/lib.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* The manifest keys that describe the CUT rather than the composition. The
   rehearsal deleted exactly these six and wrote the rest with a one-space
   indent and a trailing newline; L3's live atlas/current.json is byte-identical
   to that derivation of its manifest. */
export const MANIFEST_ONLY_KEYS = Object.freeze([
  'parent_generation', 'version', 'cut_at_utc', 'note', 'acceptance', 'candidate_status'
]);

/* The only two files a release (or its revert) may change... */
export const POINTER_FILES = Object.freeze(['atlas/current.json', 'STATE.md']);

/* ...plus the live loader, when and only when the generation going live is
   served by a different registered loader than the live one (loader v2 for
   the modular lightning generations, docs/LIGHTNING-CARTRIDGE.md). The
   loader then moves in the release commit itself, so reverting that one
   commit restores all three files byte for byte. */
export const LOADER_FILE = 'atlas/index.html';

/** The name of the registered loader (tools/scope/lib.mjs ATLAS_LOADERS)
    whose payload is byte-identical to buffer, and the slots it supports. */
export function registeredLoaderOf(buffer) {
  if (!buffer) return null;
  const digest = sha256(Buffer.from(buffer.toString('binary').replace(/\r\n/g, '\n'), 'binary'));
  for (const [name, loader] of Object.entries(ATLAS_LOADERS)) {
    const payload = fs.readFileSync(path.join(ROOT, loader.payload));
    if (sha256(Buffer.from(payload.toString('binary').replace(/\r\n/g, '\n'), 'binary')) === digest) return { name, slots: loader.slots };
  }
  return null;
}

/** The slot types the ordered cartridges of a pointer use. */
export function pointerSlots(pointer) {
  const byId = new Map((pointer.cartridges || []).map(c => [c.id, c]));
  return [...new Set((pointer.cartridge_order || []).map(id => byId.get(id)?.slot))].filter(Boolean).sort();
}

/* The rows of 202609012214-data-contract-parity that fail on every commit
   since before Lightning. They are reported, never hidden: the gate is that a
   release adds no FAIL row that the pre-release tree did not already have. */
export const PARITY_PROOF = 'tools/proofs/202609012214-data-contract-parity.proof.mjs';

export function die(tool, message) {
  console.error(`${tool}: STOP: ${message}`);
  process.exit(1);
}

export function parseArgs(argv, spec) {
  const out = {};
  for (const [name, def] of Object.entries(spec)) out[name] = def.multi ? [] : (def.default ?? null);
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) throw new Error(`unexpected argument ${raw}`);
    const name = raw.slice(2);
    const def = spec[name];
    if (!def) throw new Error(`unknown flag ${raw}`);
    if (def.bool) { out[name] = true; continue; }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${raw} needs a value`);
    i += 1;
    if (def.multi) out[name].push(value); else out[name] = value;
  }
  return out;
}

export function run(cmd, args, { cwd = ROOT, allowFail = false, input } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, input });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}\n${r.stdout}${r.stderr}`);
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

export const git = (...args) => run('git', args).stdout.trim();
export const gitOk = (...args) => run('git', args, { allowFail: true }).status === 0;

export function gitBlob(rev, relative) {
  const r = spawnSync('git', ['show', `${rev}:${relative}`], { cwd: ROOT, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
export const sha256File = (relative) => sha256(fs.readFileSync(path.join(ROOT, relative)));
export const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
export const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

/** atlas/current.json exactly as the rehearsal wrote it from G's manifest. */
export function deriveCurrent(manifestText) {
  const manifest = JSON.parse(manifestText);
  for (const key of MANIFEST_ONLY_KEYS) delete manifest[key];
  return `${JSON.stringify(manifest, null, 1)}\n`;
}

/** The pinned preview route atlas/v/G/current.json is the same composition
    with every "./" or "../" relative reference re-rooted two levels up. */
export function rerootForPreview(currentText) {
  return currentText.replace(/": "(\.\/|\.\.\/)/g, '": "../../');
}

export function cleanTree() {
  return run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout.trim() === '';
}

export function changedPaths() {
  return run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout
    .split('\n').filter(Boolean).map(line => line.slice(3)).sort();
}

export function isTracked(relative) {
  return gitOk('ls-files', '--error-unmatch', '--', relative);
}

/* ---------------------------------------------------------------- gates */

/** FAIL rows of the data-contract parity proof, parsed from its FAILURES
    block. A non-zero exit with no FAILURES block is itself a FAIL row, so a
    proof that crashes cannot read as "no new failures". */
export function parityFailRows() {
  const r = run('node', [PARITY_PROOF], { allowFail: true });
  const lines = r.out.split('\n');
  const start = lines.findIndex(l => l.trim() === 'FAILURES');
  let rows = start === -1 ? [] : lines.slice(start + 1).map(l => l.trim()).filter(Boolean);
  if (r.status !== 0 && rows.length === 0) rows = [`parity proof exited ${r.status} without a FAILURES block`];
  return { status: r.status, rows, out: r.out };
}

/**
 * Every gate the hand release ran, in the same order. Returns rows of
 * { gate, ok, detail } and the full log text; never throws on a red gate.
 *
 *   expectGeneration  verify-compose must report this generation
 *   proofs            generation-matched proofs to run directly
 *   parityBaseline    FAIL rows the pre-release tree already had
 *   rollbackTo        generation for `tools/rollback.mjs --dry-run` (null skips)
 */
export function runGates({ expectGeneration, proofs = [], parityBaseline = [], rollbackTo = null }) {
  const rows = [];
  let log = '';
  const record = (gate, ok, detail, out) => {
    rows.push({ gate, ok, detail });
    log += `\n### ${gate}  ->  ${ok ? 'PASS' : 'FAIL'}  ${detail}\n${out ?? ''}`;
  };

  const lint = run('node', ['tools/scope/loop.mjs', 'lint'], { allowFail: true });
  record('loop.mjs lint', lint.status === 0, lint.out.trim().split('\n').pop(), lint.out);

  const state = run('node', ['tools/scope/loop.mjs', 'state', '--stdout'], { allowFail: true });
  const stateOk = state.status === 0 && exists('STATE.md') && state.stdout === readText('STATE.md');
  record('loop.mjs state --stdout == STATE.md', stateOk, stateOk ? 'STATE_PARITY_OK' : 'STATE.md differs from the generator', state.stderr);

  const compose = run('node', ['tools/scope/verify-compose.mjs'], { allowFail: true });
  let composeOk = compose.status === 0;
  let composeDetail = `exit ${compose.status}`;
  try {
    const parsed = JSON.parse(compose.stdout.trim().split('\n').pop());
    composeOk = composeOk && parsed.composition === 'PASS' && parsed.generation === expectGeneration;
    composeDetail = `composition=${parsed.composition} generation=${parsed.generation}`;
  } catch { composeOk = false; }
  record('verify-compose', composeOk, composeDetail, compose.out);

  const current = run('node', ['tools/proofs/run-current.mjs'], { allowFail: true });
  record('run-current', current.status === 0, current.out.trim().split('\n').pop(), current.out);

  for (const proof of proofs) {
    const r = run('node', [proof], { allowFail: true });
    record(proof, r.status === 0, `exit ${r.status}`, r.out);
  }

  const parity = parityFailRows();
  const added = parity.rows.filter(row => !parityBaseline.includes(row));
  record('data-contract parity (no new FAIL rows)', added.length === 0,
    `${parity.rows.length} FAIL row(s), ${added.length} new${added.length ? `: ${added.join(' | ')}` : ''}`, parity.out);

  if (rollbackTo) {
    const rb = run('node', ['tools/rollback.mjs', '--to', rollbackTo, '--reason', 'release readiness', '--dry-run'], { allowFail: true });
    record(`rollback.mjs --to ${rollbackTo} --dry-run`, rb.status === 0, `exit ${rb.status}`, rb.out);
  }
  return { rows, log, parityRows: parity.rows };
}

export function printGates(rows) {
  const width = Math.max(...rows.map(r => r.gate.length));
  for (const r of rows) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.gate.padEnd(width)}  ${r.detail}`);
}

export function commitWithMessage(message) {
  run('git', ['commit', '-q', '-F', '-'], { input: message });
  return git('rev-parse', 'HEAD');
}

export function trailerBlock(trailers) {
  return trailers.length ? `\n\n${trailers.join('\n')}` : '';
}
