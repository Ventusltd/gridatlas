/**
 * GridAtlas <-> Pipeline News arrival contract.
 *
 * Reads the currently composed GridAtlas bytes and the immutable Pipeline News
 * wider-fleet release. It fails if any technology value emitted by a MAP link
 * is rejected by the Atlas receiver. Pipeline News duplicate identities are
 * measured and reported here but remain an upstream release defect, not a
 * reason to hide a valid GridAtlas receiver fix.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const PN = path.resolve(arg('--pipelinenews', path.join(ROOT, '..', 'pipelinenews')));
const RELEASE = arg('--release', '202609030009-pipelinenews');
const EXPECTED_PN_COMMIT = '1a9868e76f970f20590a4110acc337e92d360f94';
const EXPECTED_GRID_REF = '1c9909d1138704b29235c27fd769436dda8a0b18';
const EXPECTED_CONNECTION_POINTS_SHA = '11e28859a6d17cc8ee4047c2032d55d043be98f7123743f3b2b03225e07a4c0c';
const EXPECTED_TRANSMISSION_SHA = 'fc331cc20b061f85adf18d890762a164328a1c5e84acef6a23d35d36f849fc8a';
const EXPECTED_WIDER = Object.freeze([
  'act', 'biomass', 'caes', 'flywheel', 'geothermal',
  'hydro', 'hydrogen', 'other', 'tidal'
]);

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failures.push(`${label}${detail ? `: ${detail}` : ''}`);
    console.error(`FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const currentPath = path.join(ROOT, 'atlas', 'current.json');
check('GridAtlas current.json exists', fs.existsSync(currentPath), currentPath);
const current = fs.existsSync(currentPath) ? JSON.parse(fs.readFileSync(currentPath, 'utf8')) : {};
const cartridges = current.cartridges || [];
check('the checkout contains a composed Atlas', Boolean(current.generation) && cartridges.length > 0);

let allowed = null;
let allowedIn = null;
for (const entry of cartridges) {
  const file = path.join(ROOT, 'atlas', String(entry.path || '').replace(/^\.\//, ''));
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/allowedTechnologies\s*=\s*new\s+Set\(\s*\[([^\]]*)\]\s*\)/);
  if (!match) continue;
  allowed = new Set([...match[1].matchAll(/["']([\w_]+)["']/g)].map(row => row[1]));
  allowedIn = entry.id;
  break;
}
check('the composed Atlas declares an arrival technology vocabulary', allowed !== null);
if (allowed) console.log(`      ${allowedIn}: ${[...allowed].sort().join(', ')}`);

const generation = RELEASE.slice(0, 12);
const releaseRoot = path.join(PN, 'releases', RELEASE);
const payloadPath = path.join(releaseRoot, 'data', `${generation}-wider-fleet.json`);
const cartridgePath = path.join(releaseRoot, 'assets', `${generation}-wider-fleet.mjs`);
check('the pinned Pipeline News release exists', fs.existsSync(releaseRoot), releaseRoot);
check('the wider-fleet payload exists', fs.existsSync(payloadPath), payloadPath);
check('the wider-fleet link emitter exists', fs.existsSync(cartridgePath), cartridgePath);

let rows = [];
let emitter = '';
if (fs.existsSync(payloadPath)) rows = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
if (fs.existsSync(cartridgePath)) emitter = fs.readFileSync(cartridgePath, 'utf8');
check('the immutable wider fleet contains 1,104 rows', Array.isArray(rows) && rows.length === 1104,
  `found ${Array.isArray(rows) ? rows.length : 'non-array'}`);

const setters = new Map([...emitter.matchAll(
  /query\.set\(\s*["']([\w_]+)["']\s*,\s*([^)]+)\)/g
)].map(match => [match[1], match[2].trim()]));
const expression = setters.get('technology') || '';
const field = /row\.rt\b/.test(expression) ? 'rt' : /row\.t\b/.test(expression) ? 't' : null;
check('the wider-fleet technology parameter resolves to a payload field', field !== null, expression);
const emitted = field
  ? [...new Set(rows.map(row => row[field]).filter(Boolean))].sort()
  : [];
console.log(`      emitted: ${emitted.join(', ')}`);
check('the release emits the exact measured wider-fleet vocabulary',
  JSON.stringify(emitted) === JSON.stringify([...EXPECTED_WIDER].sort()),
  `found ${emitted.length}: ${emitted.join(', ')}`);
const rejected = allowed ? emitted.filter(value => !allowed.has(value)) : emitted;
const rejectedRows = allowed && field ? rows.filter(row => !allowed.has(row[field])).length : rows.length;
check('every wider-fleet MAP technology is accepted by the composed Atlas', rejected.length === 0,
  `${rejected.join(', ')}; ${rejectedRows} of ${rows.length} rows rejected`);

const identity = row => JSON.stringify([row.n, row.rt, row.c, row.ll]);
const identities = new Map();
for (const row of rows) identities.set(identity(row), (identities.get(identity(row)) || 0) + 1);
const duplicates = [...identities].filter(([, count]) => count > 1);
const extraRows = duplicates.reduce((sum, [, count]) => sum + count - 1, 0);
const duplicateMw = duplicates.reduce((sum, [key, count]) =>
  sum + (Number(JSON.parse(key)[2]) || 0) * (count - 1), 0);
const unresolved = rows.filter(row => !row.ref).length;
console.log(`KNOWN PIPELINENEWS DATA DEFECT — ${duplicates.length} duplicated identities, `
  + `${extraRows} extra rows, ${duplicateMw.toFixed(2)} MW double-counted, `
  + `${unresolved} unresolved rows. This gate does not relabel those as an Atlas failure.`);
check('the separately owned Pipeline News defect is still measured honestly',
  duplicates.length === 3 && extraRows === 3 && duplicateMw.toFixed(2) === '47.30'
  && unresolved === 13,
  `${duplicates.length} duplicate identities, ${extraRows} extra rows, `
  + `${duplicateMw.toFixed(2)} MW, ${unresolved} unresolved`);

const pnHead = spawnSync('git', ['-C', PN, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
check('the Pipeline News checkout is the audited commit',
  pnHead.status === 0 && pnHead.stdout.trim() === EXPECTED_PN_COMMIT,
  pnHead.status === 0 ? pnHead.stdout.trim() : 'not a git checkout');

const substation = cartridges.find(entry => entry.id === 'substation-intelligence');
const partsPath = substation?.assembled_from
  ? path.join(ROOT, 'atlas', substation.assembled_from.replace(/^\.\//, ''))
  : null;
let pinSource = '';
if (partsPath && fs.existsSync(partsPath)) {
  const parts = JSON.parse(fs.readFileSync(partsPath, 'utf8'));
  const pinPart = (parts.assembled_from || [])
    .find(entry => entry.role === 'module' && /pinned-products\.js$/.test(entry.path));
  if (pinPart && fs.existsSync(path.join(ROOT, pinPart.path))) {
    pinSource = fs.readFileSync(path.join(ROOT, pinPart.path), 'utf8');
  }
}
check('the composed substation cartridge declares its grid-product pin module', Boolean(pinSource));
check('the audited data-grid-gb commit remains pinned', pinSource.includes(EXPECTED_GRID_REF));
check('the connection-points digest remains pinned', pinSource.includes(EXPECTED_CONNECTION_POINTS_SHA));
check('the transmission-network digest remains pinned', pinSource.includes(EXPECTED_TRANSMISSION_SHA));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('Pipeline News wider-fleet arrivals are accepted without moving the verified grid-data pin.');
