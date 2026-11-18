import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {DOCUMENT_CONTEXT_PROVENANCE, DOCUMENT_CONTEXT_NOTICES, documentContextFor} from './src/document-context.mjs';

const source = fs.readFileSync(new URL('../../atlas/modules/202609012128-declared-connections.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const context = {window: {__GRIDATLAS_MODULES__: {geodesy: {distanceKm() { throw Error('No distance calculation permitted'); }}}}};
vm.runInNewContext(source, context);
const canonical = context.window.__GRIDATLAS_MODULES__.declaredConnections;

test('canonical declaration input matches its immutable provenance pin', () => {
  const pin = DOCUMENT_CONTEXT_PROVENANCE.declaredModule;
  assert.equal(Buffer.byteLength(source), pin.bytes);
  assert.equal(createHash('sha256').update(source).digest('hex'), pin.sha256);
  assert.match(pin.sourceUrl, new RegExp('/blob/' + pin.commit + '/'));
});
test('exact REPD owner keys reuse declared works without promoting or mutating owner classification', () => {
  const before = JSON.stringify(canonical.records['14806']);
  const result = documentContextFor({type: 'repd', id: 'repd:14806'}, {declaredConnections: canonical});
  assert.equal(result.matchedRecords.length, 1);
  const record = result.matchedRecords[0];
  assert.equal(record.declaredStatus, 'not_built');
  assert.equal(record.declaration.poc_status_note, canonical.records['14806'].poc_status_note);
  assert.equal(record.sourceTitle, canonical.records['14806'].source);
  assert.equal(record.verifiedAssetAssociation, false);
  assert.equal(record.status, 'EXISTING_PUBLISHED_DECLARATION_UNREVALIDATED');
  assert.equal(result.verifiedAssetJoins, 0);
  assert.equal(JSON.stringify(canonical.records['14806']), before);
});
test('absent status, dates, capacity and inferred electrical connections stay unknown', () => {
  const result = documentContextFor({type: 'repd', id: 'repd:10914'}, {declaredConnections: canonical});
  const record = result.matchedRecords[0];
  assert.equal(record.declaredStatus, null);
  assert.equal(record.date, null);
  assert.equal(record.datePrecision, 'UNKNOWN');
  assert.equal(Object.hasOwn(record, 'capacityMw'), false);
  assert.equal(result.realConnectionsInferred, 0);
});
test('nearby coordinates, matching names and a different asset type do not produce joins', () => {
  for (const origin of [{type: 'substation', id: 'grid_substations:14806', name: 'High Marnham Substation', at: [-0.8, 53]}, {type: 'datacentre', id: '14806'}, {type: 'repd', id: 'repd:2470', name: 'Sea Link'}, {type: 'repd', id: 'repd:014806'}]) {
    assert.equal(documentContextFor(origin, {declaredConnections: canonical}).matchedRecords.length, 0);
  }
});
test('missing or unsupported identity and an absent canonical owner module give explicit gaps', () => {
  for (const origin of [null, {type: 'location', id: '14806'}, {type: 'repd', id: 14806}, {type: 'repd', id: 'repd:14806\n'}]) {
    const result = documentContextFor(origin, {declaredConnections: canonical});
    assert.equal(result.origin, null);
    assert.equal(result.matchedRecords.length, 0);
    assert.match(result.limitations[0], /stable source identity/);
  }
  assert.equal(documentContextFor({type: 'repd', id: 'repd:14806'}).matchedRecords.length, 0);
});
test('inherited source arrays or wrong module schemas cannot supply an exact declaration', () => {
  const inherited = Object.create({'14806': canonical.records['14806']});
  assert.equal(documentContextFor({type: 'repd', id: 'repd:14806'}, {declaredConnections: {schema: canonical.schema, records: inherited}}).matchedRecords.length, 0);
  assert.equal(documentContextFor({type: 'repd', id: 'repd:14806'}, {declaredConnections: {schema: 'other', records: canonical.records}}).matchedRecords.length, 0);
});
test('Sea Link stays standalone even when an origin has the same name or location', () => {
  const result = documentContextFor({type: 'substation', id: 'unmatched', name: 'Sea Link', at: [1.5, 52]});
  assert.equal(result.unassociatedNotices.length, 1);
  const notice = result.unassociatedNotices[0];
  assert.equal(notice.applicationRef, 'EN020026');
  assert.equal(notice.verifiedAssetJoins, 0);
  for (const key of ['currentCapacityMw', 'commissioned', 'connection', 'repdRef', 'coordinates']) assert.equal(notice[key], null);
  assert.deepEqual(notice.date, {value: '2026-10-30', precision: 'DAY'});
  assert.equal(notice.plannedMetric.kind, 'planned_transmission_upper_bound');
  assert.equal(notice.plannedMetric.value, 2000);
  assert.match(notice.scope, /No association/);
});
test('two government sources preserve historical hashes and qualify changed current HTML separately', () => {
  const notice = DOCUMENT_CONTEXT_NOTICES[0];
  assert.equal(notice.sources.length, 2);
  for (const source of notice.sources) {
    assert.equal(new URL(source.url).origin, 'https://www.gov.uk');
    assert.equal(source.sourceUpdatedAt, null);
    assert.notEqual(source.archivedReceipt.sha256, source.currentObservation.sha256);
    assert.match(source.currentObservation.scope, /differs from archived/);
    assert.equal(source.archivedReceipt.bytes, source.currentObservation.bytes);
  }
  assert.equal(notice.rightsScope, 'government_html_facts_only_no_images_or_third_party_material');
  assert.equal(DOCUMENT_CONTEXT_PROVENANCE.noticeProducer.reviewReferences.length, 2);
});
test('output and source metadata are immutable and contain no generated route geometry', () => {
  const result = documentContextFor({type: 'repd', id: 'repd:10914'}, {declaredConnections: canonical});
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.matchedRecords[0].declaration), true);
  assert.throws(() => { result.matchedRecords[0].declaration.source = 'changed'; });
  assert.equal(Object.hasOwn(result, 'geometry'), false);
});
test('every pinned owner declaration retains its exact source fields, including circuit and unbuilt cases', () => {
  const refs = Object.keys(canonical.records);
  assert.equal(refs.length, 19, 'Source records, not unique schemes or physical upgrades');
  for (const ref of refs) {
    const result = documentContextFor({type: 'repd', id: 'repd:' + ref}, {declaredConnections: canonical});
    assert.equal(result.matchedRecords.length, 1, ref);
    const record = result.matchedRecords[0], raw = canonical.records[ref];
    for (const key of Object.keys(raw)) assert.equal(record.declaration[key], raw[key], ref + ':' + key);
    assert.equal(record.declaredStatus, raw.poc_status ?? null);
    assert.equal(result.counts.verifiedAssetJoins, 0);
  }
});
