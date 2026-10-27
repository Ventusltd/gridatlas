# opus-generation-scaffold: a deterministic cutter for a new candidate generation (issue #32 §8 Step F, §12 E)

Harness: Node v22.23.4 only, no browser. Base SHA: fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d. Scratch worktree: `evidence/opus-generation-scaffold/wt`, created with `git -C /home/claude/gridatlas worktree add --detach <folder>/wt fda6b10`. Stamps 202612312357/58/59 are DUMMY. Nothing was committed, nothing was pushed, and the lead's `hardening/wt` was not touched.

## Deliverables

- `evidence/opus-generation-scaffold/make-generation.mjs` (sha256 386455e1…): `node make-generation.mjs --repo <wt> --module <m.js> --gen <YYYYMMDDHHMM> --version v9.159 [--proof-budget 24001..24781]`
- `evidence/opus-generation-scaffold/verify-candidate.mjs` (sha256 7f5d31d0…): `node verify-candidate.mjs --repo <wt> --gen <GEN>`. It applies the checks from verify-compose.mjs:39-84 and loop.mjs:166-194 to the candidate route. This script is needed because of finding K1 below.
- Logs are in `evidence/opus-generation-scaffold/logs/`. Inputs are in `inputs/`. Archived outputs are in `run1-out/` and `run2a-out/`. The run 2b outputs are still in `wt/`.

## What the script does

| Output | Derivation |
|---|---|
| `atlas/modules/<GEN>-uk-lightning-overlay.js` | The supplied module, restamped in exactly two identity tokens: `generation 202610261949` becomes `generation <GEN>`, and `GEN='202610261949'` becomes `GEN='<GEN>'`. Both are 12 digits, so the byte count does not change. If the caller already stamped the module, nothing is restamped. The glossary path `docs/lightning/CANDIDATE-202610261949.md` is left alone so that it still points at a file that exists. |
| `atlas/cartridges/<GEN>-sld-sandbox-v9-8.js` | Bytes of the LIVE `202609241334-sld-sandbox-v9-8.js` (checked against its pinned sha 78129536… and the atlas/current.json entry), then `\n`, then the module. The 202610261949 cartridge is never read. |
| `tools/proofs/<GEN>-sld-sandbox.proof.mjs` | The 202610261949 proof with `const GEN=` changed (line 7). The module path is `'atlas/modules/'+GEN+…` (proof:21), so it follows GEN. Line 23 also changes, but only when `--proof-budget` is passed. |
| `atlas/manifests/<GEN>-composition.json` | From the 202610261949 manifest: generation, sld-sandbox generation/version/path/sha256/bytes, uk_lightning.module/module_bytes, composition_manifest, composition_version, composition_id, the version prefix of composition_note, `candidate_predecessor: 202610261949`, `acceptance.proof`, `acceptance.golden_browser_verification: PENDING_THIS_GENERATION`, version, and `cut_at_utc` derived from GEN. `parent_generation`, `previous_generation` and `superseded_generation` stay 202609241334, and the script asserts this. |
| `atlas/v/<GEN>/index.html` | Byte copy of `atlas/index.html`. |
| `atlas/v/<GEN>/current.json` | The same transform applied to `atlas/v/202610261949/current.json`, with `../../` paths. |

Guards in the script:

- Every write uses `flag:'wx'`, so an existing file is never overwritten.
- GEN must be a real UTC minute later than 202610261949.
- `--version` must not appear in atlas/current.json, any `*-composition.json`, or any `atlas/v/*/current.json`, and must be higher than every version recorded there. In the run, v9.158 was refused by the 202610261949 manifest and v9.157 by the 202610221600 manifest.
- Input containing CR is refused. The proof hashes raw bytes and the loader hashes LF bytes; with no CR the two agree.
- After the transform, no stale `202610261949` may remain other than in `candidate_predecessor`, and no stale `v9.158` may remain.
- 16 protected files are hashed before and after: atlas/current.json, STATE.md, atlas/index.html, the 202609241334 manifest, both pointer files, the four live cartridges and all six 202610261949 files.
- JSON is written as `JSON.stringify(x,null,1)+'\n'`. I verified that this reproduces the 202610261949 files byte for byte.

