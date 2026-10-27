# Stamps ran ahead of the clock

Generation 202609012148 (UTC, read from `date -u`). Filed with the cut of v9.68.

## What was asked

At 22:18 on the laptop's clock Vikram asked whether UTC is local minus one.
It is: the laptop is on GMT Standard Time with British Summer Time in force,
offset +01:00, so 22:18 local was 21:18 UTC. The question was answered by
measurement (`Get-TimeZone`, `[DateTimeOffset]::Now.Offset`), not from memory.

## What the measurement found

Every stamp chosen this evening by either agent ran AHEAD of the UTC clock,
and the lead grew through the evening: from +52 minutes at v9.56 to +253
minutes by the last Pipeline News board entry. Two mechanisms:

1. Stamps were typed in local time (BST) for the first hour: +60 min.
2. Stamps were then chosen to sort after the previous one, at round
   numbers, faster than the clock moved: the remaining +190 min.

v9.67 is named 202609012250 and was committed at 18:51 UTC. Its name claims
a time four hours after its cut.

The CVAA vaccine `monotonic-utc-generations` (registered 30 Aug, 17:01) says
"generations are read from date -u at commit time, never chosen". It was in
the registry and in nobody's loop. Run tonight for the first time against
these repositories it fires 122 times on GridAtlas, 98 on Pipeline News, 5
on data-grid-gb. A vaccine nobody runs is a note.

## The table (commit subject stamp vs committer time, UTC)

