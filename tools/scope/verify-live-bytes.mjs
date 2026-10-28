#!/usr/bin/env node
/* Byte-for-byte check that the public GitHub Pages site serves exactly what a
   commit declares. Dependency-free (Node >= 20 fetch), no browser.

   Compared paths, all relative to the repository root:
     - atlas/current.json and atlas/index.html
     - every path in atlas/current.json that names a committed file: each
       cartridge's `path` (mandatory), plus its contract, module, manifest and
       shell references when those resolve to a committed file
     - every committed file under atlas/v/<generation>/ (preview routes)

   Pages and its CDN lag a push by minutes, so mismatches are retried with
   cache-busting queries until --timeout-s expires. Exit 0 only when every path
   matches; exit 1 with a per-path report otherwise.

   Usage:
     node tools/scope/verify-live-bytes.mjs [--root DIR] [--base URL]
          [--timeout-s 900] [--interval-s 20] [--report FILE]
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const ROOT = path.resolve(argument('root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')));
const BASE = String(argument('base', process.env.GRIDATLAS_BASE_URL || 'https://ventusltd.github.io/gridatlas/')).replace(/\/?$/, '/');
const TIMEOUT_MS = Number(argument('timeout-s', process.env.LIVE_BYTES_TIMEOUT_S || 900)) * 1000;
const INTERVAL_MS = Number(argument('interval-s', process.env.LIVE_BYTES_INTERVAL_S || 20)) * 1000;
const REPORT = argument('report', process.env.LIVE_BYTES_REPORT || '');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/* Committed bytes, not the working tree: a CRLF checkout or a stray edit must
   not decide what "committed" means. Falls back to the file when ROOT is not a
   Git checkout (e.g. an exported tree). */
function committedBytes(relative) {
  try {
    return execFileSync('git', ['-C', ROOT, 'show', `HEAD:${relative}`], { maxBuffer: 1 << 30 });
  } catch {
    return fs.readFileSync(path.join(ROOT, relative));
  }
}

function committedFiles(prefix) {
  try {
    return execFileSync('git', ['-C', ROOT, 'ls-tree', '-r', '--name-only', 'HEAD', '--', prefix], { encoding: 'utf8' })
      .split('\n').filter(Boolean).sort();
  } catch {
    const out = [];
    const walk = dir => {
      if (!fs.existsSync(path.join(ROOT, dir))) return;
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const child = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(child); else if (entry.isFile()) out.push(child);
      }
    };
    walk(prefix.replace(/\/$/, ''));
    return out.sort();
  }
}

function isCommittedFile(relative) {
  try {
    execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `HEAD:${relative}`], { stdio: 'ignore' });
    return execFileSync('git', ['-C', ROOT, 'cat-file', '-t', `HEAD:${relative}`], { encoding: 'utf8' }).trim() === 'blob';
  } catch {
    return fs.existsSync(path.join(ROOT, relative)) && fs.statSync(path.join(ROOT, relative)).isFile();
  }
}

/* Resolve a current.json reference ("./cartridges/x.js", "../ui/y.mjs")
   against atlas/ and keep it only if it stays inside the repository. */
function resolveAtlasReference(value) {
  const joined = path.posix.normalize(path.posix.join('atlas', value));
  return joined.startsWith('../') || joined.startsWith('/') ? null : joined;
}

