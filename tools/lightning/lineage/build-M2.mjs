// build-M2.mjs: Build M (202610281950) module -> M2 module (owner, 28 Oct 2026 20:51 UTC: "make the feature comprehensive";
// cartridge gate 500,000 B, module cap 64,781 B). Every replacement is exact-once against the M bytes.
//   MR1-MR4 (reports/MR.md) + the bridge failed-start note, and the comprehensive REPD block (tools/repd-m2.part.js):
//   in-page row tap with "◀ back", co-located sites grouped, status/technology filter chips with re-ranking,
//   a 10 km / 40 km summary line, and an explicit "fewer than 10" statement.
// usage: node build-M2.mjs <module-M.js> <out.js>
import fs from 'node:fs';
const [, , IN, OUT] = process.argv;
let s = fs.readFileSync(IN, 'utf8'); const b0 = Buffer.byteLength(s), log = [];
const once = (id, a, b) => { const k = s.split(a).length - 1; if (k !== 1) throw new Error(id + ' found ' + k); const n0 = Buffer.byteLength(s); s = s.replace(a, () => b); log.push([id, Buffer.byteLength(s) - n0]); };
const cut = (id, from, to, b) => { const i = s.indexOf(from), j = s.indexOf(to, i); if (i < 0 || j < 0 || s.indexOf(from, i + 1) >= 0) throw new Error(id); const n0 = Buffer.byteLength(s); s = s.slice(0, i) + b + s.slice(j); log.push([id, Buffer.byteLength(s) - n0]); };

// header: one more readable line for M2
once('header', 'Long periods: ≈10 km cells within 30 km of a REPD site. */',
  'Long periods: ≈10 km cells within 30 km of a REPD site. */\n/* M2: a tap lists the nearest REPD project sites (straight-line, 40 km; co-located parts grouped; status and technology filters; 10 km / 40 km summary); a row flies to the project and draws its nearest-substation links, with "◀ back" to the lightning card. Distance only: never "affected". */');
// card: options (np = no REPD list, open, foot, back) and a re-open closure for "◀ back"
once('cd-sig', 'cd=(m,x,y,lb,ti,su,de,wh)=>{', 'cd=(m,x,y,lb,ti,su,de,wh,o={})=>{');
once('cd-re', 'c.wh=wh;', 'c.wh=wh;c.o=o;c.re=open=>cd(m,x,y,lb,ti,su,de,wh,{...o,open});');
once('cd-back', 'ap(d,c.out);ap(bd,d);',
  "ap(d,c.out);if(o.back){let k=ap(bd,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer',o.back[0]));k.type='button';k.dataset.lightningBack='';k.addEventListener('click',o.back[1])}ap(bd,d);if(o.open)d.open=true;");
once('cd-foot', "ap(bd,el('div','color:#8b9aa1;font-size:10px','EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'));",
  "ap(bd,el('div','color:#8b9aa1;font-size:10px',o.foot||'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'));");
// nr: the project view states that nearest is not the declared connection; the REPD list runs only for lightning cards
once('nr-say', 'say(`Nearest substations to this ${c.wh} (straight-line km). Not evidence any asset was struck; faults can have other causes.`);',
  "say(c.o.np?'Nearest substations to this project (straight-line km; not its declared grid connection).':`Nearest substations to this ${c.wh} (straight-line km). Not evidence any asset was struck; faults can have other causes.`);");
// nf: the project view always flies to the project, even with no substation within 40 km
once('nf-fly', 'if(k.length)nz(m,x,y);return}', 'if(k.length||c.o.np)nz(m,x,y);return}');
cut('nr-repd', "let pd=say('REPD projects: loading…');", "if(!k.length)return k;", 'if(!c.o.np)Rp(m,c,x,y,M);');
// gj: once its own 15 s timer has aborted, any rejection (e.g. a body stream that errors on abort, as the bridge's may)
// is reported as the timeout, not as "Failed to fetch" (browser repro: evidence/M2-build/browser, repd-stall-7D)
once('gj-abort', ".catch(e=>{throw e&&e.name==='AbortError'?new Error(TOE):e})", ".catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e})");
// ck: a tall (expanded) card left no room for fitBounds, which then did nothing; keep at least 120 px of map between the
// 150 px top padding and the card. Unchanged whenever the card leaves that room (every L3 tap, which arrives collapsed).
once('ck-pad', 'bottom:(S.pp.bb+S.pp.offsetHeight||196)+24}', 'bottom:MN((S.pp.bb+S.pp.offsetHeight||196)+24,MX(0,(m.getContainer().clientHeight||1e4)-270))}');
// RG and the new REPD functions (readable block) replace M's RG
cut('rg+repd', 'RG=(m,M)=>', 'BTN=(a,t,x)=>', fs.readFileSync(new URL('repd-m2.part.js', import.meta.url), 'utf8'));
fs.writeFileSync(OUT, s);
const n = Buffer.byteLength(s);
console.log(JSON.stringify({ from: b0, to: n, deltas: log, cap: 64781, spare: 64781 - n, cartridge: 435219 + n, cartridgeSpare: 500000 - 435219 - n }));
