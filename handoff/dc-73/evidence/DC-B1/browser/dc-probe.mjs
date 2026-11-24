// DC-B1 dc.mjs: ONE Chromium (helpers from R-taps rt.mjs / R-build drax.mjs). G (loader v2, worktree ../wt) vs live 202610291044
// (/wt/atlas/). Offline shim with R-taps' lightning data; the pinned offtakers, data-centre and conventional files from ../wt/data.
// REPD register: MR's independent export for /dist/repd_master.json; REPD records: the JSON-twin stand-in for DuckDB (as before).
// Cases: CASES=rest,dc
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const D = new URL('./', import.meta.url).pathname, ROOT = new URL('../serve/', import.meta.url).pathname, WT = new URL('../wt/', import.meta.url).pathname;
const LT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/R-taps/lt/data', PORT = 8471, G = fs.readFileSync(new URL('../out/G', import.meta.url), 'utf8').trim();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const TY = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const SRV = await new Promise(res => { const s = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': TY[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch { r.writeHead(404); r.end('404'); } }); s.listen(PORT, '127.0.0.1', () => res(s)); });
const ONLY = (process.env.CASES || 'rest,dc').split(','), want = n => ONLY.includes(n), OUT = D + 'dc-probe.json', res = {}; const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
const browser = await chromium.launch({ headless: true });
const ctxOf = (vp = { width: 393, height: 852 }) => browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, userAgent: UA, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark', acceptDownloads: true });
const DATA_RE = /lightning\/[^/]+\/data\/|repd_master|repd_projects|offtakers_filtered|datacentres_|conventional_power/;
async function boot(page, route, reqs, { data = true } = {}) {
  const shim = await installOfflineShim(page, { lightningDataDir: LT });
  await page.route(/ventusltd\.github\.io\/gridatlas\/data\/[\w.-]+\.geojson$/, async r => { const f = r.request().url().split('/').pop(); try { await r.fulfill({ status: 200, body: fs.readFileSync(WT + 'data/' + f), headers: { 'access-control-allow-origin': '*', 'content-type': 'application/geo+json' } }); } catch { await r.fulfill({ status: 404, body: '' }); } });
  page.on('request', q => { const u = q.url(); if (DATA_RE.test(u) || /modules\/.*overlay/.test(u)) reqs.push(u.replace(/^https?:\/\/[^/]+/, '')); });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitForComposition(page, { deadlineMs: 90000, settleMs: 5000 });
  if (data) await page.evaluate(async () => { const m = window.__GRIDATLAS_V9_MAP__; window.__ME = []; m.on('error', e => window.__ME.push(String(e && e.error && e.error.message || e))); window.__SQL = [];
    const fc = await (await fetch('/repd.json')).json(), of = window.fetch;
    window.fetch = (u, o) => String(u).endsWith('/dist/repd_master.json') ? new Promise(r => setTimeout(() => r(new Response(JSON.stringify(fc), { status: 200 })), 300)) : of(u, o);
    const recs = (await (await fetch('/recs.json')).json()).records;
    window.__GRIDATLAS_DUCKDB_RUNTIME__ = { module_url: 'stand-in', promise: Promise.resolve({ database: { connect: async () => ({ close: async () => {}, query: async sql => { window.__SQL.push(sql);
      const pts = [...sql.matchAll(/abs\(longitude-\((-?[\d.]+)\)\)<=([\d.]+) AND abs\(latitude-\((-?[\d.]+)\)\)<=([\d.]+)/g)].map(x => [+x[1], +x[3], +x[2]]);
      const rows = recs.filter(r => pts.some(([a, b, t]) => Math.abs(r.longitude - a) <= t && Math.abs(r.latitude - b) <= t)); return { toArray: () => rows.map(r => ({ toJSON: () => r })) }; } }) } }) }; });
  return shim;
}
const shot = (page, f) => page.screenshot({ path: D + f }).then(() => f);
const mstate = page => page.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__, st = m.getStyle(), NS = window.__GRIDATLAS_MODULES__;
  return { otLayers: st.layers.filter(l => /offtakers/.test(l.id)).map(l => l.id), otSources: Object.keys(st.sources).filter(s => /offtakers/.test(s)), card: !!document.querySelector('[data-offtakers-card]'),
    inspect: JSON.stringify(NS.menuBar.inspect()), nLayers: st.layers.length, docW: document.documentElement.scrollWidth, otErr: NS.ukOfftakers.state.errors.slice(-6), mapErr: (window.__ME || []).filter(e => !/glyphs/.test(e)).slice(0, 4) }; });
