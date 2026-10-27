// make-card.mjs: applies the kv-card patch to fixed-module-I.js by exact string replacement (each anchor must occur once).
// Usage: node make-card.mjs <in fixed-module-I.js> <out .js>
import { readFileSync, writeFileSync } from 'node:fs';
const [, , IN, OUT] = process.argv;
let s = readFileSync(IN, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`anchor x${n}: ${a.slice(0, 80)}`); s = s.replace(a, () => b); };

// 1. cpos: no longer hangs off the flash. Docked at the bottom of the map like the original card bar; lifted clear of the
//    original's bottom controls (.map-controls incl. the mobile tray, #gridatlas-dash-toggle) instead of covering them;
//    if lifting would not fit, it falls back to bottom 8px (it is z-index 21, above .map-controls z 20).
rep(`// above the flash when it fits below the menu bar, else below it; clamped inside the map; scrolls when taller than the map
cpos=()=>{const c=S.pp,m=mh();if(!c||!m)return;const p=m.project(c.ll),k=m.getContainer().getBoundingClientRect(),b=Q('gridatlas-menu-bar'),t=Math.max(0,(b?b.getBoundingClientRect().bottom:0)-k.top)+8,w=c.offsetWidth||0,h=c.offsetHeight||0;
c.style.maxHeight=Math.max(120,k.height-t-8)+'px';c.style.left=Math.min(Math.max(p.x,w/2+8),Math.max(w/2+8,k.width-w/2-8))+'px';c.style.top=(p.y-h-14>=t?p.y-h-14:Math.max(t,Math.min(p.y+14,k.height-h-8)))+'px'},`,
`// card bar docked at the bottom of the map (like the original's), lifted clear of the original's bottom controls, never over the menu bar
cpos=()=>{const c=S.pp,m=mh();if(!c||!m)return;const k=m.getContainer().getBoundingClientRect(),q=Q('gridatlas-menu-bar'),t=Math.max(0,(q?q.getBoundingClientRect().bottom:0)-k.top)+8,w=Math.min(480,k.width-16),L=k.left+(k.width-w)/2,h=c.offsetHeight||0;let b=8;
for(const o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){const r=o&&o.getBoundingClientRect();if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=Math.max(b,k.bottom-r.top+8)}
if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';c.style.maxHeight=Math.max(44,k.height-t-b)+'px'},`);

