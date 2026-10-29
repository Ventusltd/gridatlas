/* ---- M3: the REPD map layers of the listed projects ---------------------------------------------------------------
   The owner (28 Oct 2026, 21:39 UTC): "auto activate the REPD layers of the targeted 10 nearest projects". Each register
   tech is the id of the original's own REPD layer (solar, solar_roof, wind, bess, biomass, …; engine config "REPD (GeoJSON)").
   A layer is switched exactly as a tap on its Layers checkbox would: the original #scada-ui-container input is ticked and
   a bubbling "change" is dispatched, so the engine's own delegated listener syncs the fullscreen-curtain copy and runs
   its handleLayerToggle (visibility + hydration), and the menu bar's document listener syncs its proxy. S.ly holds only
   the layers M3 itself switched on; a layer the user already had on is never touched, and a layer the user ticks or
   unticks while M3 holds it becomes the user's (bt below). */
RL='solar solar_roof wind bess biomass tidal hydrogen hydro flywheel act geothermal caes'.split(' '),
Ly=(id,on)=>{let h=Q('scada-ui-container'),b=h&&h.querySelector(`input[data-layer-id="${id}"]`);if(!b||b.disabled||!!b.checked===on)return 0;
  S.lyx=1;try{b.checked=on;b.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){note('REPD layer '+id+': '+msg(e))}finally{S.lyx=0}return 1},
// switch on the layers `need` names that are off, and off every layer M3 switched on that `need` no longer names
Ry=(need=[])=>{let o=S.ly||(S.ly=new Set);for(let id of[...o])if(!need.includes(id)){o.delete(id);Ly(id,false)}
  for(let id of need)if(RL.includes(id)&&!o.has(id)&&Ly(id,true))o.add(id)},
