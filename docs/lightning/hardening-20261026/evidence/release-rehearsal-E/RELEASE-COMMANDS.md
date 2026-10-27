# RELEASE-COMMANDS: publish 202610270024 (v9.162, variant E) live, and roll it back

This is for the owner only. The release-rehearsal-E lane wrote it and ran every block below in a private worktree (`evidence/release-rehearsal-E/wt`). Nothing has been pushed, and no PR has been opened.

**Starting point (updated 00:45 UTC):**
- `origin/main` moved during this lane, from `199ea45` to **`1c19b76`** ("Publish standalone Lightning Build E preview 202610270024", 00:31 UTC).
- Its six atlas/tools files are byte-identical to the rehearsal's preview commit. The only difference is that it carries `docs/.../gen-202610270024/E-progress.md` as its doc.
- It still serves live generation **202609241334**.
- So **commit 1 below is already on main.**
- `release.patch` is now the two remaining commits on `1c19b76` (tree `604a8aef5dde1eebe16ddd858a741c60a1e9f9d4`). The three-commit version for `199ea45` is kept as `release-from-199ea45.3commits.patch`.

**Do not promote yet.** Two things must happen first:
- the owner checks the build on a real device;
- the independent veto clears for 202610270024.

Browser rows for E were still pending when this was written (FINAL-BRIEF).

## The three commits (commit 1 is already on main as 1c19b76; `release.patch` = commits 2 and 3)
| # | commit | files |
|---|---|---|
| 1 | Preview: `Publish standalone GridAtlas Lightning preview 202610270024 (no live-pointer change)` | the six E files, byte-identical to hardening `0424d45` |
| 2 | Prep: `Retire uk-lightning-preview.yml so the scope loop passes on main` | deletes `.github/workflows/uk-lightning-preview.yml` |
| 3 | Release: `202610270024-gridatlas-v9.162: release …` | `atlas/current.json`, `STATE.md` only |

**Why commit 2 exists:**
- On `199ea45`, `node tools/scope/loop.mjs lint` and `loop.mjs state` exit 1 with "active workflow budget mismatch": there are ten workflows and the budget is nine.
- AGENTS.md requires `loop.mjs state` in the same commit as any pointer change, so the extra workflow must go first.
- It is kept out of the release commit so that reverting the release restores the pre-release bytes exactly and still passes lint.
- Merge with **Rebase and merge** (not squash), or merge commit 2 as its own PR before commit 3.

The owner's 1c19b76 used `E-progress.md` as the preview's seventh, documentation file.

**Expected hashes:**

| file | before (202609241334) | after release |
|---|---|---|
| `atlas/current.json` | `1ea60d61bc6ae2f463b6eaee52ee377c9e1da4aac1944c01239bedc99ec2520d` | `9e3eda81c6385b1ed863e2f0fa3d7828220ce9569582b024f8a42a24494a2e5c` |
| `STATE.md` | `b8bef1e1699f353e8e0a62c11bad950dd212137f4f562621511f34dd7f6d96fb` | `121072a942e35da3877d82f6770f71b49fb902e246e374a763b7568494fee014` |
| release tree | | `604a8aef5dde1eebe16ddd858a741c60a1e9f9d4` (`git am release.patch` on 1c19b76); `6a9f7ae5…` for the three-commit patch on 199ea45 |

## 1. Fresh worktree from main (stop if anything has moved)
```bash
REPO=~/gridatlas; WT=~/gridatlas-release
cd "$REPO" && git fetch origin
test "$(git rev-parse origin/main)" = 1c19b76838758ef08ed9c8c4902a798a8762ece6 && echo MAIN_OK || echo "STOP: main moved"
test "$(git show origin/main:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).generation')" = 202609241334 && echo LIVE_OK || echo "STOP: live moved"
git worktree add -b release/202610270024-gridatlas-v9.162 "$WT" origin/main && cd "$WT"
```
**Fast path:** run `git am /path/to/release.patch`, check `git rev-parse HEAD^{tree}` = `604a8aef…`, then go to step 5.

## 2. Commit 1: the preview files (ALREADY DONE on main as 1c19b76; skip. Kept for reference.)
In the local clone, `origin/claude/lightning-independent-hardening-20261026` still reads `fda6b10`, so 0424d45 may not be pushed yet. If `git checkout 0424d45…` fails after the fetch, use the fast path (`release.patch`) instead.
```bash
git fetch origin claude/lightning-independent-hardening-20261026
git checkout 0424d45953579a7905c039511a6219e39ab0ee18 -- \
  atlas/cartridges/202610270024-sld-sandbox-v9-8.js atlas/manifests/202610270024-composition.json \
  atlas/modules/202610270024-uk-lightning-overlay.js atlas/v/202610270024/current.json \
  atlas/v/202610270024/index.html tools/proofs/202610270024-sld-sandbox.proof.mjs
node tools/proofs/202610270024-sld-sandbox.proof.mjs        # ... syntax PASS
cmp atlas/index.html atlas/v/202610270024/index.html && echo LOADER_IDENTICAL
git commit -q -m "Publish standalone GridAtlas Lightning preview 202610270024 (no live-pointer change)"
```

## 3. Commit 2: retire the tenth workflow
```bash
git rm -q .github/workflows/uk-lightning-preview.yml
node tools/scope/loop.mjs lint                               # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_UNCHANGED
git commit -q -m "Retire uk-lightning-preview.yml so the scope loop passes on main"
```

