/** Build-time token compaction. Executable token text and complete syntax trees must agree. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parserSource=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
assert.equal(typeof parserSource,'string','This build requires Node with its bundled Acorn parser; no regex fallback is allowed');
const parserModule={exports:{}};
new Function('exports','module',parserSource)(parserModule.exports,parserModule);
const acorn=parserModule.exports;
const hash=s=>createHash('sha256').update(s).digest('hex');
export const PARSER=Object.freeze({name:'Acorn bundled in Node',version:acorn.version,node:process.version,sha256:hash(parserSource)});
const syntax=source=>acorn.parse(source,{ecmaVersion:'latest'});
const canonical=ast=>JSON.stringify(ast,(key,value)=>['start','end','loc','range'].includes(key)?undefined:value);
function tokens(source) {
  const list=[];acorn.parse(source,{ecmaVersion:'latest',onToken:list});
  return list.map(token=>source.slice(token.start,token.end));
}
export function proveEquivalent(before,after) {
  assert.deepEqual(tokens(after),tokens(before),'Executable token text changed');
  assert.equal(canonical(syntax(after)),canonical(syntax(before)),'Syntax tree changed (including automatic semicolon insertion)');
}
export function compact(source) {
  const list=[],comments=[];
  acorn.parse(source,{ecmaVersion:'latest',onToken:list,onComment:comments});
  let result='',cursor=0;
  for(const token of list) {
    const gap=source.slice(cursor,token.start);
    result+=(/[\r\n]/.test(gap)?'\n':gap?' ':'')+source.slice(token.start,token.end);
    cursor=token.end;
  }
  // Retain licensing/preservation comments, never treating text inside literals as comments.
  const notices=comments.filter(c=>/@license|@preserve|copyright|SPDX-License-Identifier|permission is hereby granted/i.test(c.value));
  if(notices.length)result=notices.map(c=>source.slice(c.start,c.end)).join('\n')+'\n'+result;
  proveEquivalent(source,result);
  return result;
}
const INPUTS=[
  'atlas/modules/202609031958-menu-bar.js',
  'atlas/modules/202609020015-injection-response.js',
  'atlas/modules/202609012245-network-topology.js',
  'atlas/modules/202609030048-pipeline-news-layers.js',
  'atlas/modules/202609012350-owner-boundary.js',
];
export function build() {
  const generation=new Date().toISOString().replace(/[-:T]/g,'').slice(0,12);
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const manifestPath=`atlas/manifests/${generation}-module-compaction.json`;
  assert(!fs.existsSync(path.join(ROOT,manifestPath)),'Existing generation is immutable');
  const outputs=INPUTS.map(input=>{
    const source=execFileSync('git',['show',`${sourceCommit}:${input}`],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/g,'\n');
    const output=input.replace(/\/\d{12}-/,`/${generation}-`);
    assert(!fs.existsSync(path.join(ROOT,output)),`Refusing to overwrite ${output}`);
    const code=`/* Compact successor of ${input}; original source retained, tokens and AST verified. */\n`+compact(source);
    proveEquivalent(source,code);
    return {input,output,sourceSha256:hash(source),sha256:hash(code),sourceCharacters:source.length,characters:code.length,code};
  });
  const manifest={schema:'gridatlas.module-compaction.v1',generation,sourceCommit,parser:PARSER,rule:'Only inter-token whitespace and non-license comments removed; token text and full AST equal. Original modules and all CSS/string/regex literals retained.',modules:outputs.map(({code,...record})=>record)};
  for(const item of outputs)fs.writeFileSync(path.join(ROOT,item.output),item.code);
  fs.writeFileSync(path.join(ROOT,manifestPath),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({generation,manifestPath,savedCharacters:outputs.reduce((sum,m)=>sum+m.sourceCharacters-m.characters,0)}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build();
