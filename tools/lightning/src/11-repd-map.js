/// 11 REPD on the map, per variant: "layers" switches the listed technologies' own REPD layers on through their Layers
/// checkboxes (M3/M4); "dots" draws only the listed sites as REPD-styled dots and never touches a Layers control (M4b).
///
///#if dots
/* ---- M4b: the listed REPD sites, drawn in the original REPD style ----------------------------------------------------
   One dot per listed project at its site, with the engine's own paint (ventus-corev8engine.js:1305-1337): the solar and
   rooftop-solar glow by capacity, the capacity-graded core, and each other technology's own layer colour; stacked in the
   engine's REPD layer order. Only the sites on the card are drawn; the reader's Layers are never changed. A dot tap opens
   that site's project view, as its row does. */
RpO='solar solar_operational solar_roof wind wind_onshore_operational wind_offshore_operational bess bess_operational biomass tidal hydrogen hydro flywheel act geothermal caes'.split(' '),
RpD=(m,P)=>{///
    let d=FC(P.flatMap((g,k)=>g.parts.map(p=>({///
              type:'Feature',properties:{///
                t:p.tech,c:+p.capacity>0?+p.capacity:0,k,o:RpO.indexOf(p.tech)///
              },geometry:{type:'Point',coordinates:g.a}///
            })))),
  T=['get','t'],I=(...a)=>['interpolate',['linear'],['get','c'],...a],R=(r,o)=>['match',T,'solar_roof',r,o];
  if(m.getSource(NSR[5]))return m.getSource(NSR[5]).setData(d);m.addSource(NSR[5],{type:'geojson',data:d});
  m.addLayer({///
        id:NI[12],type:'circle',source:NSR[5],filter:['any',['all',['==',T,'solar'],['>=',['get','c'],4]],['all',['==',T,'solar_roof'],['>=',['get','c'],1]]],
    paint:{///
          'circle-color':R(I(1,'#ff8c00',5,'#ff6600',10,'#ff4400'),I(4,'#ffff00',20,'#ffaa00',50,'#ff4400',200,'#ff0000')),'circle-radius':R(I(1,26,2,30,5,36,10,44),///
            I(4,22,20,32,50,44,200,60,500,80)),
      'circle-opacity':R(.15,I(4,.12,20,.18,50,.25,200,.35)),'circle-blur':1,'circle-stroke-width':0}});
  m.addLayer({id:NI[13],type:'circle',source:NSR[5],layout:{'circle-sort-key':['get','o']},
    paint:{///
          'circle-color':['match',T,'solar_roof',I(0,'#ffcc00',.99,'#ffcc00',1,'#ff8c00',5,'#ff6600',10,'#ff4400'),///
            'solar',I(0,'#ffff00',20,'#ffcc00',50,'#ffaa00',200,'#ff6600',500,'#ff2200'),
      'wind','#00ffff','bess','#ffae00','biomass','#39ff14','tidal','#00bfff','hydrogen','#ffffff','hydro','#00aaff','flywheel','#ff69b4','act','#ff6600','geothermal','#ff3300','caes','#88aaff','#888888'],
      'circle-radius':R(I(0,7,.5,7,.99,8,1,16,2,18,5,22,10,28),///
            I(0,8,10,10,50,13,200,17,500,22,1000,28)),'circle-stroke-width':R(I(0,1,.99,1,1,2),///
            1.5),'circle-stroke-color':'#000','circle-opacity':R(.9,.85)///
        }///
      })///
      },
///#else
/* ---- M3: the REPD map layers of the listed projects ---------------------------------------------------------------
   The owner (28 Oct 2026, 21:39 UTC): "auto activate the REPD layers of the targeted 10 nearest projects". Each register
   tech is the id of the original's own REPD layer (solar, solar_roof, wind, bess, biomass, …; engine config "REPD (GeoJSON)").
   A layer is switched exactly as a tap on its Layers checkbox would: the original #scada-ui-container input is ticked and
   a bubbling "change" is dispatched, so the engine's own delegated listener syncs the fullscreen-curtain copy and runs
   its handleLayerToggle (visibility + hydration), and the menu bar's document listener syncs its proxy. S.ly holds only
   the layers M3 itself switched on; a layer the user already had on is never touched, and a layer the user ticks or
   unticks while M3 holds it becomes the user's (bt below). */
RL='solar solar_roof wind bess biomass tidal hydrogen hydro flywheel act geothermal caes'.split(' '),
Ly=(id,on)=>{///
    let h=Q('scada-ui-container'),b=h&&h.querySelector(`input[data-layer-id="${id}"]`);///
    if(!b||b.disabled||!!b.checked===on)return 0;
  S.lyx=1;///
    try{///
      b.checked=on;///
      b.dispatchEvent(new Event('change',{bubbles:true}))///
    }catch(e){note('REPD layer '+id+': '+msg(e))}finally{S.lyx=0}return 1///
  },
// switch on the layers `need` names that are off, and off every layer M3 switched on that `need` no longer names
Ry=(need=[])=>{///
    let o=S.ly||(S.ly=new Set);///
    for(let id of[...o])if(!need.includes(id)){o.delete(id);///
      Ly(id,false)}
  for(let id of need)if(RL.includes(id)&&!o.has(id)&&Ly(id,true))o.add(id)},
///#endif
