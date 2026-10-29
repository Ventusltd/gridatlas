#!/usr/bin/env node
/**
 * Step 4 of the delivery flow: release an ACCEPTED preview generation.
 *
 *   node tools/release/release-accepted.mjs --generation G [--title TEXT] [--trailer TEXT ...]
 *        [--report FILE] [--log FILE] [--push] [--body-file FILE] [--base REV] [--branch NAME]
 *   node tools/release/release-accepted.mjs --generation G --rehearsal [...]   (no acceptance needed; never pushes)
 *
 * PRE-CONDITIONS
 *   - the owner's acceptance of G is on GitHub (tools/release/acceptance.mjs: exit 0);
 *   - G's preview is merged: its files are on origin/main (release-generation.mjs
 *     re-checks every byte), and the preview PR's CI (pr-file-size-guard.yml) is green;
 *   - this checkout is a clean worktree whose HEAD is origin/main.
 *
 * WHAT IT DOES
 *   1. Reads the acceptance and the preview PR's checks.
 *   2. Runs tools/release/release-generation.mjs with
 *      --authorised-by "owner (<login>) <comment or label URL>, <UTC time>"
 *      so the commit carries the acceptance record. All of that script's
 *      preconditions and gates apply unchanged (see docs/RELEASE.md).
 *   3. --push: pushes release/G-gridatlas-<version> and opens a DRAFT PR.
 *      CI (the PR gate) runs on it. The owner merges with REBASE AND MERGE:
 *        gh api -X PUT repos/Ventusltd/gridatlas/pulls/<N>/merge -f merge_method=rebase
 *      never squash (a squash folds preparatory commits into the release commit).
 *
 * --rehearsal skips the acceptance read, writes the branch as
 * rehearsal/release-G and refuses --push: the whole release short of
 * publishing, on a local branch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs, run, git } from './lib.mjs';
import { GRIDATLAS, readAcceptance, cutAtUtc, prsNaming, prFiles, classifyPr, checkRunsFor, openDraftPr, gh } from './flow-lib.mjs';

const TOOL = 'release-accepted';
const die = (m) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(1); };
const ok = (m) => console.log(`  OK    ${m}`);

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    generation: {}, title: {}, trailer: { multi: true }, report: {}, log: {}, push: { bool: true },
    'body-file': {}, rehearsal: { bool: true }, branch: {}, base: {}
  });
} catch (error) { die(error.message); }
const G = args.generation;
if (!G || !/^\d{12}$/.test(G)) die('--generation G (12 digits) is required');
if (args.rehearsal && args.push) die('--rehearsal never pushes');

console.log(`\n== acceptance and preview of ${G}`);
let authorisedBy;
const pulls = gh(`repos/${GRIDATLAS}/pulls?state=all&per_page=100&sort=created&direction=desc`);
const previews = prsNaming(G, { pulls }).filter(p => classifyPr(p, prFiles(p.number), G) === 'preview');
if (!previews.length) die(`no preview PR adds atlas/v/${G}/current.json`);
const preview = previews.find(p => p.merged_at) || previews[0];
if (!preview.merged_at) die(`preview PR #${preview.number} is not merged; merge it (rebase) first`);
ok(`preview PR #${preview.number} merged ${preview.merged_at}`);
const checks = checkRunsFor(GRIDATLAS, preview.head.sha);
const red = checks.filter(c => c.status === 'completed' && !['success', 'skipped', 'neutral'].includes(c.conclusion));
if (!checks.length) die(`preview PR #${preview.number} has no CI check runs on ${preview.head.sha}`);
if (red.length) die(`preview PR #${preview.number} CI is red: ${red.map(c => `${c.name}=${c.conclusion}`).join(', ')}`);
ok(`preview CI: ${checks.map(c => `${c.name}=${c.conclusion}`).join(', ')}`);

if (args.rehearsal) {
  authorisedBy = `REHEARSAL ONLY (no owner acceptance read; tools/release/release-accepted.mjs --rehearsal, ${new Date().toISOString()})`;
  console.log('  --     rehearsal: acceptance not required');
} else {
  const a = readAcceptance(G, { since: cutAtUtc(G) || undefined, pulls });
  for (const i of a.ignored) console.log(`  ignored: ${i.url}  ${i.why}`);
  if (a.state !== 'accepted') die(`${G} is not accepted (${a.state}). The owner records it: node tools/release/acceptance.mjs --generation ${G} --how --pr ${preview.number}`);
  authorisedBy = `owner (${a.by}), ${a.url}, ${a.at}`;
  ok(`accepted: ${authorisedBy}`);
}

console.log('\n== tools/release/release-generation.mjs');
const branch = args.branch || (args.rehearsal ? `rehearsal/release-${G}` : undefined);
const argv = ['tools/release/release-generation.mjs', '--generation', G, '--authorised-by', authorisedBy];
if (branch) argv.push('--branch', branch);
if (args.base) argv.push('--base', args.base);
if (args.title) argv.push('--title', args.title);
for (const t of args.trailer) argv.push('--trailer', t);
if (args.report) argv.push('--report', path.resolve(args.report));
if (args.log) argv.push('--log', path.resolve(args.log));
const r = spawnSync('node', argv, { cwd: ROOT, stdio: 'inherit' });
if (r.status !== 0) die(`release-generation.mjs exit ${r.status}`);

const head = git('rev-parse', 'HEAD');
const current = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFail: true }).stdout.trim();
if (!current || git('rev-parse', args.base || 'origin/main') === head) { console.log('nothing committed (no-op release)'); process.exit(0); }
if (!args.push) {
  console.log(`\n== not pushed. To publish:\n  git push -u origin ${current}\n` +
    `  gh api -X POST repos/${GRIDATLAS}/pulls -f head=${current} -f base=main -F draft=true -f title='...' -F body=@<body.md>\n` +
    `then, once CI is green and the owner merges with rebase: node tools/release/check-live.mjs --generation ${G} --wait`);
  process.exit(0);
}
run('git', ['push', '-u', 'origin', current]);
const subject = git('log', '-1', '--format=%s');
const body = args['body-file'] ? fs.readFileSync(path.resolve(args['body-file']), 'utf8')
  : `Release of ${G}, accepted by ${authorisedBy}.\n\nPreview: #${preview.number}. Only atlas/current.json and STATE.md change.\n\n` +
    `Merge with **Rebase and merge** (never squash). Rollback: \`node tools/release/rollback-generation.mjs --release-commit <sha on main>\`.\n`;
const pr = openDraftPr({ head: current, title: subject, body });
ok(`draft release PR #${pr.number} ${pr.html_url}`);
console.log(`next: CI on #${pr.number}; owner merges with rebase; then node tools/release/check-live.mjs --generation ${G} --wait`);
