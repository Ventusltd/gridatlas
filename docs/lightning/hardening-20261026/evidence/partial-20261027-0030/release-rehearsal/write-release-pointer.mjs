// release-rehearsal | harness: self | run with cwd = repository root (private worktree or owner's release branch)
// Usage: node write-release-pointer.mjs <GEN>   — writes atlas/current.json from the COMMITTED manifest (plan §2 R2)
import fs from 'node:fs';
const G = process.argv[2];
if (!/^\d{12}$/.test(G)) throw new Error('GEN must be 12 digits');
const m = JSON.parse(fs.readFileSync(`atlas/manifests/${G}-composition.json`, 'utf8'));
for (const k of ['parent_generation', 'version', 'cut_at_utc', 'note', 'acceptance', 'candidate_status']) delete m[k];
if (m.generation !== G || m.composition_manifest !== `./manifests/${G}-composition.json`) throw new Error('manifest identity does not name GEN');
if (m.previous_generation !== '202609241334') throw new Error(`previous_generation is ${m.previous_generation}, expected 202609241334`);
fs.writeFileSync('atlas/current.json', `${JSON.stringify(m, null, 1)}\n`);
console.log(`atlas/current.json -> ${m.composition_id} (previous ${m.previous_generation})`);
