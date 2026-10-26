# atlas/cartridges

Every cut of a cartridge is written here as a new timestamped file next to the
previous one, and the old file is never rewritten. That is by design: the
composer verifies each cartridge by SHA-256, `atlas/releases/` is immutable,
and `tools/rollback.mjs` restores a past generation by checking the committed
bytes of the cartridges that generation named.

The cost is that the directory only grows. On 2026-09-29 it held 141 files and
43 MB, of which seventy were successive copies of `sld-sandbox-v9-8.js` at
about 17,000 lines each.

## Why old copies are not simply deleted

`node tools/cartridges/audit.mjs` classifies every file by what still points
at it. On 2026-09-29:

| Class | Files | MB | Meaning |
|---|---:|---:|---|
| LIVE | 5 | 1.3 | named in `atlas/current.json`; served at the live route |
| VERSIONED | 32 | 9.5 | named in `atlas/v/<generation>/current.json`; a published route |
| TOOLING | 25 | 7.0 | named by a proof, a CI script, `.gitattributes` or a workflow |
| ROLLBACK | 79 | 25.3 | named only by `atlas/manifests/<generation>-composition.json` |
| ORPHAN | 0 | 0 | named by nothing |

There were no orphans. The 79 ROLLBACK files exist solely so that
`tools/rollback.mjs --to <generation>` can restore that generation; the tool
hashes the committed bytes and refuses to move the live pointer if any
cartridge is absent or changed. Removing a ROLLBACK file therefore makes one
generation unrestorable, which is a product decision, not housekeeping.

## How to retire old generations safely

1. Decide a retention window for rollback targets (for example: the last ten
   generations, or everything after the most recent release cut). Record the
   decision in `governance/`.
2. Run `node tools/cartridges/audit.mjs --rollback-only` and pick the files
   older than the window.
3. Move (do not edit) their `atlas/manifests/<generation>-composition.json`
   and `<generation>-*-parts.json` into `atlas/manifests/retired/` in the
   same commit, so `tools/rollback.mjs` reports "no composition manifest" for
   that generation rather than "absent cartridge".
4. `git rm` the cartridge files. Git history keeps the bytes; a retired
   generation can still be inspected with `git show <commit>:atlas/cartridges/<file>`.
5. Run `node tools/scope/loop.mjs lint`, `node tools/scope/verify-compose.mjs`
   and `node tools/proofs/run-current.mjs` before pushing.

Never remove a LIVE, VERSIONED or TOOLING file. Routes under `atlas/v/` are
published URLs; proofs and `.gitattributes` name specific bytes.

## Stopping the growth

The better fix is upstream of this directory: `tools/build-cartridge.mjs` and
`tools/recompose.mjs` could write the composed cartridge to a GitHub release
asset keyed by its SHA-256 and record only the digest and URL in the
composition manifest, with the composer fetching by digest. That keeps every
generation restorable without keeping every 17,000-line copy in the tree. It
is a change to the composition contract and is not made here.
