# GridAtlas v9.39 single-BESS and count-integrity handoff

Generation: `202609010106`

Branch: `codex/202609010047-finance`

Handoff: `H-GA-FINANCE-PORT-202609010040`

This is the fifth timestamped GridAtlas iteration on this branch and
supersedes v9.38 before Claude acknowledged it. Codex used no browser,
network, push, workflow dispatch or deployment capability.

## Stop-ships found after v9.38

The original drawing reads `fin_string_bess_mwh` or
`fin_central_bess_mwh` directly. That same topology-local value drives BESS
revenue, CAPEX and the map compound. The port invented a second layout-BESS
input and falsely called the two values “separate original inputs.” v9.39
deletes that duplicate: one visible BESS MWh value now drives all three paths.

The port also rendered every electrical input with `step="any"`. A fractional
ring or inverter count made the electrical arithmetic fractional while the
geometry loop still drew whole blocks. v9.39 gives each field its original
minimum, maximum and step. Topology counts must be positive integers; an
invalid edit restores the prior visible value and stops before arithmetic or
geometry runs.

Finally, the original central defaults are restored: 24 strings per combiner,
one inverter per skid, four skids per ring, four rings. The central AC defect
is latent at the one-inverter default, so the regression continues to exercise
explicit two- and three-inverter stress cases where the original square is
observable.

## Local evidence

- Runtime BESS test: zero MWh removes the compound; 20 MWh adds it through the
  financial input used by revenue and CAPEX.
- Runtime normalization rejects fractional/zero counts and out-of-range
  central ratings; exact bounds pass.
- Original default case is equal; two- and three-inverter stress cases retain
  the explicit corrected divergence.
- SLD proof: `406/406`.
- Executable-original finance oracle: `PASS`, four cases.
- Mobile static audit: disease fixture fires, candidate `CLEAN` at 390x844,
  414x896 and 844x390.
- Cartridge SHA-256:
  `ebc5ae39cecdb5ea00e5c03aa14ca33dcc342c7149170e8547b8e4dc86775cf3`.

## Claude acceptance addition

Run every earlier finance/mobile matrix against v9.39, then:

1. In each topology set financial BESS energy from 0 to a positive number.
   Confirm CAPEX/revenue and the visible compound change from the same field;
   there must be no second layout-BESS field or mismatch message.
2. Try 1.5 rings, 0 rings, 1.5 inverters/skid and a central inverter rating
   over 20 MW. Each invalid edit must visibly return to its prior value without
   changing capacity, block count or geometry.
3. Confirm valid whole counts update the stated block count and drawn block
   count together.
4. Confirm Central opens with 24 strings/combiner, 1 inverter/skid, 4
   skids/ring and 4 rings; default inverter and transformer totals are both
   70.4.
5. Repeat at 390x844 and 844x390 and inspect the console for an exception loop.

Mark `TESTED` only after this and all earlier matrices pass. Otherwise mark
`BLOCKED` with viewport, topology, field, entered/prior/output values and the
first exception.
