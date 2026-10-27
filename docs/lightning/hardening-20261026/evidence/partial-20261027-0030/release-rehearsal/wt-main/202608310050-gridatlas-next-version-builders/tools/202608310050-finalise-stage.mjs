#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.env.OUTPUT_DIR || process.argv[2] || '');
const stage = process.env.STAGE || process.argv[3] || '';
if (!outputDir || !fs.existsSync(outputDir)) throw new Error('OUTPUT_DIR is required');
if (!stage) throw new Error('STAGE is required');

function outcome(name) {
  return String(process.env[name] || '').toLowerCase();
}
function success(name) {
  return outcome(name) === 'success';
}
function list(directory) {
  const items = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) items.push(...list(target));
    else if (entry.isFile()) items.push(target);
  }
  return items.sort();
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

let status = 'FAILED_WITH_EVIDENCE';
let completed = false;
let summary = '';
if (stage === 'n1') {
  completed = success('N1_BUILD_OUTCOME') && success('N1_BROWSER_INSTALL_OUTCOME') && success('N1_PROOF_OUTCOME');
  status = completed ? 'PASS_PUBLIC_FEDERATED_DEEP_LINK_CANDIDATE' : 'FAILED_WITH_EVIDENCE';
  summary = completed ? 'Stable-route producer candidates built and both public sentinels proved.' : 'N1 candidate or public browser proof failed; evidence retained and N1 will retry.';
} else if (stage === 'n2') {
  completed = success('N2_INSTALL_OUTCOME') && success('N2_BUILD_OUTCOME');
  status = completed ? 'BUILT_EXACT_REPD_REF_INDEX_CANDIDATE' : 'FAILED_WITH_EVIDENCE';
  summary = completed ? 'Static exact-reference index built and hash-closed; no live cartridge or pointer changed.' : 'N2 index build failed; evidence retained and N2 will retry.';
} else if (stage === 'n3') {
  completed = success('N3_MEASURE_OUTCOME');
  status = completed ? 'MEASURED_CVAA_FINDINGS' : 'FAILED_WITH_EVIDENCE';
  summary = completed ? 'Pinned CVAA self-test and current-repository findings captured; no baseline installed.' : 'CVAA measurement failed; evidence retained and N3 will retry.';
} else if (stage === 'n4') {
  completed = success('N4_BUILD_OUTCOME');
  status = completed ? 'BUILT_DESIGN_FREEZE_CALIBRATION_CANDIDATE' : 'FAILED_WITH_EVIDENCE';
  summary = completed ? 'Frozen-spine calibration built with sub-30 cells left NULL.' : 'N4 calibration failed; evidence retained and N4 will retry.';
} else if (['n5', 'n6', 'n11', 'handover'].includes(stage)) {
  completed = success('READINESS_OUTCOME');
  status = completed ? 'READINESS_RECORDED' : 'FAILED_WITH_EVIDENCE';
  summary = completed ? `${stage.toUpperCase()} readiness and blockers recorded from the complete build plan.` : `${stage.toUpperCase()} readiness recording failed; evidence retained and the stage will retry.`;
}

const sourceLockPath = path.join(outputDir, 'source-lock.json');
const sourceLock = fs.existsSync(sourceLockPath) ? JSON.parse(fs.readFileSync(sourceLockPath, 'utf8')) : null;
const result = {
  schema: 'gridatlas.next-version-builder-status.v1',
  generation: sourceLock?.generation || path.basename(outputDir).slice(0, 12),
  stage,
  status,
  completed,
  summary,
  observed_at: new Date().toISOString(),
  source_ref: sourceLock?.selected_ref || null,
  source_sha: sourceLock?.selected_sha || null,
  source_fingerprint: sourceLock?.fingerprint || null,
  contracts: {
    source_folder_read_only: true,
    immutable_shell_modified: false,
    atlas_current_modified: false,
    live_pointer_modified: false,
    producer_repository_modified: false,
    full_application_copy_created: false,
    automatic_promotion: false
  },
  step_outcomes: Object.fromEntries(Object.keys(process.env).filter(key => key.endsWith('_OUTCOME')).sort().map(key => [key, process.env[key]]))
};
fs.writeFileSync(path.join(outputDir, 'status.json'), `${JSON.stringify(result, null, 2)}\n`);
const sums = list(outputDir)
  .filter(file => path.basename(file) !== 'SHA256SUMS.txt')
  .map(file => `${sha256(file)}  ${path.relative(outputDir, file).split(path.sep).join('/')}`)
  .join('\n');
fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'), `${sums}\n`);
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) fs.appendFileSync(githubOutput, `status=${status}\ncompleted=${completed}\n`);
console.log(JSON.stringify(result, null, 2));
