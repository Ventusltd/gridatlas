#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/* Two generations, deliberately, because they are two different things.
   CONTRACT_GENERATION is the gazetteer contract's own stamp: the file
   ui/cartridges/202609040337-global-gazetteer-flyto-v9-106.mjs, which
   current.json still names because the behavioural promise has not changed.
   The COMPOSITION is whatever is live, and it is READ from current.json below
   rather than typed here. This proof used to pin the composition to the same
   literal and assert current.generation equalled it - true for one generation
   and false for every one after, so from v9.109 onwards it failed on that
   line and never reached its mobile, state, scope and line-ending checks. An
   external reviewer (2026-09-04) caught it: "the failed proof is stale, not
   evidence that v9.116 is broken." recompose.mjs carries proofs named after a
   cartridge forward; this one is named after a corpus, so nobody restamped
   it. Anchoring to current.json cannot go stale at all. */
const CONTRACT_GENERATION = '202609040337';
const PIPELINE_COMMIT = '3493be1c4ebf3dabbc94135db17f433bb7892a8e';
const RELEASE = 'releases/202609040144-pipelinenews';
const SPINE_REL = `${RELEASE}/data/202608270055-8ab1807551bc-v8-fast-projects.json`;
const WIDER_REL = `${RELEASE}/data/202609040044-wider-fleet.json`;
const SENDER_REL = `${RELEASE}/assets/202609040044-atlas-pointer-deep-link.mjs`;
const PARQUET = path.join(ROOT, 'data', 'repd_projects_202608290716.parquet');
const PLACE = path.join(ROOT, 'atlas', 'parts',
  '202609040229-place-global-search-arrival-identity.js');
const ENGINE = path.join(ROOT, 'atlas', 'parts',
  '202609040229-ventus-corev8engine-exact-repd-delegation.js');
const SLD = path.join(ROOT, 'atlas', 'parts',
  '202609040229-sld-sandbox-arrival-identity.js');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const candidates = [
  process.env.PIPELINENEWS_REPO,
  path.resolve(ROOT, 'pipelinenews'),
  path.resolve(ROOT, '..', 'pipelinenews'),
  path.resolve(ROOT, '..', 'pipeline-browser-proof-route'),
].filter(Boolean);
const pipeline = candidates.find((candidate) =>
  existsSync(path.join(candidate, SPINE_REL))
  && existsSync(path.join(candidate, WIDER_REL))
  && existsSync(path.join(candidate, SENDER_REL)));
assert.ok(pipeline, `exact Pipeline 0144 corpus not found beside ${ROOT}`);

/* The producer commit must be IN the neighbouring checkout's history - not
   BE its HEAD. This asserted HEAD === PIPELINE_COMMIT, which demanded that a
   whole other repository never advance, and failed the moment it did (a
   fast-forward of 45 commits on 2026-09-04). The property that protects the
   corpus is the one already asserted below and beneath: each corpus file
   exists at the producer commit, and its served bytes match a recorded
   SHA-256. An ancestor check keeps the provenance; the byte hashes keep the
   content; neither breaks when a colleague pulls. */
const git = spawnSync('git', ['-C', pipeline, 'merge-base', '--is-ancestor', PIPELINE_COMMIT, 'HEAD'],
  { encoding: 'utf8' });
assert.equal(git.status, 0,
  `Pipeline producer commit ${PIPELINE_COMMIT.slice(0, 8)} is not in the checkout's history`
  + (git.stderr ? `: ${git.stderr.trim()}` : ''));
for (const relativePath of [SPINE_REL, WIDER_REL, SENDER_REL]) {
  const object = spawnSync('git', ['-C', pipeline, 'cat-file', '-e',
    `${PIPELINE_COMMIT}:${relativePath}`], { encoding: 'utf8' });
  assert.equal(object.status, 0,
    `${relativePath} is not owned by exact Pipeline commit ${PIPELINE_COMMIT}`);
}

