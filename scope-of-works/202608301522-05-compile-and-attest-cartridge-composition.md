---
schema: "gridatlas.scope-of-works.v1"
generation: "202608301522"
status: "active"
scope: 5
parent: "202608301521-04-add-uk-location-search-cartridge.md"
next: null
---
# Scope 5 — compile and attest the cartridge composition

Do only this scope.

## Changes

- Create one timestamped composition manifest from the immutable shell and ordered cartridge hashes.
- Update `atlas/current.json`, `atlas/state/live-set.json`, and the existing repository live pointers.
- Run the structural composition verifier.

## Prohibited

- No new `*-atlas-v9` application directory.
- No immutable shell mutation.

## Acceptance

- The manifest names the shell, every cartridge, every SHA-256 and the explicit order.
- Root, shell and cartridge paths verify.
- The next generation is represented by the Atlas pointer/manifest, not a copied application.
- On green, write the timestamped Scope 6 file.
