// opus-release-rollback | harness: self (node, read-only; writes ONLY to stdout) | candidate fda6b10, main c08f3a6
// Usage: node derive-release-pointer.mjs <repo> <ref> <GEN>
// Derives the proposed root atlas/current.json for <GEN> two independent ways and checks they agree:
//   A) manifest atlas/manifests/<GEN>-composition.json minus manifest-only keys
//   B) preview atlas/v/<GEN>/current.json with every relative path re-based from atlas/v/<GEN>/ to atlas/
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const [repo, ref, GEN] = process.argv.slice(2);
const show = (p) => JSON.parse(execFileSync('git', ['-C', repo, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const manifest = show(`atlas/manifests/${GEN}-composition.json`);
const preview = show(`atlas/v/${GEN}/current.json`);
const MANIFEST_ONLY = ['parent_generation', 'version', 'cut_at_utc', 'note', 'acceptance'];
const A = Object.fromEntries(Object.entries(manifest).filter(([k]) => !MANIFEST_ONLY.includes(k)));
const rebase = (v) => Array.isArray(v) ? v.map(rebase)
  : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rebase(x)]))
  : (typeof v === 'string' && v.startsWith('../')) ? (() => {
      const r = path.posix.relative('atlas', path.posix.join(`atlas/v/${GEN}`, v));
      const t = v.endsWith('/') ? '/' : '';
      return (r.startsWith('../') ? r : `./${r}`) + t;
    })()
  : v;
const B = rebase(preview);
const a = JSON.stringify(A, null, 1), b = JSON.stringify(B, null, 1);
console.error(`A(manifest-derived) === B(preview-rebased), byte-exact incl. key order: ${a === b}`);
if (a !== b) {
  const al = a.split('\n'), bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) if (al[i] !== bl[i]) { console.error(`  first difference at line ${i + 1}:\n   A ${al[i]}\n   B ${bl[i]}`); break; }
}
process.stdout.write(`${a}\n`);
