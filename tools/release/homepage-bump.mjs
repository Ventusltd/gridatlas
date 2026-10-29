#!/usr/bin/env node
/**
 * Step 6 of the delivery flow: put the released GridAtlas on
 * www.globalgrid2050.com. Two repositories, two PRs, in this order:
 *
 *   6a. label: Ventusltd/globalgrid2050-homepage, its one-command tool
 *       node tools/release/homepage-bump.mjs label --homepage DIR [--generation G]
 *            [--description TEXT] [--published-at ISO] [--push]   (--rehearsal: not-yet-live G, --offline, no push)
 *   6b. pin:   Ventusltd/globalgrid2050 (SPARSE clone; never check it out in full)
 *       node tools/release/homepage-bump.mjs pin --homepage DIR --domain DIR [--push]
 *   6c. deploy: after the pin PR merges, deploy-pages.yml imports the pinned bundle
 *       node tools/release/homepage-bump.mjs deploy [--dispatch]
 *
 * PRE-CONDITIONS
 *   label:
 *     - gridatlas main's atlas/current.json names G (default: whatever is live);
 *     - the live-bytes job passed for the commit that moved the pointer
 *       (tools/release/check-live.mjs), so the homepage never advertises bytes
 *       Pages is not yet serving;
 *     - the owner accepted G (tools/release/acceptance.mjs), as the homepage
 *       tool itself requires ("Do it only after the owner has accepted");
 *     - DIR is a clean clone of the homepage repo at its origin/main, which does
 *       not yet record release G.
 *   pin:
 *     - the homepage repo's origin/main has G as gridatlas' operative release
 *       (the label PR is merged);
 *     - every one of the seven bundle files at that commit hashes to the pin
 *       (re-read through the GitHub API, the same check import_homepage_owner.py makes);
 *     - DOMAIN is a clean sparse clone of globalgrid2050 whose sparse set
 *       includes catalogue/, at its origin/main.
 *
 * WHAT IT DOES
 *   label: branch gridatlas-<version>; `python scripts/release_gridatlas.py release
 *     G <version> --published-at <time the pointer moved>`; the homepage CI
 *     checks (validate, fallback rebuild idempotent, unittest, node --check,
 *     fetch_active_pages --check); one commit; --push: push and a DRAFT PR.
 *   pin: branch homepage-gridatlas-<version>; writes catalogue/homepage-owner.json
 *     from `python scripts/release_gridatlas.py pin origin/main`; one commit;
 *     --push: push and a DRAFT PR. The restore point (homepage_vNNN.html and its
 *     metrics, homepage_versions/README.md) is the domain's own rule: dispatch
 *     homepage-restore-point-check.yml and add the snapshot to the same branch
 *     before the PR leaves draft. The script prints the commands.
 *   deploy: reports deploy-pages.yml for globalgrid2050 main's head
 *     (merging the pin pushes catalogue/** to main, which triggers it);
 *     --dispatch starts it when it did not run.
 *
 * Rollback of the label: in the homepage repo,
 *   python scripts/releases.py promote gridatlas <previous release id> --reason "..."
 * then pin again (6b) and deploy (6c). Earlier releases are never deleted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from './lib.mjs';
import {
  GRIDATLAS, HOMEPAGE, DOMAIN, DOMAIN_DEPLOY_WORKFLOW, LIVE_BYTES_WORKFLOW, gh, ghFile, ghHeadSha,
  workflowRuns, dispatchWorkflow, readAcceptance, cutAtUtc, openDraftPr
} from './flow-lib.mjs';

const TOOL = 'homepage-bump';
const die = (m) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(1); };
const ok = (m) => console.log(`  OK    ${m}`);
const sub = process.argv[2];
if (!['label', 'pin', 'deploy'].includes(sub)) die('usage: homepage-bump.mjs label|pin|deploy [options] (see the header)');

let args;
try {
  args = parseArgs(process.argv.slice(3), {
    homepage: {}, domain: {}, generation: {}, description: {}, 'published-at': {}, push: { bool: true },
    dispatch: { bool: true }, 'skip-acceptance': { bool: true }, rehearsal: { bool: true }
  });
} catch (error) { die(error.message); }

const sh = (cmd, argv, cwd, opts = {}) => {
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail) die(`${cmd} ${argv.join(' ')} (in ${cwd}) exit ${r.status}\n${r.stdout}${r.stderr}`);
  return r;
};
const gitIn = (dir, ...a) => sh('git', a, dir).stdout.trim();
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

function cleanAtOriginMain(dir, name) {
  if (!dir || !fs.existsSync(path.join(dir, '.git'))) die(`--${name} must be a clone of the ${name} repository`);
  sh('git', ['fetch', '-q', 'origin', 'main'], dir);
  if (gitIn(dir, 'status', '--porcelain=v1')) die(`${dir} is not clean`);
  const head = gitIn(dir, 'rev-parse', 'HEAD'), main = gitIn(dir, 'rev-parse', 'origin/main');
  if (head !== main) die(`${dir} HEAD ${head.slice(0, 12)} is not origin/main ${main.slice(0, 12)} (git switch --detach origin/main)`);
  return main;
}

/** The gridatlas commit that last moved atlas/current.json, and when. */
function pointerCommit() {
  const [c] = gh(`repos/${GRIDATLAS}/commits?path=atlas/current.json&sha=main&per_page=1`);
  return { sha: c.sha, at: c.commit.committer.date };
}

