/* V9.195 immutable vicinity-focus cartridge source build.
 * Copy the exact source register in an empty tree; refuse other generations,
 * corrupted source or a missing output path. No live files are edited.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const flag=(x)=>{const i=args.indexOf(x);return i<0?null:args[i+1]};
const generation=flag('--generation')||flag('--gen');
const out=flag('--out');
assert.equal(generation,'202611222130','only the pinned V9.195 source may be built');
assert.ok(out&&typeof out==='string'&&!out.startsWith('--'),'an explicit output path is required');
const src=path.join(root,'tools/vicinity-focus/src/202611222130-vicinity-focus.js');
const data=fs.readFileSync(src);
assert.equal(data.length,10350,'source length drift');
assert.equal(createHash('sha256').update(data).digest('hex'),'8ea2546b2a1fab3007d3b7a81aa509baae323051b888afd252edb6bc4726f14e','source SHA-256 drift');
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(path.resolve(out),data);
console.log('PASS vicinity-focus source built byte for byte at '+path.resolve(out));