Wording deviation: the brief said `golden_browser_verification: PENDING`. I wrote `PENDING_THIS_GENERATION`, which is the repository's own vocabulary (tools/recompose.mjs:417, tools/rollback.mjs:222, and the 202610261949 manifest:744).

## Key findings

**K1. The repository gates never look at a candidate generation.** `loop.mjs lint` (loop.mjs:145-196), `verify-compose.mjs` (:17-84) and `run-current.mjs` (:22-35) all read only `atlas/current.json`, which is the live 202609241334 pointer. On a candidate branch:
- they pass whatever the candidate files contain;
- run-current runs `202609241334-sld-sandbox.proof.mjs`, not the new proof;
- the CI workflow `202608312212-cartridge-proof.yml:167-192` runs only those gates.

The new proof is the only repository check that reads the candidate (proof:12, falling back to `atlas/v/<GEN>/current.json`), and it has to be run by hand. `verify-candidate.mjs` covers the gap. run-current does require the filename `tools/proofs/<generation>-<id>.proof.mjs` (:34-35), but that only takes effect at release, when atlas/current.json names GEN. The script names the proof that way.

**K2. The proof budget is stricter than the slot budget.** proof:23 asserts module ≤ 24,000 bytes. The unmodified module is 23,973 bytes, which leaves **27 bytes** of headroom. The "808 bytes" in the brief is measured against 24,781, which is the cartridge ceiling and not the proof's limit. Any H01–H05 fix that adds more than 27 bytes fails a proof derived with "only GEN changed". By default the script refuses such a module and names the remedy. `--proof-budget N` (N ≤ 24,781) changes exactly proof line 23 in the NEW proof only; run 2b shows this. Whether to raise the bound is a lead/owner call. At N = 24,781 the cartridge reaches exactly 460,000 bytes.

**K3. `candidate_predecessor` is fixed at 202610261949.** That is the brief's lineage. If a second fix-round generation is ever cut on top of a first one, CAND in the script must change.

## Run 1: unmodified module, dummy GEN 202612312358, v9.159 (`logs/run1-verify.log`, `run1-diffs.log`, `run1-determinism.log`)

```
$ node make-generation.mjs --repo wt --module inputs/module-unmodified.js --gen 202612312358 --version v9.158
make-generation: FAIL v9.158 is already used in atlas/manifests/202610261949-composition.json      exit=1
$ … --version v9.157
make-generation: FAIL v9.157 is already used in atlas/manifests/202610221600-composition.json      exit=1
$ … --version v9.159   → WRITTEN; module 23,973 B (restamped 2 tokens); cartridge 459,192 B sha 1c951989…91b
$ node tools/scope/loop.mjs lint                          scope-ledger=PASS active=none master=done   exit=0
$ node tools/scope/loop.mjs state --stdout | cmp - STATE.md                                         cmp=0
$ node tools/proofs/202612312358-sld-sandbox.proof.mjs    SLD exact delta (202609241334 bytes + \n + 202612312358 …) … PASS  exit=0
$ node tools/proofs/202610261949-sld-sandbox.proof.mjs    … PASS  exit=0        (predecessor still intact)
$ node tools/proofs/run-current.mjs                       proofs run: 4 … every composed cartridge passed  exit=0
$ node tools/scope/verify-compose.mjs                     {"composition":"PASS","generation":"202609241334",…}  exit=0
$ cmp atlas/index.html atlas/v/202612312358/index.html    cmp=0
$ cmp atlas/index.html atlas/v/202610261949/index.html    cmp=0
$ node ../verify-candidate.mjs --repo . --gen 202612312358   "result": "PASS" (3 cartridges same_as_live, sld-sandbox 459,192 B)
$ sha256sum atlas/cartridges/202612312358-sld-sandbox-v9-8.js   1c9519899c33f0c0244d901a0a9d52b19b07d318fdf3cbb170ae87f160fae91b
  manifest sld sha256 = route current.json sld sha256 = 1c9519899c33…91b
$ cat live.js <(printf '\n') module.js | cmp - cartridge                                            cmp=0
$ git status --porcelain --untracked-files=all   → 6 × "??" (only new files); git diff --diff-filter=MDRTC: 0
$ git add -N . && git diff --stat   → 6 files changed, 10658 insertions(+)   (then git reset)
```

