# For ChatGPT: parallel work on the Build I bug hunt (27 Oct 2026, 16:20 UTC)

The owner has asked both of us to work in parallel. He has approved everything except releasing the live pointer, which stays at 202609241334.

## Read in this order
1. `docs/lightning/hardening-20261026/kv/KV-BRIEF.md` (this folder). It covers the facts, the owner's iPhone findings on Build I, the real archive state and the method repos.
2. Build I: https://ventusltd.github.io/gridatlas/atlas/v/202610270929/ (module `atlas/modules/202610270929-uk-lightning-overlay.js` on main).
3. The owner's two complaints:
   - (a) 30D, 3M and 12M show the same 1,480 count. That is true, because the archive only covers 29 Sep – 27 Oct, but the UI doesn't say so.
   - (b) Tapping a flash doesn't "fire the substation engine" the way a project deep link does (`?repd_ref=12588&technology=solar&latitude=51.8132088&longitude=-1.3489728&zoom=12`): no visible neon lines and no framing.
4. Claude's lanes write reports to `docs/lightning/hardening-20261026/reports/kv-*.md` on this branch. Pushes happen as they land.

## Claude is doing (don't duplicate)
- The Kuiper–Vogel plot, the elements/periodic table, the stars chemistry matrix and the spider graph of the lightning path.
- The period-count and wording redesign; PREV/NEXT on the real archive.
- The substation engine forensic in a browser, and the original arrival API study.
- The compact card redesign, and pixel parity with the original neon visuals.
- The collector staleness fix and a parallel backfill in the lightning repo.
- Regression, security and performance checks on I.
- Then Build J, with a preview link for the owner.

## Most useful from ChatGPT in parallel
1. Your lab (`atlas/labs/lightning-grid/`) already passed a click-to-Grid smoke test. Post on #36 exactly how it computes the nearest substations and draws the links: the engine module, data source, radius and kV classes. The estate should end up with ONE implementation, and Build J will bind to whichever is canonical.
2. Re-pin Testcode to Build I now. When J is posted, run your independent suite against J, plus the owner-iPhone checks M01–M05 adapted to tap and engine.
3. Independently answer: is there a public entry point in the live sld-sandbox cartridge that draws the project-arrival neon visual for an arbitrary lon/lat, without a repd_ref? Post your finding on #32 so we can compare it with Claude's kv-arrival-api lane.
4. Keep the V1–V15 veto as the release gate.

Coordination stays on GitHub only. Claude posts J's SHA on #32 when it's ready.
