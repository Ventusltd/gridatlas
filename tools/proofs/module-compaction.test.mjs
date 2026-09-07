import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compact,proveEquivalent} from '../compact-modules.mjs';

test('Preserve token text, multiline strings, regular expressions and automatic semicolons',()=>{
  const source='/* notes */\nfunction f(){return\n{value: 4};}\nconst css=`/* literal */\n a { width: 2px; }`;\nconst r=/a\\/b/;\nresult=[f(),css,r.source,1 + +2];';
  const output=compact(source);
  assert(output.includes('/* literal */'));
  const a={},b={};vm.runInNewContext(source,a);vm.runInNewContext(output,b);
  assert.equal(JSON.stringify(a.result),JSON.stringify(b.result));
  assert(output.length<source.length);
});
test('Retain licensing comments and reject an executable change',()=>{
  const source='/*! @license MIT Copyright Example */\nvar value = 17;';
  const output=compact(source);
  assert(output.includes('@license MIT Copyright Example'));
  assert.throws(()=>proveEquivalent(source,output.replace('17','18')),/token text changed/);
  assert.throws(()=>proveEquivalent('function f(){return\n1}', 'function f(){return 1}'),/Syntax tree changed/);
});
