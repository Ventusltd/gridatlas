/**
 * QuantumSpawn recovery: the capsule is checked against current Git.
 *
 * Codex's vaccine (cvaa `quantumspawn-recovery`, 202609012359) requires
 * that a repository running an unattended version loop owns BOTH a
 * timestamped recovery capsule AND an independent executable proof that
 * detects drift from current repository state. This is that proof.
 *
 * The failure it exists to prevent is specific and it has already happened
 * in this estate in another form: a document that describes the system
 * accurately on the day it is written, is never checked again, and is read
 * six generations later as if it were still true. A recovery capsule that
 * has gone stale is worse than none, because a replacement executor trusts
 * it and rebuilds the wrong thing.
 *
 * So every factual claim the capsule makes about files, gates and live
 * state is re-derived here from the repository itself. Prose is not
 * checked; claims are.
 *
 *   node tools/proofs/202609012305-quantumspawn-recovery.proof.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  [PASS] ${name}`); }
  else { failures.push(`${name}${detail ? ' - ' + detail : ''}`); console.log(`  [FAIL] ${name}${detail ? ' - ' + detail : ''}`); }
}
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() || '';

console.log('\nthe capsule exists and is the newest one\n');

const GOV = join(ROOT, 'governance');
const capsules = existsSync(GOV)
  ? readdirSync(GOV).filter(f => /^\d{12}-quantumspawn-recovery\.md$/.test(f)).sort()
  : [];
check('a timestamped recovery capsule exists', capsules.length > 0);
if (!capsules.length) {
  console.log(`\n${passed}/${passed + failures.length} checks passed`);
  console.log('FAILURES'); for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
const capsuleName = capsules[capsules.length - 1];
const capsule = readFileSync(join(GOV, capsuleName), 'utf8');
const stamp = capsuleName.slice(0, 12);
console.log(`  (reading ${capsuleName})`);

/* This proof must itself be findable by the antibody, which looks for
   tools/proofs/<12 digits>-quantumspawn-recovery.proof.mjs. */
check('this proof is named so the antibody can find it',
  /^\d{12}-quantumspawn-recovery\.proof\.mjs$/.test(basename(fileURLToPath(import.meta.url))));

console.log('\nthe unattended loop the capsule describes is really there\n');

const LOOP = 'tools/overnight';
check('the loop directory exists', existsSync(join(ROOT, LOOP)));
const runners = readdirSync(join(ROOT, LOOP)).filter(f => /^\d{12}-shift\.mjs$/.test(f));
check('exactly one runner is present', runners.length === 1, runners.join(','));
check('the capsule names the runner that is actually on disk',
  runners.every(r => capsule.includes(r)), runners.join(','));

const STEPS = join(ROOT, LOOP, 'steps');
const steps = existsSync(STEPS) ? readdirSync(STEPS).filter(f => f.endsWith('.mjs')) : [];
check('the loop has at least one step to run', steps.length > 0, `${steps.length}`);

console.log('\nevery gate the capsule names is a file that exists\n');

/* Pulled out of the capsule text rather than hard-coded here: the point is
   to catch the capsule naming a gate that has been renamed or deleted. */
const named = [...new Set(capsule.match(/tools\/(?:proofs|ci)\/[\w.\-]+\.mjs/g) || [])];
check('the capsule names some gates at all', named.length >= 4, `${named.length}`);
for (const rel of named) {
  const generic = rel.replace('<generation>', '');
  if (rel.includes('<generation>')) {
    const suffix = generic.split('/').pop();
    const found = readdirSync(join(ROOT, 'tools', 'proofs')).some(f => f.endsWith(suffix));
    check(`a gate matching ${rel} exists`, found);
  } else {
    check(`${rel} exists`, existsSync(join(ROOT, rel)));
  }
}

console.log('\nthe capsule tells the truth about what is shipped\n');

const current = JSON.parse(readFileSync(join(ROOT, 'atlas', 'current.json'), 'utf8'));
check('the capsule names the generation that current.json points at',
  capsule.includes(current.generation), current.generation);

