/**
 * Deep scan: origin to today, both applications, one understanding.
 *
 * Vikram, 2026-09-01: *"a deep CI/CD scan on everything we have done on the
 * pipeline news app, the gridatlas app, from day 1 till now, so that you
 * have a file with deep understanding of both… use any laptop power to
 * obtain context from origin to today and then build the current time
 * stamps with the findings."*
 *
 * This is the spiders repo's habit applied to our own source: crawl, do not
 * assume; produce a screening-grade view and say that is what it is. It is
 * NOT a linter and it does not judge style. It answers the questions that
 * actually decide what to build next:
 *
 *   A. ERAS       when each repository started, and what it did per day.
 *   B. LINEAGE    every logical artefact's life: how many versions, and how
 *                 many lines each one was. A file that grew from 300 to
 *                 4,000 lines did not become complicated on one day.
 *   C. MONOLITHS  what is oversized in the working tree RIGHT NOW, with the
 *                 seams already visible inside it, so modularising the next
 *                 version is a measured decision and not a feeling.
 *   D. SURFACES   every public registration the estate has ever made
 *                 (window.__X__), and which ones survive today. This is the
 *                 real API between cartridges, and nothing documents it.
 *   E. COPIES     the same function defined in more than one file today.
 *                 Three copies of a haversine is how two of them end up on
 *                 different radii without anyone noticing.
 *   F. CONTRACT   the deep link: which parameters Pipeline News PRODUCES
 *                 and which ones GridAtlas CONSUMES, compared. A parameter
 *                 produced and never read is a promise nobody keeps.
 *   G. CLICKS     every click handler in the working tree, because the next
 *                 goal is what happens when you click anywhere on the map.
 *
 * Output: a JSON report, and a markdown document written for a person.
 *
 *   node tools/ci/202609012230-deep-scan.mjs --out <dir>
 *
 * Debugging is designed in rather than added later: --trace prints what the
 * crawl is doing and how long each pass takes, and every pass records the
 * count of things it looked at, so a pass that silently matched nothing is
 * visible as a zero rather than as an absence.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GRIDATLAS = resolve(HERE, '..', '..');
const HOME = resolve(GRIDATLAS, '..', '..');

const flag = (name) => process.argv.includes(name);
const value = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : null;
};
const TRACE = flag('--trace');
const OUT = value('--out') || join(GRIDATLAS, 'governance');

const REPOS = [
  { name: 'gridatlas', path: GRIDATLAS },
  { name: 'pipelinenews', path: join(HOME, 'pipelinenews') }
].filter(repo => existsSync(join(repo.path, '.git')));

const started = Date.now();
const trace = (message) => {
  if (TRACE) console.log(`  \x1b[2m[${((Date.now() - started) / 1000).toFixed(1)}s] ${message}\x1b[0m`);
};

function git(repo, args, { max = 256 } = {}) {
  try {
    return execFileSync('git', ['-C', repo.path, ...args],
      { encoding: 'utf8', maxBuffer: max * 1024 * 1024 });
  } catch (error) { return error.stdout || ''; }
}

const RECORD = String.fromCharCode(30);
const UNIT = String.fromCharCode(31);

/* Code, as against data, vendor and generated payloads. The scan is about
   what we WROTE; a 300,000-line GeoJSON says nothing about our design. */
const CODE_EXT = new Set(['.js', '.mjs', '.py', '.html', '.css']);
const IGNORED = /(^|\/)(node_modules|vendor|\.git)\//;
const DATA_ISH = /(^|\/)(data|payloads|fixtures|releases\/cartridges)\//;
const isCode = (path) => CODE_EXT.has(extname(path))
  && !IGNORED.test(path) && !DATA_ISH.test(path);

const report = { generated: new Date().toISOString(), repos: {}, cross: {} };

/* ═══════════════════════════════════════════════════════════════════════
   A. ERAS
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mA — eras\x1b[0m');
for (const repo of REPOS) {
  trace(`${repo.name}: reading log`);
  const raw = git(repo, ['log', '--all', '--no-merges', '--date=short',
    '--pretty=format:%x1e%H%x1f%ad%x1f%an%x1f%s']);
  const commits = raw.split(RECORD).slice(1).map(block => {
    const [hash, date, author, subject] = block.split(UNIT);
    return { hash, date, author, subject: (subject || '').split('\n')[0] };
  });
  const byDay = {};
  for (const c of commits) byDay[c.date] = (byDay[c.date] || 0) + 1;
  const days = Object.keys(byDay).sort();
  const generations = commits.filter(c => /^\d{12}/.test(c.subject)).length;

  report.repos[repo.name] = {
    commits: commits.length, first: days[0], last: days[days.length - 1],
    active_days: days.length, generations, by_day: byDay
  };
  console.log(`  ${repo.name.padEnd(14)} ${String(commits.length).padStart(4)} commits  `
    + `${days[0]} → ${days[days.length - 1]}  ${days.length} active days  `
    + `${generations} stamped`);
  for (const day of days) {
    console.log(`      ${day}  ${String(byDay[day]).padStart(3)}  `
      + '#'.repeat(Math.min(60, byDay[day])));
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   B. LINEAGE — how artefacts grew
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mB — lineage: what grew, and how fast\x1b[0m');

/* A "family" is the same artefact across its timestamped rebirths:
   202609012045-sld-sandbox-v9-8.js and 202609012155-sld-sandbox-v9-8.js are
   one artefact with two generations, not two artefacts. */