| repo | commit | stamp | committed UTC | drift min | subject |
|---|---|---|---|---|---|
| gridatlas | 79e81d3 | 202609011718 | 202609011626 | +52 | 202609011718-gridatlas-v9.56: pink for what is not built yet |
| gridatlas | 747fadc | 202609011730 | 202609011628 | +62 | 202609011730: study addendum - Little Crow, and why the far end needs  |
| pipelinenews | cdb1d6d | 202609011735 | 202609011628 | +67 | 202609011735: board - v9.56 pink for unbuilt, Little Crow archetype, E |
| pipelinenews | efb6603 | 202609011732 | 202609011633 | +59 | 202609011732: board - telemetry defect persists through v9.56 |
| pipelinenews | 369adf5 | 202609011739 | 202609011636 | +63 | 202609011739: board - bound ETYS topology claims |
| pipelinenews | 7249340 | 202609011742 | 202609011638 | +64 | 202609011742: board - preserve ETYS fault metric semantics |
| data-grid-gb | 1d79e48 | 202609011755 | 202609011646 | +69 | 202609011755: ChatGPT lane - pin and normalize ETYS topology and fault |
| pipelinenews | 52cf154 | 202609011756 | 202609011647 | +69 | 202609011756: board - Codex ETYS feed lane landed |
| data-grid-gb | f267d0d | 202609011756 | 202609011647 | +69 | 202609011756: exclude generated Python cache |
| pipelinenews | e690319 | 202609011800 | 202609011648 | +72 | 202609011800: board - stop mislabeled ETYS fault current |
| gridatlas | 2051b8e | 202609011751 | 202609011652 | +59 | 202609011751-gridatlas-v9.57: the substation gets its own cartridge, a |
| gridatlas | 8e017d5 | 202609011805 | 202609011656 | +69 | 202609011805-gridatlas-v9.58: service restored - v9.57 claimed a slot  |
| pipelinenews | c1c6b8c | 202609011810 | 202609011656 | +74 | 202609011810: board - v9.57 outage, v9.58 rollback, and the data-grid- |
| data-grid-gb | dbfeecb | 202609011756 | 202609011657 | +59 | 202609011756: ETYS v2 - retain eight fault-current fields and scenario |
| data-grid-gb | 96a54fc | 202609011755 | 202609011657 | +58 | 202609011755: preserve exact ETYS fault-current semantics |
| pipelinenews | 8abae5b | 202609011808 | 202609011658 | +70 | 202609011808: board - ETYS v2 fixed, GridAtlas still stopped |
| gridatlas | 633aa32 | 202609011820 | 202609011703 | +77 | 202609011820-gridatlas-v9.59: the substation cartridge returns, throug |
| pipelinenews | 23ee4b9 | 202609011830 | 202609011703 | +87 | 202609011830: board - v9.59 consumes data-grid-gb v2 through a verifie |
| pipelinenews | 7e3193a | 202609011823 | 202609011703 | +80 | 202609011823: board - hold v9.59 before promotion |
| gridatlas | b78ad80 | 202609011845 | 202609011708 | +97 | 202609011845-gridatlas-v9.60: both pre-promotion findings closed |
| pipelinenews | 46fd65f | 202609011855 | 202609011710 | +105 | 202609011855: board - v9.60 closes both findings, live-accepted on dep |
| pipelinenews | 2f315c0 | 202609011852 | 202609011716 | +96 | 202609011852: board - bound v9.60 network sentence |
| gridatlas | 0327b21 | 202609011900 | 202609011717 | +103 | 202609011900: an acid-test brief, and the defect it found while being  |
| data-grid-gb | 7656dbf | 202609011920 | 202609011723 | +117 | 202609011920: connection points v3 - separate voltage envelopes and fa |
| pipelinenews | bcfb605 | 202609011922 | 202609011724 | +118 | 202609011922: board - hand off voltage-specific grid feed v3 |
| gridatlas | db32995 | 202609011915 | 202609011725 | +110 | 202609011915-gridatlas-v9.61: the network sentence names its own scope |
| pipelinenews | 1f66eeb | 202609011925 | 202609011726 | +119 | 202609011925: board - v9.61 accepts the site-envelope finding, consume |
| pipelinenews | 792df70 | 202609011927 | 202609011726 | +121 | 202609011927: board - hold v9.61 until it consumes v3 |
| pipelinenews | f1da51f | 202609011929 | 202609011728 | +121 | 202609011929: board - correct final v3 product hash |
| gridatlas | 8a8161e | 202609011950 | 202609011735 | +135 | 202609011950: modules, proven against the 4,000 lines, nothing swapped |
| pipelinenews | 710a7db | 202609011955 | 202609011735 | +140 | 202609011955: board - accept modular foundation, retain promotion boun |
| pipelinenews | 1ee5f95 | 202609012012 | 202609011741 | +151 | 202609012012: board - retain assembler atomicity boundary |
| pipelinenews | 30c8e3a | 202609012015 | 202609011742 | +153 | 202609012015: board - reject invented voltage classes |
| gridatlas | 3e7982f | 202609012020 | 202609011744 | +156 | 202609012020-gridatlas-v9.62: the Grid Finding Scope, and the first as |
| pipelinenews | d615d32 | 202609012020 | 202609011744 | +156 | 202609012020: board - reconcile hostile review against v3 |
| pipelinenews | 88fee60 | 202609012025 | 202609011746 | +159 | 202609012025: board - stop-ship v9.62 voltage classifier |
| gridatlas | 5634beb | 202609012045 | 202609011752 | +173 | 202609012045-gridatlas-v9.63: the fault current is quoted at the conne |
| gridatlas | c4796e9 | 202609012055 | 202609011752 | +183 | 202609012055: harden scope classes and atomic cartridge assembly |
| pipelinenews | 862a5c6 | 202609012055 | 202609011752 | +183 | 202609012055: board - close v963 assembler collision race |
| pipelinenews | 66ac579 | 202609012050 | 202609011752 | +178 | 202609012050: board - stop-ship accepted and closed in v9.63 |
| cvaa | b4454c3 | 202609012100 | 202609011758 | +182 | 202609012100: define CVAA federation mission and boundaries |
| gridatlas | 32bc3bb | 202609012105 | 202609011800 | +185 | 202609012105: carry Codex's assembler boundary — staged, exclusive, an |
| gridatlas | e25d8f9 | 202609012110 | 202609011807 | +183 | 202609012110-gridatlas-v9.64: a cut is a tool, and a cartridge is chec |
| pipelinenews | a05ac71 | 202609012115 | 202609011807 | +188 | 202609012115: board - assembler boundary carried, parts-drift and hand |
| pipelinenews | 72c0438 | 202609012115 | 202609011808 | +187 | 202609012115: preserve Claude-Codex continuity and rank grid-map work |
| gridatlas | c2896f5 | 202609012130 | 202609011811 | +199 | 202609012130-gridatlas-v9.65: the page stops telling its reader it is  |
| pipelinenews | 759f77b | 202609012140 | 202609011813 | +207 | 202609012140: board - v9.64/v9.65 live acceptance and the ledger-drift |
| gridatlas | b810feb | 202609012155 | 202609011822 | +213 | 202609012155-gridatlas-v9.66: deepen the grid computation, and test it |
| gridatlas | eb5c57f | 202609012200 | 202609011827 | +213 | 202609012200: a local CI that measures every version and reads every b |
| pipelinenews | 8d850b1 | 202609012205 | 202609011828 | +217 | 202609012205: board - topology module, all-versions test, and a local  |
| gridatlas | 4c7ad98 | 202609012210 | 202609011830 | +220 | 202609012210: name the limit of the all-versions claim, measured on th |
| data-grid-gb | 04e0d62 | 202609012130 | 202609011835 | +175 | 202609012130: publish verified map-click ETYS network neighbourhoods |
| gridatlas | e23aa02 | 202609012230 | 202609011837 | +233 | 202609012230: add fail-closed voltage-scoped map-click network consume |
| pipelinenews | ca62f47 | 202609012235 | 202609011837 | +238 | 202609012235: board - hand off voltage-scoped map-click branches |
| gridatlas | c37d657 | 202609012240 | 202609011844 | +236 | 202609012240: add proved estate scanner and Codex comparison mirror |
| gridatlas | a342de4 | 202609012250 | 202609011851 | +239 | 202609012250-gridatlas-v9.67: one geodesy, a click that says which car |
| gridatlas | 9118a2d | 202609012310 | 202609011901 | +249 | 202609012310: the CI learns to catch a check that declines to check |
| pipelinenews | d11a5c9 | 202609012300 | 202609011901 | +239 | 202609012300: the deep link is a contract, and this is our side of the |
| cvaa | c18cc13 | 202609012310 | 202609011901 | +249 | 202609012310: a vaccine CVAA cannot yet carry, and why that matters |
| pipelinenews | d1c902e | 202609012315 | 202609011902 | +253 | 202609012315: board - the deep scan and the three findings built into  |

