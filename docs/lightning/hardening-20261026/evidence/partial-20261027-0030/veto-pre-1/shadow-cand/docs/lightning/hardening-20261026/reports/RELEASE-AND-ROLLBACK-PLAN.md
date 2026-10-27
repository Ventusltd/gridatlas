# RELEASE-AND-ROLLBACK-PLAN.md — GridAtlas lightning overlay (issue #32 §13 items 4–5)

Author: opus-release-rollback. **Documentation only: nothing was run against main, a shared branch or Pages.** Harness: self (node v22.23.4, no browser). Candidate fda6b10 (202610261949); main c08f3a6 (202609241334). Commands were rehearsed in a private worktree under `evidence/opus-release-rollback/`; it was never committed and has since been removed.

## 0. Parameters — this document is parameterised on `<GEN>`

| symbol | today | note |
|---|---|---|
| `<GEN>` | 202610261949 | **May change** if the Claude lane reissues a generation after fixes (§8F, §12E). The 202610261949 files stay immutable. |
| `<VER>` | v9.158 | v9.157 was burned by V1 202610221600 (live in cd9a27e, reverted in 1eb6414). For a reissue I recommend v9.159, since a committed manifest already declares v9.158 (owner decision). |
| `<PRED>` (candidate_predecessor) | 202610221600 | For a reissue: 202610261949. |
| `<BASE>` | 202609241334 (v9.156) | The live generation and the rollback target. |
| `<RB>` | clock UTC | The stamp that `tools/rollback.mjs` cuts. |

## 1. Preconditions (all owner-gated)

1. Issue §13.1–3 are done: V1–V15 signed by both reviewers, the R01 Grid-footer decision made, and real-device approval given.
2. **Stage 1: the owner merges the `<GEN>` candidate PR into main, with the pointer untouched.** That PR carries the module, cartridge, proof, manifest, `atlas/v/<GEN>/`, and the deletion of `.github/workflows/uk-lightning-preview.yml`. It must come first because:
   - (a) on main today, `node tools/scope/loop.mjs lint` exits 1 with "active workflow budget mismatch" (10 workflows; pre-existing), so neither `loop.mjs state` nor `rollback-composition.yml` can succeed until that deletion lands;
   - (b) device approval needs `https://ventusltd.github.io/gridatlas/atlas/v/<GEN>/`, and Pages serves main (3b2184f);
   - (c) cartridges reach Pages before any pointer names them.
3. OWNER_DECISION (recommended): also add `atlas/v/202609241334/` (identical loader, `../../` paths). None of the 26 existing routes is 202609241334, so after release the original would otherwise have no comparison route.
4. UNKNOWN: whether Stage 1 adds a public homepage-catalogue row (`docs/CI-CD-PLAN.md:95-97`; the catalogue is not in this repository).

## 2. The release PR (separate, owner-authorised, exactly one commit)

Branch from main after Stage 1 as `release/<GEN>-gridatlas-<VER>`. **Do not use `tools/recompose.mjs`:** it stamps from the clock (±5 min, `:145-153`), refuses an existing `<GEN>-composition.json` (`:187-190`), and would re-cut sld-sandbox (f2d3bfb). A release promotes an existing generation (precedents 3235a34, 3b2184f), so the stamp stays older than the release date.

**R1. Reconfirm.** `git show origin/main:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).generation'` must print `202609241334`. Stop if anything moved (issue §13).

**R2. Write the pointer from the committed manifest, not from `atlas/v/<GEN>/current.json`:**
```
GEN=<GEN> node -e 'const fs=require("fs"),G=process.env.GEN;
const m=JSON.parse(fs.readFileSync(`atlas/manifests/${G}-composition.json`,"utf8"));
for(const k of["parent_generation","version","cut_at_utc","note","acceptance"])delete m[k];
if(m.generation!==G||m.composition_manifest!==`./manifests/${G}-composition.json`)throw Error("identity");
fs.writeFileSync("atlas/current.json",JSON.stringify(m,null,1)+"\n")'
```
A naive `../../`→`./` rewrite of the preview pointer would turn `contract: ../../ui/…` into `./ui/…`, which fails `tools/proofs/202609071213-uk-gazetteer-flyto.proof.mjs:28-29` under run-current. For a reissue, also drop any other manifest-only key (e.g. `candidate_status`).

Rehearsed for 202610261949 (`proposed-release-current.202610261949.json`); only these change:

