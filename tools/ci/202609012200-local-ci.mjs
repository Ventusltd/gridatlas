/**
 * Local CI: measure the change, coordinate the computation engine, find flaws.
 *
 * Vikram, 2026-09-01: *"run a CI/CD automation locally that measures code
 * change across all versions to date of pipelinenews and gridatlas so that
 * you can coordinate the computation engine cartridges and find code
 * flaws."*
 *
 * Runs on this laptop, against the real git history of both repositories.
 * No network, no runner, no secrets.
 *
 *   node tools/ci/202609012200-local-ci.mjs
 *   node tools/ci/202609012200-local-ci.mjs --json report.json
 *
 * THREE PASSES
 *
 * 1. CHURN. Every commit in every repository, measured: files touched,
 *    lines added and removed, and how much of it landed in code that
 *    computes as against code that presents. A generation is recognised by
 *    the twelve-digit stamp its commit subject opens with, so the report
 *    reads by version rather than by hash.
 *
 * 2. THE COMPUTATION ENGINE, ACROSS EVERY VERSION EVER COMMITTED. This is
 *    the part that finds flaws. Every BLOB ever committed at a computing
 *    path - the shell engine, the cartridges, the parts, the modules - is
 *    read out of git and examined for the two things that must never vary:
 *    the Earth radius, and the form of the haversine. A file on disk today
 *    can be checked by running it; a blob from forty commits ago cannot,
 *    and static extraction over every blob is both exhaustive and cheap.
 *
 *    It finds real defects. The extraction of the geodesy module shipped
 *    2*R*asin(sqrt(a)) where every other version of this estate uses
 *    R*2*atan2(sqrt(a),sqrt(1-a)) - one unit in the last place apart, and
 *    invisible to a proof that only ever compared the module against the
 *    cartridge it came from.
 *
 * 3. GATES. The proof suite, run, with its totals reported rather than
 *    summarised. A gate that fails is a flaw like any other.
 *
 * Exit code is non-zero if pass 2 finds an incoherence or pass 3 fails, so
 * this can be wired to a hook or a pre-push without further ceremony.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GRIDATLAS = resolve(HERE, '..', '..');
const GRID_PARENT = resolve(GRIDATLAS, '..');
const HOME = existsSync(join(GRID_PARENT, 'pipelinenews'))
  ? GRID_PARENT
  : resolve(GRIDATLAS, '..', '..');

function argv(flag) {
  const at = process.argv.indexOf(flag);
  return at > 0 ? process.argv[at + 1] : null;
}

const REPOS = [
  { name: 'gridatlas', path: GRIDATLAS },
  { name: 'pipelinenews', path: join(HOME, 'pipelinenews') },
  { name: 'data-grid-gb', path: join(HOME, 'data-grid-gb') }
].filter(repo => existsSync(join(repo.path, '.git')) || existsSync(repo.path));

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo.path, ...args],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch (error) {
    return error.stdout || '';
  }
}

/* Unit and record separators, so a commit subject containing any
   punctuation cannot break the parse. */
const RECORD = String.fromCharCode(30);
const UNIT = String.fromCharCode(31);

const bar = (n, max, width = 28) =>
  '#'.repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / (max || 1)) * width)));

/* Paths whose contents COMPUTE. Everything else presents, coordinates or
   documents. The split is the point of pass 1: churn in a card's wording
   and churn in a haversine are not the same event. */
const COMPUTES = [
  /ventus-corev8engine\.js$/,
  /atlas\/cartridges\/.*\.js$/,
  /atlas\/parts\/.*\.js$/,
  /atlas\/modules\/.*\.js$/,
  /derived\/.*\.(py|json)$/,
  /tools\/.*\.(mjs|py)$/
];
const computes = (path) => COMPUTES.some(pattern => pattern.test(path));

const report = { generated: new Date().toISOString(), repos: {}, engine: {}, gates: {} };
const flaws = [];

