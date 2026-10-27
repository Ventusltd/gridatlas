// probe.mjs - opus-fix-designer independent harness for issue #32 findings H01-H05.
// HARNESS: self-fixture. Playwright 1.63 Chromium headless shell 153, viewport 1440x900, desktop (pointer fine).
// Host: a synthetic page at https://probe.test/host.html (secure context) that provides only what the overlay's
// ins() waits for (menuBar/pipeline flags, #scada-ui-container with one .key-group, #fs-curtain-keys, .gm-panel-body)
// and a recording stand-in for the MapLibre map (window.__GRIDATLAS_V9_MAP__). Real fetch, XMLHttpRequest,
// crypto.subtle, TextDecoder and DOM; real Playwright clicks on the overlay's own controls; raw.githubusercontent.com
// answered by page.route from an in-memory file map (SYNTHETIC records, labelled in every file) or from the lead's
// genuine fixture folders (read-only). Clock: page.clock.setFixedTime (timers real) or page.clock.install (timer test).
// It is NOT the Atlas page and NOT real MapLibre: it proves the overlay's data logic and captions, not layout.
// Usage: node probe.mjs <overlay.js> <label> [scenario-regex]
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [overlayPath, label = 'run', only = ''] = process.argv.slice(2);
if (!overlayPath) { console.error('usage: node probe.mjs <overlay.js> <label> [scenario-regex]'); process.exit(2); }
const SRC = readFileSync(overlayPath, 'utf8');
const SRC_SHA = createHash('sha256').update(SRC).digest('hex');
const FIX = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures';

const H = 36e5, D = 864e5;
const iso = t => new Date(t).toISOString();
const SYN = 'SYNTHETIC test record (opus-fix-designer harness); not an observation';
const flash = (id, t, coords = [-1.5, 52]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: coords },
  properties: { name: SYN, time_utc: iso(t), source: 'EUMETSAT', source_product: 'MTG LI L2-LFL', observation_kind: 'optical_lightning_flash' } });
const ser = o => Buffer.from(JSON.stringify(o) + '\n', 'utf8');
const sha = b => createHash('sha256').update(b).digest('hex');
const ymd = t => iso(t).slice(0, 10);

// live feed document (main collector shape; PR #2 adds scan_end_utc + published_at_utc)
function feedDoc(features, { qEnd, pub, scanEnd, undated } = {}) {
  const metadata = { synthetic_fixture: SYN, retention_days: 7, bounds_wsen: [-11, 49.5, 3, 61.5],
    latest_detection_utc: features.length ? features.map(f => f.properties.time_utc).sort().at(-1) : null };
  if (!undated) Object.assign(metadata, { query_start_utc: iso(qEnd - 3 * H), query_end_utc: iso(qEnd) });
  if (pub !== undefined) metadata.published_at_utc = iso(pub);
  if (scanEnd !== undefined) metadata.scan_end_utc = iso(scanEnd);
  return { type: 'FeatureCollection', metadata, features };
}

