/// ---- the card (lightning's dock, width, collapse; Escape closes) ----
pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cpos=()=>{let c=S.pp,m=mh();if(!c||!m)return;let k=gr(m.getContainer()),q=Q('gridatlas-menu-bar'),t=MX(0,(q?gr(q).bottom:0)-k.top)+8,w=MN(480,k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;c.style.marginRight=sd?'0':'auto';let b=8;
 for(let o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){let r=o&&gr(o);if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=MX(b,k.bottom-r.top+8)}
 if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';/// a data-centre card (o.hh) opens as M6's half-height panel: at most 45 % of the map, scrolling inside
 c.style.maxHeight=MX(44,MN(k.height-t-b,c.o&&c.o.hh?MX(200,k.height*.45|0):MX(240,k.height-b-320)))+'px'},
cd=(m,lb,ti,o={})=>{pc();let c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8eef9;border:1px solid #2f5fa8;border-radius:4px;box-shadow:0 0 14px rgba(61,123,255,.28);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
 bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#08142b;border-bottom:1px solid #1d2f52'),bd=el('div','padding:0 8px 6px'),d=el('details'),rf=()=>{cpos();if(S.pp===c)ck(1)},
 B=(t,a,f)=>{let e=el('button','flex:none;width:44px;height:44px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:14px/1 monospace;cursor:pointer',t);e.type='button';e.setAttribute('aria-label',a);e.addEventListener('click',f);ap(bar,e);return e};
 c.dataset.offtakersCard='';c.setAttribute('role','dialog');c.setAttribute('aria-label',lb);c.o=o;
 ap(bar,el('span','flex:1;min-width:0;color:#8fb4ff;font-weight:bold;overflow-wrap:anywhere',ti.slice(0,90)));
 let mn=B('−','Minimise',()=>{let v=bd.style.display=='none';bd.style.display=v?'':'none';mn.textContent=v?'−':'+';mn.setAttribute('aria-expanded',v);rf()});d.addEventListener('toggle',rf);mn.setAttribute('aria-expanded',true);B('×','Close',()=>pc());
 c.addEventListener('keydown',e=>{if(e.key==='Escape')pc()});
 if(o.back){let k=ap(bd,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer',o.back[0]));k.type='button';k.dataset.offtakersBack='';k.setAttribute('aria-label',o.back[0].slice(2));k.addEventListener('click',o.back[1])}
 c.head=ap(bd,el('div'));c.sm=el('summary','padding:12px 0 11px;line-height:17px;cursor:pointer;color:#cfe0ff','');ap(d,c.sm);c.det=ap(d,el('div'));ap(bd,d);if(o.open)d.open=true;c.d=d;
 c.foot=ap(bd,tier(el('div','margin-top:6px;color:#8b9aa1;font-size:11px',o.foot||NOTSHOWN),o.foot?'record':'screening'));
 ap(c,bar);ap(c,bd);c.lv=ap(c,el('div','position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'));c.lv.setAttribute('role','status');S.pp=c;ap(m.getContainer(),c);cpos();
 try{W.dispatchEvent(new CustomEvent('gridatlas:card-open',{detail:{owner:'offtakers'}}))}catch(_){}return c},
L=(p,s,css,t)=>tier(ap(p,el('div',css||'',s)),t||'screening'),
Ra=(c,s)=>setTimeout(()=>{if(c.lv)c.lv.textContent=s},99),
/// a REPD failure on the collapsed card: the summary carries it (s; '' clears it) and the live region announces a
Ru=(c,s,a)=>{let t=c.sm.textContent.replace(/ · REPD[^·]* unavailable/,'');c.sm.textContent=s?t.replace(/ · details$/,` · ${s} · details`):t;a&&Ra(c,a)},
/// ---- camera: M4's fixes (no camera move starts inside another) ----
cw=()=>Promise.resolve().then(()=>{let m=mh();m&&!(m.isMoving&&m.isMoving())&&ck()}),cm=m=>m.off&&m.off('moveend',cw),
nz=(m,x,y)=>{try{cm(m);m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',cw):ck()}catch(e){note('camera: '+msg(e))}},
ck=f=>{try{let m=mh(),c=S.pp,k=S.fk,C=m&&m.getContainer(),H=C&&C.clientHeight||1e4,d=c&&c.sd,B=d?100:c&&(c.bb+c.offsetHeight||196)+24,R=d?c.offsetWidth+32:40,T=d?60:150;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-R+20&&p.y>=T-20&&p.y<=H-B}))return;let[w,s]=k[0],[e,n]=k[0];for(let[a,o]of k){w=MN(w,a);e=MX(e,a);s=MN(s,o);n=MX(n,o)}
 cm(m);m.fitBounds([[w,s],[e,n]],{padding:{top:T,left:40,right:R,bottom:d?B:H-150>B?B:MX(0,H-270)},maxZoom:12,duration:900})}catch(e){note('camera: '+msg(e))}},
