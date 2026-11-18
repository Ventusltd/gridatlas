import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validCoordinate, radiusKm, normaliseOrigin, parseVicinityIntent, stationRecords, exploreVicinity, vicinityGeoJSON, VOLTAGE_BANDS} from './src/model.mjs';
import {assemble} from './build.mjs';
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(new URL('../../atlas/modules/202609011950-geodesy.js', import.meta.url), 'utf8'), context);
const geodesy = context.window.__GRIDATLAS_MODULES__.geodesy;
const origin = {at: [-0.1,51.5], type: 'repd', id: 'repd:2470', name: 'Chosen real project'};
const link = '?journey=vicinity&origin_type=repd&origin_id=repd%3A2470&latitude=51.5&longitude=-0.1&radius_km=10';
const feature = (id, at, voltage, extra = {}) => ({type:'Feature',id,geometry:{type:'Point',coordinates:at},properties:{name:id,voltage,...extra}});

test('radius accepts whole km only, including both boundaries; invalid values do not become defaults', () => {
  assert.equal(radiusKm(1),1); assert.equal(radiusKm('50'),50);
  for (const v of [0,51,1.5,'1.5',null,'',undefined,Infinity,NaN]) assert.throws(() => radiusKm(v));
});
test('origin coordinates do not accept nulls, strings, null-island or out-of-range positions', () => {
  for (const at of [[null,51],['-1',51],[0,0],[181,51],[-1,91],[NaN,51]]) assert.equal(validCoordinate(at),false);
  assert.equal(validCoordinate([0,51.5]),true); assert.equal(validCoordinate([-1,0]),true);
  assert.deepEqual(normaliseOrigin(origin),origin);
});
test('one URL intent consumer preserves opaque identity and explicitly rejects missing/ambiguous fields', () => {
  assert.deepEqual(parseVicinityIntent(link),{origin:{...origin,name:'repd repd:2470'},radiusKm:10});
  assert.equal(parseVicinityIntent('?repd_ref=2470'),null);
  for (const bad of [link.replace('radius_km=10','radius_km=1.5'),link+'&longitude=1',link.replace('origin_id=repd%3A2470','origin_id='),link.replace('origin_type=repd','origin_type=unknown'),link.replace('latitude=51.5','latitude='),link.replace('longitude=-0.1','longitude=null')]) assert.throws(() => parseVicinityIntent(bad));
  for (const type of ['datacentre','substation']) assert.equal(parseVicinityIntent(link.replace('origin_type=repd','origin_type='+type)).origin.type,type);
});
test('canonical voltage parser keeps explicit units and unknown values; missing IDs remain missing', () => {
  const rows = stationRecords([feature('volts',[-0.11,51.5],'33000;11000'),feature('traction',[-0.12,51.5],'750'),feature('unknown',[-0.13,51.5],null),feature('kv',[-0.14,51.5],null,{kv:'132'}),{geometry:{type:'Point',coordinates:[-0.15,51.5]},properties:{name:'No source ID'}}],geodesy);
  assert.deepEqual(rows[0].kv,[33,11]); assert.deepEqual(rows[0].bands,['33','11']);
  assert.deepEqual(rows[1].kv,[0.75]); assert.deepEqual(rows[1].bands,['other']);
  assert.deepEqual(rows[2].kv,[]); assert.deepEqual(rows[2].bands,['unknown']);
  assert.deepEqual(rows[3].kv,[132]); assert.equal(rows[4].id,null);
});
test('deduplicates tile repeats, filters only matching known voltage bands and reports all matches before display cap', () => {
  const a = feature('A',[-0.11,51.5],'33000'), b = feature('B',[-0.12,51.5],'11000');
  const rows = stationRecords([a,a,b,feature('Far',[2,51.5],'33000')],geodesy);
  assert.equal(rows.length,3);
  const result = exploreVicinity({origin,radius:10,records:rows,bands:['33'],geodesy,limit:1});
  assert.equal(result.matching,1); assert.equal(result.shown[0].name,'A');
  assert.equal(result.loadedRecords,3); assert.equal(result.truncated,false);
  const capped = exploreVicinity({origin,radius:10,records:rows,bands:['33','11'],geodesy,limit:1});
  assert.equal(capped.matching,2); assert.equal(capped.truncated,true); assert.equal(capped.shown.length,1);
  assert.equal(exploreVicinity({origin,radius:10,records:rows,bands:[],geodesy}).matching,0);
});
test('inclusive exact-radius test delegates distance to canonical engine; no electrical graph is created', () => {
  const edge = geodesy.destinationPoint(...origin.at,10,90), outside = geodesy.destinationPoint(...origin.at,10.01,90);
  const rows = stationRecords([feature('Near',origin.at,'33000'),feature('Outside',outside,'33000')],geodesy);
  const result = exploreVicinity({origin,radius:10,records:rows,bands:['33'],geodesy});
  assert.equal(result.matching,1); assert.equal(result.shown[0].km,0);
  assert.ok(geodesy.distanceKm(...origin.at,...edge) > 9.9999);
  assert.match(result.statement,/connectivity unknown/);
  assert.equal('edges' in result,false);
});
test('radius geometry uses canonical destinationPoint and retains actual point coordinates', () => {
  const rows = stationRecords([feature('A',[-0.11,51.5],'33000')],geodesy);
  const result = exploreVicinity({origin,radius:50,records:rows,bands:['33'],geodesy});
  const geo = vicinityGeoJSON(result,geodesy), boundary = geo.features[0];
  assert.equal(boundary.properties.kind,'radius'); assert.equal(boundary.geometry.coordinates.length,97);
  for (const at of boundary.geometry.coordinates) assert.ok(Math.abs(geodesy.distanceKm(...origin.at,...at)-50)<1e-8);
  assert.deepEqual(geo.features[2].geometry.coordinates,[-0.11,51.5]);
  assert.equal(geo.features.filter(f=>f.geometry.type==='LineString').length,1,'radius boundary only; no inferred circuit');
});
test('module source rebuild is deterministic, generation stamped, bounded and syntactically valid', () => {
  const first=assemble({generation:'202611180100'}),second=assemble({generation:'202611180100'});
  assert.equal(first.body,second.body); assert.equal(first.sha256,second.sha256); assert.ok(first.bytes<48000);
  new vm.Script(first.body); assert.match(first.body,/USER_ASSUMED_LOCAL_MODEL/);
  assert.equal(VOLTAGE_BANDS.length,8); assert.throws(()=>assemble({generation:'../bad'}));
});