## 4. Commit 3: pointer and STATE.md, nothing else
```bash
node -e 'const fs=require("fs"),G="202610270024";
const m=JSON.parse(fs.readFileSync(`atlas/manifests/${G}-composition.json`,"utf8"));
for(const k of["parent_generation","version","cut_at_utc","note","acceptance","candidate_status"])delete m[k];
if(m.generation!==G||m.composition_manifest!==`./manifests/${G}-composition.json`)throw Error("manifest identity");
if(m.previous_generation!=="202609241334")throw Error("previous_generation "+m.previous_generation);
fs.writeFileSync("atlas/current.json",JSON.stringify(m,null,1)+"\n")'
node tools/scope/loop.mjs state                              # STATE.md=UPDATED
sha256sum atlas/current.json STATE.md | grep -c -e 9e3eda81c6385b1e -e 121072a942e35da3   # 2
git diff --name-only                                         # STATE.md, atlas/current.json
git add atlas/current.json STATE.md
git commit -q -m "202610270024-gridatlas-v9.162: release the UK lightning overlay (OFF by default) to the live route" -m "Authorised by: <link to your issue #32 comment>"
```
The full message is in `release-commit-message.txt`.

## 5. Gates (rehearsed: `5-released-on-1c19b76.gates.txt`, identical statuses to `2-released.gates.txt`)
```bash
node tools/scope/loop.mjs lint                               # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_PARITY_OK
node tools/scope/verify-compose.mjs                          # "composition":"PASS","generation":"202610270024"
node tools/proofs/run-current.mjs                            # every composed cartridge passed
node tools/proofs/202610270024-sld-sandbox.proof.mjs         # ... syntax PASS
node tools/proofs/202609012214-data-contract-parity.proof.mjs   # rc=1: 12 PASS / exactly 3 FAIL, all pre-existing (see below)
node tools/rollback.mjs --to 202609241334 --reason readiness --dry-run   # 4x MATCH, 1 generation back, exit 0
git diff --stat origin/main..HEAD                            # 3 files: workflow deleted, STATE.md, atlas/current.json
```
**Expected red results that are not caused by this release** (every one also fails on 199ea45 and 1c19b76):
- **Data-contract parity** fails exactly three rows:
  - `sld-sandbox: derived/gb-transmission-network.v1.json`
  - `sld-sandbox: derived/price-decade-rollup.json`
  - `substation-intelligence: derived/connection-points.v3.json`

  Each is "declared source … is named by the bytes". The six new lightning rows PASS.
- **local-ci:**
  - its scope-ledger gate turns from FAIL to PASS;
  - the flaw count goes from 63 to 65: +3 inherited 6371.0088/asin findings for the derived E cartridge (the same three that 202609241334 and 202610262323 carry), −1 for scope-ledger.
- **Proofs that need sibling repos or older pointers:**
  - `202609241334-sld-sandbox.proof.mjs` exits 1 after the flip by design, because it reads the live pointer. Do not delete it: rollback needs it.
  - `quantumspawn-recovery` and `about-estate-and-attribution` fail, as they do on main.
  - `estate-deep-scan` fails, as it does on main.

## 6. Publish
```bash
git push -u origin release/202610270024-gridatlas-v9.162
gh pr create --base main --title "202610270024-gridatlas-v9.162: release lightning overlay (OFF by default) live" \
  --body "Three commits: preview files; retire uk-lightning-preview.yml; move atlas/current.json + STATE.md to 202610270024. Rebase and merge (not squash) so the release commit stays separately revertable."
```
Wait until both jobs of `202608312212-cartridge-proof.yml` are green.

## 7. After Pages deploys
```bash
cd "$REPO" && git fetch origin && SHA=$(git rev-parse origin/main)
B=https://ventusltd.github.io/gridatlas/atlas
curl -fsS -H 'Cache-Control: no-cache' "$B/current.json?v=$SHA" | cmp - <(git show $SHA:atlas/current.json) && echo POINTER_OK   # retry for up to about 10 min
for f in index.html v/202610270024/index.html v/202610270024/current.json $(git show $SHA:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).cartridges.map(c=>c.path.slice(2)).join(" ")'); do
  curl -fsS "$B/$f?v=$SHA" | cmp -s - <(git show "$SHA:atlas/$f") && echo "OK $f" || echo "MISMATCH $f"; done
GRIDATLAS_BASE_URL=https://ventusltd.github.io/gridatlas/ node tools/scope/verify-live.mjs
```
Then, in a browser console with lightning OFF, check:
- `document.documentElement.dataset.gridatlasGeneration` returns `"202610270024"`;
- `__GRIDATLAS_MODULES__.menuBar.inspect()` returns `{engine:60,pipeline:3,total:63,unique:63,complete:true}`;
- there are zero requests to `raw.githubusercontent.com/Ventusltd/lightning`.

## 8. Rollback to 202609241334
See `ROLLBACK-COMMANDS.sh`.
- **Route C (recommended) is `git revert <release commit>`.** The rehearsal restored `atlas/current.json` and `STATE.md` byte-exact (sha256 `1ea60d61…`, `b8bef1e1…`). Lint, state parity, verify-compose, run-current and the 202609241334 proof all pass (`4C-revert.txt`, `4C-reverted.gates.txt`, and on the 1c19b76 base, `6C-revert-on-1c19b76.txt`).
- **Route B, `tools/rollback.mjs`, is not byte-exact by design.** It cuts a new generation:
  - the four cartridges, shell, order and v9.156 are identical;
  - seven identity keys differ;
  - it also rewrites `atlas/state/live-set.json` and adds a manifest.

  Every gate passed on it (`4B-*`).

Nothing under `atlas/v/**`, `atlas/modules/**` or `atlas/cartridges/**` is deleted, and `/atlas/v/202610270024/` keeps serving the candidate.
