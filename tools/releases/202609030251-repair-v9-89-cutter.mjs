/**
 * One-shot repair of the preparatory v9.89 cutter after the first Actions run
 * proved that both composition cartridges must be restamped together.
 * Deletes itself after producing a syntax-checked, self-contained cutter.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..', '..');
const cutterPath = path.join(ROOT, 'tools', 'releases',
  '202609030251-cut-grid-data-v9-89.mjs');
const die = (message) => { console.error(`v9.89 cutter repair refused: ${message}`); process.exit(1); };
if (!fs.existsSync(cutterPath)) die('cutter source is missing');
const original = fs.readFileSync(cutterPath, 'utf8').replace(/\r\n/g, '\n');
let source = original;

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) die(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

const oldAncestry = `if (headSha !== EXPECTED_PARENT_SHA && !process.env.GRIDATLAS_ALLOW_PREP_COMMIT) {
  const parent = spawnSync('git', ['rev-parse', 'HEAD^'], { cwd: ROOT, encoding: 'utf8' });
  if (parent.status !== 0 || parent.stdout.trim() !== EXPECTED_PARENT_SHA) {
    die(\`branch is not based directly on audited parent \${EXPECTED_PARENT_SHA}; HEAD is \${headSha}\`);
  }
}`;
const newAncestry = `if (headSha !== EXPECTED_PARENT_SHA && !process.env.GRIDATLAS_ALLOW_PREP_COMMIT) {
  const ancestry = spawnSync('git',
    ['merge-base', '--is-ancestor', EXPECTED_PARENT_SHA, 'HEAD'],
    { cwd: ROOT, encoding: 'utf8' });
  if (ancestry.status !== 0) {
    die(\`branch does not descend from audited parent \${EXPECTED_PARENT_SHA}; HEAD is \${headSha}\`);
  }
  const changed = spawnSync('git',
    ['diff', '--name-only', \`\${EXPECTED_PARENT_SHA}..HEAD\`],
    { cwd: ROOT, encoding: 'utf8' });
  if (changed.status !== 0) die('cannot inspect preparatory changes');
  const allowedPreparatoryPaths = new Set([
    '.github/workflows/202609030251-build-grid-data-v9-89.yml',
    '.github/workflows/202609030251-pipelinenews-arrival-contract.yml',
    'tools/proofs/202609030251-pipelinenews-arrival-contract.mjs',
    'tools/releases/202609030251-cut-grid-data-v9-89.mjs',
    'tools/releases/202609030251-patch-sld-proof-for-engine-successor.mjs',
    'tools/releases/202609030251-repair-v9-89-cutter.mjs'
  ]);
  const unexpected = changed.stdout.trim().split('\\n')
    .filter(Boolean).filter(file => !allowedPreparatoryPaths.has(file));
  if (unexpected.length) {
    die(\`preparatory branch changed unaudited paths: \${unexpected.join(', ')}\`);
  }
}`;
replaceOnce('audited ancestry guard', oldAncestry, newAncestry);

const oldRestamp = `    '--restamp', 'substation-intelligence',
    '--parts-from', \`substation-intelligence=\${seedRel}\`,
    '--scope', 'GridAtlas v9.89 accepts Pipeline News wider-fleet technology arrivals while retaining the verified grid-data pin',
    '--proof', \`tools/proofs/\${generation}-substation-intelligence.proof.mjs\`,`;
const newRestamp = `    '--restamp', 'substation-intelligence',
    '--restamp', 'sld-sandbox',
    '--parts-from', \`substation-intelligence=\${seedRel}\`,
    '--scope', 'Pipeline News wider-fleet arrivals',
    '--proof', \`tools/proofs/\${generation}-substation-intelligence.proof.mjs\`,
    '--proof', \`tools/proofs/\${generation}-sld-sandbox.proof.mjs\`,`;
replaceOnce('two-cartridge composition restamp', oldRestamp, newRestamp);

const oldProofBoundary = `fs.writeFileSync(proofPath, proof, 'utf8');

run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);`;
const newProofBoundary = `fs.writeFileSync(proofPath, proof, 'utf8');
run(process.execPath, [
  path.join(ROOT, 'tools', 'releases',
    '202609030251-patch-sld-proof-for-engine-successor.mjs'),
  '--generation', generation
]);

run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);`;
replaceOnce('SLD engine-successor proof patch', oldProofBoundary, newProofBoundary);

const oldValidationBoundary = `run(process.execPath, [
  path.join(ROOT, 'tools', 'releases',
    '202609030251-patch-sld-proof-for-engine-successor.mjs'),
  '--generation', generation
]);

run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);`;
const newValidationBoundary = `run(process.execPath, [
  path.join(ROOT, 'tools', 'releases',
    '202609030251-patch-sld-proof-for-engine-successor.mjs'),
  '--generation', generation
]);

/* The build workflow is one-shot and must leave before the repository's
   active-workflow budget is checked. The permanent two-repository contract
   earns a declared place in that budget. */
const oneShotWorkflow = path.join(ROOT, '.github', 'workflows',
  '202609030251-build-grid-data-v9-89.yml');
fs.rmSync(oneShotWorkflow, { force: true });
const scopeLibPath = path.join(ROOT, 'tools', 'scope', 'lib.mjs');
const scopeLibBefore = fs.readFileSync(scopeLibPath, 'utf8');
const workflowBudgetTail = \`  '202608312212-cartridge-proof.yml'\\n]);\`;
const workflowBudgetSuccessor = \`  '202608312212-cartridge-proof.yml',\\n  // v9.89: every Pipeline News arrival vocabulary is checked against the\\n  // composed Atlas receiver; this is permanent, node-only and bounded.\\n  '202609030251-pipelinenews-arrival-contract.yml'\\n]);\`;
if (!scopeLibBefore.includes("'202609030251-pipelinenews-arrival-contract.yml'")) {
  const count = scopeLibBefore.split(workflowBudgetTail).length - 1;
  if (count !== 1) die(\`workflow budget tail: expected one match, found \${count}\`);
  fs.writeFileSync(scopeLibPath,
    scopeLibBefore.replace(workflowBudgetTail, workflowBudgetSuccessor), 'utf8');
}

run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);`;
replaceOnce('one-shot retirement and permanent workflow budget',
  oldValidationBoundary, newValidationBoundary);

const oldTrailingRetirement = `const oneShotWorkflow = path.join(ROOT, '.github', 'workflows',
  '202609030251-build-grid-data-v9-89.yml');
fs.rmSync(oneShotWorkflow, { force: true });

console.log(JSON.stringify({`;
const newTrailingRetirement = `if (fs.existsSync(oneShotWorkflow)) {
  die('one-shot workflow survived the lint boundary');
}

console.log(JSON.stringify({`;
replaceOnce('trailing one-shot retirement', oldTrailingRetirement, newTrailingRetirement);

fs.writeFileSync(cutterPath, source, 'utf8');
const checked = spawnSync(process.execPath, ['--check', cutterPath], {
  cwd: ROOT, encoding: 'utf8'
});
if (checked.status !== 0) {
  fs.writeFileSync(cutterPath, original, 'utf8');
  die(checked.stderr || checked.stdout || 'node --check failed');
}
fs.rmSync(SELF, { force: true });
console.log(JSON.stringify({
  status: 'REPAIRED',
  cutter: path.relative(ROOT, cutterPath).replace(/\\/g, '/'),
  restamped_cartridges: ['substation-intelligence', 'sld-sandbox'],
  self_deleted: true
}));
