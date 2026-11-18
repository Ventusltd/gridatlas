/** Successor-only recipe for the inherited Pipeline News map lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function applyEdits(source, edits) {
  assert.ok(Array.isArray(edits) && edits.length);
  for (const [i, edit] of edits.entries()) {
    assert.equal(typeof edit.before, 'string');
    assert.ok(edit.before.length);
    assert.equal(typeof edit.after, 'string');
    const at = source.indexOf(edit.before);
    assert.ok(at >= 0, `Pipeline lifecycle edit ${i} missing`);
    assert.equal(source.indexOf(edit.before, at + 1), -1, `Pipeline lifecycle edit ${i} ambiguous`);
    source = source.slice(0, at) + edit.after + source.slice(at + edit.before.length);
  }
  return source;
}

export function buildSubstation(generation, root = ROOT) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline-lifecycle/generations.json')));
  const entry = registry.generations[generation];
  assert.ok(entry, `No Pipeline lifecycle source recipe for ${generation}`);
  const base = fs.readFileSync(path.join(root, entry.base.path));
  assert.equal(base.length, entry.base.bytes, 'Pipeline lifecycle base length drift');
  assert.equal(digest(base), entry.base.sha256, 'Pipeline lifecycle base digest drift');
  const edits = JSON.parse(fs.readFileSync(path.join(root, entry.edits)));
  const built = Buffer.from(applyEdits(base.toString('utf8'), edits));
  assert.equal(built.length, entry.output_bytes, 'Pipeline lifecycle output length drift');
  assert.equal(digest(built), entry.output_sha256, 'Pipeline lifecycle output digest drift');
  return built;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => process.argv[process.argv.indexOf(name) + 1];
  assert.ok(process.argv.includes('--gen') && process.argv.includes('--out'), 'Use --gen G --out NEW_FILE');
  const built = buildSubstation(arg('--gen'));
  fs.writeFileSync(arg('--out'), built, { flag: 'wx' });
  console.log(`Pipeline lifecycle rebuild: ${built.length} bytes sha256 ${digest(built)}`);
}