## The decision

1. **The stamp is read from the clock.** \`tools/recompose.mjs\` now defaults
   \`--generation\` to UTC now and refuses a given one more than five minutes
   from it. Commit subjects are stamped from \`date -u\` at commit time.
2. **The chain is \`previous_generation\`, not sort order.** v9.68 is named
   202609012141 and sorts before v9.67's 202609012250. That is the truth of
   the two clocks, and the manifests chain by pointer. Recompose warns, does
   not refuse. The parts-integrity runner used to find "current" by sorting
   manifest names; it now reads \`atlas/current.json\`. The ledger checks
   record the single inversion by name (202609012250, typed ahead) and
   tolerate no other.
3. **The manifest records the clock beside the stamp** (\`cut_at_utc\`), and
   the sandbox proof checks the two agree to five minutes.
4. **Local CI Pass 5, "a stamp is a clock".** History drift is reported and
   never amended; a file in the working tree named for a time the clock has
   not reached fails the run; the sibling \`cvaa/inoculate.mjs\` is run and
   its monotonic-utc counts printed, and its absence fails the run. A skip
   is not a pass.
5. **Shipped generations are not renamed.** v9.56 through v9.67 keep the
   names they shipped under. Their manifests, proofs and ledger entries are
   history.

## Why the honest name sorts backwards, and why that is fine

A file listing sorted by name shows v9.68 before v9.67. That listing is
showing the lie of v9.67's name, not an error in v9.68's. Anyone reading the
manifests reads \`parent_generation\`; anyone reading the ledger reads the
versions, which are strictly increasing without exception. Rewriting v9.67's
name to make the listing pretty would be amending a shipped generation to
hide a measurement, which is the one thing this estate does not do.
