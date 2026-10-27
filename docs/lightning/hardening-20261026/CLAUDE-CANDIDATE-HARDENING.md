# Claude candidate hardening: final report (issue #32), 27 Oct 2026 ~01:45 UTC

**Status: DRAFT for joint review.** Nothing is merged or released by Claude. The live pointer is still 202609241334. Claude does not sign the final veto; that belongs to ChatGPT (V1–V15) and the owner (real iPhone).

## Recommended candidate
**Build G: generation 202610270113 (composition v9.164).**
- Branch: `claude/lightning-independent-hardening-20261026`. Generation commit f6c95db; evidence up to the branch head.
- Preview PR to main: **#40** (draft, seven additive files). Once merged, the preview is at https://ventusltd.github.io/gridatlas/atlas/v/202610270113/
- Module: `atlas/modules/202610270113-uk-lightning-overlay.js`, 24,777 B. The budget is 24,781 B, the derived ceiling raised by the owner at 23:15 UTC. The original 460 kB gate is unchanged.
- The cartridge is the live 202609241334 sld-sandbox bytes, then "\n", then the module.

## Lineage (each is an immutable generation; none was overwritten)
| Gen | Build | Why superseded |
|---|---|---|
| 202610261949 | original candidate (PR #30) | challenger FAILs; the owner's iPhone defects |
| 202610262310 | A | the LOAD POINTS overshoot, and the a11y fixes didn't fit the 24,000 B cap |
| 202610262318 | C | the Grid mirror shrank the original Grid panel; a11y |
| 202610262323 | D | owner iPhone veto M01–M05 (ChatGPT); code-review CR1 blocker. Published as a preview (#35) |
| 202610270024 | E | 7 code-review FAILs plus time, security, data-contract and flaky FAILs; M01 still failing mid-scroll. Published as a preview (#37) |
| 202610270047 | F | 2 sweep regressions, the T10 wording, CRF-1/3b, ChatGPT I01/I03 |
| **202610270113** | **G** | recommended |

## What G guarantees (evidence in `evidence/` and `reports/`)
- **The original is preserved.** Gates pass: lint, state parity, all seven generation proofs, run-current 4/4, verify-compose and verify-candidate. The 31 protected files are unchanged. menuBar.inspect() = {60,3,63,63,true} with 63 proxies and 63 markers in every browser case. There are 0 lightning requests while OFF.
- **Arrival look (owner priority).** Pixel-identical to the original at 393x852 and 393x659: GRID and SUBS off, Layers closed, lightning OFF.
- **Visual.** P02/P10: 0 moved original elements in 36 cells. P11: 0.000% pixel difference.
- **M01 (HIDE LAYERS).** 0 caption overlaps at five in-app phone viewports, mid-scroll and at the end. The root cause was the inset being measured while the button read "LAYERS" (103 px against 143 px); the inset now follows the button's live size.
- **Honesty.** No zero for unknown. Optical flashes are never called strikes. Shard mismatches and lost days name their date and field. Missing WebCrypto fails closed.
- **Security.** Shard paths are allow-listed under the archive, parts are capped, schemas are checked (IX_SCHEMA, FEED_SCHEMA), redirects are rejected, counts and dates are validated, and no data reaches innerHTML.
- **Tests.** Fix suite 75/75 (0/16 on the original candidate). ChatGPT suite 8/8. Browser suite 12/13 (T8 below). Node sweep: all earlier FAILs pass except those listed under Known residuals.
- **Release rehearsal (on E; the procedure is unchanged).** It needs a separate workflow-deletion commit, then a release commit touching only atlas/current.json and STATE.md. `git revert` restores both byte-exact. Commands: `evidence/release-rehearsal-E/`.

## Known residuals (none blocks a preview; the owner decides on release)
- **T8 strict browser rule.** It samples lines that are scrolled out of the panel, so it is a test artefact: 0 points fall under HIDE LAYERS. The amended T8b passes; the amendment is proposed for joint review.
- **CRF-2/2b (LOW).** A lost day is subtracted once per overlapping scan window. It occurs only with synthetic overlaps and was dropped for bytes.
- **Cosmetic.** The period label reads "1 year", not "12 months" (3 B; reverted for bytes). "reload later" replaces "retrying next refresh".
- **Not tested here.** Real WebKit/iOS Safari, real devices, basemap tiles, the DuckDB Parquet extension, and live CORS. The data-contract parity proof's three FAILs pre-exist on live main.
- **Owner decisions outstanding.**
  - Should the toggle stay ON after an error?
  - Should EUMETSAT be credited in the original About panel? (The lightning footer already credits it.)
  - Should the workflow-deletion commit go first?
  - Should the old atlas/preview/lightning/** be deleted or archived?
  - Is an 11 px footer acceptable?
  - Should the "outside current view" count be recounted after a pan?

## Related PRs from this lane
- gridatlas #34: evidence and generations.
- gridatlas #40: Build G preview.
- lightning #3: Parquet/DuckDB, with 9 review FAILs fixed.
- lightning #4: shard_lost integrity and verified recovery.
- lightning #5: the owner's floating-DC and IT-earthing concerns, as documentation.
- data-grid-gb #1: licence.
