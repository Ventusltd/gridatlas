#!/usr/bin/env node
/**
 * Step 5 of the delivery flow: prove the public Pages site serves the
 * committed bytes after a release (or a rollback) reached main.
 *
 *   node tools/release/check-live.mjs [--generation G] [--sha SHA] [--wait] [--timeout-min 40]
 *   node tools/release/check-live.mjs --dispatch            re-run the live-bytes job on main now
 *   node tools/release/check-live.mjs --local               run the verifier from this machine instead
 *
 * PRE-CONDITIONS
 *   - with --generation: gridatlas main's atlas/current.json names G (the release PR is merged);
 *   - the default commit is main's head; --sha picks another commit on main.
 *
 * HOW
 *   The live-bytes job of .github/workflows/202608301321-verify-live.yml runs
 *   on every push to main: it waits for Pages and compares every file
 *   atlas/current.json references, the loader and every atlas/v/<gen>/ file
 *   byte for byte (tools/scope/verify-live-bytes.mjs). This script finds that
 *   run for the commit and reports its live-bytes job; --wait polls until it
 *   finishes. A run superseded by a later push to main passes with a warning,
 *   and the later run is authoritative, so --wait follows main's head.
 *   --local runs the same verifier here (needs network access to
 *   ventusltd.github.io; some sandboxes block it).
 *
 * Exit 0 when live-bytes passed, 1 when it failed, 3 when it has not finished
 * (without --wait), 2 when it cannot be checked.
 */

import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib.mjs';
import { GRIDATLAS, LIVE_BYTES_WORKFLOW, gh, ghFile, ghHeadSha, workflowRuns, dispatchWorkflow } from './flow-lib.mjs';

const TOOL = 'check-live';
const die = (m, code = 2) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(code); };

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    generation: {}, sha: {}, wait: { bool: true }, 'timeout-min': { default: '40' }, dispatch: { bool: true }, local: { bool: true }
  });
} catch (error) { die(error.message); }

const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);

if (args.local) {
  const r = spawnSync('node', ['tools/scope/verify-live-bytes.mjs', '--root', ROOT, '--timeout-s', String(Number(args['timeout-min']) * 60)], { cwd: ROOT, stdio: 'inherit' });
  process.exit(r.status ?? 2);
}

const main = JSON.parse(ghFile(GRIDATLAS, 'main', 'atlas/current.json'));
if (args.generation && String(main.generation) !== args.generation)
  die(`gridatlas main serves ${main.generation}, not ${args.generation}: the release PR is not merged`, 1);
console.log(`gridatlas main: generation ${main.generation} (${main.composition_id})`);

if (args.dispatch) {
  dispatchWorkflow(GRIDATLAS, LIVE_BYTES_WORKFLOW, 'main', { mode: 'live-bytes', compare_ref: 'main' });
  console.log(`dispatched ${LIVE_BYTES_WORKFLOW} mode=live-bytes on main; run again with --wait to follow it`);
  process.exit(0);
}

function liveBytesJob(sha) {
  const runs = workflowRuns(GRIDATLAS, LIVE_BYTES_WORKFLOW, { headSha: sha, perPage: 10 });
  for (const run of runs) {
    const jobs = gh(`repos/${GRIDATLAS}/actions/runs/${run.id}/jobs?per_page=50`).jobs || [];
    const job = jobs.find(j => j.name === 'live-bytes');
    if (job) return { run, job };
  }
  return { run: runs[0] || null, job: null };
}

const deadline = Date.now() + Number(args['timeout-min']) * 60_000;
for (;;) {
  const sha = args.sha || ghHeadSha(GRIDATLAS, 'main');
  const { run, job } = liveBytesJob(sha);
  const where = run ? `${run.html_url}` : 'no run yet';
  if (job && job.status === 'completed') {
    const pass = job.conclusion === 'success';
    console.log(`live-bytes ${pass ? 'PASS' : `FAIL (${job.conclusion})`} for ${sha.slice(0, 12)}  ${job.html_url || where}`);
    process.exit(pass ? 0 : 1);
  }
  console.log(`live-bytes for ${sha.slice(0, 12)}: ${job ? job.status : run ? `run ${run.status}, job not started` : 'no run yet'}  ${where}`);
  if (!args.wait) process.exit(3);
  if (Date.now() > deadline) die(`timed out after ${args['timeout-min']} min`, 3);
  sleep(30);
}
