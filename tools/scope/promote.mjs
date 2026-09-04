/**
 * Promote a proved candidate commit to refs/heads/main.
 *
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * An external review on 2026-09-04 found that v9.115 and v9.116 reached
 * main -- and so the served site, since gridatlas serves main straight to
 * GitHub Pages with no build workflow -- before their own proof workflow had
 * finished failing. The proof was a post-deployment alarm, not a gate.
 *
 * This tool is the gate. It is invoked ONLY by
 * .github/workflows/202609042220-promotion-lane-promote.yml, a
 * workflow_dispatch-only job that has already, before calling this tool:
 *   1. resolved --proof-run-id through the GitHub API and confirmed that
 *      run succeeded FOR THE EXACT COMMIT named by --commit;
 *   2. checked that commit out and run tools/scope/verify-compose.mjs
 *      against it, so the composition manifest and every cartridge hash it
 *      names are re-verified independently of whatever the build lane once
 *      measured.
 * This tool only does the two things neither of those steps can: refuse a
 * promotion that would not actually be a fast-forward, and refuse to cut a
 * second promotion record for input this lane has already promoted (or a
 * different commit under the same generation).
 *
 * `mode=check` runs BEFORE main is touched, using data available before any
 * push: the declared expected parent, and whatever atlas/current.json on
 * main's current tip already records as last_known_green. `mode=write`
 * runs AFTER the workflow has fast-forwarded main to the candidate commit
 * (git itself refuses that push if it is not a fast-forward, which is the
 * same guarantee `mode=check`'s expected-parent test gives earlier and with
 * a clearer message); it enriches last_known_green now that a
 * proof_run_id/url and a promotion timestamp exist, and regenerates
 * STATE.md in the same commit, per AGENTS.md.
 *
 *   node tools/scope/promote.mjs check  --generation 202609042220 \
 *     --commit <candidate 40-hex sha> --expected-parent <main tip 40-hex sha>
 *
 *   node tools/scope/promote.mjs write  --generation 202609042220 \
 *     --commit <candidate 40-hex sha, now HEAD>          \
 *     --proof-run-id 123456789 --proof-run-url https://github.com/.../runs/123456789
 *
 * WHAT THIS TOOL NEVER DOES
 * ------------------------------------------------------------------------
 * It never runs `git push`. The workflow performs the fast-forward push
 * itself, as a plain (non---force) push, so a race that slipped past
 * `mode=check`'s expected-parent test is still caught by Git's own
 * fast-forward-only rule. It never composes a new generation -- that
 * remains tools/recompose.mjs, run on the candidate branch before any of
 * this. It never rewrites atlas/releases/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, readJson, sha256PublishedFile, invariant, githubOutput } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
void HERE;

// atlas/current.json and .cvaa/contracts/*.json are both hand-authored with
// a 1-space indent (tools/recompose.mjs writes current.json the same way);
// lib.mjs's own writeJson uses 2 spaces for its own generated files, and
// using it here would reformat every unrelated line the first time either
// file is touched.
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 1)}\n`, 'utf8');
}

function argv(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function die(message) {
  console.error(`promote: ${message}`);
  process.exit(1);
}

function git(...args) {
  const result = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
  if (result.status !== 0) die(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

const mode = process.argv[2];
if (mode !== 'check' && mode !== 'write') die('first argument must be "check" or "write"');

const generation = argv('--generation');
const commit = argv('--commit');
if (!/^\d{12}$/.test(String(generation))) die('--generation must be YYYYMMDDHHMM (UTC)');
if (!/^[0-9a-f]{40}$/.test(String(commit))) die('--commit must be an exact 40-hex Git object id');

const currentPath = path.join(ROOT, 'atlas', 'current.json');
const current = readJson(currentPath);

if (mode === 'check') {
  const expectedParent = argv('--expected-parent');
  if (!/^[0-9a-f]{40}$/.test(String(expectedParent))) die('--expected-parent must be an exact 40-hex Git object id');

  // Serial, not merely concurrency-grouped: re-read the live tip now, at the
  // moment of the decision, rather than trusting a value computed earlier
  // in the same job.
  const mainTip = git('rev-parse', 'HEAD');
  if (mainTip !== expectedParent) {
    die(`expected_parent mismatch: --expected-parent ${expectedParent} but refs/heads/main is now ${mainTip}. `
      + 'main moved since this promotion was decided; re-run the promotion lane against the new tip.');
  }

  if (commit === mainTip) {
    die(`no-op: ${commit} is already the tip of main. An unchanged input must not cut a new promotion record.`);
  }

  const isAncestor = spawnSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', mainTip, commit]).status === 0;
  if (!isAncestor) {
    die(`${commit} does not have refs/heads/main's current tip (${mainTip}) as an ancestor; `
      + 'fast-forwarding to it would not be a fast-forward. Rebase the candidate branch and re-run the build lane.');
  }

  const green = current.last_known_green || {};
  if (green.generation === generation) {
    if (green.commit === commit) {
      console.log(`same-input replay: ${generation} at ${commit} is already the current last_known_green; `
        + 'nothing to promote, nothing pushed. This is success, not an error.');
      githubOutput({ replay: 'true' });
      process.exit(0);
    }
    die(`divergent reuse: generation ${generation} was already promoted at commit ${green.commit}, `
      + `not ${commit}. A generation identity is written once -- the same rule tools/recompose.mjs `
      + 'enforces for a composition file (it refuses to rewrite an existing generation; '
      + 'see tools/recompose.mjs, "refusing to rewrite an existing composition").');
  }

  // Confirm the candidate commit actually names the generation being
  // promoted, reading its committed bytes rather than trusting the input.
  const shown = spawnSync('git', ['-C', ROOT, 'show', `${commit}:atlas/current.json`], { encoding: 'utf8' });
  if (shown.status !== 0) die(`${commit}:atlas/current.json could not be read: ${shown.stderr}`);
  const candidateCurrent = JSON.parse(shown.stdout);
  invariant(candidateCurrent.generation === generation,
    `${commit} composes generation ${candidateCurrent.generation}, not the requested ${generation}`);

  console.log(`check=PASS generation=${generation} commit=${commit} expected_parent=${expectedParent}`);
  githubOutput({ replay: 'false' });
  process.exit(0);
}

// mode === 'write': main has already been fast-forwarded to `commit` by the
// calling workflow; this process's working tree is that commit.
const headNow = git('rev-parse', 'HEAD');
invariant(headNow === commit, `mode=write expects HEAD to already be the promoted commit ${commit}, found ${headNow}`);
invariant(current.generation === generation, `atlas/current.json at HEAD names generation ${current.generation}, not ${generation}`);

const proofRunId = argv('--proof-run-id');
const proofRunUrl = argv('--proof-run-url');
if (!proofRunId || !proofRunId.trim()) die('--proof-run-id is required');
if (!proofRunUrl || !/^https:\/\//.test(proofRunUrl)) die('--proof-run-url must be an https URL');

const promotedAtUtc = new Date().toISOString();
current.last_known_green = {
  generation,
  version: current.composition_version,
  commit,
  proof_run_id: proofRunId,
  proof_run_url: proofRunUrl,
  promoted_at_utc: promotedAtUtc,
  pinned_route: `./v/${generation}/`
};
writeJson(currentPath, current);

// The serial-release-cutter contract is refreshed in the SAME commit as
// last_known_green, so it never describes a stale expected_parent or a
// content identity from before this promotion.
const contractPath = path.join(ROOT, '.cvaa', 'contracts', 'serial-release-cutter.json');
if (fs.existsSync(contractPath)) {
  const contract = readJson(contractPath);
  contract.expected_parent = commit;
  contract.expected_parent_evidence = `the exact Git object id refs/heads/main was fast-forwarded to by the promotion lane at ${promotedAtUtc}, run ${proofRunId}. `
    + 'tools/scope/promote.mjs mode=write refreshes this field every time a promotion succeeds.';
  contract.input_sha256 = sha256PublishedFile(currentPath);
  contract.input_sha256_evidence = 'sha256 of the published (LF-normalised) bytes of atlas/current.json as written by this promotion, '
    + 'taken with tools/scope/lib.mjs sha256PublishedFile.';
  writeJson(contractPath, contract);
  console.log(`refreshed ${path.relative(ROOT, contractPath)}`);
}

console.log(`write=DONE generation=${generation} commit=${commit} promoted_at_utc=${promotedAtUtc} `
  + `pinned_route=${current.last_known_green.pinned_route}`);