const otToggle = async (page, on) => { await page.evaluate(on => { const t = document.querySelector('#scada-ui-container [data-offtakers-control="toggle"]'); t.checked = on; t.dispatchEvent(new Event('change', { bubbles: true })); }, on);
  if (on) await page.waitForFunction(() => { const S = window.__GRIDATLAS_MODULES__.ukOfftakers.state; return S.data && !S.busy && (S.data.pl || S.pe) || S.err; }, null, { timeout: 60000 }); await page.waitForTimeout(2500); };
const card = page => page.evaluate(() => { const c = document.querySelector('[data-offtakers-card]'); if (!c) return null; const r = c.getBoundingClientRect(), m = window.__GRIDATLAS_V9_MAP__, S = window.__GRIDATLAS_MODULES__.ukOfftakers.state;
  const cnt = id => { try { return m.getSource(id).serialize().data.features.length; } catch { return null; } }, by = s => { try { return m.getSource('gridatlas-offtakers-neon-dc-l').serialize().data.features.filter(f => f.properties.s === s).length; } catch { return null; } };
  const tabs = [...c.querySelectorAll('[role=tab]')].map(b => b.innerText.replace(/\n/g, ' / ') + (b.getAttribute('aria-selected') === 'true' ? ' *' : ''));
  let lab = null; try { lab = m.getStyle().layers.filter(l => /offtakers-neon/.test(l.id)).map(l => l.id.replace('gridatlas-offtakers-neon-', '') + (l.filter ? ' ' + JSON.stringify(l.filter) : '')).join(' | '); } catch (e) { lab = 'err ' + e.message; }
  return { label: c.getAttribute('aria-label'), rect: [r.left, r.top, r.width, r.height].map(Math.round), maxH: c.style.maxHeight, docW: document.documentElement.scrollWidth, tabs,
    rows: [...(c.querySelector('[data-offtakers-panel]')?.querySelectorAll('a') || [])].map(a => a.innerText.replace(/\n/g, ' | ').slice(0, 160)), lines: { s: by('s'), r: by('r'), v: by('v') }, labels: lab, perf: S.perf, zoom: +m.getZoom().toFixed(2), sitePx: (() => { const S2 = window.__GRIDATLAS_MODULES__.ukOfftakers.state, cc = S2.pp && S2.pp.r; if (!cc) return 'no r'; const p = m.project(cc.a), k = m.getContainer().getBoundingClientRect(); return [Math.round(p.x + k.left), Math.round(p.y + k.top), 'ctr', Math.round(k.top), Math.round(k.height)]; })(), pad: m.getPadding && m.getPadding(), center: [m.getCenter().lng, m.getCenter().lat].map(v => +v.toFixed(4)), mapH: m.getContainer().clientHeight, labelErr: S.errors.filter(e => /label/.test(e)),
    smallTargets: [...c.querySelectorAll('button,a')].map(b => b.getBoundingClientRect()).filter(q => q.height && (q.height < 44 || q.width < 44)).length, text: c.innerText.slice(0, 3000) }; });
const tapAt = async (page, ll, wait = 8000) => { const px = await page.evaluate(c => { const m = window.__GRIDATLAS_V9_MAP__, p = m.project(c), r = m.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, ll);
  await page.touchscreen.tap(px[0], px[1]); await page.waitForTimeout(wait); return px.map(Math.round); };
// frame cost: rAF intervals over ms while the map pans by dx (the camera renders every frame)
const frames = (page, ms = 2500) => page.evaluate(ms => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__, t = []; let t0 = performance.now(), last = t0;
  const f = now => { t.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ n: t.length, p50: +t[t.length >> 1].toFixed(1), p95: +t[Math.floor(t.length * .95)].toFixed(1), max: +t.at(-1).toFixed(1), long: t.filter(x => x > 50).length }); } };
  m.panBy([120, 0], { duration: ms * .8 }); requestAnimationFrame(f); }), ms);
