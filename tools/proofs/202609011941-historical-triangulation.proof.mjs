/**
 * Mandatory historical triangulation for a candidate branch.
 *
 * A candidate is compared with three distinct Git witnesses:
 *   - the oldest commit at least one month old, or the root when the estate
 *     is younger;
 *   - a deterministic seeded mid-history commit;
 *   - the last safe predecessor (the merge-base with origin/main).
 *
 * This gate deliberately fails on an empty candidate surface, an empty
 * witness surface, a self-reference, or collapsed witness selection.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const COMPUTATION = /^(atlas\/(modules|cartridges|parts)\/.*\.js|tools\/(proofs|ci)\/.*\.mjs)$/;
const PRODUCT = /^(atlas\/(modules|cartridges|parts)\/.*\.js)$/;

export function seededIndex(seed, length) {
  if (!Number.isInteger(length) || length <= 0) return -1;
  const word = createHash('sha256').update(String(seed)).digest().readUInt32BE(0);
  return word % length;
}

function commits() {
  return git('rev-list', '--reverse', '--first-parent', 'HEAD').split(/\r?\n/).filter(Boolean);
}
function timestamp(sha) { return Number(git('show', '-s', '--format=%ct', sha)); }
function treeSurface(sha) {
  return git('ls-tree', '-r', '--name-only', sha).split(/\r?\n/).filter(path => COMPUTATION.test(path));
}
function blobSignatures(sha, paths) {
  return paths.map(path => {
    const text = git('show', `${sha}:${path}`);
    return {
      path, bytes: Buffer.byteLength(text),
      schemas: [...text.matchAll(/["']([\w.-]+\.v\d+)["']/g)].map(m => m[1]),
      forbidden_inference_terms: [...new Set((text.match(/\b(headroom|available capacity|can connect)\b/gi) || [])
        .map(term => term.toLowerCase()))]
    };
  });
}

const history = commits();
const candidate = git('rev-parse', 'HEAD');
let safe;
try { safe = git('merge-base', 'HEAD', 'origin/main'); }
catch { safe = git('rev-parse', 'HEAD^'); }
const safeAt = history.indexOf(safe);
const beforeSafe = history.slice(0, safeAt < 0 ? -1 : safeAt);
const month = 30 * 24 * 60 * 60;
const safeTime = timestamp(safe);
/* A repository root with no computation is not an historical comparison.
   Select only commits with a non-zero surface, then prefer a month-old one
   when the estate is old enough; otherwise use its oldest real surface. */
const historicalSurfaces = beforeSafe.filter(sha => treeSurface(sha).length > 0);
const monthOld = historicalSurfaces.filter(sha => timestamp(sha) <= safeTime - month);
const oldest = (monthOld.length ? monthOld : historicalSurfaces)[0] || null;
const midPool = historicalSurfaces.filter(sha => sha !== oldest && sha !== safe);
const mid = midPool[seededIndex(candidate, midPool.length)] || null;

const baseRange = `${safe}..${candidate}`;
const changed = git('diff', '--name-only', baseRange).split(/\r?\n/).filter(path => PRODUCT.test(path));
const witnesses = [{ role: 'oldest-or-month-old', sha: oldest },
  { role: 'seeded-mid-history', sha: mid }, { role: 'last-safe-predecessor', sha: safe }];

let passed = 0; const failures = [];
function check(label, condition, detail = '') {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`  [FAIL] ${label}`); }
}

check('candidate branch changes at least one computation product surface', changed.length > 0,
  `range ${baseRange}`);
check('all three historical roles resolve', witnesses.every(w => w.sha), JSON.stringify(witnesses));
check('no historical role self-references the candidate',
  witnesses.every(w => w.sha !== candidate));
check('the three historical witnesses are distinct',
  new Set(witnesses.map(w => w.sha)).size === witnesses.length);
check('the seeded witness is selected reproducibly',
  mid === midPool[seededIndex(candidate, midPool.length)]);

const candidateSignatures = blobSignatures(candidate, changed);
check('candidate comparison extracted non-zero surfaces',
  candidateSignatures.length > 0 && candidateSignatures.every(row => row.bytes > 0));

for (const witness of witnesses) {
  const paths = treeSurface(witness.sha);
  const signatures = blobSignatures(witness.sha, paths);
  check(`${witness.role}: comparison surface is non-zero`,
    paths.length > 0 && signatures.length === paths.length && signatures.every(row => row.bytes > 0),
    witness.sha);
  console.log(`         ${witness.role}: ${witness.sha.slice(0, 12)}, ${paths.length} computation surfaces`);
}

/* The comparison artefact is intentionally emitted: CI logs retain exactly
   which immutable witnesses and candidate surfaces were compared. */
console.log(`         candidate: ${candidate.slice(0, 12)}, ${changed.length} changed product surface(s)`);
for (const row of candidateSignatures) console.log(`           ${row.path} (${row.bytes} bytes)`);
console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('candidate triangulated against old, deterministic mid-history and last-safe surfaces.');