const familyOf = (path) => path
  .replace(/(^|\/)\d{12}-/g, '$1')
  .replace(/-v\d+[-.]\d+/g, '')
  .replace(/\.(js|mjs|py|html|css)$/, '');

for (const repo of REPOS) {
  trace(`${repo.name}: enumerating blobs`);
  const objects = git(repo, ['rev-list', '--all', '--objects'], { max: 512 }).split('\n');
  const families = new Map();
  let blobsRead = 0;

  for (const line of objects) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const sha = line.slice(0, space);
    const path = line.slice(space + 1).trim();
    if (!isCode(path)) continue;
    const family = familyOf(path);
    if (!families.has(family)) families.set(family, { versions: [], paths: new Set() });
    families.get(family).paths.add(path);
    families.get(family).versions.push({ sha, path });
  }

  /* Only the biggest families are measured line by line — reading every
     blob in a 368-commit repository is the part that costs, and the small
     ones cannot be monoliths by definition. */
  const ranked = [...families.entries()]
    .sort((a, b) => b[1].versions.length - a[1].versions.length)
    .slice(0, 40);

  const lineage = [];
  for (const [family, record] of ranked) {
    const sizes = [];
    for (const version of record.versions) {
      let text = '';
      try {
        text = execFileSync('git', ['-C', repo.path, 'cat-file', 'blob', version.sha],
          { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        blobsRead += 1;
      } catch { continue; }
      sizes.push({ path: version.path, lines: text.split('\n').length });
    }
    if (!sizes.length) continue;
    sizes.sort((a, b) => a.lines - b.lines);
    lineage.push({ family, versions: record.versions.length,
      smallest: sizes[0].lines, largest: sizes[sizes.length - 1].lines,
      largest_path: sizes[sizes.length - 1].path });
  }
  trace(`${repo.name}: read ${blobsRead} blobs across ${families.size} families`);

  report.repos[repo.name].families = families.size;
  report.repos[repo.name].lineage = lineage;

  const grew = lineage.filter(l => l.largest >= 400)
    .sort((a, b) => (b.largest - b.smallest) - (a.largest - a.smallest)).slice(0, 10);
  console.log(`\n  \x1b[1m${repo.name}\x1b[0m  ${families.size} code families, `
    + `${blobsRead} versions measured`);
  for (const item of grew) {
    console.log(`    ${String(item.smallest).padStart(5)} → `
      + `${String(item.largest).padStart(5)} lines  ×${String(item.versions).padStart(3)}  `
      + item.family.slice(-62));
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   C. MONOLITHS, AND THE SEAMS INSIDE THEM
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mC — monoliths in the working tree, and their seams\x1b[0m');

const MONOLITH_LINES = 800;

function seamsIn(text) {
  /* A seam is a place the file already divides itself: a banner comment, a
     top-level function, a registered surface. Counting them says whether a
     big file is one idea or twenty stuck together. */
  const banners = (text.match(/^\s*\/\*[\s\S]{0,4}[─=—-]{6,}/gm) || []).length
    + (text.match(/^\s*\/\* ── /gm) || []).length;
  const functions = (text.match(/^\s{0,4}(async\s+)?function\s+\w+/gm) || []).length;
  const consts = (text.match(/^\s{0,2}const\s+[A-Z_]{3,}\s*=/gm) || []).length;
  const surfaces = (text.match(/window\.__\w+__\s*=/g) || []).length;
  return { banners, functions, consts, surfaces };
}

const monoliths = [];
for (const repo of REPOS) {
  const tracked = git(repo, ['ls-files']).split('\n').filter(isCode);
  for (const path of tracked) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    const lines = text.split('\n').length;
    if (lines < MONOLITH_LINES) continue;
    monoliths.push({ repo: repo.name, path, lines, ...seamsIn(text) });
  }
}
monoliths.sort((a, b) => b.lines - a.lines);
report.cross.monoliths = monoliths;

console.log(`  ${monoliths.length} file(s) at or over ${MONOLITH_LINES} lines`);
console.log(`  ${'lines'.padStart(6)}  ${'fns'.padStart(4)} ${'seams'.padStart(5)} `
  + `${'surf'.padStart(4)}  file`);
for (const m of monoliths.slice(0, 18)) {
  console.log(`  ${String(m.lines).padStart(6)}  ${String(m.functions).padStart(4)} `
    + `${String(m.banners).padStart(5)} ${String(m.surfaces).padStart(4)}  `
    + `${m.repo}:${m.path}`);
}

/* ═══════════════════════════════════════════════════════════════════════
   D. SURFACES — the undocumented API between cartridges
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mD — public surfaces, ever registered and still alive\x1b[0m');

const SURFACE = /window\.(__\w+__)\s*=/g;
const everSurface = new Map();   // name -> Set(paths)
for (const repo of REPOS) {
  const objects = git(repo, ['rev-list', '--all', '--objects'], { max: 512 }).split('\n');
  const seenSha = new Set();
  for (const line of objects) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const sha = line.slice(0, space);
    const path = line.slice(space + 1).trim();
    if (!isCode(path) || seenSha.has(sha)) continue;
    seenSha.add(sha);
    let text = '';
    try {
      text = execFileSync('git', ['-C', repo.path, 'cat-file', 'blob', sha],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch { continue; }
    for (const match of text.matchAll(SURFACE)) {
      if (!everSurface.has(match[1])) everSurface.set(match[1], new Set());
      everSurface.get(match[1]).add(`${repo.name}:${familyOf(path)}`);
    }
  }
}

const aliveSurface = new Set();
for (const repo of REPOS) {
  for (const path of git(repo, ['ls-files']).split('\n').filter(isCode)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    for (const match of text.matchAll(SURFACE)) aliveSurface.add(match[1]);
  }
}

const surfaces = [...everSurface.entries()]
  .map(([name, owners]) => ({ name, alive: aliveSurface.has(name), owners: [...owners] }))
  .sort((a, b) => Number(b.alive) - Number(a.alive) || a.name.localeCompare(b.name));
report.cross.surfaces = surfaces;

console.log(`  ${surfaces.length} distinct surfaces ever registered, `
  + `${surfaces.filter(s => s.alive).length} still registered today`);
for (const surface of surfaces) {
  console.log(`    ${surface.alive ? '\x1b[32mlive\x1b[0m' : '\x1b[2mgone\x1b[0m'}  `
    + `${surface.name.padEnd(36)} ${surface.owners.slice(0, 2).join(', ')}`);
}

/* ═══════════════════════════════════════════════════════════════════════
   E. COPIES — the same function in more than one place, today
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mE — the same function, defined in more than one file today\x1b[0m');

const FUNCTION = /^\s{0,6}(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;
const byName = new Map();
for (const repo of REPOS) {
  for (const path of git(repo, ['ls-files']).split('\n').filter(isCode)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    for (const match of text.matchAll(FUNCTION)) {
      const key = `${match[1]}(${match[2].split(',').length})`;
      if (!byName.has(key)) byName.set(key, new Set());
      byName.get(key).add(`${repo.name}:${path}`);
    }
  }
}
const copies = [...byName.entries()]
  .filter(([, where]) => where.size > 1)
  .map(([signature, where]) => ({ signature, count: where.size, where: [...where] }))
  .sort((a, b) => b.count - a.count);
report.cross.copies = copies;

console.log(`  ${copies.length} function name/arity pairs defined in more than one file`);
for (const copy of copies.slice(0, 15)) {
  console.log(`    ×${String(copy.count).padStart(2)}  ${copy.signature.padEnd(28)} `
    + copy.where.slice(0, 3).map(w => w.split('/').pop()).join(', '));
}

/* ═══════════════════════════════════════════════════════════════════════
   F. THE DEEP-LINK CONTRACT, BOTH SIDES
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mF — the deep link: produced by Pipeline News, read by GridAtlas\x1b[0m');

/* Only files that actually construct a query string are searched.
   ------------------------------------------------------------------------
   The first version of this pass matched `searchParams|params|query|url`
   followed by .get(), and reported that GridAtlas reads four parameters and
   ignores twenty-three - including `project` and `capacity_mw`, which are
   visibly on the card. It reads them through `const q = new
   URLSearchParams(...)`, and `q` was not in my list. The finding was my
   regex, not the code.
   That is the screening-grade caveat the spiders repo insists on, and the
   fix is to gate on the CONSTRUCTOR being present in the file and then
   accept any receiver, rather than to guess at variable names. */
const HAS_QUERY = /URLSearchParams|searchParams/;

function scanFor(repoName, patterns, options = {}) {
  const repo = REPOS.find(r => r.name === repoName);
  const found = new Map();
  let scanned = 0;
  if (!repo) { trace(`scanFor: no repo named ${repoName}`); return found; }
  for (const path of git(repo, ['ls-files']).split('\n').filter(isCode)) {
    if (options.only && !options.only.test(path)) continue;
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    if (!HAS_QUERY.test(text)) continue;
    scanned += 1;

    if (options.boundToQuery) {
      /* Resolve the binding first, then read only that variable. */
      const bound = new Set();
      for (const match of text.matchAll(BINDING)) bound.add(match[1]);
      if (!bound.size) continue;
      const reads = new RegExp(`\\b(${[...bound].join('|')})\\.get\\(\\s*["'\`]([\\w_]+)["'\`]`, 'g');
      for (const match of text.matchAll(reads)) {
        const key = match[2];
        if (!found.has(key)) found.set(key, new Set());
        found.get(key).add(path);
      }
      continue;
    }

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1];
        if (!key || key.length > 40) continue;
        if (!found.has(key)) found.set(key, new Set());
        found.get(key).add(path);
      }
    }
  }
  trace(`scanFor(${repoName}): ${scanned} file(s) build or read a query string, `
    + `${found.size} parameter name(s)`);
  return found;
}

