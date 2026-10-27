#!/usr/bin/env node
/**
 * verify-candidate.mjs -- apply tools/scope/verify-compose.mjs:39-84 and loop.mjs:166-194 checks to a CANDIDATE route
 * (atlas/v/<GEN>/current.json + atlas/manifests/<GEN>-composition.json). The repository's own verify-compose.mjs,
 * loop.mjs lint and run-current.mjs read only atlas/current.json (the live 202609241334 pointer), so on a candidate
 * branch they never look at the candidate. Author: opus-generation-scaffold. Harness: Node only.
 *
 *   node verify-candidate.mjs --repo <worktree> --gen <GEN>
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const a = Object.fromEntries(process.argv.slice(2).reduce((o, v, i, l) => (i % 2 ? o : [...o, [l[i].slice(2), l[i + 1]]]), []));
const REPO = path.resolve(a.repo), GEN = a.gen;
const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); };
const shaLF = (p) => createHash('sha256').update(Buffer.from(fs.readFileSync(p).toString('binary').replace(/\r\n/g, '\n'), 'binary')).digest('hex');
const routeDir = path.join(REPO, 'atlas', 'v', GEN);
const rc = JSON.parse(fs.readFileSync(path.join(routeDir, 'current.json'), 'utf8'));
const live = JSON.parse(fs.readFileSync(path.join(REPO, 'atlas', 'current.json'), 'utf8'));

check(fs.readFileSync(path.join(routeDir, 'index.html')).equals(fs.readFileSync(path.join(REPO, 'atlas', 'index.html'))), 'route index.html != atlas/index.html');
check(rc.generation === GEN, 'route generation');
check(rc.schema === live.schema && rc.architecture === live.architecture && rc.release_id === live.release_id, 'schema/architecture/release_id differ from live');
const shellPath = path.resolve(routeDir, rc.shell.index);
check(shellPath === path.join(REPO, 'atlas', 'releases', rc.release_id, 'index.html'), 'shell escaped fixed release');
const shell = fs.readFileSync(shellPath, 'utf8');
check(JSON.stringify(rc.cartridge_order) === JSON.stringify(live.cartridge_order), 'cartridge_order differs from live');
const rows = [];
for (const id of rc.cartridge_order) {
  const e = rc.cartridges.find(x => x.id === id);
  const p = path.resolve(routeDir, e.path);
  check(p.startsWith(path.join(REPO, 'atlas') + path.sep), `${id}: escapes atlas/`);
  check(fs.existsSync(p), `${id}: missing ${p}`);
  const h = shaLF(p), size = fs.statSync(p).size;
  check(h === e.sha256, `${id}: sha256 mismatch`);
  check(size <= 460000, `${id}: over 460 kB`);
  check(shell.includes(e.replace_script), `${id}: slot missing from shell`);
  const le = live.cartridges.find(x => x.id === id);
  rows.push({id, generation: e.generation, bytes: size, sha256: h, same_as_live: le.sha256 === e.sha256});
}
const manifestPath = path.resolve(routeDir, rc.composition_manifest);
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
check(manifestPath === path.join(REPO, 'atlas', 'manifests', `${GEN}-composition.json`), 'composition_manifest path');
check(m.generation === GEN, 'manifest generation');
check(JSON.stringify(m.cartridge_order) === JSON.stringify(rc.cartridge_order), 'manifest order');
check(m.acceptance?.full_application_copies_created === 0, 'full_application_copies_created');
for (const id of m.cartridge_order) check(m.cartridges.find(x => x.id === id).sha256 === rc.cartridges.find(x => x.id === id).sha256, `${id}: manifest/route sha differ`);
check(m.parent_generation === live.generation, `parent_generation ${m.parent_generation} != live ${live.generation}`);
check(fs.existsSync(path.join(REPO, 'tools', 'proofs', `${GEN}-sld-sandbox.proof.mjs`)), 'generation-matched proof missing (run-current.mjs:34-35 naming)');
check(m.acceptance?.proof === `tools/proofs/${GEN}-sld-sandbox.proof.mjs`, 'acceptance.proof');
check(m.composition_version === rc.composition_version && m.composition_id === rc.composition_id, 'version/id differ manifest vs route');

console.log(JSON.stringify({candidate: GEN, composition_version: m.composition_version, composition_id: m.composition_id,
  parent_generation: m.parent_generation, candidate_predecessor: m.candidate_predecessor,
  golden_browser_verification: m.acceptance.golden_browser_verification, cartridges: rows,
  result: fail.length ? 'FAIL' : 'PASS', failures: fail}, null, 1));
process.exitCode = fail.length ? 1 : 0;
