/**
 * Proof: the promotion lane is what it claims to be, and nothing else in
 * .github/workflows/ has quietly grown the same power.
 *
 * Checks, in plain English, each one independent of the others so a single
 * wrong line fails only itself:
 *
 *   1. the build lane (.github/workflows/202609042220-promotion-lane-build.yml)
 *      has no write permission anywhere in the file and no step that could
 *      push, dispatch, or otherwise change this repository;
 *   2. the promotion lane (.github/workflows/202609042220-promotion-lane-promote.yml)
 *      is workflow_dispatch-only, with exactly the two required inputs the
 *      task specifies, a named authority, and a write permission that
 *      exists nowhere else in this pair;
 *   3. both .cvaa/contracts/*.json files satisfy their antibodies -- the
 *      antibody code below is copied VERBATIM from
 *      Ventusltd/cvaa@main:vaccines/202609032337-promotion-authority-separated.md
 *      and Ventusltd/cvaa@main:vaccines/202609032335-serial-release-cutter.md
 *      (fenced js blocks, read 2026-09-04), rather than imported from that
 *      repository's working tree, so this proof does not depend on a
 *      neighbouring checkout existing at any particular path in CI;
 *   4. no OTHER workflow this task introduced can push main, and every
 *      PRE-EXISTING workflow's own main-push capability is named and cited
 *      rather than silently assumed safe or silently ignored -- see the
 *      NOTES block this prints, which does not count toward pass/fail.
 *
 *   node tools/proofs/promotion-lane.proof.mjs
 */

import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const BUILD_LANE = '202609042220-promotion-lane-build.yml';
const PROMOTE_LANE = '202609042220-promotion-lane-promote.yml';

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

function read(relative) {
  return readFileSync(join(ROOT, relative), 'utf8');
}

function readJson(relative) {
  return JSON.parse(read(relative));
}

/* Both workflow files carry long leading '#' explanatory comments that, by
   design, spell out exactly the forbidden phrases they are proving absent
   ("no step that runs `git push`", "cannot dispatch another workflow" and
   so on) -- so searching the raw text for those phrases finds the
   COMMENTARY, not a real step. Every check below that looks for a
   forbidden or ordered construct runs against this stripped copy, which
   drops any line whose trimmed content starts with '#'. */
function stripYamlComments(text) {
  return text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
}

/* ------------------------------------------------------------------ */
/* 1. BUILD LANE: read-only, branch/PR-only, cannot promote            */
/* ------------------------------------------------------------------ */

console.log('\n=== build lane ===');
const build = read(`.github/workflows/${BUILD_LANE}`);
const buildCode = stripYamlComments(build);

