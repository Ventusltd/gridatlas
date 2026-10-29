#!/usr/bin/env node
/**
 * Where every candidate is in the delivery flow (docs/RELEASE.md).
 *
 *   node tools/release/release-status.mjs [--generation G ...] [--all] [--json] [--served]
 *
 * Default candidates: the live generation and every generation newer than it
 * that is pinned on gridatlas main (atlas/v/G/current.json) or cut in this
 * checkout. --all lists every pinned lightning-line generation.
 *
 * For each, read-only, from `gh api` (repository-scoped REST) and this checkout:
 *   cut        the six files exist here (local) / on main
 *   preview    the PR that adds atlas/v/G/current.json: number, state, CI
 *   accepted   owner acceptance (tools/release/acceptance.mjs rules)
 *   release    the release/G-* PR: number, state, CI
 *   live       gridatlas main's atlas/current.json names G; live-bytes job for main's head
 *   homepage   globalgrid2050-homepage main: G recorded / operative, with its label
 *   domain     globalgrid2050 main's catalogue/homepage-owner.json pins a homepage
 *              commit that makes G operative; deploy-pages.yml for main's head
 *   served     only with --served: tools/release/check-served.mjs once (needs network)
 * and the next step of the flow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib.mjs';
import {
  GRIDATLAS, HOMEPAGE, DOMAIN, LIVE_BYTES_WORKFLOW, DOMAIN_DEPLOY_WORKFLOW, STAMP, gh, ghAll, ghFile, ghHeadSha,
  generationFiles, prsNaming, prFiles, classifyPr, checkRunsFor, decideAcceptance, workflowRuns, pad
} from './flow-lib.mjs';

let args;
try { args = parseArgs(process.argv.slice(2), { generation: { multi: true }, all: { bool: true }, json: { bool: true }, served: { bool: true } }); }
catch (error) { console.error(`release-status: ${error.message}`); process.exit(2); }

/* ------------------------------------------------------- shared reads */
const mainSha = ghHeadSha(GRIDATLAS, 'main');
const live = JSON.parse(ghFile(GRIDATLAS, mainSha, 'atlas/current.json'));
const LIVE = String(live.generation);
const pinnedOnMain = (gh(`repos/${GRIDATLAS}/contents/atlas/v?ref=${mainSha}`) || []).map(e => e.name).filter(n => STAMP.test(n)).sort();
const localCut = fs.existsSync(path.join(ROOT, 'atlas/v'))
  ? fs.readdirSync(path.join(ROOT, 'atlas/v')).filter(n => STAMP.test(n) && fs.existsSync(path.join(ROOT, generationFiles(n).manifest))) : [];
const isLine = (g) => g >= '202610261949';
let gens = args.generation.length ? args.generation
  : [...new Set([...pinnedOnMain, ...localCut])].filter(g => (args.all ? isLine(g) : g >= LIVE)).sort();

const pulls = gh(`repos/${GRIDATLAS}/pulls?state=all&per_page=100&sort=created&direction=desc`);
const oldestCut = gens.map(g => `${g.slice(0, 4)}-${g.slice(4, 6)}-${g.slice(6, 8)}T${g.slice(8, 10)}:${g.slice(10, 12)}:00Z`).sort()[0];
const comments = oldestCut ? ghAll(`repos/${GRIDATLAS}/issues/comments?sort=created&since=${oldestCut}`) : [];

const liveBytes = (() => {
  for (const run of workflowRuns(GRIDATLAS, LIVE_BYTES_WORKFLOW, { headSha: mainSha, perPage: 5 })) {
    const job = (gh(`repos/${GRIDATLAS}/actions/runs/${run.id}/jobs?per_page=50`).jobs || []).find(j => j.name === 'live-bytes');
    if (job) return job.status === 'completed' ? job.conclusion : job.status;
  }
  return 'no run';
})();

const homepageMain = JSON.parse(ghFile(HOMEPAGE, 'main', 'data/homepage.json')).entities.find(e => e.id === 'gridatlas');
const pin = JSON.parse(ghFile(DOMAIN, 'main', 'catalogue/homepage-owner.json'));
const pinnedHome = JSON.parse(ghFile(HOMEPAGE, pin.commit, 'data/homepage.json')).entities.find(e => e.id === 'gridatlas');
const domainSha = ghHeadSha(DOMAIN, 'main');
const deploy = workflowRuns(DOMAIN, DOMAIN_DEPLOY_WORKFLOW, { branch: 'main', perPage: 5 }).find(r => r.head_sha === domainSha);

/* G is superseded when a later pinned candidate names it as candidate_predecessor. */
const successors = {};
for (const g of pinnedOnMain.filter(x => gens.some(y => x > y))) {
  try {
    const m = JSON.parse(ghFile(GRIDATLAS, mainSha, generationFiles(g).manifest));
    if (m.candidate_predecessor && !successors[m.candidate_predecessor]) successors[m.candidate_predecessor] = g;
  } catch { /* not a lightning-line manifest */ }
}

const ci = (sha) => {
  const runs = checkRunsFor(GRIDATLAS, sha);
  if (!runs.length) return 'no CI';
  if (runs.some(r => r.status !== 'completed')) return 'CI running';
  const bad = runs.filter(r => !['success', 'skipped', 'neutral'].includes(r.conclusion));
  return bad.length ? `CI RED (${bad.map(r => r.name).join(',')})` : 'CI green';
};
const prState = (p) => (p.merged_at ? 'merged' : p.state === 'open' ? (p.draft ? 'draft' : 'open') : 'closed');