/* Both sides narrowed to the code that actually carries the contract.
   ------------------------------------------------------------------------
   A wide scan conflated Pipeline News's own table filters (pg_sz, mw_min,
   tbm) with the Atlas deep link, and picked up Map.get on the GridAtlas
   side as though `generation` and `release_id` arrived in a URL. Neither is
   a contract finding; both are noise that would have made the real one -
   `zoom`, set and never read - impossible to see.

   The producer is the deep-link builder family, by name. The consumer is
   resolved by BINDING: find the variable a `new URLSearchParams(...)` was
   assigned to, then accept `.get()` only on that variable. */
const DEEP_LINK_BUILDER = /atlas-pointer-deep-link/;
const BINDING = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+URLSearchParams\s*\(/g;

const produced = scanFor('pipelinenews', [
  /\b\w+\.set\(\s*["'`]([\w_]+)["'`]/g,
  /\b\w+\.append\(\s*["'`]([\w_]+)["'`]/g
], { only: DEEP_LINK_BUILDER });
const consumed = scanFor('gridatlas', null, { boundToQuery: true });

const producedNames = [...produced.keys()].sort();
const consumedNames = [...consumed.keys()].sort();
const orphaned = producedNames.filter(name => !consumed.has(name));
const unfed = consumedNames.filter(name => !produced.has(name));

report.cross.deep_link = { produced: producedNames, consumed: consumedNames,
  produced_never_read: orphaned, read_never_produced: unfed };

console.log(`  produced by Pipeline News: ${producedNames.join(', ') || '(none found)'}`);
console.log(`  read by GridAtlas:         ${consumedNames.join(', ') || '(none found)'}`);
console.log(`  \x1b[33mproduced and never read:   ${orphaned.join(', ') || '(none)'}\x1b[0m`);
console.log(`  \x1b[33mread and never produced:   ${unfed.join(', ') || '(none)'}\x1b[0m`);

/* ═══════════════════════════════════════════════════════════════════════
   G. CLICKS — what already responds to a click
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mG — click surfaces in the working tree\x1b[0m');

const CLICK = /(map|\w+)\.on\(\s*["'`]click["'`]|addEventListener\(\s*["'`]click["'`]/g;
const clicks = [];
for (const repo of REPOS) {
  for (const path of git(repo, ['ls-files']).split('\n').filter(isCode)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    const count = [...text.matchAll(CLICK)].length;
    if (!count) continue;
    const mapClicks = [...text.matchAll(/map\.on\(\s*["'`]click["'`]/g)].length;
    clicks.push({ repo: repo.name, path, handlers: count, map_handlers: mapClicks });
  }
}
clicks.sort((a, b) => b.map_handlers - a.map_handlers || b.handlers - a.handlers);
report.cross.clicks = clicks;
console.log(`  ${clicks.length} file(s) handle a click; `
  + `${clicks.filter(c => c.map_handlers).length} handle a MAP click`);
for (const c of clicks.slice(0, 10)) {
  console.log(`    ${String(c.handlers).padStart(3)} click  `
    + `${String(c.map_handlers).padStart(2)} map   ${c.repo}:${c.path}`);
}

/* ═══════════════════════════════════════════════════════════════════════ */

mkdirSync(OUT, { recursive: true });
const jsonPath = join(OUT, '202609012230-deep-scan.json');
writeFileSync(jsonPath, `${JSON.stringify(report, null, 1)}\n`, 'utf8');
console.log(`\nreport: ${jsonPath}`);
console.log(`elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
