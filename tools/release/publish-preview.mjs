#!/usr/bin/env node
/**
 * Step 2 of the delivery flow: publish one or more generations cut by
 * tools/lightning/make-generation.mjs (step 1) as a preview PR. A preview is
 * ADDITIVE: it adds each generation's six files (and optionally its progress
 * note), carries the lightning source it was built from
 * (tools/lightning/src/*.js, tools/lightning/generations.json), and changes
 * nothing that is live.
 *
 *   node tools/release/publish-preview.mjs --generation G [--generation G2 ...]
 *        [--base origin/main] [--branch NAME] [--allow PATH ...] [--subject G=TEXT ...]
 *        [--title TEXT] [--body-file FILE] [--trailer TEXT ...] [--push] [--report FILE]
 *
 * PRE-CONDITIONS (all checked; nothing is committed if one fails)
 *   - HEAD is --base (cut files still uncommitted) or a branch descending from it;
 *   - against --base, the change set is exactly, per G, the six generation files
 *     ADDED, plus at most one docs/lightning/CANDIDATE-G-*-progress.md ADDED,
 *     plus the lightning source edit (tools/lightning/src/*.js, generations.json);
 *     any other path must be named with --allow (e.g. the vendored suite) and
 *     may never be atlas/current.json, STATE.md, atlas/index.html or atlas/releases/**;
 *   - none of G's files exist on --base;
 *   - per G: the manifest names G, its previous_generation is live on --base,
 *     atlas/v/G/current.json is the derived pointer re-rooted to ../../ (what
 *     release-generation.mjs will require), and the loader is byte-identical;
 *   - the PR gate passes locally: node tools/ci/pr-gate.mjs --base <base sha>
 *     (the same script CI runs on the PR).
 *
 * WHAT IT DOES
 *   1. If the cut files are uncommitted, creates --branch (default
 *      preview/<G>-<version>) and makes one commit per generation, subject
 *      "<G> candidate (<version>): <--subject or the manifest's scope tail>";
 *      the source edit goes into the newest generation's commit (the commit
 *      that cut it is its source, docs/LIGHTNING-SOURCE.md).
 *   2. Runs the pre-conditions and the PR gate on the branch.
 *   3. --push: pushes the branch and opens a DRAFT PR through the REST API.
 *      Without --push it prints the exact commands instead.
 *
 * After the PR is open, CI (pr-file-size-guard.yml: size-guard + cartridge-gate)
 * runs on it; `node tools/release/release-status.mjs --generation G` shows the
 * checks. The PR is merged with "Rebase and merge" once the owner wants the
 * preview on Pages; merging a preview never moves the live pointer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, run, git, gitOk, cleanTree, deriveCurrent, rerootForPreview } from './lib.mjs';
import { generationFiles, PROGRESS_DOC_RE, GRIDATLAS, openDraftPr, writeJson } from './flow-lib.mjs';

const TOOL = 'publish-preview';
const die = (m) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(1); };
const ok = (m) => console.log(`  OK    ${m}`);

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    generation: { multi: true }, base: { default: 'origin/main' }, branch: {}, allow: { multi: true },
    subject: { multi: true }, title: {}, 'body-file': {}, trailer: { multi: true }, push: { bool: true }, report: {}
  });
} catch (error) { die(error.message); }
const GENS = [...new Set(args.generation)].sort();
if (!GENS.length || GENS.some(g => !/^\d{12}$/.test(g))) die('--generation G (12 digits) is required, repeatable');
const subjects = Object.fromEntries(args.subject.map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
const FORBIDDEN = /^(atlas\/current\.json|STATE\.md|atlas\/index\.html|atlas\/releases\/)/;
const SOURCE = /^tools\/lightning\/(src\/[^/]+\.js|generations\.json)$/;
for (const a of args.allow) if (FORBIDDEN.test(a)) die(`--allow ${a}: a preview may never change ${a}`);

if (!gitOk('rev-parse', '--verify', '--quiet', `${args.base}^{commit}`)) die(`--base ${args.base} does not resolve (git fetch origin)`);
const baseSha = git('rev-parse', `${args.base}^{commit}`);
if (!gitOk('merge-base', '--is-ancestor', baseSha, 'HEAD')) die(`HEAD does not descend from ${args.base} ${baseSha}`);
const show = (rev, rel) => { const r = run('git', ['show', `${rev}:${rel}`], { allowFail: true }); return r.status === 0 ? r.stdout : null; };
const baseLive = JSON.parse(show(baseSha, 'atlas/current.json')).generation;
const report = { tool: TOOL, generations: GENS, base: baseSha, live_on_base: baseLive, checks: [] };
const check = (name, pass, detail = '') => { report.checks.push({ name, pass, detail }); if (!pass) die(`${name}: ${detail}`); ok(`${name}${detail ? `  ${detail}` : ''}`); };

/* ---------------------------------------------- the change set vs base */
function changeSet() {
  const committed = run('git', ['diff', '--name-status', '--no-renames', baseSha, 'HEAD']).stdout.split('\n').filter(Boolean)
    .map(l => { const [s, ...p] = l.split('\t'); return { status: s[0], path: p.join('\t') }; });
  const pending = run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout.split('\n').filter(Boolean)
    .map(l => ({ status: l.startsWith('??') ? 'A' : l[1] === 'D' || l[0] === 'D' ? 'D' : (l[0] === 'A' ? 'A' : 'M'), path: l.slice(3) }));
  const byPath = new Map(committed.map(c => [c.path, c]));
  for (const p of pending) byPath.set(p.path, { status: byPath.get(p.path)?.status === 'A' ? 'A' : p.status, path: p.path });
  return { all: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)), pending };
}

