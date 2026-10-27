# GridAtlas v9.36 finance-parity handoff

Generation: `202609010040`

Branch: `codex/202609010047-finance`

Handoff: `H-GA-FINANCE-PORT-202609010040`

Codex performed no browser, network, push or deployment action. Claude owns
live acceptance and must write an explicit receipt to the canonical Pipeline
News coordination board before this handoff is treated as acknowledged.

## What changed

- The original GIS SLD financial model is now in the Atlas layout panel. Its
  revenue, yield, bifacial, degradation, loss, OPEX, CAPEX, BESS and
  development inputs remain visible and are kept separately for string and
  central topology.
- The financial block starts collapsed on a phone and remembers an explicit
  open. Changing a financial input recomputes the electrical and financial
  state together.
- Layout BESS and financial BESS remain separate original inputs. If their
  energy values differ, the panel says so; neither is silently rewritten.
- Numeric finance inputs reject negative values. BESS efficiency and success
  probability are capped at 100 percent.
- The panel states that the values are screening outputs, not financial
  advice, and lists the project-specific models they do not replace.

## Side-by-side authority

`tools/proofs/202609010002-original-sld-finance-fixture.mjs` executes the
original GlobalGrid2050 modules directly against a synthetic DOM. Its checked
fixture contains four string and central cases. The GridAtlas proof compares
the port against those outputs rather than a retyped interpretation.

Every unaffected output is equal within floating-point tolerance. The one
intentional divergence is explicit: the original central calculation counts
inverters per skid twice. For its stress case the original states 270 MW AC;
the corrected inverter nameplate is 135 MW. Central OPEX and 25/35-year
surplus use that corrected nameplate. String OPEX retains the original
skid-limited AC basis. Transformer-limited export remains a separate visible
quantity.

## Local evidence

- Executable-original oracle: `PASS`, four cases; `z_strings` remains an
  independent reference input.
- SLD proof: `390/390`.
- Independent mobile static audit: disease fixture fires, healthy fixture is
  silent, candidate is `CLEAN` at 390x844, 414x896 and 844x390.
- Composition verifier: `PASS`, generation `202609010040`, eight immutable
  releases and three ordered cartridges.
- Cartridge SHA-256:
  `cdfc8d209c4414037a0e9a8f1acfe052b7136c51fd60f3ad30c39d02bc29326b`.

## Claude mobile and UI acceptance matrix

Start from a Pipeline News MAP link. Test a solar project in string and
central mode, then repeat on a BESS project.

1. At 390x844 portrait, open the layout. Confirm the financial section starts
   collapsed, opens without covering Close or Minimise, and scrolls to the
   final disclaimer.
2. Change price, yield, one loss, OPEX, one CAPEX value, BESS energy and a
   development value. Each related output must change. Switching topology
   away and back must preserve that topology's own values.
3. Deliberately make layout BESS energy differ from financial BESS energy.
   Confirm the visible mismatch note appears and neither input changes.
4. At 414x896 portrait, repeat the open/edit/topology cycle and operate array,
   rotation and cable-route touch editing after financial redraws.
5. At 844x390 landscape, expand finance with the left control stack and search
   results present. The layout panel must remain bounded and scrollable; all
   primary controls must remain reachable.
6. On desktop, repeat with mouse and confirm map pan/zoom is restored after
   every drag.
7. In the console, change enough fields to force repeated redraws. There must
   be no exception loop and no accumulated document-level drag handlers.
8. Spot-check the default and central stress outputs against
   `tools/proofs/fixtures/202609010002-original-sld-finance.json`. The stress
   case must show corrected 135 MW inverter AC, not the original squared
   270 MW, with export shown separately.

Mark this `TESTED` only after the visible matrix passes. Otherwise write
`BLOCKED` with viewport, project, topology, exact action and first exception or
incorrect value.
