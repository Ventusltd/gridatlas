/**
 * Run the proof belonging to the cartridge that is actually composed.
 *
 * The proofs are timestamped and so is the cartridge, so a workflow that names
 * either one goes stale the next time a generation is cut -- and a stale proof
 * step is worse than none, because it passes while testing a file nobody
 * serves. This resolves the generation from atlas/current.json, which is the
 * thing the loader reads, and runs the proof that matches it.
 *
 * A cartridge with no proof is a failure, not a skip. Every cartridge in this
 * repository has carried one, and the moment that stops being enforced is the
 * moment one ships without.
 *
 *   node tools/proofs/run-current.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const current = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));

const failures = [];
let ran = 0;

for (const id of current.cartridge_order || []) {
  const cartridge = (current.cartridges || []).find(entry => entry.id === id);
  if (!cartridge) {
    failures.push(`${id}: named in cartridge_order but absent from cartridges`);
    continue;
  }
  const proof = path.join(ROOT, 'tools', 'proofs',
    `${cartridge.generation}-${id}.proof.mjs`);
  if (!fs.existsSync(proof)) {
    failures.push(`${id} ${cartridge.generation}: no proof at ${path.relative(ROOT, proof)}`);
    continue;
  }
  console.log(`\n=== ${id} ${cartridge.generation} ===`);
  try {
    await import(pathToFileURL(proof).href);
    ran += 1;
  } catch (error) {
    failures.push(`${id}: ${error?.message || error}`);
  }
  if (process.exitCode) {
    failures.push(`${id}: proof reported failures`);
    process.exitCode = 0;
  }
}

console.log(`\nproofs run: ${ran}`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exitCode = 1;
} else if (ran === 0) {
  console.error('  FAIL no proof ran for any composed cartridge');
  process.exitCode = 1;
} else {
  console.log('every composed cartridge passed its generation-matched proof');
}
