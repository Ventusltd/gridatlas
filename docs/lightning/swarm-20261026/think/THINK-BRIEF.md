# Think-tank brief: lightning as a See Through intelligence product (read fully before writing)

You are one of twenty thinking agents. Each has a different lens. You are not building anything; you are producing one
memo of at most 700 words, grounded in the actual code and data on this machine, that the lead will synthesise into an
architecture decision for the owner. Cite file paths and line numbers where you make claims about code. Say plainly
what you do not know. No marketing language.

## The owner's proposition (verbatim, 26 Oct 2026 19:14)
"there is massive code that has been disrespected by cvaa called 'see through' inspired by Krishna Arjun battlefield
scene when he shows the cosmic view, that hasn't been listed on home page but see through uses kuiper code very
intelligently and I feel lightning data can be built separately like electricity intelligence charts which took an
immense effort combined with see through app code and then implanted within gridatlas to present awe inspiring data
but actual lightning."

## What exists (all local, read-only)
- See Through: /home/claude/ventusltd/kuiper-belt/see-through/ (README.md; newest generation 202610050609/ with
  descent.js 156 kB, see3d.js 32 kB, model.js 40 kB, pf.js 12 kB, kuiper-law.js 8 kB, grid-data.js 587 kB, index.html,
  NOTICE.md, LICENSE.md = CERN-OHL-S v2). It falls from a Kuiper star field (every key placed by r = sqrt(k+0.5),
  theta = 2*pi*frac(k*2654435769/2^32)) through the UK grid (5,800 substations, 400/275/132 kV lines, OSM/ODbL) down a
  porthole to one substation rendered in 3D on Esri imagery with rule-drawn pylons. Live: https://ventusltd.github.io/kuiper-belt/see-through/
  It is NOT listed in the GlobalGrid2050 homepage catalogue (/home/claude/ventusltd/globalgrid2050/homepage-shell/data/homepage.json
  lists Kuiper and "What is the Kuiper?" but no See Through entry).
- The Kuiper itself: /home/claude/ventusltd/kuiper-belt/index.html (GPU point shader drawing millions of keys), what-is-kuiper.html, learn-the-kuiper/.
- cvaa: /home/claude/ventusltd/cvaa (README.md, vaccines/, reports/DIARY-20261005-learn-the-kuiper.md). Its vaccine
  202609192215-cells-compute-or-say-programmable.md polices any served page claiming the Kuiper/dots "compute"; its
  diary links Learn the Kuiper "without declaring a new vaccine or certifying an application release".
- The electricity intelligence stack the owner cites: /home/claude/ventusltd/globalgrid2050/uk_energy_tracking_v6/
  (price_history_chart/, generation_history/, live_data_pipeline/, index.md) and the data-before-charts rule recorded in
  /home/claude/gridatlas/atlas/current.json under "gb_decade" (a consumer reads a 4 kB rollup from data-gb-electricity,
  pinned by sha256, never owns source data). Also /home/claude/ventusltd/globalgrid2050/energy-transition-simulator/202609282123/ (the 3D overlay See Through borrowed from).
- Lightning data today: /home/claude/lightning (collect.py, data/uk_lightning.geojson = 408 EUMETSAT MTG Lightning Imager
  L2-LFL optical flashes, 21–25 Oct 2026, UK box −11..3 E, 49.5..61.5 N) and the data-plane branch in
  /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/lightning-data-plane-builder/wt
  (history.py index v2, daily shards, coverage per day, tests). Fixtures: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/.
- The GridAtlas work in flight: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/PLAN.md
  (an additive, off-by-default lightning layer inside the original GridAtlas, being built now) and the ten audit reports in
  ../reports/ (architecture, visual, menu, transport, archive, UX, regression, veto, V6 study, budget). Key constraints:
  GridAtlas has no free slot, the live composition must not change, phones tolerate ~10k raw points, forty thousand cost
  30 s, the original already spends 17–19 s of long tasks at boot; the collector missed ~46% of hours since seed; flashes
  are optical, not ground strikes; missing days are unknown, never zero.
- Owner's philosophy (context): the Shastra, 300 lines distilled from the Mahabharata; "the self came before the universe
  because the observer defines a time-like trajectory"; the Kuiper's golden-angle never-repeating turn; open source all
  the way; knowledge given freely; imperfect is the point; honesty over polish.

## The question every memo answers from its own lens
Should lightning be built as a separate intelligence product in the image of the electricity intelligence charts
(data owner repo + rollups + UI that only reads), fused with See Through's descent/3D/Kuiper code, and then implanted
into GridAtlas as a presentation of REAL lightning? If yes: what exactly, in what order, with what data contract, what
budget, what honesty rules, and how it relates to the additive cartridge already being built (complement, not
replacement). If no or not yet: why, and what instead.

## Output
Write /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/think/memos/<your-lens>.md
(≤ 700 words; headings allowed; end with three one-line recommendations and one thing that would change your mind).
Return a summary of at most 150 words to the lead. Do not modify any repository. You may run read-only commands.
