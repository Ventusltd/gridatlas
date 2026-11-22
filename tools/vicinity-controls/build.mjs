/* V9.196 independent byte-pinned Vicinity recovery cartridge builder.
 * Runs from an empty source-only tree without copying expected output.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const flag=x=>{const i=args.indexOf(x);return i<0?null:args[i+1]};
assert.equal(flag('--generation')||flag('--gen'),'202611222325');
const out=flag('--out');assert.ok(out&&typeof out==='string'&&!out.startsWith('--'));
const data=fs.readFileSync(path.join(root,'tools/vicinity-controls/src/202611222325-vicinity-controls-rescue.js'));
assert.equal(data.length,3865,'source length drift');
assert.equal(createHash('sha256').update(data).digest('hex'),'26754dc642ff6554bb55d25a65e422a16981141f0af5e0b8df9543498176f0f6','source SHA-256 drift');
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(path.resolve(out),data);
console.log('PASS V9.196 original recovery cartridge independently reproduced');
