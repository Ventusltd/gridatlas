# Quantum Twin — primary key to actual code: report of 16–17 September 2026

*Ventus Ltd. For the record in ventus-grid-engine, cvaa and gridatlas. British English. Figures as measured; nothing estimated is presented as measured.*

## 1. Summary (for the board)

In one working day the estate gained a navigable map of its own code, a proven link from every mapped line to the real code behind it, and a swarm of test runners on our own machine. Two public pages carry the result: `globalgrid2050.com/testcode/202609162200-quantum-twin-flights/` and `ventusltd.github.io/star-electron-star/`. A person types a plain sentence; the page moves to the code, shows it, runs a real calculation from the published Ventus Grid Engine, and lands on the live application. Eighty of eighty runner lanes passed; the machine peaked at 47 °C.

## 2. What was measured (for the engineer and the mathematician)

- **Address space.** 250,174 numbered lines, keys 1 to 342,795, each number given once and never reused. 128,369 lines are carried by a function family; 121,805 are not yet.
- **Key-to-code coupling.** Every one of the 128,369 carried keys was fetched from its recorded repository, commit, path and line, and hashed: **128,369 of 128,369 found** (`pipeline/entangle.py`; the script refuses to write a result below 95 %).
- **The atlas on the wafer.** GridAtlas's four cartridge files and its index carry 10,415 distinct lines in 357 families; a line may belong to several families, so counts are memberships, never ownership.
- **The engine as an instruction set.** 22 modules: 14 arithmetic, 4 memory, 4 control, 2 input/output. Worked check: 120 A over 250 m at 0.32 Ω/km, power factor 0.95, three-phase → **15.796 V**, confirmed by hand (√3·120·0.25·0.304). A missing power factor is refused, not guessed. Above 100 kW every card states that a chartered electrical engineer must sign any real design.
- **State and measurement.** Each block has two states, HOME and AWAY, from where its callers sit (K same directory, L same repository, M other repositories): P(AWAY) = M ÷ (K+L+M). A measurement is one seeded draw (FNV-1a hash of seed, state, count into mulberry32), recorded so it can be replayed. 143 atoms are taken from published data; 10,842 are estimated from copies and labelled as estimates.
- **Layouts are functions.** Every arrangement (time, apps, floorplan, rings, seed, orbit) is a function key → (x, y); positions are computed, never stored; identity never moves. The golden-angle law equidistributes and cannot form arms; arms require an explicit count (logarithmic spiral, pitch 12.5°).
- **Tests.** 60 machine checks (keys, engine, routes, coupling, server, planner) pass in under two seconds; 50 typed user actions pass 49 of 50 on the live page (one wording race); the space-to-earth journey (GridAtlas, Pipeline News, Spider Sandbox, Periodic Table, and back) passed 8 of 8. Two swarm waves on our runners: **80 of 80 lanes**, peak GPU 47 °C, peak CPU 31 %, never below 14.7 GB free.

## 3. What it is worth (for sales)

- **A product a customer can use today:** type "voltage drop for 120 A over 250 m at 0.32 ohm per km, power factor 0.95" and receive the figure, its basis, and the code that computed it. The same box lands on GridAtlas or Pipeline News and returns.
- **A defensible claim:** every figure traces to a script that can fail and to a line of code at a commit. No number on these pages comes from a language model.
- **A first paid offer:** the Grid Connection Check in six instructions (demand → kVA → current → voltage drop → exceedance → firm capacity), with the published fault level quoted by date. Three additions make it complete for a distribution engineer: earth-fault loop impedance (BS 7671 411.4.4), transformer impedance (IEC 60909), cable thermal rating (BS 7671 Appendix 4 / IEC 60287).
- **The two sentences that keep us honest with a customer:** "A rating is what a circuit is rated to carry, not what is free on it." and "Computed from stated inputs on a stated date; the binding figure is the DNO's, in the offer."

## 4. Decisions still open

1. When a key sits in several families, which place is primary: newest commit, first, or all.
2. The unit of the wafer: all 250,174 numbered lines, or the 128,369 carried by a function.
3. Rebuild the star index on every push, or freeze it and date-label the wafer.

## 5. Rules adopted

Open source, our own development, or the mathematics of the universe; never a licensed design. Plain British English on public pages: block, twin, star, state, gate, die, wafer, unnamed. Colour only when a function happens. Nothing published until agreed offline and released by the owner.
