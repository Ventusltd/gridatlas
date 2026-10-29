# DC-A9: aggregate data-centre demand context (Team A, research)

Status: done, 29 Oct 2026. No code, commits or PRs. Issue #73 had no comments to cross-check when this ran.

## Outputs
- evidence/DC-A9/context.json: 27 figures, each with value, unit, year, geography, measure (IT load, connection or energy), source URL, licence and verification status. It also holds DESNZ regional values, derived calculations kept apart from source figures, a claim-by-claim check of the owner's note, and the About text (150 words).
- evidence/DC-A9/about.txt and evidence/DC-A9/build_context.py, which regenerates the JSON.

## Verification of the owner's note
Confirmed:
- Covenant (HMT, 28 Oct 2026): 6 GW, undefined, PUE 1.3.
- Annex: 1.8 GW of IT load across ~330 sites.
- DUKES: 323 / 275.5 / 293.6 TWh.
- DCU0081: 5.2 GW, >20 TWh, >70 GW, 7-year ramp.
- 10-Year Outlook: 5.4 / 14.6 / 23.5 TWh, ~50% speculative.
- DESNZ: 4.5 TWh.
- Guardian figures.
- The arithmetic.

Corrections:
1. "Threefold" comes from the Compute Roadmap page, not the evidence annex.
2. The FES 7.6 TWh / 2.4 GW figure is not in DCU0081. It is confirmed only second-hand, by DCD and by DESNZ, which dates it to 2023.
3. The 7-year ramp comes from DCU0081, not the 10-Year Outlook.
4. 45 TWh is 13.8% of demand, so the range is "7-14%", not "7-15%".
5. The note's DUKES URL could not be reached from this session. The figures were verified at an alternate asset URL.
6. DESNZ excludes enterprise data centres.
7. The note gives no URL for the DESNZ figure. One is added in context.json.

## Regional data
NESO publishes no data-centre breakdown by GSP or region. Its only regional number is a cap of at most 20% of future demand in Scotland. FES 2025 Building Blocks are published per GSP under the NESO Open Licence, but no data-centre block could be confirmed (unverified).

DESNZ (OGL) gives 2024 regional figures: South East 1.8 TWh (Slough 1.3), London 1.7 TWh, rest of GB 1.0 TWh.

## Licences
- OGL v3: gov.uk and DESNZ.
- Open Parliament Licence: DCU0081.
- Unverified: the NESO slides and FOI page (no statement found).
- Not open: DCD and Guardian press. Cite only.

## Not done
- Shell egress is blocked, so no raw snapshots or SHA-256 hashes.
- The AEMO, CEC, FiT, solar and 2005 claims were not re-verified (outside scope).
