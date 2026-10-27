# Product vision and the cosmic view

## Verdict
Yes: build a separate, read-only product on See Through's descent, fed by the lightning data plane. "Implanted" should mean launched on demand from the GridAtlas cartridge. It must never load at GridAtlas boot, which already carries 17.4 s of long tasks (mobile-performance-budget.md:19). Do not build it before the data plane is live.

## What See Through stages
It has one control, D (descent.js:21): 0 is the stars, 1 to 2 the stars gather, 2 to 8 the fall to zoom 16 (:22). The fall is timed in seconds and holds for two seconds at zoom 9 (:428-437). Its stars are lines of code and the gathering is decoration: "A star is a line of code today, not a substation" (:11). Its 20,000 keys land on 5,800 substations by p mod 5,800 (:950-967). For lightning the metaphor can become literal: one star is one flash the satellite saw.

## Product: "See Through: Lightning". Its sentence: see through the sky to one flash (parallel to :1072)
The three screens answer, in order: when, then where, then how sure.

1. **EVERY FLASH SEEN** (D = 0, the first frame). Key = (10-minute LI slot << 16) | rank within the slot. The slot is the product granule (HISTORY_ONE_YEAR.md:38-41). keyPlace (kuiper-law.js:39-40) sets the radius to √(k+½). So a star's distance from the centre is the time since the watch began: area is proportional to time and the rim is now. Storms show as bright rings, searched quiet time as black, and unsearched time as grey rings drawn from scan_windows. 455 days fit in 32 bits (52,704 slots × 65,536 < 2³²). A late lookback adds whole slots and moves no existing star, which gives the permanent keys that star-grammar requires (cvaa 202609142300:8). The angle means nothing, and the caption says so. Per-slot counts are enough to draw this screen; no shards are needed. Every count shows its denominator: "N flashes seen · H of T hours searched".
2. **WHERE THEY WERE SEEN** (D 1→2). The viewer picks a ring and that day's shard loads (no more than 10,000 raw points on phones, mobile-performance-budget.md:50). Each star then flies to its position in time order, so the storm replays as it gathers over the GridAtlas line files See Through already loads (descent.js:30, :297-301). The seed already holds one such storm: 130 flashes on 23 Oct, 14:00–15:59 UTC, from Lincolnshire to East Yorkshire.
3. **ONE FLASH** (D → floor). The fall stops where the data stops. The LI pixel is about 4.5 km at the sub-satellite point (ECMWF, 2017). On descent.js's own scale (:843), at 53° N that is 49 px at zoom 9 and 6,261 px at zoom 16. So the floor is zoom 9–10, the depth where See Through already pauses. The screen shows UTC to the millisecond, the product-id receipt (collect.py:53), and the words "optical, may be in-cloud, not a ground strike". There is no SAT view and no 3D substation (see3d.js:1-2), because nothing in this data is metre-scale. The target is the flash, never a named substation. The lightning repository names no site (README.md:3, :33), and the estate draws no inference on a card (gridatlas atlas/current.json:339).

## Honest awe
The owner's scene shows all of time at once and then returns to the familiar form. Here the eye is a satellite that blinks, and the blinks are drawn.
- Every star is a flash that was seen; nothing is filled in. Do not inherit V6's "indicative seasonal baseline" (render_price_chart.js:48).
- The satellite detects about 70% of flashes by day and 95% by night (preprint egusphere-2026-3177). I do not know the UK figure.
- Nothing is called "a year" until the archive holds one (HISTORY_ONE_YEAR.md:26-27).
- The rim dims when status.json reports stale or stopped (:55-58).
- The stars index flashes. They do not compute or predict (cvaa 202609192215:62).

## Who it serves
- **Child**: screen 1 and one sentence: "each dot is a flash a satellite saw; grey is when nobody was looking."
- **Councillor**: screen 2, with counts and hours searched.
- **DNO engineer**: screen 3, a time and a receipt to cross-check against their own ground-strike data. It does not replace that data.
- **Developer**: the cartridge stays their instrument; this product explains it. None of this is ground flash density for BS EN 62305-2.

## Order and contract
1. The cartridge goes ahead unchanged and this product complements it. Later the cartridge gains one launch link within its 24,000-byte budget (PLAN.md:18).
2. Once the data plane is live, add one derived rollup: an examined flag and a count per slot, 52,560 slots a year, pinned by sha256 the way gb_decade is (current.json:330-338). Also collect radiance and flash_footprint. LFL carries both (according to NVIDIA's earth2studio reader), but collect.py:76-82 discards them.
3. Publish the page as a new dated folder beside See Through.
4. First list See Through itself on the homepage: homepage.json has no entry for it.

## Unknowns
- LI's location error over the UK.
- What a GPU field costs on a phone at a summer's flash count.
- Whether MapLibre 3.6.2 versus 4.7.1 matters if the page is ever opened in-page.
- The rollup's size (not measured).

## Recommendations
1. Key flashes by 10-minute slot, not by count, so that gaps show as grey.
2. End the fall at one flash at zoom 9–10, never at a named substation.
3. Draw screen 1 from the slot rollup alone, and fetch shards only for the gather.

**What would change my mind:** if the hourly collector cannot keep at least 90% of hours searched for a month, the field would mostly show our own gaps. In that case I would hold the cosmic view and fix collection first.
