import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scanner = join(root, 'tools/ci/202609012240-estate-deep-scan.mjs');
const out = join(root, 'governance');
let passed = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
};

const source = readFileSync(scanner, 'utf8');
check('scanner source contains no literal backspace bytes', !source.includes(String.fromCharCode(8)));
check('zero deep-link matches are an explicit failure', /proved-by-zero-diagnostic/.test(source));
check('Pipeline News producer scan is restricted to GridAtlas surfaces', /gridAtlasOnly: true/.test(source));
check('composition proofs derive from generation and cartridge id',
  /\$\{cartridge\.generation\}-\$\{cartridge\.id\}\.proof\.mjs/.test(source));

execFileSync(process.execPath, [scanner, '--out', out], { cwd: root, stdio: 'pipe' });
const report = JSON.parse(readFileSync(join(out, '202609012240-estate-deep-scan.json'), 'utf8'));
check('both application repositories were scanned',
  report.scope.includes('gridatlas') && report.scope.includes('pipelinenews'));
check('producer and consumer scans bound real variables',
  report.deep_link.producer_variables_bound > 0 && report.deep_link.consumer_variables_bound > 0);
check('the identity parameter is produced and consumed',
  report.deep_link.produced.includes('repd_ref') && report.deep_link.consumed.includes('repd_ref'));
check('every current cartridge exists', report.composition.cartridges.every(item => item.exists));
check('every current cartridge has its generation-matched proof',
  report.composition.cartridges.every(item => item.proof_exists));
check('the scan retains complete commit counts',
  report.repos.gridatlas.commits > 200 && report.repos.pipelinenews.commits > 300);

console.log(`${passed}/${passed} checks passed`);
