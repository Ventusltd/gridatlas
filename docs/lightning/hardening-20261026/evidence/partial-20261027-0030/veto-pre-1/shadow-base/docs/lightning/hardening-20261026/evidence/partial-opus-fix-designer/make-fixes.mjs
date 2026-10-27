// make-fixes.mjs - builds H01..H05 and the combined overlay from the UNMODIFIED 202610261949 overlay by exact-once
// string replacement, writes work/<name>/atlas/modules/202610261949-uk-lightning-overlay.js and <name>.diff
// (unified, a/ b/ prefixes: apply with `patch -p1` from the repository root). Every `old` must occur exactly once.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REL = 'atlas/modules/202610261949-uk-lightning-overlay.js';
const ORIG = readFileSync(join(here, 'orig', REL), 'utf8');

export const FIXES = {
  // H01: switching ON and every refresh (LATEST, 10-minute tick) revalidate BOTH the index and the live feed
  H01: [
    ['if(refresh)S.ip=null;', 'if(refresh)S.ip=S.fp=null;'],
    ['ld();if(!S.timer)', 'ld(true);if(!S.timer)'],
  ],
  // H02: feed mode gets the archive's STALE rule (> 4 h, UX spec) on metadata.query_end_utc (the time the caption shows); undated = stale
  H02: [
    ['stale=(x,now)=>now-x.gen>4*HOUR||now>x.nextDue,',
     '// STALE (UX spec): > 4 h old, undated, or past next_update_due_utc\n' +
     'stale=(x,now)=>!(now-x.gen<=4*HOUR)||now>x.nextDue,'],
    ['meta:m,ev,', 'meta:m,gen:Date.parse(m.query_end_utc),ev,'],
    ['stale:!!(r.idx&&stale(r.idx,now))', "stale:r.idx?stale(r.idx,now):r.mode==='feed'&&stale(r,now)"],
    ['earlier hours unknown, not zero)`;', "earlier hours unknown, not zero)${stale(r,now)?' · STALE':''}`;"],
  ],
  // H03: finite lon/lat inside the declared box or quarantined; in-window rejections counted (r.q) and captioned
  H03: [
    ["ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&f.properties",
     '// D02: finite lon/lat in the box W,S,E,N, edges included as in collect.py\n' +
     'inb=c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,\n' +
     "ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&inb(f.geometry.coordinates)&&f.properties"],
    ['co=(parts,ws,we)=>{const m=new Map();for(const part of parts)for(const f of part){if(!ok(f))continue;const t=tm(f);if(t>=ws&&t<we)m.set(String(f.id),f)}return[...m.values()].sort((a,b)=>tm(a)-tm(b))},',
     'co=(parts,ws,we)=>{const m=new Map();let q=0;for(const part of parts)for(const f of part){const t=f&&f.properties?tm(f):NaN;if(t<ws||t>=we)continue;if(ok(f))m.set(String(f.id),f);else q++}return{ev:[...m.values()].sort((a,b)=>tm(a)-tm(b)),q}},'],
    ['ev=co([f.features],w.s,w.e),', '{ev,q}=co([f.features],w.s,w.e),'],
    ['ev,fl:[],rq:1,', 'ev,q,fl:[],rq:1,'],
    ['r.ev=co(got.parts,w.s,w.e);return r},', 'Object.assign(r,co(got.parts,w.s,w.e));return r},'],
    ["L.warning=warn.join(' · ')}", "if(r.q)warn.push(`${N(r.q)} records quarantined (malformed or outside the UK box)`);\nL.warning=warn.join(' · ')}"],
  ],
  // H04: index count/bytes/sha256 compared with the fetched shard bytes; tg() passes the index row/part itself
  H04: [
    ['gj=(u,cache)=>{', "gj=(u,cache,body='json')=>{"],
    ['return r.json()})', 'return r[body]()})'],
    ['row.path?[{path:row.path,bytes:row.bytes,count:row.count,sealed:row.sealed}]', 'row.path?[row]'],
    ['.map(p=>({path:p.path,bytes:p.bytes,count:p.count,sealed:row.sealed}))', '.map(p=>({...p,sealed:row.sealed}))'],
    ["const p=gj(u,t.sealed?'default':'no-cache').then(o=>{if(!o||", "const p=gj(u,t.sealed?'default':'no-cache','arrayBuffer').then(async b=>{const o=await new Response(b).json();\nif(!o||"],
    ["o.metadata.date_utc!==date)E('invalid day file');return o.features})",
     "o.metadata.date_utc!==date)E('invalid day file');\n" +
     '// D08: shard must match its index row (plain http has no crypto.subtle: sha256 unverified)\n' +
     "const h=crypto.subtle?[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>pad(x.toString(16))).join(''):t.sha256,\n" +
     "bad=[o.features.length!==t.count&&'count',b.byteLength!==t.bytes&&'bytes',h!==t.sha256&&'sha256'].filter(Boolean);\n" +
     "if(bad.length)E('index mismatch: '+bad.join(', '));return o.features})"],
  ],
  // H05: the budget-skip caption names whole-day index sums as such, never "in window"
  H05: [
    ['Flashes ${N(r.arch)} archived in window (index) · ', 'Flashes ${N(r.arch)} archived on the overlapping UTC dates (whole days; window is ${w.label}) · '],
  ],
};

export function apply(src, edits, name) {
  for (const [a, b] of edits) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`${name}: expected exactly one occurrence, found ${n}: ${a.slice(0, 80)}`);
    src = src.replace(a, () => b);
  }
  return src;
}

function emit(name, src) {
  const dir = join(here, 'work', name, 'atlas', 'modules');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '202610261949-uk-lightning-overlay.js'), src);
  let diff = '';
  try { execFileSync('diff', ['-u', '--label', 'a/' + REL, '--label', 'b/' + REL, join(here, 'orig', REL), join(dir, '202610261949-uk-lightning-overlay.js')]); }
  catch (e) { diff = e.stdout.toString(); }
  writeFileSync(join(here, name + '.diff'), diff);
  const before = Buffer.byteLength(ORIG), after = Buffer.byteLength(src);
  console.log(`${name.padEnd(22)} before=${before} after=${after} delta=${after - before >= 0 ? '+' : ''}${after - before} diff_bytes=${Buffer.byteLength(diff)}`);
  return after - before;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const extra = process.argv[2] ? (await import(join(here, process.argv[2]))).SAVINGS : null;
  let sum = 0;
  for (const [name, edits] of Object.entries(FIXES)) sum += emit(name, apply(ORIG, edits, name));
  console.log(`sum of individual deltas = ${sum}`);
  let all = ORIG;
  for (const [name, edits] of Object.entries(FIXES)) all = apply(all, edits, name);
  emit('H01-05-combined-nosavings', all);
  if (extra) emit('H01-05-combined', apply(all, extra, 'SAVINGS'));
}