/* ═══════════════════════════════════════════════════════════════════════
   PASS 1 — CHURN, BY VERSION
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mPASS 1 — code change across every version to date\x1b[0m');

for (const repo of REPOS) {
  const raw = git(repo, ['log', '--all', '--no-merges', '--date=iso-strict',
    '--pretty=format:%x1e%H%x1f%ad%x1f%s', '--numstat']);
  if (!raw.trim()) { console.log(`  ${repo.name}: no history readable`); continue; }

  const commits = [];
  for (const block of raw.split(RECORD).slice(1)) {
    const [header, ...lines] = block.split('\n');
    const [hash, date, subject] = header.split(UNIT);
    let added = 0, removed = 0, files = 0, computeAdded = 0, computeRemoved = 0;
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const a = parts[0] === '-' ? 0 : Number(parts[0]);
      const r = parts[1] === '-' ? 0 : Number(parts[1]);
      const path = parts[2];
      added += a; removed += r; files += 1;
      if (computes(path)) { computeAdded += a; computeRemoved += r; }
    }
    const stamp = (subject || '').match(/^(\d{12})/);
    const version = (subject || '').match(/v(\d+\.\d+)/);
    commits.push({ hash: hash.slice(0, 7), date, subject, files, added, removed,
      computeAdded, computeRemoved,
      generation: stamp ? stamp[1] : null, version: version ? `v${version[1]}` : null });
  }

  const total = commits.reduce((sum, c) => ({
    commits: sum.commits + 1, files: sum.files + c.files,
    added: sum.added + c.added, removed: sum.removed + c.removed,
    computeAdded: sum.computeAdded + c.computeAdded,
    computeRemoved: sum.computeRemoved + c.computeRemoved
  }), { commits: 0, files: 0, added: 0, removed: 0, computeAdded: 0, computeRemoved: 0 });

  const stamped = commits.filter(c => c.generation).sort((a, b) =>
    a.generation.localeCompare(b.generation));
  report.repos[repo.name] = { total, stamped_versions: stamped.length };

  console.log(`\n  \x1b[1m${repo.name}\x1b[0m  ${total.commits} commits, `
    + `${total.added.toLocaleString()} added / ${total.removed.toLocaleString()} removed, `
    + `${stamped.length} stamped generations`);
  console.log(`  of which computation: ${total.computeAdded.toLocaleString()} added / `
    + `${total.computeRemoved.toLocaleString()} removed `
    + `(${total.added ? Math.round(100 * total.computeAdded / total.added) : 0}% of additions)`);

  const busiest = [...stamped].sort((a, b) =>
    (b.computeAdded + b.computeRemoved) - (a.computeAdded + a.computeRemoved)).slice(0, 8);
  if (busiest.length) {
    const max = busiest[0].computeAdded + busiest[0].computeRemoved;
    console.log('  the generations that changed the computation most:');
    for (const c of busiest) {
      const churn = c.computeAdded + c.computeRemoved;
      console.log(`    ${c.generation}  ${(c.version || '').padEnd(6)} `
        + `${String(churn).padStart(6)}  ${bar(churn, max)}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PASS 2 — THE COMPUTATION ENGINE, EVERY BLOB EVER COMMITTED
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mPASS 2 — the computation engine, across every version ever committed\x1b[0m');

const ESTATE_RADIUS = '6378.137';
const OTHER_RADII = ['6371.0088', '6371.008', '6372.8', '6356.752', '3958.8', '3963.19'];

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/.*$/;
const stripComments = (text) => text
  .replace(BLOCK_COMMENT, ' ')
  .split('\n').map(line => line.replace(LINE_COMMENT, '$1')).join('\n');

/* The two forms of the same identity. They differ by one unit in the last
   place, so which one an artefact uses is a fact worth knowing about it. */
