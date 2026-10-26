#!/usr/bin/env node
/**
 * Independent, non-destructive STATIC reviewer for GridAtlas lightning candidates.
 * This is not a browser test or a release/veto verdict. No files are changed.
 * Run from repo root: node tools/proofs/chatgpt-lightning-static-review.mjs [GENERATION]
 * Origin: https://github.com/Ventusltd/gridatlas/issues/32
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const gen = process.argv[2] || '202610261949';
if (!/^[0-9]{12}$/.test(gen)) throw new Error('generation must be 12 digits');
const root = process.cwd();
const read = p => readFileSync(resolve(root, p));
const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const report = [];
function check(name, fn) {
  try { fn(); report.push({ result: 'PASS_STATIC', name }); }
  catch (error) { report.push({ result: 'FAIL_STATIC', name, error: error.message }); }
}
function warning(name, condition, description) {
  if (condition) report.push({ result: 'NEEDS_DYNAMIC_TEST', name, description });
}
const live = JSON.parse(read('atlas/current.json').toString());
const candidateDir = 'atlas/v/' + gen;
const candidate = JSON.parse(read(candidateDir + '/current.json').toString());
const overlayPath = 'atlas/modules/' + gen + '-uk-lightning-overlay.js';
const carPath = 'atlas/cartridges/' + gen + '-sld-sandbox-v9-8.js';
const overlay = read(overlayPath);
const overlayText = overlay.toString();
const originalPath = 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js';

check('live generation retained', () => assert.equal(live.generation, '202609241334'));
check('candidate names chosen generation', () => assert.equal(candidate.generation, gen));
check('candidate points back to live generation', () => assert.equal(candidate.previous_generation, '202609241334'));
check('original composer and candidate loader are byte-identical', () =>
  assert.ok(read('atlas/index.html').equals(read(candidateDir + '/index.html'))));
check('all four original live cartridges hash to live pointer', () => {
  assert.equal(live.cartridges.length, 4);
  for (const entry of live.cartridges) {
    const source = read(resolve('atlas', entry.path));
    assert.equal(sha256(source), entry.sha256, 'live cartridge: ' + entry.id);
  }
});
check('no fifth cartridge slot', () => assert.equal(candidate.cartridges.length, live.cartridges.length));
check('three unaffected candidate cartridge hashes equal original', () => {
  for (const entry of live.cartridges) {
    if (entry.id === 'sld-sandbox') continue;
    const row = candidate.cartridges.find(x => x.id === entry.id);
    assert.ok(row, 'missing original ' + entry.id);
    assert.equal(row.sha256, entry.sha256);
  }
});
check('candidate is strictly original bytes + LF + one module', () => {
  const a = read(originalPath), b = read(carPath);
  const exact = Buffer.concat([a, Buffer.from('\n'), overlay]);
  assert.ok(b.equals(exact), 'appended cartridge not exact delta');
});
check('candidate cartridge hash matches candidate composition', () => {
  const entry = candidate.cartridges.find(x => x.id === 'sld-sandbox');
  assert.ok(entry, 'sld-sandbox missing');
  assert.equal(entry.sha256, sha256(read(carPath)));
});
check('new cartridge stays under 460000-byte ceiling', () => assert.ok(read(carPath).length <= 460000));
check('overlay stays under 24000-byte ceiling', () => assert.ok(overlay.length <= 24000));
check('overlay avoids original config mutations and global fetch overwrite', () => {
  for (const pattern of [/\bukConfig\b/, /\binitVentusMap\b/, /window\.fetch\s*=/,
    /data-(?:layer-id|pn-layer|gridatlas-layer-proxy|gridatlas-layer-key)\s*=/]) {
    assert.ok(!pattern.test(overlayText), 'forbidden pattern: ' + pattern);
  }
});
check('source attribution and unknown-does-not-mean-zero remain in code', () => {
  assert.match(overlayText, /not confirmed ground strikes/);
  assert.match(overlayText, /unknown, not zero/);
  assert.match(overlayText, /EUMETSAT/);
});
check('data/archive requests use original raw endpoint', () => {
  assert.match(overlayText, /raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/history\//);
  assert.match(overlayText, /XMLHttpRequest/);
});
check('OFF state is initial and selected source/layer is controlled', () => {
  assert.match(overlayText, /on:false/);
  assert.match(overlayText, /removeLayer/);
  assert.match(overlayText, /removeSource/);
});

// These WARNINGS are intentional adversarial questions. Source inspection alone
// cannot substitute for testing them with Playwright, network fixtures and a real device.
warning('W01 rolling live feed may remain cached across 10-minute refresh',
  /S\.fp\s*\|\|\s*\(S\.fp\s*=\s*gx\(FEED\)/.test(overlayText) &&
  /if\(refresh\)S\.ip=null/.test(overlayText) &&
  !/if\(refresh\)[^\n]*S\.fp=null/.test(overlayText),
  'The refresh resets the index promise but apparently not the successful fallback feed promise. Reproduce with changing feed fixtures and advance fake time.');
warning('W02 live feed has no explicit freshness classifier',
  /stale:\s*!!\(r\.idx&&stale/.test(overlayText),
  'If mode=feed and idx=null, STALE is always false regardless of last ingestion. Test a >24-hour-old feed.');
warning('W03 coordinate/bounds validation incomplete',
  /f\.geometry\.type===.Point./.test(overlayText) &&
  !/geometry\.coordinates\[[01]\]/.test(overlayText),
  'Point type and timestamp are checked; malformed/out-of-UK lon/lat must be rejected and tested.');
warning('W04 shard bytes/hash/count metadata not cross-validated',
  /o\.metadata\.date_utc!==date/.test(overlayText) &&
  !/sha256\s*\(/.test(overlayText),
  'Do not infer that an index-to-shard hash/size/count mismatch has been verified just because index v2 stores those fields.');
const failed = report.filter(x => x.result === 'FAIL_STATIC');
for (const item of report) console.log(item.result + ': ' + item.name + (item.error ? ' — ' + item.error : ''));
console.log(JSON.stringify({ kind: 'static-source-review-only', generation: gen, source_bytes: overlay.length,
  cartridge_bytes: read(carPath).length, static_pass: report.filter(x => x.result === 'PASS_STATIC').length,
  static_fail: failed.length, needs_dynamic_test: report.filter(x => x.result === 'NEEDS_DYNAMIC_TEST').length,
  warnings: report.filter(x => x.result === 'NEEDS_DYNAMIC_TEST') }, null, 2));
if (failed.length) process.exitCode = 1;
