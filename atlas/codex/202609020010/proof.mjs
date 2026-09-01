import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const generation = '202609020010';
const route = join(ROOT, 'atlas', 'codex', generation);
const manifest = JSON.parse(await readFile(join(route, 'route-manifest.json'), 'utf8'));
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

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) process.exit(1);
console.log('the immutable Codex route is locally pinned and cannot share-load or mutate the live composition.');