/* ------------------------------------------------------- per candidate */
const rows = [];
for (const G of gens) {
  const F = generationFiles(G);
  const onMain = pinnedOnMain.includes(G);
  const local = localCut.includes(G);
  let manifest = null;
  try { manifest = JSON.parse(onMain ? ghFile(GRIDATLAS, mainSha, F.manifest) : fs.readFileSync(path.join(ROOT, F.manifest), 'utf8')); } catch { /* none */ }
  const version = manifest?.composition_version || '?';
  const named = prsNaming(G, { pulls });
  const typed = named.map(p => ({ p, kind: classifyPr(p, prFiles(p.number), G) }));
  const preview = typed.filter(t => t.kind === 'preview').map(t => t.p)[0];
  const release = typed.filter(t => t.kind === 'release').map(t => t.p)[0];
  const rollback = typed.filter(t => t.kind === 'rollback').map(t => t.p)[0];
  const events = preview ? ghAll(`repos/${GRIDATLAS}/issues/${preview.number}/events?`).map(e => ({ ...e, issue: { html_url: preview.html_url } })) : [];
  const since = manifest?.cut_at_utc;
  const acc = decideAcceptance(G, { comments: comments.filter(c => !since || c.created_at >= since), events: events.filter(e => !since || e.created_at >= since) });
  const isLive = G === LIVE;
  const supersededBy = successors[G];
  const hpRel = homepageMain.releases.find(r => r.id === G);
  const row = {
    generation: G, version,
    cut: onMain ? 'on main' : local ? 'local only' : 'no',
    preview: preview ? `#${preview.number} ${prState(preview)}, ${ci(preview.head.sha)}` : (onMain ? 'on main (no PR found)' : 'none'),
    accepted: acc.state === 'accepted' ? `yes (${acc.by}, ${acc.via})` : acc.state === 'rejected' ? `REJECTED (${acc.by})` : (isLive ? 'n/a (released before GitHub acceptance)' : 'no'),
    acceptance_url: acc.url || null,
    release: release ? `#${release.number} ${prState(release)}, ${ci(release.head.sha)}` : 'none',
    live: isLive ? `LIVE, live-bytes ${liveBytes}` : (release?.merged_at ? `was live; now ${LIVE}` : 'no'),
    rollback: rollback ? `#${rollback.number} ${prState(rollback)}` : '-',
    homepage: hpRel ? `${homepageMain.operative_release_id === G ? 'OPERATIVE' : 'recorded'} "${hpRel.label}"` : 'no',
    domain: pinnedHome.operative_release_id === G ? `pinned ${pin.commit.slice(0, 7)}, deploy ${deploy ? (deploy.conclusion || deploy.status) : 'not run for head'}` : 'no'
  };
  row.next = !onMain && local ? `publish-preview.mjs --generation ${G}`
    : !onMain ? `tools/lightning/make-generation.mjs --gen ${G} ...`
    : preview && !preview.merged_at ? `CI green, then rebase-merge preview #${preview.number}`
    : supersededBy && !isLive && !release && acc.state !== 'accepted' ? `superseded by ${supersededBy} (nothing to do)`
    : acc.state !== 'accepted' && !isLive && !release?.merged_at ? `owner: ACCEPT ${G} (acceptance.mjs --how --pr ${preview?.number ?? 'N'})`
    : !isLive && !release ? `release-accepted.mjs --generation ${G} --push`
    : !isLive && release && !release.merged_at ? `CI green, owner rebase-merges release #${release.number}`
    : !isLive ? '-'
    : liveBytes !== 'success' ? 'check-live.mjs --wait'
    : homepageMain.operative_release_id !== G ? 'homepage-bump.mjs label --homepage DIR --push'
    : pinnedHome.operative_release_id !== G ? 'homepage-bump.mjs pin --homepage DIR --domain DIR --push'
    : !deploy || deploy.conclusion !== 'success' ? 'homepage-bump.mjs deploy [--dispatch]'
    : 'check-served.mjs (done when it passes)';
  rows.push(row);
}

let served = null;
if (args.served) {
  const r = spawnSync('node', [path.join(ROOT, 'tools/release/check-served.mjs'), '--timeout-s', '1'], { encoding: 'utf8' });
  served = { exit: r.status, line: (r.stdout || '').trim().split('\n').pop() };
}

const out = { gridatlas_main: mainSha, live: LIVE, live_bytes: liveBytes, homepage_operative: homepageMain.operative_release_id,
  domain_pin: pin.commit, domain_operative: pinnedHome.operative_release_id, domain_deploy: deploy ? (deploy.conclusion || deploy.status) : 'not run for head',
  served, candidates: rows };
if (args.json) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`gridatlas main ${mainSha.slice(0, 12)}: live ${LIVE} (${live.composition_version}), live-bytes ${liveBytes}`);
console.log(`homepage: operative ${homepageMain.operative_release_id}; domain pin ${pin.commit.slice(0, 12)} makes ${pinnedHome.operative_release_id} operative; deploy ${out.domain_deploy}`);
if (served) console.log(`served: ${served.line}`);
console.log('');
const cols = ['generation', 'version', 'cut', 'preview', 'accepted', 'release', 'live', 'homepage', 'domain', 'next'];
console.log(pad([cols, ...rows.map(r => cols.map(c => r[c]))]));
