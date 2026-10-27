// t8b.browser.mjs — t8-amendment lane. Harness helpers (lines below up to runTest) copied verbatim from
// ../opus-browser-tests/lightning-hardening.browser.mjs; only T8b is defined. usage: node t8b.browser.mjs --gen <stamp> --base http://127.0.0.1:8179/wt
// lightning-hardening.browser.mjs — opus-browser-tests, issue #32 Claude lane.
// Browser-level fail-first tests for the uk-lightning overlay, runnable against ANY candidate generation.
// Harness: lead-shim (../../../lightning/harness/offline-shim.mjs), Chromium via Playwright 1.63 from
// /home/claude/gridatlas/node_modules. Phones are Chromium emulation (isMobile, hasTouch), NOT WebKit/Safari.
// Gestures: real locator.click() (desktop) / locator.tap() (phone) and real mouse.wheel for scrolling; never force:true,
// never dispatchEvent. Assertions read user-visible caption/status/label text; menuBar.inspect() and request logs are
// the only non-visual probes (T13 invariants, T3/T12 request counts).
//
// usage:
//   node lightning-hardening.browser.mjs --gen 202610261949 --base http://127.0.0.1:8151/wt [--only 1,2,13] [--out DIR]
//   route = <base>/atlas/v/<gen>/   (override with --route <full url>)
//   server: python3 -m http.server 8151 --bind 127.0.0.1 --directory <scratchpad>/hardening
// exit code: 0 all PASS, 1 any FAIL/ERROR.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEADFIX = join(HERE, '..', '..', '..', 'lightning', 'fixtures');
const MYFIX = join(HERE, 'fixtures');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GEN = arg('gen'); const BASE = (arg('base') || '').replace(/\/$/, '');
if (!GEN || !(BASE || arg('route'))) { console.error('need --gen <stamp> and --base <url>'); process.exit(2); }
const ROUTE = arg('route') || `${BASE}/atlas/v/${GEN}/`;
const ONLY = (arg('only') || '').split(',').filter(Boolean).map(Number);
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const OUT = arg('out') || join(HERE, 'runs', `${GEN}-${STAMP}`);
await mkdir(OUT, { recursive: true });

const FAKE_NOW = '2026-10-26T18:40:00Z'; // lead fixtures built 18:37:03Z; feed query_end 13:05:58Z
const G = '#scada-ui-container [data-lightning-group="main"]';
const SEL = {
  toggle: `${G} input[data-lightning-control="toggle"]`, label: `${G} [data-lightning-label]`, status: `${G} .status-dot`,
  chip: p => `${G} button[data-lightning-period="${p}"]`, nav: n => `${G} button[data-lightning-nav="${n}"]`, cap: k => `${G} [data-cap="${k}"]`,
};
const CAPS = ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer'];
const INV_EXPECT = { engine: 60, pipeline: 3, total: 63, unique: 63, complete: true };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  p393: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: UA_IPHONE, deviceScaleFactor: 1 },
  p360: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID, deviceScaleFactor: 1 },
};
const num = s => s == null ? null : Number(String(s).replace(/,/g, ''));
const NF = n => Number(n).toLocaleString('en-GB');

const browser = await chromium.launch({ headless: true });
const RUN = { route: ROUTE, gen: GEN, harness: 'lead-shim (offline-shim.mjs); Chromium ' + browser.version() + ' headless; phones = Chromium emulation, not WebKit', node: process.version, startedAt: new Date().toISOString(), fakeClockDefault: FAKE_NOW, cases: {}, tests: {} };
const invRecords = []; // for T13

