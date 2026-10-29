#!/usr/bin/env node
/**
 * The live loader on its own: step 1 (and its rollback) of a two-step release
 * of a generation whose own loader differs from the live one (docs/RELEASE.md
 * "Loader first, then the pointer"; docs/LIGHTNING-CARTRIDGE.md "Cache window").
 *
 * atlas/index.html may change WITHOUT atlas/current.json only when every one
 * of these holds against the pointer that stays live:
 *   - the new loader is a REGISTERED loader (tools/scope/lib.mjs ATLAS_LOADERS);
 *   - it supports every slot the live pointer uses (so a loader rollback is
 *     refused while a generation that needs the newer loader is live: roll the
 *     pointer back first, then the loader);
 *   - run verbatim in node:vm (tools/proofs/loader-composition.mjs), it writes
 *     byte-for-byte the HTML, and byte-identical cartridge blobs, that the
 *     loader it replaces writes for the live pointer, and neither fails.
 *
 *   node tools/release/loader-swap.mjs check [--base REV]
 *       HEAD's working-tree atlas/index.html against REV's (default origin/main),
 *       for the working-tree atlas/current.json. Used by tools/ci/pr-gate.mjs
 *       (loader-registry) when a PR changes atlas/index.html alone.
 *
 *   node tools/release/loader-swap.mjs release --to v2 --authorised-by TEXT
 *        [--base origin/main] [--branch release/loader-<to>-<live gen>]
 *        [--trailer TEXT ...] [--report FILE] [--log FILE]
 *       Step 1: clean tree at --base; prove the swap; write
 *       atlas/index.html := the registered payload; every release gate
 *       (lint, state parity, verify-compose of the unchanged live generation,
 *       run-current, data-contract parity, loader-equivalence); one commit that
 *       changes atlas/index.html only, on a new local branch. Never pushes.
 *
 * Its revert is tools/release/rollback-generation.mjs --release-commit <sha>,
 * which accepts a loader-only commit under the same proof.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ATLAS_LOADERS } from '../scope/lib.mjs';
import { compose } from '../proofs/loader-composition.mjs';
import {
  ROOT, LOADER_FILE, registeredLoaderOf, pointerSlots, parseArgs, run, git, gitOk, gitBlob, sha256,
  cleanTree, changedPaths, runGates, printGates, parityFailRows, commitWithMessage, trailerBlock
} from './lib.mjs';

/** Prove that `toLoader` may replace `fromLoader` while `pointerText` stays
    live. Pure apart from reading the working tree through compose(). */
export async function proveLoaderSwap({ fromLoader, toLoader, pointerText }) {
  const reasons = [];
  const from = registeredLoaderOf(fromLoader);
  const to = registeredLoaderOf(toLoader);
  let pointer;
  try { pointer = JSON.parse(String(pointerText)); } catch (e) { return { ok: false, from, to, reasons: [`atlas/current.json unreadable: ${e.message}`] }; }
  if (!to) reasons.push(`the new ${LOADER_FILE} is not a registered loader (tools/scope/lib.mjs ATLAS_LOADERS)`);
  const slots = pointerSlots(pointer);
  const missing = to ? slots.filter(s => !to.slots.includes(s)) : [];
  if (missing.length) reasons.push(`loader ${to.name} cannot compose slot(s) ${missing.join(', ')} of the live ${pointer.generation}; roll the pointer back first, then the loader`);
  let detail = '';
  if (!reasons.length) {
    const files = { 'atlas/current.json': String(pointerText) };
    const a = await compose({ loaderHtml: String(fromLoader), route: 'atlas/', files });
    const b = await compose({ loaderHtml: String(toLoader), route: 'atlas/', files });
    if (a.failed) reasons.push(`the replaced loader${from ? ` (${from.name})` : ''} does not compose the live ${pointer.generation}: ${a.message.replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`);
    if (b.failed) reasons.push(`loader ${to.name} does not compose the live ${pointer.generation}: ${b.message.replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`);
    if (!a.failed && !b.failed) {
      if (a.html !== b.html) reasons.push(`loader ${to.name} writes different HTML from ${from ? from.name : 'the replaced loader'} for the live ${pointer.generation}`);
      const same = a.scripts.length === b.scripts.length && a.scripts.every((s, i) => s.id === b.scripts[i].id && s.url === b.scripts[i].url && s.source.equals(b.scripts[i].source));
      if (!same) reasons.push(`loader ${to.name} hands different cartridge blobs from ${from ? from.name : 'the replaced loader'} for the live ${pointer.generation}`);
      detail = `${a.scripts.length} cartridge blob(s), HTML ${a.html.length} B, identical`;
    }
  }
  return { ok: reasons.length === 0, from, to, generation: pointer.generation, slots, reasons, detail };
}

const TOOL = 'loader-swap';
const die = (m) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(1); };
const ok = (m) => console.log(`  OK    ${m}`);

async function cliCheck(argv) {
  const args = parseArgs(argv, { base: { default: 'origin/main' } });
  if (!gitOk('rev-parse', '--verify', '--quiet', `${args.base}^{commit}`)) die(`--base ${args.base} does not resolve`);
  const fromLoader = gitBlob(args.base, LOADER_FILE);
  const toLoader = fs.readFileSync(path.join(ROOT, LOADER_FILE));
  const pointerText = fs.readFileSync(path.join(ROOT, 'atlas/current.json'), 'utf8');
  const r = await proveLoaderSwap({ fromLoader, toLoader, pointerText });
  const name = `${r.from?.name || 'unregistered'} -> ${r.to?.name || 'unregistered'}`;
  if (!r.ok) { console.log(`FAIL loader-only change ${name}: ${r.reasons.join('; ')}`); process.exit(1); }
  console.log(`PASS loader-only change ${name} for the live ${r.generation} (slots ${r.slots.join(', ')}): ${r.detail}`);
}

