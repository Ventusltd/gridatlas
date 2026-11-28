import assert from 'node:assert/strict';
import test from 'node:test';
import {editableCoordinates, readSurveyLayout} from './interchange.mjs';

const a = [-0.1, 51.50], b = [-0.11, 51.51], c = [-0.10, 51.51];
const feature = (type, coordinates, properties = {}) => ({type: 'Feature', geometry: {type, coordinates}, properties});
const collection = (...features) => ({type: 'FeatureCollection', features});
const legacyFix = (point, order, timestamp) => feature('Point', point, {role: 'walked-fix', accuracy: 3, timestamp, order});

test('legacy GPS fix roundtrips as a single measured sample, separate from editable pins', () => {
  const data = {...collection(legacyFix(a, 0, 10500), feature('Point', b, {role: 'waypoint', order: 0})), schema:'ventus.satnav.geojson.v1'};
  const parsed = readSurveyLayout(data);
  assert.deepEqual(parsed.features[0].properties, {satnavRole:'walked-fix', accuracyM:3, timestampMs:10500, order:0});
  assert.equal(editableCoordinates(parsed.features[0]), null);
  assert.deepEqual(editableCoordinates(parsed.features[1]), [b]);
  assert.deepEqual(readSurveyLayout(JSON.stringify(parsed)), parsed);
});

test('canonical recorded lines and singleton fixes remain separate across a recording break', () => {
  const data = collection(
    feature('LineString', [a,b], {satnavRole:'planned-route'}),
    feature('LineString', [b,c], {satnavRole:'walked-track', accuracyM:[2,5], timestampMs:[27000,28000]}),
    feature('Point', a, {satnavRole:'walked-fix', accuracyM:7, timestampMs:45000}),
  );
  const actual = readSurveyLayout(JSON.stringify(data));
  assert.deepEqual(actual, data);
  assert.deepEqual(actual.features.map(editableCoordinates), [[a,b], null, null]);
});

test('singleton track with unknown sample metadata keeps it absent or explicitly null', () => {
  const data=collection(feature('Point',a,{satnavRole:'walked-fix', timestampMs:null}));
  assert.deepEqual(readSurveyLayout(data),data);
});

test('editing accepts only line, perimeter and waypoint roles, preserving a separate source', () => {
  const polygon = feature('Polygon', [[a,b,c,a]], {role:'perimeter', name:'Site perimeter'});
  const vertices = editableCoordinates(polygon);
  assert.deepEqual(vertices,[a,b,c]);
  vertices[0][0]=0;
  assert.deepEqual(polygon.geometry.coordinates,[[a,b,c,a]]);
  assert.equal(editableCoordinates(feature('LineString',[a,b],{role:'walked-track'})),null);
  assert.deepEqual(editableCoordinates(feature('LineString',[a,b])),[a,b]);
});

test('legacy explicit order controls pin sequence and measured time sequence', () => {
  const ordered = readSurveyLayout(collection(
    legacyFix(c,1,20000), feature('Point',b,{role:'waypoint',order:1}),
    legacyFix(b,0,10000), feature('Point',a,{role:'waypoint',order:0}),
  ));
  assert.deepEqual(ordered.features.map(f=>f.geometry.coordinates), [b,a,c,b]);
  assert.throws(()=>readSurveyLayout(collection(legacyFix(a,0,200),legacyFix(b,1,100))),/time/);
  assert.throws(()=>readSurveyLayout(collection(legacyFix(a,0,100),legacyFix(b,0,200))),/order/);
});

test('ambiguous role and metadata are rejected without interpreting measurements as designs', () => {
  assert.throws(()=>readSurveyLayout(feature('Point',a,{role:'walked-fix',satnavRole:'waypoint'})),/Conflicting/);
  assert.throws(()=>readSurveyLayout(feature('LineString',[a,b],{role:'walked-fix'})),/ROLE/);
  assert.throws(()=>readSurveyLayout(feature('Point',a,{role:'unrecognised'})),/Unsupported/);
  assert.throws(()=>readSurveyLayout(feature('Point',a,{role:'walked-fix',timestamp:100,timestampMs:200})),/Conflicting/);
  assert.throws(()=>readSurveyLayout(feature('Point',a,{role:'walked-fix',accuracy:-1})),/metadata/);
});

test('read-only committed GIS SLD routes import without financial metadata', () => {
  const geometry={type:'LineString',coordinates:[a,b]};
  const snapshot={schema:'ventus.gis-route.v1',status:'available',committed:true,pins:[],route:{geometry},originalLengthKm:0.4};
  const parsed = readSurveyLayout(snapshot);
  assert.deepEqual(editableCoordinates(parsed.features[0]),[a,b]);
  assert.equal(parsed.features[0].properties.originalLengthKm,undefined);
  assert.throws(()=>readSurveyLayout({...snapshot,status:'editing'}),/UNAVAILABLE/);
});

test('cross-feature cap, geographic coordinates, ring and duplicate IDs are validated', () => {
  const first=feature('Point',a), second=feature('Point',b);
  const long=feature('LineString',Array.from({length:20000},()=>a));
  assert.throws(()=>readSurveyLayout(collection(long,feature('LineString',[a,b]))),/20,000/);
  assert.throws(()=>readSurveyLayout(collection({...first,id:1},{...second,id:1})),/Duplicate/);
  assert.throws(()=>readSurveyLayout({...collection(first),crs:{properties:{name:'EPSG:27700'}}}),/WGS84/);
  assert.throws(()=>readSurveyLayout(feature('Point',[40,91])),/WGS84/);
  assert.throws(()=>readSurveyLayout(feature('Polygon',[[a,b,c,b]])),/CLOSED/);
});

test('V3 singleton order counts the preceding samples in retained track segments', () => {
  const line = feature('LineString',[a,b],{satnavRole:'walked-track',role:'walked-track',timestampMs:[10,20],accuracyM:[3,4]});
  const point = feature('Point', c, {satnavRole:'walked-fix',role:'walked-fix',timestamp:30,timestampMs:30,accuracy:2,accuracyM:2,order:2});
  const result=readSurveyLayout(collection(line,point));
  assert.equal(result.features[1].properties.order,2);
  assert.deepEqual(result.features.map(editableCoordinates),[null,null]);
  assert.deepEqual(readSurveyLayout(JSON.stringify(result)),result);
  assert.throws(()=>readSurveyLayout(collection(line,{...point,properties:{...point.properties,order:0}})),/order/);
});

test('a full field recording can be imported together with its independent design', () => {
  const points=Array.from({length:20000},(_,i)=>[a[0]-i/100000000,a[1]]);
  const pins=points.map((p,i)=>feature('Point',p,{role:'waypoint',order:i}));
  const design=feature('LineString',points,{role:'planned-route'});
  const trace=feature('LineString',points,{satnavRole:'walked-track'});
  const combined=readSurveyLayout(collection(...pins,design,trace));
  assert.equal(combined.features.length,20002);
  assert.equal(editableCoordinates(combined.features.at(-1)),null);
  assert.throws(()=>readSurveyLayout(collection(trace,legacyFix(a,0,45000))),/20,000/);
});
