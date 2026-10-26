#!/usr/bin/env node
/* P03 exact delta, re-verified byte-for-byte by regression-challenge-C.
 * Reads the LIVE production cartridge bytes (/home/claude/gridatlas main c08f3a6), appends "\n" (0x0A), appends the
 * candidate module bytes, and compares the Buffer to the candidate cartridge bytes. Also: CR (0x0D) census, BOM check,
 * sha256 against atlas/v/202610261949/current.json and atlas/manifests/202610261949-composition.json, git blob hashes. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const PROD = '/home/claude/gridatlas';
const WT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt';
const GEN = '202610261949';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const count = (buf, byte) => { let n = 0; for (const b of buf) if (b === byte) n++; return n; };

const live = fs.readFileSync(`${PROD}/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`);
const liveInWt = fs.readFileSync(`${WT}/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`);
const mod = fs.readFileSync(`${WT}/atlas/modules/${GEN}-uk-lightning-overlay.js`);
const cand = fs.readFileSync(`${WT}/atlas/cartridges/${GEN}-sld-sandbox-v9-8.js`);
const expected = Buffer.concat([live, Buffer.from('\n', 'utf8'), mod]);

const out = {
  live_production_cartridge: { path: `${PROD}/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`, bytes: live.length, sha256: sha(live), cr_bytes: count(live, 0x0d), lf_bytes: count(live, 0x0a), bom: live[0] === 0xef && live[1] === 0xbb && live[2] === 0xbf, ends_with_lf: live[live.length - 1] === 0x0a },
  live_cartridge_in_candidate_worktree_identical: Buffer.compare(live, liveInWt) === 0,
  module: { path: `${WT}/atlas/modules/${GEN}-uk-lightning-overlay.js`, bytes: mod.length, sha256: sha(mod), cr_bytes: count(mod, 0x0d), lf_bytes: count(mod, 0x0a), bom: mod[0] === 0xef && mod[1] === 0xbb && mod[2] === 0xbf, ends_with_lf: mod[mod.length - 1] === 0x0a, budget_24000_ok: mod.length <= 24000 },
  candidate_cartridge: { path: `${WT}/atlas/cartridges/${GEN}-sld-sandbox-v9-8.js`, bytes: cand.length, sha256: sha(cand), cr_bytes: count(cand, 0x0d), lf_bytes: count(cand, 0x0a), ceiling_460000_ok: cand.length < 460000 },
  expected: { bytes: expected.length, sha256: sha(expected) },
  byte_for_byte_equal: Buffer.compare(cand, expected) === 0,
  first_difference_offset: null,
  prefix_is_live_bytes: Buffer.compare(cand.subarray(0, live.length), live) === 0,
  separator_byte_at_live_length: cand[live.length] === 0x0a ? '0x0A LF' : '0x' + cand[live.length].toString(16),
  suffix_is_module_bytes: Buffer.compare(cand.subarray(live.length + 1), mod) === 0,
  arithmetic: `${live.length} + 1 + ${mod.length} = ${live.length + 1 + mod.length} (candidate ${cand.length})`
};
if (!out.byte_for_byte_equal) { for (let i = 0; i < Math.max(cand.length, expected.length); i++) if (cand[i] !== expected[i]) { out.first_difference_offset = i; break; } }

// Hash declarations
const cur = JSON.parse(fs.readFileSync(`${WT}/atlas/v/${GEN}/current.json`, 'utf8'));
const man = JSON.parse(fs.readFileSync(`${WT}/atlas/manifests/${GEN}-composition.json`, 'utf8'));
const curSld = cur.cartridges.find(c => c.id === 'sld-sandbox');
const manSld = man.cartridges.find(c => c.id === 'sld-sandbox');
out.declared = {
  current_json_sha256: curSld.sha256, current_json_path: curSld.path, current_matches_bytes: curSld.sha256 === sha(cand),
  manifest_sha256: manSld.sha256, manifest_path: manSld.path, manifest_matches_bytes: manSld.sha256 === sha(cand),
  current_module_bytes_declared: cur.cartridges.find(c => c.id === 'sld-sandbox').uk_lightning?.module_bytes, module_bytes_match: cur.cartridges.find(c => c.id === 'sld-sandbox').uk_lightning?.module_bytes === mod.length,
  manifest_module_bytes_declared: manSld.uk_lightning?.module_bytes,
  derived_from_declared: curSld.derived_from,
  live_cartridge_sha256_in_proof: '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca', live_sha_matches_proof_constant: sha(live) === '7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca'
};
// Production current.json must still name the live cartridge hash
const prodCur = JSON.parse(fs.readFileSync(`${PROD}/atlas/current.json`, 'utf8'));
const prodSld = prodCur.cartridges.find(c => c.id === 'sld-sandbox');
out.production_pointer = { generation: prodCur.generation, sld_generation: prodSld.generation, sld_sha256: prodSld.sha256, matches_live_bytes: prodSld.sha256 === sha(live) };
// git blob identity: the candidate SHA's copy of the live cartridge equals main's blob
const g = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
out.git = {
  main_blob: g(`git -C ${PROD} rev-parse c08f3a6178752d9ccc77ce76451107f28375a8b2:atlas/cartridges/202609241334-sld-sandbox-v9-8.js`),
  candidate_blob_of_live: g(`git -C ${PROD} rev-parse fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d:atlas/cartridges/202609241334-sld-sandbox-v9-8.js`),
  candidate_cartridge_blob: g(`git -C ${PROD} rev-parse fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d:atlas/cartridges/${GEN}-sld-sandbox-v9-8.js`),
  module_blob: g(`git -C ${PROD} rev-parse fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d:atlas/modules/${GEN}-uk-lightning-overlay.js`),
  worktree_head: g(`git -C ${WT} rev-parse HEAD`),
  worktree_dirty: g(`git -C ${WT} status --porcelain`) || '(clean)'
};
out.git.live_blob_unchanged_between_main_and_candidate = out.git.main_blob === out.git.candidate_blob_of_live;
// git blob bytes equal the worktree bytes (no CRLF checkout mutation)
const blobBytes = execSync(`git -C ${PROD} cat-file -p ${out.git.candidate_cartridge_blob}`, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
out.git.candidate_blob_bytes_equal_worktree = Buffer.compare(blobBytes, cand) === 0;
out.git.candidate_blob_sha256 = sha(blobBytes);
out.verdict = out.byte_for_byte_equal && out.declared.current_matches_bytes && out.declared.manifest_matches_bytes && out.candidate_cartridge.cr_bytes === out.live_production_cartridge.cr_bytes + out.module.cr_bytes && out.git.live_blob_unchanged_between_main_and_candidate && out.git.candidate_blob_bytes_equal_worktree ? 'PASS' : 'FAIL';
console.log(JSON.stringify(out, null, 2));
