---
schema: "gridatlas.scope-of-works.v1"
generation: "202608301518"
status: "done"
scope: 2
parent: "202608301321-01-move-atlas-into-atlas-folder.md"
next: "202608301520-03-apply-pipelinenews-lessons.md"
---
# Scope 2 — modularise the Atlas shell and cartridges

Do only this scope.

## Changes

- Replace the temporary Atlas redirect with the stable SHA-verifying composer in `atlas/index.html`.
- Keep `202608300453-atlas-v9` byte-identical as the immutable shell.
- Define ordered cartridges in `atlas/current.json`; an empty order must reproduce the shell.
- Remove obsolete working copies under `ui/successor*`, `ui/v8-mirror`, root `assets/`, and root `cartridges/`. Git history and immutable releases preserve provenance.

## Prohibited

- No search or geocoder changes.
- No ninth full application release.
- No edits inside `atlas/releases/202608300453-atlas-v9/`.

## Acceptance

- `atlas/current.json` declares `IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES`.
- `atlas/index.html` SHA-verifies every cartridge before composition.
- The immutable shell checksums still pass.
- On green, write the timestamped Scope 3 file.
