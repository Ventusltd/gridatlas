#!/usr/bin/env node
/**
 * Roll a release back by reverting its release commit (route C of
 * RELEASE-COMMANDS.md) and prove the pointer is restored byte for byte.
 *
 *   node tools/release/rollback-generation.mjs --release-commit SHA --reason "..." [options]
 *
 * Route C versus tools/rollback.mjs (route B): rollback.mjs cuts a NEW
 * generation carrying an older composition, so its bytes differ from what was
 * live before by design. Reverting the release commit instead restores the
 * exact pre-release atlas/current.json and STATE.md, which is only possible
 * because release-generation.mjs keeps the release commit to those two files.
 *
 * Preconditions, nothing written:
 *   - clean tree, HEAD exactly --base (default origin/main);
 *   - SHA is a single-parent ancestor of HEAD that changed exactly
 *     atlas/current.json and STATE.md, or those and atlas/index.html (a
 *     release that moved the loader with the pointer, docs/LIGHTNING-CARTRIDGE.md);
 *   - the pointer has not moved since: HEAD:atlas/current.json is SHA's bytes
 *     (and HEAD:atlas/index.html too, when SHA moved it).
 * Then, on a new branch: `git revert --no-commit SHA`, and
 *   - atlas/current.json sha256 == SHA^:atlas/current.json (byte-exact);
 *   - STATE.md sha256 == SHA^:STATE.md when nothing touched STATE.md since the
 *     release (otherwise it must still equal the generator; reported);
 *   - lint, state parity, verify-compose (the predecessor), run-current,
 *     data-contract parity (no new FAIL rows).
 * Then the revert commit. It never pushes.
 *
 * Options
 *   --release-commit SHA   the release commit to revert (required)
 *   --reason TEXT          why (required; recorded in the commit)
 *   --base REV             HEAD must equal this (default origin/main)
 *   --branch NAME          default rollback/<G>-to-<P>
 *   --trailer TEXT         appended to the commit message (repeatable)
 *   --no-commit            leave the revert uncommitted for inspection
 *   --report FILE / --log FILE
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, POINTER_FILES, LOADER_FILE, die as dieWith, parseArgs, run, git, gitOk, gitBlob, sha256, sha256File,
  cleanTree, changedPaths, runGates, printGates, parityFailRows, commitWithMessage, trailerBlock
} from './lib.mjs';

const TOOL = 'rollback-generation';
const die = (m) => dieWith(TOOL, m);
const step = (m) => console.log(`\n== ${m}`);
const ok = (m) => console.log(`  OK    ${m}`);

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    'release-commit': {}, reason: {}, base: { default: 'origin/main' }, branch: {},
    trailer: { multi: true }, 'no-commit': { bool: true }, report: {}, log: {}
  });
} catch (error) { die(error.message); }
if (!args['release-commit']) die('--release-commit is required');
if (!args.reason) die('--reason is required; an unexplained pointer move is not a rollback');

const report = { tool: TOOL, root: ROOT, started_utc: new Date().toISOString() };
const finish = (code) => {
  report.finished_utc = new Date().toISOString();
  report.exit = code;
  if (args.report) fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 1)}\n`);
  process.exit(code);
};

step('preconditions');
if (!cleanTree()) die(`working tree is not clean:\n${changedPaths().join('\n')}`);
if (!gitOk('rev-parse', '--verify', '--quiet', `${args.base}^{commit}`)) die(`--base ${args.base} does not resolve`);
const baseSha = git('rev-parse', `${args.base}^{commit}`);
if (git('rev-parse', 'HEAD') !== baseSha) die(`HEAD is not ${args.base} ${baseSha}`);
ok(`clean tree, HEAD = ${args.base} = ${baseSha}`);

if (!gitOk('rev-parse', '--verify', '--quiet', `${args['release-commit']}^{commit}`)) die(`${args['release-commit']} is not a commit`);
const R = git('rev-parse', `${args['release-commit']}^{commit}`);
if (!gitOk('merge-base', '--is-ancestor', R, 'HEAD')) die(`${R} is not an ancestor of HEAD`);
const parents = git('rev-list', '--parents', '-n', '1', R).split(' ').slice(1);
if (parents.length !== 1) die(`${R} has ${parents.length} parents; revert a single release commit, not a merge`);
const touched = git('diff', '--name-only', `${R}^`, R).split('\n').filter(Boolean).sort();
const loaderMoved = touched.includes(LOADER_FILE);
const RELEASE_FILES = loaderMoved ? [...POINTER_FILES, LOADER_FILE] : [...POINTER_FILES];
if (JSON.stringify(touched) !== JSON.stringify([...RELEASE_FILES].sort())) die(`${R} changed ${touched.join(', ')}; a release commit changes exactly ${POINTER_FILES.join(' and ')} (and ${LOADER_FILE} when the loader moved)`);
ok(`${R.slice(0, 7)} is a single-parent release commit touching ${touched.join(', ')}`);

const releasedPointer = gitBlob(R, 'atlas/current.json');
const restoredPointer = gitBlob(`${R}^`, 'atlas/current.json');
const restoredState = gitBlob(`${R}^`, 'STATE.md');
const G = JSON.parse(releasedPointer.toString('utf8')).generation;
const P = JSON.parse(restoredPointer.toString('utf8')).generation;
const livePointer = gitBlob('HEAD', 'atlas/current.json');
if (Buffer.compare(livePointer, releasedPointer) !== 0) die(`atlas/current.json has moved since ${R.slice(0, 7)} (live is ${JSON.parse(livePointer).generation}); reverting would not restore a known state`);
if (loaderMoved && Buffer.compare(gitBlob('HEAD', LOADER_FILE), gitBlob(R, LOADER_FILE)) !== 0) die(`${LOADER_FILE} has moved since ${R.slice(0, 7)}; reverting would not restore a known state`);
const stateUntouchedSince = Buffer.compare(gitBlob('HEAD', 'STATE.md'), gitBlob(R, 'STATE.md')) === 0;
ok(`live is ${G} exactly as ${R.slice(0, 7)} wrote it; rollback restores ${P}`);
Object.assign(report, { release_commit: R, from: G, to: P, base: baseSha,
  expected: { 'atlas/current.json': sha256(restoredPointer), 'STATE.md': sha256(restoredState),
    ...(loaderMoved ? { [LOADER_FILE]: sha256(gitBlob(`${R}^`, LOADER_FILE)) } : {}) },
  before: Object.fromEntries(RELEASE_FILES.map(f => [f, sha256File(f)])) });

const parityBaseline = parityFailRows().rows;

const branch = args.branch || `rollback/${G}-to-${P}`;
if (gitOk('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) die(`branch ${branch} already exists`);
run('git', ['switch', '-q', '-c', branch]);
step(`branch ${branch}: git revert --no-commit ${R.slice(0, 7)}`);
const revert = run('git', ['revert', '--no-commit', R], { allowFail: true });
const abort = () => { run('git', ['revert', '--abort'], { allowFail: true }); run('git', ['switch', '-q', '--detach', baseSha]); run('git', ['branch', '-D', branch], { allowFail: true }); };
if (revert.status !== 0) { abort(); die(`git revert did not apply cleanly:\n${revert.out}`); }

const after = Object.fromEntries(RELEASE_FILES.map(f => [f, sha256File(f)]));
report.after = after;
if (after['atlas/current.json'] !== report.expected['atlas/current.json']) { abort(); die('atlas/current.json is NOT byte-exact to the pre-release pointer'); }
ok(`atlas/current.json byte-exact to ${R.slice(0, 7)}^ (${after['atlas/current.json']})`);
if (loaderMoved) {
  if (after[LOADER_FILE] !== report.expected[LOADER_FILE]) { abort(); die(`${LOADER_FILE} is NOT byte-exact to the pre-release loader`); }
  ok(`${LOADER_FILE} byte-exact to ${R.slice(0, 7)}^ (${after[LOADER_FILE]})`);
}
const stateExact = after['STATE.md'] === report.expected['STATE.md'];
if (stateUntouchedSince && !stateExact) { abort(); die('STATE.md is NOT byte-exact to the pre-release STATE.md'); }
ok(stateExact ? `STATE.md byte-exact to ${R.slice(0, 7)}^ (${after['STATE.md']})` : 'STATE.md changed after the release for another reason; checked against the generator instead');
report.byte_exact = { 'atlas/current.json': true, 'STATE.md': stateExact, ...(loaderMoved ? { [LOADER_FILE]: true } : {}) };

step('gates');
const gates = runGates({ expectGeneration: P, parityBaseline });
printGates(gates.rows);
if (args.log) fs.writeFileSync(path.resolve(args.log), gates.log);
report.gates = gates.rows;
if (!gates.rows.every(r => r.ok)) { abort(); console.error(`\n${TOOL}: gates FAILED; nothing kept.`); finish(1); }

if (!args['no-commit']) {
  const subject = git('log', '-1', '--format=%s', R);
  const msg = `Revert "${subject}"\n\nThis reverts commit ${R}.\n\nRolls the live route back from ${G} to ${P} by reverting the release commit\n(route C): atlas/current.json${loaderMoved ? `, ${LOADER_FILE}` : ''} and STATE.md are byte-identical to ${R.slice(0, 7)}^.\nReason: ${args.reason}${trailerBlock(args.trailer)}\n`;
  report.revert_commit = commitWithMessage(msg);
  report.revert_tree = git('rev-parse', 'HEAD^{tree}');
}

step('hashes');
for (const f of RELEASE_FILES) console.log(`  ${f.padEnd(20)} released ${report.before[f]}\n  ${''.padEnd(20)} restored ${after[f]}${report.byte_exact[f] ? '  (byte-exact)' : ''}`);
if (report.revert_commit) console.log(`  revert commit        ${report.revert_commit}\n  revert tree          ${report.revert_tree}`);
console.log(`\nROLLBACK READY on branch ${branch} (not pushed): live would return to ${P}.`);
finish(0);
