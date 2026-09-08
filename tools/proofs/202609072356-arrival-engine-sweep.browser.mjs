/* 202609072356-arrival-engine-sweep.browser.mjs — does the engine answer, and
 * which engine answered?
 *
 * "Fix ventus grid engine so it launches each time" -- the architect,
 * 2026-09-08. That is a claim about every arrival, so it needs an instrument
 * that looks at every arrival rather than at five golden ones.
 *
 * v9.148 made the answer observable: every arrival is supposed to leave
 * `window.__GRIDATLAS_NEON_LINKS__.arrival_engine` behind, carrying which
 * engine answered (onshore, offshore, interconnector), whether it answered,
 * the reason if it did not, and what it fell back from if it fell back. This
 * sweep reads exactly that, so "the engine was silent" and "the engine said it
 * could not answer, and why" stop looking identical.
 *
 * It reports three outcomes per case and never conflates them:
 *
 *   ANSWERED   the sentinel exists and answered === true
 *   DECLINED   the sentinel exists and answered === false, with a named reason
 *   SILENT     the arrival finished and no sentinel was ever written
 *
 * SILENT is the defect. DECLINED is the engine working: an engine that cannot
 * answer and says why is doing its job, and the reason string is the map of
 * what to fix next. So the exit code is non-zero on SILENT or on a page error,
 * never on DECLINED, and never because a project is unusual.
 *
 * The corpus is the published register on disk, not a network fetch, and it is
 * stratified by technology rather than sampled evenly: wind_offshore is 97 rows
 * of 11,069, so an even sample of 40 would contain none of them and would have
 * reported the offshore engine as fine.
 *
 *   node tools/proofs/202609072356-arrival-engine-sweep.browser.mjs
 *     [--per-tech 4] [--engine chromium|webkit] [--width 393] [--height 852]
 *     [--only wind_offshore,tidal] [--timeout 40000] [--json out.json]
 *
 * 393x852 is the default because the phone is the environment the architect
 * asked to be prioritised, and because this estate's defects have repeatedly
 * been invisible at desktop width.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const playwright = require('playwright');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PER_TECH = Number(arg('--per-tech', '4'));
const ENGINE = arg('--engine', 'chromium');
const VIEWPORT = { width: Number(arg('--width', '393')), height: Number(arg('--height', '852')) };
const ONLY = arg('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const TIMEOUT = Number(arg('--timeout', '40000'));
const JSON_OUT = arg('--json', '');

const REGISTRY = path.join(ROOT, 'data', 'repd_browser_registry_202608290716.json');

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.parquet', 'application/octet-stream'], ['.geojson', 'application/json; charset=utf-8']
]);

/* Range matters: the parquet reader asks for byte ranges, and a server that
   answers 200-with-everything makes DuckDB read the whole file or give up. */
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    const type = MIME.get(path.extname(file)) || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : body.length - 1;
      const slice = body.subarray(start, end + 1);
      response.writeHead(206, {
        'content-type': type,
        'content-range': `bytes ${start}-${end}/${body.length}`,
        'accept-ranges': 'bytes',
        'content-length': String(slice.length)
      });
      response.end(slice);
      return;
    }
    response.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const current = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const sld = (current.cartridges || []).find(c => c.id === 'sld-sandbox');

const registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
const rows = (registry.records || []).filter(r => r && r.repd_ref);

/* Stratify. Even sampling hides the small technologies, and the small
   technologies are exactly where the offshore and interconnector engines
   live. */
const byTech = new Map();
for (const row of rows) {
  const tech = String(row.technology || row.repd_technology || 'unknown');
  if (ONLY.length && !ONLY.includes(tech)) continue;
  if (!byTech.has(tech)) byTech.set(tech, []);
  byTech.get(tech).push(row);
}
const sample = [];
for (const [tech, list] of [...byTech.entries()].sort()) {
  const step = Math.max(1, Math.floor(list.length / PER_TECH));
  for (let i = 0, taken = 0; i < list.length && taken < PER_TECH; i += step, taken += 1) {
    sample.push({ tech, row: list[i] });
  }
}

