// node-probes.mjs — SYNTHETIC unit probes of expressions copied verbatim from 202610262323 module lines 11,20,36,42-44,58,70
const out={};
for (const n of [1e4,1e5,1.2e5,2e5,5e5,1e6]) { try { Math.max(...new Array(n).fill(1)); out['spread_'+n]='ok' } catch(e){ out['spread_'+n]=e.constructor.name+': '+e.message } }
const DRE=/^\d{4}-\d{2}-\d{2}$/, PRE=/^days\/\d{4}\/\d{2}\/\d{2}\.json$/;
for (const [k,re] of [['DRE',DRE],['PATH',PRE],['NA404',/HTTP 404/]]) { const s='1'.repeat(5e6)+'x'; const t=process.hrtime.bigint(); re.test(s); re.test('days/'+'1'.repeat(5e6)); out['regex_'+k+'_ms']=Number(process.hrtime.bigint()-t)/1e6 }
// prototype pollution through JSON + spread (line 58)
const raw=JSON.parse('{"__proto__":{"polluted":"top"},"constructor":{"prototype":{"polluted":"ctor"}},"parts":[{"__proto__":{"polluted":"part"},"hour":"01"}]}');
const spread=raw.parts.map(p=>({...p,sealed:true}));
out.proto={plainPolluted:({}).polluted===undefined?'no':'YES', spreadOwnProtoKey:Object.prototype.hasOwnProperty.call(spread[0],'__proto__'), spreadProtoIsObject:Object.getPrototypeOf(spread[0])===Object.prototype};
// number edge cases accepted by vk count test: r.coverage==='none'?n!==null:!(n>=0)
const vkCount=n=>!(n>=0)?'reject':'accept';
out.count={inf:vkCount(JSON.parse('1e999')),str:vkCount("5"),arr:vkCount([5]),neg0:vkCount(-0),frac:vkCount(0.5),bool:vkCount(true),nullNonNone:vkCount(null)};
out.archSumStrings=[{count:0},{count:"5"},{count:3}].reduce((n,y)=>n+y.count,0);
out.Ninf=Number(Infinity).toLocaleString('en-GB');
out.Date_parse_feb30=Date.parse('2026-02-30T00:00:00Z'); out.Date_parse_13=Date.parse('2026-13-01T00:00:00Z');
console.log(JSON.stringify(out,null,1));
