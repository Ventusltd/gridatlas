/**
 * Node-only contract proof for the standalone, physically tappable optical map.
 * Mock MapLibre verifies event wiring/paint, NOT browser hit-testing or WebKit.
 * Run: node tools/proofs/lightning-grid-map.proof.mjs
 */
import assert from 'node:assert/strict';
import {initLightningMap} from '../../atlas/labs/lightning-grid/map-view.mjs';

let checks=0;
const check=(x,msg)=>{assert.ok(x,msg);checks++};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};

class MockSource{
  constructor(o){this.options=o;this.data=o.data;this.calls=0}
  setData(d){this.data=d;this.calls++}
  getClusterExpansionZoom(id,callback){this.clusterId=id;callback(null,10)}
}
class MockMap{
  constructor(options){this.options=options;this.sources=new Map();this.layers=new Map();
    this.events=new Map();this.moves=[];this.canvas={style:{}};MockMap.current=this}
  addControl(c,location){this.navLocation=location}
  addSource(id,value){this.sources.set(id,new MockSource(value))}
  addLayer(layer){this.layers.set(layer.id,layer)}
  getSource(id){return this.sources.get(id)}
  once(type,fn){if(type==='load')fn()}
  on(type,layerOrFn,fn){
    const key=type+'|'+(typeof layerOrFn==='function'?'*':layerOrFn);
    this.events.set(key,typeof layerOrFn==='function'?layerOrFn:fn);
  }
  fitBounds(bounds,opts){this.moves.push({kind:'fit',bounds,opts})}
  easeTo(opts){this.moves.push({kind:'ease',opts})}
  getBounds(){return {contains:()=>true}}
  getCanvas(){return this.canvas}
}
class MockPopup{
  setLngLat(x){this.point=x;return this}
  setDOMContent(x){this.dom=x;return this}
  addTo(map){this.map=map;return this}
  remove(){this.removed=true}
}
class MockBounds{
  constructor(a,b){this.points=[a,b]}
  extend(p){this.points.push(p);return this}
}
globalThis.maplibregl={
  Map:MockMap,
  NavigationControl:class{constructor(v){this.options=v}},
  Popup:MockPopup,LngLatBounds:MockBounds
};
const selected=[],status=[],errors=[];
const view=initLightningMap({
  onPick:id=>selected.push(id),
  onStatus:s=>status.push(s),
  onError:s=>errors.push(s)
});
const map=MockMap.current;
check(view.isReady(),'map should initialise in fake load lifecycle');
check(map.options.style.sources['carto-dark'].attribution.includes('OpenStreetMap'),
  'public background source must carry attribution');
eq(map.layers.get('optical-flash-tap').paint['circle-radius'],22,
  '44 css px tappable diameter must actually exist as a MapLibre layer');
eq(map.layers.get('optical-cluster-tap').paint['circle-radius'],24,
  'cluster hit size should exceed minimum');
eq(map.layers.get('nearby-solar-tap').paint['circle-radius'],22,
  'sized solar marks also use mobile touch targets');
check(map.layers.get('optical-dots').paint['circle-radius'].includes('zoom'),
  'visible optical pixels grow with zoom, without changing coordinates');
check(map.options.style.sources['carto-dark'].tiles.length>0,
  'real basemap context configured');
const a={type:'Feature',id:'observation-id-A',geometry:{type:'Point',coordinates:[-4.212,55.374302]},
  properties:{observation_kind:'optical_lightning_flash',time_utc:'2026-10-25T03:28:34.229Z'}};
const b={...a,id:'observation-id-B',geometry:{type:'Point',coordinates:[-4.48,55.16]}};
eq(view.setObservations([a,b]),2,'authentic optical feature count');
const rendered=map.getSource('optical-observations').data.features;
eq(rendered.length,2,'actual render source must contain two optical features');
eq(rendered[0].geometry.coordinates,[-4.212,55.374302],'map never shifts optical source coordinates');
eq(rendered[0].properties.flash_id,'observation-id-A','map stores genuine full string ID');
eq(map.moves.length,0,'loading map never hijacks camera');
map.events.get('click|optical-flash-tap')({features:[{properties:{flash_id:'observation-id-A'}}]});
eq(selected,['observation-id-A'],'actual map tap calls selection callback');
eq(map.moves.length,0,'tap does not auto pan original user camera');
view.selectFlash(a);
eq(map.getSource('selected-optical').data.features[0].properties.flash_id,'observation-id-A',
  'selection ring shows exact event identity');
const solar={repd_ref:'12588',name:'Sample actual REPD identity',location:{lon:-4.20,lat:55.37},
  km:1.2,capacity_mw:840,marker_radius_px:16,
  gridatlas_project_url:'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588'};
const station={name:'Mapped station',km:2,voltages_kv:[400],location:{lon:-4.18,lat:55.39}};
view.setContext({nearby_solar:[solar],substations:[station]});
eq(map.getSource('nearby-solar').data.features[0].properties.marker_radius_px,16,
  'solar radius is from source MW metadata supplied by existing engine');
eq(map.getSource('nearest-substations').data.features.length,1,'network context draws one genuine point');
eq(map.moves.length,0,'context addition must not auto fit');
view.fitSelection();
eq(map.moves.at(-1).kind,'ease','selected fit works only on explicit action');
eq(map.moves.at(-1).opts.center,[-4.212,55.374302],'fit selected centres source lon/lat');
view.fitFlashes();
eq(map.moves.at(-1).kind,'fit','fit all is explicit');
check(map.moves.at(-1).bounds.points.length>=2,'bounds contains real observations');
view.clearContext();
eq(map.getSource('nearby-solar').data.features.length,0,'refresh removes previous solar results');
eq(map.getSource('nearest-substations').data.features.length,0,'refresh removes previous substation results');
view.selectFlash(null);
eq(map.getSource('selected-optical').data.features.length,0,'clearing selection clears ring');
map.events.get('click|optical-cluster-tap')({
  features:[{properties:{cluster_id:12},geometry:{coordinates:[-4.25,55.4]}}]
});
eq(map.getSource('optical-observations').clusterId,12,'clustering expands source cluster id');
eq(map.moves.at(-1).kind,'ease','explicit click expands cluster');
check(!errors.length,'no mapping errors in mock lifecycle');
console.log('PASS — '+checks+' map-view interaction contract checks (fake MapLibre; no real browser).');
