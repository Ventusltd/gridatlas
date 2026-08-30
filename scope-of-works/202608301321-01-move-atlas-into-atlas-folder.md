---
schema: "gridatlas.scope-of-works.v1"
generation: "202608301321"
status: "active"
scope: 1
parent: "202608301321-scope-of-works.md"
next: null
---
# Scope 1 — move the Atlas into `atlas/`

Do only this scope.

## Changes

- Move the eight top-level `*-atlas-v9` directories to `atlas/releases/` without changing their contents.
- Move the shared content-addressed 400 kV cartridge to `atlas/releases/cartridges/` so the existing `../cartridges/...` runtime contract remains valid.
- Create `atlas/current.json` and a temporary `atlas/index.html` router.
- Change the root `index.html` to redirect to `./atlas/`, preserving query and hash.
- Update `releases/current-v5.json` and `state/live-set.json` to name the stable Atlas route and moved release route.

## Prohibited

- No search changes.
- No shell, CSS, engine, bridge, data, manifest, `atman/`, or `machine-learning/` edits.
- No new full application release.

## Acceptance

- There are zero top-level `*-atlas-v9` directories.
- `atlas/releases/` contains exactly the eight immutable baseline releases.
- `sha256sums.txt` still verifies for `202608300453-atlas-v9`.
- Root resolves through `/gridatlas/atlas/` to the same last-known-green application.
- On green, mark this file done and create the timestamped Scope 2 file.
