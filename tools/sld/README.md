# Rebuilding the accepted MAP receiver

`build.mjs` restores source reproducibility for the accepted V9.190 and
V9.191 SLD cartridges. It reads only three source inputs: the SHA256-pinned
immutable `202609241334` SLD baseline, thirteen explicit before/after source
edits in `src/map-receiver-edits.json`, and the pinned Ventus-owned browser
observer module. It prepends the attribution header and observer to the
edited baseline. Each edit must match exactly once; both input hashes and
the registered output hash must match. The expected final cartridge is
never a build input.

```sh
node --test tools/sld/build.test.mjs
node tools/sld/build.mjs --gen 202611161720 --out NEW_OUTPUT_FILE
node tools/twin/replicate-generation.mjs --generation 202611161720 --offline
```

The twin copies only this builder, its source registry and its declared
inputs into an empty temporary tree, rebuilds there, then compares output
with the committed cartridge byte-for-byte and with the composition hash.
The tests prove this without either expected output present in the source
tree, and reject changed source bytes, omitted edits and unknown generations.
This adds a builder; it does not waive the unknown-builder guard or alter any
accepted cartridge, preview, manifest, generation or production pointer.

The V9.191 immutable-copy proof also needs commit
`76653e40cf883e39497a0859d2532eb8b05930b1`. Shallow CI fetches that exact
anchor explicitly, alongside its existing base fetch. It does not substitute
HEAD for the anchor or skip the proof. The browser/rehearsal job asserts that
its checkout is shallow before fetching the anchor.

`node tools/release/map-promotion-rehearsal.mjs` now runs the complete
`tools/ci/pr-gate.mjs` against the actual locally promoted V9.191 composition
before route-C rollback. This closes the earlier gap where the preview PR
gate tested the predecessor pointer, while the seven release-script gates
did not include the offline twin. Local Windows and shallow Linux run the
same rehearsal. The generated release and rollback commits stay local;
only the integrator may publish a pointer release.