function liveBytesPassed(sha) {
  for (const run of workflowRuns(GRIDATLAS, LIVE_BYTES_WORKFLOW, { headSha: sha, perPage: 10 })) {
    const job = (gh(`repos/${GRIDATLAS}/actions/runs/${run.id}/jobs?per_page=50`).jobs || []).find(j => j.name === 'live-bytes');
    if (job?.status === 'completed') return { ok: job.conclusion === 'success', url: job.html_url, conclusion: job.conclusion };
  }
  return { ok: false, url: null, conclusion: 'not run' };
}

function homepageGridatlas(text) {
  return JSON.parse(text).entities.find(e => e.id === 'gridatlas');
}

/* ------------------------------------------------------------------ label */
if (sub === 'label') {
  let G, version, pc, headLb = { url: 'rehearsal' };
  if (args.rehearsal) {
    /* Everything below the gridatlas checks, for a generation that is not live yet: the homepage tool runs with
       --offline, nothing is pushed. */
    if (args.push) die('--rehearsal never pushes');
    G = args.generation || die('--rehearsal needs --generation');
    const m = JSON.parse(ghFile(GRIDATLAS, 'main', `atlas/manifests/${G}-composition.json`) || die(`${G} has no manifest on main`));
    version = m.composition_version;
    pc = { sha: ghHeadSha(GRIDATLAS, 'main'), at: new Date().toISOString() };
    console.log(`\n== REHEARSAL for ${G} (${version}): gridatlas live, live-bytes and acceptance NOT checked`);
  } else {
    const live = JSON.parse(ghFile(GRIDATLAS, 'main', 'atlas/current.json'));
    G = args.generation || String(live.generation);
    version = live.composition_version;
    console.log(`\n== gridatlas: ${G}`);
    if (String(live.generation) !== G) die(`gridatlas main serves ${live.generation}, not ${G}`);
    ok(`main serves ${G} (${version})`);
    pc = pointerCommit();
    const lb = liveBytesPassed(pc.sha);
    // The live-bytes run of a later push also proves these bytes (the pointer has not moved since).
    headLb = lb.ok ? lb : liveBytesPassed(ghHeadSha(GRIDATLAS, 'main'));
    if (!headLb.ok) die(`live-bytes has not passed for ${pc.sha.slice(0, 12)} or main's head (${lb.conclusion}): node tools/release/check-live.mjs --wait`);
    ok(`live-bytes PASS ${headLb.url}`);
    if (!args['skip-acceptance']) {
      const a = readAcceptance(G, { since: cutAtUtc(G) || undefined });
      if (a.state !== 'accepted') die(`${G} has no owner acceptance on GitHub (${a.state}); pass --skip-acceptance only for a generation released before acceptance was recorded there`);
      ok(`accepted by ${a.by} ${a.url}`);
    }
  }

  console.log(`\n== ${HOMEPAGE}`);
  const dir = path.resolve(args.homepage || die('--homepage DIR is required'));
  cleanAtOriginMain(dir, 'homepage');
  const entity = homepageGridatlas(fs.readFileSync(path.join(dir, 'data/homepage.json'), 'utf8'));
  if (entity.releases.some(r => r.id === G)) die(`the homepage already records ${G} (operative: ${entity.operative_release_id})`);
  ok(`homepage operative release ${entity.operative_release_id}; ${G} not yet recorded`);
  const publishedAt = args['published-at'] || pc.at.replace(/:\d\d(\.\d+)?Z$/, ':00Z');
  const branch = args.rehearsal ? `rehearsal/gridatlas-${version}` : `gridatlas-${version}`;
  sh('git', ['switch', '-q', '-c', branch], dir);
  const rel = ['scripts/release_gridatlas.py', 'release', G, version, '--published-at', publishedAt, '--source-ref', `https://github.com/${GRIDATLAS}/commit/${pc.sha}`];
  if (args.description) rel.push('--description', args.description);
  if (args.rehearsal) rel.push('--offline', '--archive-url', `https://ventusltd.github.io/gridatlas/atlas/v/${G}/`);
  console.log(sh('python3', rel, dir).stdout.trim());
  const indexOnce = sha256(fs.readFileSync(path.join(dir, 'index.html')));
  for (const [cmd, a] of [['python3', ['scripts/releases.py', 'validate']], ['python3', ['scripts/build_homepage_fallback.py']],
    ['python3', ['-m', 'unittest', 'discover', '-s', 'tests']],
    ['node', ['--check', 'assets/versioned-homepage.js']], ['python3', ['scripts/fetch_active_pages.py', '--check']]]) {
    sh(cmd, a, dir); ok(`${cmd} ${a.join(' ')}`);
  }
  if (sha256(fs.readFileSync(path.join(dir, 'index.html'))) !== indexOnce) die('build_homepage_fallback.py is not idempotent on the new data');
  ok('fallback index.html rebuild is idempotent');
  const after = homepageGridatlas(fs.readFileSync(path.join(dir, 'data/homepage.json'), 'utf8'));
  if (after.operative_release_id !== G) die(`after the tool, the operative release is ${after.operative_release_id}`);
  const label = after.releases.find(r => r.id === G).label;
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-q', '-m', `homepage: GridAtlas ${version} (${G}) is live: "${label}"`], dir);
  ok(`committed ${gitIn(dir, 'rev-parse', '--short', 'HEAD')} on ${branch}: ${gitIn(dir, 'diff', '--stat', 'origin/main', 'HEAD').split('\n').pop().trim()}`);
  if (args.push) {
    sh('git', ['push', '-u', 'origin', branch], dir);
    const pr = openDraftPr({ repo: HOMEPAGE, head: branch, title: `homepage: GridAtlas ${version} on the homepage (${label})`,
      body: `GridAtlas ${G} (${version}) is live on gridatlas main (${pc.sha}) and live-bytes passed (${headLb.url}).\n\nGenerated by tools/release/homepage-bump.mjs label in ${GRIDATLAS}. Merge once "Homepage PR checks" passes, then run \`homepage-bump.mjs pin\`.\n` });
    ok(`draft PR ${pr.html_url}`);
  } else console.log(`\nnot pushed: git -C ${dir} push -u origin ${branch}, then open a draft PR in ${HOMEPAGE}`);
  process.exit(0);
}

