/* repd-deep-link-sweep.browser.mjs — arrive on many REPD deep links, not five.
 *
 * "test as many REPD deep links as you can" -- the architect, 2026-09-05.
 *
 * The existing arrival proofs check a small golden set. This sweeps a large
 * sample of the published REPD corpus through the SAME arrival path and
 * reports what actually happened on each one, so a defect that only shows on,
 * say, the fourth technology bucket or a project with no coordinates cannot
 * hide behind five green cases.
 *
 * It reports measurements. It does not grade a project's grid position and it
 * does not decide whether a run is acceptable -- it prints per-case outcomes
 * and a tally, and exits non-zero only when a case ERRORS (a thrown page
 * error or a blank arrival), never merely because a project is unusual.
 *
 *   node tools/proofs/repd-deep-link-sweep.browser.mjs [--cases 60] [--engine chromium|webkit]
 *     [--width 393] [--height 852]
 *
 * Defaults are 393x852 -- the phone -- because that is the environment the
 * architect asked to be prioritised, and because this estate's defects have
 * repeatedly been invisible at desktop width. WebKit is available locally and
 * is a closer proxy to iOS Safari than Chromium is, but it is NOT iOS: a real
 * iPhone remains the only evidence for an iOS-only fault.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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

const CASES = Number(arg('--cases', '60'));
const ENGINE = arg('--engine', 'chromium');
const VIEWPORT = { width: Number(arg('--width', '393')), height: Number(arg('--height', '852')) };
const REPD_MANIFEST_URL =
  'https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.parquet', 'application/octet-stream']
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': MIME.get(path.extname(file)) || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const current = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
console.log(`generation ${current.generation} · ${ENGINE} · ${VIEWPORT.width}x${VIEWPORT.height} · ${CASES} cases\n`);

const manifest = await (await fetch(REPD_MANIFEST_URL)).json();
const rows = (manifest.projects || manifest.rows || manifest.features || [])
  .map(r => (r.properties ? { ...r.properties, ...r } : r))
  .filter(r => r && (r.repd_ref || r.ref || r.repd_id));

/* Spread the sample across the corpus rather than taking the first N, so a
   defect confined to one technology or one region cannot be sampled away. */
const step = Math.max(1, Math.floor(rows.length / CASES));
const sample = [];
for (let i = 0; i < rows.length && sample.length < CASES; i += step) sample.push(rows[i]);

const browser = await playwright[ENGINE].launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const tally = { arrived: 0, no_identity: 0, page_error: 0 };
const failures = [];

for (const row of sample) {
  const ref = row.repd_ref || row.ref || row.repd_id;
  const lat = row.latitude ?? row.lat;
  const lon = row.longitude ?? row.lon;
  const tech = row.technology || row.tech || '';
  const params = new URLSearchParams({ repd_ref: String(ref) });
  if (tech) params.set('technology', String(tech));
  if (lat != null && lon != null) { params.set('latitude', String(lat)); params.set('longitude', String(lon)); params.set('zoom', '9'); }

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  try {
    await page.goto(`${base}/atlas/index.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    /* The arrival is identified by the page itself; wait for the identity to
       appear rather than for a fixed time, and cap the wait so one bad case
       cannot stall the sweep. */
    const identity = await page.waitForFunction(() => {
      const t = document.body ? document.body.innerText : '';
      return /REPD|repd_ref|Measuring|measured/i.test(t) ? t.slice(0, 400) : null;
    }, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null);

    if (errors.length) { tally.page_error += 1; failures.push({ ref, why: 'page error', detail: errors[0].slice(0, 160) }); }
    else if (!identity) { tally.no_identity += 1; failures.push({ ref, why: 'no arrival identity within 30s', detail: `${tech} ${lat},${lon}` }); }
    else { tally.arrived += 1; }
  } catch (e) {
    tally.page_error += 1;
    failures.push({ ref, why: 'navigation failed', detail: String(e.message || e).slice(0, 160) });
  }
  await page.close();
  process.stdout.write(`${tally.arrived + tally.no_identity + tally.page_error}/${sample.length}\r`);
}

await browser.close();
server.close();

console.log(`\narrived ${tally.arrived} · no identity ${tally.no_identity} · page error ${tally.page_error}  (of ${sample.length})\n`);
for (const f of failures.slice(0, 25)) console.log(`  ref ${f.ref}: ${f.why} -- ${f.detail}`);
if (failures.length > 25) console.log(`  … and ${failures.length - 25} more`);

process.exit(tally.page_error > 0 ? 1 : 0);
