#!/usr/bin/env node
/**
 * Step 7 of the delivery flow: a served check of www.globalgrid2050.com.
 *
 *   node tools/release/check-served.mjs [--generation G] [--timeout-s 900] [--interval-s 30] [--report FILE]
 *
 * PRE-CONDITIONS
 *   - the domain pin PR is merged and deploy-pages.yml ran for globalgrid2050
 *     main (tools/release/homepage-bump.mjs deploy);
 *   - network access to www.globalgrid2050.com. Some sandboxes block it; then
 *     run it in CI instead (exactly the same script):
 *       gh api -X POST repos/Ventusltd/gridatlas/actions/workflows/202608301321-verify-live.yml/dispatches \
 *         -f ref=main -f 'inputs[mode]=served-homepage'
 *
 * WHAT IT CHECKS (expected values all come from GitHub, served values from the domain)
 *   1. globalgrid2050 main's catalogue/homepage-owner.json pins a homepage commit;
 *      the pinned data/homepage.json makes G the operative GridAtlas release
 *      (G defaults to the generation gridatlas main serves: the homepage must
 *      advertise what is live);
 *   2. served homepage-shell/data/homepage.json and homepage-shell/assets/
 *      versioned-homepage.{css,js} are byte-identical to the pin's SHA-256s;
 *   3. the served homepage (/) carries the GridAtlas row with G's label
 *      (e.g. "V9.176 - 29 October 2026") and links the live route.
 * Retries with cache-busting queries until --timeout-s (Pages/CDN lag).
 * Exit 0 PASS, 1 FAIL, 2 cannot reach the domain.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from './lib.mjs';
import { GRIDATLAS, HOMEPAGE, DOMAIN, DOMAIN_BASE, PAGES_BASE, ghFile, writeJson } from './flow-lib.mjs';

const TOOL = 'check-served';
let args;
try {
  args = parseArgs(process.argv.slice(2), { generation: {}, 'timeout-s': { default: '900' }, 'interval-s': { default: '30' }, report: {}, base: { default: DOMAIN_BASE } });
} catch (error) { console.error(`${TOOL}: ${error.message}`); process.exit(2); }
const BASE = args.base.replace(/\/?$/, '/');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'served-'));

/** curl, because it honours HTTPS_PROXY where Node's fetch does not. */
function get(url) {
  const out = path.join(tmp, 'body');
  const r = spawnSync('curl', ['-sS', '-L', '--max-time', '30', '-H', 'Cache-Control: no-cache', '-o', out, '-w', '%{http_code}', url], { encoding: 'utf8' });
  const http = Number(r.stdout) || 0;
  return { http, body: http ? fs.readFileSync(out) : null, error: http ? null : (r.stderr || '').trim() };
}

/* ------------------------------------------------------------- expected */
const live = JSON.parse(ghFile(GRIDATLAS, 'main', 'atlas/current.json'));
const G = args.generation || String(live.generation);
const pin = JSON.parse(ghFile(DOMAIN, 'main', 'catalogue/homepage-owner.json'));
const pinnedHome = JSON.parse(ghFile(HOMEPAGE, pin.commit, 'data/homepage.json'));
const entity = pinnedHome.entities.find(e => e.id === 'gridatlas');
const release = entity.releases.find(r => r.id === entity.operative_release_id);
const report = { tool: TOOL, base: BASE, generation: G, gridatlas_live: String(live.generation), pin: pin.commit,
  operative_release: entity.operative_release_id, label: release?.label, problems: [], attempts: 0, checks: [] };
const finish = (status, code) => {
  report.status = status;
  if (args.report) writeJson(args.report, report);
  console.log(`${status}: ${report.problems.length ? report.problems.join('; ') : `${BASE} serves the pinned homepage with GridAtlas "${report.label}"`}`);
  process.exit(code);
};
if (entity.operative_release_id !== G) { report.problems.push(`the pinned homepage (${pin.commit.slice(0, 12)}) makes ${entity.operative_release_id} operative, not ${G}`); finish('FAIL', 1); }
if (String(live.generation) !== G) report.problems.push(`note: gridatlas main serves ${live.generation}, not ${G}`);
console.log(`pin ${pin.commit.slice(0, 12)}: GridAtlas ${G} "${release.label}"`);

/* --------------------------------------------------------------- served */
const files = [['homepage-shell/data/homepage.json', 'data/homepage.json'],
  ['homepage-shell/assets/versioned-homepage.css', 'assets/versioned-homepage.css'],
  ['homepage-shell/assets/versioned-homepage.js', 'assets/versioned-homepage.js']];
const deadline = Date.now() + Number(args['timeout-s']) * 1000;
for (;;) {
  report.attempts += 1;
  const q = `?served-check=${Date.now()}`;
  const checks = [];
  let unreachable = null;
  for (const [served, pinned] of files) {
    const r = get(`${BASE}${served}${q}`);
    if (!r.http) unreachable = r.error;
    const got = r.body ? sha256(r.body) : null;
    checks.push({ path: served, http: r.http, ok: r.http === 200 && got === pin.files[pinned], expected: pin.files[pinned], live: got });
  }
  const home = get(`${BASE}${q}`);
  if (!home.http) unreachable = home.error;
  const html = home.body ? home.body.toString('utf8') : '';
  const row = (html.match(/<tr data-entity-id="gridatlas">[\s\S]*?<\/tr>/) || [''])[0];
  checks.push({ path: '/', http: home.http, ok: home.http === 200 && row.includes(release.label) && row.includes(`${PAGES_BASE}atlas/`),
    expected: `GridAtlas row with "${release.label}" linking ${PAGES_BASE}atlas/`, live: row ? row.slice(0, 120) : 'no GridAtlas row' });
  report.checks = checks;
  for (const c of checks) console.log(`  ${c.ok ? 'OK  ' : 'DIFF'}  ${c.path}  HTTP ${c.http}`);
  if (checks.every(c => c.ok)) finish('PASS', 0);
  if (unreachable && report.attempts === 1 && !checks.some(c => c.http)) {
    report.problems.push(`cannot reach ${BASE}: ${unreachable}; run it in CI (see the header)`);
    finish('BLOCKED', 2);
  }
  if (Date.now() > deadline) {
    report.problems.push(...checks.filter(c => !c.ok).map(c => `${c.path}: expected ${c.expected}, served ${c.live} (HTTP ${c.http})`));
    finish('FAIL', 1);
  }
  sleep(Number(args['interval-s']));
}
