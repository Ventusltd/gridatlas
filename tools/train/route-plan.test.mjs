import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildRoutePlan} from './src/route-plan.mjs';
import {trainLearningFixture} from './fixtures/learning-networks.mjs';
const geodesy = {distanceKm: (a,b,c,d) => Math.hypot(c-a,d-b)*100};
const stop = (id,kv=400) => ({source:'SYNTHETIC_TEST',stationId:id,at:[id.charCodeAt(0)/100,51],kv});
const context = {window:{}}; vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../../atlas/modules/202609012245-electrical-distance.js',import.meta.url),'utf8'),context);
const electricalDistance = context.window.__GRIDATLAS_MODULES__.electricalDistance;
function network(removeTransformer=false) {
  const nodes={A:400,AL:132,BL:132,B:400,C:132,D:400,E:400,F:400,Z:400};
  const rows=[['A','AL','transformer'],['AL','BL','circuit'],['BL','B','transformer'],
    ['A','D','circuit'],['D','E','circuit'],['E','F','circuit'],['F','B','circuit'],
    ...(!removeTransformer?[['B','C','transformer']]:[])].map(([node_1,node_2,kind],i)=>({node_1,node_2,kind,id:'row-'+i}));
  const graph={schema:'gridatlas.module.network-topology.graph.v1',has:n=>n in nodes,
    nodeVoltageKv:n=>nodes[n],nodeSiteCode:n=>n,nodesOfSite:n=>n in nodes?[n]:[],
    edgesAt:n=>rows.filter(r=>r.node_1===n||r.node_2===n).map(row=>({kind:row.kind,row,far:row.node_1===n?'node_2':'node_1'})),
    ratingsOf:()=>null,parametersOf:()=>null};
  return {index:{graph:()=>graph,site:code=>code in nodes?{code,name:code}:null},electricalDistance,
    stationBindings:Object.fromEntries(Object.keys(nodes).map(id=>[id,{stationId:id,siteCode:id,reviewed:true,source:'SYNTHETIC_REVIEW_LEDGER'}])),
    isReviewedEdge:()=>true,rows};
}
test('400-only filters every node before shortest-path search and chooses longer all-400 route',()=>{
 const n=network(), before=JSON.stringify(n.rows);
 const p=buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B')],geodesy,network:n,rules:{allowedVoltages:[400],allowTransformers:true}});
 assert.equal(p.legs[0].topology.hops,4);assert.equal(p.legs[0].evidence,'TOPOLOGY_ONLY');
 assert.ok(p.legs[0].topology.path.every(h=>h.from_voltage_kv===400&&h.to_voltage_kv===400));assert.equal(JSON.stringify(n.rows),before);
});
test('mixed allowed voltages require the explicitly reviewed transformer; removing it refuses',()=>{
 const options={stops:[stop('B'),stop('C',132)],geodesy,rules:{allowedVoltages:[400,132],allowTransformers:true}};
 assert.equal(buildRoutePlan({synthetic:true,...options,network:network()}).legs[0].topology.path[0].kind,'transformer');
 assert.equal(buildRoutePlan({synthetic:true,...options,network:network(true),allowSimulated:true}).legs[0].evidence,'MISSING');
 assert.equal(buildRoutePlan({synthetic:true,...options,network:network(),rules:{...options.rules,allowTransformers:false}}).legs[0].evidence,'MISSING');
 const n=network();n.isReviewedEdge=e=>e.kind!=='transformer';
 assert.equal(buildRoutePlan({synthetic:true,...options,network:n}).legs[0].evidence,'MISSING');
});
test('disconnected same-voltage pair needs explicit hypothetical opt-in and never edits source graph',()=>{
 const n=network(), opts={stops:[stop('A'),stop('Z')],geodesy,network:n};
 assert.equal(buildRoutePlan({synthetic:true,...opts}).playable,false);const before=JSON.stringify(n.rows);
 const p=buildRoutePlan({synthetic:true,...opts,allowSimulated:true});assert.equal(p.legs[0].evidence,'SIMULATED');assert.match(p.legs[0].label,/not a cable/);assert.equal(JSON.stringify(n.rows),before);
});
test('registry site-name proximity is insufficient; unknown voltage cannot simulate a conversion',()=>{
 const n=network();n.stationBindings.A.reviewed=false;
 assert.equal(buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B')],geodesy,network:n}).legs[0].evidence,'MISSING');
 assert.equal(buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B',132)],geodesy,allowSimulated:true}).playable,false);
});
test('geometry needs exact circuit identity, direction and reviewed join; topology stays schematic otherwise',()=>{
 const n=network(),opts={stops:[stop('D'),stop('E')],geodesy,network:n,rules:{allowedVoltages:[400]}};
 n.geometryByCircuit={'row-4':{reviewed:true,source:'SYNTHETIC_GIS',circuitId:'wrong',fromNode:'D',toNode:'E',geometry:{type:'LineString',coordinates:[[0,51],[1,51]]}}};
 assert.equal(buildRoutePlan({synthetic:true,...opts}).legs[0].evidence,'TOPOLOGY_ONLY');n.geometryByCircuit['row-4'].circuitId='row-4';
 assert.equal(buildRoutePlan({synthetic:true,...opts}).legs[0].evidence,'GIS_REVIEWED');
});
test('ordered required visits/revisits and all original teaching presets use the same opt-in planner',()=>{
 for(const kind of ['local','express','branch']){const f=trainLearningFixture(kind);assert.equal(buildRoutePlan({synthetic:true,...f,geodesy}).playable,false);assert.equal(buildRoutePlan({synthetic:true,...f,geodesy,allowSimulated:true}).playable,true);}
 assert.throws(()=>buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B')],geodesy,law:{allowedVoltageBands:['400'],mustVisitStationIds:['B','A'],fallback:'documented-only'}}),/declared order/);
});
test('production stations require canonical membership and points; selected voltage must be source-declared',()=>{
 const a={id:'source-a',stationId:'source-a',at:[-1,51],kv:[400,132]},b={id:'source-b',stationId:'source-b',at:[0,51],kv:[132]};
 const index={get:id=>id===a.id?a:id===b.id?b:null},opts={stops:[a,b],stationIndex:index,geodesy,allowSimulated:true};
 const p=buildRoutePlan(opts);assert.equal(p.legs[0].simulationVoltageKv,132);assert.equal(p.legs[0].accessStatus,'UNKNOWN');assert.equal(p.legs[0].surveyConstructability,'UNKNOWN');
 assert.equal(buildRoutePlan({...opts,stops:[{...a,selectedVoltageKv:400},b]}).playable,false);
 assert.throws(()=>buildRoutePlan({...opts,stops:[{...a,selectedVoltageKv:275},b]}),/canonical station/);
 assert.throws(()=>buildRoutePlan({...opts,stops:[{...a,at:[3,51]},b]}),/canonical station/);
 assert.throws(()=>buildRoutePlan({...opts,stops:[{...a,id:'repd:2470',stationId:'repd:2470'},b]}),/canonical station/);
});
test('crossed source-looking line geometry cannot establish topology or land rights without reviewed edges',()=>{
 const n=network();n.isReviewedEdge=()=>false;
 n.geometryByCircuit={crossing:{reviewed:true,source:'SOURCE_GIS',circuitId:'crossing',geometry:{type:'LineString',coordinates:[[0,50],[2,52]]}}};
 const p=buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B')],geodesy,network:n});
 assert.equal(p.legs[0].evidence,'MISSING');assert.equal(p.legs[0].geometry,'UNKNOWN');assert.equal(p.legs[0].electricalTopology,'UNKNOWN');assert.equal(p.legs[0].accessStatus,'UNKNOWN');
});
test('two selected stops may traverse more than ninety source nodes; selected caps are not traversal caps',()=>{
 const rows=Array.from({length:100},(_,i)=>({node_1:'N'+i,node_2:'N'+(i+1),id:'c'+i}));
 const graph={schema:'gridatlas.module.network-topology.graph.v1',has:n=>/^N(?:\d|\d\d|100)$/.test(n),
  nodeVoltageKv:()=>400,nodeSiteCode:n=>n,nodesOfSite:n=>[n],ratingsOf:()=>null,parametersOf:()=>null,
  edgesAt:n=>rows.filter(r=>r.node_1===n||r.node_2===n).map(row=>({kind:'circuit',row,far:row.node_1===n?'node_2':'node_1'}))};
 const network={index:{graph:()=>graph,site:code=>({code,name:code})},electricalDistance,isReviewedEdge:()=>true,
  stationBindings:Object.fromEntries(['N0','N100'].map(id=>[id,{stationId:id,siteCode:id,reviewed:true,source:'SYNTHETIC_LEDGER'}]))};
 const p=buildRoutePlan({synthetic:true,stops:[stop('N0'),stop('N100')],network,geodesy});
 assert.equal(p.stops.length,2);assert.equal(p.legs[0].topology.hops,100);
});
test('whole-leg verification refuses a provider result that escapes the eligible voltage view',()=>{
 const n=network();n.electricalDistance={between:()=>({schema:'gridatlas.module.electrical-distance.v1',reached:true,from:{code:'A'},to:{code:'B'},path:[{from_node:'A',to_node:'AL',kind:'transformer'},{from_node:'AL',to_node:'B',kind:'circuit'}]})};
 const p=buildRoutePlan({synthetic:true,stops:[stop('A'),stop('B')],network:n,geodesy,rules:{allowedVoltages:[400],allowTransformers:true}});
 assert.equal(p.legs[0].evidence,'MISSING');assert.equal(p.playable,false);
});
