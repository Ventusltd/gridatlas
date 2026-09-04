# The promotion lane

**For gridatlas, promotion IS fast-forwarding `main`.** GitHub Pages serves
`main` directly (classic Pages, no build workflow of its own), so there is
no separate "deploy" step to gate — the only thing that ever makes a new
generation reach the public site is `main`'s tip changing. Everything below
exists to make sure that only happens after every proof this repository has
for that exact commit has already passed.

## The problem this closes

An external review on 2026-09-04 found:

> v9.115 and v9.116 deployed despite a failed proof workflow. On v9.116,
> Pages completed deployment before the proof finished failing. The
> supposed gate is currently a post-deployment alarm.

`.github/workflows/202608312212-cartridge-proof.yml` triggers on `push:
branches: [main]` — it runs *after* the push it is meant to be checking has
already changed the served site. That workflow still earns its place (it
proves what actually shipped, in detail no faster gate could afford), but it
was never able to be the gate the name implies.

## The two lanes

### Build lane — `.github/workflows/202609042220-promotion-lane-build.yml`

Runs on push to `candidate/**` and on `pull_request`. Checks out the
candidate, runs `tools/scope/verify-compose.mjs`, `tools/proofs/run-current.mjs`,
and the two browser proofs that exercise the phone arrival path
(`tools/proofs/deep-link-visibility.browser.mjs`,
`tools/proofs/202609040229-arrival-identity.browser.mjs`), and writes one
proof receipt (`tools/proofs/promotion-receipt.mjs`) naming the generation,
version, commit, every proof's result and a UTC stamp read from the clock.
The receipt is uploaded as a workflow artifact and written as a short
comment-ready Markdown file.

`permissions: contents: read`, declared at both workflow and job level.
There is no step anywhere in the file that writes to this repository, calls
the Pages API, or dispatches another workflow. It cannot promote what it
proves — see `.cvaa/contracts/promotion-authority.json`, `build.*`.

### Promotion lane — `.github/workflows/202609042220-promotion-lane-promote.yml`

`workflow_dispatch` only, with two required inputs: `generation` and
`proof_run_id`. Before touching `main` it:

1. reads the named run back through the GitHub API — **read-only**, GET
   requests only — and requires it to be a completed, successful run of
   the build lane, for an exact `head_sha`;
2. downloads that run's own proof receipt artifact and cross-checks
   generation, commit and `overall: PASS` against what the API reported;
3. runs `tools/scope/promote.mjs check`, which refuses a **no-op** (the
   commit is already `main`'s tip), a **divergent reuse** (this generation
   was already promoted at a *different* commit), or a stale
   **expected_parent** (`main` moved since the tip was recorded, earlier in
   the same job) — see `.cvaa/contracts/serial-release-cutter.json`;
4. checks the candidate commit out and re-runs `verify-compose.mjs` and
   `run-current.mjs` against it, independently of whatever the build lane
   measured;
5. only then, a plain (never `--force`) `git push origin <commit>:refs/heads/main`
   — Git itself refuses this if it is not a fast-forward, which is the same
   protection step 3 already gives, kept here as the guarantee that holds
   even if step 3 raced;
6. `tools/scope/promote.mjs write` records the enriched `last_known_green`
   in `atlas/current.json`, `tools/scope/loop.mjs state` regenerates
   `STATE.md` in the same commit (AGENTS.md: "Any change to
   `atlas/current.json` must regenerate `STATE.md` with `node
   tools/scope/loop.mjs state` in the same commit"), and a second
   fast-forward push lands that commit.

`permissions: contents: write`, declared **only** here — no other file this
task touched carries it. The job runs under the `gridatlas-release-authority`
GitHub Environment and authenticates with `secrets.GRIDATLAS_PROMOTION_TOKEN`
only, with no fallback to the default token: if that secret is not
configured, the job fails closed in its first step rather than promoting
with a shared credential.

**Not independently verifiable from this branch**: whether the
`gridatlas-release-authority` environment actually carries required-reviewer
or allowed-actor protection is a repository setting, not a file in this
repo. This workflow can only be checked for *naming* that environment
(`tools/proofs/promotion-lane.proof.mjs` does exactly that); whether the
environment itself is configured is for whoever configures repository
settings to confirm, and is called out here rather than assumed.

## The enriched `last_known_green`

Before this change, `atlas/current.json` and `atlas/state/live-set.json`
both carried:

```json
"last_known_green": { "release_id": "202608300453-atlas-v9", "route": "/gridatlas/atlas/releases/202608300453-atlas-v9/" }
```

— the immutable *shell* every generation is built on, not the generation
that was actually live, and with no record of which commit shipped it or
whether anything had verified it first. `tools/scope/promote.mjs
mode=write` now writes:

```json
"last_known_green": {
  "generation": "202609042220",
  "version": "v9.117",
  "commit": "<40-hex candidate commit>",
  "proof_run_id": "123456789",
  "proof_run_url": "https://github.com/Ventusltd/gridatlas/actions/runs/123456789",
  "promoted_at_utc": "2026-09-05T00:00:00.000Z",
  "pinned_route": "./v/202609042220/"
}
```

`tools/scope/lib.mjs`'s `describeLastKnownGreen()` renders whichever shape
is present into `STATE.md`; nothing on this branch fabricates the enriched
fields for a generation that was never actually promoted through this lane
— today's `atlas/current.json` (v9.116, live before this branch existed)
still shows the legacy shape, honestly, until the first real promotion runs.

## What this branch did NOT do

- It never ran `tools/recompose.mjs`.
- It never touched `atlas/releases/`.
- Neither workflow has ever executed in GitHub Actions or touched `main`;
  every check in this document was run locally against this branch's own
  commits (see `tools/proofs/promotion-lane.proof.mjs` and the notes under
  the scratchpad path named in this task).
- It did not retire or rewire `202608301321-scope-loop.yml` or
  `202608301321-verify-live.yml`, both of which predate this task and can
  still push to `main` through their own, older mechanisms (the scope loop
  only via `workflow_dispatch`; the live verifier also on a push trigger
  scoped to five specific v9.5 transport files). Closing that is a
  follow-up outside this task's mandate, not something this branch silently
  papers over — `tools/proofs/promotion-lane.proof.mjs` names both files
  explicitly as a pre-existing, out-of-scope condition rather than either
  asserting they are safe or quietly ignoring them.