const ATAN2_FORM = /Math\.atan2\(\s*Math\.sqrt\(\s*\w+\s*\)\s*,\s*Math\.sqrt\(\s*1\s*-\s*\w+\s*\)/;
const ASIN_FORM = /Math\.asin\(\s*Math\.sqrt\(/;

const engineFindings = [];
const seen = new Map();   // sha -> { paths:Set, radius, form, firstSeen }

for (const repo of REPOS) {
  // Every blob ever recorded at a computing path, on any branch.
  const objects = git(repo, ['rev-list', '--all', '--objects']).split('\n');
  for (const line of objects) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const sha = line.slice(0, space);
    const path = line.slice(space + 1).trim();
    if (!path.endsWith('.js') || !computes(path)) continue;
    if (seen.has(sha)) { seen.get(sha).paths.add(`${repo.name}:${path}`); continue; }

    let text = '';
    try {
      text = execFileSync('git', ['-C', repo.path, 'cat-file', 'blob', sha],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch { continue; }
    const code = stripComments(text);
    if (!code.includes(ESTATE_RADIUS) && !OTHER_RADII.some(r => code.includes(r))) continue;

    const strangers = OTHER_RADII.filter(r => code.includes(r));
    const form = ATAN2_FORM.test(code) ? 'atan2'
      : ASIN_FORM.test(code) ? 'asin'
        : code.includes(ESTATE_RADIUS) ? 'other-or-none' : null;

    seen.set(sha, { paths: new Set([`${repo.name}:${path}`]), strangers, form,
      hasEstateRadius: code.includes(ESTATE_RADIUS),
      /* Whether this exact blob is what the file holds TODAY. A divergence
         in a blob that no longer exists is history - real, worth reporting,
         and not something a build can be failed for, because it cannot be
         fixed without rewriting the past. A divergence in the working tree
         is a defect now. */
      inWorkingTree: existsSync(join(repo.path, path))
        && sha === git(repo, ['hash-object', join(repo.path, path)]).trim() });
  }
}

console.log(`  ${seen.size} distinct versions of computing files carry an Earth radius`);

const byForm = {};
for (const [sha, record] of seen) {
  byForm[record.form] = (byForm[record.form] || 0) + 1;
  if (record.strangers.length) {
    engineFindings.push({ severity: 'radius', sha: sha.slice(0, 7),
      where: record.inWorkingTree ? 'working tree' : 'history only',
      paths: [...record.paths], detail: `carries ${record.strangers.join(', ')}` });
  }
  if (!record.hasEstateRadius) {
    engineFindings.push({ severity: 'radius', sha: sha.slice(0, 7),
      where: record.inWorkingTree ? 'working tree' : 'history only',
      paths: [...record.paths], detail: 'does not carry the estate radius' });
  }
}
for (const [form, count] of Object.entries(byForm)) {
  console.log(`    haversine form ${String(form).padEnd(14)} ${count} version(s)`);
}

/* An artefact using the minority form is not necessarily wrong - but the
   estate has exactly one canonical form, so a minority is a divergence and
   is named. */
const dominant = Object.entries(byForm)
  .filter(([form]) => form === 'atan2' || form === 'asin')
  .sort((a, b) => b[1] - a[1])[0];
if (dominant) {
  console.log(`  canonical form: ${dominant[0]} (${dominant[1]} versions)`);
  for (const [sha, record] of seen) {
    if ((record.form === 'atan2' || record.form === 'asin') && record.form !== dominant[0]) {
      engineFindings.push({ severity: 'haversine-form', sha: sha.slice(0, 7),
        where: record.inWorkingTree ? 'working tree' : 'history only',
        paths: [...record.paths],
        detail: `uses ${record.form} where the estate uses ${dominant[0]} `
          + '(algebraically equal, one unit in the last place apart)' });
    }
  }
}

report.engine = { versions_examined: seen.size, forms: byForm,
  canonical_form: dominant ? dominant[0] : null, findings: engineFindings };

if (!engineFindings.length) {
  console.log('  \x1b[32mno incoherence: every version ever committed measures the '
    + 'same Earth, the same way\x1b[0m');
} else {
  const live = engineFindings.filter(f => f.where === 'working tree');
  const past = engineFindings.filter(f => f.where !== 'working tree');
  console.log(`  ${live.length} in the working tree, ${past.length} in history only`);
  for (const finding of engineFindings.slice(0, 20)) {
    const colour = finding.where === 'working tree' ? '\x1b[31m' : '\x1b[33m';
    console.log(`    ${colour}[${finding.severity}, ${finding.where}]\x1b[0m `
      + `${finding.sha}  ${finding.detail}`);
    for (const path of finding.paths.slice(0, 3)) console.log(`        ${path}`);
  }
  if (engineFindings.length > 20) {
    console.log(`    ... ${engineFindings.length - 20} more`);
  }
  /* Only the working tree can fail the build. History is reported so it
     stays visible - a blob that once shipped a different form is a fact
     about this estate - but it is not actionable without rewriting the
     past, and a build that fails forever on it is a build people learn to
     ignore. */
  flaws.push(...live);
}

/* ═══════════════════════════════════════════════════════════════════════
   PASS 3 — THE GATES
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mPASS 3 — the gates\x1b[0m');

const GATES = [
  ['composition', ['tools/scope/verify-compose.mjs']],
  ['scope ledger', ['tools/scope/loop.mjs']],
  ['composed cartridges', ['tools/proofs/run-current.mjs']],
  ['parts integrity', ['tools/proofs/202609012105-parts-integrity.proof.mjs']],
  ['all versions', ['tools/proofs/202609012150-all-versions.proof.mjs']],
  ['module parity', ['tools/proofs/modules/202609011950-module-parity.proof.mjs']],
  ['grid scope', ['tools/proofs/modules/202609012040-grid-scope.proof.mjs']],
  ['network topology', ['tools/proofs/modules/202609012145-network-topology.proof.mjs']],
  ['assembler', ['tools/proofs/modules/202609012010-assembler.proof.mjs']],
  ['source registry', ['tools/proofs/modules/202609012217-source-registry.proof.mjs']],
  ['map-click network', ['tools/proofs/modules/202609012230-map-click-network.proof.mjs']],
  ['declared connections', ['tools/proofs/modules/202609012130-declared-connections.proof.mjs']],
  ['sizing arithmetic', ['tools/proofs/modules/202609012205-sizing-arithmetic.proof.mjs']],
  ['data-contract parity', ['tools/proofs/202609012214-data-contract-parity.proof.mjs']],
  ['electrical distance', ['tools/proofs/modules/202609012245-electrical-distance.proof.mjs']]
];

for (const [name, args] of GATES) {
  if (!existsSync(join(GRIDATLAS, args[0]))) {
    /* an absent gate was a yellow line and a continue until 202609012217;
       a skip is not a pass, so it is red and counted */
    console.log(`  \x1b[31m${name.padEnd(22)} ABSENT\x1b[0m  ${args[0]}`);
    flaws.push(`gate absent: ${name} (${args[0]})`);
    report.gates[name] = { ok: false, summary: 'absent' };
    continue;
  }
  let out = '', ok = true;
  try {
    out = execFileSync(process.execPath, args,
      { cwd: GRIDATLAS, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    ok = false;
    out = (error.stdout || '') + (error.stderr || '');
  }
  /* Sum EVERY tally the gate prints, not just one of them. run-current
     runs four proofs and prints four totals; reporting the last understated
     the suite by more than five hundred checks. */
  const tallies = [...out.matchAll(/(\d+)\/(\d+) checks passed/g)];
  const totals = tallies.reduce((sum, m) =>
    [sum[0] + Number(m[1]), sum[1] + Number(m[2])], [0, 0]);
  const tally = tallies.length > 0;
  const summary = tally ? `${totals[0]}/${totals[1]}`
    : (out.match(/"composition":"(\w+)"/) || out.match(/scope-ledger=(\w+)/) || [, ''])[1]
      || (ok ? 'ok' : 'failed');
  report.gates[name] = { ok, summary };
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  `
    + `${name.padEnd(22)} ${summary}`);
  if (!ok) flaws.push({ severity: 'gate', detail: `${name} failed`, paths: args });
}

/* ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   PASS 4 - PROOFS THAT SKIP INSTEAD OF FAILING
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mPASS 4 - checks that decline to check, and report success\x1b[0m');

/* This belongs in CVAA and cannot live there yet: inoculate.mjs hands an
   antibody a bounded context whose `files` map holds STATE.md and
   index.html, so no vaccine can read the text of a proof. An antibody was
   written, reported `immune` against a repository that had the defect, and
   was withdrawn - a check that cannot reach its target and reports success
   is exactly the disease it was written to catch. See
   cvaa/studies/202609012310-a-skip-is-not-a-pass-needs-source-text.md.

   So it runs here, where the file text is available.

   Codex found the original on 202609012230: the topology proof skipped
   every real-payload assertion when its sibling data product was absent -
   the normal condition on an isolated checkout - and reported 46/46. Green
   exactly where nobody is watching. */
const CLAIMS_TO_CHECK = /\.(proof|verify|test|spec)\.(mjs|js|ts)$|(^|\/)(proofs?|verify|tests?)\//i;
const ANNOUNCES_SKIP = /\[skip\]|\bskipping\b|\bskipped\b|did not run|checks below did not/i;
const GUARDS_ON_ABSENCE = /if\s*\(\s*!\s*\w*(present|exists|found|available|ready|installed)\w*\s*\)/i;
const DECLARES_CONCESSION = /process\.env\.[A-Z0-9_]*(ALLOW|SKIP|WITHOUT|OFFLINE|MISSING)[A-Z0-9_]*/;

let proofsRead = 0;
const skippers = [];
const unreadable = [];
for (const repo of REPOS) {
  for (const path of git(repo, ['ls-files']).split('\n')) {
    if (!path || !CLAIMS_TO_CHECK.test(path)) continue;
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    /* The catch RECORDS. An empty catch here swallowed a ReferenceError -
       readFileSync was not imported - for every file in both repositories,
       and the pass reported "0 proof/verifier files read" and a clean
       result. It was only visible because the count is printed; a pass that
       reported nothing would have looked like a pass. */
    try { text = readFileSync(full, 'utf8'); }
    catch (error) { unreadable.push(`${repo.name}:${path} (${error.message})`); continue; }
    proofsRead += 1;
    if (!ANNOUNCES_SKIP.test(text) || !GUARDS_ON_ABSENCE.test(text)) continue;
    if (DECLARES_CONCESSION.test(text)) continue;   // a named opt-in is the cure

    /* Not every skip is the disease, and the distinction has to be exact.
       -------------------------------------------------------------------
       The first attempt flagged parts-integrity, which skips SUPERSEDED
       cartridges - a rule, not an evasion. The second attempt looked for a
       check() near the skip and flagged nothing at all, because check()
       appears on nearly every line of a proof.

       The real question is narrower: does anything ASSERT THE GUARD
       ITSELF? In the repaired topology proof the guard variable
       `productPresent` is passed to check(); in the defective version it
       appears only in the `if`. That is the whole difference between "this
       dependency is required and here is the assertion" and "this
       dependency is missing so never mind". */
    const guard = text.match(GUARDS_ON_ABSENCE);
    const variable = guard && guard[0].match(/!\s*(\w+)/);
    if (variable) {
      const asserted = new RegExp(
        `check\\([^;]{0,400}\\b${variable[1]}\\b`, 's').test(text);
      if (asserted) continue;
    }

    skippers.push(`${repo.name}:${path}`);
  }
}

console.log(`  ${proofsRead} proof/verifier files read across ${REPOS.length} repositories`);
if (!proofsRead) {
  console.log('  \x1b[31ma pass that examined nothing is not a pass\x1b[0m');
  flaws.push({ severity: 'pass-examined-nothing',
    detail: 'the skip-detection pass matched no files at all', paths: [] });
}
if (unreadable.length) {
  console.log(`  \x1b[33m${unreadable.length} file(s) could not be read:\x1b[0m`);
  for (const item of unreadable.slice(0, 5)) console.log(`    ${item}`);
}
if (!skippers.length) {
  console.log('  \x1b[32mno check skips its assertions on a missing dependency '
    + 'without a named opt-in\x1b[0m');
} else {
  console.log(`  \x1b[31m${skippers.length} check(s) skip and report success:\x1b[0m`);
  for (const path of skippers) console.log(`    ${path}`);
  flaws.push(...skippers.map(path => ({ severity: 'skip-is-not-a-pass',
    detail: 'skips assertions when a dependency is absent and reports success',
    paths: [path] })));
}
report.skips = { proofs_read: proofsRead, skippers };


/* ═══════════════════════════════════════════════════════════════════════
   PASS 5 - A STAMP IS A CLOCK
   ═══════════════════════════════════════════════════════════════════════
   Found 1 Sep 2026, 21:2x UTC, by asking what time it was. Every stamp
   chosen that evening ran ahead of the clock, by up to 249 minutes: the
   composition named 202609012250 was committed at 18:51 UTC. The CVAA
   vaccine monotonic-utc-generations had said since 30 Aug that a
   generation is read from date -u, never chosen, and had been run against
   nothing. A vaccine nobody runs is a note.

   Three questions, one per tense:
     history  - how far did committed stamps sit from their commit clocks?
                Reported, never failed: history is not amended.
     present  - is any stamped file in the working tree named for a time
                the clock has not reached? Failed: that is a typed stamp.
     the loop - does the sibling cvaa run here, and what does it say?
                Failed if cvaa is absent. A skip is not a pass. */

console.log('\n\x1b[1mPASS 5 - a stamp is a clock\x1b[0m');

const STAMP_TOLERANCE_MIN = 15;
const stampMinutes = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1,
  +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)) / 60000;
const nowStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
report.clock = { now_utc: nowStamp, repos: {} };

for (const repo of REPOS) {
  /* history: commit subject stamp vs committer clock, UTC */
  const raw = git(repo, ['log', '--all', '--no-merges', '--date=iso-strict',
    '--pretty=format:%h%x1f%cI%x1f%s']);
  const rows = raw.split('\n').map(line => line.split(UNIT)).filter(r => r.length === 3);
  const drifts = [];
  for (const [hash, when, subject] of rows) {
    const m = (subject || '').match(/^(\d{12})\b/);
    if (!m) continue;
    const committed = new Date(when).toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const drift = stampMinutes(m[1]) - stampMinutes(committed);
    if (Math.abs(drift) > STAMP_TOLERANCE_MIN) drifts.push({ hash, stamp: m[1], committed, drift });
  }
  const worst = drifts.reduce((a, b) => Math.abs(b.drift) > Math.abs(a.drift) ? b : a, { drift: 0 });

  /* present: every stamped file name in the working tree, tracked or not.
     A file already in HEAD is history - it was committed ahead of the
     clock and is reported, and the clock will catch up with its name. A
     file NOT in HEAD is being committed now, and a future name on it is a
     typed stamp: that fails. */
  const committed = new Set(git(repo, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n'));
  const listed = git(repo, ['ls-files', '--cached', '--others', '--exclude-standard']);
  const future = [];
  const inherited = [];
  for (const file of listed.split('\n')) {
    const m = basename(file).match(/^(\d{12})[-.]/);
    if (!m) continue;
    const ahead = stampMinutes(m[1]) - stampMinutes(nowStamp);
    if (ahead <= STAMP_TOLERANCE_MIN) continue;
    (committed.has(file) ? inherited : future).push({ file, ahead });
  }

  console.log(`\n  \x1b[1m${repo.name}\x1b[0m  ${rows.length} commits, `
    + `${drifts.length} stamped more than ${STAMP_TOLERANCE_MIN} min from the commit clock`
    + (drifts.length ? `; worst ${worst.hash} ${worst.stamp} vs ${worst.committed} (${worst.drift > 0 ? '+' : ''}${worst.drift} min)` : ''));
  if (inherited.length) {
    console.log(`    ${inherited.length} committed file(s) still named ahead of ${nowStamp} UTC (history; the clock catches up)`);
  }
  if (future.length) {
    console.log(`    \x1b[31m${future.length} file(s) in the working tree are stamped in the future of ${nowStamp} UTC:\x1b[0m`);
    for (const item of future.slice(0, 8)) console.log(`      ${item.file}  (+${item.ahead} min)`);
    flaws.push({ severity: 'typed-stamp',
      detail: `${repo.name}: ${future.length} file(s) stamped ahead of the clock`,
      paths: future.map(f => f.file) });
  } else {
    console.log(`    \x1b[32mno file in the working tree is stamped ahead of ${nowStamp} UTC\x1b[0m`);
  }

  /* the loop: the sibling cvaa, run here */
  const cvaa = join(HOME, 'cvaa', 'inoculate.mjs');
  let cvaaSummary = null;
  if (!existsSync(cvaa)) {
    console.log(`    \x1b[31mcvaa is not beside this repository (${cvaa}); a skip is not a pass\x1b[0m`);
    flaws.push({ severity: 'cvaa-absent', detail: `${repo.name}: cvaa/inoculate.mjs not found beside the repository`, paths: [cvaa] });
  } else {
    let out = '';
    try {
      out = execFileSync(process.execPath, [cvaa, repo.path, '--json'],
        { cwd: dirname(cvaa), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (error) { out = (error.stdout || '') + (error.stderr || ''); }
    const line = out.split('\n').find(l => l.startsWith('{"schema":"cvaa.run.v1"'));
    if (!line) {
      console.log('    \x1b[31mcvaa ran and produced no cvaa.run.v1 record\x1b[0m');
      flaws.push({ severity: 'cvaa-unreadable', detail: `${repo.name}: inoculate.mjs produced no cvaa.run.v1 record`, paths: [cvaa] });
    } else {
      const run = JSON.parse(line);
      const clockRule = (run.results || []).find(r => r.vaccine === 'monotonic-utc-generations');
      const offCount = (clockRule?.findings || []).filter(f => /minutes off/.test(f)).length;
      const orderCount = (clockRule?.findings || []).filter(f => /earlier than previous/.test(f)).length;
      const failing = (run.results || []).filter(r => r.state === 'fail').map(r => r.vaccine);
      cvaaSummary = { status: run.status, findings: run.findings, failing,
        monotonic_utc: { off_clock: offCount, out_of_order: orderCount } };
      console.log(`    cvaa: ${run.status}, ${run.findings} finding(s) across ${failing.length} failing vaccine(s)`);
      console.log(`    monotonic-utc-generations: ${offCount} commit(s) off the clock, ${orderCount} out of order`
        + ' (history; reported, not amended)');
    }
  }
  report.clock.repos[repo.name] = {
    commits: rows.length, off_clock: drifts.length, worst: worst.hash ? worst : null,
    future_files: future, cvaa: cvaaSummary };
}
const jsonOut = argv('--json');
if (jsonOut) {
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 1)}\n`, 'utf8');
  console.log(`\nreport written to ${jsonOut}`);
}

console.log('');
if (flaws.length) {
  console.log(`\x1b[31m${flaws.length} flaw(s) found across `
    + `${REPOS.length} repositories.\x1b[0m`);
  process.exit(1);
}
console.log(`\x1b[32mno flaws: ${REPOS.length} repositories, `
  + `${seen.size} versions of the computation engine, `
  + `${Object.keys(report.gates).length} gates.\x1b[0m`);