function collectTargets() {
  const current = JSON.parse(committedBytes('atlas/current.json').toString('utf8'));
  const targets = new Map();
  const add = (relative, why) => { if (!targets.has(relative)) targets.set(relative, why); };
  add('atlas/current.json', 'live pointer');
  add('atlas/index.html', 'live router');

  const problems = [];
  const cartridges = Array.isArray(current.cartridges) ? current.cartridges : [];
  if (!cartridges.length) problems.push('atlas/current.json declares no cartridges');
  for (const cartridge of cartridges) {
    const relative = typeof cartridge?.path === 'string' ? resolveAtlasReference(cartridge.path) : null;
    if (!relative || !isCommittedFile(relative)) {
      problems.push(`cartridge ${cartridge?.id}: path ${cartridge?.path} is not a committed file`);
      continue;
    }
    add(relative, `cartridge ${cartridge.id}`);
    if (cartridge.sha256) {
      const actual = sha256(committedBytes(relative));
      if (actual !== cartridge.sha256) problems.push(`cartridge ${cartridge.id}: committed ${relative} sha256 ${actual} != declared ${cartridge.sha256}`);
    }
  }

  // Every other relative reference that names a committed file.
  const walk = (value, where) => {
    if (typeof value === 'string') {
      if (!/^\.\.?\//.test(value)) return;
      const relative = resolveAtlasReference(value);
      if (relative && isCommittedFile(relative)) add(relative, `current.json ${where}`);
    } else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${where}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, where ? `${where}.${k}` : k);
  };
  walk(current, '');

  const previews = committedFiles('atlas/v/').filter(file => /^atlas\/v\/[^/]+\/.+/.test(file));
  if (!previews.length) problems.push('no committed preview files under atlas/v/');
  for (const file of previews) add(file, `preview ${file.split('/')[2]}`);
  return { current, targets, problems };
}

async function fetchLive(relative, attempt) {
  const url = `${BASE}${relative}?live_bytes=${Date.now()}-${attempt}`;
  try {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, redirect: 'follow' });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, url };
  } catch (error) {
    return { status: 0, bytes: null, url, error: String(error?.message || error) };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const { current, targets, problems } = collectTargets();
  const expected = new Map([...targets.keys()].map(relative => {
    const bytes = committedBytes(relative);
    return [relative, { bytes: bytes.length, sha256: sha256(bytes) }];
  }));
  let commit = null;
  try { commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}

  const results = new Map();
  const pending = new Set(targets.keys());
  const deadline = Date.now() + TIMEOUT_MS;
  let attempt = 0;
  while (pending.size) {
    attempt += 1;
    for (const relative of [...pending]) {
      const live = await fetchLive(relative, attempt);
      const want = expected.get(relative);
      const got = live.bytes ? { bytes: live.bytes.length, sha256: sha256(live.bytes) } : null;
      const match = live.status === 200 && got?.sha256 === want.sha256;
      results.set(relative, { path: relative, why: targets.get(relative), http: live.status, expected: want, live: got, match, attempts: attempt, error: live.error });
      if (match) pending.delete(relative);
    }
    console.log(`attempt ${attempt}: ${targets.size - pending.size}/${targets.size} paths match`);
    if (!pending.size || Date.now() + INTERVAL_MS > deadline) break;
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
  }

  const mismatches = [...results.values()].filter(row => !row.match);
  const report = {
    schema: 'gridatlas.live-bytes-verification.v1',
    base_url: BASE,
    commit,
    generation: current.generation,
    composition_version: current.composition_version ?? null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    attempts: attempt,
    paths_checked: targets.size,
    paths_matched: targets.size - mismatches.length,
    problems,
    status: mismatches.length || problems.length ? 'FAIL' : 'PASS',
    mismatches,
    results: [...results.values()].map(({ path: p, why, http, match, expected: e, attempts }) => ({ path: p, why, http, match, bytes: e.bytes, sha256: e.sha256, attempts }))
  };
  if (REPORT) {
    fs.mkdirSync(path.dirname(path.resolve(REPORT)), { recursive: true });
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report=${REPORT}`);
  }
  for (const problem of problems) console.error(`::error title=live-bytes::${problem}`);
  for (const row of mismatches) {
    const live = row.live ? `${row.live.bytes} B sha256 ${row.live.sha256}` : `no body (${row.error || 'fetch failed'})`;
    console.error(`::error title=live-bytes mismatch::${row.path} (${row.why}) HTTP ${row.http}: committed ${row.expected.bytes} B sha256 ${row.expected.sha256}, live ${live}`);
  }
  console.log(`${report.status}: ${report.paths_matched}/${report.paths_checked} live paths byte-identical to ${commit || 'working tree'} (generation ${current.generation}) at ${BASE}`);
  if (report.status !== 'PASS') process.exitCode = 1;
}

await main();
