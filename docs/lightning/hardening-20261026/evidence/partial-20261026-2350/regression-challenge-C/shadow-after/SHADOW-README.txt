shadow-after/ is a harness artefact built by regression-challenge-C, NOT a candidate file.
- atlas/* are symlinks into the READ-ONLY candidate worktree wt/atlas (byte-identical cartridges, modules, releases, manifests).
- atlas/index.html is a byte copy of wt/atlas/index.html (sha256 e1e403f6... identical to atlas/index.html on main).
- atlas/current.json is wt/atlas/v/202610262323/current.json with every "../../" path prefix rewritten to "./" so the candidate
  composition is served at /atlas/ by the self-serving proofs and read by the static proofs (which take atlas/current.json
  as the composition under test). The two `contract` fields (bridge, gazetteer) are set to the manifest's "../ui/..." value,
  because the candidate current.json carries "../../ui/..." which resolves to the non-existent atlas/ui/ (finding, cosmetic).
- tools/ is a plain copy of wt/tools (proofs locate the repo root from their own path). node_modules/ links the global Playwright 1.63.0.
- work/ is this shadow's own scratch dir, so nothing is written into the shared clone or worktree.
shadow-baseline/ is the same construction over /home/claude/gridatlas (main c08f3a6) with its real atlas/current.json copied unchanged.