// archive v2: days = { 'YYYY-MM-DD': { features, sealed, override:{count,bytes,sha256}, tamper:(Buffer)=>Buffer, split:true, partOverride:{hh:{...}} } }
function archive({ gen, nextDue, days, scan, coverageStart }) {
  const files = {}, rows = [];
  for (const [date, d] of Object.entries(days).sort()) {
    const feats = d.features.slice().sort((a, b) => a.properties.time_utc.localeCompare(b.properties.time_utc));
    const [y, m, dd] = date.split('-');
    const row = { date, coverage: 'full', scanned_seconds: 86400, count: feats.length, sealed: !!d.sealed,
      first_observation_utc: feats[0]?.properties.time_utc ?? null, last_observation_utc: feats.at(-1)?.properties.time_utc ?? null };
    if (!feats.length) { Object.assign(row, { path: null, bytes: null, sha256: null }); rows.push(row); continue; }
    if (d.split) {
      const byHour = {};
      for (const f of feats) (byHour[f.properties.time_utc.slice(11, 13)] ||= []).push(f);
      row.parts = []; row.path = null; row.sha256 = null; row.bytes = 0;
      for (const [hh, list] of Object.entries(byHour).sort()) {
        const path = `days/${y}/${m}/${dd}/${hh}.json`;
        const body = ser({ schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection',
          metadata: { date_utc: date, hour_utc: hh, part_of_day: true, synthetic_fixture: SYN, count: list.length }, features: list });
        const part = { hour: hh, path, count: list.length, bytes: body.length, sha256: sha(body), ...(d.partOverride?.[hh] || {}) };
        files['history/' + path] = d.partTamper?.[hh] ? d.partTamper[hh](body) : body;
        row.parts.push(part); row.bytes += body.length;
      }
    } else {
      const path = `days/${y}/${m}/${dd}.json`;
      const body = ser({ schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection',
        metadata: { date_utc: date, synthetic_fixture: SYN, count: feats.length }, features: feats });
      Object.assign(row, { path, bytes: body.length, sha256: sha(body) }, d.override || {});
      files['history/' + path] = d.tamper ? d.tamper(body) : body;
    }
    rows.push(row);
  }
  files['history/index.json'] = ser({ schema: 'uk-lightning-history-index.v2', synthetic_fixture: SYN,
    observation: 'satellite optical lightning flashes, not ground strikes', generated_utc: iso(gen),
    next_update_due_utc: iso(nextDue ?? gen + 2 * H), cutoff_date_utc: '2025-10-26', collection_interval_hours: 1,
    coverage_start_utc: iso(coverageStart ?? Date.parse('2026-10-01T00:00:00Z')),
    scan_windows: scan.map(([s, e]) => ({ start_utc: iso(s), end_utc: iso(e), successful_runs: 1 })), days: rows });
  return files;
}

// a genuine fixture folder as a file map (read-only)
function fixtureFiles(variant) {
  const root = join(FIX, variant, 'data'), out = {};
  const walk = dir => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else out[relative(root, p)] = readFileSync(p); } };
  walk(root); return out;
}

const HOST = `<!doctype html><html><head><meta charset="utf-8"><title>overlay probe host (synthetic)</title></head><body style="background:#050505;color:#888">
<div id="scada-ui-container" style="height:820px;width:420px;overflow:auto"><div class="key-group"><div class="key-title">ORIGINAL GROUP (stand-in)</div></div></div>
<div id="fs-curtain-keys"></div>
<div id="gridatlas-menu-bar"><div class="gm-panel"><div class="gm-panel-body"></div></div></div>
<script>
window.__GRIDATLAS_MODULES__={menuBar:{installed:true}};window.__GRIDATLAS_PIPELINE_LAYERS__={installed:true};
(()=>{const sources=new Map(),layers=new Map(),log=[];
window.__probe={sources,layers,log};
window.__GRIDATLAS_V9_MAP__={
 addSource(id,o){sources.set(id,{options:o,data:o.data,setData(d){this.data=d;log.push(['setData',d.features.length])}});log.push(['addSource',id,!!o.cluster])},
 getSource(id){return sources.get(id)},addLayer(l){layers.set(l.id,JSON.parse(JSON.stringify(l)));log.push(['addLayer',l.id])},
 getLayer(id){return layers.get(id)},removeLayer(id){layers.delete(id);log.push(['removeLayer',id])},removeSource(id){sources.delete(id);log.push(['removeSource',id])},
 setLayoutProperty(id,k,v){const l=layers.get(id);if(l){l.layout=Object.assign({},l.layout,{[k]:v})}}};})();
</script></body></html>`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(page, fn, arg, what, timeout = 30000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() - t0 > timeout) throw new Error('timeout: ' + what);
    await sleep(40);
  }
}

