import test from 'node:test';
import assert from 'node:assert/strict';
import { readLayout, layoutChoices, walkLayoutChoice } from './layout-import.mjs';
import { exportGeoJSON as legacySurvey } from './geojson-interchange.mjs';

const A = [-1.1, 52], B = [-1.101, 52.001], C = [-1.102, 52];
const feature = (type, coordinates, properties = {}) => ({ type: 'Feature', geometry: { type, coordinates }, properties });
const collection = (...features) => ({ type: 'FeatureCollection', features });
const snapshot = {
  schema: 'ventus.gis-route.v1', status: 'available', committed: true, pins: [{ financialOnly: true }],
  route: feature('LineString', [A, B], {type: 'export_cable', export_cable_length_km: 0.14, measurement_method: 'manual'}),
};
const fix = (coords, timestampMs) => feature('Point', coords, { satnavRole: 'walked-fix', timestampMs, accuracyM: 4 });

test('reads the GIS snapshot route and preserves the finance model', () => {
  const original = structuredClone(snapshot);
  const result = readLayout(snapshot);
  assert.deepEqual(result.features[0], feature('LineString',[A,B],{satnavRole:'planned-route'}));
  result.features[0].geometry.coordinates[0][0] = 0;
  assert.deepEqual(snapshot, original);
  for (const status of ['empty','editing','ambiguous','invalid','unavailable']) {
    assert.throws(() => readLayout({ ...snapshot, status }));
  }
});

test('ordered waypoints, selected cable and perimeter become plans; individual point changes TO', () => {
  const layout = readLayout(collection(feature('Point', A, { name: 'Start' }), feature('Point', B),
    feature('LineString', [B,C]), feature('Polygon', [[A,B,C,A]])));
  const choices = layoutChoices(layout);
  const applied = [];
  const survey = { setDestination: p => applied.push(['to',p]), replacePlan: p => applied.push(['plan',p]) };
  for (const i of [0,1,3,4]) walkLayoutChoice(survey, layout, choices[i]);
  assert.deepEqual(applied, [['plan',[A,B]],['to',A],['plan',[B,C]],['plan',[A,B,C,A]]]);
  applied[1][1][0] = 0;
  assert.deepEqual(layout.features[0].geometry.coordinates, A);
});

test('retains separate recorded segments and exact singletons through a GeoJSON round trip', () => {
  const survey = collection(feature('LineString',[A,B],{satnavRole:'planned-route',name:'Cable'}),
    feature('LineString',[A,B],{satnavRole:'walked-track',timestampMs:[100,102],accuracyM:[4,5]}),
    fix(C,150));
  const actual = readLayout(survey);
  assert.deepEqual(readLayout(JSON.stringify(actual)), survey);
  assert.deepEqual(layoutChoices(actual).map(c=>c.label),['Cable']);
  for (const index of [1,2]) assert.throws(() => walkLayoutChoice({},actual,{index}), /design/);
  assert.deepEqual(layoutChoices(readLayout(fix(C,150))), []);
});

test('imports original ordered-fix survey codec without promoting fixes to design points', () => {
  const file = legacySurvey({ pins:[A,B], plannedRoute:[A,B], walkedTrack:[
    { coordinate:A, timestamp:10, accuracy:3 }, { coordinate:C, timestamp:20, accuracy:4 },
  ]});
  file.features.reverse();
  const got = readLayout(file);
  assert.deepEqual(got.features.map(f=>f.properties.satnavRole),['waypoint','waypoint','planned-route','walked-fix','walked-fix']);
  assert.deepEqual(got.features[3], feature('Point',A,{ satnavRole:'walked-fix',timestampMs:10,accuracyM:3 }));
  assert.deepEqual(readLayout(JSON.stringify(got)), got);
});

test('rejects ambiguous or invalid geometry, roles, IDs, measurement and reference systems', () => {
  const item = feature('Point', A);
  const projected = {type:'name',properties:{name:'EPSG:27700'}};
  for (const file of [
    feature('Point',[1,100]),
    feature('Polygon',[[A,B,C,A],[A,B,C,A]]),
    collection({...item,id:4},{...item,id:4}),
    feature('Point',A,{ satnavRole:'waypoint',role:'walked-fix',timestamp:1,accuracy:4 }),
    feature('Point',A,{ satnavRole:'walked-fix',accuracyM:4 }),
    feature('LineString',[A,B],{ satnavRole:'walked-track',timestampMs:[20,10],accuracyM:[1,1] }),
    { ...item, crs:projected }, {...snapshot, route:{...snapshot.route,crs:projected}},
    { ...item,geometry:{...item.geometry,crs:projected}},
    { type:'FeatureCollection',features:[] }, {type:'GeometryCollection',geometries:[]},
  ]) assert.throws(() => readLayout(file));
  assert.deepEqual(readLayout({...item,crs:{type:'name',properties:{name:'OGC:CRS84'}}}), readLayout(item));
});

test('combined survey file may exceed 20,000 positions without exceeding the 64,000 total', () => {
  const route = Array.from({length:20000},(_,i)=>[i/1000,50]);
  const track = feature('LineString',route,{satnavRole:'walked-track'});
  const layout = readLayout(collection(feature('LineString',route),track,track));
  assert.equal(layout.features.length,3);
  assert.throws(() => readLayout(collection(...layout.features, feature('LineString',route))), /64,000/);
});