| key | before | after |
|---|---|---|
| generation | 202609241334 | `<GEN>` |
| previous_generation | 202609200022 | 202609241334 |
| composition_version | v9.156 | `<VER>` |
| composition_id | 202609241334-gridatlas-v9.156 | `<GEN>-gridatlas-<VER>` |
| composition_manifest | ./manifests/202609241334-composition.json | ./manifests/`<GEN>`-composition.json |
| superseded_generation | 202609200022 | 202609241334 |
| candidate_predecessor | 202609241251 | `<PRED>` |
| composition_note | v9.156 note | `<GEN>` note |
| sld-sandbox | 202609241334 · v9.156 · `7812…a4ca` · 435,218 B | `<GEN>` · `<VER>` · `b7d4…5f85` · 459,192 B; derived_from `./cartridges/202609241334-sld-sandbox-v9-8.js`; +capability `uk-lightning-optical-flash-overlay-off-by-default`; +`uk_lightning` block |

`parent_generation: 202609241334` stays in the committed manifest, which is what `rollback.mjs:120-133` walks.

**R3. Root pointers.** Make the same edit to both files, because `loop.mjs:152-154` requires them to be equal:
```
GEN=<GEN> node -e 'const fs=require("fs"),G=process.env.GEN;
for(const f of["state/live-set.json","releases/current-v5.json"]){const p=JSON.parse(fs.readFileSync(f,"utf8"));
p.current.atlas_composition.generation=G;p.current.atlas_composition.manifest=`atlas/manifests/${G}-composition.json`;
fs.writeFileSync(f,JSON.stringify(p,null,1)+"\n")}'
```
Both name 202609051624 today (stale since 805b4b1; lint never checks the generation). These are the fields `recompose.mjs:452-463` writes. The shell-level `rollback` block is left alone.

**R4 (OWNER_DECISION; not named in §13.4).** Also update `atlas/state/live-set.json` (`generation`, `composition_manifest`; stale at 202609060259). Both tools write this file (`recompose.mjs:443-450`, `rollback.mjs:241-248`).

**R5.** Run `node tools/scope/loop.mjs state`. Only the STATE.md Composition line changes, to `` `<GEN> · 202608300453-atlas-v9 · streaming-parquet-bridge → uk-gazetteer-flyto → substation-intelligence → sld-sandbox` ``.

**R6.** Run the §3.1 gates. `git diff --stat origin/main..HEAD` must list exactly `atlas/current.json STATE.md state/live-set.json releases/current-v5.json atlas/state/live-set.json` (rehearsal: these five files, +46/−22).

**R7.** Make one commit, `<GEN>-gridatlas-<VER>: release …`, citing the owner's authorising comment. Squash-merge, so main receives a single revertable commit.

## 3. Sanity checks

### 3.1 Before merge (on the release head; all rehearsed, `rehearsal-gates.txt`)
```
node tools/scope/loop.mjs lint                            # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md # silent
node tools/scope/verify-compose.mjs                       # "composition":"PASS","generation":"<GEN>"
node tools/proofs/run-current.mjs                         # proofs run: 4 … every composed cartridge passed
node tools/proofs/<GEN>-sld-sandbox.proof.mjs             # SLD exact delta … PASS
cmp atlas/index.html atlas/v/<GEN>/index.html             # silent
git show HEAD:atlas/<cartridge path> | sha256sum          # each of the four = recorded sha256
node tools/rollback.mjs --to 202609241334 --reason readiness --dry-run  # 4×MATCH, shell PRESENT, "1 generation back", exit 0
node tools/rollback.mjs --to 202610221600 --reason readiness --dry-run  # refused: not an ancestor (exit 1)
```
- `202609241334-sld-sandbox.proof.mjs` exits 1 after the flip by design, because it reads `atlas/current.json`. **Never rename or delete it:** a rollback's run-current needs it.
- `202609040229-arrival-identity-corpus.proof.mjs` needs the pinned pipelinenews checkout beside the repo. It is BLOCKED_HARNESS locally (it fails identically on main) and CI runs it.
- **CI:** both jobs of `202608312212-cartridge-proof.yml` must be green. They compose `<GEN>` as root and include all-layer-clicks, all-controls, menu-bar-mobile-hit and `git diff --exit-code -- STATE.md`.

**60+3 check** (browser; release head served locally; lightning OFF). Issue P05's names map onto `menu-bar.js:130-138`:
```
__GRIDATLAS_MODULES__.menuBar.inspect()   // {engine:60, pipeline:3, total:63, unique:63, complete:true}
__GRIDATLAS_MODULES__.menuBar.installed   // true
document.querySelectorAll('[data-gridatlas-layer-proxy]').length  // 63
document.querySelectorAll('[data-gridatlas-layer-key]').length    // 63
```
Also: 13 original `.key-group`s first (Topology first), lightning last; zero requests to `raw.githubusercontent.com/Ventusltd/lightning` while OFF.

