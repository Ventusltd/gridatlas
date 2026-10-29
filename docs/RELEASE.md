# Releasing a generation to the live route

A **release** moves `atlas/current.json` (and `STATE.md`, which AGENTS.md ties
to it) from the live generation to a **preview** generation that was already
published under `atlas/v/<G>/` and tested there. Nothing else changes: the
cartridges, manifest, proof and preview loader are already on main from the
preview PR.

Until 28 Oct 2026 this was done by hand from rehearsal E's RELEASE-COMMANDS.md
(kept on the hardening branch, not on main), then the Build L3 release in PR #49. The two scripts below are
that procedure, checked end to end. They never push, never open a PR, never
touch `atlas/releases/**` and never decide that something should ship: the
owner's authorisation is a required argument and is written into the commit.

| script | does |
|---|---|
| `tools/release/release-generation.mjs` | preconditions → optional preparatory commits → pointer + `STATE.md` → every gate → release commit on a branch → hashes |
| `tools/release/rollback-generation.mjs` | `git revert` of the release commit (route C) → byte-exact restore check → every gate → revert commit on a branch |
| `tools/release/lib.mjs` | shared derivation, git and gate helpers |

They are steps 4 and 8 of the delivery flow below, which scripts the whole
path from a cut to the served homepage.

## The delivery flow, end to end

Eight steps, each one script in `tools/release/` (or one `gh api` command),
each with pre-conditions it checks itself. Every script reads GitHub only
through repository-scoped `gh api` REST calls. GraphQL (`gh pr create`,
`gh pr list`) and the search API are not used, because some agent sandboxes
refuse them.

```bash
node tools/release/release-status.mjs            # where every candidate is, and its next step
```

| # | step | command | pre-conditions (checked) | done when |
|---|---|---|---|---|
| 1 | cut | `tools/lightning/make-generation.mjs --gen G --version v9.N --variant layers\|dots --label NAME --scope "…"` (from `tools/lightning/src/`; see `docs/LIGHTNING-SOURCE.md`) | the source rebuilds; G is a real, later UTC minute; the version is unused and higher than every recorded one; G's files do not exist; module and cartridge within budget | the 6 files written, `generations.json` updated; protected files unchanged |
| 2 | preview PR | `publish-preview.mjs --generation G [--generation G2] [--allow PATH] --push` | change set against main is additive (6 files per G, one optional progress note, the `tools/lightning/src/` + `generations.json` edit; anything else named with `--allow`; never the pointer, `STATE.md`, the loader or `atlas/releases/**`); G cut against the current live; preview route = the pointer the release will write; the local `pr-gate.mjs` passes | draft PR open; CI (`pr-file-size-guard.yml`: size-guard + cartridge-gate) green; rebase-merged, so `atlas/v/G/` is on Pages |
| 3 | owner acceptance | the owner comments `ACCEPT G` (first line) on the preview PR, or adds the label `accepted:G`; `acceptance.mjs --generation G` reads it | by an owner login, not through a GitHub App, no agent signature, after G's `cut_at_utc`; a later `REJECT G` or removing the label withdraws it | `acceptance.mjs` exits 0 |
| 4 | release | `release-accepted.mjs --generation G --push` (runs `release-generation.mjs`, below) | step 3; the preview PR is merged and its CI green; clean worktree at `origin/main`; then every precondition and gate of `release-generation.mjs` | draft release PR with CI green; the owner merges it with **rebase**: `gh api -X PUT repos/Ventusltd/gridatlas/pulls/<N>/merge -f merge_method=rebase` |
| 5 | live bytes | `check-live.mjs --generation G --wait` | main's `atlas/current.json` names G | the `live-bytes` job of `202608301321-verify-live.yml` (runs on every push to main) passed for main's head |
| 6 | homepage | `homepage-bump.mjs label --homepage DIR --push`, merge; `homepage-bump.mjs pin --homepage DIR --domain DIR --push` + restore point, merge; `homepage-bump.mjs deploy [--dispatch]` | label: G live, live-bytes passed, G accepted, homepage clone clean at origin/main and not yet recording G. pin: homepage main makes G operative; the 7 bundle files re-read from GitHub match the pin; the domain clone is **sparse** (`/catalogue/`, non-cone) | homepage label PR merged; domain pin PR merged; `deploy-pages.yml` succeeded for globalgrid2050 main |
| 7 | served | `check-served.mjs` locally, or in CI: `gh api -X POST repos/Ventusltd/gridatlas/actions/workflows/202608301321-verify-live.yml/dispatches -f ref=main -f 'inputs[mode]=served-homepage'` | step 6 deployed | the served `homepage-shell/data/homepage.json`, CSS and JS match the pin byte for byte, and `/` shows the GridAtlas row with G's label, linking the live route |
| 8 | rollback | GridAtlas: `rollback-generation.mjs --release-commit <sha>` (route C, below), published like a release. Homepage: `python scripts/releases.py promote gridatlas <previous id> --reason "..."` in the homepage repo, then pin (6) and served (7) again | see "Rollback (route C)"; the homepage keeps every release, so the previous one is promoted back | live-bytes and the served check pass for the restored generation |

