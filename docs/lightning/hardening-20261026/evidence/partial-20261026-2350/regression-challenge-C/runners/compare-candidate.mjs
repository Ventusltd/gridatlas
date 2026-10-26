#!/usr/bin/env node
/**
 * compare-candidate.mjs — baseline vs candidate under IDENTICAL conditions.
 *
 * For every (viewport x scene) it opens the baseline URL and the candidate URL in
 * two fresh contexts built from the same options (viewport, touch, UA, locale,
 * timezone, reduced motion, colour scheme, device scale 1), applies the same
 * network policy to both (every host allowed by default; --block-hosts applies
 * the same denial to both; the lightning feed and history index are routed the
 * same way on both), waits the same way (generation attribute, then map + >=60
 * layer proxies up to --boot-ms, then network idle <=20 s, then a fixed 3 s),
 * performs the same deterministic interactions for the scene, and records:
 *
 *   manifest.json  DOM inventory (ids, order, attributes) of the menu bar, the
 *                  native Layers panel (#scada-ui-container), the fullscreen
 *                  curtain (#fs-curtain-keys), the map controls and the search
 *                  bar; bounding rects of a fixed selector list; computed styles
 *                  of key elements; the 60+3 contract (menuBar.inspect());
 *                  map style layer ids/order/visibility and source ids; the
 *                  hosts and paths requested; console and page errors; and the
 *                  lightning-OFF invariants (no feed request at boot, no lit
 *                  lightning layer, no checked lightning input).
 *   screenshot     at the exact viewport, after the wait, with masks painted
 *                  over the shell clock (#clock, #date, #days) and over every
 *                  label whose text carries a live count "[n]".
 *   diff           baseline vs candidate: manifest deltas, geometry deltas in
 *                  CSS px for every element present on both sides, and the
 *                  masked pixel difference (count, percentage, bounding box,
 *                  diff PNG) decoded and compared in pure Node (no new packages).
 *
 * --allow-added is the ONLY tolerated DOM difference: selectors the candidate
 * may add (e.g. "[data-weather-layer]"). Anything else added, removed, re-ordered
 * or moved is reported as a regression. With lightning OFF the pixel diff must be
 * 0 after masks; --self-parity runs baseline against itself first to prove the
 * harness's own noise floor (expected 0).
 *
 *   node compare-candidate.mjs --baseline http://127.0.0.1:8107/gridatlas/atlas/ \
 *        --candidate http://127.0.0.1:8107/gridatlas/atlas/v/<generation>/ \
 *        --out <dir> [--viewports 1440x1000,393x852,844x390] [--scenes plain,deeplink,grid-menu,layers-panel,fullscreen]
 *        [--allow-added "[data-weather-layer],#gridatlas-weather-lightning-toggle"] [--block-hosts cdn.example]
 *        [--lightning-feed https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson]
 *        [--boot-ms 90000] [--self-parity] [--baseline-generation 202609241334] [--candidate-generation <gen>]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const BASELINE = arg('--baseline', 'http://127.0.0.1:8107/gridatlas/atlas/');
const CANDIDATE = arg('--candidate', BASELINE);
const OUT = path.resolve(arg('--out', 'compare-out'));
const VIEWPORTS = arg('--viewports', '1440x1000,393x852,844x390').split(',').map(s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h, mobile: w < 700 || h < 500 }; });
const SCENES = arg('--scenes', 'plain,deeplink,grid-menu,layers-panel,fullscreen').split(',');
const ALLOW_ADDED = arg('--allow-added', '').split(',').map(s => s.trim()).filter(Boolean);
const BLOCK_HOSTS = arg('--block-hosts', '').split(',').map(s => s.trim()).filter(Boolean);
const LIGHTNING_FEED = arg('--lightning-feed', 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson');
const LIGHTNING_HOST_RE = /raw\.githubusercontent\.com\/Ventusltd\/lightning\//;
const BOOT_MS = Number(arg('--boot-ms', '90000'));
const SELF_PARITY = has('--self-parity');
const MASK_CANVAS = !has('--no-mask-canvas'); // the offline shim serves a background-only style; the canvas is masked by default and the map layer list is compared separately
const DEEP_LINK = arg('--deeplink', 'technology=solar&latitude=52.6369&longitude=-1.1398&zoom=12&project=GRIDATLAS_PROOF_parity&capacity_mw=10');
fs.mkdirSync(OUT, { recursive: true });

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const RECT_SELECTORS = ['#gridatlas-menu-bar', '#gridatlas-menu-bar .gm-title', '.hud-header', '.ventus-brand', '#map-container', '.maplibregl-canvas', '.custom-map-attrib', '.search-bar-wrapper', '#search-input', '#search-btn', '.map-controls', '.map-controls button', '#btn-fullscreen', '.scada-wrapper', '#scada-ui-container', '#scada-ui-container .key-group', '#scada-ui-container .key-title', '#scada-ui-container label.key-item', '#gridatlas-dash-toggle', '#fs-curtain-tab', '#fs-curtain', '#fs-curtain-keys', '#fs-letterhead', '.status-legend', '.scada-brand', '.maplibregl-popup', '.maplibregl-popup-content', '.gridatlas-card-bar', '.gm-open .gm-panel', '.gm-panel-body', '[data-gridatlas-layer-proxy]', '[data-weather-layer]', '[data-gridatlas-layer-proxy^="weather"]'];
const STYLE_SELECTORS = ['body', '#gridatlas-menu-bar', '#gridatlas-menu-bar .gm-title', '.hud-header', '.scada-wrapper', '#scada-ui-container', '#scada-ui-container .key-title', '#scada-ui-container label.key-item', '#scada-ui-container label.key-item input', '.map-controls button', '.custom-map-attrib', '#gridatlas-dash-toggle', '.maplibregl-popup-content'];
const STYLE_PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'z-index', 'font-family', 'font-size', 'line-height', 'color', 'background-color', 'border-top', 'padding', 'margin', 'opacity', 'visibility', 'transform', 'overflow', 'min-height', 'max-height'];

/* ----------------------------- PNG codec ---------------------------------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${bitDepth}, interlace ${interlace})`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels, out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride), src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++]; const line = Buffer.from(raw.subarray(src, src + stride)); src += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * channels;
      if (channels === 4) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = line[s + 3]; }
      else if (channels === 3) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = 255; }
      else if (channels === 2) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255; }
    }
    prev = line;
  }
  return { width, height, data: out };
}
function encodePng({ width, height, data }) {
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function applyMasks(img, masks) {
  for (const m of masks) {
    const x0 = Math.max(0, Math.floor(m.x)), y0 = Math.max(0, Math.floor(m.y)), x1 = Math.min(img.width, Math.ceil(m.x + m.width)), y1 = Math.min(img.height, Math.ceil(m.y + m.height));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * img.width + x) * 4; img.data[o] = 255; img.data[o + 1] = 0; img.data[o + 2] = 255; img.data[o + 3] = 255; }
  }
  return img;
}
function diffImages(a, b, tolerance = 8) {
  if (a.width !== b.width || a.height !== b.height) return { comparable: false, reason: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  const out = Buffer.alloc(a.data.length); let count = 0, minX = a.width, minY = a.height, maxX = -1, maxY = -1;
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    const o = (y * a.width + x) * 4; const d = Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (d > tolerance) { count++; out[o] = 255; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    else { const g = Math.round((a.data[o] + a.data[o + 1] + a.data[o + 2]) / 3 * 0.35); out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255; }
  }
  return { comparable: true, differingPixels: count, percent: +(100 * count / (a.width * a.height)).toFixed(4), bbox: count ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null, image: { width: a.width, height: a.height, data: out } };
}

/* --------------------------- page instrumentation -------------------------- */
async function openSide(browser, { url, generation, viewport, scene, label }) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile, userAgent: viewport.mobile ? MOBILE_UA : undefined, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const requests = [], failed = [], consoleErrors = [], pageErrors = [];
  if (BLOCK_HOSTS.length) await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (BLOCK_HOSTS.some(h => u.host === h || u.host.endsWith('.' + h))) return route.abort('blockedbyclient');
    return route.fallback(); // let an earlier handler (the offline shim, when run under shim-preload.cjs) answer
  });
  page.on('request', r => requests.push({ url: r.url(), method: r.method(), resourceType: r.resourceType() }));
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText || '' }));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
  const target = scene === 'deeplink' ? `${url.split('?')[0]}?${DEEP_LINK}` : url;
  const t0 = Date.now();
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const waits = { generation: null, boot: null, idle: null };
  try { await page.waitForFunction((g) => !g || document.documentElement.dataset.gridatlasGeneration === g, generation || '', { timeout: 60000 }); waits.generation = Date.now() - t0; } catch { waits.generation = 'timeout'; }
  let booted = false;
  try { await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: BOOT_MS }); booted = true; waits.boot = Date.now() - t0; } catch { waits.boot = 'timeout'; }
  if (scene === 'deeplink' && booted) { try { await page.locator('.gridatlas-card-bar').first().waitFor({ timeout: 60000 }); await page.waitForFunction(() => (window.__GRIDATLAS_NEON_LINKS__?.links_drawn ?? 0) > 0 || (window.__GRIDATLAS_NEON_LINKS__?.failures?.length ?? 0) > 0, null, { timeout: 60000 }); } catch { } }
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); waits.idle = Date.now() - t0; } catch { waits.idle = 'timeout'; }
  // deterministic interactions per scene
  const interactions = [];
  const tap = async (loc) => viewport.mobile ? loc.tap() : loc.click();
  try {
    if (scene === 'grid-menu' && booted) { await tap(page.getByRole('button', { name: 'Grid', exact: true })); interactions.push('Grid title tapped'); await page.waitForTimeout(400); }
    if (scene === 'layers-panel' && booted) { const t = page.locator('#gridatlas-dash-toggle'); if (await t.count()) { await tap(t); interactions.push('#gridatlas-dash-toggle tapped'); await page.waitForTimeout(400); } }
    if (scene === 'fullscreen' && booted) { await tap(page.getByRole('button', { name: 'View', exact: true })); await tap(page.locator('#btn-fullscreen')); await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 10000 }).catch(() => { }); interactions.push('View > fullscreen'); await page.waitForTimeout(600); }
  } catch (error) { interactions.push('interaction error: ' + String(error).slice(0, 160)); }
  await page.waitForTimeout(3000);

  const manifest = await page.evaluate(({ RECT_SELECTORS, STYLE_SELECTORS, STYLE_PROPS, MASK_CANVAS }) => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };
    const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().replace(/\[[^\]]*\]/g, '[#]').replace(/\d{2}:\d{2}:\d{2}/g, 'hh:mm:ss').replace(/\d+ DAYS/g, 'n DAYS').slice(0, 80);
    const attrs = (el) => Object.fromEntries([...el.attributes].filter(a => !/^(style|aria-expanded|aria-pressed|aria-label)$/.test(a.name)).map(a => [a.name, a.name === 'class' ? a.value.split(/\s+/).filter(c => !/gm-open|fs-active|gridatlas-min/.test(c)).sort().join(' ') : a.value.replace(/\[[^\]]*\]/g, '[#]')]));
    const inventory = (root) => root ? [...root.querySelectorAll('*')].filter(el => el.id || el.matches('input,button,label,.key-group,.key-title,.gm-title,.gm-panel,[data-gridatlas-layer-proxy],[data-layer-id],[data-pn-layer],[data-weather-layer]')).map(el => ({ tag: el.tagName.toLowerCase(), id: el.id || null, attrs: attrs(el), text: text(el), checked: el.checked ?? null, hidden: el.hidden || getComputedStyle(el).display === 'none' })) : null;
    const rects = {};
    for (const sel of RECT_SELECTORS) { const els = [...document.querySelectorAll(sel)]; if (els.length) rects[sel] = els.map(el => ({ key: el.id || el.getAttribute('data-gridatlas-layer-proxy') || el.getAttribute('data-layer-id') || el.getAttribute('data-pn-layer') || el.getAttribute('data-weather-layer') || text(el), rect: rect(el), visible: !!(el.getBoundingClientRect().width && el.getBoundingClientRect().height) })); }
    const styles = {};
    for (const sel of STYLE_SELECTORS) { const el = document.querySelector(sel); if (el) { const cs = getComputedStyle(el); styles[sel] = Object.fromEntries(STYLE_PROPS.map(p => [p, cs.getPropertyValue(p)])); } }
    const map = window.__GRIDATLAS_V9_MAP__;
    let mapState = null;
    try { if (map) { const st = map.getStyle(); mapState = { center: map.getCenter(), zoom: +map.getZoom().toFixed(4), layers: st.layers.map(l => ({ id: l.id, type: l.type, source: l.source, visibility: map.getLayoutProperty(l.id, 'visibility') || 'visible' })), sources: Object.keys(st.sources).sort() }; } } catch (e) { mapState = { error: String(e) }; }
    const inspect = (() => { try { return window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.() ?? null; } catch (e) { return { error: String(e) }; } })();
    const lightningInputs = [...document.querySelectorAll('input')].filter(i => /lightning|weather/i.test(i.outerHTML)).map(i => ({ outer: i.outerHTML.slice(0, 160), checked: i.checked }));
    const styleTags = [...document.querySelectorAll('style')].map(s => ({ id: s.id || null, length: s.textContent.length, head: s.textContent.slice(0, 60) }));
    const masks = [...document.querySelectorAll('#clock,#date,#days,[data-base-label],[data-pn-label],.hud-val' + (MASK_CANVAS ? ',.maplibregl-canvas' : ''))].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
    return {
      generation: window.__GRIDATLAS_ATLAS__?.generation ?? null, compositionVersion: window.__GRIDATLAS_ATLAS__?.composition_version ?? null, htmlGeneration: document.documentElement.dataset.gridatlasGeneration ?? null, title: document.title,
      bodyClass: document.body.className, fullscreen: document.fullscreenElement?.id || null,
      inspect, menuTitles: [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].map(text),
      menuBar: inventory(document.getElementById('gridatlas-menu-bar')), layersPanel: inventory(document.getElementById('scada-ui-container')), fsCurtain: inventory(document.getElementById('fs-curtain-keys')), mapControls: inventory(document.querySelector('.map-controls')),
      scadaCollapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') ?? null,
      counts: { engine: document.querySelectorAll('#scada-ui-container input[data-layer-id]').length, pipeline: document.querySelectorAll('#scada-ui-container input[data-pn-layer]').length, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, fsEngine: document.querySelectorAll('#fs-curtain-keys input[data-layer-id]').length, weatherInputs: document.querySelectorAll('[data-weather-layer]').length },
      lightningInputs, lightningLayers: mapState?.layers?.filter(l => /lightning|weather/i.test(l.id)) ?? [], rects, styles, styleTags, mapState: mapState && { center: mapState.center, zoom: mapState.zoom, sources: mapState.sources, layerCount: mapState.layers.length, layers: mapState.layers },
      popup: (() => { const p = document.querySelector('.maplibregl-popup'); return p ? { rect: rect(p), classes: p.className, contentRect: rect(p.querySelector('.maplibregl-popup-content') || p), text: text(p).slice(0, 200) } : null; })(),
      masks
    };
  }, { RECT_SELECTORS, STYLE_SELECTORS, STYLE_PROPS, MASK_CANVAS });
  const shotPath = path.join(OUT, `${label}-${scene}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  const img = applyMasks(decodePng(fs.readFileSync(shotPath)), manifest.masks);
  const maskedPath = shotPath.replace(/\.png$/, '.masked.png');
  fs.writeFileSync(maskedPath, encodePng(img));
  const hostOf = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch { return u; } };
  const record = {
    label, url: target, viewport, scene, booted, waits: { ...waits, policy: `generation<=60s; map+60 proxies+menuBar<=${BOOT_MS}ms; networkidle<=20s; fixed 3s` }, interactions, manifest,
    network: { requested: [...new Set(requests.map(r => hostOf(r.url)))].sort(), failed: failed.map(f => ({ url: hostOf(f.url), error: f.error })), lightningRequests: requests.filter(r => LIGHTNING_HOST_RE.test(r.url) || r.url === LIGHTNING_FEED).map(r => r.url) },
    consoleErrors, pageErrors, screenshot: shotPath, masked: maskedPath
  };
  await ctx.close();
  return { record, img };
}

/* ------------------------------ comparison ---------------------------------- */
function inventoryDiff(a, b, allowed) {
  const key = (e) => `${e.tag}#${e.id || ''}|${JSON.stringify(e.attrs)}|${e.text}`;
  const A = (a || []).map(key), B = (b || []).map(key);
  const setA = new Set(A), setB = new Set(B);
  const isAllowed = (k) => allowed.some(sel => { const m = sel.match(/^\[([a-z-]+)(?:\^?=\"?([^\]"]*)\"?)?\]$/i); if (m) return k.includes(`"${m[1]}":`); if (sel.startsWith('#')) return k.includes(`#${sel.slice(1)}|`); return false; });
  const added = B.filter(k => !setA.has(k)), removed = A.filter(k => !setB.has(k));
  const addedNotAllowed = added.filter(k => !isAllowed(k));
  const common = A.filter(k => setB.has(k));
  const orderB = B.filter(k => setA.has(k));
  const reordered = JSON.stringify(common) !== JSON.stringify(orderB);
  return { added: added.length, addedAllowed: added.length - addedNotAllowed.length, addedNotAllowed, removed, reordered };
}
function rectDiff(a, b) {
  const out = [];
  for (const sel of Object.keys(a.rects || {})) {
    const ra = a.rects[sel], rb = (b.rects || {})[sel];
    if (!rb) { out.push({ selector: sel, missingOnCandidate: ra.length }); continue; }
    const byKey = new Map(rb.map(r => [r.key, r]));
    for (const r of ra) { const c = byKey.get(r.key); if (!c) { out.push({ selector: sel, key: r.key, missingOnCandidate: true }); continue; } const d = { dx: +(c.rect.x - r.rect.x).toFixed(2), dy: +(c.rect.y - r.rect.y).toFixed(2), dw: +(c.rect.w - r.rect.w).toFixed(2), dh: +(c.rect.h - r.rect.h).toFixed(2) }; if (d.dx || d.dy || d.dw || d.dh) out.push({ selector: sel, key: r.key, baseline: r.rect, candidate: c.rect, delta: d }); }
  }
  for (const sel of Object.keys(b.rects || {})) if (!(a.rects || {})[sel]) out.push({ selector: sel, newOnCandidate: b.rects[sel].length });
  return out;
}
function styleDiff(a, b) {
  const out = [];
  for (const sel of Object.keys(a.styles || {})) { const sa = a.styles[sel], sb = (b.styles || {})[sel]; if (!sb) { out.push({ selector: sel, missing: true }); continue; } for (const p of Object.keys(sa)) if (sa[p] !== sb[p]) out.push({ selector: sel, prop: p, baseline: sa[p], candidate: sb[p] }); }
  return out;
}

const browser = await chromium.launch({ headless: true });
const report = { baseline: BASELINE, candidate: CANDIDATE, selfParity: SELF_PARITY, allowAdded: ALLOW_ADDED, blockHosts: BLOCK_HOSTS, startedAt: new Date().toISOString(), cases: [] };
try {
  for (const viewport of VIEWPORTS) for (const scene of SCENES) {
    const id = `${scene}-${viewport.width}x${viewport.height}`;
    process.stdout.write(`[compare] ${id} baseline…`);
    const A = await openSide(browser, { url: BASELINE, generation: arg('--baseline-generation', ''), viewport, scene, label: 'baseline' });
    process.stdout.write(` candidate…`);
    const B = await openSide(browser, { url: SELF_PARITY ? BASELINE : CANDIDATE, generation: SELF_PARITY ? arg('--baseline-generation', '') : arg('--candidate-generation', ''), viewport, scene, label: SELF_PARITY ? 'baseline-again' : 'candidate' });
    const pix = diffImages(A.img, B.img);
    if (pix.image) { fs.writeFileSync(path.join(OUT, `diff-${id}.png`), encodePng(pix.image)); delete pix.image; }
    const m = A.record.manifest, n = B.record.manifest;
    const result = {
      id, scene, viewport, bootedBaseline: A.record.booted, bootedCandidate: B.record.booted,
      generation: { baseline: m.generation, candidate: n.generation },
      contract: { baseline: m.inspect, candidate: n.inspect, counts: { baseline: m.counts, candidate: n.counts } },
      lightningOff: { candidateFeedRequestsAtBoot: B.record.network.lightningRequests, candidateLightningInputsChecked: n.lightningInputs.filter(i => i.checked).length, candidateLightningLayersVisible: n.lightningLayers.filter(l => l.visibility !== 'none').map(l => l.id) },
      dom: { menuBar: inventoryDiff(m.menuBar, n.menuBar, ALLOW_ADDED), layersPanel: inventoryDiff(m.layersPanel, n.layersPanel, ALLOW_ADDED), fsCurtain: inventoryDiff(m.fsCurtain, n.fsCurtain, ALLOW_ADDED), mapControls: inventoryDiff(m.mapControls, n.mapControls, ALLOW_ADDED), menuTitles: JSON.stringify(m.menuTitles) === JSON.stringify(n.menuTitles) },
      geometry: rectDiff(m, n), styles: styleDiff(m, n), styleTags: { baseline: m.styleTags.length, candidate: n.styleTags.length },
      map: { layersEqual: JSON.stringify(m.mapState?.layers) === JSON.stringify(n.mapState?.layers), sourcesEqual: JSON.stringify(m.mapState?.sources) === JSON.stringify(n.mapState?.sources), zoom: [m.mapState?.zoom, n.mapState?.zoom], center: [m.mapState?.center, n.mapState?.center] },
      popup: { baseline: m.popup, candidate: n.popup },
      network: { onlyBaseline: A.record.network.requested.filter(u => !B.record.network.requested.includes(u)), onlyCandidate: B.record.network.requested.filter(u => !A.record.network.requested.includes(u)), failedBaseline: A.record.network.failed.length, failedCandidate: B.record.network.failed.length },
      errors: { baseline: { console: A.record.consoleErrors.length, page: A.record.pageErrors }, candidate: { console: B.record.consoleErrors.length, page: B.record.pageErrors } },
      pixels: pix, screenshots: { baseline: A.record.screenshot, candidate: B.record.screenshot, diff: pix.comparable ? path.join(OUT, `diff-${id}.png`) : null }
    };
    const regressions = [];
    if (!result.bootedBaseline || !result.bootedCandidate) regressions.push(`BLOCKED_DEPENDENCY: page did not boot (baseline ${result.bootedBaseline}, candidate ${result.bootedCandidate})`);
    if (result.lightningOff.candidateFeedRequestsAtBoot.length) regressions.push('lightning feed requested while OFF by default');
    if (result.lightningOff.candidateLightningInputsChecked) regressions.push('a lightning input is checked by default');
    if (result.lightningOff.candidateLightningLayersVisible.length) regressions.push('a lightning layer is visible by default');
    for (const [k, v] of Object.entries(result.dom)) { if (v === true || v === false) { if (!v) regressions.push(`${k} changed`); continue; } if (v.addedNotAllowed.length) regressions.push(`${k}: ${v.addedNotAllowed.length} element(s) added beyond --allow-added`); if (v.removed.length) regressions.push(`${k}: ${v.removed.length} original element(s) removed`); if (v.reordered) regressions.push(`${k}: original elements re-ordered`); }
    if (result.geometry.filter(g => g.delta || g.missingOnCandidate).length) regressions.push(`${result.geometry.filter(g => g.delta || g.missingOnCandidate).length} original element rect(s) moved or missing`);
    if (result.styles.length) regressions.push(`${result.styles.length} computed style value(s) differ`);
    if (result.bootedBaseline && result.bootedCandidate && !result.map.layersEqual) regressions.push('map style layer list differs (lightning OFF must add no visible layer; a hidden one must be declared in --allow-added terms)');
    if (pix.comparable && pix.differingPixels > 0) regressions.push(`${pix.differingPixels} masked pixels differ (${pix.percent}%)`);
    if (!pix.comparable) regressions.push('screenshots not comparable: ' + pix.reason);
    if (JSON.stringify(result.errors.baseline.page) !== JSON.stringify(result.errors.candidate.page)) regressions.push('page errors differ');
    result.regressions = regressions;
    result.verdict = regressions.length ? (regressions.some(r => r.startsWith('BLOCKED')) ? 'BLOCKED_DEPENDENCY' : 'FAIL') : 'PASS';
    report.cases.push(result);
    fs.writeFileSync(path.join(OUT, `case-${id}.json`), JSON.stringify({ result, baseline: A.record, candidate: B.record }, null, 2));
    console.log(` ${result.verdict}${regressions.length ? ' — ' + regressions.join('; ') : ''}`);
  }
} finally { await browser.close(); }
report.tally = report.cases.reduce((t, c) => { t[c.verdict] = (t[c.verdict] || 0) + 1; return t; }, {});
fs.writeFileSync(path.join(OUT, 'compare-report.json'), JSON.stringify(report, null, 2));
const md = [`# ${SELF_PARITY ? 'Self-parity' : 'Baseline vs candidate'} comparison`, '', `baseline: ${BASELINE}`, `candidate: ${SELF_PARITY ? BASELINE + ' (again)' : CANDIDATE}`, `tally: ${JSON.stringify(report.tally)}`, '', '| scene | viewport | booted (b/c) | 60+3 (b/c) | masked px diff | geometry deltas | style deltas | DOM added beyond allowance | verdict |', '|---|---|---|---|--:|--:|--:|--:|---|'];
for (const c of report.cases) md.push(`| ${c.scene} | ${c.viewport.width}x${c.viewport.height} | ${c.bootedBaseline}/${c.bootedCandidate} | ${c.contract.baseline?.engine ?? '-'}+${c.contract.baseline?.pipeline ?? '-'} / ${c.contract.candidate?.engine ?? '-'}+${c.contract.candidate?.pipeline ?? '-'} | ${c.pixels.comparable ? c.pixels.differingPixels + ' (' + c.pixels.percent + '%)' : 'n/a'} | ${c.geometry.filter(g => g.delta || g.missingOnCandidate).length} | ${c.styles.length} | ${Object.values(c.dom).filter(v => typeof v === 'object').reduce((n, v) => n + v.addedNotAllowed.length, 0)} | **${c.verdict}** ${c.regressions.join('; ').replace(/\|/g, '/')} |`);
fs.writeFileSync(path.join(OUT, 'compare-report.md'), md.join('\n') + '\n');
console.log(`[compare] ${JSON.stringify(report.tally)} -> ${path.join(OUT, 'compare-report.md')}`);
