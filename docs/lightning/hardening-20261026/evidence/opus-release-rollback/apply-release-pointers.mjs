// opus-release-rollback | harness: self | REHEARSAL ONLY - run with cwd = a PRIVATE worktree. Never in a shared clone.
// Usage: node apply-release-pointers.mjs <GEN>
// Same edits the owner-authorised release commit makes (plan §2, steps R2-R4); writes JSON as JSON.stringify(v,null,1)+"\n".
import fs from 'node:fs';
const GEN = process.argv[2];
if (!/^\d{12}$/.test(GEN)) throw new Error('GEN must be 12 digits');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`);
// R2: atlas/current.json = committed composition manifest minus manifest-only keys
const m = read(`atlas/manifests/${GEN}-composition.json`);
for (const k of ['parent_generation', 'version', 'cut_at_utc', 'note', 'acceptance', 'candidate_status', 'restored_from', 'restored_over', 'restored_generations_back']) delete m[k];
if (m.generation !== GEN || m.composition_manifest !== `./manifests/${GEN}-composition.json`) throw new Error('manifest identity does not name GEN');
write('atlas/current.json', m);
// R3: the two root pointers, identical edits (loop.mjs:152-154 requires them JSON-identical)
for (const f of ['state/live-set.json', 'releases/current-v5.json']) {
  const p = read(f);
  p.current.atlas_composition.generation = GEN;
  p.current.atlas_composition.manifest = `atlas/manifests/${GEN}-composition.json`;
  p.current.atlas_composition.cartridge_order = m.cartridge_order;
  write(f, p);
}
// R4: atlas/state/live-set.json, as recompose.mjs:443-450 and rollback.mjs:241-248 write it
const a = read('atlas/state/live-set.json');
a.generation = GEN; a.composition_manifest = m.composition_manifest; a.cartridge_order = m.cartridge_order;
write('atlas/state/live-set.json', a);
console.log(`pointers set to ${GEN}`);