### 3.2 After deploy — the owner verifies that served bytes equal the commit
```
SHA=$(git rev-parse origin/main)   # the squash-merge commit
gh api repos/Ventusltd/gridatlas/pages/builds/latest --jq '.status+" "+.commit'   # built <SHA>
B=https://ventusltd.github.io/gridatlas/atlas
curl -fsS -H 'Cache-Control: no-cache' "$B/current.json?v=$SHA" | cmp - <(git show $SHA:atlas/current.json) && echo POINTER_OK
for f in index.html v/<GEN>/index.html v/<GEN>/current.json releases/202608300453-atlas-v9/index.html \
  $(git show $SHA:atlas/current.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).cartridges.map(c=>c.path.slice(2)).join(" ")'); do
  curl -fsS "$B/$f?v=$SHA" | cmp -s - <(git show "$SHA:atlas/$f") && echo "OK $f" || echo "MISMATCH $f"; done
GRIDATLAS_BASE_URL=https://ventusltd.github.io/gridatlas/ node tools/scope/verify-live.mjs
```
Retry POINTER_OK for ~10 min (CDN; `verify-live.yml:178-194` polls 120×5 s). The loader itself refuses to boot on any cartridge digest mismatch (`atlas/index.html:70`).

**On each real device**, check:
- `document.documentElement.dataset.gridatlasGeneration` is `<GEN>`;
- the `__GRIDATLAS_ATLAS__.loaded_cartridges` sha256 values equal `current.json`;
- the 60+3 values hold, and lightning is OFF after a reload;
- one live ON load is witnessed (R07).

iPhone console needs Safari Web Inspector on a Mac; otherwise label it visual-only.

## 4. Rollback plan

**Old generation:** 202609241334 (v9.156), `atlas/manifests/202609241334-composition.json`. Its cartridges stay on disk because the release deletes nothing. 202610221600 (V1) is refused as not an ancestor.

**The serving flip is atomic.** The loader reads only `./current.json`, the shell and the cartridges, all with `cache:'no-store'` (`atlas/index.html:39,67`). There is no service worker, and cartridge paths are generation-stamped and never removed. One file decides; browsers switch on next load, and open tabs keep `<GEN>` until reloaded.

| route | how | atomic across all pointers? |
|---|---|---|
| **A. Emergency** | The owner dispatches Actions → "Rollback GridAtlas composition" (`to_generation=202609241334`, a reason, `confirm=ROLL BACK`). The workflow runs rollback.mjs, `loop state`, verify-compose, run-current and lint. It permits changes only to `atlas/current.json`, `atlas/state/live-set.json`, `atlas/manifests/*-composition.json` and `STATE.md` (`rollback-composition.yml:135-146`), then pushes one commit to main (`:148-170`). | **No.** The root pointers keep naming `<GEN>`, and lint cannot notice. Follow up the same day with R3 using `GEN=<RB>`. |
| **B. Atomic (preferred)** | An owner-authorised PR from a fresh worktree of main: run `node tools/rollback.mjs --to 202609241334 --reason "<why>"`, then R3 with `GEN=<RB>`, then `node tools/scope/loop.mjs state`, then the §3.1 gates (run-current now proves 202609241334). Commit `atlas/current.json atlas/state/live-set.json atlas/manifests/<RB>-composition.json STATE.md state/live-set.json releases/current-v5.json` as one commit and squash-merge. | Yes |
| **C. Byte-exact revert** (OWNER_DECISION) | `git revert --no-edit <release SHA>` puts all five files back to their pre-release bytes in one commit. It re-serves stamp 202609241334 with no rollback manifest, contrary to `rollback.mjs:21-26`. | Yes |

**Precedent not to repeat:** on 2026-10-23 the V1 rollback split `current.json` and `STATE.md` across two commits (1eb6414, c09d199), which violates `AGENTS.md:16`.

**Rehearsal of the A/B tool path** (`rehearsal-rollback.txt`):
- the rollback cut 202610262234-gridatlas-v9.156;
- compared with the pre-release pointer, only identity keys differ (cartridges, shell and order are identical);
- lint, state parity and verify-compose pass, and run-current passes 4/4 (sld-sandbox 202609241334).

Record these tool artefacts afterwards, but never hand-edit them in an emergency:
- the restored pointer keeps `superseded_generation: 202609241334` and `candidate_predecessor: <PRED>`, because `rollback.mjs:195-208` spreads `...current`;
- the new manifest carries `previous_generation: 202609200022` beside `parent_generation: <GEN>`.

