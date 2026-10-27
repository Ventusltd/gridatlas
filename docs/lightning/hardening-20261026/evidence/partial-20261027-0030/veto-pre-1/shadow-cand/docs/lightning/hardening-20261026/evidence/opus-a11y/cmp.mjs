import fs from 'node:fs';
const [a,b]=process.argv.slice(2).map(f=>JSON.parse(fs.readFileSync(f)));
const A=a.seq.filter(x=>!x.wrapped), B=b.seq.filter(x=>!x.wrapped);
const Bo=B.filter(x=>!x.lightning);
console.log('baseline',A.length,'candidate',B.length,'candidate non-lightning',Bo.length);
let same=A.length===Bo.length; for(let i=0;i<Math.max(A.length,Bo.length);i++){if(A[i]?.key!==Bo[i]?.key){same=false;console.log('DIFF',i,A[i]?.key,'|',Bo[i]?.key)}}
console.log('identical original order:',same);
B.forEach((x,i)=>{if(x.lightning)console.log('lightning at candidate pos',i,x.key,x.attrs,'prev:',B[i-1]?.key,'next:',B[i+1]?.key, 'inVp',x.inViewport, x.outline, 'fv',x.focusVisible)});
console.log('wrap a',a.seq.at(-1),'wrap b',b.seq.at(-1));
console.log('rev equal?', JSON.stringify(a.reverse40)===JSON.stringify(b.reverse40.filter(k=>true)));
