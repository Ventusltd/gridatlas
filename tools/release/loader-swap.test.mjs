/**
 * Offline tests of the loader-only step (tools/release/loader-swap.mjs), the
 * pr-gate rule that calls it, and the guarded loader rollback in
 * rollback-generation.mjs. Run by tools/ci/pr-gate.mjs (release-tools).
 * No network. The CLI cases run in a throwaway git worktree of HEAD with this
 * tree's tools/ copied in; nothing in the repository is changed.
 *
 *   node --test tools/release/loader-swap.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ATLAS_LOADERS } from '../scope/lib.mjs';
import { ROOT, deriveCurrent } from './lib.mjs';
import { proveLoaderSwap } from './loader-swap.mjs';

const V1 = fs.readFileSync(path.join(ROOT, ATLAS_LOADERS.v1.payload));
const V2 = fs.readFileSync(path.join(ROOT, ATLAS_LOADERS.v2.payload));
// The replace-script fixture is pinned to L3 (202610281340), derived exactly as its release wrote atlas/current.json,
// so these tests keep their coverage whatever is live (R-cifix MINOR).
const L3 = '202610281340';
const LIVE = deriveCurrent(fs.readFileSync(path.join(ROOT, `atlas/manifests/${L3}-composition.json`), 'utf8'));
// A modular generation's pointer (after-cartridge slots), derived as release-generation.mjs writes it.
const MODULAR = fs.readdirSync(path.join(ROOT, 'atlas/manifests')).filter(f => /^\d{12}-composition\.json$/.test(f)).sort().reverse()
  .map(f => fs.readFileSync(path.join(ROOT, 'atlas/manifests', f), 'utf8')).find(t => /"slot": "after-cartridge"/.test(t) && !/REJECTED/.test(t));
const MODULAR_POINTER = deriveCurrent(MODULAR);

test('v1 -> v2 is a proven loader-only change for a replace-script live pointer', async () => {
  const r = await proveLoaderSwap({ fromLoader: V1, toLoader: V2, pointerText: LIVE });
  assert.equal(r.ok, true, r.reasons.join('; '));
  assert.equal(r.from.name, 'v1');
  assert.equal(r.to.name, 'v2');
  assert.match(r.detail, /identical/);
});

test('v2 -> v1 (loader rollback) is allowed while a replace-script pointer is live', async () => {
  const r = await proveLoaderSwap({ fromLoader: V2, toLoader: V1, pointerText: LIVE });
  assert.equal(r.ok, true, r.reasons.join('; '));
});

test('v2 -> v1 is refused while a modular generation is live: pointer first, then the loader', async () => {
  assert.ok(MODULAR, 'no modular manifest to test with');
  const r = await proveLoaderSwap({ fromLoader: V2, toLoader: V1, pointerText: MODULAR_POINTER });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /cannot compose slot\(s\) after-cartridge .*roll the pointer back first/);
});

test('an unregistered loader is refused, even one byte off v2', async () => {
  const r = await proveLoaderSwap({ fromLoader: V1, toLoader: Buffer.concat([V2, Buffer.from('\n')]), pointerText: LIVE });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /not a registered loader/);
});

test('a pointer neither loader can compose is refused (a cartridge hash off by one digit)', async () => {
  const p = JSON.parse(LIVE);
  const c = p.cartridges.find(x => x.id === p.cartridge_order[0]);
  c.sha256 = (c.sha256[0] === '0' ? '1' : '0') + c.sha256.slice(1);
  const r = await proveLoaderSwap({ fromLoader: V1, toLoader: V2, pointerText: `${JSON.stringify(p, null, 1)}\n` });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /does not compose/);
});

/* ---------- the CLI the gate calls, and the rollback guard, in a throwaway worktree ---------- */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-swap-'));
  const wt = path.join(dir, 'wt');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'loader-swap test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'loader-swap test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const g = (args, cwd = wt) => spawnSync('git', args, { cwd, encoding: 'utf8', env });
  const add = g(['worktree', 'add', '-q', '--detach', wt, 'HEAD'], ROOT);
  if (add.status !== 0) throw new Error(add.stderr);
  // this tree's tools (possibly uncommitted) over HEAD's
  fs.cpSync(path.join(ROOT, 'tools'), path.join(wt, 'tools'), { recursive: true });
  const commit = (msg) => { g(['add', '-A']); const r = g(['commit', '-q', '--no-verify', '--allow-empty', '-m', msg]); if (r.status !== 0) throw new Error(r.stderr); return g(['rev-parse', 'HEAD']).stdout.trim(); };
  const node = (args) => spawnSync('node', args, { cwd: wt, encoding: 'utf8' });
  const cleanup = () => { g(['worktree', 'remove', '--force', wt], ROOT); fs.rmSync(dir, { recursive: true, force: true }); };
  return { wt, g, commit, node, cleanup };
}