- **Proof diff:** a single line, `const GEN='202610261949'` → `'202612312358'`.
- **Module diff:** lines 1 and 9, the stamps only.
- **Manifest diff:** generation; sld generation/version/path/sha256; module path; composition_manifest/version/id; note prefix; `candidate_predecessor 202610221600→202610261949`; acceptance.proof; version; cut_at_utc. The route current.json diff contains the same subset.
- **Immutability:** re-running onto existing outputs is refused.
- **Determinism:** I deleted the outputs and regenerated them. All six sha256 values were identical (`run1-hashes-a.txt` = `-b.txt`).

## Run 2: deliberately modified module

**2a: one comment line `// delta` (23,982 B), GEN 202612312359, v9.159** (`logs/run2a.log`)
```
WRITTEN; headroom_to_proof_budget 18, headroom_to_24781 799
$ node tools/proofs/202612312359-sld-sandbox.proof.mjs    … PASS exit=0
$ diff 202610261949 module vs new module   → 1c1 (stamp), 5a6 "> // delta", 9c10 (stamp)
$ tail -c +435220 cartridge | cmp - module                cmp=0;  head -c 435218 cartridge | cmp - live   cmp=0
tamper A (module file reverted to the uncommented bytes, cartridge kept):
  AssertionError: the cartridge must be the live bytes, one newline and the module: nothing replaced, nothing reordered   exit=1
tamper B (one byte in the cartridge, "// delta"→"// delte"):
  AssertionError: Expected values to be strictly equal (proof:16 sha256)   exit=1;  verify-candidate: "sld-sandbox: sha256 mismatch"
restored → proof exit=0, verify-candidate PASS
```
The proof accepts the intended delta exactly. It rejects a cartridge/module mismatch at the exact-delta assertion (proof:22-23) and a one-byte cartridge change at the sha assertion (proof:16).

**2b: a 77-byte comment line (24,050 B), GEN 202612312357** (`logs/run2b.log`)
```
default:                make-generation: FAIL module is 24050 bytes; the proof budget is 24000 (pass --proof-budget <=24781 …)  exit=1; 0 files written
--proof-budget 24781:   WRITTEN; proof diff = line 7 (GEN) + line 23 (<=24781); proof PASS; verify-candidate PASS (cartridge 459,269 B)
lint exit=0; state cmp=0; run-current exit=0; verify-compose exit=0; tracked changes 0; 6 untracked new files
```

## What this does not establish

- No browser run. That the loader composes `atlas/v/<GEN>/` in Chromium, and the OFF/ON behaviour, are NOT_TESTED here.
- The script does not write a `docs/lightning/CANDIDATE-<GEN>.md`, does not commit, and does not open the PR. Those belong to the lead under §12 E.
- I did not test a module whose CRLF or byte-order mark arrives from a Windows editor beyond the refusal path.
- The release step (moving atlas/current.json and STATE.md together) is out of scope. At that point run-current will pick up `<GEN>-sld-sandbox.proof.mjs` by name.

## Classification

- Script on the unmodified module: **PASS**. All six checks are green, the outputs are deterministic, and only new files are written.
- Delta detection: **PASS**.
- Proof budget headroom of 27 bytes: **OWNER_DECISION** (raise to ≤ 24,781 in the new proof, or keep fixes within 27 bytes).
- Repository gates blind to the candidate (K1): pre-existing design property, recorded as a **defect** in candidate-branch CI coverage, not introduced by the candidate.
