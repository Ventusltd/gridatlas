# RELEASE-COMMANDS — publish 202610262323 (v9.161) live, and roll it back

Owner-only. The release-rehearsal lane wrote this and ran every block below in a private worktree; fetch, push and PR lines were skipped (`commands-run.txt`). Nothing has been pushed.

**Starting point:** `origin/main` = `199ea45`, the squash-merge of PR #35 onto 3c5717e. Its tree is identical to the PR #35 head 4b23b70. Main already contains all seven 202610262323 preview files, byte-identical to hardening `5929c56`, and still serves live generation **202609241334**.

**Why there are two commits:** on 199ea45, `node tools/scope/loop.mjs lint` and `loop.mjs state` exit 1 with "active workflow budget mismatch". The cause is `.github/workflows/uk-lightning-preview.yml`, the tenth workflow, and `loop.mjs` allows nine. AGENTS.md requires `loop.mjs state` for any pointer change, so that workflow must go first.
- It goes in its own commit, so that reverting the release commit is byte-exact and still passes lint.
- Merge with **"Rebase and merge"**, not squash.
- Or push the prep commit as its own PR first.

**Do not promote** until the owner has done the real-device check and the independent veto has cleared. The #35 commit message names the H08 coverage-caption defect as outstanding.

Expected hashes:

| file | before (202609241334) | after release |
|---|---|---|
| `atlas/current.json` | `1ea60d61bc6ae2f463b6eaee52ee377c9e1da4aac1944c01239bedc99ec2520d` | `6fddc60b5c5d504c913ea345ca624676a62e9526e433032e3277de3b1158eb79` |
| `STATE.md` | `b8bef1e1699f353e8e0a62c11bad950dd212137f4f562621511f34dd7f6d96fb` | `43e3609c8549ff4716764b7a66a30bcefcb2020f81953f9c6b1c892bdb409f6a` |

## 1. Fresh worktree from main (stop if anything moved)
```bash
REPO=~/gridatlas            # your clone
WT=~/gridatlas-release      # new, empty path
cd "$REPO" && git fetch origin
test "$(git rev-parse origin/main)" = 199ea45e9cb2cf3a24e49fd0a841f1e35ecf3b5f && echo MAIN_OK || echo "STOP: main moved"
test "$(git show origin/main:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).generation')" = 202609241334 && echo LIVE_OK || echo "STOP: live moved"
git worktree add -b release/202610262323-gridatlas-v9.161 "$WT" origin/main
cd "$WT"
sha256sum atlas/current.json STATE.md | grep -c -e 1ea60d61bc6ae2f4 -e b8bef1e1699f353e   # 2
```

## 2. Prep commit: retire the tenth workflow
```bash
git rm -q .github/workflows/uk-lightning-preview.yml
node tools/scope/loop.mjs lint                               # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_UNCHANGED
git commit -q -m "Retire uk-lightning-preview.yml so the scope loop passes on main" -m "It is the tenth active workflow; tools/scope/loop.mjs allows nine, so loop.mjs lint and loop.mjs state exit 1 on main since #35. It targets the retired atlas/preview/lightning route. No pointer or STATE.md change."
```

## 3. Release commit: pointer + STATE.md, nothing else
```bash
node -e 'const fs=require("fs"),G="202610262323";
const m=JSON.parse(fs.readFileSync(`atlas/manifests/${G}-composition.json`,"utf8"));
for(const k of["parent_generation","version","cut_at_utc","note","acceptance","candidate_status"])delete m[k];
if(m.generation!==G||m.composition_manifest!==`./manifests/${G}-composition.json`)throw Error("manifest identity");
if(m.previous_generation!=="202609241334")throw Error("previous_generation "+m.previous_generation);
fs.writeFileSync("atlas/current.json",JSON.stringify(m,null,1)+"\n")'
node tools/scope/loop.mjs state                              # STATE.md=UPDATED
sha256sum atlas/current.json STATE.md | grep -c -e 6fddc60b5c5d504c -e 43e3609c8549ff47   # 2
git diff --name-only                                         # STATE.md, atlas/current.json — nothing else
git add atlas/current.json STATE.md
git commit -q -m "202610262323-gridatlas-v9.161: release the UK lightning overlay (OFF by default) to the live route" -m "Promote the committed generation 202610262323 (composition v9.161), merged as a preview by #35, to the live pointer. atlas/current.json is written from atlas/manifests/202610262323-composition.json minus the manifest-only keys; previous_generation and superseded_generation name 202609241334 (v9.156). STATE.md is regenerated with node tools/scope/loop.mjs state in this same commit (AGENTS.md). No cartridge, manifest, shell or route is added or removed. Rollback: git revert of this commit (byte-exact) or node tools/rollback.mjs --to 202609241334." -m "Authorised by: <link to your issue #32 comment>"
```
**Alternative to steps 2 and 3:** run `git am /path/to/release.patch` on the branch from step 1, then run step 4.