console.log(`\n== change set against ${args.base} ${baseSha.slice(0, 12)} (live ${baseLive})`);
const { all, pending } = changeSet();
const expected = new Map();
for (const G of GENS) for (const p of Object.values(generationFiles(G))) expected.set(p, G);
const problems = [];
const progressFor = {};
const sources = [];
for (const c of all) {
  if (expected.has(c.path)) { if (c.status !== 'A') problems.push(`${c.path} is ${c.status}, must be added`); continue; }
  const pm = PROGRESS_DOC_RE.exec(c.path);
  if (pm && GENS.includes(pm[1]) && c.status === 'A' && !progressFor[pm[1]]) { progressFor[pm[1]] = c.path; continue; }
  if (SOURCE.test(c.path) && (c.status !== 'D' || c.path.includes('/src/'))) { sources.push(c.path); continue; }
  if (args.allow.includes(c.path) && !FORBIDDEN.test(c.path) && c.status !== 'D') continue;
  problems.push(`${c.status} ${c.path} is not part of a preview of ${GENS.join(', ')} (name it with --allow if intended)`);
}
for (const p of expected.keys()) if (!all.some(c => c.path === p)) problems.push(`${p} is missing`);
check('additive change set', problems.length === 0, problems.length ? problems.join('; ') : `${all.length} path(s): ${GENS.length}×6 generation files` +
  `${Object.keys(progressFor).length ? ` + ${Object.keys(progressFor).length} progress note(s)` : ''}${args.allow.length ? ` + allowed ${args.allow.join(', ')}` : ''}`);
for (const p of expected.keys()) if (show(baseSha, p) !== null) die(`${p} already exists on ${args.base}`);

/* ------------------------------------------------------- per generation */
const meta = {};
for (const G of GENS) {
  const F = generationFiles(G);
  const manifestText = fs.readFileSync(path.join(ROOT, F.manifest), 'utf8');
  const m = JSON.parse(manifestText);
  meta[G] = m;
  check(`${G} manifest names ${G}`, m.generation === G && m.composition_manifest === `./manifests/${G}-composition.json`, m.composition_id);
  check(`${G} was cut against live ${baseLive}`, String(m.previous_generation) === String(baseLive),
    `previous_generation ${m.previous_generation}${String(m.previous_generation) !== String(baseLive) ? ' (re-cut against the current live)' : ''}`);
  check(`${G} preview route = derived pointer`, fs.readFileSync(path.join(ROOT, F.routeCurrent), 'utf8') === rerootForPreview(deriveCurrent(manifestText)));
  check(`${G} loader identical`, fs.readFileSync(path.join(ROOT, F.routeIndex)).equals(fs.readFileSync(path.join(ROOT, 'atlas/index.html'))));
}

