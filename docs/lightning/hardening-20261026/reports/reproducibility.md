# reproducibility: independent rebuild of generation 202610262323 (v9.161)

Lane: reproducibility. Harness: Node v22.23.4, filesystem only, no browser, no HTTP server (no port was assigned to this lane). Writable copy: `git worktree add --detach evidence/reproducibility/wt 4df2d99` (4df2d99065fe…). Compared against `hardening/wt` HEAD 68be91e (the generation files were added in baf4e58 and are unchanged since). Nothing was committed or pushed. `hardening/wt` and `/home/claude/gridatlas` were only read. Live `atlas/current.json` (1ea60d61…) and `STATE.md` (b8bef1e1…) are identical in production, the hardening worktree and my copy (`logs/live-unchanged.log`).

All paths below are relative to `hardening/evidence/reproducibility/`.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| R1 generator rebuild from 4df2d99 | PASS | `logs/make-generation.log`, `raw/` | `node ../../opus-generation-scaffold/make-generation.mjs --repo . --module ../../opus-fix-designer/fixed-module-D.202610262323.js --gen 202610262323 --version v9.161 --proof-budget 24781` (run in `wt/`) |
| R1b lead post-steps applied | PASS | `poststep.mjs`, `logs/pre-poststep-diff.log` | `node poststep.mjs` |
| R2 byte-compare, 6 files vs HEAD | PASS (6/6 `cmp`=0) | `logs/byte-compare.log` | `git show HEAD:<f> \| cmp - wt/<f>` |
| R3 sha256/bytes recomputation | PASS (0 mismatches) | `hashcheck.mjs`, `logs/hashcheck-hardening-wt.log`, `logs/hashcheck-own-wt.log` | `node hashcheck.mjs <repo>` |
| R4 cartridge = live + `\n` + module | PASS | `logs/cartridge-delta.log` | `cat live <(printf '\n') module \| cmp - cartridge` |
| R5 preview route resolution | PASS for every file the loader fetches; INFO for 2 metadata strings (see below) | `routecheck.mjs`, `logs/routecheck-hardening-wt.log` | `node routecheck.mjs ../../wt 202610262323` |
| R6 module diff explained by A ∪ C ∪ C-to-D | PASS (no unexplained bytes) | `chain/`, `logs/module-chain.log` | `patch` chain, then `cmp` |
| R7 proof and verifiers (extra check) | PASS | `logs/proof-and-verify.log` | `node tools/proofs/202610262323-sld-sandbox.proof.mjs`; `verify-candidate.mjs`; `verify-compose.mjs`; `loop.mjs lint` |

## R1. Rebuild

The command in the brief leaves out `--repo` and `--module`, which the script requires. I supplied them as `--repo .` (my worktree) and `--module` set to the named input (sha256 61cf9b34…, 23,226 B). The script is `make-generation.mjs` (sha256 386455e1…). Its output was `WRITTEN`, with `restamped: []` because the input was already stamped 202610262323, `protected_unchanged: 16` and exit 0. It wrote six untracked files and changed nothing tracked.

Before the post-steps, the raw output already matched HEAD byte for byte in 4 of the 6 files: module, cartridge, route `index.html` and route `current.json`. The other two differed only by exactly the two post-steps (`logs/pre-poststep-diff.log`):
- manifest line 723: `candidate_predecessor` 202610261949 → 202610262318;
- proof line 37: the needle list loses `'gm-panel-body'` and `'insertBefore'`, and a new line is added ahead of it: `assert.equal(module.includes('gm-panel-body'),false,'…(P02/P10)')`.

`poststep.mjs` makes those two edits with guarded single-occurrence replacements. The brief fixes the assertion's code expression but not its message text. I used the lead's message wording, so that message string is the one part of the rebuild I could not derive independently.

## R2. Byte comparison (after the post-steps)

| file | bytes | sha256 |
|---|---|---|
| atlas/modules/202610262323-uk-lightning-overlay.js | 23,226 | 61cf9b34ae38d87f9091ddef783d6e9988148c5df2087f0e5d1c68e36e24e3e9 |
| atlas/cartridges/202610262323-sld-sandbox-v9-8.js | 458,445 | b143bf05b28ac9b972ec90dced03cc0ad1f003fa844bdcb3f6601a33bd69891d |
| tools/proofs/202610262323-sld-sandbox.proof.mjs | 4,254 | 842b82fb0630ce56758287a74afefba1ec7b2c08b01166e537256e99871ddee6 |
| atlas/manifests/202610262323-composition.json | 51,771 | 7dbbe25db01f5dc219ee2b2404361b4ed04126f3f2def84836265d4ce0628e35 |
| atlas/v/202610262323/index.html | 5,223 | e1e403f6defe984e6a12c30bb882dfeb65166b5414e3088c3b04f957064232b3 |
| atlas/v/202610262323/current.json | 50,403 | f13a0b8f216734e2909cbd27221ece87b4375b8f676c412f080a739c7d001a70 |

All six files are byte-identical to the HEAD blobs. The hardening worktree has no uncommitted changes under `atlas/`, `tools/` or `STATE.md`, so its working-tree files are identical too.

## R3. Hash and byte recomputation

`hashcheck.mjs` reads the manifest, the route `current.json` and the live `atlas/current.json`. It resolves each path from the file's own base: `atlas/` for the manifest and the live pointer, `atlas/v/202610262323/` for the route. It then hashes the raw bytes and the LF-normalised bytes, which are identical because no file contains CR.

