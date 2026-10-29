/// 10 nearest substations and the camera: the original's own measure drawn as its neon arrival in Lightning-owned layers,
/// and the framing rules (M2R-layout F1-F3, M2R-camera fix C, M2R-taps T1).
///
/// The neon layer and source ids; the REPD ones (p-*) join the set so close, period, LATEST and OFF remove them too (build-M
/// B1; dots adds p-glow, p-dot and the pdots source).
NP='gridatlas-lightning-neon',///
  NI=['glow','core','flow','flow-b','node-ring','node','label','pin-halo','pin','p-core','p-node',///
///#if dots
    'p-label','p-glow','p-dot'].map(s=>NP+'-'+s),///
///#else
    'p-label'].map(s=>NP+'-'+s),///
///#endif
  NSR=[NP+'-links',NP+'-nodes',NP+'-pin',NP+'-plinks',///
///#if dots
    NP+'-pnodes',NP+'-pdots'],
///#else
    NP+'-pnodes'],
///#endif
nc=()=>{///
    let m=mh();///
    if(S.raf){cancelAnimationFrame(S.raf);///
      S.raf=null}if(m)try{///
      for(let l of[...NI].reverse())if(m.getLayer(l))m.removeLayer(l);///
      for(let s of NSR)if(m.getSource(s))m.removeSource(s)///
    }catch(e){note(e)}///
  },
/// nr: nearest substations: the original's own measure (__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations: >= 33 kV,
/// <= 40 km, 5 links) drawn as its neon arrival (glow, core, two flow layers, teal nodes, labels, pale origin ring; kv-neon)
/// in Lightning-owned layers, in the technology colour #d8c96a. link.selectAt is not used: it treats its origin as a project
/// (stale project reference, cancelled arrivals, a false arrival record; kv-arrival-api). S.fk: the points to frame.
nr=(m,c,x,y)=>{///
    let L=window.__GRIDATLAS_NEON_LINKS__||{},M=L.measure||{},subs=Object.hasOwn(L,'substations')?L.substations:null,say=s=>ap(c.out,el('div','',s));///
    c.out.textContent='';///
    nc();
if(!AI(subs)||!subs.length||typeof M.nearestSubstations!=='function')return say('Substation data not loaded yet; trying again.'),0;
let k=c.k=M.nearestSubstations(x,y,subs),o=[x,y],TC='#d8c96a',TL='#5fbdc2',FL='#bfe9ee',Z=(a,///
      b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},
A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{}));///
    S.fk=[o,...k.map(a=>a.at)];///
    say(c.o.np?'Screening · nearest substations, straight line. Not its declared connection or capacity.':`Screening · nearest substations to this ${c.wh}, straight line. Proximity, not exposure or a current path; not evidence any asset was struck.`);
if(!k.length){///
      let b=k.beyondRadiusNearest;///
      say(`No substation within ${k.radiusKm||40} km`+(b?` (nearest: ${cs(b.name||'unnamed substation')}, ${(+b.km).toFixed(2)} km)`:''))///
    }
for(let a of k)say(`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV · ${cs(a.name||'unnamed substation')}`);
/// The REPD list runs for lightning cards only, never in the project view (build-M2 nr-repd).
if(!c.o.np)Rp(m,c,x,y,M);///
///#if dots
    else if(c.o.g)RpD(m,[c.o.g]);if(!k.length)return k;
///#else
    if(!k.length)return k;
///#endif
m.addSource(NSR[0],{///
        type:'geojson',data:FC(k.map((a,i)=>({///
                type:'Feature',properties:{colour:TC,strength:MX(.2,.62-i*.1)},geometry:{type:'LineString',coordinates:[o,a.at]}///
              })))///
      });
m.addSource(NSR[1],{///
        type:'geojson',data:FC(k.map(a=>({///
                type:'Feature',properties:{label:`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV`},geometry:{type:'Point',coordinates:a.at}///
              })))///
      });
A(0,'line',NSR[0],{///
        'line-color':['get','colour'],'line-width':Z(5,12),'line-opacity':.1,'line-blur':Z(3,8)///
      },RJ);
A(1,'line',NSR[0],{///
        'line-color':['get','colour'],'line-width':Z(.9,1.8),'line-opacity':['get','strength']///
      },RJ);
A(2,'line',NSR[0],{///
        'line-color':FL,'line-width':Z(1.2,2.4),'line-opacity':.8,'line-dasharray':[.2,3.2]///
      },{'line-cap':'round'});
A(3,'line',NSR[0],{///
        'line-color':FL,'line-width':Z(.9,1.8),'line-opacity':.45,'line-dasharray':[.2,3.2]///
      },{'line-cap':'round'});
A(4,'circle',NSR[1],{///
        'circle-radius':Z(6,13),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':TL,'circle-stroke-width':1,'circle-stroke-opacity':.4///
      });
A(5,'circle',NSR[1],{'circle-radius':Z(2.2,4),'circle-color':TL,'circle-opacity':.8});
try{///
      A(6,'symbol',NSR[1],{///
          'text-color':'#a9c4c9','text-halo-color':'#000c10','text-halo-width':1.5,'text-opacity':.9///
        },{///
          'text-field':['get','label'],'text-size':10,'text-offset':[0,-1.5],'text-anchor':'bottom','text-allow-overlap':false,'text-font':sf(m)///
        })///
    }catch(e){note('neon labels: '+msg(e))}