/* The interconnector engine is not in the register and never can be: the REPD
   is a register of generation and storage, and an interconnector is neither.
   Sampling the register alone therefore reported "the engine fires on every
   technology" while never once asking the interconnector engine anything -
   which is how it shipped leaving arrival_engine null in every one of its
   branches. Its corpus is its own endpoint file, and all ten links are used,
   not a sample: ten cases is not a sampling problem. */
const ENDPOINTS = path.join(ROOT, 'atlas', 'data', 'interconnector-endpoints.json');
if (!ONLY.length || ONLY.includes('interconnector')) {
  try {
    const endpoints = JSON.parse(await readFile(ENDPOINTS, 'utf8'));
    for (const row of (endpoints.endpoints || endpoints.records || endpoints.links || [])) {
      if (!row || !row.bmrs) continue;
      sample.push({
        tech: 'interconnector',
        row: {
          repd_ref: row.bmrs, name: row.link || row.bmrs,
          latitude: row.gb_lat, longitude: row.gb_lon,
          technology: 'interconnector', interconnector: row.bmrs
        }
      });
    }
  } catch (e) {
    console.log(`interconnector corpus unavailable (${String(e.message || e).slice(0, 80)}) — that stratum is not covered by this run`);
  }
}

console.log(`generation ${current.generation} · sld-sandbox ${sld ? sld.version : '(none)'} · ${ENGINE} · ${VIEWPORT.width}x${VIEWPORT.height}`);
console.log(`corpus ${rows.length} rows · ${byTech.size} technologies · ${sample.length} cases (${PER_TECH} per technology)\n`);

if (!sample.length) {
  console.error('no cases selected — the corpus filter matched nothing, which is a broken harness, not a green run');
  server.close();
  process.exit(2);
}

const browser = await playwright[ENGINE].launch();
const context = await browser.newContext({
  viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true
});

const results = [];
let done = 0;