- 4 cartridges × 3 files: every `sha256` matches, and every `bytes` field present matches: 41,120, 458,445, 451,935, and the live 435,218. The streaming-parquet-bridge entry has no `bytes` field (actual size 13,589 B). That is inherited from live and is not a defect.
- `uk_lightning.module_bytes` = 23,226, which matches the file. The manifest carries no module sha256.
- `supersedes_shell_script` hashes: e5de4131… matches all 3 release copies of the pre-snapped adapter. 9a75901e… matches 2 of the 5 `ventus-corev8engine.js` copies (202608292311 and 202608300453; the shell in use is 202608300453). Both are unchanged from live.
- `supersedes_cartridge` fd9471ed… matches `atlas/cartridges/202608311910-neon-substation-links-v9-6.js`.
- `transit_data_selection.sha256` (256e98fc…) refers to a remote parquet partition that is not in the repo, so I could not hash it. The value is identical to the one in live `atlas/current.json`.
- The only 64-hex value in the manifest or route `current.json` that does not appear in live `atlas/current.json` is the new cartridge sha b143bf05…. The manifest and the route agree on it.

The same check passes on my rebuilt tree (`logs/hashcheck-own-wt.log`).

## R4. Cartridge composition

The live 202609241334 sld-sandbox has the same sha256 (7812953671d8…) in four places: the production clone HEAD c08f3a6, the production working file, 4df2d99 and hardening HEAD. Its pointer generation is 202609241334.

- `cat live <(printf '\n') module | cmp - cartridge` gives 0, using both the hardening copy and the production-clone blob of the live file.
- Size: 435,218 + 1 + 23,226 = 458,445, which equals the cartridge.
- `head -c 435218` equals the live file, byte 435,219 is `\n`, and the bytes from 435,220 onward equal the module.
- The cartridge contains no CR bytes.

## R5. Preview route

`routecheck.mjs` replays `index.html:39-80` against the filesystem, resolving every URL from `/atlas/v/202610262323/index.html`:
- `./current.json` resolves, and the schema and architecture invariants hold.
- The shell `../../releases/202608300453-atlas-v9/index.html` and its base directory both resolve.
- All four `cartridge_order` entries resolve. Each served file hashes to its declared sha256, and each `replace_script` slot exists in the shell.
- The one script the shell keeps unreplaced is the external CDN `maplibre-gl@3.6.2`.
- Every other relative reference in the route `current.json` (manifests, parts files, the live sld cartridge, the module) resolves, as do the repo-root proof and fixture paths.

**INFO, not a FAIL:** the two `contract` strings, `../../ui/cartridges/202609241251-streaming-parquet-bridge-v9-5.mjs` and `../../ui/cartridges/202609040337-global-gazetteer-flyto-v9-106.mjs`, resolve to `atlas/ui/…`, which does not exist. The files are at the repo-root `ui/cartridges/…`, which would be `../../../ui/…` from the route. This does not affect the route at runtime:
- the loader never fetches `contract`;
- the proofs only compare the string.

The same strings appear in every route since 202609080000, including 202610261949, 202610262310 and 202610262318, so the candidate did not introduce them. Live `atlas/current.json` uses `../ui/…`, which resolves correctly from `atlas/`. The module's only external URLs are the `raw.githubusercontent.com/Ventusltd/lightning` history and geojson endpoints, which are not route-relative. Live HTTP serving was not exercised in this lane.

## R6. Module delta versus fda6b10

The inputs are hashed below. The two FINAL diffs in the docs evidence folder are byte-identical to the copies in `opus-fix-designer/`.

| diff | sha256 |
|---|---|
| FINAL-A.diff | 0d4a2dca… |
| FINAL-C.diff | 263fc8e2… |
| C-to-D.diff | 8f0d4d3b… |

Replaying the chain with `patch --verbose` applied every hunk cleanly, with no fuzz and no offset:
1. fda6b10 `202610261949-uk-lightning-overlay.js` (3ce0ddc1…, 23,973 B) + FINAL-A (8 hunks) equals the committed 202610262310 module, except for the 2 GEN stamp tokens.
2. The committed 202610262310 module + FINAL-C (8 hunks) equals `opus-fix-designer/fixed-module-C.js` exactly. It also equals the committed 202610262318 module, except for the 2 stamp tokens.
3. That result + C-to-D (3 hunks) equals `fixed-module-D.js` exactly.
4. Restamping only line 1 (`generation 202610262310` → `202610262323`) and line 9 (`GEN='…'`) gives a file that matches the committed 202610262323 module (`cmp`=0).

The direct fda6b10→202610262323 diff (127 changed lines in 32 regions, saved as `chain/direct-fda6b10-to-202610262323.diff`) is therefore fully explained by A ∪ C ∪ C-to-D plus the two identity stamps. Nothing is unexplained. The one remaining `202610261949` is the glossary path `docs/lightning/CANDIDATE-202610261949.md` on line 5. It is kept on purpose by the scaffold, and the file exists.

## R7. Extra checks

- The new proof passes on both my rebuilt tree and the hardening worktree.
- `verify-candidate.mjs --gen 202610262323` reports `"result":"PASS"`.
- `verify-compose.mjs` passes. It covers live 202609241334 only, per scaffold finding K1.
- `loop.mjs lint` reports `scope-ledger=PASS`.

## Classification

- FAIL: none.
- OWNER_DECISION: none new. The proof's assertion message text is the lead's wording, and the brief does not specify it.
- INFO: the route `contract` metadata paths resolve to the non-existent `atlas/ui/`. This has been pre-existing since 202609080000, is not fetched at runtime, and needs no fix to publish.
- NOT_TESTED: HTTP serving and browser composition of the route.