// ------------------------------------------------------------------ harness helpers
async function boot(name, { data, clock = FAKE_NOW, profile = 'desktop', indexDelayMs = 0 }) {
  const P = PROFILES[profile];
  const ctx = await browser.newContext({ ...P, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const log = { pageErrors: [], lightning: [], phone: !!P.isMobile, profile, data, clock };
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('request', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightning.push({ t: Date.now(), path: u.replace(/^.*\/data\//, '') }); });
  if (clock) await page.clock.install({ time: clock });
  const shim = await installOfflineShim(page, { lightningDataDir: data });
  if (indexDelayMs) await page.route(u => u.pathname.endsWith('/data/history/index.json'), async r => { await new Promise(z => setTimeout(z, indexDelayMs)); await r.fallback(); });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  log.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
  const c = { name, ctx, page, log, shim, phone: !!P.isMobile, steps: [] };
  c.invBefore = await invariants(c, 'before');
  if (c.phone) await openLayersPhone(c);
  return c;
}
async function invariants(c, when) {
  const v = await c.page.evaluate(() => {
    const M = window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar;
    return { inspect: M && M.inspect ? M.inspect() : null, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, markers: document.querySelectorAll('[data-gridatlas-layer-key]').length };
  }).catch(e => ({ error: String(e) }));
  v.ok = !!v.inspect && JSON.stringify(v.inspect) === JSON.stringify(INV_EXPECT) && v.proxies === 63 && v.markers === 63;
  v.lightningRequestsSoFar = c.log.lightning.length; v.when = when;
  return v;
}
async function gesture(c, sel, timeout = 5000) {
  const l = c.page.locator(sel).first();
  if (c.phone) await l.tap({ timeout }); else await l.click({ timeout });
}
async function tryGesture(c, sel, timeout = 4000) {
  try { await gesture(c, sel, timeout); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e).split('\n')[0].slice(0, 200) }; }
}
async function openLayersPhone(c) {
  const st = await c.page.evaluate(() => { const t = document.getElementById('gridatlas-dash-toggle'); return t ? t.getAttribute('aria-pressed') : null; });
  if (st === 'true') { await c.page.locator('#gridatlas-dash-toggle').tap(); await c.page.waitForTimeout(500); }
  c.layersOpened = await c.page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') !== '1');
}
const view = c => c.page.evaluate(({ SEL, CAPS }) => {
  const q = s => document.querySelector(s), t = s => { const n = q(s); return n ? n.innerText.trim() : null; };
  const caps = {}; for (const k of CAPS) caps[k] = t(`${SEL.G} [data-cap="${k}"]`);
  const chips = {}; document.querySelectorAll(`${SEL.G} button[data-lightning-period]`).forEach(b => { chips[b.dataset.lightningPeriod] = { active: b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true', disabled: b.disabled }; });
  const nav = {}; document.querySelectorAll(`${SEL.G} button[data-lightning-nav]`).forEach(b => { nav[b.dataset.lightningNav] = { disabled: b.disabled, hidden: b.hidden || getComputedStyle(b).display === 'none' }; });
  const capBox = q(`${SEL.G} [data-lightning-caption]`);
  return { label: t(`${SEL.G} [data-lightning-label]`), status: t(`${SEL.G} .status-dot`), checked: q(`${SEL.G} input[data-lightning-control="toggle"]`)?.checked, caps, chips, nav, captionVisible: !!(capBox && capBox.offsetParent) };
}, { SEL: { G }, CAPS });
async function settle(c, ms = 25000) {
  const t0 = Date.now(); let v;
  await c.page.waitForTimeout(300);
  while (Date.now() - t0 < ms) {
    v = await view(c);
    if (v.status && v.status !== 'LOADING' && !/\[(LOAD|WAIT)\]/.test(v.label || '')) return { ...v, settledMs: Date.now() - t0 };
    await c.page.waitForTimeout(250);
  }
  return { ...(v || await view(c)), settledMs: null, note: 'still loading after ' + ms + ' ms' };
}
async function step(c, what, extra = {}) { const v = await view(c); c.steps.push({ what, ...v, ...extra, pageErrors: c.log.pageErrors.length }); return v; }
async function on(c) { await gesture(c, SEL.toggle, 15000); return settle(c); }
async function shot(c, name) {
  try { if (c.phone) await c.page.screenshot({ path: join(OUT, name) }); else await c.page.locator(G).screenshot({ path: join(OUT, name) }); } catch { /* evidence only */ }
}
async function finish(c) {
  // OFF by a real gesture, then 11 fake minutes must produce no lightning request; invariants again
  const r = { };
  try {
    const v = await view(c);
    if (v.checked) { const g = await tryGesture(c, SEL.toggle, 8000); r.offGesture = g; await c.page.waitForTimeout(500); }
    const n0 = c.log.lightning.length;
    await c.page.clock.runFor(11 * 60 * 1000); await c.page.waitForTimeout(800);
    r.requestsWhileOffAfter11min = c.log.lightning.slice(n0).map(x => x.path);
    r.checkedAfterOff = (await view(c)).checked;
  } catch (e) { r.error = String(e).slice(0, 200); }
  c.invAfter = await invariants(c, 'after');
  const rec = { case: c.name, profile: c.log.profile, before: c.invBefore, after: c.invAfter, requestsBeforeFirstOn: c.firstOnAt ?? c.log.lightning.length, ...r };
  rec.ok = c.invBefore.ok && c.invAfter.ok && rec.requestsBeforeFirstOn === 0 && (rec.requestsWhileOffAfter11min || []).length === 0 && rec.checkedAfterOff === false;
  invRecords.push(rec);
  RUN.cases[c.name] = { profile: c.log.profile, fixture: c.log.data, clock: c.log.clock, composition: c.log.composition, layersOpened: c.layersOpened, steps: c.steps, pageErrors: c.log.pageErrors, lightningRequests: c.log.lightning.map(x => x.path), shim: c.shim.summary(), invariants: rec };
  await c.ctx.close();
}
function markFirstOn(c) { if (c.firstOnAt === undefined) c.firstOnAt = c.log.lightning.length; }
const A = (what, ok, observed) => ({ what, ok: !!ok, observed });
function verdict(id, title, asserts, extra = {}) {
  const res = asserts.every(a => a.ok) ? 'PASS' : 'FAIL';
  RUN.tests[id] = { title, result: res, asserts, ...extra };
  console.log(`${id} ${res}  ${title}`); for (const a of asserts) if (!a.ok) console.log(`    x ${a.what} :: ${JSON.stringify(a.observed).slice(0, 400)}`);
}
const nonFooter = v => CAPS.filter(k => k !== 'footer').map(k => v.caps[k] || '').join('\n');
// drawn count as the user reads it: status "N FLASHES DRAWN|CLUSTERED", else the flashes caption "N drawn as ...", else 0 when nothing is drawn
const drawnOf = v => {
  const m = /([\d,]+) FLASHES (DRAWN|CLUSTERED)/i.exec(v.status || ''); if (m) return num(m[1]);
  const k = /([\d,]+) drawn as/i.exec((v.caps && v.caps.flashes) || ''); if (k) return num(k[1]);
  return /NO FLASHES|none drawn/i.test((v.status || '') + ' ' + ((v.caps && v.caps.flashes) || '')) ? 0 : null;
};
async function runTest(id, fn) {
  if (ONLY.length && !ONLY.includes(Number(id.slice(1)))) return;
  const t0 = Date.now();
  try { await fn(); } catch (e) { RUN.tests[id] = { ...(RUN.tests[id] || {}), result: 'ERROR', error: String(e.stack || e).slice(0, 800) }; console.log(`${id} ERROR ${String(e).slice(0, 300)}`); }
  if (RUN.tests[id]) RUN.tests[id].seconds = Math.round((Date.now() - t0) / 1000);
  await writeFile(join(OUT, 'results.partial.json'), JSON.stringify(RUN, null, 2));
}
// ------------------------------------------------------------------ T8 HIDE LAYERS occlusion (phones)
async function wheelToEnd(c) {
  for (let i = 0; i < 40; i++) {
    const s = await c.page.evaluate(() => { const e = document.getElementById('scada-ui-container'); const r = e.getBoundingClientRect(); return { st: e.scrollTop, wy: scrollY, x: r.left + r.width / 2, y: Math.max(80, Math.min(innerHeight - 140, r.top + r.height / 2)) }; });
    await c.page.mouse.move(s.x, s.y); await c.page.mouse.wheel(0, 500); await c.page.waitForTimeout(200);
    const t = await c.page.evaluate(() => ({ st: document.getElementById('scada-ui-container').scrollTop, wy: scrollY }));
    if (t.st === s.st && t.wy === s.wy) return i;
  }
  return 40;
}

// ------------------------------------------------------------------ T8b (t8-amendment lane)
// Rule:
//  (A) VISIBLE-LINE OCCLUSION at maximum scroll. For every rendered caption line (Range.getClientRects of each non-empty
//      [data-cap] block) compute the panel's visible clip rect = viewport ∩ padding-box of every ancestor whose computed
//      overflow-x or overflow-y is not 'visible'. A line whose rect lies entirely inside that clip rect (0.5 px tolerance)
//      must be hittable (elementFromPoint returns the caption block or a descendant) at all 9 points x = 10%..90% of its
//      width, y = its vertical centre. Lines partly or wholly outside the clip rect are scrolled away, not occluded, and
//      are judged by (B) instead.
//  (B) REACHABILITY. For every caption line there must exist a scroll position at which the line lies entirely inside
//      the clip rect AND all 9 points hit the caption. Tested by scrolling the nearest scrollable ancestor so the line
//      sits at the top, centre and bottom of the clip rect (plus scrollTop 0 and max), clamped to the reachable range.
//  T8b PASSES only if every (A) line and every (B) line passes, on both phones.
const T8B_MEASURE = ({ G, onlyKey }) => {
  const isClip = el => { const s = getComputedStyle(el); return s.overflowX !== 'visible' || s.overflowY !== 'visible'; };
  const clipOf = n => {
    let L = 0, T = 0, R = innerWidth, B = innerHeight; const chain = [];
    for (let a = n.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      if (a === document.body || !isClip(a)) continue;
      const r = a.getBoundingClientRect(); const l = r.left + a.clientLeft, t = r.top + a.clientTop;
      L = Math.max(L, l); T = Math.max(T, t); R = Math.min(R, l + a.clientWidth); B = Math.min(B, t + a.clientHeight);
      chain.push((a.id ? '#' + a.id : a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.trim().split(/\s+/).join('.') : '')).slice(0, 60));
    }
    return { rect: [L, T, R, B], chain };
  };
  const who = (t, n) => !t ? 'OUT-OF-VIEWPORT' : (t === n || n.contains(t)) ? 'caption' : t.closest('#gridatlas-dash-toggle') ? 'HIDE-LAYERS-BUTTON' : t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (t.className && typeof t.className === 'string' ? '.' + t.className.trim().split(/\s+/)[0] : '');
  const out = [];
  for (const n of document.querySelectorAll(G + ' [data-cap]')) {
    if (!n.innerText.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rects = [...rg.getClientRects()].filter(r => r.width > 2 && r.height > 2);
    const clip = clipOf(n); const [L, T, R, B] = clip.rect; const tol = 0.5;
    rects.forEach((r, i) => {
      const key = `${n.dataset.cap} ${i + 1}/${rects.length}`;
      if (onlyKey && onlyKey !== key) return;
      const inside = r.left >= L - tol && r.top >= T - tol && r.right <= R + tol && r.bottom <= B + tol;
      const y = r.top + r.height / 2; const pts = [];
      for (let k = 1; k <= 9; k++) {
        const x = r.left + r.width * k / 10; const inVp = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
        const t = inVp ? document.elementFromPoint(x, y) : null; pts.push({ x: Math.round(x), y: Math.round(y), hit: who(t, n) });
      }
      const blocked = pts.filter(p => p.hit !== 'caption');
      out.push({ key, cap: n.dataset.cap, rect: [r.left, r.top, r.width, r.height].map(Math.round), clip: clip.rect.map(Math.round), clipChain: clip.chain, inside, blocked, buttonHits: blocked.filter(p => p.hit === 'HIDE-LAYERS-BUTTON').length });
    });
  }
  return out;
};
// scroll the nearest scrollable ancestor of the caption so line `key` sits at `where` of the clip rect; returns the scrollTop used
const T8B_SCROLL = ({ G, key, where }) => {
  const [cap, pos] = key.split(' '); const idx = Number(pos.split('/')[0]) - 1;
  const n = document.querySelector(`${G} [data-cap="${cap}"]`); if (!n) return { error: 'no node' };
  let sc = null; for (let a = n.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll)/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 1) { sc = a; break; } }
  if (!sc) sc = document.scrollingElement;
  const max = sc.scrollHeight - sc.clientHeight;
  if (where === 'min') { sc.scrollTop = 0; return { scroller: sc.id || sc.tagName, scrollTop: sc.scrollTop, max }; }
  if (where === 'max') { sc.scrollTop = max; return { scroller: sc.id || sc.tagName, scrollTop: sc.scrollTop, max }; }
  const rg = document.createRange(); rg.selectNodeContents(n); const r = [...rg.getClientRects()].filter(r => r.width > 2 && r.height > 2)[idx]; if (!r) return { error: 'no rect' };
  // clip rect (same rule as T8B_MEASURE)
  let T = 0, B = innerHeight;
  for (let a = n.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    if (a === document.body) continue; const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
    const t = a.getBoundingClientRect().top + a.clientTop; T = Math.max(T, t); B = Math.min(B, t + a.clientHeight);
  }
  const m = 2; const target = where === 'top' ? r.top - (T + m) : where === 'bottom' ? r.bottom - (B - m) : (r.top + r.height / 2) - (T + B) / 2;
  sc.scrollTop = Math.max(0, Math.min(max, sc.scrollTop + target));
  return { scroller: sc.id || sc.tagName, scrollTop: sc.scrollTop, max };
};
await runTest('T8b', async () => { // run without --only
  const asserts = []; const detail = {};
  for (const prof of ['p393', 'p360']) {
    const c = await boot(`T8b-${prof}`, { data: join(LEADFIX, 'lightning-archive', 'data'), profile: prof });
    try {
      markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); await settle(c);
      const wheels = await wheelToEnd(c);
      const atMax = await c.page.evaluate(T8B_MEASURE, { G, onlyKey: null });
      const btn = await c.page.evaluate(() => { const b = document.getElementById('gridatlas-dash-toggle'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText.trim(), rect: [r.left, r.top, r.width, r.height].map(Math.round) }; });
      await shot(c, `T8b-${prof}-max.png`);
      asserts.push(A(`${prof}: Layers open`, c.layersOpened, c.layersOpened));
      for (const l of atMax.filter(l => l.inside)) asserts.push(A(`${prof}: (A) at max scroll, visible line ${l.key} hittable at 9 points`, l.blocked.length === 0, l));
      // (B) reachability, one line at a time
      const reach = [];
      for (const l of atMax) {
        const tries = [];
        for (const where of ['top', 'centre', 'bottom', 'min', 'max']) {
          const s = await c.page.evaluate(T8B_SCROLL, { G, key: l.key, where });
          await c.page.waitForTimeout(120);
          const [m] = await c.page.evaluate(T8B_MEASURE, { G, onlyKey: l.key });
          const ok = !!m && m.inside && m.blocked.length === 0;
          tries.push({ where, scroll: s, inside: m && m.inside, rect: m && m.rect, clip: m && m.clip, blocked: m && m.blocked });
          if (ok) break;
        }
        const ok = tries.some(t => t.inside && t.blocked && t.blocked.length === 0);
        reach.push({ key: l.key, ok, tries });
        asserts.push(A(`${prof}: (B) line ${l.key} reachable: some scroll position puts it inside the clip rect with 9/9 points hittable`, ok, { key: l.key, tries }));
      }
      const excluded = atMax.filter(l => !l.inside).map(l => ({ key: l.key, rect: l.rect, clip: l.clip, blockedAtMax: l.blocked.length }));
      detail[prof] = { wheels, layersOpened: c.layersOpened, button: btn, clipChain: atMax[0] && atMax[0].clipChain, clip: atMax[0] && atMax[0].clip,
        linesTotal: atMax.length, linesInsideAtMax: atMax.filter(l => l.inside).length, excludedAtMax: excluded,
        buttonHitsAtMaxInside: atMax.filter(l => l.inside).reduce((s, l) => s + l.buttonHits, 0), buttonHitsAtMaxAll: atMax.reduce((s, l) => s + l.buttonHits, 0),
        atMax, reach };
      c.steps.push({ what: 'T8b measurements', wheels, button: btn });
      console.log(`  ${prof}: lines=${atMax.length} insideAtMax=${detail[prof].linesInsideAtMax} (A)failing=${atMax.filter(l => l.inside && l.blocked.length).map(l => l.key).join(',') || '-'} buttonHits(inside)=${detail[prof].buttonHitsAtMaxInside} buttonHits(all)=${detail[prof].buttonHitsAtMaxAll} (B)unreachable=${reach.filter(r => !r.ok).map(r => r.key).join(',') || '-'} button=${JSON.stringify(btn && btn.rect)} clip=${JSON.stringify(detail[prof].clip)}`);
    } finally { await finish(c); }
  }
  verdict('T8b', 'Caption lines inside the panel clip rect are not occluded at max scroll, and every line is reachable 9/9 (393x852, 360x740)', asserts, { detail });
});

await browser.close();
RUN.finishedAt = new Date().toISOString();
await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
const table = Object.entries(RUN.tests).map(([k, v]) => `${k}\t${v.result}\t${v.seconds ?? ''}s\t${v.title || ''}`).join('\n');
await writeFile(join(OUT, 'summary.tsv'), table + '\n');
console.log('\n' + table + '\nout: ' + OUT);
process.exit(Object.values(RUN.tests).every(t => t.result === 'PASS') ? 0 : 1);
