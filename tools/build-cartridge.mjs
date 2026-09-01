/**
 * Assemble a cartridge from modules, and record what went into it.
 *
 * The composer's contract is one file per shell script slot, so a
 * cartridge must arrive as one file. That does not mean it has to be
 * WRITTEN as one file. This assembles a generation-stamped cartridge from
 * a named list of parts and emits a manifest recording each part's
 * SHA-256, so the thing that ships is one file and the thing that is
 * maintained is a list of small ones.
 *
 * It does not decide anything. It concatenates in the order given, with a
 * header naming the parts, and refuses to run if any part is missing or if
 * the output would collide with a generation that already exists -
 * cartridges are immutable here.
 *
 *   node tools/build-cartridge.mjs \
 *     --generation 202609012000 \
 *     --name substation-intelligence-v9-62 \
 *     --carry atlas/releases/<id>/ventus-corev8engine.js \
 *     --module atlas/modules/202609011950-geodesy.js \
 *     --module atlas/modules/202609011950-substation-lookup.js \
 *     --part atlas/parts/202609012000-substation-intelligence-body.js
 *
 * --carry is a shell script carried forward verbatim for a replace-script
 * slot; it is hashed separately and recorded as such, because carrying a
 * shell file forward unchanged is a promise the manifest has to keep.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

function argv(flag, { many = false } = {}) {
  const values = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag) values.push(process.argv[i + 1]);
  }
  if (many) return values;
  return values[0];
}

const generation = argv('--generation');
const name = argv('--name');
const carry = argv('--carry');
const modules = argv('--module', { many: true });
const parts = argv('--part', { many: true });

if (!generation || !/^\d{12}$/.test(generation)) {
  console.error('--generation YYYYMMDDHHMM is required');
  process.exit(1);
}
if (!name) {
  console.error('--name is required');
  process.exit(1);
}
if (!modules.length && !parts.length && !carry) {
  console.error('nothing to assemble: pass --carry, --module or --part');
  process.exit(1);
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

async function readLf(relativePath) {
  const absolute = join(REPO, relativePath);
  try { await access(absolute, constants.R_OK); }
  catch { console.error(`missing part: ${relativePath}`); process.exit(1); }
  // Every digest in this estate is over LF bytes: the blob is LF and a
  // Windows working copy may not be.
  return (await readFile(absolute, 'utf8')).replace(/\r\n/g, '\n');
}

const pieces = [];
const record = [];

if (carry) {
  const source = await readLf(carry);
  pieces.push(source);
  record.push({ role: 'carried_shell_script', path: carry,
    bytes: Buffer.byteLength(source), sha256: sha256(source) });
}
for (const modulePath of modules) {
  const source = await readLf(modulePath);
  pieces.push(source);
  record.push({ role: 'module', path: modulePath,
    bytes: Buffer.byteLength(source), sha256: sha256(source) });
}
for (const partPath of parts) {
  const source = await readLf(partPath);
  pieces.push(source);
  record.push({ role: 'part', path: partPath,
    bytes: Buffer.byteLength(source), sha256: sha256(source) });
}

const header = `/**
 * ${name}, generation ${generation} (UTC).
 *
 * ASSEMBLED by tools/build-cartridge.mjs from the parts below. Do not edit
 * this file: edit a part and rebuild under a new generation. Each part is
 * hashed in manifests/${generation}-${name}-parts.json.
 *
${record.map(r => ` *   ${r.role.padEnd(22)} ${r.path}`).join('\n')}
 */

`;

const assembled = header + pieces.join('\n');
const outputPath = join(REPO, 'atlas', 'cartridges', `${generation}-${name}.js`);
try {
  await access(outputPath, constants.F_OK);
  console.error(`refusing to overwrite an existing generation: ${generation}-${name}.js`);
  process.exit(1);
} catch { /* absent, which is what we want */ }

await writeFile(outputPath, assembled, 'utf8');

const manifest = {
  schema: 'gridatlas.cartridge-parts.v1',
  generation,
  cartridge: `./cartridges/${generation}-${name}.js`,
  sha256: sha256(assembled),
  bytes: Buffer.byteLength(assembled),
  assembled_from: record,
  rule: 'edit a part and rebuild under a new generation; this file is not edited by hand'
};
await mkdir(join(REPO, 'atlas', 'manifests'), { recursive: true });
await writeFile(join(REPO, 'atlas', 'manifests', `${generation}-${name}-parts.json`),
  `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'ASSEMBLED',
  cartridge: relative(REPO, outputPath).replace(/\\/g, '/'),
  bytes: manifest.bytes,
  sha256: manifest.sha256.slice(0, 16),
  parts: record.length
}, null, 2));
