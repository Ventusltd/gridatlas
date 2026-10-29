# The lightning overlay as its own cartridge

Status: **design and tooling, 29 Oct 2026.** No generation in this repository
uses it yet. This PR adds no generation and does not change the pointer. A
prototype generation was cut, gated, released and rolled back in a local
worktree only (see "Prototype" below).

## Why

Since 202610261949, every lightning generation has shipped as **one**
`sld-sandbox` cartridge:

    the original 202609241334 sld-sandbox (435,218 B) + "\n" + atlas/modules/<G>-uk-lightning-overlay.js

That made the 460 kB per-cartridge ceiling too small. It was raised to 480 kB
on 27 Oct and to 500 kB on 28 Oct. Every lightning generation also re-commits
the unchanged 435 kB base: L3 to M4b come to about 480–493 kB each.

The overlay never needed to share a file with `sld-sandbox`. Splitting it out
gives:

- `sld-sandbox` back at the original 435,218 bytes (sha256 `78129536…a4ca`);
- the overlay in its own cartridge, with its own budget;
- the 460 kB ceiling restorable, because every cartridge of a modular
  composition is then 452 kB or less;
- about 58 kB of new bytes per lightning generation instead of about 490 kB;
- isolation: a parse error or top-level throw in either file no longer stops
  the other.

## The composition

A modular generation has five cartridges. The new one is last in
`cartridge_order`, directly after `sld-sandbox`:

```json
{
 "id": "uk-lightning-overlay",
 "generation": "<G>",
 "type": "script",
 "slot": "after-cartridge",
 "after": "sld-sandbox",
 "path": "./modules/<M>-uk-lightning-overlay.js",
 "sha256": "<sha256 of that module>",
 "bytes": 57562,
 "byte_budget": 64781,
 "module_generation": "<M>",
 "parity_reference": "<M>"
}
```

- **The cartridge is the module file itself.** No copy is made. The module is
  already immutable and stamped, and the loader needs only a path and a
  SHA-256.
- **`sld-sandbox` is the original manifest entry.** The `202609241334` record
  is used verbatim: same path, same sha256, same generation.
- **`generation` is G**, the cut that composed the overlay. That is how
  `run-current` and `release-generation` find `tools/proofs/<G>-uk-lightning-overlay.proof.mjs`.
- **`module_generation` is M**, the build that wrote the bytes. It is the
  stamp inside the module (`NS.ukLightning.generation`), and the PR gate's
  lightning suites run on that module.

## Loader: v2 beside v1, never rewritten

All four shell script tags with a `src` other than the MapLibre CDN are
already claimed by `replace-script` cartridges:

| shell script | claimed by |
| --- | --- |
| `202608292311-maplibre-worker-bridge.js` | `streaming-parquet-bridge` |
| `202608291818-place-postcode-search.js` | `uk-gazetteer-flyto` |
| `ventus-corev8engine.js` | `substation-intelligence` |
| `202608292126-pre-snapped-config-adapter.js` | `sld-sandbox` |

So a separate cartridge needs one new slot type in the composer.

**Loader v2** (`tools/scope/payloads/atlas-loader-v2.html`) is loader v1 (the
current `atlas/index.html`, also in `tools/scope/payloads/atlas-loader.html`)
plus `after-cartridge`. It does the following:

- It fetches the cartridge and verifies its SHA-256 exactly as v1 does for a
  `replace-script` cartridge.
- It inserts `<script data-gridatlas-cartridge="<id>" src="blob:…">` on its own
  line, directly after the tag of the `after` cartridge. If another
  `after-cartridge` entry is already chained to that cartridge, it goes after
  the last one.
- It refuses, with the usual failure screen and nothing written:
  - an anchor that is not composed earlier in `cartridge_order`;
  - an anchor tag that is not found exactly once;
  - an unknown slot;
  - a hash mismatch;
  - a missing file.
- For `replace-script` cartridges, its code path and output are v1's.

Both loaders are registered in `tools/scope/lib.mjs` (`ATLAS_LOADERS`, with
the slots each supports). **No existing loader file changes:**

- `atlas/index.html` and all 42 existing `atlas/v/<gen>/index.html` files stay
  v1, byte-identical.
- A modular generation is cut with `atlas/v/<G>/index.html` = v2. Its preview
  route works on its own, because it reads `./current.json`.