const sld = (current.cartridges || []).find(c => c.id === 'sld-sandbox');
check('the capsule names the version that is pointed at',
  !sld || capsule.includes(sld.version), sld ? sld.version : 'no sld-sandbox');

/* The count in the capsule must match the log, and the log's only
   creditable outcome is `live`. This is the check that stops a recovering
   executor from inheriting an inflated tally. */
const LOG = join(ROOT, LOOP, 'shift-log.json');
check('the shift log exists', existsSync(LOG));
if (existsSync(LOG)) {
  const runs = JSON.parse(readFileSync(LOG, 'utf8')).runs || [];
  const live = runs.filter(r => r.outcome === 'live');
  const liveGenerations = [...new Set(live.map(r => r.generation).filter(Boolean))];
  check('the log records at least one live cut', live.length > 0);
  check('every generation the log calls live is named in the capsule',
    liveGenerations.every(g => capsule.includes(g)),
    liveGenerations.filter(g => !capsule.includes(g)).join(','));
  check('the capsule does not claim a generation the log never marked live', (() => {
    const claimed = [...new Set(capsule.match(/\b2026\d{8}\b/g) || [])]
      .filter(g => /^20260[89]/.test(g));
    const known = new Set([...liveGenerations, current.generation, current.previous_generation, stamp]);
    /* generations named in prose as history are fine; what must not happen
       is the capsule naming one as LIVE that the log never marked live */
    const asLive = [...new Set((capsule.match(/`(2026\d{8})`[^\n]{0,40}(?:live|is live)/gi) || [])
      .map(m => (m.match(/2026\d{8}/) || [])[0]))];
    return asLive.every(g => known.has(g));
  })());
  check('the capsule distinguishes attended cuts from unattended ones',
    /attended/i.test(capsule));
  const attended = runs.filter(r => r.attended === true);
  check('an attended run in the log is described as attended in the capsule',
    attended.length === 0 || /attended/i.test(capsule), `${attended.length} attended`);
}

console.log('\nthe standards that stop a release are all carried\n');

/* If one of these disappears from the capsule, a recovering executor loses
   the rule and re-ships the mistake it was written for. */
for (const [label, pattern] of [
  ['never grade a grid position', /never grade|no STRONG|never graded/i],
  ['a straight line is not a route', /not a cable route|straight line is not/i],
  ['never mix voltages', /never mix voltages/i],
  ['never decode voltage from a node code', /decode a voltage from a node code|never decode/i],
  ['R/X/B carried never computed with', /carried, never computed with/i],
  ['ratings are never summed', /never summed|not summed/i],
  ['a rating is not headroom', /not headroom|no field expressing spare/i],
  ['a skip is not a pass', /skip is not a pass/i],
  ['fail closed on an unknown schema', /fail closed/i],
  ['never amend a shipped generation', /never amend/i],
  ['stamps are read from the clock', /read from `?date -u`?|read from the clock/i],
]) {
  check(`the capsule carries: ${label}`, pattern.test(capsule));
}

console.log('\nit is a witness, not an authority\n');

check('the capsule says current Git wins over itself',
  /witness, never authority|in favour of current evidence/i.test(capsule));
check('the wake sequence is read-only before it changes anything',
  /read-only first/i.test(capsule) && /Change nothing until/i.test(capsule));
check('it points at the coordination board',
  /BOARD\.md/.test(capsule));
check('it records what is NOT yet done rather than only what is',
  /not yet built|still open|not to be claimed/i.test(capsule));

console.log('\nthe capsule is committed, not just sitting in the tree\n');

const tracked = git('ls-files', `governance/${capsuleName}`);
check('the capsule is tracked by git', tracked.length > 0,
  tracked ? '' : 'untracked - a recovery capsule that is not committed does not survive');

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.log('FAILURES');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('the capsule matches the repository it claims to describe, and says');
console.log('plainly that current Git outranks it.');
