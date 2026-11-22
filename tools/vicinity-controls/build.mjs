/* V9.196/V9.197 independently reproducible vicinity control cartridges.
 * Only source files, never the expected published target, enter the clean tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const flag=x=>{const i=args.indexOf(x);return i<0?null:args[i+1]};
const G=flag('--generation')||flag('--gen');
const ledger={
 '202611222325':{bytes:3865,sha256:'26754dc642ff6554bb55d25a65e422a16981141f0af5e0b8df9543498176f0f6'},
 '202611222343':{bytes:7367,sha256:'97cb8d05c7c0855b3bdd02ba614f470fbe2d489ed2db7181ca0b7edd5313c8fc'}
};
assert.ok(Object.hasOwn(ledger,G),'unregistered generation');
const out=flag('--out');assert.ok(out&&typeof out==='string'&&!out.startsWith('--'));
const data=fs.readFileSync(path.join(root,'tools/vicinity-controls/src/'+G+'-vicinity-controls-rescue.js'));
assert.equal(data.length,ledger[G].bytes,'source length drift');
assert.equal(createHash('sha256').update(data).digest('hex'),ledger[G].sha256,'source SHA-256 drift');
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(path.resolve(out),data);
console.log('PASS '+G+' original vicinity controls cartridge independently reproduced');