const tab = (page, v) => page.evaluate(v => document.querySelector(`[data-offtakers-card] [data-offtakers-tab="${v}"]`).click(), v).then(() => page.waitForTimeout(800));
try {
  if (want('rest')) { for (const vp of [{ width: 393, height: 852 }, { width: 393, height: 659 }]) for (const [k, r] of [['live', '/wt/atlas/'], ['G', `/wt/atlas/v/${G}/`]]) {
    const ctx = await ctxOf(vp), page = await ctx.newPage(), reqs = [], errs = []; page.on('pageerror', e => errs.push(e.message));
    try { await boot(page, r, reqs, { data: false });
      const st = await page.evaluate(() => { const NS = window.__GRIDATLAS_MODULES__, m = window.__GRIDATLAS_V9_MAP__; return { gen: document.documentElement.dataset.gridatlasGeneration, ogen: NS.ukOfftakers?.generation, lgen: NS.ukLightning?.generation, oon: NS.ukOfftakers?.state?.on,
        inspect: JSON.stringify(NS.menuBar?.inspect?.()), dom: document.body.innerText.replace(/\s+/g, ' '), layers: m.getStyle().layers.map(l => l.id + ':' + (m.getLayoutProperty(l.id, 'visibility') || 'visible')).join(','), sources: Object.keys(m.getStyle().sources).sort().join(',') }; });
      const f = `rest-${k}@${vp.width}x${vp.height}.png`; await page.screenshot({ path: D + f }); res[`rest-${k}@${vp.height}`] = { ...st, requests: [...reqs], errors: errs, shot: f };
    } catch (e) { res[`rest-${k}@${vp.height}`] = { error: String(e) }; } finally { await ctx.close(); } }
    for (const h of [852, 659]) { const a = res['rest-live@' + h], b = res['rest-G@' + h]; if (!a || !b || a.error || b.error) { res[`parity@${h}`] = { error: [a?.error, b?.error] }; continue; }
      let i = 0; while (i < a.dom.length && a.dom[i] === b.dom[i]) i++;
      let px; try { px = execFileSync('node', [D + 'pixcmp.mjs', D + a.shot, D + b.shot], { encoding: 'utf8' }).trim(); } catch (e) { px = String(e.stdout || e).trim(); }
      res[`parity@${h}`] = { gens: [a.gen, b.gen, a.ogen, b.ogen, a.lgen, b.lgen], oon: [a.oon, b.oon], inspectEqual: a.inspect === b.inspect, layersEqual: a.layers === b.layers, sourcesEqual: a.sources === b.sources, pixels: px,
        domEqual: a.dom === b.dom, domDiff: a.dom === b.dom ? null : { at: i, live: a.dom.slice(i, i + 100), G: b.dom.slice(i, i + 100) },
        dataReqs: [a.requests.filter(u => DATA_RE.test(u)), b.requests.filter(u => DATA_RE.test(u))], cartridgeReqs: [a.requests.filter(u => !DATA_RE.test(u)), b.requests.filter(u => !DATA_RE.test(u))], errs: [a.errors, b.errors] };
      for (const k of ['live', 'G']) delete res[`rest-${k}@${h}`].dom; console.log('parity', h, JSON.stringify(res[`parity@${h}`])); }
    save(); }
  if (want('dc')) { const ctx = await ctxOf(), page = await ctx.newPage(), errs = [], reqs = [], r = res.dc = {};
    page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 200)); });
    try { await boot(page, `/wt/atlas/v/${G}/`, reqs); r.rest = await mstate(page);
      let t = Date.now(); await otToggle(page, true); r.onMs = Date.now() - t; r.on = await page.evaluate(() => { const S = window.__GRIDATLAS_MODULES__.ukOfftakers.state; return { status: document.querySelector('#scada-ui-container [data-offtakers-status]').textContent, c: S.data.dots.filter(d => d.k === 'c').length, dc: S.data.dots.filter(d => d.dc).length, pe: S.pe }; });
      // the largest Slough cluster site: the DC nearest the Slough Trading Estate point
      r.site = await page.evaluate(() => { const S = window.__GRIDATLAS_MODULES__.ukOfftakers.state, P = [-0.62, 51.523], d = S.data.dots.filter(d => d.k === 'c').sort((a, b) => Math.hypot(a.a[0] - P[0], a.a[1] - P[1]) - Math.hypot(b.a[0] - P[0], b.a[1] - P[1]))[0]; return { n: d.n, op: d.op, id: d.p.id, a: d.a }; });
      await page.evaluate(a => window.__GRIDATLAS_V9_MAP__.jumpTo({ center: a, zoom: 14 }), r.site.a); await page.waitForTimeout(3000); r.shotBefore = await shot(page, 'dc-slough-before.png');
      t = Date.now(); r.tapPx = await tapAt(page, r.site.a, 0); await page.waitForFunction(() => document.querySelector('[data-offtakers-card]'), null, { timeout: 10000 }); r.cardMs = Date.now() - t;
      await page.waitForFunction(() => { const c = document.querySelector('[data-offtakers-card]'); return c && !/…/.test([...c.querySelectorAll('[role=tab]')].map(b => b.innerText).join('')); }, null, { timeout: 30000 }); r.allSetsMs = Date.now() - t;
      await page.waitForTimeout(2500); r.area = await card(page); r.shotArea = await shot(page, 'dc-slough-area.png');
      for (const v of ['s', 'r', 'v']) { await tab(page, v); r['tab_' + v] = await card(page); r['shot_' + v] = await shot(page, `dc-slough-tab-${v}.png`); }
      r.frames10 = null;
      await tab(page, 'a'); t = Date.now(); await page.evaluate(() => document.querySelector('[data-offtakers-card] [data-offtakers-draw-all]').click()); await page.waitForTimeout(100); r.drawAllMs = Date.now() - t;
      await page.waitForTimeout(3000); r.all = await card(page); r.shotAll = await shot(page, 'dc-slough-all-links.png'); r.framesAll = null;
      r.heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null);
      try { const btn = await page.$('[data-offtakers-card] [data-offtakers-csv]'); await btn.scrollIntoViewIfNeeded(); const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), btn.click()]);
        const f = D + 'dc-slough.csv'; await dl.saveAs(f); const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); r.csv = { name: dl.suggestedFilename(), lines: L.length, head: L.slice(0, 5), sets: ['data centre', 'substation', 'REPD project', 'conventional'].map(s => s + ' ' + L.filter(l => l.startsWith(s + ',')).length) };
      } catch (e) { r.csv = { error: String(e).slice(0, 300) }; }
      await tab(page, 'r'); await page.evaluate(() => document.querySelector('[data-offtakers-card] [data-offtakers-panel] a').click()); await page.waitForTimeout(5000); r.project = await card(page); r.shotProject = await shot(page, 'dc-slough-repd-project.png');
      await page.evaluate(() => document.querySelector('[data-offtakers-back]').click()); await page.waitForTimeout(6000); r.back = await card(page);
      for (const k of ['tab_s', 'tab_r', 'tab_v', 'all', 'project', 'back']) if (r[k]) r[k].text = (r[k].text || '').slice(0, k === 'tab_v' ? 1500 : 500);
      await page.evaluate(() => document.querySelector('[data-offtakers-card] [aria-label=Close]')?.click()); await page.waitForTimeout(800); r.closed = await mstate(page); r.padAfterClose = await page.evaluate(() => window.__GRIDATLAS_V9_MAP__.getPadding());
      await page.evaluate(() => document.querySelector('#scada-ui-container [data-offtakers-dc]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400); r.shotPanel = await shot(page, 'dc-panel.png');
      await otToggle(page, false); r.off = await mstate(page); r.offEqualsRest = { inspect: r.off.inspect === r.rest.inspect, nLayers: [r.rest.nLayers, r.off.nLayers], otLayers: r.off.otLayers, otSources: r.off.otSources };
    } catch (e) { r.error = String(e && e.stack || e); }
    finally { r.errors = errs.filter(e => !/ERR_BLOCKED_BY_CLIENT|glyphs|\[FETCH ERROR\]|LAYER FAILED/.test(e)).slice(0, 12); r.nErrors = errs.length; r.reqs = [...new Set(reqs)].slice(0, 30); await ctx.close(); save(); } }
} finally { await browser.close(); SRV.close(); save(); }
console.log('done', OUT);
