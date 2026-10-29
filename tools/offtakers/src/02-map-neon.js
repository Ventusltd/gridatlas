/// ---- map layers (added on the first switch-on only) ----
/// the class chips and, for power stations, the status chips; a ring (closed, closing or converted) is hollow
fl=()=>['all',['in',['get','k'],['literal',CK.filter(k=>S.cls[k])]],['any',['!=',['get','k'],'b'],['in',['get','t'],['literal',BK.filter(k=>S.bst[k])]]]],
MT=(i,d)=>['match',['get','k'],...CK.flatMap(k=>[k,CLS[k][i]]),d],RING=['in',['get','t'],['literal',['cl','cc']]],
/// a data centre: the status ring (DST colours) and, with no MW stated (u), a faint fill
IC=['==',['get','k'],'c'],DRC=['match',['get','t'],...DK.flatMap(k=>[k,DST[k][1]]),DST.un[1]],
CORE=SRC+'-centre',LY=[GLOW,LAYER,CORE,HIT],
dw=()=>{let m=mh();if(!m||!S.data)return;let fc=FC(S.data.dots.map(r=>({type:'Feature',id:r.i,properties:{k:r.k,t:r.t,z:r.z,i:r.i,u:r.k=='c'&&(w=>w.it??w.gc)(DMW(r.p))==null?1:0},geometry:{type:'Point',coordinates:r.a}}))),Z=(a,b)=>['interpolate',['linear'],['zoom'],6,['*',['get','z'],a],12,['*',['get','z'],b]],F=fl();
 if(!m.getSource(SRC)){m.addSource(SRC,{type:'geojson',data:fc});
  m.addLayer({id:GLOW,type:'circle',source:SRC,filter:F,paint:{'circle-radius':Z(['*',2.4,MT(3,3)],['*',2.4,MT(4,6)]),'circle-color':MT(1,'#e07b39'),'circle-opacity':['case',RING,0,['match',['get','k'],'d',.12,'s',0,.2]],'circle-blur':1}});
  m.addLayer({id:LAYER,type:'circle',source:SRC,filter:F,layout:{'circle-sort-key':['+',['match',['get','k'],'s',0,'e',1,'d',2,'a',4,'c',7,5],['get','z']]},paint:{'circle-radius':Z(MT(3,3),MT(4,6)),
   'circle-color':['case',RING,'rgba(0,0,0,0)',MT(1,'#e07b39')],'circle-opacity':['match',['get','k'],'d',.8,'s',.8,'c',['case',['==',['get','u'],1],.45,.95],.95],
   'circle-stroke-color':['case',RING,CLS.b[1],IC,DRC,MT(2,'#3a1d0a')],'circle-stroke-width':['case',RING,2,IC,2.5,['match',['get','k'],'d',0,'s',0,1]]}});
  m.addLayer({id:CORE,type:'circle',source:SRC,filter:['all',F,['==',['get','k'],'b'],['!',RING]],paint:{'circle-radius':Z(1,2),'circle-color':'#3a1d0a'}});
  m.addLayer({id:HIT,type:'circle',source:SRC,filter:F,paint:{'circle-radius':12,'circle-opacity':0}})}
 else{m.getSource(SRC).setData(fc);rf()}},
