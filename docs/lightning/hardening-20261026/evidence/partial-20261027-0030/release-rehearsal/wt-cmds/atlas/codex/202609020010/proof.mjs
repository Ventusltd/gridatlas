import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const generation = '202609020010';
const route = join(ROOT, 'atlas', 'codex', generation);
const manifest = JSON.parse(await readFile(join(route, 'route-manifest.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const base = process.env.CODEX_ROUTE_BASE || 'origin/main';
let passed = 0; const failures = [];
function check(label, condition) {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failures.push(label); console.log(`  [FAIL] ${label}`); }
}
async function walk(dir) {
  const out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}

const files = await walk(route);
const texts = await Promise.all(files.map(async path => [path, await readFile(path, 'utf8')]));
const joined = texts.map(([, text]) => text).join('\n');
const served = texts.filter(([path]) => /(?:index\.html|assets[\\/].*\.(?:js|css))$/.test(path))
  .map(([, text]) => text).join('\n');
const html = await readFile(join(route, 'index.html'), 'utf8');
check('route generation is immutable and exactly twelve digits',
  /^\d{12}$/.test(generation) && manifest.generation === generation && manifest.immutable === true);
check('the page visibly declares CODEX COMPUTATION LAB', /CODEX COMPUTATION LAB/.test(html));
check('screening and connection-assessment limits are visible',
  /Screening only/.test(html) && /not solved power flow/.test(joined)
  && /available headroom/.test(joined) && /not.*connection assessment/i.test(joined));
check('the route never names or loads the shared composition pointer',
  !joined.includes('current' + '.json'));
check('the route has no root-relative, parent-relative or remote asset load',
  !/(?:src|href)=["'](?:\/|\.\.\/|https?:|\/\/)/i.test(html));
check('the lab performs no network request or storage mutation',
  !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB/.test(served));
check('every pinned asset is inside this route', manifest.assets.every(asset =>
  !asset.path.includes('..') && !asset.path.startsWith('/') && !/^https?:/i.test(asset.path)));
let hashesMatch = manifest.assets.length > 0;
for (const asset of manifest.assets) {
  const bytes = await readFile(join(route, asset.path));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== asset.sha256) hashesMatch = false;
}
check('every declared local artifact matches its pinned SHA-256', hashesMatch);
const declared = new Set(manifest.assets.map(asset => asset.path));
const actual = files.map(path => relative(route, path).replace(/\\/g, '/'))
  .filter(path => path !== 'route-manifest.json');
check('every served artifact is pinned, with no undeclared extra file',
  actual.length === declared.size && actual.every(path => declared.has(path)));
check('the lab exposes only an inputs-only envelope until owner products are pinned',
  /computation_state:\s*'inputs-only'/.test(joined)
  && /declared-connection-product/.test(joined)
  && /voltage-scoped-network-product/.test(joined));

/* Publication collision boundary. A clean route is insufficient if its
   branch also carries older changes outside the route. Validate the complete
   base-to-candidate transaction, using Git blobs rather than the working copy. */
const head = git('rev-parse', 'HEAD');
const parent = git('rev-parse', 'HEAD^');
const baseSha = git('rev-parse', base);
check('the candidate is a single transaction on the exact publication base',
  parent === baseSha);

const changed = git('diff', '--name-status', '--find-renames', `${baseSha}..${head}`)
  .split(/\r?\n/).filter(Boolean).map(line => {
    const [status, ...parts] = line.split('\t');
    return { status, paths: parts };
  });
const prefix = `atlas/codex/${generation}/`;
check('the complete transaction only adds files inside its exact route',
  changed.length > 0 && changed.every(change => change.status === 'A'
    && change.paths.length === 1 && change.paths[0].startsWith(prefix)
    && !change.paths[0].includes('..') && !change.paths[0].includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(change.paths[0])));

let routeAlreadyExisted = true;
try {
  execFileSync('git', ['cat-file', '-e', `${baseSha}:atlas/codex/${generation}`],
    { cwd: ROOT, stdio: 'ignore' });
}
catch { routeAlreadyExisted = false; }
check('the publication base does not already contain this generation', !routeAlreadyExisted);

const tree = git('ls-tree', '-r', head, '--', `atlas/codex/${generation}`)
  .split(/\r?\n/).filter(Boolean).map(line => {
    const match = /^(\d+)\s+(\w+)\s+[a-f0-9]+\t(.+)$/.exec(line);
    return match && { mode: match[1], type: match[2], path: match[3] };
  });
check('the route contains ordinary blobs only, never symlinks or submodules',
  tree.length > 0 && tree.every(item => item && item.mode === '100644' && item.type === 'blob'));
const folded = tree.map(item => item.path.toLowerCase());
check('the route has no case-fold path collision', new Set(folded).size === folded.length);

let blobHashesMatch = true;
for (const asset of manifest.assets) {
  const blob = execFileSync('git', ['show', `${head}:${prefix}${asset.path}`], { cwd: ROOT });
  if (createHash('sha256').update(blob).digest('hex') !== asset.sha256) blobHashesMatch = false;
}
check('manifest hashes describe committed Git blobs, not translated working files', blobHashesMatch);

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) process.exit(1);
console.log('the immutable Codex route is locally pinned and cannot share-load or mutate the live composition.');