// 2. the card: bar [time][-][x], expandable short-ID row (full ID + substation list inside), lat/lon, honesty line.
//    Lines fire on tap (nf), no button.
rep(`const g=S.res&&S.res.ev[p.i];if(!g)return;const[x,y]=g.geometry.coordinates,c=el('div','position:absolute;z-index:5;max-width:280px;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #00ffff;border-radius:4px;padding:8px 48px 8px 10px;font:12px/1.45 monospace;overflow-wrap:anywhere;overflow:auto;transform:translateX(-50%)');
c.dataset.lightningCard='';c.ll=[x,y];const b=el('button','position:absolute;top:0;right:0;width:44px;height:44px;background:none;border:0;color:#e8f4f5;font:20px monospace;cursor:pointer','×');b.type='button';b.setAttribute('aria-label','Close');b.addEventListener('click',pc);c.appendChild(b);
for(const s of[Ts(tm(g)),'Flash ID '+(g.id==null?'(none)':g.id),\`lat \${y.toFixed(3)}, lon \${x.toFixed(3)}\`,'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike'])c.appendChild(el('div','',s));
const n=el('button','margin-top:6px;min-height:44px;padding:0 10px;background:#001418;color:#00ffff;border:1px solid #00ffff;font:12px monospace;cursor:pointer','NEAREST SUBSTATIONS');n.type='button';n.dataset.lightningNearest='';n.addEventListener('click',()=>near(m,c,x,y));c.appendChild(n);
c.out=el('div','margin-top:6px');c.appendChild(c.out);m.getContainer().appendChild(c);S.pp=c;cpos()},`,
`const g=S.res&&S.res.ev[p.i];if(!g)return;const[x,y]=g.geometry.coordinates,id=g.id==null?'(none)':g.id+'',
c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#0a1a1d;border-bottom:1px solid #1d3238'),bd=el('div','padding:0 8px 6px'),d=el('details'),
B=(t,a,f)=>{const e=el('button','flex:none;width:44px;height:44px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:14px/1 monospace;cursor:pointer',t);e.type='button';e.setAttribute('aria-label',a);e.addEventListener('click',f);bar.appendChild(e);return e};
c.dataset.lightningCard='';c.setAttribute('role','dialog');c.setAttribute('aria-label','Lightning flash');
bar.appendChild(el('span','flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5fbdc2;font-weight:bold','Flash '+Ts(tm(g))));
const mn=B('−','Minimise',()=>{const o=bd.style.display=='none';bd.style.display=o?'':'none';mn.textContent=o?'−':'+';mn.setAttribute('aria-expanded',o);cpos()});mn.setAttribute('aria-expanded',true);B('×','Close',pc);
d.appendChild(el('summary','padding:14px 0 13px;line-height:17px;cursor:pointer;color:#bfe9ee',\`lat \${y.toFixed(3)}, lon \${x.toFixed(3)} · ID \${sid(id)}\`));
d.appendChild(el('div','color:#8b9aa1;font-size:10px;overflow-wrap:anywhere','Flash ID '+id));c.out=el('div','margin-top:4px;color:#9fb3ba');d.appendChild(c.out);bd.appendChild(d);
bd.appendChild(el('div','color:#8b9aa1;font-size:10px','EUMETSAT optical flash, not a confirmed ground strike. Lines: nearest substations, straight-line; not evidence any asset was hit.'));
c.appendChild(bar);c.appendChild(bd);S.pp=c;m.getContainer().appendChild(c);cpos();nf(m,c,x,y,15)},
// short ID: product sensing window + flash index (W_XX-..._<start>_<end>_N__..._0000:<index>); full ID stays in the row
sid=s=>{const r=/_\\d{8}(\\d\\d)(\\d\\d)\\d\\d_\\d{8}(\\d\\d)(\\d\\d)\\d\\d_N_.*:(\\d+)$/.exec(s);return r?\`\${r[1]}:\${r[2]}–\${r[3]}:\${r[4]} #\${r[5]}\`:s.length>24?s.slice(0,12)+'…'+s.slice(-8):s},`);

// 3. nr returns the picked list; nf fires on tap (retries while the substation list is still loading, card still open);
//    nv frames flash + endpoints only when one is off-screen, padded for the menu bar and the card, never zooming in.
rep(`catch(e){note('nearest labels: '+msg(e))}},near=(m,c,x,y)=>{nr(m,c,x,y);cpos()},`,
`catch(e){note('nearest labels: '+msg(e))}return k},
nf=(m,c,x,y,n)=>{if(S.pp!==c)return;const k=nr(m,c,x,y);if(Array.isArray(k))return nz(m,c,x,y,k);if(n&&/^Substation data/.test(c.out.textContent))setTimeout(()=>nf(m,c,x,y,n-1),2e3)},
nz=(m,c,x,y,k)=>{if(!k.length||!m.getBounds||!m.fitBounds)return;const P=[[x,y],...k.map(a=>a.s.at)],v=m.getBounds();if(P.every(p=>v.contains(p)))return;let w=x,s=y,e=x,n=y;for(const[a,o]of P){w=Math.min(w,a);e=Math.max(e,a);s=Math.min(s,o);n=Math.max(n,o)}
const r=m.getContainer().getBoundingClientRect(),q=Q('gridatlas-menu-bar');m.fitBounds([[w,s],[e,n]],{padding:{top:Math.max(0,(q?q.getBoundingClientRect().bottom:0)-r.top)+40,bottom:(c.bb||8)+(c.offsetHeight||0)+30,left:40,right:40},maxZoom:m.getZoom?m.getZoom():22,duration:600})},`);

// 4. the card no longer follows a point, so it re-docks on map resize (rotation, fullscreen) instead of every move frame
rep(`m.on('move',cpos)`, `m.on('resize',cpos)`);

writeFileSync(OUT, s);
console.log(OUT, Buffer.byteLength(s));