rf=()=>{let m=mh(),F=fl();if(m)for(let l of LY)try{m.getLayer(l)&&m.setFilter(l,l===CORE?['all',F,['==',['get','k'],'b'],['!',RING]]:F)}catch(e){note(e)}},
top=()=>{let m=mh();if(m&&m.moveLayer)for(let l of[...LY,...NI])try{m.getLayer(l)&&m.moveLayer(l)}catch(_){}},
cx=()=>{let m=mh();pc();if(m)try{for(let l of[...LY].reverse())m.getLayer(l)&&m.removeLayer(l);m.getSource(SRC)&&m.removeSource(SRC)}catch(e){note(e)}},
/// ---- neon links (own ids) ----
NP='gridatlas-offtakers-neon',/// DI/DS: the data-centre 30/30/30 links (one line source for all three sets, one node source)
DI=['ring','glow','core-s','core-r','core-v','node','label','ring-label'].map(s=>NP+'-dc-'+s),DS=[NP+'-dc-l',NP+'-dc-n',NP+'-dc-rings'],
NI=[NP+'-glow',NP+'-core',NP+'-flow',NP+'-node',NP+'-label',NP+'-pin-halo',NP+'-pin',NP+'-p-glow',LINKS,NP+'-p-node',NP+'-p-label',...DI],NSR=[NP+'-subs',NP+'-snodes',NP+'-pin',NP+'-plinks',NP+'-pnodes',...DS],
nc=()=>{let m=mh();if(S.raf){cancelAnimationFrame(S.raf);S.raf=null}if(m)try{for(let l of[...NI].reverse())m.getLayer(l)&&m.removeLayer(l);for(let s of NSR)m.getSource(s)&&m.removeSource(s)}catch(e){note(e)}},
SC={op:'#00ff88',cc:'#ffcc00',pl:'#ff8a3d','?':'#ff4444'},
/// draw: substation links from o (k = nearestSubstations result), the azure pin at o, and REPD site links (P = sites) when given
nl=(m,o,k,P)=>{let Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{})),TL='#5fbdc2';nc();
 m.addSource(NSR[2],{type:'geojson',data:FC([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:o}}])});
 if(P&&P.length){m.addSource(NSR[3],{type:'geojson',data:FC(P.map(g=>({type:'Feature',properties:{c:SC[RpS(g.parts[0].status)]},geometry:{type:'LineString',coordinates:[o,g.a]}})))});
  m.addSource(NSR[4],{type:'geojson',data:FC(P.map(g=>({type:'Feature',properties:{c:SC[RpS(g.parts[0].status)],label:RpG(g)},geometry:{type:'Point',coordinates:g.a}})))});
  A(7,'line',NSR[3],{'line-color':['get','c'],'line-width':Z(4,9),'line-opacity':.1,'line-blur':Z(2,6)},RJ);A(8,'line',NSR[3],{'line-color':['get','c'],'line-width':Z(1,2),'line-opacity':.85,'line-dasharray':[2,2]});
  A(9,'circle',NSR[4],{'circle-radius':Z(3,5),'circle-color':['get','c'],'circle-stroke-width':1,'circle-stroke-color':'#000'});
  try{A(10,'symbol',NSR[4],{'text-color':'#d6e4ff','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)})}catch(e){note('labels: '+msg(e))}}
 if(k&&k.length){m.addSource(NSR[0],{type:'geojson',data:FC(k.map((a,i)=>({type:'Feature',properties:{s:MX(.25,.75-i*.1)},geometry:{type:'LineString',coordinates:[o,a.at]}})))});
  m.addSource(NSR[1],{type:'geojson',data:FC(k.map(a=>({type:'Feature',properties:{label:`${k2(a.km)} km · ${KV(a)} kV`},geometry:{type:'Point',coordinates:a.at}})))});
  A(0,'line',NSR[0],{'line-color':TL,'line-width':Z(5,12),'line-opacity':.12,'line-blur':Z(3,8)},RJ);A(1,'line',NSR[0],{'line-color':TL,'line-width':Z(.9,1.8),'line-opacity':['get','s']},RJ);
  A(2,'line',NSR[0],{'line-color':'#bfe9ee','line-width':Z(1.2,2.4),'line-opacity':.8,'line-dasharray':[.2,3.2]},{'line-cap':'round'});
  A(3,'circle',NSR[1],{'circle-radius':Z(2.2,4),'circle-color':TL,'circle-opacity':.85});
  try{A(4,'symbol',NSR[1],{'text-color':'#a9c4c9','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,-1.5],'text-anchor':'bottom','text-font':sf(m)})}catch(e){note('labels: '+msg(e))}
  let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){}
  if(rm)m.setPaintProperty(NI[2],'line-opacity',0);else if(typeof requestAnimationFrame=='function'){let ph=0,M=(W.__GRIDATLAS_NEON_LINKS__||{}).measure||{},fd=typeof M.flowDash=='function'?M.flowDash:p=>{let s=Math.floor(p/1.5*24)%24/24*1.5;return[.001,MX(.001,s),.42,MX(.001,1.5-s)]},mo='',
   st=()=>{ph=(ph+.055)%1.5;try{let d=fd(ph),j=d.join();if(j!==mo){mo=j;m.setPaintProperty(NI[2],'line-dasharray',d)}}catch(_){S.raf=null;return}S.raf=requestAnimationFrame(st)};S.raf=requestAnimationFrame(st)}}
 A(5,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#3d7bff','circle-stroke-width':6,'circle-stroke-opacity':.18,'circle-blur':.4});
 A(6,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#8fb4ff','circle-stroke-width':1.8,'circle-stroke-opacity':.9})},
KV=a=>MX(...(AI(a.kv)&&a.kv.length?a.kv:[0])),