for (const { tech, row } of sample) {
  const ref = String(row.repd_ref);
  /* An interconnector arrival is addressed by BMRS code, not by a REPD ref -
     that is the whole reason the project lane stands down on it. */
  const params = row.interconnector
    ? new URLSearchParams({ interconnector: String(row.interconnector) })
    : new URLSearchParams({ repd_ref: ref });
  if (tech) params.set('technology', tech);
  if (row.latitude != null && row.longitude != null) {
    params.set('latitude', String(row.latitude));
    params.set('longitude', String(row.longitude));
    params.set('zoom', '9');
  }

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));

  const record = {
    ref, tech, name: String(row.name || '').slice(0, 60),
    latitude: row.latitude, longitude: row.longitude,
    outcome: 'SILENT', engine: null, answered: null, reason: null,
    fallback_from: null, links_drawn: null, page_error: null
  };

  try {
    await page.goto(`${base}/atlas/index.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    /* Wait for the sentinel, not for a clock. An arrival that takes 20s and
       answers is working; an arrival that returns in 200ms with nothing is
       the defect this sweep exists to count.

       And wait for a TERMINAL record, not the first one written. An
       interconnector arrival is handed over within milliseconds and that
       handover is a receipt - stopping there would report every interconnector
       as unanswered while its measurement was still running. If the wait times
       out on a non-terminal record, that is reported as PENDING rather than
       silently graded either way: the engine took the arrival and did not
       finish inside the budget, which is a third thing and worth its own name. */
    const sentinel = await page.waitForFunction(
      () => {
        const a = window.__GRIDATLAS_NEON_LINKS__?.arrival_engine;
        return a && a.terminal !== false ? a : null;
      },
      undefined,
      { timeout: TIMEOUT }
    ).then(h => h.jsonValue()).catch(() => null);

    const anySentinel = sentinel || await page.evaluate(
      () => window.__GRIDATLAS_NEON_LINKS__?.arrival_engine || null
    ).catch(() => null);

    const surface = await page.evaluate(() => {
      const l = window.__GRIDATLAS_NEON_LINKS__ || {};
      return { links_drawn: l.links_drawn ?? null, installed: l.installed ?? null, deep_linked: l.deep_linked ?? null };
    }).catch(() => ({}));

    record.links_drawn = surface.links_drawn ?? null;
    if (errors.length) { record.page_error = errors[0].slice(0, 200); record.outcome = 'PAGE_ERROR'; }
    else if (anySentinel) {
      record.engine = anySentinel.engine ?? null;
      record.answered = Boolean(anySentinel.answered);
      record.reason = anySentinel.reason ?? null;
      record.fallback_from = anySentinel.fallback_from ?? null;
      record.terminal = anySentinel.terminal !== false;
      record.outcome = !record.terminal ? 'PENDING'
        : (record.answered ? 'ANSWERED' : 'DECLINED');
    }
  } catch (e) {
    record.outcome = 'PAGE_ERROR';
    record.page_error = String((e && e.message) || e).slice(0, 200);
  }

  await page.close();
  results.push(record);
  done += 1;
  process.stdout.write(`${done}/${sample.length}\r`);
}

await browser.close();
server.close();

/* Per technology, because "the engine fires every time" is false in a way that
   is specific to a technology, and an overall percentage would hide it. */
const techs = [...new Set(results.map(r => r.tech))].sort();
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('technology', 16)} ${pad('cases', 6)} ${pad('answered', 9)} ${pad('declined', 9)} ${pad('pending', 8)} ${pad('silent', 7)} ${pad('error', 6)} engines / reasons`);
for (const tech of techs) {
  const list = results.filter(r => r.tech === tech);
  const n = o => list.filter(r => r.outcome === o).length;
  const engines = [...new Set(list.map(r => r.engine).filter(Boolean))].join(',') || '-';
  const reasons = [...new Set(list.map(r => r.reason).filter(Boolean))].join(',');
  console.log(`${pad(tech, 16)} ${pad(list.length, 6)} ${pad(n('ANSWERED'), 9)} ${pad(n('DECLINED'), 9)} ${pad(n('PENDING'), 8)} ${pad(n('SILENT'), 7)} ${pad(n('PAGE_ERROR'), 6)} ${engines}${reasons ? ' | ' + reasons : ''}`);
}

const silent = results.filter(r => r.outcome === 'SILENT');
const errored = results.filter(r => r.outcome === 'PAGE_ERROR');
const declined = results.filter(r => r.outcome === 'DECLINED');
const pendingCases = results.filter(r => r.outcome === 'PENDING');

console.log(`\nanswered ${results.filter(r => r.outcome === 'ANSWERED').length} · declined ${declined.length} · pending ${pendingCases.length} · silent ${silent.length} · page error ${errored.length}  (of ${results.length})`);

if (pendingCases.length) {
  console.log(`\nPENDING — an engine took the arrival and had not finished within ${TIMEOUT} ms:`);
  for (const r of pendingCases.slice(0, 30)) {
    console.log(`  ${pad(r.tech, 15)} ref ${pad(r.ref, 7)} ${r.engine} · ${r.reason}  ${r.name}`);
  }
}

if (declined.length) {
  console.log('\ndeclined, with the reason the engine gave:');
  for (const r of declined.slice(0, 30)) {
    console.log(`  ${pad(r.tech, 15)} ref ${pad(r.ref, 7)} ${r.engine} · ${r.reason}${r.fallback_from ? ` · fell back from ${r.fallback_from}` : ''}  ${r.name}`);
  }
  if (declined.length > 30) console.log(`  … and ${declined.length - 30} more`);
}
if (silent.length) {
  console.log('\nSILENT — the arrival finished and never named an engine:');
  for (const r of silent.slice(0, 30)) {
    console.log(`  ${pad(r.tech, 15)} ref ${pad(r.ref, 7)} links_drawn=${r.links_drawn}  ${r.name}`);
  }
  if (silent.length > 30) console.log(`  … and ${silent.length - 30} more`);
}
if (errored.length) {
  console.log('\npage errors:');
  for (const r of errored.slice(0, 15)) console.log(`  ${pad(r.tech, 15)} ref ${pad(r.ref, 7)} ${r.page_error}`);
}

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify({
    schema: 'gridatlas.arrival-engine-sweep.v1',
    generation: current.generation,
    sld_sandbox: sld ? sld.version : null,
    engine: ENGINE, viewport: VIEWPORT, per_tech: PER_TECH,
    run_utc: new Date().toISOString(),
    results
  }, null, 1) + '\n', 'utf8');
  console.log(`\nwrote ${JSON_OUT}`);
}

process.exit(silent.length || errored.length ? 1 : 0);