check('build lane triggers on candidate/** pushes',
  /push:\s*\n\s*branches:\s*\n\s*-\s*['"]?candidate\/\*\*['"]?/.test(build),
  'no push: branches: [candidate/**] trigger found');
check('build lane triggers on pull_request',
  /\bpull_request:/.test(build), 'no pull_request trigger found');
check('build lane never triggers on push to main',
  !/push:[\s\S]{0,80}branches:\s*\n\s*-\s*['"]?main['"]?/.test(build),
  'a push trigger names main');
check('build lane never accepts workflow_dispatch',
  !/^\s*workflow_dispatch:/m.test(build),
  'workflow_dispatch would let this lane be triggered manually, outside candidate pushes and PRs');

const buildPermissionLines = [...build.matchAll(/^\s*permissions:\s*\n((?:\s+\S.*\n)+)/gm)];
check('build lane declares at least one permissions block',
  buildPermissionLines.length > 0, 'no permissions: block found');
const buildPermissionsText = buildPermissionLines.map(m => m[0]).join('\n');
check('every declared build-lane permission is contents: read',
  buildPermissionLines.length > 0
    && buildPermissionLines.every(m => /^\s*permissions:\s*\n\s*contents:\s*read\s*$/m.test(m[0])),
  buildPermissionsText);
check('build lane never declares contents: write',
  !/contents:\s*write/.test(build), 'contents: write found in the build lane');
check('build lane has no git push step',
  !/git\s+push/.test(buildCode), 'a "git push" appears in the build lane (outside comments)');
check('build lane cannot request a Pages (re)build',
  !/pages\/builds/.test(buildCode), 'a Pages build API call appears in the build lane (outside comments)');
check('build lane cannot dispatch another workflow',
  !/gh\s+workflow\s+run/.test(buildCode), '"gh workflow run" appears in the build lane (outside comments)');
check('build lane runs verify-compose.mjs',
  build.includes('tools/scope/verify-compose.mjs') || build.includes('promotion-receipt.mjs'),
  'no reference to verify-compose.mjs or the receipt tool that runs it');
check('build lane runs run-current.mjs',
  build.includes('tools/proofs/run-current.mjs') || build.includes('promotion-receipt.mjs'),
  'no reference to run-current.mjs or the receipt tool that runs it');
check('build lane runs the deep-link visibility browser proof',
  build.includes('deep-link-visibility.browser.mjs') || build.includes('promotion-receipt.mjs'),
  'no reference to deep-link-visibility.browser.mjs or the receipt tool that runs it');
check('build lane runs the arrival-identity browser proof',
  build.includes('202609040229-arrival-identity.browser.mjs') || build.includes('promotion-receipt.mjs'),
  'no reference to the arrival-identity browser proof or the receipt tool that runs it');
check('build lane installs Playwright browsers before any browser proof',
  /playwright install/.test(build), 'no "playwright install" step found');
check('build lane publishes the proof receipt as a workflow artifact',
  /actions\/upload-artifact/.test(build) && /promotion-receipt/.test(build),
  'no upload-artifact step naming the promotion receipt');

// The receipt tool itself: confirm it actually runs the four named proofs
// and reads its stamp from the clock, since the workflow only ever asserts
// that it calls this file.
const receiptTool = read('tools/proofs/promotion-receipt.mjs');
for (const mustRun of [
  'tools/scope/verify-compose.mjs',
  'tools/proofs/run-current.mjs',
  'tools/proofs/deep-link-visibility.browser.mjs',
  'tools/proofs/202609040229-arrival-identity.browser.mjs'
]) {
  check(`promotion-receipt.mjs runs ${mustRun}`, receiptTool.includes(mustRun), 'not named in PROOFS');
}
check('promotion-receipt.mjs reads its stamp from the clock, not a literal',
  /new Date\(\)\.toISOString\(\)/.test(receiptTool) && !/utc_stamp:\s*['"]\d{4}-\d{2}-\d{2}/.test(receiptTool),
  'utc_stamp is not visibly computed from new Date()');

/* ------------------------------------------------------------------ */
/* 2. PROMOTION LANE: dispatch-only, two required inputs, named        */
/*    authority, write permission isolated here                        */
/* ------------------------------------------------------------------ */

console.log('\n=== promotion lane ===');
const promote = read(`.github/workflows/${PROMOTE_LANE}`);
const promoteCode = stripYamlComments(promote);

check('promotion lane\'s only trigger is workflow_dispatch',
  /^on:\s*\n\s*workflow_dispatch:/m.test(promote)
    && !/^\s*push:/m.test(promote) && !/^\s*pull_request:/m.test(promote) && !/^\s*schedule:/m.test(promote),
  'a trigger other than workflow_dispatch is present');
check('promotion lane requires a "generation" input',
  /generation:\s*\n(?:\s+\S.*\n)*?\s*required:\s*true/.test(promote),
  'no required "generation" input found');
check('promotion lane requires a "proof_run_id" input',
  /proof_run_id:\s*\n(?:\s+\S.*\n)*?\s*required:\s*true/.test(promote),
  'no required "proof_run_id" input found');
check('promotion lane names an explicit authority (GitHub Environment)',
  /environment:\s*gridatlas-release-authority/.test(promote),
  'no "environment: gridatlas-release-authority" found');
check('promotion lane declares contents: write',
  /contents:\s*write/.test(promote), 'no contents: write found');
check('promotion lane has a fast-forward push to refs/heads/main',
  /git push origin[^\n]*:refs\/heads\/main/.test(promote),
  'no "git push origin <ref>:refs/heads/main" step found');
check('promotion lane never uses --force on its main push',
  !/git push[^\n]*--force[^\n]*main/.test(promote) && !/git push origin[^\n]*:refs\/heads\/main[^\n]*--force/.test(promote),
  'a --force push to main was found');
check('promotion lane reads the proof run through the GitHub API before pushing',
  /gh api "repos\/\$\{GITHUB_REPOSITORY\}\/actions\/runs\/\$\{PROOF_RUN_ID\}"/.test(promote),
  'no read of repos/.../actions/runs/<id> found');
check('promotion lane requires that API read to be read-only (no gh api --method POST/PUT/PATCH/DELETE)',
  !/gh api[^\n]*--method\s+(POST|PUT|PATCH|DELETE)/.test(promote),
  'a mutating gh api call was found');
check('promotion lane requires the run to have concluded success',
  /conclusion.*=.*"success"/.test(promote), 'no check that conclusion = success');
check('promotion lane requires the run to belong to the build lane workflow file',
  promote.includes(BUILD_LANE), `no reference to ${BUILD_LANE}`);
check('promotion lane calls tools/scope/promote.mjs check before any push',
  (() => {
    const checkIdx = promoteCode.indexOf('promote.mjs check');
    const pushIdx = promoteCode.indexOf('refs/heads/main');
    return checkIdx > -1 && pushIdx > -1 && checkIdx < pushIdx;
  })(),
  'promote.mjs check does not appear before the push step (outside comments)');
check('promotion lane calls tools/scope/promote.mjs write to record last_known_green',
  promoteCode.includes('promote.mjs write'), 'no "promote.mjs write" call found (outside comments)');
check('promotion lane regenerates STATE.md after writing atlas/current.json',
  (() => {
    const writeIdx = promoteCode.indexOf('promote.mjs write');
    const stateIdx = promoteCode.indexOf('tools/scope/loop.mjs state');
    return writeIdx > -1 && stateIdx > -1 && writeIdx < stateIdx;
  })(),
  '"tools/scope/loop.mjs state" does not appear after promote.mjs write (outside comments)');
check('promotion lane requires the dedicated GRIDATLAS_PROMOTION_TOKEN with no fallback to github.token',
  promote.includes('GRIDATLAS_PROMOTION_TOKEN') && !/GRIDATLAS_PROMOTION_TOKEN\s*\|\|\s*github\.token/.test(promote),
  'either the dedicated token is missing or it falls back to github.token');
check('promotion lane concurrency group is serial (cancel-in-progress: false)',
  /concurrency:\s*\n\s*group:\s*gridatlas-promotion-lane\s*\n\s*cancel-in-progress:\s*false/.test(promote),
  'no serial concurrency group found for gridatlas-promotion-lane');

/* ------------------------------------------------------------------ */
/* 3. CONTRACTS satisfy their antibodies                                */
/* ------------------------------------------------------------------ */

console.log('\n=== contracts vs antibodies ===');

// Verbatim from Ventusltd/cvaa@main, vaccines/202609032337-promotion-authority-separated.md,
// fenced ```js block, read 2026-09-04.
const promotionAuthorityAntibody = ({ controlContracts = [] }) => {
  const item = controlContracts.find(c => c.file === "promotion-authority.json");
  if (!item) return [];
  if (item.error) return [".cvaa/contracts/" + item.file + ": " + item.error];
  const d = item.document || {}, b = d.build || {}, p = d.promotion || {}, out = [];
  if (d.schema !== "cvaa.promotion-authority.v1") out.push("promotion-authority.json has an unknown schema");
  if (b.branch_only !== true || b.permissions !== "read" || b.may_promote !== false)
    out.push("candidate build is not branch-only, read-only and promotion-free");
  if (p.explicit_dispatch !== true || typeof p.authority !== "string" || !p.authority.trim())
    out.push("promotion lacks explicit dispatch or a named explicitly authorised principal");
  if (p.may_push_main !== true) out.push("the promotion capability is not isolated in the authorised lane");
  return out;
};

// Verbatim from Ventusltd/cvaa@main, vaccines/202609032335-serial-release-cutter.md,
// fenced ```js block, read 2026-09-04.
const serialReleaseCutterAntibody = ({ controlContracts = [] }) => {
  const item = controlContracts.find(c => c.file === "serial-release-cutter.json");
  if (!item) return [];
  if (item.error) return [".cvaa/contracts/" + item.file + ": " + item.error];
  const d = item.document || {};
  const out = [];
  if (d.schema !== "cvaa.serial-release-cutter.v1") out.push("serial-release-cutter.json has an unknown schema");
  if (d.execution !== "serial") out.push("release cutting is not declared serial");
  if (d.no_op !== "reject") out.push("an unchanged input can inflate the version line");
  if (d.same_input_replay !== "same-release") out.push("same-input replay is not idempotent");
  if (d.divergent_reuse !== "reject") out.push("a release identity can be reused for different input");
  if (!/^[0-9a-f]{40}$/.test(String(d.expected_parent || ""))) out.push("expected_parent is not an exact Git object id");
  if (!/^[0-9a-f]{64}$/.test(String(d.input_sha256 || ""))) out.push("input_sha256 is not an exact content identity");
  return out;
};

const promotionAuthorityDoc = readJson('.cvaa/contracts/promotion-authority.json');
const promotionAuthorityFindings = promotionAuthorityAntibody({
  controlContracts: [{ file: 'promotion-authority.json', document: promotionAuthorityDoc }]
});
check('promotion-authority.json satisfies promotion-authority-separated',
  promotionAuthorityFindings.length === 0, JSON.stringify(promotionAuthorityFindings));

const serialReleaseCutterDoc = readJson('.cvaa/contracts/serial-release-cutter.json');
const serialReleaseCutterFindings = serialReleaseCutterAntibody({
  controlContracts: [{ file: 'serial-release-cutter.json', document: serialReleaseCutterDoc }]
});
check('serial-release-cutter.json satisfies serial-release-cutter',
  serialReleaseCutterFindings.length === 0, JSON.stringify(serialReleaseCutterFindings));

/* ------------------------------------------------------------------ */
/* 4. no OTHER workflow this task introduced can push main; every       */
/*    pre-existing one is named, not silently trusted                   */
/* ------------------------------------------------------------------ */

console.log('\n=== every workflow in .github/workflows/ ===');
const allWorkflowFiles = readdirSync(WORKFLOWS).filter(name => /\.ya?ml$/.test(name)).sort();
const PRE_EXISTING = new Set([
  '202608301321-scope-loop.yml',
  '202608301321-verify-live.yml',
  '202608310015-gridatlas-overnight-next-versions.yml',
  '202608310050-gridatlas-next-version-builders.yml',
  '202608312212-cartridge-proof.yml',
  'rollback-composition.yml'
]);
check('the workflow directory contains exactly the expected files (budget honoured)',
  JSON.stringify(allWorkflowFiles) === JSON.stringify([...PRE_EXISTING, BUILD_LANE, PROMOTE_LANE].sort()),
  JSON.stringify(allWorkflowFiles));

const notes = [];
for (const name of allWorkflowFiles) {
  if (name === BUILD_LANE || name === PROMOTE_LANE) continue;
  const text = read(`.github/workflows/${name}`);
  const declaresWrite = /contents:\s*write/.test(text);
  const pushesMain = /git push[^\n]*(?:HEAD:main|:refs\/heads\/main|origin main\b)/.test(text)
    || /:refs\/heads\/main/.test(text);
  if (declaresWrite || pushesMain) {
    const dispatchOnly = /^on:\s*\n\s*workflow_dispatch:/m.test(text)
      && !/^\s*push:/m.test(text) && !/^\s*schedule:/m.test(text);
    notes.push(`${name}: contents:write=${declaresWrite} pushes-main=${pushesMain} dispatch-only=${dispatchOnly}`);
  }
}
// This is the one assertion this task cannot make universally true without
// editing files it was not asked to touch: 202608301321-verify-live.yml
// predates this task, has contents: write, pushes to main, and its trigger
// is "workflow_dispatch: / push: branches: [main] / paths: [5 named v9.5
// transport files]" -- an automatic, non-dispatch path to main that this
// task did not introduce and was not asked to close. Reported, not hidden,
// and not silently passed as safe.
check('every NEWLY INTRODUCED workflow other than the promotion lane is read-only and cannot push main',
  (() => {
    for (const name of allWorkflowFiles) {
      if (PRE_EXISTING.has(name) || name === PROMOTE_LANE) continue;
      const text = read(`.github/workflows/${name}`);
      if (/contents:\s*write/.test(text) || /:refs\/heads\/main/.test(text)) return false;
    }
    return true;
  })(),
  'a workflow this task added, other than the promotion lane, can write or push main');

console.log('\nNOTES — pre-existing workflows with main-push capability (informational; not asserted safe, not this task\'s mandate to close):');
if (notes.length === 0) console.log('  (none)');
for (const note of notes) console.log(`  - ${note}`);

/* ------------------------------------------------------------------ */

console.log(`\n${passed} check(s) passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exitCode = 1;
}