## 4. Gates (all must print as shown)
```bash
node tools/scope/loop.mjs lint                               # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_PARITY_OK
node tools/scope/verify-compose.mjs                          # "composition":"PASS","generation":"202610262323"
node tools/proofs/run-current.mjs                            # proofs run: 4 / every composed cartridge passed
node tools/proofs/202610262323-sld-sandbox.proof.mjs         # ... syntax PASS
cmp atlas/index.html atlas/v/202610262323/index.html && echo LOADER_IDENTICAL
node tools/rollback.mjs --to 202609241334 --reason readiness --dry-run   # 4x MATCH, "1 generation back", exit 0
git diff --stat origin/main..HEAD                            # 3 files: workflow (deleted), STATE.md, atlas/current.json
```
Expected and harmless: `node tools/proofs/202609241334-sld-sandbox.proof.mjs` now exits 1, because it reads the live pointer. Do not rename or delete it, because rollback needs it.

## 5. Publish
```bash
git push -u origin release/202610262323-gridatlas-v9.161
gh pr create --base main --title "202610262323-gridatlas-v9.161: release lightning overlay (OFF by default) live" --body "Two commits: retire uk-lightning-preview.yml; move atlas/current.json + STATE.md to 202610262323. Merge with Rebase and merge (not squash) so the release commit stays separately revertable."
# Wait for both jobs of 202608312212-cartridge-proof.yml to go green, then use "Rebase and merge".
```

## 6. After Pages deploys: verify the served bytes
```bash
cd "$REPO" && git fetch origin && SHA=$(git rev-parse origin/main)
B=https://ventusltd.github.io/gridatlas/atlas
curl -fsS -H 'Cache-Control: no-cache' "$B/current.json?v=$SHA" | cmp - <(git show $SHA:atlas/current.json) && echo POINTER_OK   # retry for up to about 10 min
for f in index.html v/202610262323/index.html v/202610262323/current.json $(git show $SHA:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).cartridges.map(c=>c.path.slice(2)).join(" ")'); do
  curl -fsS "$B/$f?v=$SHA" | cmp -s - <(git show "$SHA:atlas/$f") && echo "OK $f" || echo "MISMATCH $f"; done
GRIDATLAS_BASE_URL=https://ventusltd.github.io/gridatlas/ node tools/scope/verify-live.mjs
```
In a browser console on `/gridatlas/atlas/`, with lightning OFF:
- `document.documentElement.dataset.gridatlasGeneration` returns `"202610262323"`.
- `__GRIDATLAS_MODULES__.menuBar.inspect()` returns `{engine:60,pipeline:3,total:63,unique:63,complete:true}`.
- `__GRIDATLAS_MODULES__.menuBar.installed` returns `true`.
- There are zero requests to `raw.githubusercontent.com/Ventusltd/lightning`.

## 7. Rollback to 202609241334
**Route C, byte-exact (recommended):** this puts back the exact pre-release bytes of `atlas/current.json` and `STATE.md`, and every gate passes.
```bash
cd "$REPO" && git fetch origin && git worktree add -b rollback/202610262323 ~/gridatlas-rollback origin/main && cd ~/gridatlas-rollback
REL=$(git log --format=%H -1 --grep='^202610262323-gridatlas-v9.161: release' origin/main); echo "$REL"
git revert --no-edit "$REL"
sha256sum atlas/current.json STATE.md | grep -c -e 1ea60d61bc6ae2f4 -e b8bef1e1699f353e   # 2 = byte-exact 202609241334
node tools/scope/loop.mjs lint && node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_PARITY_OK
node tools/scope/verify-compose.mjs && node tools/proofs/run-current.mjs   # generation 202609241334, 4 proofs pass
git push -u origin rollback/202610262323    # open a PR and merge it, or push to main if this is an emergency you authorise
```
**Route B, through the tool (not byte-exact by design):**
- `rollback.mjs` cuts a new stamp `<RB>` = clock UTC, with the same four cartridges, shell and order.
- Seven identity keys differ from the pre-release bytes: generation, previous_generation, composition_id, composition_manifest, composition_note, superseded_generation and candidate_predecessor.
```bash
node tools/rollback.mjs --to 202609241334 --reason "<why>"
node tools/scope/loop.mjs state && node tools/scope/loop.mjs lint && node tools/scope/verify-compose.mjs && node tools/proofs/run-current.mjs
git add atlas/current.json STATE.md atlas/state/live-set.json atlas/manifests/*-composition.json && git commit -m "<RB>: roll back 202610262323 to 202609241334 — <why>"
```
**Route A, emergency with no terminal:** in Actions, run "Rollback GridAtlas composition" with `to_generation=202609241334`, a reason, and `confirm=ROLL BACK`. This is equivalent to Route B.

After any rollback:
- Run step 6 again; the served generation should be 202609241334 (Route C) or `<RB>` (Routes A/B).
- `/atlas/v/202610262323/` keeps serving the candidate.
- Nothing under `atlas/v/**`, `atlas/modules/**` or `atlas/cartridges/**` is deleted.
