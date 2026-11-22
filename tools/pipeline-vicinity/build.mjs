#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const G='202611222000',expected='0c4c7d39433e2ab084bccc159bf5fad963f4014d391a1daa18882896a87ef05d';
const args=process.argv.slice(2);let gen,out;
for(let i=0;i<args.length;i++){
 if(args[i]==='--generation')gen=args[++i];
 else if(args[i]==='--out')out=args[++i];
 else throw Error('unknown flag '+args[i]);
}
if(gen!==G||!out)throw Error('expected --generation '+G+' --out FILE');
const src=path.join(path.dirname(fileURLToPath(import.meta.url)),'src',G+'-entry.js');
const bytes=fs.readFileSync(src),hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==expected)throw Error('source SHA mismatch: '+hash);
fs.writeFileSync(out,bytes);
console.log('PASS source-built native VICINITY '+bytes.length+' B '+hash);