async function boot(browser, { now, files, install = false }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const net = { log: [], files };
  page.on('pageerror', e => net.log.push({ pageerror: String(e) }));
  await context.route('https://probe.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HOST }));
  await context.route('https://raw.githubusercontent.com/**', async r => {
    const url = r.request().url(), m = url.match(/\/Ventusltd\/lightning\/main\/data\/(.+)$/), key = m ? m[1] : url;
    net.log.push({ key, type: r.request().resourceType(), cache: r.request().headers()['cache-control'] || '' });
    const body = net.files[key];
    const headers = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    if (!body) return r.fulfill({ status: 404, body: 'not found', headers: { ...headers, 'content-type': 'text/plain' } });
    return r.fulfill({ status: 200, body, headers: { ...headers, 'content-type': 'application/json' } });
  });
  if (install) await page.clock.install({ time: now }); else await page.clock.setFixedTime(now);
  await page.goto('https://probe.test/host.html');
  await page.addScriptTag({ content: SRC });
  if (install) await page.clock.runFor(1000);
  await waitFor(page, () => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, 'install');
  return { context, page, net };
}

const G = 'main';
const sel = s => `[data-lightning-group="${G}"] ${s}`;
async function settle(page) {
  await waitFor(page, s => { const l = document.querySelector(s); return l && !/\[LOAD\]/.test(l.textContent); }, sel('[data-lightning-label]'), 'settle');
}
async function clickToggle(page) { await page.click(sel('input[data-lightning-control="toggle"]')); }
async function clickPeriod(page, p) { await page.click(sel(`[data-lightning-period="${p}"]`)); await settle(page); }
async function snap(page) {
  return page.evaluate(g => {
    const root = document.querySelector(`[data-lightning-group="${g}"]`), cap = k => root.querySelector(`[data-cap="${k}"]`).textContent;
    const S = window.__GRIDATLAS_MODULES__.ukLightning.state, src = window.__probe.sources.get('gridatlas-lightning');
    const feats = src && src.data ? src.data.features : [];
    return { label: root.querySelector('[data-lightning-label]').textContent, status: root.querySelector('.status-dot').lastChild.textContent,
      caps: { window: cap('window'), actual: cap('actual'), flashes: cap('flashes'), refresh: cap('refresh'), searched: cap('searched'), warning: cap('warning') },
      drawn: src ? feats.length : null, drawnIds: feats.length <= 50 ? feats.map(f => String(f.id)) : `(${feats.length} ids)`,
      last: S.last, errors: S.errors.slice(), quarantined: S.res && S.res.q !== undefined ? S.res.q : null,
      pointsButtonVisible: !root.querySelector('[data-lightning-nav="points"]').hidden };
  }, G);
}
const hits = (net, key) => net.log.filter(x => x.key === key).length;

// ---------------------------------------------------------------- scenarios
const NOW = Date.parse('2026-10-26T13:30:00Z');
const scenarios = {};

// H01a: OFF -> ON in feed-fallback mode (index 404): the second ON must re-read the feed
scenarios.H01a_offon_feed = async browser => {
  const files = { 'uk_lightning.geojson': ser(feedDoc([flash('old', NOW - 2 * H)], { qEnd: NOW - 1 * H })) };
  const { context, page, net } = await boot(browser, { now: NOW, files });
  await clickToggle(page); await settle(page); const first = await snap(page); const feedA = hits(net, 'uk_lightning.geojson');
  await clickToggle(page);  // OFF
  files['uk_lightning.geojson'] = ser(feedDoc([flash('old', NOW - 2 * H), flash('new', NOW - 0.5 * H)], { qEnd: NOW }));
  await clickToggle(page); await settle(page); const second = await snap(page); const feedB = hits(net, 'uk_lightning.geojson');
  await context.close();
  return { finding: 'H01', bug: feedB === feedA || !second.drawnIds.includes('new'),
    obs: { feed_requests_after_first_on: feedA, feed_requests_after_second_on: feedB, first_drawn: first.drawnIds, second_drawn: second.drawnIds,
      second_label: second.label, second_flashes: second.caps.flashes, second_refresh: second.caps.refresh, net: net.log.map(x => x.key + ':' + x.type) } };
};

// H01b: the 10-minute interval (fake clock) in feed-fallback mode must re-read the feed
scenarios.H01b_timer_feed = async browser => {
  const files = { 'uk_lightning.geojson': ser(feedDoc([flash('old', NOW - 2 * H)], { qEnd: NOW - 1 * H })) };
  const { context, page, net } = await boot(browser, { now: NOW, files, install: true });
  await clickToggle(page); await settle(page); const feedA = hits(net, 'uk_lightning.geojson');
  files['uk_lightning.geojson'] = ser(feedDoc([flash('old', NOW - 2 * H), flash('new', NOW + 5 * 6e4)], { qEnd: NOW + 9 * 6e4 }));
  await page.clock.runFor(10 * 6e4 + 500);  // the overlay's setInterval(…, 6e5) fires once: ld(true)
  await settle(page); await sleep(300); await settle(page);
  const after = await snap(page), feedB = hits(net, 'uk_lightning.geojson'), idxB = hits(net, 'history/index.json');
  await context.close();
  return { finding: 'H01', bug: feedB === feedA || !after.drawnIds.includes('new'),
    obs: { feed_requests_before_tick: feedA, feed_requests_after_tick: feedB, index_requests_after_tick: idxB, drawn_after_tick: after.drawnIds, refresh_after: after.caps.refresh } };
};

// H01c: OFF -> ON with a published archive: is the index revalidated? (same cached-promise mechanism, index side)
scenarios.H01c_offon_index = async browser => {
  const d25 = [flash('a25', Date.parse('2026-10-25T15:00:00Z')), flash('b25', Date.parse('2026-10-25T10:00:00Z'))];
  const d26v1 = [flash('a26', NOW - 3 * H)], d26v2 = [flash('a26', NOW - 3 * H), flash('b26', NOW - 0.5 * H)];
  const scan = [[NOW - 3 * D, NOW]];
  const files = archive({ gen: NOW - 1 * H, days: { '2026-10-25': { features: d25, sealed: true }, '2026-10-26': { features: d26v1 } }, scan });
  const { context, page, net } = await boot(browser, { now: NOW, files });
  await clickToggle(page); await settle(page); const first = await snap(page); const idxA = hits(net, 'history/index.json');
  await clickToggle(page);
  Object.assign(files, archive({ gen: NOW - 0.1 * H, days: { '2026-10-25': { features: d25, sealed: true }, '2026-10-26': { features: d26v2 } }, scan }));
  await clickToggle(page); await settle(page); const second = await snap(page); const idxB = hits(net, 'history/index.json');
  await context.close();
  return { finding: 'H01 (index side)', bug: idxB === idxA || !second.drawnIds.includes('b26'),
    obs: { index_requests_after_first_on: idxA, index_requests_after_second_on: idxB, first_drawn: first.drawnIds, second_drawn: second.drawnIds,
      second_refresh: second.caps.refresh, second_flashes: second.caps.flashes } };
};

// H02: feed-fallback staleness. Spec applied: STALE when now - (published_at_utc || query_end_utc) > 4 h, or undated.
for (const [name, ageH, extra] of [['72h', 72, {}], ['25h', 25, {}], ['5h', 5, {}], ['2h_fresh', 2, {}], ['undated', null, { undated: true }],
  ['pr2_published_30h', 30, { pr2: true }]]) {
  scenarios['H02_feed_' + name] = async browser => {
    const qEnd = ageH === null ? NOW - 2 * H : NOW - ageH * H;
    const opts = extra.pr2 ? { qEnd, pub: qEnd, scanEnd: qEnd - 0.2 * H } : { qEnd, undated: !!extra.undated };
    const files = { 'uk_lightning.geojson': ser(feedDoc([flash('f1', qEnd - 1 * H)], opts)) };
    const { context, page } = await boot(browser, { now: NOW, files });
    await clickToggle(page); await settle(page); await clickPeriod(page, '7d');
    const s = await snap(page); await context.close();
    const expectStale = ageH === null || ageH > 4;
    const shown = /STALE/.test(s.label) || /STALE/.test(s.status) || /STALE/.test(s.caps.refresh);
    return { finding: 'H02', bug: expectStale !== shown, obs: { feed_age_h: ageH, expect_stale: expectStale, stale_shown: shown,
      label: s.label, status: s.status, refresh: s.caps.refresh, state: s.last && s.last.state, stale_flag: s.last && s.last.stale } };
  };
}
// H02 control: the archive index path already marks STALE (> 4 h): must hold before and after
scenarios.H02_control_index_5h = async browser => {
  const files = archive({ gen: NOW - 5 * H, nextDue: NOW + 1 * H, days: { '2026-10-26': { features: [flash('i1', NOW - 6 * H)] } }, scan: [[NOW - 3 * D, NOW]] });
  const { context, page } = await boot(browser, { now: NOW, files });
  await clickToggle(page); await settle(page); const s = await snap(page); await context.close();
  return { finding: 'H02 control', bug: !/STALE/.test(s.label), obs: { label: s.label, refresh: s.caps.refresh } };
};

// H03: bounds / malformed coordinates, through the feed and through an archive shard
const BAD = [['oob_pacific', [150, 10]], ['oob_lat95', [-1.5, 95]], ['oob_east', [3.000001, 55]], ['oob_west', [-11.5, 52]], ['oob_south', [0, 49.4]],
  ['null_lon', [null, 52]], ['str_lon', ['bad', 52]], ['numeric_strings', ['-1.5', '52']], ['empty', []], ['one_value', [0]], ['bool_lon', [true, 52]],
  ['object', { 0: -1.5, 1: 52 }], ['null_coords', null], ['string_coords', '-1.5,52'], ['nested', [[-1.5, 52]]]];
const GOOD = [['ok_centre', [-1.5, 52]], ['ok_sw_corner', [-11, 49.5]], ['ok_ne_corner', [3, 61.5]], ['ok_3d', [-1.5, 52, 0]]];
const h03Features = () => [...GOOD, ...BAD].map(([id, c], i) => flash(id, NOW - 2 * H + i * 6e4, c));
scenarios.H03_feed_bounds = async browser => {
  const files = { 'uk_lightning.geojson': ser(feedDoc(h03Features(), { qEnd: NOW - 0.5 * H })) };
  const { context, page } = await boot(browser, { now: NOW, files });
  await clickToggle(page); await settle(page); const s = await snap(page); await context.close();
  const badDrawn = s.drawnIds.filter(id => BAD.some(b => b[0] === id));
  return { finding: 'H03', bug: badDrawn.length > 0, obs: { drawn: s.drawn, bad_drawn: badDrawn, good_drawn: s.drawnIds.filter(id => GOOD.some(g => g[0] === id)),
    flashes: s.caps.flashes, warning: s.caps.warning, quarantined: s.quarantined, pageerrors: [] } };
};
scenarios.H03_shard_bounds = async browser => {
  const files = archive({ gen: NOW - 0.5 * H, days: { '2026-10-26': { features: h03Features() } }, scan: [[NOW - 3 * D, NOW]] });
  const { context, page } = await boot(browser, { now: NOW, files });
  await clickToggle(page); await settle(page); const s = await snap(page); await context.close();
  const badDrawn = s.drawnIds.filter(id => BAD.some(b => b[0] === id));
  return { finding: 'H03', bug: badDrawn.length > 0, obs: { drawn: s.drawn, bad_drawn: badDrawn, flashes: s.caps.flashes, warning: s.caps.warning,
    state: s.last && s.last.state, quarantined: s.quarantined } };
};

// H04: index count / bytes / sha256 versus the fetched shard bytes
const d25H04 = () => [flash('x1', Date.parse('2026-10-25T10:00:00Z')), flash('x2', Date.parse('2026-10-25T14:00:00Z')), flash('x3', Date.parse('2026-10-25T20:00:00Z'))];
const d26H04 = () => [flash('y1', Date.parse('2026-10-26T08:00:00Z')), flash('y2', Date.parse('2026-10-26T12:00:00Z'))];
const flipDigit = b => { const s = b.toString('utf8'), i = s.indexOf('"coordinates":[-1.5,52]'); return Buffer.from(s.slice(0, i) + '"coordinates":[-1.5,53]' + s.slice(i + 23), 'utf8'); };
for (const [name, mod, expectFail] of [
  ['control', {}, false],
  ['count', { override: { count: 5 } }, true],
  ['bytes', { overrideFn: r => ({ bytes: r.bytes + 1 }) }, true],
  ['sha256', { override: { sha256: '0'.repeat(64) } }, true],
  ['tampered_same_length', { tamper: flipDigit }, true],
  ['all_three', { override: { count: 999, bytes: 123456, sha256: '0'.repeat(64) } }, true],
  ['parts_control', { split: true }, false],
  ['parts_sha256', { split: true, partOverride: { '12': { sha256: 'f'.repeat(64) } } }, true]]) {
  scenarios['H04_' + name] = async browser => {
    const d26 = { features: d26H04(), ...mod };
    if (mod.overrideFn) { const probe = archive({ gen: NOW, days: { '2026-10-26': { features: d26H04() } }, scan: [] });
      const row = JSON.parse(probe['history/index.json']).days[0]; d26.override = mod.overrideFn(row); }
    const files = archive({ gen: NOW - 0.5 * H, days: { '2026-10-25': { features: d25H04(), sealed: true }, '2026-10-26': d26 }, scan: [[NOW - 3 * D, NOW]] });
    const { context, page } = await boot(browser, { now: NOW, files });
    await clickToggle(page); await settle(page); const s = await snap(page); await context.close();
    const failed = s.last && s.last.failures > 0;
    return { finding: 'H04', bug: expectFail ? !failed : failed, obs: { expect_fail: expectFail, state: s.last && s.last.state, failures: s.last && s.last.failures,
      drawn: s.drawn, status: s.status, warning: s.caps.warning, flashes: s.caps.flashes } };
  };
}

// H05: a 12 h window over two UTC dates, storm-sized, LOAD POINTS consent (budget skip path)
scenarios.H05_subday_whole_day = async browser => {
  const now = Date.parse('2026-10-26T06:00:00Z');
  const f25 = [], f26 = [];
  for (let i = 0; i < 4000; i++) f25.push(flash('p25-' + i, Date.parse('2026-10-25T00:00:00Z') + Math.floor(i * (18 * H) / 4000)));
  for (let i = 0; i < 1000; i++) f25.push(flash('q25-' + i, Date.parse('2026-10-25T18:00:00Z') + Math.floor(i * (6 * H) / 1000)));
  for (let i = 0; i < 45000; i++) f26.push(flash('r26-' + i, Date.parse('2026-10-26T00:00:00Z') + Math.floor(i * (6 * H) / 45000), [-1.5 + (i % 300) / 100, 52 + Math.floor(i / 300) / 100]));
  const files = archive({ gen: now - 0.5 * H, days: { '2026-10-25': { features: f25 }, '2026-10-26': { features: f26 } }, scan: [[now - 3 * D, now]] });
  const { context, page } = await boot(browser, { now, files });
  await clickToggle(page); await settle(page); await clickPeriod(page, '12h');
  const before = await snap(page);
  await page.click(sel('[data-lightning-nav="points"]')); await settle(page);
  const after = await snap(page); await context.close();
  return { finding: 'H05', bug: /archived in window/.test(after.caps.flashes) && /50,000/.test(after.caps.flashes),
    obs: { true_in_window: 46000, index_whole_day_sum: 50000, summary_label: before.label, summary_status: before.status, summary_flashes: before.caps.flashes, points_button_visible: before.pointsButtonVisible,
      after_window: after.caps.window, after_flashes: after.caps.flashes, after_label: after.label, after_state: after.last && after.last.state, drawn: after.drawn } };
};

// ------------------------------------------------ regression controls on the lead's genuine fixtures (read-only)
const GEN_NOW = Date.parse('2026-10-26T19:00:00Z');
scenarios.R_genuine_archive_7d = async browser => {
  const { context, page, net } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '7d'); const s = await snap(page); await context.close();
  return { finding: 'regression', bug: !(s.last && s.last.failures === 0 && s.drawn === 408), obs: { state: s.last.state, drawn: s.drawn, failures: s.last.failures,
    status: s.status, flashes: s.caps.flashes, warning: s.caps.warning, refresh: s.caps.refresh, requests: net.log.map(x => x.key) } };
};
scenarios.R_genuine_noindex_feed_7d = async browser => {
  const now = Date.parse('2026-10-26T14:00:00Z');
  const { context, page } = await boot(browser, { now, files: fixtureFiles('lightning-archive-no-index') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '7d'); const s = await snap(page); await context.close();
  return { finding: 'regression', bug: s.drawn !== 408, obs: { state: s.last.state, stale: s.last.stale, drawn: s.drawn, label: s.label, flashes: s.caps.flashes, refresh: s.caps.refresh, warning: s.caps.warning } };
};
scenarios.R_genuine_noindex_feed_7d_at_1900 = async browser => {
  const { context, page } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive-no-index') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '7d'); const s = await snap(page); await context.close();
  return { finding: 'regression (feed 5.9 h old)', bug: false, obs: { state: s.last.state, stale: s.last.stale, label: s.label, refresh: s.caps.refresh } };
};
scenarios.R_missing_shard_7d = async browser => {
  const { context, page } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive-missing-shard') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '7d'); const s = await snap(page); await context.close();
  return { finding: 'regression', bug: !(s.last.state === 'FAIL' && /2026-10-23 HTTP 404/.test(s.caps.warning)), obs: { state: s.last.state, drawn: s.drawn, status: s.status, warning: s.caps.warning } };
};
scenarios.R_big_count_30d_load_points = async browser => {
  const { context, page } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive-big-count') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '30d'); const summary = await snap(page);
  await page.click(sel('[data-lightning-nav="points"]')); await settle(page); const s = await snap(page); await context.close();
  return { finding: 'regression (fixture row 2026-10-23 has SYNTHETIC count/bytes)', bug: false,
    obs: { summary_flashes: summary.caps.flashes, state: s.last.state, drawn: s.drawn, status: s.status, flashes: s.caps.flashes, warning: s.caps.warning } };
};
scenarios.R_total_fail = async browser => {
  const { context, page } = await boot(browser, { now: NOW, files: {} });  // index 404 and feed 404
  await clickToggle(page); await settle(page); const s = await snap(page); await context.close();
  return { finding: 'regression', bug: s.last.state !== 'FAIL', obs: { state: s.last.state, label: s.label, status: s.status, caps: s.caps, drawn: s.drawn } };
};
scenarios.R_before_archive_custom = async browser => {
  const { context, page } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive') });
  await clickToggle(page); await settle(page);
  await page.click(sel('[data-lightning-period="custom"]'));
  await page.fill(sel('input[data-lightning-date="from"]'), '2025-01-01');
  await page.fill(sel('input[data-lightning-date="to"]'), '2025-01-02');
  await page.click(sel('[data-lightning-nav="apply"]')); await settle(page);
  const s = await snap(page); await context.close();
  return { finding: 'regression', bug: s.last.state !== 'BEFORE-ARCHIVE', obs: { state: s.last.state, label: s.label, status: s.status, caps: s.caps } };
};
scenarios.R_genuine_3m_overview = async browser => {
  const { context, page } = await boot(browser, { now: GEN_NOW, files: fixtureFiles('lightning-archive') });
  await clickToggle(page); await settle(page); await clickPeriod(page, '3m'); const s = await snap(page); await context.close();
  return { finding: 'regression', bug: s.last.mode !== 'overview', obs: { state: s.last.state, mode: s.last.mode, label: s.label, status: s.status, caps: s.caps, drawn: s.drawn } };
};
scenarios.R_off_no_traffic = async browser => {
  const { context, page, net } = await boot(browser, { now: NOW, files: fixtureFiles('lightning-archive') });
  await sleep(1500); const n = net.log.length, src = await page.evaluate(() => window.__probe.sources.size + window.__probe.layers.size);
  await context.close();
  return { finding: 'regression', bug: n !== 0 || src !== 0, obs: { requests_while_off: n, sources_plus_layers: src } };
};

// ---------------------------------------------------------------- run
const browser = await chromium.launch();
const results = { harness: 'self-fixture: Playwright 1.63 Chromium ' + browser.version() + ' headless, 1440x900, synthetic host https://probe.test/, page.route data, fixed clock',
  overlay: overlayPath, overlay_bytes: Buffer.byteLength(SRC), overlay_sha256: SRC_SHA, label, ran_utc: new Date().toISOString(), scenarios: {} };
for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !new RegExp(only).test(name)) continue;
  try { results.scenarios[name] = await fn(browser); }
  catch (e) { results.scenarios[name] = { error: String(e && e.stack || e) }; }
  const r = results.scenarios[name];
  console.log(`${name.padEnd(34)} ${r.error ? 'ERROR ' + r.error.split('\n')[0] : (r.bug ? 'BUG-PRESENT' : 'ok         ')}  ${r.error ? '' : JSON.stringify(r.obs).slice(0, 330)}`);
}
await browser.close();
mkdirSync(join(here, 'results'), { recursive: true });
writeFileSync(join(here, 'results', label + '.json'), JSON.stringify(results, null, 1));
console.log(`overlay ${overlayPath} bytes=${results.overlay_bytes} sha256=${SRC_SHA}`);