const spinePath = path.join(pipeline, SPINE_REL);
const widerPath = path.join(pipeline, WIDER_REL);
const senderPath = path.join(pipeline, SENDER_REL);
const [spineBytes, widerBytes, senderBytes, parquetBytes, placeSource,
  engineSource, sldSource] = await Promise.all([
  readFile(spinePath), readFile(widerPath), readFile(senderPath), readFile(PARQUET),
  readFile(PLACE, 'utf8'), readFile(ENGINE, 'utf8'), readFile(SLD, 'utf8')
]);
assert.equal(spineBytes.length, 979338);
assert.equal(sha256(spineBytes), 'c06aedef176d2d38fd135806306a8ef81b4af9994c7be31e8bd760304149f862');
assert.equal(widerBytes.length, 219211);
assert.equal(sha256(widerBytes), '29966f9b5573295e8c7c3793b1950a336c50fbe7570ba63b83f237bb57271efe');
assert.equal(sha256(senderBytes), '7ab16bbc704324d177210dd45acd54a684018980df766bdebdd7689a0f7571ae');
assert.equal(parquetBytes.length, 1454200);
assert.equal(sha256(parquetBytes), '174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b');

const current = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const GENERATION = current.generation;
assert.match(GENERATION, /^\d{12}$/u, 'current.json must name a 12-digit UTC generation');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'manifests',
  `${GENERATION}-composition.json`), 'utf8'));
const contractSource = await readFile(path.join(ROOT, 'ui', 'cartridges',
  `${CONTRACT_GENERATION}-global-gazetteer-flyto-v9-106.mjs`), 'utf8');
assert.equal(manifest.generation, GENERATION);
// The live composition still binds the gazetteer lane to the contract this
// proof reads - the thing the old literal was actually protecting.
const gazetteer = current.cartridges.find(({ id }) => id === 'uk-gazetteer-flyto');
assert.ok(gazetteer, 'uk-gazetteer-flyto is not in the live composition');
assert.equal(gazetteer.contract,
  `../ui/cartridges/${CONTRACT_GENERATION}-global-gazetteer-flyto-v9-106.mjs`);
// A parent is an earlier clock reading, never a typed one; which earlier one
// is the composer's business, not this proof's.
assert.match(String(manifest.parent_generation), /^\d{12}$/u);
assert.ok(manifest.parent_generation < GENERATION, 'parent must precede the composition');
assert.equal(manifest.acceptance.pipeline_map_link_corpus.producer_commit, PIPELINE_COMMIT);
assert.equal(manifest.acceptance.pipeline_map_link_corpus.producer_release, RELEASE);
assert.equal(manifest.acceptance.pipeline_map_link_corpus.unique_clickable_refs, 8743);
assert.equal(manifest.acceptance.pipeline_map_link_corpus.not_in_active_register, 2430);
assert.doesNotMatch(JSON.stringify(manifest),
  /offshore-opens-a-card-and-withholds-the-measurement/u);
assert.doesNotMatch(JSON.stringify(manifest), /opens a card, draws no links/u);
assert.match(JSON.stringify(manifest), /offshore-measures-with-route-caveat/u);
assert.match(contractSource, new RegExp(`generation: '${CONTRACT_GENERATION}'`));
assert.match(contractSource, /sourceGeneration: '202609040229'/u);
assert.match(contractSource, /identityFailureRetryRequiresSharedArrivalEpoch: true/u);
assert.match(placeSource,
  /document\.documentElement\?\.dataset\?\.gridatlasGeneration \|\| SOURCE_GENERATION/u);

