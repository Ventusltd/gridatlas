// node-probes2.mjs — SYNTHETIC probes of 202610262323 module expressions (lines 9, 20, 36, 59, 69, 70, 87)
const AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/', out={};
out.url=Object.fromEntries(['../../../../../evil-owner/evil-repo/main/x.json','https://evil.example/abs.json','//evil.example/proto-rel.json','%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/enc-owner/enc-repo/main/enc.json','..\\..\\..\\..\\..\\bs-owner\\bs-repo\\main\\bs.json','days/2026/10/26/05.json?q=1#frag','@evil.example/at.json','../../../../../../../../x'].map(p=>{const u=new URL(AR+p);return[p,u.host+u.pathname+u.search]}));
const bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5;
for (const n of [2,1e5,2e5,1e6]) { try { bx(...[].concat(new Array(n).fill(-1))); out['okSpread_'+n]='ok' } catch(e){ out['okSpread_'+n]=e.constructor.name+': '+e.message } }
const DRE=/^\d{4}-\d{2}-\d{2}$/; out.dreArray=DRE.test(['2026-10-25']); out.dre9999=[DRE.test('2025-99-99'),Date.parse('2025-99-99T00:00:00Z')];
try{ [{date:['2026-10-25']},{date:'2026-10-24'}].sort((a,b)=>b.date.localeCompare(a.date)); out.localeCompareArray='ok' }catch(e){out.localeCompareArray=e.constructor.name+': '+e.message}
const m=new Map(); for(const f of [{id:undefined},{},{id:null},{id:'a'}]) m.set(String(f.id),f); out.idCollapse=[...m.keys()];
try{ new Date(1e308).toISOString() }catch(e){ out.T_1e308=e.constructor.name } out.isFinite_1e308=isFinite(1e308);
console.log(JSON.stringify(out,null,1));
