# CI: the pull-request gate

Every pull request runs two jobs from `.github/workflows/pr-file-size-guard.yml`:

| job | what it does |
| --- | --- |
| `size-guard` | fails a PR that adds or grows a file over 5 MB unless it is allowlisted |
| `cartridge-gate` | runs `node tools/ci/pr-gate.mjs --base <PR base sha>` on Node **22.23.4**, pinned exactly |

`cartridge-gate` runs the checks that used to be run by hand before a cut.
It uses only Node built-ins: no `npm ci`, no browser, no network and no
secrets. It takes about 3 seconds after checkout.

## What the gate checks

Every check runs even if an earlier one fails, so a single run reports
everything that is wrong. The job summary shows a table of the results.

1. **lint**: `node tools/scope/loop.mjs lint`. This covers the scope ledger,
   the exact workflow budget, immutable release checksums, cartridge hashes and
   the 480 kB ceiling.
2. **state-parity**: `node tools/scope/loop.mjs state --stdout` must match
   `STATE.md` byte for byte.
3. **generations**: this runs for every generation the PR touches, and for the
   generation that `atlas/current.json` points to.
   - A generation counts as touched when a changed path under `atlas/`
     (excluding `atlas/releases/`) or under `tools/proofs/` carries its
     12-digit stamp, either as a path segment or as a filename prefix.
   - If `atlas/v/<gen>/current.json` exists, every cartridge it orders must
     exist and match its declared SHA-256. This is checked against the served
     LF bytes, the same rule `lib.mjs` uses.
   - Every `tools/proofs/<gen>-*.proof.mjs` is run in its own process.
   - A **new** pinned generation without a proof fails. So does the live
     generation without one. A historical generation that never had a proof
     only gets a note.
4. **run-current**: `node tools/proofs/run-current.mjs`.
5. **verify-compose**: `node tools/scope/verify-compose.mjs`.
6. **loader-identity**: every `atlas/v/<gen>/index.html` must be
   byte-identical to `atlas/index.html`. A pinned route with a `current.json`
   but no `index.html` also fails. If you change the loader, you must update
   every pinned copy in the same PR.
7. **lightning-suites**: `node --test tools/ci/lightning/*.test.mjs` runs
   against three sets of overlay modules:
   - the live overlay module, `atlas/modules/<live sld-sandbox gen>-uk-lightning-overlay.js`;
   - every overlay module the PR adds or edits;
   - the overlay module of every pinned generation the PR adds.

   The suite is vendored from the hardening lane's `chatgpt-latest.test.mjs`.
   That file is a superset of `chatgpt-lightning-regression.test.mjs`. Neither
   suite was in the repository before this gate. It has 8 tests, uses Node
   built-ins and runs the module in `node:vm` with a stub map and stub XHR.
   It was written to fail on the first candidates, so it is RED on
   `202610261949` and `202610262323`. That is why the gate does not run it
   against every touched generation.

## Running it locally

```
git fetch origin main
node tools/ci/pr-gate.mjs                 # diffs the working tree against origin/main
node tools/ci/pr-gate.mjs --base <sha>    # or against any commit
```

The gate diffs the working tree, so uncommitted edits count as touched. The
exit code is 0 only when every check passes.

## Not in the gate, and why

- **Browser proofs** (`*.browser.mjs`, layer clicks, mobile hit-testing) live
  in `202608312212-cartridge-proof.yml`. That workflow needs Chromium, the
  `grid-distance-maths` checkout and the `pipelinenews` checkout. It is
  currently **disabled** in the repository settings.
- **`202609012214-data-contract-parity.proof.mjs`** has 3 known failures that
  predate this gate. Adding it now would make every PR red.
- **`tools/rollback.mjs --dry-run`** checks rollback readiness, not the PR's
  content.

## Workflow budget

`tools/scope/lib.mjs` `ACTIVE_WORKFLOWS` fixes the exact set of workflow files
at nine, and `STATE.md` records that count. The gate was added as a second job
in the one entry that is still enabled, so the budget, `STATE.md` and the
ledger are unchanged. The decision is written down beside that entry in
`lib.mjs`.

## Proof that the gate works

- A draft PR containing this gate ran green.
- A throwaway PR flipped one byte in
  `atlas/cartridges/202610281950-sld-sandbox-v9-8.js` and ran red on
  `composition 202610281950` (SHA-256 mismatch) and on
  `proof 202610281950-sld-sandbox.proof.mjs`. That PR was then closed unmerged.