const senderSource = senderBytes.toString('utf8');
assert.match(senderSource, /"repd_ref", "project", "technology", "capacity_mw",\s*\n\s*"latitude", "longitude", "zoom"/u);
assert.doesNotMatch(senderSource, /url\.searchParams\.set\("status"/u,
  'Pipeline does not supply status; the receiver must not invent one');

const python = String.raw`
import json, sys, duckdb
sp=json.load(open(sys.argv[1],encoding='utf-8'))
wi=json.load(open(sys.argv[2],encoding='utf-8'))
ix={n:i for i,n in enumerate(sp['fields'])}
valid=[]
for row in sp['rows']:
  if sp['dictionaries']['geometry_status'][row[ix['geometry_status']]]=='valid':
    valid.append(str(row[ix['repd_ref']]))
wider=[]
for row in wi:
  seen=set()
  for rec in row.get('repd_records',[row]):
    ref=str(rec.get('ref','')).strip()
    if ref and ref not in seen:
      seen.add(ref); wider.append(ref)
active={str(row[0]) for row in duckdb.connect().execute(
  'select repd_ref from read_parquet(?)',[sys.argv[3]]).fetchall()}
spine=set(valid); wide=set(wider); clickable=spine|wide
print(json.dumps({
  'spine':len(valid),'wider':len(wider),'clickable':len(clickable),
  'absent':len(clickable-active),'present':len(clickable&active),
  'spine_absent':len(spine-active),'wider_absent':len(wide-active),
  'wider_absent_refs':sorted(wide-active,key=int)
}))
`;
function runPython(executable) {
  return spawnSync(executable, ['-c', python, spinePath, widerPath, PARQUET],
    { encoding: 'utf8' });
}
let census = runPython(process.platform === 'win32' ? 'python' : 'python3');
if (census.error?.code === 'ENOENT') census = runPython('python');
assert.equal(census.status, 0,
  `exact corpus/Parquet census failed: ${census.stderr || census.error || ''}`);
const counts = JSON.parse(census.stdout);
assert.deepEqual(counts, {
  spine: 7652,
  wider: 1091,
  clickable: 8743,
  absent: 2430,
  present: 6313,
  spine_absent: 2419,
  wider_absent: 11,
  wider_absent_refs: [
    '8423', '10874', '11062', '11236', '12047', '12660',
    '12686', '13781', '16263', '16515', '20121'
  ]
});

const ownerStart = placeSource.indexOf('  function arrivalCoordinator()');
const ownerEnd = placeSource.indexOf('  function escapeHtml(', ownerStart);
const start = placeSource.indexOf('  function suppliedArrivalFields(');
const end = placeSource.indexOf('  function bindSearch()', start);
const gateStart = sldSource.indexOf('  function createArrivalGate()');
const gateEnd = sldSource.indexOf('  link.enableSubstationLayer =', gateStart);
assert.ok(ownerStart >= 0 && ownerEnd > ownerStart,
  'place-owner cancellation helpers not found');
assert.ok(start >= 0 && end > start, 'exact receiver functions not found');
assert.ok(gateStart >= 0 && gateEnd > gateStart,
  'shared production arrival gate not found');
const ownerFunctions = placeSource.slice(ownerStart, ownerEnd);
const receiverFunctions = placeSource.slice(start, end);
const gateFunctions = sldSource.slice(gateStart, gateEnd);

async function receiverScenario(search, {
  rows = [], queryError = null, retryRows = null,
  interruptReason = null, claimAgain = false
} = {}) {
  const state = { failures: [], last_selection: null, query_count: 0,
    identity_retry_count: 0,
    deep_link: { status: 'IDLE', repd_ref: null } };
  const input = { value: '' };
  const resultsEl = {};
  const body = { dataset: {} };
  const events = { renders: 0, errors: 0, selections: 0,
    flyTo: 0, popups: 0, sharedClaimEpoch: null,
    queryAttempts: 0, runtimeResets: 0 };
  const listeners = new Map();
  const testLink = { measure: {}, arrival_reconciliation: null };
  class ProofCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  const testWindow = {
    location: { search, href: `https://globalgrid2050.com/atlas/${search}` },
    __GRIDATLAS_NEON_LINKS__: testLink,
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
      return true;
    }
  };
  const context = vm.createContext({
    state, URLSearchParams,
    window: testWindow,
    document: { body },
    CustomEvent: ProofCustomEvent,
    testLink,
    invariant(ok, message) { if (!ok) throw new Error(message); },
    async queryOfficialRepd(_query, _serial, stillOwned) {
      events.queryAttempts += 1;
      if (claimAgain) {
        events.sharedClaimEpoch = testLink.measure.claimPendingArrival(search);
      }
      if (interruptReason) testLink.measure.invalidatePendingArrival(interruptReason);
      if (queryError && events.queryAttempts === 1) throw queryError;
      if (stillOwned && !stillOwned()) return [];
      state.query_count += 1;
      return events.queryAttempts > 1 && retryRows ? retryRows : rows;
    },
    async resetOfficialRuntime() { events.runtimeResets += 1; },
    renderResults() { events.renders += 1; },
    async waitForCapturedMap() {},
    selectResult(result, options = {}) {
      if (!testLink.measure.arrivalGate.isCurrent(options.deepLinkEpoch)) return false;
      events.selections += 1;
      events.flyTo += 1;
      events.popups += 1;
      state.last_selection = { repd_ref: result.repd_ref, mapped: true };
      return true;
    },
    hasSafeMapPoint(result) {
      return Number.isFinite(result.longitude) && Number.isFinite(result.latitude)
        && Math.abs(result.longitude) <= 180 && Math.abs(result.latitude) <= 90
        && !(Math.abs(result.longitude) < 1e-12 && Math.abs(result.latitude) < 1e-12);
    },
    console: { error() { events.errors += 1; } }
  });
  vm.runInContext(`let activeQuerySerial = 0; const link = testLink;\n`
    + `${gateFunctions}\n${ownerFunctions}\n${receiverFunctions}\n`
    + 'this.receive = receiveExactRepdDeepLink; this.retry = retryExactRepdDeepLink;', context);
  await context.receive(input, resultsEl);
  const beforeRetry = { ...state.deep_link };
  if (retryRows) {
    const invalidatedEpoch = testLink.measure.invalidatePendingArrival('identity-retry');
    const retryEpoch = testLink.measure.claimPendingArrival(search);
    events.retryEpoch = retryEpoch;
    events.retryInvalidatedEpoch = invalidatedEpoch;
    await context.retry(input, resultsEl, retryEpoch);
  }
  return { state, input, body, events, beforeRetry,
    gate: testLink.measure.arrivalGate.snapshot() };
}