- `atlas/index.html` becomes v2 only in the release commit of a v2
  generation. It goes back to v1 byte-exact when that commit is reverted, or
  when a later v1 generation is released. **The live loader is always the
  loader of the live generation's preview.**

`tools/proofs/loader-equivalence.proof.mjs` runs both loaders' own module
scripts verbatim in `node:vm`, through `tools/proofs/loader-composition.mjs`.
Only `fetch` (which reads the working tree), WebCrypto and blob URLs are
stubbed. It proves:

1. **Every served loader is registered.** That covers `atlas/index.html` and
   every `atlas/v/*/index.html`, and each one supports the slots its own
   `current.json` uses.
2. **Equivalence:** for the live composition and every pinned
   `replace-script`-only composition (42 today), v2 writes byte-for-byte the
   HTML v1 writes, with byte-identical blobs. Moving the live loader to v2
   therefore changes nothing for any of them, including any rollback target.
3. **v1 refuses a modular composition**, failing closed with nothing written.
   **v2 refuses** each of five malformed `after-cartridge` entries.
4. **Order:** two `after-cartridge` entries on one anchor execute in
   `cartridge_order`, directly after the anchor.

## Load order and the dependency on sld-sandbox

The overlay tag is inserted directly after the `sld-sandbox` tag. The
document therefore runs the same scripts in the same order as a monolithic
generation:

    shell scripts …, streaming-parquet-bridge, uk-gazetteer-flyto, substation-intelligence, sld-sandbox, uk-lightning-overlay, shell inline scripts …

**What the overlay reads at runtime.** Every one of these is polled for, never
assumed (a `MutationObserver` plus a 250 ms interval; `install()` returns
false until all are present):

- `__GRIDATLAS_MODULES__.menuBar.installed` and
  `__GRIDATLAS_PIPELINE_LAYERS__.installed`, from `substation-intelligence`;
- the MapLibre map;
- `#scada-ui-container .key-group` and `#fs-curtain-keys`, from the shell and
  engine.

On a tap it reads and ticks the REPD layer checkboxes,
`input[data-layer-id]`, through the engine's own change path. It writes only
`__GRIDATLAS_MODULES__.ukLightning`.

**It reads no `sld-sandbox` global.** The original `sld-sandbox` bytes do not
know the overlay exists, and the overlay reaches nothing `sld-sandbox`
defines. The order "after sld-sandbox" is kept for parity, not because of a
data dependency. Even so, the anchor is enforced by v2, lint and
`verify-compose`.

**What changes at a script boundary, and why none of it matters here:**

- **Strictness and globals.** Both files are one strict IIFE. The proof
  checks that the module's top level parses as a single expression, so the
  module declares no global binding and cannot collide with `sld-sandbox`'s.
- **Microtask checkpoint.** A microtask checkpoint now runs between the end
  of `sld-sandbox` and the start of the overlay. The overlay's top level never
  calls `install()` synchronously. It only registers the observer and the
  interval, and publishes `NS.ukLightning`, which nothing in `sld-sandbox`
  reads. Installation waits for the map, which cannot exist during
  synchronous script execution. Install timing is unchanged, to within one
  poll.
- **Error isolation.** This is the one behavioural difference, and it is
  intended, on failure paths only:
  - in M4, a top-level throw in `sld-sandbox` (for example, its
    `NS.geodesy` guard) also stopped the overlay, and a syntax error in the
    overlay stopped the whole `sld-sandbox` cartridge;
  - now each file fails alone.
- **`window.__GRIDATLAS_ATLAS__`** gains one entry in `cartridge_order` and
  in `loaded_cartridges`. The only reader in the estate,
  `substation-intelligence`'s print stamp, reads `.generation` only.
- **`document.currentScript`** is used by neither file.

## Arrival parity

Deep-link arrival lives entirely in `sld-sandbox`. The per-generation proof,
`tools/proofs/lightning-cartridge.mjs`, composes the modular generation G
with its own loader (v2) and the monolithic reference M with its own
loader (v1), both in `node:vm`, and asserts:

- the same scripts in the same order, plus the overlay directly after
  `sld-sandbox`;
