/* lightning-window.v1 receiver: reads the fragment once, never writes the address, pre-selects only; ON stays a gesture */
lk=()=>{const h=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search),p=h.get('lightning');if(p===null)return;
if(['repd_ref','longitude','latitude','project','technology','capacity_mw','status','interconnector'].some(k=>q.has(k)))return note('link: a project link and a lightning window cannot be combined');
const r=h.get('lightning_end')||'',e=/Z$/.test(r)?Date.parse(r):NaN,s=Date.parse(h.get('lightning_start'));
if(!PERIODS.some(x=>x[0]===p)||!(e>0)||(p==='custom'&&!(s<e)))return note('link: unusable lightning window; nothing pre-selected');
const x=+h.get('lightning_lon'),y=+h.get('lightning_lat'),z=Math.min(10,+h.get('lightning_zoom')||9);
S.period=p;S.end=Math.min(e,Date.now());if(p==='custom'){S.from=ymd(s);S.to=ymd(e-DAY)}
S.view=isFinite(x)&&isFinite(y)&&Math.abs(y)<=90&&Math.abs(x)<=180&&(x||y)?[x,y,z]:null;
S.link=`link: ${p} to ${T(S.end)} - switch on to show`;paint()},