const missingUrl = '?repd_ref=12453&project=Thorpe+Marsh+Power+Station+-+Battery+Energy+Storage'
  + '&technology=bess&capacity_mw=1450&latitude=53.5802575&longitude=-1.0850616&zoom=12';
const missing = await receiverScenario(missingUrl, { claimAgain: true });
assert.equal(missing.state.deep_link.status, 'NOT_IN_ACTIVE_REGISTER');
assert.equal(missing.state.deep_link.repd_ref, '12453');
assert.equal(missing.state.deep_link.name,
  'Thorpe Marsh Power Station - Battery Energy Storage');
assert.equal(missing.state.deep_link.technology, 'bess');
assert.equal(missing.state.deep_link.capacity_mw, 1450);
assert.equal(missing.state.deep_link.supplied_status, null);
assert.equal(missing.state.deep_link.supplied_point_usable, true);
assert.equal(missing.state.deep_link.identity_source, 'ARRIVAL_LINK');
assert.equal(missing.state.failures.length, 0);
assert.equal(missing.events.errors, 0);
assert.equal(missing.events.selections, 0);
assert.equal(missing.events.sharedClaimEpoch, missing.state.deep_link.owner_epoch,
  'the place and measurement owners share one keyed epoch');
assert.equal(missing.body.dataset.gridatlasRepdDeepLink, 'not-in-active-register');

const suppliedStatus = await receiverScenario(missingUrl + '&status=Revised');
assert.equal(suppliedStatus.state.deep_link.status, 'NOT_IN_ACTIVE_REGISTER');
assert.equal(suppliedStatus.state.deep_link.supplied_status, 'Revised');
assert.equal(suppliedStatus.state.deep_link.identity_source, 'ARRIVAL_LINK');

const official = {
  repd_ref: '12588', name: 'Botley West', technology: 'solar',
  capacity_mw: 840, status: 'application submitted', postcode: 'OX29',
  longitude: -1.3489728, latitude: 51.8132088
};
const resolved = await receiverScenario('?repd_ref=12588', { rows: [official] });
assert.equal(resolved.state.deep_link.status, 'RESOLVED');
assert.equal(resolved.state.deep_link.identity_source, 'OFFICIAL_ACTIVE_REGISTER');
assert.equal(resolved.state.deep_link.status_value, 'application submitted');
assert.equal(resolved.events.selections, 1);

const failure = await receiverScenario(missingUrl,
  { queryError: new Error('Parquet network unavailable') });
assert.equal(failure.state.deep_link.status, 'FAILED');
assert.equal(failure.state.deep_link.identity_source, 'ACTIVE_REGISTER_CHECK_FAILED');
assert.equal(failure.state.deep_link.repd_ref, '12453');
assert.match(failure.state.deep_link.message, /Parquet network unavailable/u);
assert.equal(failure.state.failures.length, 1);
assert.equal(failure.events.errors, 1);

const recovered = await receiverScenario('?repd_ref=12588', {
  queryError: new Error('induced first manifest failure'), retryRows: [official]
});
assert.equal(recovered.beforeRetry.status, 'FAILED');
assert.equal(recovered.state.deep_link.status, 'RESOLVED');
assert.equal(recovered.events.queryAttempts, 2);
assert.equal(recovered.events.runtimeResets, 1);
assert.equal(recovered.state.query_count, 1);
assert.equal(recovered.events.selections, 1);
assert.equal(recovered.state.deep_link.owner_epoch, recovered.events.retryEpoch,
  'retry owner must consume the one epoch claimed by its orchestrator');