- every other cartridge byte-identical;
- `sld-sandbox(M) == sld-sandbox(G) + "\n" + overlay(G)`, byte for byte;
- the composed HTML identical, every blob URL included, once the one inserted
  overlay tag and the published state script (`__GRIDATLAS_ATLAS__`, which
  names the generation) are removed.

So the arrival code is byte-identical, sits at the same place in the
document, and is followed by the same overlay bytes. In the rehearsed release
(below), `arrival-visibility-and-one-runtime.proof.mjs` passes 16 of 16
against the composed bytes of the modular generation. `run-current` runs the
original `202609241334-sld-sandbox` proof and passes.

**Not covered here.** The browser and phone arrival grid
(`local-arrival-grid.mjs`, Playwright) was not run, because this lane is
node-only. It should be run on the preview route before a release, as for any
generation.

## Proofs and budgets

- **`tools/proofs/<G>-uk-lightning-overlay.proof.mjs`.** A two-line file that
  calls `tools/proofs/lightning-cartridge.mjs` with G. It checks:
  - identity, order, slot, anchor and hashes;
  - `sld-sandbox` is the original 435,218-byte file, with nothing of the
    overlay in it;
  - the overlay is the module file, within 64,781 B, names generation M,
    parses, and is one strict IIFE;
  - the route's loader is registered and supports the slots;
  - arrival parity with M, as above.
- **`loop.mjs lint`** adds, for the live composition:
  - per-cartridge budgets (`CARTRIDGE_BYTE_BUDGETS`, with
    `uk-lightning-overlay` at 64,781 B; that is the owner's 500 kB decision
    of 28 Oct, minus the 435,218 B base, minus the joining newline, and is
    the module budget every `<G>-sld-sandbox` proof already enforces);
  - slot validation;
  - a check that `atlas/index.html` is a registered loader that supports
    the live slots.
- **`verify-compose`** is slot-aware. An `after-cartridge` entry needs an
  anchor composed before it. A `replace-script` slot may be claimed only once.
- **The 460 kB ceiling.** It cannot return while L3 (479,919 B) is live. Lint
  at 460 kB fails on today's main. In the rehearsed modular release, lint
  passes at 460 kB: the largest cartridge is `substation-intelligence` at
  451,935 B. Lowering it is one owner-approved commit after a modular release
  (`tools/scope/loop.mjs`, the single `size <= 500_000`). From then on the
  overlay grows only against its own 64,781 B budget.

## CI gate (`tools/ci/pr-gate.mjs`)

- **`loader-identity` is replaced by `loader-registry`:**
  - every served loader must be registered and must support its own
    composition;
  - a pinned `index.html` that exists at the base may not change;
  - `atlas/index.html` may change only together with `atlas/current.json`,
    and only to `atlas/v/<live gen>/index.html`.
- **New `loader-equivalence` step:** the proof above, run on every PR in
  about 1 s.
- **Lightning suites** resolve the overlay module through the
  `uk-lightning-overlay` cartridge when there is one. Otherwise they use the
  `sld-sandbox` generation, as before. A new pinned modular generation
  therefore runs the suites on its module, and so does a modular live
  generation.

The gate was tested with 8 mutants on the prototype, and each one was caught:

- an existing `index.html` rewritten;
- a modular route served by v1;
- the live loader changed without the pointer;
- an unregistered loader;
- the overlay ordered before `sld-sandbox`;
- an overlay hash changed by one digit;
- `sld-sandbox` pointing at the monolithic M4 file;
- the v2 payload edited after a cut.

## Release and rollback

**Cutting.**

```
node tools/release/split-lightning-cartridge.mjs --from <M> --generation <G> --version <vX>
```

- This writes only G's preview files:
  - the manifest;
  - `atlas/v/<G>/current.json`, derived and re-rooted by
    `tools/release/lib.mjs`;
  - `atlas/v/<G>/index.html` (v2);
  - the proof stub.
- It refuses:
  - if M's `sld-sandbox` is not exactly original + `"\n"` + M's module;
  - if the module is over budget;
  - if G already exists.
- `--check` writes nothing. It passes today for L3 (202610281340), M4
  (202610290045) and M4b (202610290050), and will work for M5 if M5 keeps the
  same shape.

**Releasing.** Use `tools/release/release-generation.mjs`, unchanged in use:

