import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOpticalFeed,describeOpticalFeedEvidence} from '../../atlas/labs/lightning-grid/feed-contract.mjs';

const NOW=Date.parse('2026-10-27T02:30:00Z');
const feature=(id,time='2026-10-27T00:30:00Z',lon=-4.2,lat=55.4)=>({
  type:'Feature',id,geometry:{type:'Point',coordinates:[lon,lat]},
  properties:{time_utc:time,observation_kind:'optical_lightning_flash'}
});
const source=(features,meta={})=>({
  type:'FeatureCollection',features,
  metadata:{retention_days:7,
    query_start_utc:'2026-10-26T22:00:00Z',
    query_end_utc:'2026-10-27T01:00:00Z',...meta}
});

test('F01: real optical source fields accepted with authentic identity, UTC and recent query',()=>{
  const r=parseOpticalFeed(source([feature('real-1')]),{nowMs:NOW});
  assert.equal(r.observations.length,1);
  assert.equal(r.observations[0].id,'real-1');
  assert.equal(r.evidence.query_freshness,'RECENT_QUERY');
  assert.equal(r.evidence.latest_detection_utc,'2026-10-27T00:30:00.000Z');
});
test('F02: recent query is NOT a verified seven-day search, and no quiet hours become zero',()=>{
  const r=parseOpticalFeed(source([feature('real-1')]),{nowMs:NOW});
  assert.equal(r.evidence.cumulative_coverage,'UNKNOWN');
  assert.equal(r.evidence.unobserved_interval,'UNKNOWN');
  assert.match(describeOpticalFeedEvidence(r.evidence),/UNKNOWN, not zero/);
  assert.doesNotMatch(describeOpticalFeedEvidence(r.evidence),/100% searched|full coverage/i);
});
test('F03: stale collector query is conspicuous but an old genuine flash remains selectable',()=>{
  const r=parseOpticalFeed(source([feature('real-1','2026-10-25T11:15:58Z')],
    {query_start_utc:'2026-10-25T09:00:00Z',query_end_utc:'2026-10-25T12:00:00Z'}),{nowMs:NOW});
  assert.equal(r.observations.length,1);
  assert.equal(r.evidence.query_freshness,'STALE_QUERY');
  assert.match(describeOpticalFeedEvidence(r.evidence),/STALE COLLECTOR QUERY/);
});
test('F04: invalid point, future observation, non-optical and absent identity are quarantined',()=>{
  const badPoint=feature('bad-point');badPoint.geometry.coordinates=[-181,55];
  const future=feature('future','2026-10-28T00:30:00Z');
  const nonOptical=feature('ground-strike');nonOptical.properties.observation_kind='ground_strike';
  const missing=feature('');
  const r=parseOpticalFeed(source([feature('real-1'),badPoint,future,nonOptical,missing]),{nowMs:NOW});
  assert.deepEqual(r.observations.map(x=>x.id),['real-1']);
  assert.equal(r.evidence.rejected,4);
  assert.match(describeOpticalFeedEvidence(r.evidence),/SOURCE WARNINGS/);
});
test('F05: identical source IDs are deduplicated, conflicting IDs are quarantined',()=>{
  const a=feature('same'),b=feature('same'),c=feature('conflict');
  const d=feature('conflict','2026-10-27T00:35:00Z');
  const r=parseOpticalFeed(source([a,b,c,d,feature('good')]),{nowMs:NOW});
  assert.deepEqual(r.observations.map(x=>x.id).sort(),['good','same']);
  assert.equal(r.evidence.duplicates,2);
  assert.equal(r.evidence.conflicting_ids,1);
});
test('F06: a feed containing only invalid observations is UNKNOWN, not a fabricated zero',()=>{
  const invalid=feature('invalid');invalid.geometry.coordinates=[1000,95];
  assert.throws(()=>parseOpticalFeed(source([invalid]),{nowMs:NOW}),/UNKNOWN, not zero/);
});
test('F07: future-dated or inverted collector query metadata cannot masquerade as fresh',()=>{
  assert.throws(()=>parseOpticalFeed(source([feature('a')],{query_end_utc:'2026-10-28T00:00:00Z'}),{nowMs:NOW}),/future/);
  assert.throws(()=>parseOpticalFeed(source([feature('a')],{
    query_start_utc:'2026-10-27T01:30:00Z',query_end_utc:'2026-10-27T01:00:00Z'
  }),{nowMs:NOW}),/inverted/);
});
test('F08: missing query timestamp remains UNKNOWN, even when optical observations exist',()=>{
  const r=parseOpticalFeed(source([feature('a')],{
    query_start_utc:undefined,query_end_utc:undefined
  }),{nowMs:NOW});
  assert.equal(r.evidence.query_freshness,'QUERY_TIME_UNKNOWN');
  assert.match(describeOpticalFeedEvidence(r.evidence),/QUERY FRESHNESS UNKNOWN/);
});
test('F09: malformed or non-UTC time and feature collections cannot be promoted',()=>{
  const bad=feature('local','2026-10-27T00:30:00');
  assert.throws(()=>parseOpticalFeed(source([bad]),{nowMs:NOW}),/UNKNOWN, not zero/);
  assert.throws(()=>parseOpticalFeed({features:[]},{nowMs:NOW}),/FeatureCollection/);
});
test('F10: actual source can have an old latest flash but a recent collector query',()=>{
  const r=parseOpticalFeed(source([feature('real-1','2026-10-25T11:15:58Z')]),{nowMs:NOW});
  assert.equal(r.evidence.query_freshness,'RECENT_QUERY');
  assert.equal(r.evidence.latest_detection_utc,'2026-10-25T11:15:58.000Z');
  assert.match(describeOpticalFeedEvidence(r.evidence),/Latest collector query ended: 2026-10-27/);
});
