/* Measurement labels occupy a separate layout area, never the drawing canvas. */
(() => {
  const registry = window.__GRIDATLAS_MODULES__ ||= {};
  let state = null;
  function close() {
    if (!state) return;
    const {map, host, rail, control, marker, style} = state;
    state = null;
    marker.replaceWith(control);
    rail.remove(); style.remove();
    host.removeAttribute('data-measurement-dock');
    document.body.removeAttribute('data-measurement-dock');
    map.resize();
  }
  function open(map, controlId) {
    if (state?.control.id === controlId) return;
    close();
    const canvas = map.getContainer();
    const host = canvas.parentElement;
    const control = document.getElementById(controlId);
    if (!control || !host) throw Error('Measurement dock requires its existing control and map host');
    const marker = document.createComment('measurement control home');
    control.before(marker);
    const rail = document.createElement('aside');
    rail.id = 'gridatlas-measurement-dock';
    rail.setAttribute('aria-label', 'Shape measurements and controls');
    const controls = document.createElement('div');
    controls.className = 'measurement-dock-controls';
    controls.append(control);
    const values = document.createElement('div');
    values.className = 'measurement-dock-values';
    rail.append(controls, values);
    const style = document.createElement('style');
    style.textContent = `
#map-container[data-measurement-dock] #map{width:calc(100% - 280px)!important;margin-left:280px!important}
#gridatlas-measurement-dock{position:absolute;left:0;top:64px;bottom:0;width:280px;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background:#080b10;border-right:1px solid #58646d;color:#fff;z-index:1100;padding:10px;font:12px/1.4 ui-monospace,monospace}
#gridatlas-measurement-dock .radius-popup{position:static!important;transform:none!important;margin:0 0 10px!important;width:auto!important;min-width:0!important;max-width:100%!important;box-sizing:border-box}
#gridatlas-measurement-dock .measurement-dock-values>div{min-width:0!important;box-sizing:border-box;max-width:100%}
#gridatlas-measurement-dock button,#gridatlas-measurement-dock input{min-height:36px}
body[data-measurement-dock] #codex-tool-layers{visibility:hidden!important;pointer-events:none!important}
@media(max-width:700px){
 #map-container[data-measurement-dock] #map{width:100%!important;margin-left:0!important;height:calc(100% - min(240px,38dvh))!important}
 #gridatlas-measurement-dock{top:auto;right:0;width:100%;height:min(240px,38dvh);border-right:0;border-top:1px solid #58646d;padding:8px 12px;display:grid;grid-template-columns:minmax(110px,0.8fr) minmax(180px,1.4fr);gap:8px;z-index:1100}
 #gridatlas-measurement-dock .measurement-dock-values>div{padding:6px!important}
 #gridatlas-measurement-dock .radius-popup{padding:6px!important}
 #gridatlas-measurement-dock .radius-input-row{flex-wrap:wrap}
}
@media(max-width:350px){#gridatlas-measurement-dock{grid-template-columns:1fr}}
`;
    document.head.append(style);
    host.append(rail);
    host.setAttribute('data-measurement-dock', controlId);
    document.body.setAttribute('data-measurement-dock', controlId);
    state = {map, host, rail, control, marker, style, values};
    map.resize();
  }
  function show(html) {
    if (!state) throw Error('Open measurement controls before showing results');
    const scroll = state.rail.scrollTop;
    state.values.innerHTML = html;
    state.rail.scrollTop = scroll;
  }
  function clearValues() {if (state) state.values.replaceChildren();}
  const draftKey = 'gridatlas.polygon-draft.v1';
  function validOutline(points) {
    return Array.isArray(points) && points.length >= 3 && points.length <= 4096 && points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 85.051129);
  }
  function saveOutline(points) {
    try {
      if (!validOutline(points)) return {saved:false, message:'Outline cannot be saved: invalid coordinates.'};
      localStorage.setItem(draftKey, JSON.stringify({schema:draftKey, points, savedAt:new Date().toISOString()}));
      return {saved:true, message:'Saved on this browser'};
    } catch { return {saved:false, message:'Browser storage unavailable; keep this tab open.'}; }
  }
  function readOutline() {
    try {
      const text = localStorage.getItem(draftKey);
      if (!text || text.length > 250000) return null;
      const draft = JSON.parse(text);
      return draft.schema === draftKey && validOutline(draft.points) ? draft.points.map(point => point.slice()) : null;
    } catch { return null; }
  }
  function clearOutline() {
    try {localStorage.removeItem(draftKey);return {saved:true,message:'Polygon reset'};}
    catch {return {saved:false,message:'Polygon reset here; browser storage could not be cleared.'};}
  }
  function analyzeOutline(points) {
    const fail=(code,message)=>({valid:false,code,message});
    if(!validOutline(points))return fail('coordinates','Use 3 to 4096 finite map coordinates.');
    const n=points.length,edges=[];
    const orient=(a,b,c)=>{const x=(b[0]-a[0])*(c[1]-a[1]),y=(b[1]-a[1])*(c[0]-a[0]),v=x-y;return Math.abs(v)<=Number.EPSILON*8*(Math.abs(x)+Math.abs(y))?0:Math.sign(v);};
    const on=(a,b,p)=>p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
    for(let i=0;i<n;i++){
      const a=points[i],b=points[(i+1)%n],c=points[(i+2)%n];
      if(a[0]===b[0]&&a[1]===b[1])return fail('repeated','Consecutive vertices coincide. Move or remove the repeated corner.');
      if(Math.abs(a[0]-b[0])>180)return fail('antimeridian','This outline crosses the date line. Area is not assessed by this map tool.');
      if(orient(a,b,c)===0&&(a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1])>0)return fail('overlap','Adjacent edges double back over one another.');
      edges.push({i,a,b,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1])});
    }
    edges.sort((a,b)=>a.minX-b.minX);let active=[];
    for(const edge of edges){
      active=active.filter(other=>other.maxX>=edge.minX);
      for(const other of active){
        const gap=Math.abs(edge.i-other.i);if(gap===1||gap===n-1||edge.minY>other.maxY||edge.maxY<other.minY)continue;
        const a=edge.a,b=edge.b,c=other.a,d=other.b,o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
        if((o1*o2<0&&o3*o4<0)||(o1===0&&on(a,b,c))||(o2===0&&on(a,b,d))||(o3===0&&on(c,d,a))||(o4===0&&on(c,d,b)))return fail('crossing','Non-adjacent edges cross or touch. Move the corners until the boundary is simple.');
      }
      active.push(edge);
    }
    const origin=points[0];let twiceArea=0;
    for(let i=1;i<n-1;i++)twiceArea+=(points[i][0]-origin[0])*(points[i+1][1]-origin[1])-(points[i+1][0]-origin[0])*(points[i][1]-origin[1]);
    if(twiceArea===0)return fail('degenerate','The outline has no enclosed area.');
    return {valid:true,code:'simple',message:'Simple outline in map coordinates.'};
  }
  function exportOutline(points, measurements) {
    const validity=analyzeOutline(points);if(!validity.valid)throw Error('Polygon not exported: '+validity.message);
    if (!validOutline(points)) throw Error('Draw a valid polygon before saving a file.');
    const ring = points.map(point => point.slice());
    const winding = ring.reduce((sum,point,i) => {const next=ring[(i+1)%ring.length];return sum+point[0]*next[1]-next[0]*point[1];},0);
    if (winding < 0) ring.reverse();
    ring.push(ring[0].slice());
    const properties = {name:'GridAtlas drawn polygon', source:'User-drawn outline', coordinate_reference:'WGS84 longitude, latitude', boundary:'Screening outline only; not a surveyed boundary or connection offer.'};
    for (const [key,value] of Object.entries(measurements || {})) if (['area_m2','area_ha','perimeter_km'].includes(key) && Number.isFinite(value) && value >= 0) properties[key]=value;
    return {type:'FeatureCollection',features:[{type:'Feature',properties,geometry:{type:'Polygon',coordinates:[ring]}}]};
  }
  function importOutline(text) {
    if (typeof text !== 'string' || text.length > 250000) throw Error('Choose a GeoJSON file under 250 KB.');
    let data;
    try {data=JSON.parse(text);} catch {throw Error('The file is not valid JSON. Your current polygon is unchanged.');}
    if (data?.type === 'FeatureCollection') {
      if (!Array.isArray(data.features) || data.features.length !== 1) throw Error('Choose a file containing exactly one polygon.');
      data=data.features[0];
    }
    if (data?.type === 'Feature') data=data.geometry;
    if (data?.type !== 'Polygon' || !Array.isArray(data.coordinates) || data.coordinates.length !== 1) throw Error('Choose one Polygon without holes; other geometries are not flattened.');
    const ring=data.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw Error('The polygon ring must be closed.');
    const points=ring.slice(0,-1);
    if (!validOutline(points) || new Set(points.map(point=>JSON.stringify(point))).size < 3) throw Error('Polygon coordinates must be valid WGS84 longitude/latitude pairs, with 3 to 4096 vertices.');
    return points.map(point=>point.slice());
  }
  registry.polygonFiles = Object.freeze({schema:'gridatlas.polygon-files.v1',exportOutline,importOutline,analyzeOutline});
  function createHistory(limit=80) {
    let states=[[]],position=0;
    const copy=points=>points.map(point=>point.slice());
    return Object.freeze({
      commit(points) {
        if (JSON.stringify(states[position])===JSON.stringify(points)) return;
        states=states.slice(0,position+1);states.push(copy(points));
        if(states.length>limit)states.shift();position=states.length-1;
      },
      undo() {if(position===0)return null;return copy(states[--position]);},
      redo() {if(position===states.length-1)return null;return copy(states[++position]);},
      get canUndo(){return position>0;},get canRedo(){return position<states.length-1;}
    });
  }
  registry.polygonHistory = Object.freeze({createHistory});
  registry.polygonDraft = Object.freeze({schema:draftKey,validOutline,saveOutline,readOutline,clearOutline});
  registry.measurementDock = Object.freeze({schema:'gridatlas.measurement-dock.v1',open,show,close,clearValues});
})();