async function cliRelease(argv) {
  const args = parseArgs(argv, {
    to: {}, 'authorised-by': {}, base: { default: 'origin/main' }, branch: {}, trailer: { multi: true }, report: {}, log: {}
  });
  if (!args.to || !Object.hasOwn(ATLAS_LOADERS, args.to)) die(`--to must name a registered loader (${Object.keys(ATLAS_LOADERS).join(', ')})`);
  if (!args['authorised-by']) die('--authorised-by is required');
  const report = { tool: TOOL, mode: 'release', to: args.to, started_utc: new Date().toISOString() };
  const finish = (code) => { report.exit = code; if (args.report) fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 1)}\n`); process.exit(code); };

  console.log('\n== preconditions');
  if (!cleanTree()) die(`working tree is not clean:\n${changedPaths().join('\n')}`);
  if (!gitOk('rev-parse', '--verify', '--quiet', `${args.base}^{commit}`)) die(`--base ${args.base} does not resolve`);
  const baseSha = git('rev-parse', `${args.base}^{commit}`);
  if (git('rev-parse', 'HEAD') !== baseSha) die(`HEAD is not ${args.base} ${baseSha}`);
  ok(`clean tree, HEAD = ${args.base} = ${baseSha}`);
  const fromLoader = gitBlob('HEAD', LOADER_FILE);
  const toLoader = fs.readFileSync(path.join(ROOT, ATLAS_LOADERS[args.to].payload));
  if (Buffer.compare(fromLoader, toLoader) === 0) die(`${LOADER_FILE} is already loader ${args.to}`);
  const pointerText = gitBlob('HEAD', 'atlas/current.json').toString('utf8');
  const proof = await proveLoaderSwap({ fromLoader, toLoader, pointerText });
  Object.assign(report, { base: baseSha, live: proof.generation, from: proof.from?.name || null, proof });
  if (!proof.ok) die(proof.reasons.join('; '));
  ok(`${proof.from?.name} -> ${proof.to.name} composes the live ${proof.generation} byte for byte (${proof.detail})`);

  const parityBaseline = parityFailRows().rows;
  const branch = args.branch || `release/loader-${args.to}-${proof.generation}`;
  if (gitOk('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) die(`branch ${branch} already exists`);
  run('git', ['switch', '-q', '-c', branch]);
  const abort = () => { run('git', ['checkout', '-q', '--', LOADER_FILE], { allowFail: true }); run('git', ['switch', '-q', '--detach', baseSha]); run('git', ['branch', '-D', branch], { allowFail: true }); };
  fs.writeFileSync(path.join(ROOT, LOADER_FILE), toLoader);
  const changed = changedPaths();
  if (JSON.stringify(changed) !== JSON.stringify([LOADER_FILE])) { abort(); die(`expected only ${LOADER_FILE} to change, got ${changed.join(', ')}`); }

  console.log('\n== gates');
  const gates = runGates({ expectGeneration: String(proof.generation), parityBaseline });
  const eq = run('node', ['tools/proofs/loader-equivalence.proof.mjs'], { allowFail: true });
  gates.rows.push({ gate: 'loader-equivalence', ok: eq.status === 0, detail: eq.out.trim().split('\n').pop() });
  printGates(gates.rows);
  if (args.log) fs.writeFileSync(path.resolve(args.log), `${gates.log}\n### loader-equivalence\n${eq.out}`);
  report.gates = gates.rows;
  if (!gates.rows.every(r => r.ok)) { abort(); console.error(`\n${TOOL}: gates FAILED; nothing kept.`); finish(1); }

  run('git', ['add', '--', LOADER_FILE]);
  const msg = `live loader ${proof.from.name} -> ${proof.to.name} (atlas/index.html only; the pointer stays ${proof.generation})\n\n` +
    `Step 1 of a two-step release (docs/RELEASE.md "Loader first, then the pointer"): atlas/index.html := ${ATLAS_LOADERS[args.to].payload}.\n` +
    `For the live ${proof.generation} it writes byte-for-byte the HTML and cartridge blobs ${proof.from.name} writes (tools/release/loader-swap.mjs, ${proof.detail}).\n` +
    `Nothing else changes. Release the pointer only after check-served passes and at least 10 minutes have passed (the HTML cache window).\n` +
    `Rollback: git revert this commit (tools/release/rollback-generation.mjs --release-commit <sha>), only while the live pointer composes under ${proof.from.name}.\n\n` +
    `Authorised by: ${args['authorised-by']}${trailerBlock(args.trailer)}\n`;
  report.commit = commitWithMessage(msg);
  report.tree = git('rev-parse', 'HEAD^{tree}');
  report.hashes = { before: sha256(fromLoader), after: sha256(toLoader) };
  console.log(`\n  ${LOADER_FILE} ${report.hashes.before} -> ${report.hashes.after}\n  commit ${report.commit}\n\nLOADER RELEASE READY on branch ${branch} (not pushed).`);
  finish(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [mode, ...rest] = process.argv.slice(2);
  try {
    if (mode === 'check') await cliCheck(rest);
    else if (mode === 'release') await cliRelease(rest);
    else die('usage: loader-swap.mjs check [--base REV] | release --to v2 --authorised-by TEXT [--base REV] [--branch NAME]');
  } catch (e) { die(e.message); }
}
