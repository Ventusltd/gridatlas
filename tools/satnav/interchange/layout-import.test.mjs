import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.deepEqual(result.features[0], feature('LineString',[A,B],{satnavRole:'planned-route', type:'export_cable'}));
  result.features[0].geometry.coordinates[0][0] = 0;
  assert.deepEqual(snapshot, original);
  for (const status of ['empty','editing','ambiguous','invalid','unavailable']) {
    assert.throws(() => readLayout({ ...snapshot, status }));
  }
});

test('walks the export cable in a full GIS SLD engineering file without connecting equipment points', () => {
  const equipments = Array.from({length: 52}, () => feature('Point', C, {type: 'central_inverter'}));
  const data = collection(
    ...equipments,
    feature('Point', A, {type: 'poi', selected_substation_name: 'Test grid node'}),
    feature('LineString', [B, C], {type: '33kv_radial', role: 'collector_trunk'}),
    feature('LineString', [A, B], {type: '33kv_radial', role: 'block_branch'}),
    feature('Point', C, {type: 'export_cable_pin', pin_index: 1, committed_to_route: true}),
    feature('Polygon', [[A, B, C, A]], {type: 'array_boundary', fin_total_capex_gbp: 100}),
    feature('LineString', [A, C, B], {type: 'export_cable', routed_by_pins: true}),
    fix(B, 100),
  );
  const before = structuredClone(data);
  const result = readLayout(data);
  const choices = layoutChoices(result);
  assert.equal(choices[0].label, 'Export cable 1');
  assert.equal(choices.some(c => c.role === 'waypoints'), false);
  const names = choices.map(c => c.label);
  for (const label of ['Test grid node', 'Central inverter 52', '33 kV collector trunk 1',
           '33 kV block branch 1', 'Cable pin 1', 'Array boundary 1']) assert.ok(names.includes(label));
  let selected;
  walkLayoutChoice({replacePlan: points => { selected = points; }}, result, choices[0]);
  assert.deepEqual(selected, [A, C, B]);
  assert.deepEqual(readLayout(JSON.stringify(result)), result);
  assert.deepEqual(data, before);
  assert.ok(!JSON.stringify(result).includes('fin_total_capex_gbp'));
});

test('recognised GIS electrical roles cannot promote a measured track or bypass other role checks', () => {
  const measured = feature('LineString', [A, B], {
    type: '33kv_radial', role: 'collector_trunk', satnavRole: 'walked-track',
    timestampMs: [5, 8],
  });
  assert.deepEqual(layoutChoices(readLayout(measured)), []);
  for (const props of [
    {type: '33kv_radial', role: 'walked-track', satnavRole: 'planned-route'},
    {type: 'export_cable', role: 'collector_trunk'},
    {type: '33kv_radial', role: 'unrecognised'},
  ]) assert.throws(() => readLayout(feature('LineString', [A, B], props)));
});

test('round-trips a financial sandbox drawing exported by the native pinned scripts', () => {
  // Synthetic controls, two central inverter blocks and one committed cable pin.
  // gis-sld-v5-drawing.js fd8e16f and gis-sld-v5-export.js 619f4f9, release 202609052024.
  const raw = JSON.parse(readFileSync(new URL('./fixtures/native-gis-sld.geojson', import.meta.url), 'utf8'));
  const cable = raw.features.find(f=>f.properties.type === 'export_cable');
  assert.equal(raw.features.length, 15);
  const result = readLayout(raw);
  const choices = layoutChoices(result);
  assert.deepEqual(choices[0], {index:2, label:'Export cable 1', role:'planned-route'});
  assert.ok(choices.some(c=>c.label === '33 kV collector trunk 1'));
  assert.ok(choices.some(c=>c.label === '33 kV block branch 2'));
  assert.ok(choices.some(c=>c.label === 'Central inverter 2'));
  assert.equal(choices.some(c=>c.role === 'waypoints'), false);
  let plan;
  walkLayoutChoice({replacePlan: points=>{plan=points;}},result,choices[0]);
  assert.deepEqual(plan,cable.geometry.coordinates);
  assert.deepEqual(readLayout(JSON.stringify(result)),result);
  assert.ok(!JSON.stringify(result).includes('fin_total_capex_gbp'));
  raw.features.push(feature('LineString',[A,C],{type:'33kv_projection_only'}),feature('Point',B));
  const extended = readLayout(raw);
  assert.equal(layoutChoices(extended).some(c=>c.index === 15 || c.role === 'waypoints'),false);
  assert.throws(()=>walkLayoutChoice({},extended,{index:15}),/design/);
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
  assert.deepEqual(got.features[3], feature('Point',A,{ satnavRole:'walked-fix',timestampMs:10,accuracyM:3,order:0 }));
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
    feature('Point',A,{ satnavRole:'walked-fix',accuracyM:-1 }),
    feature('LineString',[A,B],{ satnavRole:'walked-track',timestampMs:[20,10],accuracyM:[1,1] }),
    { ...item, crs:projected }, {...snapshot, route:{...snapshot.route,crs:projected}},
    { ...item,geometry:{...item.geometry,crs:projected}},
    { type:'FeatureCollection',features:[] }, {type:'GeometryCollection',geometries:[]},
  ]) assert.throws(() => readLayout(file));
  assert.deepEqual(readLayout({...item,crs:{type:'name',properties:{name:'OGC:CRS84'}}}), readLayout(item));
});

test('a measured fix with unknown accuracy remains a recorded point', () => {
  const recorded = readLayout(feature('Point', A, { role: 'walked-fix', timestamp: 230 }));
  assert.deepEqual(recorded.features[0].properties, {satnavRole:'walked-fix',timestampMs:230});
  assert.deepEqual(layoutChoices(recorded), []);
});

test('orders source pins by explicit order and a singleton by its global recorded sample index', () => {
  const data = collection(feature('Point',B,{role:'waypoint',order:1}),feature('Point',A,{role:'waypoint',order:0}),
    feature('LineString',[A,B],{role:'walked-track'}),feature('Point',C,{role:'walked-fix',order:2,timestamp:40,accuracy:3}));
  const result = readLayout(data);
  assert.deepEqual(result.features.slice(0,2).map(f=>f.geometry.coordinates),[A,B]);
  assert.deepEqual(result.features[3].properties, {satnavRole:'walked-fix',order:2,timestampMs:40,accuracyM:3});
});

test('labels the separate GIS export cable and radial circuit for selection', () => {
  const result = readLayout(collection(feature('LineString',[A,B],{type:'export_cable'}),
    feature('LineString',[B,C],{type:'33kv_radial'})));
  assert.deepEqual(layoutChoices(result).map(choice=>choice.label), ['Export cable 1','33 kV radial 1']);
});

test('supports the full 20,000-pin design, its line and 20,000 recorded positions together', () => {
  const route = Array.from({length:20000},(_,i)=>[i/1000,50]);
  const track = feature('LineString',route,{satnavRole:'walked-track'});
  const pins = route.map(at => feature('Point', at));
  const layout = readLayout(collection(...pins,feature('LineString',route),track));
  assert.equal(layout.features.length,20002);
  assert.throws(() => readLayout(collection(...layout.features, track)), /20,000/);
});