/* -------------------------------------------------------------------- pin */
if (sub === 'pin') {
  const home = path.resolve(args.homepage || die('--homepage DIR is required'));
  const dom = path.resolve(args.domain || die('--domain DIR is required'));
  let pin, version;
  if (args.rehearsal) {
    /* Pin the local label commit (HEAD of --homepage) instead of origin/main; it is not on GitHub, so the seven
       hashes are taken from the local blobs. Nothing is pushed. */
    if (args.push) die('--rehearsal never pushes');
    if (gitIn(home, 'status', '--porcelain=v1')) die(`${home} is not clean`);
    const entity = homepageGridatlas(gitIn(home, 'show', 'HEAD:data/homepage.json'));
    const G = entity.operative_release_id;
    version = JSON.parse(ghFile(GRIDATLAS, 'main', `atlas/manifests/${G}-composition.json`)).composition_version;
    pin = JSON.parse(sh('python3', ['scripts/release_gridatlas.py', 'pin', 'HEAD'], home).stdout);
    console.log(`\n== REHEARSAL: pinning local ${pin.commit.slice(0, 12)} (operative ${G}); gridatlas live and GitHub re-read NOT checked`);
  } else {
    const homeMain = cleanAtOriginMain(home, 'homepage');
    const live = JSON.parse(ghFile(GRIDATLAS, 'main', 'atlas/current.json'));
    version = live.composition_version;
    const entity = homepageGridatlas(gitIn(home, 'show', 'origin/main:data/homepage.json'));
    if (entity.operative_release_id !== String(live.generation))
      die(`homepage origin/main makes ${entity.operative_release_id} operative, but gridatlas serves ${live.generation}: merge the label PR first`);
    ok(`homepage ${homeMain.slice(0, 12)} makes ${live.generation} operative`);
    pin = JSON.parse(sh('python3', ['scripts/release_gridatlas.py', 'pin', 'origin/main'], home).stdout);
    for (const [name, digest] of Object.entries(pin.files)) {
      const served = ghFile(HOMEPAGE, pin.commit, name);
      if (served === null || sha256(Buffer.from(served, 'utf8')) !== digest) die(`${name} at ${pin.commit} does not hash to the pin`);
    }
    ok(`pin ${pin.commit.slice(0, 12)}: 7 files re-read from GitHub and hash-identical`);
  }

  const sparse = sh('git', ['sparse-checkout', 'list'], dom, { allowFail: true });
  if (sparse.status !== 0 || !/^\/?catalogue\/?$/m.test(sparse.stdout)) die(`${dom} must be a sparse clone of ${DOMAIN} whose sparse set includes catalogue/`);
  cleanAtOriginMain(dom, 'domain');
  const pinPath = path.join(dom, 'catalogue/homepage-owner.json');
  const old = JSON.parse(fs.readFileSync(pinPath, 'utf8'));
  if (old.commit === pin.commit) die(`the domain already pins ${pin.commit}`);
  const branch = `${args.rehearsal ? 'rehearsal/' : ''}homepage-gridatlas-${version}`;
  sh('git', ['switch', '-q', '-c', branch], dom);
  fs.writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`);
  sh('git', ['add', 'catalogue/homepage-owner.json'], dom);
  sh('git', ['commit', '-q', '-m', `homepage: promote owner bundle with GridAtlas ${version}`], dom);
  ok(`committed the pin on ${branch} (${old.commit.slice(0, 12)} -> ${pin.commit.slice(0, 12)})`);
  console.log(`\nrestore point (homepage_versions/README.md), before the PR leaves draft:\n` +
    `  gh api -X POST repos/${DOMAIN}/actions/workflows/homepage-restore-point-check.yml/dispatches -f ref=main\n` +
    `  then add the next homepage_versions/homepage_vNNN.html + -metrics.json + README entry to ${branch}`);
  if (args.push) {
    sh('git', ['push', '-u', 'origin', branch], dom);
    const pr = openDraftPr({ repo: DOMAIN, head: branch, title: `homepage: promote owner bundle with GridAtlas ${version}`,
      body: `Pins ${HOMEPAGE}@${pin.commit} (GridAtlas ${version} operative). The seven SHA-256s were re-read from GitHub.\n\nBefore merge: the restore-point snapshot. Merging pushes catalogue/** to main and triggers deploy-pages.yml.\n` });
    ok(`draft PR ${pr.html_url}`);
  }
  process.exit(0);
}

/* ----------------------------------------------------------------- deploy */
const head = ghHeadSha(DOMAIN, 'main');
const pinText = ghFile(DOMAIN, 'main', 'catalogue/homepage-owner.json');
console.log(`globalgrid2050 main ${head.slice(0, 12)} pins ${JSON.parse(pinText).commit.slice(0, 12)}`);
const runs = workflowRuns(DOMAIN, DOMAIN_DEPLOY_WORKFLOW, { branch: 'main', perPage: 5 });
const forHead = runs.find(r => r.head_sha === head);
if (forHead) {
  console.log(`${DOMAIN_DEPLOY_WORKFLOW}: ${forHead.status} ${forHead.conclusion || ''} ${forHead.html_url}`);
  process.exit(forHead.conclusion === 'success' ? 0 : forHead.status === 'completed' ? 1 : 3);
}
console.log(`${DOMAIN_DEPLOY_WORKFLOW} has no run for main's head (latest: ${runs[0]?.head_sha?.slice(0, 12) || 'none'} ${runs[0]?.conclusion || ''})`);
if (args.dispatch) { dispatchWorkflow(DOMAIN, DOMAIN_DEPLOY_WORKFLOW, 'main'); console.log('dispatched'); }
process.exit(3);