### Rules the scripts enforce

- **Agents never record acceptance.** Agents work with the owner's GitHub
  token, so a comment's login alone cannot prove it came from the owner. No
  script writes an `ACCEPT` line or the label. `acceptance.mjs --record`
  refuses to run under Claude Code, Codex or CI. `acceptance.mjs --how --pr N`
  prints the owner's one-line command.
- **Only the owner merges a release.** Every PR the flow opens is a draft. The
  release PR is merged with rebase, never squash (see below).
- **One budget.** No new workflow. Step 7's CI path is a third `mode` of the
  existing `202608301321-verify-live.yml`: dispatch-only and read-only. It
  leaves `ACTIVE_WORKFLOWS` and `STATE.md` unchanged.
- **globalgrid2050 is never checked out in full.** For a pin, use a worktree
  with only the catalogue:

  ```bash
  git -C ~/globalgrid2050 worktree add --no-checkout --detach ../gg-pin origin/main
  cd ../gg-pin && git sparse-checkout set --no-cone /catalogue/ && git checkout --detach origin/main
  ```

  Cone mode also materialises every root file (about 257 MB), so use
  `--no-cone`.
- **Rehearsals stay local.** `release-accepted.mjs --rehearsal` and
  `homepage-bump.mjs label|pin --rehearsal` do everything except read
  acceptance and live state. They write `rehearsal/...` branches and refuse
  `--push`.

### Rehearsed for M4 (29 Oct 2026, CD-pipeline lane; nothing pushed to main, nothing released)