test('gate CLI: loader-only v1 -> v2 passes; v2 -> v1 under a modular live pointer fails', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1); fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), LIVE);
    const base = s.commit('base: v1 live loader, L3 live');
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V2);
    let r = s.node(['tools/release/loader-swap.mjs', 'check', '--base', base]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^PASS loader-only change v1 -> v2/m);
    // an unregistered loader is refused by the same check
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), Buffer.concat([V2, Buffer.from('<!-- x -->\n')]));
    r = s.node(['tools/release/loader-swap.mjs', 'check', '--base', base]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^FAIL .*not a registered loader/m);
    // modular pointer live behind v2, loader back to v1 alone
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V2);
    fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), MODULAR_POINTER);
    const modularBase = s.commit('modular live behind v2');
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1);
    r = s.node(['tools/release/loader-swap.mjs', 'check', '--base', modularBase]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /roll the pointer back first/);
  } finally { s.cleanup(); }
});

test('rollback-generation refuses a loader-only revert while a generation needing the newer loader is live', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1); fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), LIVE);
    s.commit('base: v1 live loader, L3 live');
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V2);
    const step1 = s.commit('step 1: loader v2 alone');
    fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), MODULAR_POINTER);
    const head = s.commit('step 2 (pointer only; STATE.md not regenerated in this fixture)');
    const r = s.node(['tools/release/rollback-generation.mjs', '--release-commit', step1, '--reason', 'test', '--base', head, '--no-commit']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /refusing the loader rollback v2 -> v1: .*roll the pointer back first, then the loader/);
    assert.equal(s.g(['rev-parse', 'HEAD']).stdout.trim(), head, 'nothing committed, HEAD unchanged');
    assert.equal(s.g(['status', '--porcelain']).stdout, '', 'nothing written');
  } finally { s.cleanup(); }
});

test('rollback-generation refuses a loader-only revert when the loader has moved since', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1); fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), LIVE);
    s.commit('base');
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V2);
    const step1 = s.commit('step 1');
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1);
    const head = s.commit('loader moved again');
    const r = s.node(['tools/release/rollback-generation.mjs', '--release-commit', step1, '--reason', 'test', '--base', head, '--no-commit']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /has moved since/);
  } finally { s.cleanup(); }
});

test('release-generation refuses a one-step v1 -> v2 release of a modular generation unless --allow-loader-follows (R-cifix MAJOR)', () => {
  const G = JSON.parse(MODULAR).generation, s = sandbox();
  try {
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V1); fs.writeFileSync(path.join(s.wt, 'atlas/current.json'), LIVE);
    const head = s.commit('base: v1 live loader, L3 live');
    let r = s.node(['tools/release/release-generation.mjs', '--generation', G, '--base', head, '--expect-live', L3, '--check']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /the live loader \(v1\) cannot compose slot\(s\) after-cartridge .*release the loader first/);
    r = s.node(['tools/release/release-generation.mjs', '--generation', G, '--base', head, '--expect-live', L3, '--check', '--allow-loader-follows']);
    assert.doesNotMatch(r.stderr, /cannot compose slot/, 'the explicit override passes this precondition');
    assert.match(r.stdout, /LOADER_FOLLOWS/);
    // loader first: with v2 live, the same release is LOADER_IDENTICAL and needs no override
    fs.writeFileSync(path.join(s.wt, 'atlas/index.html'), V2); const head2 = s.commit('step 1: loader v2');
    r = s.node(['tools/release/release-generation.mjs', '--generation', G, '--base', head2, '--expect-live', L3, '--check']);
    assert.match(r.stdout, /LOADER_IDENTICAL/, r.stdout + r.stderr); assert.doesNotMatch(r.stderr, /cannot compose slot/);
  } finally { s.cleanup(); }
});
