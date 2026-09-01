# GridAtlas v9.38 topology-state handoff

Generation: `202609010058`

Branch: `codex/202609010047-finance`

Handoff: `H-GA-FINANCE-PORT-202609010040`

This supersedes v9.37 before Claude acknowledged the finance candidate. Codex
used no browser, network, push, workflow dispatch or deployment capability.

## Stop-ship found after v9.37

The original sandbox owns separate physical inputs for string and central
topology: module rating and dimensions, Mounting & GCR, gross-site factor, and
layout BESS. The port shared those fields. An edit in String therefore changed
Central silently, and vice versa.

The original also links its three Mounting & GCR presets to financial bifacial
gain for that topology:

- GCR 0.35 → 8 percent;
- GCR 0.45 → 5 percent;
- GCR 0.75 → 2 percent.

v9.38 separates both topology states and carries those exact links. A
free-form GCR does not invent a bifacial assumption.

The original's normative finance warnings are deliberately not ported. Words
such as typical, aggressive and optimistic are benchmark judgments, not
calculation outputs. Until they have governed evidence, the Atlas shows the
input, arithmetic and screening disclaimer without grading the case.

## Local evidence

- Runtime checks prove string and central physical inputs produce their own
  module capacity and do not mutate one another.
- Runtime checks prove all three mounting/bifacial mappings affect only the
  selected topology and a free-form value changes nothing.
- SLD proof: `400/400`.
- Executable-original finance oracle: `PASS`, four cases.
- Mobile static audit: disease fixture fires, candidate `CLEAN` at 390x844,
  414x896 and 844x390.
- Cartridge SHA-256:
  `c6a13cfa4e31e3cfd9c9671137f36776993405f5d11a03aca9b20f466ec5ae9d`.

## Claude acceptance addition

Run the full earlier finance/mobile matrices against v9.38. Additionally:

1. In String, change module rating, dimensions, GCR, gross-site factor and
   layout BESS. Record String outputs.
2. Switch to Central. Confirm its five values stayed at Central's preceding
   values and its output did not inherit String's edit.
3. Make a different Central edit; switch back and confirm String retained its
   own state.
4. In each topology select/enter 0.35, 0.45 and 0.75 GCR and confirm bifacial
   becomes 8, 5 and 2 percent only in that topology.
5. Enter 0.51 GCR. Confirm the existing bifacial value remains visible and is
   not guessed.
6. Repeat state switching and edits at 390x844 and 844x390; no control may be
   hidden or unreachable and no console exception loop may appear.

Mark `TESTED` only after this and the earlier matrices pass. Otherwise mark
`BLOCKED` with viewport, topology, field, expected/actual value and first
exception.
