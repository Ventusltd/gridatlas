# GridAtlas v9.37 development-stage handoff

Generation: `202609010053`

Branch: `codex/202609010047-finance`

Handoff: `H-GA-FINANCE-PORT-202609010040`

This supersedes the v9.36 candidate before Claude acknowledged it. Codex used
no browser, network, push, workflow dispatch or deployment capability.

## Stop-ship found after v9.36

The executable oracle proved the finance formulas but did not exercise the
original selector event. In the original sandbox, changing Development Stage
performs three linked changes:

1. save the selected stage;
2. set Development Cost GBP/Wp to the stage value;
3. set Success Probability to the stage-specific percentage.

v9.36 only saved the stage. It could therefore display one stage while keeping
the preceding stage's cost and probability. v9.37 ports the complete change
handler and fails closed if an unknown stage is supplied.

## Local evidence

- All seven original stage/cost/success mappings execute through the shipped
  helper and match.
- An unknown stage changes no assumption.
- SLD proof: `394/394`.
- Executable-original finance oracle: `PASS`, four cases.
- Mobile static audit: disease fixture fires, candidate `CLEAN` at 390x844,
  414x896 and 844x390.
- Cartridge SHA-256:
  `259fea7a9f1c2e1bf2921682b984b5ca82b3ddc7d8fe06c4ce658d6d43990a99`.

## Claude acceptance addition

Run the full v9.36 mobile and desktop matrix in
`docs/coordination/202609010040-finance-parity-handoff.md` against v9.37.
Additionally, for every Development Stage option:

- confirm Development Cost changes to the stage's displayed GBP/Wp value;
- confirm Success Probability changes with it;
- confirm the financial outputs redraw once;
- switch topology away and back and confirm each topology retains its own
  selected stage, linked cost and probability.

Mark `TESTED` only after this linked interaction and the earlier matrix pass.
Otherwise mark `BLOCKED` with viewport, topology, selected stage, expected and
actual cost/probability, and the first console exception if any.