/* ------------------------------------------------------------- commits */
const version = (G) => meta[G].composition_version;
const branch = args.branch || `preview/${GENS[0]}-gridatlas-${version(GENS[0])}`;
const trailers = args.trailer.length ? `\n\n${args.trailer.join('\n')}` : '';
if (pending.length) {
  const current = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFail: true }).stdout.trim();
  if (!current || git('rev-parse', 'HEAD') === baseSha) {
    if (gitOk('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) die(`branch ${branch} already exists`);
    run('git', ['switch', '-q', '-c', branch]);
  }
  for (const G of GENS) {
    const own = [...Object.values(generationFiles(G)), ...(progressFor[G] ? [progressFor[G]] : []), ...(G === GENS[GENS.length - 1] ? sources : [])];
    const paths = own.filter(p => pending.some(x => x.path === p || p.startsWith(x.path)));
    if (!paths.length) continue;
    run('git', ['add', '--', ...paths]);
    const scopeTail = (meta[G].acceptance?.scope || '').split(` ${G}): `).pop().split(';')[0].slice(0, 120);
    const subject = `${G} candidate (${version(G)}): ${subjects[G] || scopeTail || 'preview'}`;
    run('git', ['commit', '-q', '-F', '-'], { input: `${subject}\n\nPreview only: atlas/current.json and STATE.md are unchanged; live stays ${baseLive}.${trailers}\n` });
    ok(`committed ${G}: ${git('rev-parse', '--short', 'HEAD')} ${subject.slice(0, 90)}`);
  }
  const rest = run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout.split('\n').filter(Boolean).map(l => l.slice(3));
  const allowedLeft = rest.filter(p => args.allow.includes(p));
  if (allowedLeft.length) {
    run('git', ['add', '--', ...allowedLeft]);
    run('git', ['commit', '-q', '-F', '-'], { input: `preview ${GENS.join(', ')}: supporting changes (${allowedLeft.join(', ')})${trailers}\n` });
    ok(`committed supporting paths: ${allowedLeft.join(', ')}`);
  }
}
if (!cleanTree()) die('working tree still has changes outside the preview; commit or remove them');
report.branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFail: true }).stdout.trim() || null;
report.head = git('rev-parse', 'HEAD');
report.commits = run('git', ['log', '--format=%H %s', `${baseSha}..HEAD`]).stdout.trim().split('\n').filter(Boolean);
if (!report.branch) die('HEAD is detached; pass --branch or switch to a branch');

/* ---------------------------------------------------------- the PR gate */
console.log(`\n== node tools/ci/pr-gate.mjs --base ${baseSha.slice(0, 12)} (what CI runs on the PR)`);
const gate = run('node', ['tools/ci/pr-gate.mjs', '--base', baseSha], { allowFail: true });
const gateLines = gate.out.split('\n').filter(l => /^(PASS|FAIL) /.test(l));
report.pr_gate = { exit: gate.status, rows: gateLines };
for (const l of gateLines) console.log(`  ${l.slice(0, 160)}`);
if (gate.status !== 0) die(`pr-gate exit ${gate.status}; fix before publishing`);
ok(`pr-gate ${gateLines.filter(l => l.startsWith('PASS')).length}/${gateLines.length} PASS`);

/* ------------------------------------------------------------- publish */
const title = args.title || `Publish preview ${GENS.map(g => `${g} (${version(g)})`).join(' and ')} (no live pointer switch)`;
const body = args['body-file'] ? fs.readFileSync(path.resolve(args['body-file']), 'utf8')
  : `Preview of ${GENS.join(', ')}; live stays ${baseLive}.\n\n${report.commits.map(c => `- ${c.slice(0, 12)} ${c.slice(41)}`).join('\n')}\n\n` +
    `Routes after merge: ${GENS.map(g => `https://ventusltd.github.io/gridatlas/atlas/v/${g}/`).join(' ')}\n\n` +
    `Local pr-gate: ${gateLines.filter(l => l.startsWith('PASS')).length}/${gateLines.length} PASS. Merge with **Rebase and merge**.\n` +
    `Owner acceptance: comment \`ACCEPT <generation>\` (first line) here, or add the label \`accepted:<generation>\`.\n`;
report.title = title;
if (args.push) {
  run('git', ['push', '-u', 'origin', report.branch]);
  const pr = openDraftPr({ head: report.branch, title, body });
  report.pr = { number: pr.number, url: pr.html_url };
  ok(`draft PR #${pr.number} ${pr.html_url}`);
} else {
  console.log(`\n== not pushed (pass --push). To publish:\n  git push -u origin ${report.branch}\n` +
    `  gh api -X POST repos/${GRIDATLAS}/pulls -f head=${report.branch} -f base=main -F draft=true -f title=${JSON.stringify(title)} -F body=@<body.md>`);
}
console.log(`\nnext: CI runs on the PR; then the owner checks ${GENS.map(g => `atlas/v/${g}/`).join(', ')} and records acceptance (tools/release/acceptance.mjs)`);
if (args.report) writeJson(args.report, report);
