// lib.mjs — shared harness for the negative matrix (agent negative-matrix-D, issue #32 Step D).
// Harness: lead-shim (harness/offline-shim.mjs, unmodified, imported) + a static server owned by the runner on port 8145
// serving the hardening folder, so the candidate route is http://127.0.0.1:8145/wt/atlas/v/202610261949/ .
// Nothing here edits the worktree. Fixtures are written under evidence/negative-matrix-D/fixtures/<case>/data and are
// SYNTHETIC unless the case points at the data-plane builder's fixtures (fixtures/<variant>/data).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium, devices } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

export const ROOT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening';
export const EV = path.join(ROOT, 'evidence', 'negative-matrix-D');
export const FIX = path.join(EV, 'fixtures');
export const REAL = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures';
export const PORT = 8145;
export const GEN = '202610261949';
export const ROUTE = (host = '127.0.0.1') => `http://${host}:${PORT}/wt/atlas/v/${GEN}/`;
export const AR = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/';
export const FEED = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson';
export const DAY = 864e5, HOUR = 36e5;
export const SYN = 'SYNTHETIC TEST FIXTURE (negative-matrix-D, issue #32 Step D) — not an observation; never publish';
export const ACAO = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.geojson': 'application/geo+json', '.png': 'image/png', '.parquet': 'application/octet-stream', '.wasm': 'application/wasm', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
export function startServer() {
  // No Access-Control-Allow-Origin header on purpose: the CORS case relies on a genuine cross-origin denial.
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404 ' + p); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(PORT, '0.0.0.0', () => r(srv)));
}

/* ------------------------------ fixtures (synthetic, labelled) ---------------------------- */
export const iso = t => new Date(t).toISOString();
export const ymd = t => iso(t).slice(0, 10);
export const ds = d => Date.parse(d + 'T00:00:00Z');
export const dayPath = d => `days/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}.json`;
export const partPath = (d, h) => `days/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/${String(h).padStart(2, '0')}.json`;
export function feat(i, t, lon, lat, extra = {}) {
  return { type: 'Feature', id: `synthetic-${i}`, geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name: `SYNTHETIC flash ${iso(t)}`, raw_tech: 'SYNTHETIC fixture point (not an observation)', status: 'synthetic', time_utc: iso(t), source: 'negative-matrix-D fixture', source_product: 'none', observation_kind: 'optical_lightning_flash', fixture_synthetic: true, ...extra } };
}
/** n synthetic points spread over [t0,t1) inside the UK box, deterministic. */
export function spread(n, t0, t1, seed = 1) {
  let a = seed >>> 0; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const out = []; for (let i = 0; i < n; i++) out.push(feat(`${seed}-${i}`, t0 + Math.floor(rnd() * (t1 - t0)), +(-10.5 + 13 * rnd()).toFixed(4), +(49.6 + 11.8 * rnd()).toFixed(4)));
  return out.sort((x, y) => Date.parse(x.properties.time_utc) - Date.parse(y.properties.time_utc));
}
export function shard(date, features, over = {}) {
  const ts = features.map(f => Date.parse(f.properties.time_utc)).filter(isFinite);
  return { schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection', metadata: { date_utc: date, source: 'SYNTHETIC', observation: SYN, count: features.length, first_observation_utc: ts.length ? iso(Math.min(...ts)) : null, last_observation_utc: ts.length ? iso(Math.max(...ts)) : null, fixture_synthetic: true, ...(over.metadata || {}) }, features, ...(over.top || {}) };
}
/** day row for an index; count null => coverage none. */
export function row(date, o = {}) {
  const r = { date, coverage: o.coverage || (o.count === null || o.count === undefined ? 'none' : (o.scanned_seconds >= 86400 ? 'full' : 'partial')), scanned_seconds: o.scanned_seconds ?? (o.count === null || o.count === undefined ? 0 : 86400), count: o.count ?? null, bytes: o.bytes ?? null, path: o.path === undefined ? (o.count > 0 && !o.parts ? dayPath(date) : null) : o.path, sealed: o.sealed ?? true, first_observation_utc: o.first ?? null, last_observation_utc: o.last ?? null, sha256: o.sha256 ?? null };
  if (o.parts) r.parts = o.parts; for (const k of Object.keys(o)) if (!(k in r) && !['first', 'last'].includes(k)) r[k] = o[k]; return r;
}
export function index(o) {
  const gen = o.generated, iv = o.interval ?? 1; const sw = o.scan_windows || [];
  return { schema: o.schema ?? 'uk-lightning-history-index.v2', generated_utc: iso(gen), collection_interval_hours: iv, collection_lookback_hours: 6, collection_lookback_hours_max: 48, update_grace_hours: 2, next_update_due_utc: iso(o.nextDue ?? gen + 3 * HOUR), cutoff_date_utc: o.cutoff, retention: 'one calendar year, UTC', source: 'SYNTHETIC (negative-matrix-D)', observation: o.observation ?? 'satellite optical lightning flashes, not ground strikes', bounds_wsen: [-11, 49.5, 3, 61.5], max_shard_bytes: 25000000, target_shard_bytes: 8388608, coverage_start_utc: o.coverage_start ?? (sw.length ? sw.map(w => w.start_utc).sort()[0] : o.cutoff + 'T00:00:00.000Z'), last_successful_scan_end_utc: sw.length ? sw.map(w => w.end_utc).sort().at(-1) : null, scan_windows: sw, fixture_note: SYN, fixture_synthetic: true, days: o.days, ...(o.extra || {}) };
}
export function writeFixture(name, files) {
  const dir = path.join(FIX, name, 'data'); fs.rmSync(path.join(FIX, name), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(FIX, name, 'SYNTHETIC-FIXTURE.txt'), SYN + '\nbuilt ' + new Date().toISOString() + '\n');
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
  return dir;
}
export const realDir = v => path.join(REAL, v, 'data');
export const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function copyReal(name, variant = 'lightning-archive', mutate = {}) {
  // copies the builder's (genuine-observation) fixture into a SYNTHETIC-labelled folder and applies file overrides
  const src = realDir(variant); const files = {};
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files[path.relative(src, p)] = fs.readFileSync(p); } }; walk(src);
  for (const [rel, body] of Object.entries(mutate)) { if (body === null) delete files[rel]; else files[rel] = body; }
  return writeFixture(name, files);
}

