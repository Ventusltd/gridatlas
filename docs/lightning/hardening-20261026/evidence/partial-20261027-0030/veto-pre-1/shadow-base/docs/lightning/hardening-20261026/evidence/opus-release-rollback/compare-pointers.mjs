// opus-release-rollback | harness: self (node, no browser, read-only) | candidate fda6b10, main c08f3a6
// Compares the live pointer, the candidate preview pointer and the two manifests structurally.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const MAIN = '/home/claude/gridatlas';
const WT = process.argv[2];
const show = (repo, ref, p) => execFileSync('git', ['-C', repo, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
const live = JSON.parse(show(MAIN, 'c08f3a6', 'atlas/current.json'));
const cand = JSON.parse(show(WT, 'fda6b10', 'atlas/v/202610261949/current.json'));
const candM = JSON.parse(show(WT, 'fda6b10', 'atlas/manifests/202610261949-composition.json'));
const liveM = JSON.parse(show(MAIN, 'c08f3a6', 'atlas/manifests/202609241334-composition.json'));
const keys = (o) => Object.keys(o);
console.log('live top keys   ', keys(live).join(','));
console.log('cand top keys   ', keys(cand).join(','));
console.log('live-not-in-cand', keys(live).filter(k => !(k in cand)).join(',') || '-');
console.log('cand-not-in-live', keys(cand).filter(k => !(k in live)).join(',') || '-');
// Path rewrite ../../ -> ./ on every string value that starts with ../../ (preview -> root)
const rewrite = (v) => Array.isArray(v) ? v.map(rewrite)
  : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]))
  : (typeof v === 'string' && v.startsWith('../../')) ? './' + v.slice(6) : v;
const stringsStarting = (v, pre, out = [], at = '$') => {
  if (Array.isArray(v)) v.forEach((x, i) => stringsStarting(x, pre, out, `${at}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) stringsStarting(x, pre, out, `${at}.${k}`);
  else if (typeof v === 'string' && v.startsWith(pre)) out.push(`${at} = ${v}`);
  return out;
};
console.log('\ncandidate strings starting ../  :'); for (const s of stringsStarting(cand, '../')) console.log('  ', s);
console.log('\nlive strings starting ../  :'); for (const s of stringsStarting(live, '../')) console.log('  ', s);
const rel = rewrite(cand);
// Deep diff rel (proposed root pointer) vs live, by path
const diffs = [];
const deep = (a, b, at) => {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deep(a[k], b[k], `${at}.${k}`);
  } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && at.endsWith('.cartridges')) {
    a.forEach((x, i) => deep(x, b.find(y => y.id === x.id), `${at}[id=${x.id}]`));
  } else diffs.push(`${at}: ${JSON.stringify(a)?.slice(0, 140)}  ->  ${JSON.stringify(b)?.slice(0, 140)}`);
};
deep(live, rel, '$');
console.log('\nlive -> proposed release pointer (candidate with ../../ -> ./):'); for (const d of diffs) console.log('  ', d);
// Manifest 202609241334 cartridges vs live current cartridges
console.log('\nliveManifest.cartridges deep-equals live.cartridges:', JSON.stringify(liveM.cartridges) === JSON.stringify(live.cartridges));
console.log('candManifest.cartridges deep-equals rewrite(cand).cartridges:', JSON.stringify(candM.cartridges) === JSON.stringify(rel.cartridges));
const strip = (o, drop) => Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));
const mOnly = ['parent_generation', 'version', 'cut_at_utc', 'note', 'acceptance'];
console.log('candManifest minus manifest-only keys deep-equals rewrite(cand):', JSON.stringify(strip(candM, mOnly)) === JSON.stringify(rel),
  '| key-order-insensitive:', JSON.stringify(Object.fromEntries(Object.entries(strip(candM, mOnly)).sort())) === JSON.stringify(Object.fromEntries(Object.entries(rel).sort())));
console.log('candManifest keys not in cand:', keys(candM).filter(k => !(k in cand)).join(','));
console.log('liveManifest keys not in live:', keys(liveM).filter(k => !(k in live)).join(','));
console.log('live keys not in liveManifest:', keys(live).filter(k => !(k in liveM)).join(','));
