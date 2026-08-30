# CVAA applied to GridAtlas

Guide: https://github.com/Ventusltd/cvaa/blob/main/202608301321-gridatlas-amnesia-vaccine.txt

## Active antibodies

- One active numbered scope at a time.
- One deterministic scope per workflow run.
- Zero top-level full Atlas release directories.
- Exactly eight immutable historical releases under `atlas/releases/`.
- Zero future full application copies; changes are SHA-256 cartridges.
- One mutable application composition pointer: `atlas/current.json`.
- Two active workflows maximum; 21 expired workflows archived.
- The scope schedule retires when the six-scope chain closes.

The enforcement code is `tools/scope/loop.mjs`; CI runs it before and after every bounded change.