/* ------------------------------ browser ------------------------------------------------- */
export async function boot(o) {
  // o: { fixtureDir, viewport:{w,h}, phone:bool, clock:'ISO', reducedMotion, host, before(page) }
  const browser = o.browser || await chromium.launch();
  const phone = !!o.phone; const vp = o.viewport || { width: 1440, height: 900 };
  const base = phone ? { ...devices['iPhone 12'], defaultBrowserType: undefined } : {};
  const ctx = await browser.newContext({ ...base, viewport: vp, locale: 'en-GB', timezoneId: o.timezone || 'Europe/London', reducedMotion: o.reducedMotion || 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const rec = { pageErrors: [], consoleErrors: [], requests: [] };
  page.on('pageerror', e => rec.pageErrors.push(String(e).slice(0, 400)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') rec.consoleErrors.push((m.type() + ': ' + m.text()).slice(0, 300)); });
  page.on('request', r => { const u = r.url(); if (/raw\.githubusercontent\.com|lightning-fixture|negative-matrix-D/.test(u)) rec.requests.push({ url: u.replace(AR, 'AR/').replace(FEED, 'FEED'), method: r.method(), start: Date.now(), end: null, status: null, failure: null }); });
  const fin = (r, status, failure) => { const u = r.url().replace(AR, 'AR/').replace(FEED, 'FEED'); const e = rec.requests.slice().reverse().find(x => x.url === u && x.end === null); if (e) { e.end = Date.now(); e.status = status; e.failure = failure; } };
  page.on('requestfinished', async r => { let s = null; try { s = (await r.response())?.status() ?? null; } catch { } fin(r, s, null); });
  page.on('requestfailed', r => fin(r, null, r.failure()?.errorText || 'failed'));
  if (o.clock) await page.clock.install({ time: o.clock });
  const shim = await installOfflineShim(page, { lightningDataDir: o.fixtureDir });
  if (o.before) await o.before(page, ctx);
  await page.goto(ROUTE(o.host), { waitUntil: 'domcontentloaded' });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 1500 });
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
  await page.evaluate(() => { window.__NMD = { mapErrors: [], rejections: [] }; const m = window.__GRIDATLAS_V9_MAP__; m && m.on && m.on('error', e => window.__NMD.mapErrors.push(String(e && e.error && e.error.message || e))); window.addEventListener('unhandledrejection', e => window.__NMD.rejections.push(String(e.reason && e.reason.stack || e.reason).slice(0, 300))); });
  return { browser, ctx, page, shim, rec, comp, phone, vp };
}

/** The user-visible lightning state on the main (Layers panel) surface + map truth + original-control snapshot. */
export async function snap(page) {
  return page.evaluate(() => {
    const NS = window.__GRIDATLAS_MODULES__ || {}; const S = NS.ukLightning && NS.ukLightning.state; const map = window.__GRIDATLAS_V9_MAP__;
    const q = s => document.querySelector(s); const qa = s => [...document.querySelectorAll(s)];
    const src = map && map.getSource('gridatlas-lightning'); const layer = map && map.getLayer('l-gridatlas-lightning');
    const cap = q('#gridatlas-lightning-caption-main'); const grp = q('#scada-ui-container [data-lightning-group="main"]');
    const feats = src && src._data && src._data.features || null;
    const times = feats ? feats.map(f => Date.parse(f.properties && f.properties.time_utc)).filter(isFinite) : [];
    const capRect = cap && cap.getBoundingClientRect();
    const lightningHTMLBad = qa('[data-lightning-group] img,[data-lightning-group] script,[data-lightning-group] svg,[data-lightning-group] iframe,[data-lightning-group] b,[data-lightning-group] i,[data-lightning-group] a').length;
    const chips = {}; qa('#scada-ui-container [data-lightning-period]').forEach(b => chips[b.dataset.lightningPeriod] = (b.classList.contains('active') ? 'active' : '') + (b.disabled ? ' disabled' : ''));
    const nav = {}; qa('#scada-ui-container [data-lightning-nav]').forEach(b => nav[b.dataset.lightningNav] = (b.disabled ? 'disabled' : 'enabled') + (b.hidden ? ' hidden' : ''));
    const origStyle = map ? map.getStyle() : null;
    return {
      label: { main: q('#scada-ui-container [data-lightning-label]')?.textContent ?? null, fs: q('#fs-curtain-keys [data-lightning-label]')?.textContent ?? null, menu: q('#gridatlas-menu-bar [data-lightning-label]')?.textContent ?? null },
      toggles: { main: q('#scada-ui-container [data-lightning-control]')?.checked ?? null, fs: q('#fs-curtain-keys [data-lightning-control]')?.checked ?? null, menu: q('#gridatlas-menu-bar [data-lightning-control]')?.checked ?? null },
      stateLine: grp?.querySelector('.status-dot')?.textContent ?? null, dot: grp?.querySelector('[data-lightning-dot]')?.style.background ?? null,
      caption: cap ? [...cap.querySelectorAll('[data-cap]')].map(n => n.textContent) : null,
      captionHTML: cap ? [...cap.querySelectorAll('[data-cap]')].map(n => n.innerHTML).join('\n').slice(0, 4000) : null,
      captionVisible: !!cap && !q('#scada-ui-container [data-lightning-controls]')?.hidden && capRect && capRect.height > 0, captionRect: capRect && { x: Math.round(capRect.x), y: Math.round(capRect.y), w: Math.round(capRect.width), h: Math.round(capRect.height) },
      controlsHidden: q('#scada-ui-container [data-lightning-controls]')?.hidden ?? null, chips, nav, customRow: q('#scada-ui-container [data-lightning-custom]')?.style.display, dates: { from: q('#scada-ui-container [data-lightning-date="from"]')?.value, to: q('#scada-ui-container [data-lightning-date="to"]')?.value, min: q('#scada-ui-container [data-lightning-date="from"]')?.min, max: q('#scada-ui-container [data-lightning-date="from"]')?.max, fromBorder: q('#scada-ui-container [data-lightning-date="from"]')?.style.borderColor },
      map: { source: !!src, layer: !!layer, visibility: layer ? map.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null, features: feats ? feats.length : null, cluster: src ? !!(src.workerOptions && src.workerOptions.cluster) : null, firstTime: times.length ? new Date(Math.min(...times)).toISOString() : null, lastTime: times.length ? new Date(Math.max(...times)).toISOString() : null, badCoords: feats ? feats.filter(f => { const c = f.geometry && f.geometry.coordinates; return !Array.isArray(c) || c.length < 2 || !isFinite(c[0]) || !isFinite(c[1]) || c[0] < -11 || c[0] > 3 || c[1] < 49.5 || c[1] > 61.5; }).length : null, rendered: (() => { try { return layer ? map.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length : null; } catch (e) { return 'err:' + e.message; } })(), styleLayerCount: origStyle ? origStyle.layers.length : null },
      S: S && { on: S.on, serial: S.serial, requests: S.requests, errors: S.errors.slice(-6), last: S.last, mode: S.mode, timer: !!S.timer, period: S.period, consent: S.consent, idx: !!S.idx, ie: S.ie, lruNote: null },
      injected: window.__INJECTED ?? null, lightningMarkupNodes: lightningHTMLBad,
      orig: {
        engine: qa('#scada-ui-container input[data-layer-id]').map(i => i.dataset.layerId + ':' + (i.checked ? 1 : 0)).join(','), pn: qa('#scada-ui-container input[data-pn-layer]').map(i => i.dataset.pnLayer + ':' + (i.checked ? 1 : 0)).join(','),
        bm: q('input[name="bm"]:checked')?.value ?? null, groups: qa('#scada-ui-container .key-group .key-title').map(n => n.textContent.trim()), proxies: qa('[data-gridatlas-layer-proxy]').length, keys: qa('[data-gridatlas-layer-key]').length,
        inspect: NS.menuBar && NS.menuBar.inspect(), styleLayers: origStyle ? origStyle.layers.map(l => l.id).filter(id => id !== 'l-gridatlas-lightning').join(',') : null, sources: origStyle ? Object.keys(origStyle.sources).filter(s => s !== 'gridatlas-lightning').join(',') : null,
        styleEls: document.querySelectorAll('style').length, fetchName: window.fetch.name, mapScroll: [document.getElementById('map-container')?.scrollTop ?? null, document.getElementById('map-container')?.scrollLeft ?? null], bodyScroll: [window.scrollX, window.scrollY], storage: Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => /lightning|weather/i.test(k)), menuOpen: !!q('#gridatlas-menu-bar .gm-menu.gm-open'), search: q('#search-input')?.value ?? null, bridge: window.__GRIDATLAS_MAP_READY__ && { intercepted: window.__GRIDATLAS_MAP_READY__.intercepted_on_demand, failures: (window.__GRIDATLAS_MAP_READY__.failures || []).length }
      },
      nmd: window.__NMD, now: new Date().toISOString(), active: (() => { const a = document.activeElement; return a ? (a.tagName + (a.id ? '#' + a.id : '') + (a.className ? '.' + String(a.className).split(' ')[0] : '') + (a.dataset && a.dataset.lightningControl ? '[lightning-toggle]' : '') + (a.getAttribute && a.getAttribute('data-gridatlas-layer-proxy') ? '[proxy=' + a.getAttribute('data-gridatlas-layer-proxy') + ']' : '')) : null; })()
    };
  });
}
export function origDiff(a, b, ignore = []) {
  const d = []; for (const k of Object.keys(a.orig)) { if (ignore.includes(k)) continue; const x = JSON.stringify(a.orig[k]), y = JSON.stringify(b.orig[k]); if (x !== y) d.push({ key: k, before: x.slice(0, 200), after: y.slice(0, 200) }); } return d;
}

/* ------------------------------ real gestures ------------------------------------------- */
export const mainToggle = page => page.locator('#scada-ui-container input[data-lightning-control="toggle"]');
export async function openLayersOnPhone(page) { const w = page.locator('.scada-wrapper'); if (await w.count() && await w.getAttribute('data-gridatlas-collapsed') === '1') { await page.locator('#gridatlas-dash-toggle').click(); await page.waitForTimeout(400); } }
export async function clickToggle(page, phone) { if (phone) await openLayersOnPhone(page); const t = mainToggle(page); await t.scrollIntoViewIfNeeded(); await t.click(); }
export async function clickChip(page, p) { const b = page.locator(`#scada-ui-container [data-lightning-period="${p}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); }
export async function clickNav(page, w) { const b = page.locator(`#scada-ui-container [data-lightning-nav="${w}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); }
export async function applyCustom(page, from, to) { await clickChip(page, 'custom'); await page.waitForTimeout(150); await page.locator('#scada-ui-container [data-lightning-date="from"]').fill(from); await page.locator('#scada-ui-container [data-lightning-date="to"]').fill(to); await clickNav(page, 'apply'); }
/** Wait until the overlay has painted a terminal state for the current serial (or is OFF). */
export async function settle(page, timeout = 45000) {
  await page.waitForFunction(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; const t = document.querySelector('#scada-ui-container [data-lightning-group="main"] .status-dot')?.textContent || ''; return !S.on || (t && t !== 'LOADING' && S.res); }, null, { timeout }).catch(() => { });
  await page.waitForTimeout(700);
}
export async function shot(page, name) { try { await page.locator('#scada-ui-container [data-lightning-group="main"]').scrollIntoViewIfNeeded({ timeout: 2000 }); } catch { } const p = path.join(EV, 'shots', name + '.png'); await page.screenshot({ path: p, fullPage: false }); return p; }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function concurrency(reqs, re) {
  const xs = reqs.filter(r => re.test(r.url) && r.end); const ev = []; for (const r of xs) { ev.push([r.start, 1]); ev.push([r.end, -1]); } ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0; for (const [, d] of ev) { cur += d; max = Math.max(max, cur); } return { count: xs.length, maxInFlight: max };
}

/** wait until the lightning source's tiles are loaded (or 25 s), then report rendered count */
export async function waitTiles(page, ms = 25000) {
  return page.evaluate((ms) => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; const t0 = performance.now(); const tick = () => { let loaded = false; try { loaded = !m.getSource('gridatlas-lightning') || (m.isSourceLoaded('gridatlas-lightning') && m.areTilesLoaded()); } catch (e) { } if (loaded || performance.now() - t0 > ms) { let n = null; try { n = m.getLayer('l-gridatlas-lightning') ? m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length : null; } catch (e) { n = 'err:' + e.message; } res({ loaded, waitedMs: Math.round(performance.now() - t0), rendered: n }); } else setTimeout(tick, 250); }; tick(); }), ms);
}