assert.ok(recovered.events.retryEpoch > recovered.beforeRetry.owner_epoch,
  'retry must claim a fresh shared arrival epoch');

const lateOfficial = {
  repd_ref: '12453', name: 'Wrong late result', technology: 'bess',
  capacity_mw: 1450, status: 'revised', postcode: '',
  longitude: -1.0850616, latitude: 53.5802575
};
for (const reason of ['new-selection', 'history-navigation', 'user-search-input']) {
  const abandoned = await receiverScenario(missingUrl, {
    rows: [lateOfficial], interruptReason: reason
  });
  assert.equal(abandoned.state.deep_link.status, 'CANCELLED', reason);
  assert.equal(abandoned.state.deep_link.cancelled_by, reason, reason);
  assert.equal(abandoned.events.renders, 0, `${reason}: stale results rendered`);
  assert.equal(abandoned.events.selections, 0, `${reason}: stale result selected`);
  assert.equal(abandoned.events.flyTo, 0, `${reason}: stale result flew the map`);
  assert.equal(abandoned.events.popups, 0, `${reason}: stale result opened a popup`);
  assert.equal(abandoned.events.errors, 0, `${reason}: cancellation became an error`);
  assert.equal(abandoned.body.dataset.gridatlasRepdDeepLink, 'cancelled', reason);
}

assert.match(engineSource, /status: 'DEFERRED_TO_EXACT_REPD_RECEIVER'/u);
assert.match(engineSource, /technology: requestedTechnology \|\| null/u);
assert.doesNotMatch(engineSource, /canonical project technology is invalid/u,
  'a ref-only arrival must delegate without becoming a console error');
assert.match(engineSource, /legacy_fetches: 0/u);
assert.doesNotMatch(engineSource, /\/uk_renewables_pipeline\//u,
  'the GridAtlas-domain legacy receiver must issue no Pipeline-domain request');
assert.match(sldSource, /dl\.status === 'NOT_IN_ACTIVE_REGISTER'/u);
assert.match(sldSource, /link-supplied-not-in-active-register/u);
assert.match(sldSource, /Card and point built from the arrival link/u);
assert.match(sldSource, /Status supplied by arrival link/u);
assert.match(sldSource, /showStatus\('The active-register identity check failed'/u);
assert.match(sldSource, /owner\?\.status === 'NOT_IN_ACTIVE_REGISTER'/u);
assert.match(sldSource, /No official status or location is inferred/u);
assert.match(sldSource, /owner\?\.status === 'CANCELLED'/u);
assert.match(placeSource, /state\.retry_exact_deep_link = \(ownerEpoch\) =>/u);
assert.match(placeSource, /receiveExactRepdDeepLink\(input, resultsEl, ownerEpoch\)/u);
assert.match(sldSource, /retryArrival = retryIdentityOwnerThenArrival/u);
assert.match(sldSource, /const retryEpoch = claimPendingArrival\(window\.location\.search\)/u);
assert.match(sldSource, /await owner\.retry_exact_deep_link\(retryEpoch\)/u);
assert.match(sldSource, /await rerunDeepLink\(retryEpoch\)/u);

console.log(JSON.stringify({
  status: 'PASS',
  pipeline_commit: PIPELINE_COMMIT,
  corpus: counts,
  active_register_parquet: {
    bytes: parquetBytes.length,
    sha256: sha256(parquetBytes)
  },
  negative: {
    repd_ref: missing.state.deep_link.repd_ref,
    state: missing.state.deep_link.status,
    point_retained: missing.state.deep_link.supplied_point_usable,
    console_errors: missing.events.errors
  },
  positive: {
    repd_ref: resolved.state.deep_link.repd_ref,
    state: resolved.state.deep_link.status,
    identity_source: resolved.state.deep_link.identity_source
  },
  true_failure: failure.state.deep_link.status,
  retry_recovery: {
    from: recovered.beforeRetry.status,
    to: recovered.state.deep_link.status,
    query_attempts: recovered.events.queryAttempts,
    query_count: recovered.state.query_count,
    fresh_epoch: recovered.state.deep_link.owner_epoch > recovered.beforeRetry.owner_epoch,
    shared_epoch: recovered.state.deep_link.owner_epoch === recovered.events.retryEpoch
  },
  stale_owner_races: ['new-selection', 'history-navigation', 'user-search-input'],
  legacy_pipeline_requests: 0
}, null, 2));