**After-rollback checks.** The served `current.json` shows generation `<RB>` and `composition_version` v9.156, and this diff is silent:
```
diff <(curl -fsS "$B/current.json?v=$SHA" | jq -S '.cartridges,.cartridge_order,.shell') \
     <(git show $SHA:atlas/manifests/202609241334-composition.json | jq -S '.cartridges,.cartridge_order,.shell')
```
Also confirm:
- STATE.md names `<RB>`;
- the 60+3 values match §3.1;
- there is no lightning group (the four live cartridges contain 0 occurrences of "lightning");
- the §3.2 byte loop prints OK;
- `/atlas/v/<GEN>/` still boots `<GEN>`.

### Preview routing
| phase | `/gridatlas/atlas/` | `/gridatlas/atlas/v/<GEN>/` |
|---|---|---|
| before release | 202609241334 | `<GEN>` |
| after release | `<GEN>` | `<GEN>`; the original is reachable only via the recommended `atlas/v/202609241334/` |
| after rollback | `<RB>` (= the 202609241334 composition) | still `<GEN>` |

No rollback route deletes or edits `atlas/v/**` or the `<GEN>` cartridge, module, manifest or proof. `<GEN>-sld-sandbox.proof.mjs` falls back to `atlas/v/<GEN>/current.json` (proof lines 11-12) and still passed after the rehearsed rollback.

### Data compatibility
- **OFF (the default) makes zero lightning requests and adds no source or layer** (candidate report §3; P13). Nothing in the live app depends on the collector while OFF.
- **The collector branch is not merged.** PR #2 is a draft at f7db76c (unmerged at 22:26 UTC, `reports/pr2-data-verifier.md:3`), and lightning main (local clone 38f2126) holds only `data/uk_lightning.geojson`. When a user switches ON:
  - the request to `…/main/data/history/index.json` (module line 9) gets a 404;
  - the module falls back to the 7-day feed by XHR (line 10) and disables long windows;
  - the caption reads "archive not yet published …; earlier hours unknown, not zero".
- **Schemas.** PR #2 writes `uk-lightning-history-index.v2` unconditionally and `uk-lightning-history-day.v1` shards. The module accepts only v2 (line 37) and refuses anything else visibly. This is R02, a known deviation (OWNER_DECISION).
- **A reader holding v2 index or shards at rollback.** After the next load no lightning code runs, so nothing reads them; the in-memory LRU (8) dies with the page; HTTP-cached sealed shards are inert (raw headers unmeasured; R07).
- **Independence.** A GridAtlas rollback never touches lightning data; PR #2 can merge or revert without a GridAtlas rollback.

## 5. Steps the AGENTS.md / issue #32 invariants forbid an agent to take without the owner

| step | rule |
|---|---|
| Merge Stage 1, push to main, or trigger Pages | §0 status, §2 last bullet; `AGENTS.md:18` |
| **Create the release PR at all** | §0: "Never create a release PR changing live pointer as part of this scope"; §13.4 |
| Edit `atlas/current.json`, `STATE.md`, `state/live-set.json`, `releases/current-v5.json` or `atlas/state/live-set.json`, or run the writing `loop.mjs state` in a shared tree | §2 first bullet; BRIEF rule 1 |
| Merge the release PR | §13.4 |
| Dispatch `rollback-composition.yml`, run `rollback.mjs` without `--dry-run` outside a private worktree, or `git revert` on main | each moves the pointer; workflow header: "The decision is a person's" |
| Real-device approval; the R01, R02 and R04 decisions; version numbers | §13.2–3 |
| **Nobody, ever:** edit `atlas/releases/**`, the four live cartridges or the 202609241334 manifest; overwrite or delete `<GEN>` files or `atlas/v/<GEN>/`; rename `202609241334-sld-sandbox.proof.mjs`; force-push | AGENTS.md invariants; §2, §8F |

Agents may run every non-writing check above, including `rollback.mjs --dry-run`.

## 6. What I do not know
- The Pages build SHA: `gh api …/pages` returns 403 through this sandbox's proxy (BLOCKED_DEPENDENCY), so the owner runs §3.2.
- The CDN lifetime of `current.json`, live CORS (R07), real devices and WebKit were not tested.

Evidence (`evidence/opus-release-rollback/`): `compare-pointers.mjs`, `derive-release-pointer.mjs`, `apply-release-pointers.mjs`, `proposed-release-current.202610261949.json`, `rehearsal-gates.txt`, `rehearsal-rollback-dryrun.txt`, `rehearsal-rollback.txt`, `rehearsal-release.patch`, `rehearsal-corpus.log`.
