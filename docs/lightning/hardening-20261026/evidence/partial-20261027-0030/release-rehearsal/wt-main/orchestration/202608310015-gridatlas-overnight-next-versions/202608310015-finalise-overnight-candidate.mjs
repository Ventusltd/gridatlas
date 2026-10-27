import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import fsSync from 'node:fs';

const root = path.resolve(process.env.SOURCE_ROOT || process.cwd());
const candidateDir = String(process.env.CANDIDATE_DIR || '');
const candidateManifestPath = String(process.env.CANDIDATE_MANIFEST || '');
const candidateCurrentPath = String(process.env.CANDIDATE_CURRENT || '');
const proofPath = String(process.env.PROOF || '');
const programmeRoot = String(process.env.PROGRAMME_ROOT || 'nightly/202608310015-gridatlas-overnight-next-versions');
const runStamp = String(process.env.RUN_STAMP || '202608310015');
const candidateId = String(process.env.CANDIDATE_ID || path.posix.basename(candidateDir));
const browserExit = Number(process.env.BROWSER_EXIT || 0);
if (!candidateDir || !candidateManifestPath || !candidateCurrentPath || !proofPath) {
  throw new Error('CANDIDATE_DIR, CANDIDATE_MANIFEST, CANDIDATE_CURRENT and PROOF are required');
}

function appendOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fsSync.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replaceAll('\n', ' ')}\n`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(path.join(root, filePath), 'utf8'));
}

async function writeJson(filePath, value) {
  const absolute = path.join(root, filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function listFilesRecursive(folder, relative = '') {
  const absolute = path.join(folder, relative);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = relative ? path.posix.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await listFilesRecursive(folder, child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort();
}

let proof;
try {
  proof = await readJson(proofPath);
} catch (error) {
  proof = {
    schema: 'gridatlas.overnight-candidate-browser-proof.v1',
    status: 'FAIL',
    hard_failures: 1,
    soft_failures: 0,
    failure: `browser proof missing or unreadable: ${String(error?.message || error)}`
  };
}

const allowedStatuses = new Set(['PASS', 'CORE_PASS_EXTERNAL_UNAVAILABLE', 'FAIL']);
const testStatus = allowedStatuses.has(proof.status) ? proof.status : 'FAIL';
const testedAt = new Date().toISOString();
const manifest = await readJson(candidateManifestPath);
manifest.test_status = testStatus;
manifest.tested_at = testedAt;
manifest.quarantined = testStatus === 'FAIL';
manifest.proof = {
  path: proofPath,
  screenshot: proofPath.replace(/\.json$/, '.png'),
  browser_exit: browserExit,
  hard_failures: Number(proof.hard_failures || 0),
  soft_failures: Number(proof.soft_failures || 0),
  status: testStatus
};
await writeJson(candidateManifestPath, manifest);

const current = await readJson(candidateCurrentPath);
current.candidate ||= {};
current.candidate.test_status = testStatus;
current.candidate.tested_at = testedAt;
current.candidate.quarantined = testStatus === 'FAIL';
await writeJson(candidateCurrentPath, current);

const ledgerPath = path.posix.join(programmeRoot, '202608310015-gridatlas-programme-ledger.json');
const ledger = await readJson(ledgerPath);
const ledgerCandidate = (ledger.candidates || []).find(item => item.candidate_id === candidateId);
if (!ledgerCandidate) throw new Error(`candidate ${candidateId} missing from programme ledger`);
ledgerCandidate.test_status = testStatus;
ledgerCandidate.tested_at = testedAt;
ledgerCandidate.proof_path = proofPath;
ledgerCandidate.browser_exit = browserExit;
await writeJson(ledgerPath, ledger);

const statusJsonName = `${runStamp}-gridatlas-candidate-test-status.json`;
const statusHtmlName = `${runStamp}-gridatlas-candidate-test-status.html`;
const statusJsonPath = path.posix.join(candidateDir, statusJsonName);
const statusHtmlPath = path.posix.join(candidateDir, statusHtmlName);
const status = {
  schema: 'gridatlas.overnight-candidate-test-status.v1',
  generation: runStamp,
  candidate_id: candidateId,
  candidate_route: `/gridatlas/${candidateDir}/`,
  tested_at: testedAt,
  status: testStatus,
  quarantined: testStatus === 'FAIL',
  browser_exit: browserExit,
  hard_failures: Number(proof.hard_failures || 0),
  soft_failures: Number(proof.soft_failures || 0),
  proof_path: proofPath,
  tests: proof.tests || [],
  console_errors: proof.console_errors || [],
  page_errors: proof.page_errors || []
};
await writeJson(statusJsonPath, status);

const rows = (proof.tests || []).map(test => `<tr><td>${htmlEscape(test.severity || '')}</td><td>${htmlEscape(test.name || '')}</td><td>${htmlEscape(test.status || '')}</td><td><pre>${htmlEscape(test.error || JSON.stringify(test.evidence || {}, null, 2))}</pre></td></tr>`).join('\n');
const statusHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(candidateId)} test status</title>
<style>body{font:14px/1.4 system-ui;margin:24px;max-width:1500px}code,pre{font:12px/1.35 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}.PASS{color:#075}.FAIL{color:#b00}.CORE_PASS_EXTERNAL_UNAVAILABLE{color:#a50}</style></head><body>
<h1>${htmlEscape(candidateId)}</h1>
<p>Status: <strong class="${htmlEscape(testStatus)}">${htmlEscape(testStatus)}</strong></p>
<p><a href="./">Open candidate app</a> · <a href="./${htmlEscape(path.posix.basename(proofPath))}">Browser proof JSON</a></p>
<p>Hard failures: ${status.hard_failures}; soft failures: ${status.soft_failures}; browser exit: ${browserExit}.</p>
<table><thead><tr><th>Severity</th><th>Test</th><th>Status</th><th>Evidence / error</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>\n`;
await fs.writeFile(path.join(root, statusHtmlPath), statusHtml);

const candidateAbsolute = path.join(root, candidateDir);
const sumsName = `${runStamp}-gridatlas-sha256sums.txt`;
const files = (await listFilesRecursive(candidateAbsolute)).filter(name => name !== sumsName);
const sums = [];
for (const name of files) {
  const buffer = await fs.readFile(path.join(candidateAbsolute, name));
  sums.push(`${sha256(buffer)}  ${name}`);
}
await fs.writeFile(path.join(candidateAbsolute, sumsName), `${sums.join('\n')}\n`);

appendOutput('candidate_status', testStatus);
appendOutput('candidate_quarantined', testStatus === 'FAIL' ? 'true' : 'false');
appendOutput('status_json', statusJsonPath);
appendOutput('status_html', statusHtmlPath);
console.log(JSON.stringify({ candidate_id: candidateId, status: testStatus, hard_failures: status.hard_failures, soft_failures: status.soft_failures, status_json: statusJsonPath }, null, 2));
