# Time, replay and the lightning clock

**Answer: yes, but the EUMETSAT 10-minute slot becomes the data product's primary key first. Moving time (replay, a time-driven descent) lives in the separate See Through-derived page. GridAtlas gets observer-driven time only: a static clock line now, frame-step buttons later, never autoplay.**

## The two clocks we have
- Source: LI L2-LFL products are slots starting HH:M0:09; each name's slot number equals the 1-based 10-minute index (408/408 features); creation stamps are a median 16 s after slot end, max 224 s (116 product names in `data/uk_lightning.geojson`).
- Observer: cron `20 */3 * * *`, 3 h lookback (`update-lightning.yml:4`, `collect.py:197,204`). Slot-level replay of `seed_scan_windows.json`: of 806 slots (20 Oct 22:41 → 26 Oct 13:00 UTC), 553 fully searched, 17 partial, 236 never (29%); longest hole 5.3 h; 439 searched slots had no flash. Three states, not two.
- Nothing here is live: downloads need credentials (`collect.py:121-127`), so the newest frame trails by the cron (hourly on the branch, `wt/.github/workflows/update-lightning.yml:8`; drift 5–141 min, auditor F1) plus raw `max-age=300`.
- The data is rich in time, poor in space: flash_time carries real milliseconds (341 distinct values in 408); position is a ~7 km pixel footprint (auditor F10).

## The lightning clock
From today's data: "Last flash over the UK box 25 Oct 11:15:58 UTC. Since then 14.2 h searched, nothing found; 11.5 h never searched. As of last search end, 26 Oct 13:00 UTC." The reference instant is `last_successful_scan_end_utc` (the observer's now), not wall-clock. It says "nothing found in searched time", never "no lightning", in absolute UTC, written once per load. The stack has three staleness clocks: 4 h from `generated_utc` or `next_update_due` (`history-window.mjs:207-209`, `history.py:503`), and 6/12/24 h from scan end (`status.py:20-23`). Keep status.json's.

## Replay
- Frame = one product slot, never a wall-clock bin: with :00 bins, 6 of 408 flashes change frame, and one is timed 0.361 s before its product's start.
- Each frame is lit, dark (searched, zero), grey (unknown) or partial. Grey frames play at full duration; "skip to next searched" states the hours skipped; no tweening; afterglow labelled as display persistence.
- Rate: ≤48 h at 10-minute frames, 6 frames/s (one hour per second); 7 d at hourly frames showing "k/6 slots searched"; longer windows use daily index frames without points. Reduced motion means stepping only.
- UTC keys: BST ended 25 Oct 01:00 UTC, inside the seed, so a local scrubber would play 01:00–01:59 twice.

## Window controls versus a scrubber
The UX spec's chips choose the stretch of time, and a scrubber is a cursor inside it (one state object, detail tier only). Autoplay is out: 408 flashes took 10.6 s to map idle at 393×852, 4× CPU (software GL, budget F5). Steps may change only attributes, properties or canvas (range `value`, `aria-valuetext`, a coverage strip as the track). The body observers watch childList and characterData, not attributes (`substation-intelligence…js:6098`, `sld-sandbox…js:4283,5007,8662`). That is increment 2, given the 24,000-byte ceiling (PLAN §1). Hand-off: `see-through/index.html` already forwards `location.hash`; `descent.js` reads none.

## See Through driven by time
`descent.js` already runs on absolute time: `flightDepth(seconds)` (L428-437), `stageOf(D)` with four stages (L801-802), one rAF loop that switches to lite above 14 ms (L519-568), and 12,900–20,000 particles a frame (L955). Swap the ladder to YEAR → MONTH → DAY → SLOT → FLASH, each a disc of slots placed by `kuiper-law.js` unchanged, with key = slot ordinal from a fixed epoch. Because r = √(k+½), each slot gets equal area, so the grey share of the disc is the unsearched share of time. The dots display; they do not compute (vaccine 202609192215). The sweep arm (L544) is no clock hand: successive keys turn 222.49° (`kuiper-law.js:27`). Halt the spatial fall at the zoom-9 hold (L434), where 7 km ≈ 80 px at 55°N; `ZEND = 16` (L22) would fake a strike point. Add `prefers-reduced-motion`: descent/see3d/model/pf have none; GridAtlas requires it (`current.json:95`).

## Data contract (lightning repo, derived from sealed shards)
- `slots`: per UTC day, a 144-character state string (F/P/–) and 144 counts, null where unsearched. The upper levels fetch no points.
- `replay/YYYY/MM/DD.json`: columnar, sorted by slot then second: `slot_offsets[145]`, 1-s time deltas, lon/lat ×10⁴ integers. On the 408 real flashes this is 17 B/flash (8 B gzip) against 527 B today, so a 60k-flash day is about 1 MB.
- The archive keeps milliseconds and ids, and rollups are derived ("data before charts", `current.json` gb_decade). Tests: Σ slot counts = index count; states match `scan_windows`; sealed per `history.py:208-214`.

Unknown: real-phone frame cost, the Data Store availability time compared with creation stamps, and the coverage of the unmerged hourly branch.

## Recommendations
1. Key everything on the product slot, and publish slot tables and lean replay files before any replay UI.
2. Animate time only in the See Through-derived page; in GridAtlas, time moves only when the observer steps it.
3. Use one staleness clock (status.json), UTC keys, grey frames at full duration, and "nothing found in searched time".

**Would change my mind:** if after two weeks the hourly self-healing collector still leaves over 10% of slots unsearched, replay is mostly grey film. Then ship only the clock and the daily counts.
