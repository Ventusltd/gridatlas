/**
 * Keep the SLD composition proof honest when the carried v8 engine has a
 * generation-stamped successor. The proof must subtract the engine declared
 * by the current parts manifest, not assume the immutable release copy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = process.argv.indexOf('--generation');
const generation = at >= 0 ? process.argv[at + 1] : '';
const die = (message) => { console.error(`SLD proof patch refused: ${message}`); process.exit(1); };

if (!/^\d{12}$/.test(generation)) die('--generation YYYYMMDDHHMM is required');
const proofPath = path.join(ROOT, 'tools', 'proofs', `${generation}-sld-sandbox.proof.mjs`);
if (!fs.existsSync(proofPath)) die(`missing ${path.relative(ROOT, proofPath)}`);
let source = fs.readFileSync(proofPath, 'utf8').replace(/\r\n/g, '\n');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) die(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

const oldComment = `   The carried V8 engine declares its own radius at its line 32 and
   is carried VERBATIM by contract - a cartridge in a replace-script
   slot reproduces the shell script it supersedes byte for byte, and
   editing it would break the one guarantee that slot makes. So it
   is subtracted rather than counted: the claim is that the estate
   declares ONE radius in its own code, not that the shell it wraps
   has none. Pretending otherwise would mean either a false pass or
   an unfixable failure. */`;
const newComment = `   The carried V8 engine declares its own radius at its line 32. From
   v9.89 the parts manifest may name a generation-stamped successor
   whose only permitted divergence is separately proven. The proof
   therefore subtracts the exact engine bytes declared by the current
   parts manifest, not a hard-coded historical path. The claim remains
   that the estate declares ONE radius in its own code, in addition to
   the shell radius carried through the engine slot. */`;
replaceOnce('engine-radius rationale', oldComment, newComment);

const oldEngineBlock = `const carriedEngine = await readFile(join(REPO, 'atlas', 'releases',
  '202608300453-atlas-v9', 'ventus-corev8engine.js'), 'utf8');
const composedCode = composedSource
  .split(carriedEngine.split('\\r\\n').join('\\n')).join(' ')`;
const newEngineBlock = `const substationEntry = (CURRENT.cartridges || [])
  .find(entry => entry.id === 'substation-intelligence');
const substationPartsPath = substationEntry?.assembled_from
  ? join(REPO, 'atlas', String(substationEntry.assembled_from).replace(/^\\.\\//, ''))
  : null;
const substationParts = substationPartsPath
  ? JSON.parse(await readFile(substationPartsPath, 'utf8'))
  : null;
const carriedEngineEntry = (substationParts?.assembled_from || [])
  .find(entry => entry.role === 'carried_shell_script');
const carriedEngine = carriedEngineEntry
  ? await readPublished(join(REPO, carriedEngineEntry.path))
  : '';
const composedCode = composedSource
  .split(carriedEngine).join(' ')`;
replaceOnce('manifest-declared engine lookup', oldEngineBlock, newEngineBlock);

const oldRadiusCheck = `check('and the carried engine still has its own, untouched',
  (carriedEngine.match(/=\\s*6378\\.137/g) || []).length === 1);`;
const newRadiusCheck = `check('the parts manifest declares the engine successor whose shell radius is excluded',
  Boolean(carriedEngineEntry) && carriedEngine.length > 80000);
check("and that engine successor still has the shell's one Earth radius",
  (carriedEngine.match(/=\\s*6378\\.137/g) || []).length === 1);`;
replaceOnce('engine radius assertion', oldRadiusCheck, newRadiusCheck);

const oldSlotCheck = `check('it still carries the V8 engine verbatim, which is its slot contract',
    subSource.includes('PART 2 - the network, as its operator publishes it'));`;
const newSlotCheck = `check('it carries the parts-manifest engine successor through the same shell slot',
    Boolean(carriedEngineEntry) && subSource.includes(carriedEngine)
    && subSource.includes('PART 2 - the network, as its operator publishes it'));`;
replaceOnce('engine slot assertion', oldSlotCheck, newSlotCheck);

fs.writeFileSync(proofPath, source, 'utf8');
const checked = spawnSync(process.execPath, ['--check', proofPath], {
  cwd: ROOT, encoding: 'utf8'
});
if (checked.status !== 0) die(checked.stderr || checked.stdout || 'node --check failed');
console.log(JSON.stringify({
  status: 'PATCHED',
  generation,
  proof: path.relative(ROOT, proofPath).replace(/\\/g, '/'),
  engine_source: 'current substation-intelligence parts manifest'
}));