m.addSource(NSR[2],{///
        type:'geojson',data:FC([{///
              type:'Feature',properties:{},geometry:{type:'Point',coordinates:o}///
            }])///
      });
A(7,'circle',NSR[2],{///
        'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':TC,'circle-stroke-width':6,'circle-stroke-opacity':.13,'circle-blur':.4///
      });
A(8,'circle',NSR[2],{///
        'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#cfe9ed','circle-stroke-width':1.6,'circle-stroke-opacity':.85///
      });
/// Flow: the cartridge's own 24 frozen dash patterns (measure.flowDash) when present; off under reduced motion.
let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){}
if(rm){///
      m.setPaintProperty(NI[2],'line-opacity',0);///
      m.setPaintProperty(NI[3],'line-opacity',0)///
    }else if(typeof requestAnimationFrame=='function'){///
      let ph=0;///
      let fd=typeof M.flowDash=='function'?M.flowDash:p=>{///
        let s=Math.floor(p/1.5*24)%24/24*1.5;///
        return[.001,MX(.001,s),.42,MX(.001,1.5-s)]///
      },mo={},
set=(i,p)=>{///
        let d=fd(p),j=d.join();///
        if(mo[i]!==j){///
          mo[i]=j;///
          m.setPaintProperty(NI[i],'line-dasharray',d)///
        }///
      },st=()=>{///
        ph=(ph+.055)%1.5;///
        try{set(2,ph);///
          set(3,(ph+.75)%1.5)}catch(_){S.raf=null;///
          return}S.raf=requestAnimationFrame(st)///
      };///
      S.raf=requestAnimationFrame(st)///
    }
return k},
/// nf: fired on the tap; retried every 2 s (15 times) while the same card is open if the substation list is not loaded yet.
/// The project view always flies to the project, even with no substation within 40 km (build-M2 nf-fly).
nf=(m,c,x,y,n)=>{///
    if(S.pp!==c)return;///
    let k;///
    try{k=nr(m,c,x,y)}catch(e){///
      note('nearest: '+msg(e));///
      nc();///
      c.out.textContent='Substation data unavailable.';///
      return cpos()///
    }cpos();
if(AI(k)){///
      c.sm.textContent+=k.length?` · ${k.length} nearest substations`:` · no substation within ${k.radiusKm||40} km`;///
      if(k.length||c.o.np)nz(m,x,y);///
      return///
    }if(n)setTimeout(()=>nf(m,c,x,y,n-1),2e3)///
  },
/// M4 (M2R-taps MAJOR T1): MapLibre 3.6.2's stop() fires moveend synchronously, so a pending once('moveend', ck) ran its
/// fitBounds nested inside the next camera move, left an orphan render frame and froze redraws after fast row/back cycles.
/// cw: the pending framing runs in a microtask after the stop that fired it, only when the map is then not moving.
/// cm: every module camera move first drops the module's pending framing (nz, ck, RpR, the cluster zoom, the fit button).
cw=()=>Promise.resolve().then(()=>{let m=mh();///
      m&&!(m.isMoving&&m.isMoving())&&ck()}),///
  cm=m=>m.off&&m.off('moveend',cw),
/// nz: the original arrival's flyTo (zoom 12, 1200 ms), then frame at moveend.
nz=(m,x,y)=>{///
    try{///
      cm(m);///
      m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});///
      typeof m.once=='function'?m.once('moveend',cw):ck()///
    }catch(e){note('camera: '+msg(e))}///
  },
/// ck: frame S.fk when an end is outside the free area (screen pixels: x 20..W-R+20, y T-20..H-B), or always with f === 1
/// (M2R-layout F2). Padding: top 150, sides 40, bottom card + 24 capped at H-270 only when L3's fit is impossible
/// (M2R-diff MD1); docked card (c.sd, fix C): top 60, right card width + 32, bottom 100.
ck=f=>{///
    try{///
      let m=mh(),c=S.pp,k=S.fk,C=m&&m.getContainer(),H=C&&C.clientHeight||1e4,d=c&&c.sd,B=d?100:c&&(c.bb+c.offsetHeight||196)+24,R=d?c.offsetWidth+32:40,T=d?60:150;///
      if(!c||!k||f!==1&&k.every(a=>{///
            let p=m.project(a);///
            return p.x>=20&&p.x<=(C.clientWidth||1e4)-R+20&&p.y>=T-20&&p.y<=H-B///
          }))return;///
      let[w,s]=k[0],[e,n]=k[0];///
      for(let[a,o]of k){w=MN(w,a);///
        e=MX(e,a);///
        s=MN(s,o);///
        n=MX(n,o)}
cm(m);///
      m.fitBounds([[w,s],[e,n]],{///
          padding:{///
            top:T,left:40,right:R,bottom:d?B:H-150>B?B:MX(0,H-270)///
          },maxZoom:12,duration:900///
        })///
    }catch(e){note('camera: '+msg(e))}///
  },