- Its loader precondition is now either of:
  - `LOADER_IDENTICAL`: as before;
  - `LOADER_FOLLOWS`: G's own loader is a different registered loader that
    supports G's slots. The release commit then writes `atlas/current.json`,
    `STATE.md` **and** `atlas/index.html := atlas/v/<G>/index.html`, and
    nothing else.
- Lint, `verify-compose` and `loader-registry` refuse a live pointer whose
  slots the live loader cannot compose. A pointer-only release of a modular
  generation behind a v1 loader therefore cannot pass.

**Rolling back.**

- **Route C** (`tools/release/rollback-generation.mjs --release-commit <sha>`)
  accepts a release commit of exactly those two or three files. It reverts
  it and proves each file is restored byte-exact, so the live loader returns
  to v1 bytes.
- **Route B** (`tools/rollback.mjs`) leaves `atlas/index.html` alone:
  - from a modular live onto an older composition, v2 composes it
    byte-identically (equivalence);
  - onto a modular composition behind a v1 loader, lint refuses.

**Cache window. This is a risk the owner must weigh.**

- The live loader and the pointer change in one deploy. GitHub Pages serves
  HTML with a short `max-age`, documented as 10 minutes; it could not be
  measured from this sandbox because the proxy refused the request. `current.json`
  is fetched `no-store`.
- So for up to about 10 minutes after the release deploys, a browser that
  cached the v1 `atlas/index.html` can read the modular `current.json`. v1
  then fails closed with "GRIDATLAS COMPOSITION FAILED … unsupported cartridge
  slot". The shell is untouched, and a reload after the cache expires fixes
  it.
- The alternative removes the window but breaks the "existing loader stays
  byte-identical" rule:
  1. ship `atlas/index.html := v2` on its own first. It is proven
     composition-identical for the live L3.
  2. wait out the cache;
  3. release the pointer.
- That needs the `loader-registry` rule relaxed to "`atlas/index.html` may
  change to any registered loader that composes the live pointer". Since
  29 Oct 2026 it is (`tools/release/loader-swap.mjs`; docs/RELEASE.md "Loader
  first, then the pointer"): the combined lightning M6 + offtakers generation
  is released in those two steps.

## Prototype (evidence, not in this PR)

- **Lane and inputs.** Lane CD-modular, worktree
  `hardening/evidence/CD-modular/wt`, base `origin/main` 73c0e76.
- **The cut.** Generation **202610290235** (`v9.176m`) was split from M4
  202610290045:
  - `sld-sandbox` = `./cartridges/202609241334-sld-sandbox-v9-8.js`
    (435,218 B, `7812953671d8…a4ca`);
  - overlay = `./modules/202610290045-uk-lightning-overlay.js`
    (57,562 B, `c4add7de488a…6d6a`).
- **PR gate** on the prototype branch: 15/15 passed (`node tools/ci/pr-gate.mjs
  --base origin/main`). That covers:
  - lint, state parity, the L3 and G compositions and proofs, run-current,
    verify-compose;
  - `loader-registry` (43 loaders: v1 42, v2 1) and `loader-equivalence`
    (42/42 identical);
  - lightning suites on module 202610290045: engine 191 pass, 0 fail,
    10 skipped; latest 8/8.
- **Release rehearsal** (local branch, never pushed):
  - `LOADER_FOLLOWS`, and every release gate passed: lint, state,
    `verify-compose` (G), run-current (including the original
    `202609241334-sld-sandbox` proof), G's proof, data-contract parity (3 FAIL
    rows, 0 new) and `rollback.mjs --dry-run`;
  - the release commit touched `STATE.md`, `atlas/current.json` and
    `atlas/index.html` only;
  - on the promoted tree, the PR gate passed 12/12, with the live overlay
    resolved through the cartridge;
  - lint passed at a 460 kB ceiling;
  - the arrival proof passed 16/16.
- **Rollback rehearsal** (route C): `atlas/current.json`, `atlas/index.html`
  and `STATE.md` were all restored byte-exact (`e3eca669…`, `e1e403f6…`,
  `58676566…`), and every gate passed.

## Not done here

- **No generation is added, and the pointer is unchanged.** Publishing a
  modular preview of M4, M4b or M5 is one `split-lightning-cartridge.mjs` run
  plus a normal preview PR.
- **No browser or device verification** of the modular preview, because this
  lane is node-only.
- **The 460 kB ceiling is not lowered.** It can be lowered only after a
  modular release.
