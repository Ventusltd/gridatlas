/**
 * Cut GridAtlas v9.89 from the exact v9.88 composition.
 *
 * Scope: keep the pinned grid products byte-for-byte unchanged and replace
 * only the legacy v8 engine's four-technology Pipeline News arrival gate with
 * the vocabulary emitted by immutable Pipeline News release 202609030009.
 * The immutable shell release is never edited; its engine is copied to a new
 * generation-stamped source part, patched once, and reassembled.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CURRENT_PATH = path.join(ROOT, 'atlas', 'current.json');
const EXPECTED_PARENT_SHA = '8fb95a2138010851039a1d648e730f1e10889576';
const EXPECTED_PARENT_GENERATION = '202609030234';
const EXPECTED_PARENT_VERSION = 'v9.88';
const TARGET_VERSION = 'v9.89';
const PIPELINENEWS_COMMIT = '1a9868e76f970f20590a4110acc337e92d360f94';
const PIPELINENEWS_RELEASE = '202609030009-pipelinenews';
const GRID_PIN = Object.freeze({
  ref: '1c9909d1138704b29235c27fd769436dda8a0b18',
  connectionPointsSha256: '11e28859a6d17cc8ee4047c2032d55d043be98f7123743f3b2b03225e07a4c0c',
  connectionPointsBytes: 2896561,
  connectionPointsRows: 886,
  connectionPointsLocated: 502,
  transmissionSha256: 'fc331cc20b061f85adf18d890762a164328a1c5e84acef6a23d35d36f849fc8a',
  transmissionBytes: 10069966,
  circuits: 1392
});
const WIDER_FLEET = Object.freeze([
  'act', 'biomass', 'caes', 'flywheel', 'geothermal',
  'hydro', 'hydrogen', 'other', 'tidal'
]);
const SPINE = Object.freeze(['bess', 'solar', 'wind_offshore', 'wind_onshore']);
const ACCEPTED = Object.freeze([...new Set([...SPINE, ...WIDER_FLEET])].sort());

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf8');
const sha256 = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const die = (message) => { console.error(`v9.89 cut refused: ${message}`); process.exit(1); };
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) die(`${path.basename(command)} ${args.join(' ')} exited ${result.status}`);
};
const utcNow = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

const current = readJson(CURRENT_PATH);
if (current.composition_version === TARGET_VERSION) {
  const entry = (current.cartridges || []).find(row => row.id === 'substation-intelligence');
  if (!entry || !fs.existsSync(path.join(ROOT, 'atlas', entry.path.replace(/^\.\//, '')))) {
    die('current.json says v9.89 but its substation cartridge is absent');
  }
  console.log(`v9.89 already cut at generation ${current.generation}; verification only`);
  process.exit(0);
}
if (current.generation !== EXPECTED_PARENT_GENERATION || current.composition_version !== EXPECTED_PARENT_VERSION) {
  die(`expected ${EXPECTED_PARENT_GENERATION} ${EXPECTED_PARENT_VERSION}, found ${current.generation} ${current.composition_version}`);
}

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
if (head.status !== 0) die('cannot read git HEAD');
const headSha = head.stdout.trim();
if (headSha !== EXPECTED_PARENT_SHA && !process.env.GRIDATLAS_ALLOW_PREP_COMMIT) {
  const parent = spawnSync('git', ['rev-parse', 'HEAD^'], { cwd: ROOT, encoding: 'utf8' });
  if (parent.status !== 0 || parent.stdout.trim() !== EXPECTED_PARENT_SHA) {
    die(`branch is not based directly on audited parent ${EXPECTED_PARENT_SHA}; HEAD is ${headSha}`);
  }
}

const pinsPath = path.join(ROOT, 'atlas', 'modules', '202609030137-pinned-products.js');
const pinsSource = fs.readFileSync(pinsPath, 'utf8');
for (const value of [GRID_PIN.ref, GRID_PIN.connectionPointsSha256,
  String(GRID_PIN.connectionPointsBytes), GRID_PIN.transmissionSha256,
  String(GRID_PIN.transmissionBytes)]) {
  if (!pinsSource.includes(value)) die(`the audited grid pin changed before the cut: missing ${value}`);
}

const substation = (current.cartridges || []).find(row => row.id === 'substation-intelligence');
if (!substation) die('substation-intelligence is absent');
if (substation.generation !== EXPECTED_PARENT_GENERATION) {
  die(`substation-intelligence is ${substation.generation}, not audited ${EXPECTED_PARENT_GENERATION}`);
}
const partsRel = substation.assembled_from?.replace(/^\.\//, 'atlas/');
if (!partsRel) die('substation-intelligence has no assembled_from pointer');
const partsPath = path.join(ROOT, partsRel);
const parts = readJson(partsPath);
const carry = (parts.assembled_from || []).find(entry => entry.role === 'carried_shell_script');
if (!carry) die('substation parts have no carried shell script');
if (carry.path !== 'atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js') {
  die(`unexpected engine source ${carry.path}`);
}
const oldEnginePath = path.join(ROOT, carry.path);
const oldEngine = fs.readFileSync(oldEnginePath, 'utf8').replace(/\r\n/g, '\n');
if (sha256(oldEngine) !== carry.sha256) die('immutable v8 engine does not match its parts-manifest digest');

const oldGate = `            const allowedTechnologies = new Set(['solar', 'bess', 'wind_onshore', 'wind_offshore']);\n            if (!allowedTechnologies.has(requestedTechnology)) throw new Error('canonical project technology is invalid');`;
const allowedLiteral = ACCEPTED.map(value => `'${value}'`).join(', ');
const newGate = `            /* Pipeline News release ${PIPELINENEWS_RELEASE} emits the four spine\n               technologies plus nine wider-fleet layer ids. The old four-value\n               set rejected all 1,104 wider-fleet MAP links by construction.\n               Keep the receiver explicit and bounded; the published manifest\n               still decides whether a partition actually exists. */\n            const allowedTechnologies = new Set([${allowedLiteral}]);\n            if (!allowedTechnologies.has(requestedTechnology)) throw new Error('canonical project technology is invalid');`;
const occurrences = oldEngine.split(oldGate).length - 1;
if (occurrences !== 1) die(`expected one legacy technology gate, found ${occurrences}`);
const generation = utcNow();
if (generation <= current.generation) die(`clock generation ${generation} is not after ${current.generation}`);
const engineRel = `atlas/parts/${generation}-pipelinenews-arrival-engine.js`;
const enginePath = path.join(ROOT, engineRel);
if (fs.existsSync(enginePath)) die(`${engineRel} already exists`);
const newEngine = oldEngine.replace(oldGate, newGate);
fs.writeFileSync(enginePath, newEngine, 'utf8');

const seedRel = `.gridatlas-${generation}-v9-89-seed.json`;
const seedPath = path.join(ROOT, seedRel);
const seed = structuredClone(parts);
const seedCarry = seed.assembled_from.find(entry => entry.role === 'carried_shell_script');
seedCarry.path = engineRel;
delete seedCarry.bytes;
delete seedCarry.sha256;
writeJson(seedPath, seed);

const holdPath = `${partsPath}.v9-89-hold`;
if (fs.existsSync(holdPath)) die(`stale hold file ${path.relative(ROOT, holdPath)}`);
fs.renameSync(partsPath, holdPath);
let recomposed = false;
try {
  run(process.execPath, [
    path.join(ROOT, 'tools', 'recompose.mjs'),
    '--generation', generation,
    '--version', TARGET_VERSION,
    '--restamp', 'substation-intelligence',
    '--parts-from', `substation-intelligence=${seedRel}`,
    '--scope', 'GridAtlas v9.89 accepts Pipeline News wider-fleet technology arrivals while retaining the verified grid-data pin',
    '--proof', `tools/proofs/${generation}-substation-intelligence.proof.mjs`,
    '--note', `Pipeline News ${PIPELINENEWS_RELEASE} at ${PIPELINENEWS_COMMIT}: all 1,104 wider-fleet MAP links previously failed the legacy four-value technology gate. v9.89 accepts the nine emitted wider-fleet values plus the four spine values. Grid products remain pinned to data-grid-gb ${GRID_PIN.ref}; no data pin moves in this cut.`
  ]);
  recomposed = true;
} finally {
  if (fs.existsSync(holdPath)) fs.renameSync(holdPath, partsPath);
  fs.rmSync(seedPath, { force: true });
}
if (!recomposed) die('recompose did not complete');

const newCurrent = readJson(CURRENT_PATH);
if (newCurrent.generation !== generation || newCurrent.composition_version !== TARGET_VERSION) {
  die('recompose did not produce the requested identity');
}
const newSubstation = newCurrent.cartridges.find(row => row.id === 'substation-intelligence');
const newCompositionPath = path.join(ROOT, 'atlas', 'manifests', `${generation}-composition.json`);
const composition = readJson(newCompositionPath);
const compositionSubstation = composition.cartridges.find(row => row.id === 'substation-intelligence');

function recordArrivalContract(entry) {
  if (!entry) die('substation-intelligence metadata is absent from the new composition');
  entry.capabilities = (entry.capabilities || [])
    .filter(value => value !== 'v8-engine-carried-forward-verbatim');
  for (const capability of [
    'v8-engine-carried-forward-with-bounded-pipelinenews-arrival-contract',
    'pipelinenews-wider-fleet-technologies-accepted',
    'grid-product-pin-unchanged-and-reverified'
  ]) {
    if (!entry.capabilities.includes(capability)) entry.capabilities.push(capability);
  }
  entry.immutable_shell_modified = false;
  entry.pipelinenews_arrival_contract = {
    repository: 'Ventusltd/pipelinenews',
    commit: PIPELINENEWS_COMMIT,
    release: PIPELINENEWS_RELEASE,
    wider_fleet_rows: 1104,
    accepted_spine_technologies: SPINE,
    accepted_wider_fleet_technologies: WIDER_FLEET,
    gate: 'explicit technology vocabulary followed by canonical manifest partition lookup',
    known_upstream_data_defects_not_hidden: 'three duplicated wider-fleet identities, 47.30 MW double-counted, and 13 unresolved rows remain Pipeline News work'
  };
  entry.grid_data_verification = {
    repository: 'Ventusltd/data-grid-gb',
    commit: GRID_PIN.ref,
    connection_points: GRID_PIN.connectionPointsRows,
    located_connection_points: GRID_PIN.connectionPointsLocated,
    circuits: GRID_PIN.circuits,
    connection_points_sha256: GRID_PIN.connectionPointsSha256,
    transmission_network_sha256: GRID_PIN.transmissionSha256,
    pin_moved: false
  };
  entry.supersedes_shell_script = {
    ...(entry.supersedes_shell_script || {}),
    name: 'ventus-corev8engine.js',
    sha256: carry.sha256,
    successor_source: engineRel,
    successor_sha256: sha256(newEngine),
    behaviour: 'v8 engine carried forward with one bounded change: accept the Pipeline News wider-fleet technology vocabulary before canonical manifest partition lookup; map, layer and grid logic otherwise carried forward'
  };
}
recordArrivalContract(newSubstation);
recordArrivalContract(compositionSubstation);
writeJson(CURRENT_PATH, newCurrent);
writeJson(newCompositionPath, composition);

const proofPath = path.join(ROOT, 'tools', 'proofs', `${generation}-substation-intelligence.proof.mjs`);
let proof = fs.readFileSync(proofPath, 'utf8');
proof = proof.replace(
  /Proof for the substation intelligence cartridge, generation \d{12}\./,
  `Proof for the substation intelligence cartridge, generation ${generation}.`);
const oldEngineProof = `const source = await readFile(CARTRIDGE, 'utf8');\nconst engine = (await readFile(join(RELEASE, 'ventus-corev8engine.js'), 'utf8'))\n  .replace(/\\r\\n/g, '\\n');\n\nconsole.log('\\nthe engine, carried forward\\n');\ncheck('the engine is present byte for byte', source.includes(engine));\ncheck('it is carried whole, not excerpted', engine.length > 80000);\ncheck('the intelligence runs after it, not inside it',\n  source.indexOf(engine) < source.indexOf('PART 2 - the network'));`;
const newEngineProof = `const source = await readFile(CARTRIDGE, 'utf8');\nconst composedParts = JSON.parse(await readFile(join(REPO, 'atlas',\n  CARTRIDGE_ENTRY.assembled_from.replace(/^\\.\\//, '')), 'utf8'));\nconst engineEntry = (composedParts.assembled_from || [])\n  .find(entry => entry.role === 'carried_shell_script');\nconst engine = engineEntry\n  ? (await readFile(join(REPO, engineEntry.path), 'utf8')).replace(/\\r\\n/g, '\\n')\n  : '';\n\nconsole.log('\\nthe engine successor, declared by the parts manifest\\n');\ncheck('the declared engine successor is present byte for byte',\n  Boolean(engineEntry) && source.includes(engine));\ncheck('it is carried whole, not excerpted', engine.length > 80000);\ncheck('the intelligence runs after it, not inside it',\n  source.indexOf(engine) < source.indexOf('PART 2 - the network'));`;
if (!proof.includes(oldEngineProof)) die('could not locate the old engine identity proof');
proof = proof.replace(oldEngineProof, newEngineProof);

const finalReport = `console.log(\`\\n\${passed}/\${passed + failures.length} checks passed\`);`;
const arrivalProof = `console.log('\\nPipeline News arrival vocabulary and the unchanged grid pin\\n');\n\nconst allowedMatch = engine.match(\n  /allowedTechnologies\\s*=\\s*new\\s+Set\\(\\s*\\[([^\\]]*)\\]\\s*\\)/);\nconst acceptedTechnology = new Set(allowedMatch\n  ? [...allowedMatch[1].matchAll(/["']([\\w_]+)["']/g)].map(match => match[1])\n  : []);\nconst expectedSpine = ${JSON.stringify(SPINE)};\nconst expectedWiderFleet = ${JSON.stringify(WIDER_FLEET)};\ncheck('the composed engine declares its bounded arrival vocabulary', Boolean(allowedMatch));\ncheck('the four Pipeline News spine technologies remain accepted',\n  expectedSpine.every(value => acceptedTechnology.has(value)));\ncheck('all nine wider-fleet technology values are accepted',\n  expectedWiderFleet.every(value => acceptedTechnology.has(value)));\ncheck('the obsolete four-value-only gate is gone',\n  acceptedTechnology.size >= expectedSpine.length + expectedWiderFleet.length);\nconst connectionPointPin = pins.pin('connection-points.v3');\nconst transmissionPin = pins.pin('gb-transmission-network.v1');\ncheck('the connection-points pin did not move in this arrival-only cut',\n  connectionPointPin?.ref === '${GRID_PIN.ref}'\n  && connectionPointPin?.sha256 === '${GRID_PIN.connectionPointsSha256}'\n  && connectionPointPin?.bytes === ${GRID_PIN.connectionPointsBytes});\ncheck('the transmission-network pin did not move in this arrival-only cut',\n  transmissionPin?.ref === '${GRID_PIN.ref}'\n  && transmissionPin?.sha256 === '${GRID_PIN.transmissionSha256}'\n  && transmissionPin?.bytes === ${GRID_PIN.transmissionBytes});\n\n${finalReport}`;
if (!proof.includes(finalReport)) die('could not locate the proof final report');
proof = proof.replace(finalReport, arrivalProof);
fs.writeFileSync(proofPath, proof, 'utf8');

run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);
run(process.execPath, [path.join(ROOT, 'tools', 'proofs', 'run-current.mjs')]);
run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'loop.mjs'), 'lint']);
run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'loop.mjs'), 'state']);
run(process.execPath, [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')]);

const finalCurrent = readJson(CURRENT_PATH);
const finalPinModule = fs.readFileSync(pinsPath, 'utf8');
if (finalCurrent.generation !== generation || finalCurrent.composition_version !== TARGET_VERSION) {
  die('final identity drifted after verification');
}
if (!finalPinModule.includes(GRID_PIN.ref)
    || !finalPinModule.includes(GRID_PIN.connectionPointsSha256)
    || !finalPinModule.includes(GRID_PIN.transmissionSha256)) {
  die('grid pin drifted after verification');
}

const oneShotWorkflow = path.join(ROOT, '.github', 'workflows',
  '202609030251-build-grid-data-v9-89.yml');
fs.rmSync(oneShotWorkflow, { force: true });

console.log(JSON.stringify({
  status: 'CUT_AND_VERIFIED',
  parent_commit: EXPECTED_PARENT_SHA,
  generation,
  version: TARGET_VERSION,
  grid_data: {
    commit: GRID_PIN.ref,
    connection_points: GRID_PIN.connectionPointsRows,
    located: GRID_PIN.connectionPointsLocated,
    circuits: GRID_PIN.circuits,
    pin_moved: false
  },
  pipelinenews: {
    commit: PIPELINENEWS_COMMIT,
    release: PIPELINENEWS_RELEASE,
    wider_fleet_rows: 1104,
    accepted_technologies: ACCEPTED
  }
}, null, 2));
