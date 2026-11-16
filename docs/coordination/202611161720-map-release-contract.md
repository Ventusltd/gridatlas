# MAP release contract repair

Public preview `202611161645` / V9.190 remains byte-for-byte unchanged.
Its preflight and browser tests passed, but actual promotion correctly failed
two guards: `verify-compose` requires a zero-full-copy attestation and
`rollback.mjs` walks `parent_generation`, not `previous_generation`.
Preflight alone was insufficient release evidence.

The additive successor is `202611161720` / V9.191. The accepted SLD cartridge
is copied byte-for-byte to a new versioned cartridge path because the formal
release tool requires a cartridge cut at the successor generation. Its size
is 452309 bytes and its SHA256 remains
`b1daa991ca738027a34c465e84d48355cf5d0902e76e7db5b318b6342c55df6d`.
The engine bundle, immutable shell and other five cartridges are unchanged.
The new manifest records version, cut time, exact live parent `202611132345`,
the structural acceptance facts and their proof. These facts do not record
human release acceptance; agents do not manufacture that decision.

The proof establishes zero full-application copies by checking the immutable
`atlas/releases` Git tree against accepted main `76653e40`, absence of
top-level release-copy directories, and byte identity of the successor's
only HTML file with the registered loader. It also checks the actual parent
field consumed by rollback, all other predecessor fields, preview derivation,
and exact application bytes against V9.190.

Run from a clean committed candidate:

```powershell
node tools/proofs/202611161720-sld-sandbox.proof.mjs
node tools/release/map-promotion-rehearsal.mjs
$env:MAP_RECEIVER_GENERATION='202611161720'
$env:BROWSER_CHANNEL='chrome'
node tools/proofs/map-receiver-restoration.browser.mjs
```

The rehearsal creates a separate local checkout and local-only branches.
It invokes the real release script for V9.190, asserts precisely the two
known failures and restored staging state, invokes the real release script
for V9.191, then reverts its actual two-file release commit through the real
route-C rollback script. Every release and rollback gate must pass; pointer
and STATE must return byte-for-byte to the predecessor. The calling checkout
must remain unchanged. Existing Linux CI runs this same script and the real
MAP browser matrix. A path-free summary is retained in
`work/map-promotion-rehearsal.json`; full reports remain in the isolated tree.

For a production release, the integrator must first accept and merge this
preview, fetch main into a clean release worktree, and create `work/` before
passing `--report work/...` or `--log work/...` to the formal release tool.
Use generation `202611161720`, expected live `202611132345`, and the actual
owner authorization reference. The formal tool must pass every gate and
make only the pointer/STATE commit. Follow `docs/RELEASE.md` for the release
PR, rebase merge and byte readback. After promotion, set
`MAP_RECEIVER_PUBLIC=1` and `MAP_RECEIVER_GENERATION=202611161720` for the
unintercepted Chrome MAP proof. Route-C rollback uses the actual release
commit SHA and restores `202611132345`. No production mutation is made by
this repair or its rehearsal.
