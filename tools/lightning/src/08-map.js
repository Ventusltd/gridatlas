/// 08 map: the map handle, the card position, the cell layers, the point layers and the tap handler.
///
/// mh: the original's MapLibre map (window.__GRIDATLAS_V9_MAP__), or null. sf: the text font the style already uses.
mh=()=>{let m=window.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{///
    try{///
      for(let l of m.getStyle().layers||[]){///
        let f=l.type==='symbol'&&l.layout&&l.layout['text-font'];///
        if(AI(f)&&f.length&&typeof f[0]==='string')return f///
      }///
    }catch(_){}return['Open Sans Regular']///
  },
/// pc: close the card and its neon layers. cs: strip format characters (bidi) and cap at 200 (LR-security). el: element
/// with inline style and text (DOM: shell classes, inline styles on own nodes only).
HIT=SRC+'-hit',CEL=SRC+'-cell',CNT=LAYER+'-count',pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200),///
  el=(t,css,s)=>{///
    let e=document.createElement(t);///
    if(css)e.style.cssText=css;///
    if(s!=null)e.textContent=s;///
    return e///
  },
/// cpos: dock the card at the bottom of the map like the original's (kv-card), lifted clear of the original's bottom
/// controls, never over the menu bar. M2R-layout F1 (MAJOR-1): an open card never rises above the container top + 320 px.
/// M2R-camera fix C (fixes-m4): on a map under 500 px tall with at least 300 px beside the card, the card docks right (c.sd).
cpos=()=>{///
    let c=S.pp,m=mh();///
    if(!c||!m)return;///
    let k=gr(m.getContainer()),q=Q('gridatlas-menu-bar'),t=MX(0,(q?gr(q).bottom:0)-k.top)+8,w=MN(480,///
      k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;///
    c.style.marginRight=sd?'0':'auto';///
    let b=8;
for(let o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){///
      let r=o&&gr(o);///
      if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=MX(b,k.bottom-r.top+8)///
    }
if(b+h>k.height-t)b=8;///
    c.bb=b;///
    c.style.bottom=b+'px';///
    c.style.maxHeight=MX(44,MN(k.height-t-b,MX(240,k.height-b-320)))+'px'///
  },
/// cx: remove every Lightning source and layer.
cx=()=>{///
    let m=mh();///
    pc();///
    if(m)try{///
      for(let l of[CNT,HIT,LAYER])if(m.getLayer(l))m.removeLayer(l);///
      if(m.getSource(SRC))m.removeSource(SRC);///
      dd()///
    }catch(e){note(e)}S.mode=null///
  },
/// Cells: REPD-style graduated core (n <= 3 about 1 px, faint) and a glow for the top 5 %, violet ramp on log10 n
/// (1/3/10/30/100/300); ids avoid 'l-'. RP: the original's project and substation layers, which win a tap; *glow* layers
/// never do (LR-taps F3). Cells sit below the original's projects.
CS=SRC+'-cells',///
  CL=[CEL+'-glow',CEL+'-core',CEL],///
  RP=(m,a)=>{///
    try{///
      return m.getStyle().layers.filter(l=>(l.source=='src-repd'||l.id=='l-subs')&&(a||!/glow/.test(l.id)&&m.getLayoutProperty(l.id,'visibility')!='none')).map(l=>l.id)///
    }catch(_){return[]}///
  },
dd=g=>{///
    let m=mh();///
    if(!m)return;///
    for(let l of CL)if(m.getLayer(l))m.removeLayer(l);///
    if(m.getSource(CS))m.removeSource(CS);///
    if(!g||!g.fc.features.length)return;
let b=RP(m,1).find(l=>l!='l-subs')||(m.getLayer(LAYER)?LAYER:void 0),L=['log10',///
      ['get','n']],I=(x,...s)=>['interpolate',['linear'],x,...s],B=[0,///
      .48,1,1.48,2,2.48],R=v=>I(L,...B.flatMap((k,i)=>[k,v[i]])),Z=(a,///
      c,d)=>I(['zoom'],5,a,7,c,10,d),
C=R(['#5a5590','#6f68a8','#8d7fd0','#a066ff','#c23cff','#e01cff']),A=(i,p,x)=>m.addLayer({id:CL[i],type:'circle',source:CS,...x,paint:p},b);///
    m.addSource(CS,{type:'geojson',data:g.fc});
A(0,{///
        'circle-radius':Z(I(L,1.48,5,2.48,13),I(L,1.48,8,2.48,20),I(L,1.48,16,2.48,36)),'circle-color':C,'circle-opacity':I(L,///
          1.48,.15,2.48,.4),'circle-blur':1///
      },{filter:['>=',['get','n'],g.T]});
A(1,{///
        'circle-radius':Z(R([.8,1,1.2,1.7,3.2,6]),R([1,1.2,1.6,2.4,5,9]),///
          R([2,2.5,3.5,6,12,20])),'circle-color':C,'circle-opacity':R([.22,.3,.42,.6,.85,.95]),'circle-stroke-width':I(L,///
          1.48,0,2,.6),'circle-stroke-color':'#140a2a'///
      },{layout:{'circle-sort-key':['get','n']}});
A(2,{'circle-radius':22,'circle-opacity':0})},
/// dw: one source, a points layer, an invisible 44 px hit layer and (clustered) count labels; hidden until data.
dw=(fc,cl)=>{///
    let m=mh(),K={///
      'circle-stroke-width':1.5,'circle-stroke-color':'#1a1a1a'///
    },Z=k=>['interpolate',['linear'],['zoom'],5,k(6),8,k(8),11,k(10)];///
    if(!m)E('no map');///
    let mode=cl?'cluster':'raw';///
    if(S.mode&&S.mode!==mode)cx();
if(!m.getSource(SRC)){///
      m.addSource(SRC,Object.assign({type:'geojson',data:FC()},cl?{cluster:true,clusterRadius:40,clusterMaxZoom:10}:{}));
m.addLayer({///
          id:LAYER,type:'circle',source:SRC,layout:{visibility:'none'},paint:cl?{///
            'circle-radius':Z(x=>['case',['has','point_count'],['step',['get','point_count'],12,100,16,1000,20,10000,26],x]),...K,'circle-color':['case',///
              ['has','point_count'],'#ffb000','#fff3a0'],'circle-opacity':0.9///
          }
:{'circle-radius':Z(x=>x),...K,'circle-color':'#fff3a0','circle-opacity':0.95}});
m.addLayer({///
          id:HIT,type:'circle',source:SRC,layout:{visibility:'none'},paint:{'circle-radius':22,'circle-opacity':0}///
        });
if(cl)try{///
        m.addLayer({///
            id:CNT,type:'symbol',source:SRC,filter:['has','point_count'],layout:{///
              visibility:'none','text-field':['get','point_count_abbreviated'],'text-font':sf(m),'text-size':11///
            },paint:{'text-color':'#000'}///
          })///
      }catch(e){note('count labels: '+msg(e))}S.mode=mode///
    }
m.getSource(SRC).setData(fc);///
    let v=fc.features.length?'visible':'none';///
    for(let l of[LAYER,HIT,CNT])if(m.getLayer(l))m.setLayoutProperty(l,'visibility',v)///
  },
/// tap: a flash (or cluster) under the tap wins, then the nearest cell unless a project or substation of the original is
/// hit. No work while loading or with no hit layer (LR-regress m2, LR-taps F2). Other click handlers always run.
tap=e=>{///
    let m=mh();///
    if(!S.on||S.busy||!m||!(m.getLayer(HIT)||m.getLayer(CEL)))return;///
///#if dots
    /// dots: a tap on a drawn listed site opens that site's project view, as its row does.
    let rq=S.pp&&S.pp.ps&&m.getLayer(NI[13])&&m.queryRenderedFeatures(e.point,{layers:[NI[13]]})[0],rg=rq&&S.pp.ps[rq.properties.k];///
    if(rg)return RpV(m,S.pp,rg);///
    let px=e.point.x??e.point[0],///
///#else
    let px=e.point.x??e.point[0],///
///#endif
    py=e.point.y??e.point[1],Y=l=>m.getLayer(l)?m.queryRenderedFeatures(e.point,{layers:[l]}):[];///
    let f=null,dm=Infinity;
for(let q of Y(HIT)){///
      let g=q.properties&&!q.properties.cluster&&S.res&&S.res.ev[q.properties.i],a=m.project((g||q).geometry.coordinates),d=(a.x-px)**2+(a.y-py)**2;///
      if(d<dm){dm=d;///
        f=q}///
    }pc();///
    if(!f){///
      let rp=RP(m),h=rp.length&&m.queryRenderedFeatures(e.point,{layers:rp});///
      /// layers: a tap on a drawn REPD dot belongs to the engine and closes the card (as L3); the tapped dot's technology is handed
      /// to the reader and every other layer this module switched on is released (M2R-l3regress MINOR M3-L1, fixes-m4).
      if(///
///#if dots
        h&&h.length)return;///
///#else
        h&&h.length){///
        for(let q of h)S.ly&&S.ly.delete(q.properties&&q.properties.tech);///
        return Ry()///
      }///
///#endif
      for(let q of Y(CEL)){///
        let p=q.properties||{},k=cb(p),a=k&&m.project([p.lon,p.lat]),d=k?(a.x-px)**2+(a.y-py)**2:1/0;///
        if(d<dm){dm=d;///
          f=p}///
      }///
///#if dots
      return f&&cc(m,f)///
    }
///#else
      return f?cc(m,f):Ry()///
    }
///#endif
/// A cluster tap zooms in; cm(m) first drops the module's pending framing (M4, M2R-taps T1).
let p=f.properties||{};///
    if(p.cluster){///
      let go=z=>(cm(m),m.easeTo({center:f.geometry.coordinates,zoom:z})),z=m.getSource(SRC).getClusterExpansionZoom(p.cluster_id,(err,z)=>err||go(z));///
      if(z&&z.then)z.then(go,note);///
      return///
    }
let g=S.res&&p.s===S.res.s&&S.res.ev[p.i];///
    if(!g)return;///
    let[x,y]=g.geometry.coordinates,id=g.id==null?'(none)':cs(g.id);
cd(m,x,y,'Lightning flash','Flash '+Ts(tm(g)),`lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ID ${sid(id)}`,'Flash ID '+id,'optical flash')///
  },