| step | result |
|---|---|
| 1 cut | at `3ec1e6b` + this tooling, `tools/lightning/make-generation.mjs` cut a throwaway `layers` (M4-variant) generation `202610290400` (v9.199, never published); its proof passed. Earlier, at `39c62b4`, a prebuilt-module cutter (lane evidence, not committed: the source-based scaffolder landed in #63 meanwhile) re-cut M4 and M4b from M3 **byte-identical** to `a80b760` / `dfcf29c` |
| 2 preview | `publish-preview.mjs` committed M4 + M4b (at `39c62b4`) and the throwaway cut (at `3ec1e6b`) on local branches; the local `pr-gate` gave 16/16 PASS for M4 + M4b (M4 191 pass / 10 skip, M4b 186 / 15) and 14/14 PASS (lightning-source included) for the throwaway cut |
| 3 acceptance | M4 and M4b: none yet (exit 3); `--record` refused under an agent |
| 4 release | the real path stops: `202610290045 is not accepted (none)`. `--rehearsal`: 7/7 gates, `atlas/current.json` `e3eca669…` → `b1b0f98b…`, `STATE.md` `5867656…` → `22e5718a…`; `pr-gate` on the release commit 10/10 PASS |
| 5 live bytes | `check-live.mjs` reads PASS for main `73c0e76` (L3); `--local` cannot reach `*.github.io` from the sandbox |
| 6 homepage | `label --rehearsal`: the homepage tool wrote "V9.176 - 29 October 2026"; the homepage checks passed and the fallback is idempotent. `pin --rehearsal` in a sparse catalogue-only worktree: `cb741ca` → the local label commit. `deploy`: `deploy-pages.yml` success for main |
| 7 served | the sandbox is blocked (CONNECT 403); the CI mode is the path |
| 8 rollback | route C of the rehearsal release: byte-exact `e3eca669…` / `5867656…`, 5/5 gates, tree identical to before the release |


## Release

Always from a fresh worktree of main, never your working clone:

```bash
cd ~/gridatlas && git fetch origin
git worktree add --detach ../gridatlas-release origin/main && cd ../gridatlas-release

# 1. dry check: preconditions only, writes nothing
node tools/release/release-generation.mjs --generation <G> --check

# 2. the release commit, on release/<G>-gridatlas-<version>
node tools/release/release-generation.mjs --generation <G> \
  --authorised-by "owner (Vikram), <link to the approving comment>" \
  --title "release Lightning Build <name> (OFF by default) to the live route" \
  --report ../release-<G>.json --log ../release-<G>.gates.log
```

### What it checks before writing anything (all against committed bytes)

- **Main is clean:** no changed or untracked files, and `HEAD` is exactly
  `--base` (default `origin/main`).
- **Live is the expected predecessor:** the live generation equals
  `--expect-live` (default: G's `previous_generation`), and G's manifest was cut
  against it. A G cut against an older live is refused; re-cut it.
- **The preview files are present and committed:**
  - `atlas/manifests/<G>-composition.json`, whose `generation` and
    `composition_manifest` name G and which is not marked `REJECTED`;
  - `atlas/v/<G>/current.json` and `atlas/v/<G>/index.html`;
  - every cartridge the manifest names, each hashing to its recorded sha256;
  - `tools/proofs/<G>-<id>.proof.mjs` for every cartridge cut at G.
- **The tested preview is the release:** `atlas/v/<G>/current.json` must equal
  the pointer about to be written, with its relative references re-rooted to
  `../../`. If anyone edited one and not the other, it stops.
- **The proof passes** on the preview route.
- **The loader:** `atlas/index.html` and `atlas/v/<G>/index.html` are
  byte-identical (`LOADER_IDENTICAL`), or `atlas/v/<G>/index.html` is a
  different *registered* loader that supports every slot G uses
  (`LOADER_FOLLOWS`: loader v2 for a modular lightning generation, see
  docs/LIGHTNING-CARTRIDGE.md). In that case the release commit also writes
  `atlas/index.html := atlas/v/<G>/index.html`, so reverting it restores the
  v1 loader byte for byte.

### What it writes

`atlas/current.json` is derived from G's manifest exactly as the hand release
did it:

1. drop the six cut-only keys (`parent_generation`, `version`, `cut_at_utc`,
   `note`, `acceptance` and `candidate_status`);
2. write `JSON.stringify(manifest, null, 1) + "\n"`;
3. run `node tools/scope/loop.mjs state`.

Only those two files may change (three when the loader follows, above), and
only they are in the release commit. That is what keeps the release
separately revertable, byte for byte. `rollback-generation.mjs` accepts a
release commit of exactly those two or three files and proves each one is
restored byte-exact.

### Gates (the hand list, in order)

| gate | must |
|---|---|
| `node tools/scope/loop.mjs lint` | pass |
| `loop.mjs state --stdout` vs `STATE.md` | identical |
| `node tools/scope/verify-compose.mjs` | `composition=PASS`, `generation=<G>` |
| `node tools/proofs/run-current.mjs` | pass |
| `tools/proofs/<G>-*.proof.mjs` | pass |
| `202609012214-data-contract-parity.proof.mjs` | **no FAIL row the base did not already have** (today it has the three known pre-existing rows, which are reported, not hidden) |
| `node tools/rollback.mjs --to <predecessor> --dry-run` | exit 0 |

If any gate is red, the pointer is restored. If no preparatory commit was made,
the empty branch is deleted and `HEAD` goes back to where it started. The
script exits 1.

### Preparatory commits

Sometimes main cannot pass lint with G live until something else lands first:
- in L3's case, a tenth workflow had to be retired;
- the cartridge ceiling had to be raised.

These go in **their own commits before** the release commit, never inside it:

```bash
  --prep-gate-kb <N> --prep-gate-reason "owner decision, <date> HH:MM UTC, <link>"   # N above the current ceiling (500 kB since 28 Oct 2026); --check validates it
  --prep-commit <sha>          # cherry-picked as is; repeatable
```

Each preparatory commit must leave lint green and `STATE.md` unchanged. It
must also not touch the pointer, `STATE.md`, the loader or `atlas/releases/**`,
or the script stops.

**Note:** `--prep-gate-kb` changes only the ceiling in `tools/scope/loop.mjs`.
A generation's own proof may carry its own byte budget, and that budget is
part of the preview.

### Output

The script prints:
- the before and after sha256 of `atlas/current.json` and `STATE.md`;
- the prep commits;
- the release commit, its tree and its parent;
- the diffstat against base;
- the next steps.

`--report` writes the same, with every gate row, as JSON.

### Publishing (a person does this)

`release-accepted.mjs --push` does this. By hand (REST, because `gh pr create`
needs GraphQL):

```bash
git push -u origin release/<G>-gridatlas-<version>
gh api -X POST repos/Ventusltd/gridatlas/pulls -f head=release/<G>-gridatlas-<version> -f base=main -F draft=true -f title='…' -F body=@body.md
```

Merge with **Rebase and merge**, never squash. Squashing would fold any
preparatory commit into the release commit, and the revert would then undo the
gate raise too. After Pages deploys, `check-live.mjs --generation <G> --wait`
reads the CI live-bytes job; locally, run the dependency-free byte check
`node tools/scope/verify-live-bytes.mjs --base https://ventusltd.github.io/gridatlas/`
(it retries while the CDN catches up; `tools/scope/verify-live.mjs` additionally
needs Playwright). Then, in a browser console on the live route with lightning OFF:

- `document.documentElement.dataset.gridatlasGeneration` returns `"<G>"`;
- `__GRIDATLAS_MODULES__.menuBar.inspect()` returns `{engine:60,pipeline:3,total:63,unique:63,complete:true}`;
- the network panel shows zero requests to `raw.githubusercontent.com/Ventusltd/lightning`.

### No-op mode

If G is already live, the script runs every precondition and every gate. It
also requires the pointer derived from G's manifest to be **byte-identical** to
the live `atlas/current.json`, and it commits nothing.

Use it on main at any time to prove the tooling and the live pointer still
agree:

```bash
node tools/release/release-generation.mjs --generation "$(node -p 'require("./atlas/current.json").generation')"
```

## Loader first, then the pointer (a generation served by a different loader)

When the generation going live is served by a different registered loader than
the live one (loader v2 for a modular generation such as 202610290915,
docs/LIGHTNING-CARTRIDGE.md), the release is **two** commits, each its own PR,
each revertable on its own:

| step | command | changes | proven |
|---|---|---|---|
| 1 loader | `node tools/release/loader-swap.mjs release --to v2 --authorised-by "…"` | `atlas/index.html` only, on `release/loader-v2-<live gen>` | the new loader is registered, supports every slot of the unchanged live pointer, and (run verbatim in `node:vm`) writes byte-for-byte the HTML and cartridge blobs the old loader writes for it; then every release gate plus `loader-equivalence` |
| wait | `check-live.mjs`, `check-served.mjs` (or its CI mode) | nothing | step 1 is served, **and at least 10 minutes have passed since it deployed** |
| 2 pointer | `release-generation.mjs --generation G …` (or `release-accepted.mjs`) | `atlas/current.json` + `STATE.md` (`LOADER_IDENTICAL`: the live loader is already G's) | the usual release gates |

**Why the wait.** GitHub Pages serves HTML with a short `max-age` (documented
as 10 minutes), and `current.json` is fetched `no-store`. If the loader and the
pointer moved in one deploy, a browser holding the cached v1 `atlas/index.html`
would read the modular pointer and fail closed ("unsupported cartridge slot")
until its cache expired. Step 1 changes nothing visible: v2 composes the live
pointer exactly as v1 does. So wait for `check-served` to pass on step 1, and
then **at least 10 more minutes** (the cache window), before merging step 2.

**The gate.** `tools/ci/pr-gate.mjs` (`loader-registry`) accepts a PR that
changes `atlas/index.html` without `atlas/current.json` only when
`node tools/release/loader-swap.mjs check --base <base>` passes for it: a
registered loader, every live slot supported, byte-identical composition of the
unchanged live pointer. With the pointer, the loader may still only become the
loader of the generation going live (`LOADER_FOLLOWS`, unchanged).

**Rollback is in the reverse order: pointer first, then the loader.**

- B (pointer): `rollback-generation.mjs --release-commit <step 2 sha>`; the
  route-C revert of a two-file release; the loader stays v2, which composes the
  restored replace-script pointer exactly as v1 does.
- A (loader): `rollback-generation.mjs --release-commit <step 1 sha>`. A
  loader-only commit is reverted only under the same proof, from v2 back to v1
  for the pointer that is live then. While a generation that needs v2 is live,
  it is **refused** ("roll the pointer back first, then the loader"). It
  restores `atlas/index.html` byte-exact and leaves `atlas/current.json` and
  `STATE.md` untouched.

Rolling back the loader is optional: v2 is equivalent for every
replace-script-only composition (`loader-equivalence`, 46 today).

`publish-preview.mjs` accepts any registered loader that supports the preview's
slots, so monolithic previews (v1) still publish once the live loader is v2;
`release-generation.mjs` moves the loader with the pointer when they differ.

## Rollback (route C)

```bash
git worktree add --detach ../gridatlas-rollback origin/main && cd ../gridatlas-rollback
node tools/release/rollback-generation.mjs --release-commit <sha of the release commit on main> \
  --reason "what is wrong, who decided"
```

The script refuses in three cases:
- the commit is not a single-parent ancestor that changed exactly
  `atlas/current.json` and `STATE.md`;
- the tree is dirty or `HEAD` is not `--base`;
- the pointer has moved since that commit. Reverting an older release would not
  restore a known state; use `tools/rollback.mjs` (route B) for that.

Otherwise it does the following:
1. runs `git revert --no-commit`;
2. requires `atlas/current.json` to be **byte-identical** to the release
   commit's parent;
3. requires `STATE.md` to be byte-identical too, unless something else has
   legitimately changed `STATE.md` since the release; in that case it must
   still match the generator;
4. runs the gates against the predecessor generation;
5. commits `Revert "<release subject>"` with the reason on `rollback/<G>-to-<P>`.

Publish it the same way as a release.

Route B (`tools/rollback.mjs`, also behind `rollback-composition.yml`) cuts a
new generation instead, so it is not byte-exact by design. It is the right tool
when the release to undo is not the last pointer move.

## Why there is no GitHub `release` workflow

`tools/scope/loop.mjs` enforces an exact workflow budget:
- the active `.github/workflows/*.yml` set must equal `ACTIVE_WORKFLOWS` in
  `tools/scope/lib.mjs`;
- `STATE.md` prints that count.

A tenth workflow therefore means editing `ACTIVE_WORKFLOWS` **and**
regenerating `STATE.md` in the same commit. That is a change to the durable
state file, made for tooling rather than for a composition, and the CI lanes
are not authorised to make it.

Folding a release mode into `rollback-composition.yml` would keep the count. It
would also give a workflow that today does exactly one thing a second job that
moves the pointer forward, with `contents: write`.

So releases stay script-only, run by a person, with the PR as the review gate.
The delivery flow above keeps to the same budget: its only CI addition is the
read-only, dispatch-only `served-homepage` mode of `202608301321-verify-live.yml`.
If the owner wants a dispatch path later:
- add one `release-generation.yml` that runs `--check` and then the release
  onto a branch and opens a draft PR (never pushing main);
- register it in `ACTIVE_WORKFLOWS`;
- regenerate `STATE.md` in the same commit.

## Rehearsed (28 Oct 2026, CI-release lane; nothing pushed to main)

| rehearsal | result |
|---|---|
| L3→L3 no-op on main | NOOP PASS; derived pointer `e3eca669…` = live `atlas/current.json`; 7/7 gates |
| Replay of the real L3 release from its parent `2f7d752` | 7/7 gates; `atlas/current.json` `e3eca669…` and `STATE.md` `5867656…` **byte-identical to PR #49's `08b5cae`** |
| Route-C rollback of `08b5cae` on main | restores `1ea60d61…` / `b8bef1e1…` byte-exact (the 202609241334 hashes in RELEASE-COMMANDS.md); 5/5 gates |
| Synthetic G `202610282200` (485 kB) without a gate raise | stopped at `loop.mjs state` (480 kB ceiling); pointer restored, no branch left |
| Same G with `--prep-gate-kb 500` | prep commit and release commit; 7/7 gates; route-C rollback byte-exact |
| Build M `202610281950` on main `97929ba` (local branch only, not authorised) | `--check` PASS; release 7/7 gates, `atlas/current.json` → `c4b9040f…`, `STATE.md` → `f6bb0e52…`; route-C rollback byte-exact |
| 13 negative cases | every one stops with a specific reason |
