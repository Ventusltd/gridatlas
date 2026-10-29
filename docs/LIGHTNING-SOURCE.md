# Lightning overlay: source, build and generations

The UK lightning overlay ships as `atlas/modules/<GEN>-uk-lightning-overlay.js`, appended to the sld-sandbox
cartridge. Until 29 Oct 2026 the repository held only those built bytes. The readable source and the scripts that
produced each generation lived in one session's scratchpad (reports/V-maintain.md, finding 1). They are now here,
and the PR gate proves that the shipped bytes are built from them.

| path | what it is |
|---|---|
| `tools/lightning/src/*.js` | the readable source: 17 files, concatenated in name order (M5 added `11b-repd-records.js`: the full REPD record of a listed project and its reusable export `window.__GRIDATLAS_MODULES__.repdRecords`) |
| `tools/lightning/build.mjs` | source → module bytes; `--check` is the CI check |
| `tools/lightning/generations.json` | the variants, and the generations the current source rebuilds |
| `tools/lightning/make-generation.mjs` | the scaffolder: cuts a new candidate generation from the source |
| `tools/lightning/lineage/` | the build scripts that made M, M2, M3, M4 and M4b, and how `src/` was reconstructed |

Everything uses Node built-ins only. Nothing is installed.

## The source format

`build.mjs` is a fixed text transform, not a minifier. The module is the source with its source-only layer removed:

1. The files `src/*.js` are concatenated in file-name order. Each file must end with a newline, and no file may
   contain a CR.
2. **Variant blocks.** `///#if <variant>[,<variant>…]`, an optional `///#else` and `///#endif` are whole lines, and
   blocks are not nested. A block keeps the lines of the branch that names the variant being built.
3. **Source comments.** A line whose first non-blank characters are `///` is dropped. Comments of this kind cost no
   bytes.
4. **Continuations.** A line that ends in `///` continues on the next line: the `///`, the line break and the next
   line's leading blanks are removed. This lets a golfed line be laid out with one statement or binding per line and
   still ship byte for byte.
5. Every `@@GEN@@` becomes the generation stamp. It appears twice: in the header comment and in `GEN='…'`.

Nothing else changes. Ordinary `//` and `/* */` comments ship as they are, and they count against the module budget.
For explanations, use `///`.

**Variants.**
- `layers` is M5 (202610290246; M4 202610290045 before it). The listed technologies' own REPD layers are switched on through their Layers
  checkboxes.
- `dots` is M5b (202610290247; M4b 202610290050 before it), the owner option. Only the listed sites are drawn, as REPD-styled dots, and no
  Layers control is touched.

Both build from the same files. They differ in 21 `///#if dots` blocks. The largest is the whole of
`11-repd-map.js`, where the dots block replaces the layer bookkeeping. The others are short and sit in `00-header.js`,
`08-map.js`, `09-card.js`, `10-neon.js`, `12-repd.js` and `14-actions.js`.

**Budget.** The module must be at most 64,781 B, and base + "\n" + module at most 500,000 B. The cartridge base is
the original 202609241334 sld-sandbox, 435,218 B. The scaffolder refuses to go over either limit, and so does the
generation proof. M4 is 57,562 B and M4b is 57,867 B.

## Changing the source and cutting a generation

Work in a fresh worktree of main on a `claude/…` branch, never in a shared clone.

```bash
# 1. edit tools/lightning/src/*.js; build a trial module (anything not yet a generation needs --variant)
node tools/lightning/build.mjs --gen 209912312359 --variant dots --out /tmp/trial.js

# 2. run the vendored suites on it (the gate runs the same ones)
LIGHTNING_MODULE=/tmp/trial.js LIGHTNING_TEST_GEN=209912312359 node --test tools/ci/lightning/*.test.mjs

# 3. cut the generation: dry run first, then for real
node tools/lightning/make-generation.mjs --gen <YYYYMMDDHHMM> --version v9.<N> --variant dots \
     --label M5b --scope "M5b (<gen>): <what this generation changes>" --dry-run
node tools/lightning/make-generation.mjs --gen <YYYYMMDDHHMM> --version v9.<N> --variant dots \
     --label M5b --scope "M5b (<gen>): <what this generation changes>"
```

Use the UTC minute of the cut as `--gen`. `--version` must be unused and higher than every recorded version, and the
scaffolder checks this.

