# QuantumSpawn recovery capsule — GridAtlas overnight loop

Generation `202609012305`. Written to Codex's contract
(`cvaa` vaccine `quantumspawn-recovery`, 202609012359 mirror): a repository
running an unattended version loop is not restartable unless it owns a
timestamped recovery capsule **and** an independent executable proof that
checks the capsule against current repository state.

This capsule is a **witness, never authority over current Git.** Read it,
then re-read Git and the deployed bytes, and reconcile every conflict in
favour of current evidence.

---

## 1. Wake sequence — read-only first

Do these in order. Change nothing until step 5.

1. `cat atlas/current.json | head -5` — the generation and version that
   are *pointed at*. The chain is `previous_generation`, never sort order.
2. `curl -s https://ventusltd.github.io/gridatlas/atlas/current.json` —
   the generation that is *actually served*. If it differs from (1), a cut
   was pushed and has not propagated, or a push failed.
3. `node -e "const j=require('./tools/overnight/shift-log.json'); for (const r of j.runs) console.log(r.step, r.version, r.outcome, r.reason||'')"`
   — every attempt, including the failures. **A failed run is not a
   version.** Only `outcome: "live"` counts.
4. `git log --oneline -15` and `git status --porcelain`.
5. Only now: `node tools/overnight/<stamp>-shift.mjs` for the next pending
   step, or author the next step.

## 2. What the loop is

`tools/overnight/202609012200-shift.mjs` takes one step from
`tools/overnight/steps/`, applies it to the working tree, runs the step's
own proofs, composes a new generation with `tools/recompose.mjs` (which
reads the stamp from the clock), runs every gate, commits, pushes to
`main`, and waits for the deployed bytes to match. Any red anywhere and
the working tree is put back and the reason written to the log.

A step is a module exporting
`{ id, version, scope, note, brings?, addModules?, replaceModules?, proofs?, postProofs?, apply({read,write,patch,sandboxProof}) }`.

Gates, all of which must pass. Each is written as a full path so the
recovery proof can check it still exists rather than trusting the prose:

- `tools/proofs/<generation>-sld-sandbox.proof.mjs` (renamed at every cut)
- `tools/proofs/run-current.mjs`
- `tools/proofs/202609012105-parts-integrity.proof.mjs`
- `tools/proofs/202609012150-all-versions.proof.mjs`
- `tools/proofs/202609012214-data-contract-parity.proof.mjs`
- `tools/proofs/202609012305-quantumspawn-recovery.proof.mjs` (this capsule's own)
- `tools/ci/202609012200-local-ci.mjs`

plus every `proofs` and `postProofs` path the step itself names.

## 3. The standards that stop a release

These are not preferences. Each was learned by shipping the mistake.

- **Never grade a project's grid position.** No STRONG / REMOTE /
  well-placed. Bind to the public record or say nothing.
- **A straight line is not a cable route.** Distance is measured, never
  presented as a route.
- **Never mix voltages**, and **never decode a voltage from a node code** —
  the digit convention is derived and the product marks it
  `derived_not_documented: true`. A node's voltage is trusted only where
  `voltage_consistent_with_site === true`; 649 of 2,679 nodes publish none.
- **R, X and B are carried, never computed with.** Summing impedance is the
  first line of a load flow, which needs a declared model, base values,
  taps, generation and load assumptions, contingencies and validation
  against a trusted solver. None are present.
- **Ratings are never summed.** Eight circuits at 3,000 MVA is not
  24,000 MVA of anything, and that sum is the most persuasive wrong number
  available from this data.
- **A rating is not headroom.** No field expressing spare capacity,
  headroom or availability exists anywhere in either product — verified by
  key scan, not assumed.
- **A skip is not a pass.** A proof that cannot reach the thing it checks
  must FAIL, never report success on the half it could still run.
- **Products fail closed on an unknown schema.**
- **Never amend a shipped generation.** A changed module is a new stamped
  file. Tooling is committed separately from a cut.
- **Stamps are read from `date -u` at commit time, never chosen.**

## 4. The working character to restore

Curious, evidence-led, self-falsifying. Measures before asserting. Reports
what it actually found, including its own errors, and treats a Codex
finding as evidence to verify rather than an attack to deflect. Comfortable
writing `unknown`. Willing to stop its own release when the proof is
inadequate. Direct with the owner; collaborative through receipts on the
shared board rather than through conversational memory.

Concretely, tonight: the runner's own faults were recorded in commit
messages and on the board rather than quietly fixed, and a check that
turned red was made *more precise* rather than relaxed, every time.

## 5. Cooperation with Codex

The board is `pipelinenews/docs/coordination/BOARD.md`; Codex's receipts
are in `docs/coordination/from-codex/`. **Read the board before promoting
anything.** Codex supervises independently and has been right about the
substance repeatedly — including the v2/v3 data-contract lie that survived
seven generations and was closed in v9.70. Where their implementation is
stronger, carry theirs rather than defending mine.

Codex's conditions still open, and not to be claimed as met:
- a Chrome **interaction** receipt (clicking the real UI), distinct from
  evaluating modules in the page, which is what has been done so far;
- their objection to promoting straight to `main`, which Vikram overruled
  explicitly — *"land on main every time"* — recorded on the board at
  `202609012240`.

## 6. Owner's standing instruction for this loop

Ten GridAtlas versions and ten Pipeline News versions overnight, stamps in
UTC read from the clock (the laptop is BST, so UTC = local − 1), CI/CD and
Linux protocols doing the implementation, GitHub as version control, the
laptop doing the compute. **Focus on the grid computation.** Modularise
anything over 4,000 lines with parity proofs, never touching a shipped
generation.

Requested and not yet built at the time of writing: a button that lets the
user click anywhere on the map and see the nearest substations; the
Pipeline News map-button journey for BESS, solar and onshore wind;
parallel work in `data-grid-gb`; spiders extended toward neural networks.

## 7. Honest state, refreshed at 202609020035

GridAtlas, all live and verified on the deployed bytes: v9.69
`202609012211`, v9.70 `202609012234`, v9.71 `202609012243`, v9.72
`202609012249`, v9.73 `202609012308`, v9.74 `202609012317`, v9.75
`202609012345`, v9.76 `202609020006`, v9.77 `202609020018`. **Nine of ten.**

The first two were **attended** — a hand push after a runner refspec
fault. Everything from v9.71 was a clean unattended runner pass.

Pipeline News: **one live**, `202609012326`. Three further cartridges are
authored and queued and have not been cut.

Do not inflate this count. `shift-log.json` is the authority in each
repository, and the only outcome that counts is `live`.

**Three open bugs, reported from a phone at 01:25 BST on 2 September, are
the next priority.** They are written up in
[`202609020035-session-handover.md`](./202609020035-session-handover.md)
§3, and the first is a regression: the HIDE LAYERS control added in v9.74
collapses `.dashboard`, which is the whole application, when it should
collapse `.scada-wrapper`. Read that file next.
