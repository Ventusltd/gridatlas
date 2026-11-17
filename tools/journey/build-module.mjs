/** Assemble the reusable Journey cartridge only; never writes compositions or pointers. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assembleModule} from './module.mjs';
const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);return i<0?undefined:args[i+1];}
const generation=option('--generation'),out=option('--out');
if(!generation||!out||args.length!==4)throw new Error('Usage: node tools/journey/build-module.mjs --generation YYYYMMDDHHMM --out FILE');
const {body}=assembleModule({generation});
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(out,body);
console.log(JSON.stringify({generation,path:out,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')}));
