#!/usr/bin/env node
// Applies the kv-security minimal fixes to a COPY of Build I and prints the byte cost of each (UTF-8).
import { readFileSync, writeFileSync } from 'node:fs';
const HERE = new URL('.', import.meta.url).pathname;
const IN = HERE + '../../wt/atlas/modules/202610270929-uk-lightning-overlay.js', OUT = HERE + 'patched-module-I.js';
let s = readFileSync(IN, 'utf8'); const B = x => Buffer.byteLength(x), b0 = B(s), cost = [];
const rep = (id, a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${id}: ${n} matches`); const before = B(s); s = s.replace(a, () => b); cost.push([id, B(s) - before]); };
// K1 bidi / zero-width / unbounded text in the card (flash ID, substation name)
rep('K1 cs helper', "el=(t,css,s)=>{", "cs=v=>(v+'').replace(/\\p{Cf}/gu,'').slice(0,200),el=(t,css,s)=>{");
rep('K1 flash ID', "'Flash ID '+(g.id==null?'(none)':g.id)", "'Flash ID '+(g.id==null?'(none)':cs(g.id))");
rep('K1 substation name', "${a.s.name||'unnamed substation'}", "${cs(a.s.name||'unnamed substation')}");
// K2 object-valued feature id throws in the click handler: reject it as malformed (GeoJSON id is string|number)
rep('K2 ok() id type', "&&isFinite(tm(f)),", "&&isFinite(tm(f))&&!(f.id instanceof Object),");
// K3 NaN projection: keep the last good position instead of writing NaNpx
rep('K3 cpos guard', "const p=m.project(c.ll),k=", "const p=m.project(c.ll);if(!isFinite(p.x+p.y))return;const k=");
// K4 stale rendered index after a refresh: tag features with the load serial and check it on tap
rep('K4 tag', "properties:{i}})", "properties:{i,s:serial}})");
rep('K4 store', "S.res=r;try{dw(", "S.res=r;r.s=serial;try{dw(");
rep('K4 check', "const g=S.res&&S.res.ev[p.i];if(!g)return;", "const g=S.res&&p.s===S.res.s&&S.res.ev[p.i];if(!g)return;");
// K5 neon links: own property only (no prototype reads), drop the never-assigned __GRIDATLAS_SUBSTATIONS__ fallback, coerce km
rep('K5 own subs', "subs=L.substations||window.__GRIDATLAS_SUBSTATIONS__||[]", "subs=Object.hasOwn(L,'substations')?L.substations:[]");
rep('K5 array check', "if(!subs.length||typeof dk", "if(!Array.isArray(subs)||!subs.length||typeof dk");
rep('K5 numeric km', "km:dk(x,y,s.at[0],s.at[1])", "km:+dk(x,y,s.at[0],s.at[1])");
// K6 anything else that throws (getter, hostile distanceKm): catch, clear, say so
rep('K6 try', "near=(m,c,x,y)=>{nr(m,c,x,y);cpos()}", "near=(m,c,x,y)=>{try{nr(m,c,x,y)}catch(e){note('nearest: '+msg(e));nc();c.out.textContent='Substation data unavailable.'}cpos()}");
writeFileSync(OUT, s);
const tot = {}; for (const [id, d] of cost) { const k = id.split(' ')[0]; tot[k] = (tot[k] || 0) + d; }
const report = { in: IN, out: OUT, bytes_before: b0, bytes_after: B(s), delta: B(s) - b0, per_fix: tot, per_edit: Object.fromEntries(cost), budget_left: 44781 - B(s) };
writeFileSync(HERE + 'bytes.json', JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
