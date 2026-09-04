/**
 * Run every proof the build lane owns, in order, and write one receipt.
 *
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * The promotion lane (.github/workflows/202609042220-promotion-lane-promote.yml)
 * must confirm, through the GitHub API, that "the named proof run succeeded
 * for that exact commit" before it will fast-forward main. That check is
 * only as good as what the run it is trusting actually measured. Four
 * separate `run:` steps each passing or failing independently give the API
 * four conclusions to reconcile, and a workflow edit that silently drops a
 * step produces a green run that proved less than it used to, with nothing
 * that reads the run's conclusion able to tell. One receipt, naming every
 * proof this generation was required to pass, is the thing the promotion
 * lane's API check actually inspects.
 *
 *   node tools/proofs/promotion-receipt.mjs --out work/promotion-receipt.json
 *
 * The UTC stamp inside the receipt is read from the clock at the moment
 * this script runs (`new Date().toISOString()`), never typed or passed in
 * -- the same discipline tools/recompose.mjs applies to a generation stamp.
 *
 * Exit code is 0 only if every proof in PROOFS passed. A proof that could
 * not even start (missing file, module error) counts as FAIL, never SKIP:
 * this repository's own convention (tools/proofs/run-current.mjs) treats a
 * missing proof as a failure, not an absence to shrug at.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson } from '../scope/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function argv(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const outPath = path.resolve(ROOT, argv('--out', 'work/promotion-receipt.json'));

/* Every proof the build lane is required to run for a candidate to be
   eligible for promotion. Composed-cartridge proofs are resolved from the
   composition itself (run-current.mjs), never named here by generation, so
   this list does not go stale the next time a generation is cut. The two
   browser proofs are named explicitly because they are cross-cutting
   (they exercise the phone arrival path, not one cartridge), the same
   reason 202608312212-cartridge-proof.yml names them explicitly today. */
const PROOFS = [
  { name: 'composition matches what is declared and hashed', command: ['node', 'tools/scope/verify-compose.mjs'] },
  { name: 'every composed cartridge passes its own proof', command: ['node', 'tools/proofs/run-current.mjs'] },
  { name: 'mobile deep-link arrival is not stranded while the tab is hidden', command: ['node', 'tools/proofs/deep-link-visibility.browser.mjs'] },
  { name: 'mobile arrival identity, absence, failure and retry are executable', command: ['node', 'tools/proofs/202609040229-arrival-identity.browser.mjs'] }
];

const currentPath = path.join(ROOT, 'atlas', 'current.json');
const current = fs.existsSync(currentPath) ? readJson(currentPath) : {};

function commitSha() {
  const result = spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

const results = [];
for (const proof of PROOFS) {
  const startedAt = Date.now();
  const run = spawnSync(proof.command[0], proof.command.slice(1), {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  const durationMs = Date.now() - startedAt;
  const status = run.status === 0 ? 'PASS' : 'FAIL';
  const tail = (text) => String(text || '').split('\n').slice(-40).join('\n');
  results.push({
    name: proof.name,
    command: proof.command.join(' '),
    status,
    duration_ms: durationMs,
    stdout_tail: tail(run.stdout),
    stderr_tail: tail(run.stderr)
  });
  console.log(`[promotion-receipt] ${status}  ${proof.name}  (${durationMs}ms)`);
}

const overall = results.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';
const receipt = {
  schema: 'gridatlas.promotion-receipt.v1',
  generation: current.generation || null,
  version: current.composition_version || null,
  commit: commitSha(),
  utc_stamp: new Date().toISOString(),
  overall,
  proofs: results.map(({ stdout_tail, stderr_tail, ...rest }) => rest),
  // Kept out of the top-level object but not discarded: a failing proof's
  // last output is exactly what a promotion-authority reviewer needs and
  // exactly what a GitHub comment must NOT be flooded with.
  proof_output: Object.fromEntries(results.map(row => [row.name, { stdout_tail: row.stdout_tail, stderr_tail: row.stderr_tail }]))
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(`\nreceipt=${path.relative(ROOT, outPath)} overall=${overall}`);

// A comment-ready summary: generation, version, commit, and a pass/fail
// line per proof, short enough to paste into a PR comment or a step summary
// without truncation.
const commentLines = [
  `**Promotion build receipt** — generation \`${receipt.generation}\` · version \`${receipt.version}\` · commit \`${(receipt.commit || '').slice(0, 12)}\` · ${receipt.utc_stamp}`,
  '',
  ...results.map(row => `- ${row.status === 'PASS' ? '✅' : '❌'} ${row.name} (${row.duration_ms}ms)`),
  '',
  `Overall: **${overall}**`
];
const commentPath = `${outPath}.md`;
fs.writeFileSync(commentPath, `${commentLines.join('\n')}\n`, 'utf8');
console.log(`comment=${path.relative(ROOT, commentPath)}`);

if (overall !== 'PASS') process.exitCode = 1;