**What the scaffolder writes.** It writes the six generation files and never overwrites one:
- the module, built from `src/` for `--variant` and stamped;
- the cartridge (base + "\n" + module);
- the proof;
- the manifest;
- `atlas/v/<gen>/index.html` and `atlas/v/<gen>/current.json`.

**Template and predecessor.**
- The proof, manifest and route `current.json` are copied from `--template`. By default that is the newest listed
  generation of the same variant. In the copies, only the identity, hashes, sizes, lineage and cut time change.
  `acceptance.scope` gains the `--scope` text.
- `candidate_predecessor` is `--predecessor`. By default that is the newest lightning module.
- If the change alters behaviour that the template's prose describes (`composition_note`, `uk_lightning.*`), edit
  those strings by hand in the new manifest **and** the new route `current.json`, in the same commit.

**`generations.json`.** The scaffolder adds the new generation and drops every listed generation that the edited
source no longer rebuilds. A dropped generation's source is the commit that cut it.

**What it leaves alone.** It moves no pointer and changes no live, template or predecessor file. It hashes them
before and after. Releasing is a separate, owner-approved step (`docs/RELEASE.md`).

4. Before you hand over (AGENTS.md):
   - `node tools/scope/loop.mjs lint`;
   - `node tools/scope/loop.mjs state --stdout | diff - STATE.md`;
   - `node tools/proofs/<gen>-sld-sandbox.proof.mjs`;
   - `node tools/ci/pr-gate.mjs`.
5. Open a PR. Commit the source edit, `generations.json` and the six generation files together.

A source edit without a new generation fails the gate, because the listed generations no longer rebuild. So does a
module made any other way, such as a hand edit or a string-replacement script. Port the change into `src/` and cut it
with the scaffolder.

To add a variant, add its name to `generations.json` `variants` and give it `///#if` blocks. A name unknown to
`generations.json` is refused in a directive.

## How CI verifies it

`tools/ci/pr-gate.mjs` runs the **lightning-source** step on every PR, after loader-identity:

```bash
node tools/lightning/build.mjs --check
```

The check passes only when both of these hold:
- the newest `atlas/modules/*-uk-lightning-overlay.js` (highest stamp) is listed in `generations.json`;
- every listed generation, built from `src/` with its variant, equals the committed module byte for byte. The
  comparison is on raw bytes, and the module is LF-only.

When it fails, the message gives:
- the first differing byte and module line, with both sizes and hashes;
- the `file:line` of a malformed directive;
- or the unlisted newest generation.

The check takes well under a second. The rest of the gate (the proofs, compositions and suites of the new
generation) applies as before; see `docs/CI.md`.

## Lineage, and how `src/` was made

Each generation from L3 onwards was made by an exact-once string-replacement script run on the previous generation's
bytes. The scaffolder then restamped the generation. `tools/lightning/lineage/` keeps those scripts.

| step | script | result |
|---|---|---|
| L3 202610281340 → M 202610281950 | `build-M.mjs` (stage A: header 4 → 1 line, `//` lines out, aliases, `const2let.mjs`; stage B: the REPD list) | a6501fd0… |
| M → M2 202610282100 | `build-M2.mjs` + `repd-m2.part.js` | a9164e89… |
| M2 → M3 202610282215 | `build-M3.mjs` + `layers-m3.part.js` + `repd-m3.part.js` | 62770e61… |
| M3 → M4 202610290045 | `build-M4.mjs` + `fixes-m4.mjs` | c4add7de… |
| M4 → M4b 202610290050 | `build-M4b.mjs` | 9ade266c… |

`node tools/lightning/lineage/verify-lineage.mjs` replays the chain on the committed modules and confirms that each
step reproduces the next generation exactly. `build-M` needs acorn for `const2let`; the replay skips that step unless
`lineage/deps/node_modules/acorn` exists. `make-generation-M4.mjs` is the scaffolder those builds used.

`src/` was reconstructed on 29 Oct 2026 by `lineage/reconstruct.mjs`, using the comments in `lineage/annotations.mjs`:
- The layout comes from the M4 and M4b bytes.
- The `///` comments restore the L3 header and the `//` comments that build-M stage A removed, the K-generation
  section comments, and the reason for each change as given in the build scripts and lane reports (LR-*, MR, M2R-*).
- The `///#if dots` blocks come from a token-level diff of M4 against M4b.

It proved that `build.mjs` rebuilds both modules byte for byte, which is the CI check above. The reconstruction is a
one-off. From now on, `src/` is edited directly.
