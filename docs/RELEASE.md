# Releasing a generation to the live route

A **release** moves `atlas/current.json` (and `STATE.md`, which AGENTS.md ties
to it) from the live generation to a **preview** generation that was already
published under `atlas/v/<G>/` and tested there. Nothing else changes: the
cartridges, manifest, proof and preview loader are already on main from the
preview PR.

Until 28 Oct 2026 this was done by hand from
`docs/lightning/hardening-20261026/evidence/release-rehearsal-E/RELEASE-COMMANDS.md`
(rehearsal E, then the Build L3 release in PR #49). The two scripts below are
that procedure, checked end to end. They never push, never open a PR, never
touch `atlas/releases/**` and never decide that something should ship: the
owner's authorisation is a required argument and is written into the commit.

| script | does |
|---|---|
| `tools/release/release-generation.mjs` | preconditions → optional preparatory commits → pointer + `STATE.md` → every gate → release commit on a branch → hashes |
| `tools/release/rollback-generation.mjs` | `git revert` of the release commit (route C) → byte-exact restore check → every gate → revert commit on a branch |
| `tools/release/lib.mjs` | shared derivation, git and gate helpers |

## Release

Always from a fresh worktree of main, never your working clone:

```bash
cd ~/gridatlas && git fetch origin
git worktree add --detach ../gridatlas-release origin/main && cd ../gridatlas-release

# 1. dry check: preconditions only, writes nothing
node tools/release/release-generation.mjs --generation 202610281950 --check

# 2. the release commit, on release/<G>-gridatlas-<version>
node tools/release/release-generation.mjs --generation 202610281950 \
  --authorised-by "owner (Vikram), <link to the approving comment>" \
  --title "release Lightning Build M (OFF by default) to the live route" \
  --report ../release-202610281950.json --log ../release-202610281950.gates.log
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
- **The loader is identical:** `atlas/index.html` and `atlas/v/<G>/index.html`
  are byte-identical.

### What it writes

`atlas/current.json` is derived from G's manifest exactly as the hand release
did it:

1. drop the six cut-only keys (`parent_generation`, `version`, `cut_at_utc`,
   `note`, `acceptance` and `candidate_status`);
2. write `JSON.stringify(manifest, null, 1) + "\n"`;
3. run `node tools/scope/loop.mjs state`.

Only those two files may change, and only they are in the release commit.
That is what keeps the release separately revertable, byte for byte.

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
  --prep-gate-kb 500 --prep-gate-reason "owner decision, 28 Oct 2026 HH:MM UTC, <link>"
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

```bash
git push -u origin release/<G>-gridatlas-<version>
gh pr create --draft --base main --head release/<G>-gridatlas-<version>
```

Merge with **Rebase and merge**, never squash. Squashing would fold any
preparatory commit into the release commit, and the revert would then undo the
gate raise too. After Pages deploys, run
`GRIDATLAS_BASE_URL=https://ventusltd.github.io/gridatlas/ node tools/scope/verify-live.mjs`,
then do the browser checks listed in RELEASE-COMMANDS.md §7.

### No-op mode

If G is already live, the script runs every precondition and every gate. It
also requires the pointer derived from G's manifest to be **byte-identical** to
the live `atlas/current.json`, and it commits nothing.

Use it on main at any time to prove the tooling and the live pointer still
agree:

```bash
node tools/release/release-generation.mjs --generation "$(node -p 'require("./atlas/current.json").generation')"
```

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
