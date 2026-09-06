import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../atlas/modules/202609060413-map-pdf.js',import.meta.url),'utf8'),context);
const {buildMapPdf,wrapPdfText}=context.window.__GRIDATLAS_MODULES__.mapPdf;
test('PDF preserves native dimensions, original JPEG bytes and exact xref offsets',()=>{
  const jpeg='\xff\xd8\x00\x80binary\xff\xd9';
  for(const [w,h] of [[383,838],[1149,2514],[1390,518]]){
    const result=buildMapPdf(jpeg,w,h,'Map (test)','Data © Example contributors','generation 202609060413 - UTC');
    const text=Buffer.from(result.bytes).toString('latin1');
    assert(text.includes(`/MediaBox [0 0 ${w} ${h}]`));
    assert(text.includes(`stream\n${jpeg}\nendstream`));
    const offset=Number(text.match(/startxref\n(\d+)/)[1]);
    assert.equal(text.slice(offset,offset+4),'xref');
    const rows=text.slice(offset).split('\n').slice(3,10);
    rows.forEach((row,i)=>assert(text.slice(Number(row.slice(0,10))).startsWith(`${i+1} 0 obj`)));
    assert(text.includes('Map \\(test\\)'));
    const baselines=[...text.matchAll(/0\.86 0\.93 0\.94 rg \d+ (\d+) Td/g)].map(m=>Number(m[1]));
    assert(baselines.length>=2);assert.equal(new Set(baselines).size,baselines.length);
  }
});
test('Footer wrapping retains every ASCII word and bounds long tokens',()=>{
  const source='Data © OpenStreetMap contributors | © CARTO | generation 202609060413';
  const lines=wrapPdfText(source,24);
  assert(lines.every(line=>line.length<=24));
  assert.equal(lines.join(' '),source.replaceAll('©','(c)'));
  assert(wrapPdfText('x'.repeat(100),24).every(line=>line.length<=24));
});
test('Undrawable dimensions are rejected',()=>{
  for(const n of [0,-1,NaN,Infinity,0.5])assert.throws(()=>buildMapPdf('',n,100,'','',''));
});
