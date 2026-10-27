/** Exact change boundary: all previously published SLD behaviour is carried forward. Browser regression tests prove layout and hit targets. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const current=JSON.parse(fs.readFileSync(new URL('atlas/current.json',root)));
const entry=current.cartridges.find(x=>x.id==='sld-sandbox');
const source=fs.readFileSync(new URL('atlas/'+entry.path,root),'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
let expected=fs.readFileSync(new URL('atlas/cartridges/202609200022-sld-sandbox-v9-8.js',root),'utf8');
const replacements=[
 ["const map = container.getBoundingClientRect();\n      const popup = document.querySelector", "const bounds = container.getBoundingClientRect();\n      const top = Math.max(bounds.top, document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect().bottom || 0);\n      const map = { left: bounds.left, right: bounds.right, top, bottom: bounds.bottom, width: bounds.width, height: bounds.bottom - top };\n      const popup = document.querySelector"],
 ["if (available < MIN_ANCHORED_CARD) {\n        popup.classList.add", "if (rect.top < map.top + 12 || rect.right > map.right - 12 || rect.left < map.left + 12 || available < MIN_ANCHORED_CARD) {\n        popup.classList.add"],
 ["content.style.maxHeight = Math.max(120, Math.min(available, map.height - 48)) + 'px';", "content.style.setProperty('max-height', Math.max(120, Math.min(available, map.height - 48)) + 'px', 'important');"],
 ["content.style.maxHeight = Math.max(160, map.height - 48) + 'px';", "content.style.setProperty('max-height', Math.max(160, map.height - 48) + 'px', 'important');"],
 ["content.style.maxHeight = available + 'px';", "content.style.setProperty('max-height', Math.min(available, map.height - 48) + 'px', 'important');"]
];
for(const [before,after] of replacements){assert.equal(expected.split(before).length-1,1);expected=expected.replace(before,after);}
expected+='\n'+fs.readFileSync(new URL('atlas/modules/202609241251-popup-viewport.js',root),'utf8');
assert.equal(source,expected,'only the reviewed card-boundary corrections may differ');
new vm.Script(source);
console.log('SLD exact delta, SHA-256 and syntax PASS; browser layout regression runs separately.');
