# See Through lightning: options A, B, C (issue #32 §10, design only)

Inputs: the eleven memos here (re-read before writing). **Owner direction, 26 Oct 22:35:** the work is not confidential, and a standalone public page linked from GridAtlas later is acceptable. "Standalone page now, link later" is therefore an owner-endorsed path. **It is not approved for build.** The owner decides, and no repository, page or product is created without a separate approval.

## Shared constraints (all options)
- **Data:** genuine EUMETSAT LI L2-LFL optical flashes, read only from Ventusltd/lightning (index v2, sealed shards, later rollups). Today that is 408 flashes, with 1.07 % of a year searched (fixture index).
- **Placement:** key-space carries only UTC 10-minute slots. No Earth coordinate is ever passed to `keyPlace` (kuiper-law.js:39), and the caption says the angle means nothing.
- **Geometry:** flashes are points or footprint discs, never bolts. Any illustration is labelled and takes nothing from a flash record.
- **Words:** "optical flashes, not confirmed ground strikes"; unknown, not zero; a searched fraction on every number; UTC.
- **Sites:** the fall stops at instrument resolution (~zoom 9–10), never at a named substation (lightning README.md:3).

## Comparison
| | **A: native GridAtlas layer only** | **B: standalone immersive See Through** | **C: linked hybrid, shared archive** |
|---|---|---|---|
| Architecture | the 23,973 B overlay appended to sld-sandbox; 808 B headroom (loop.mjs:189-194 forbids raising 460 kB) | a new dated page beside see-through/, reading the archive | A unchanged plus the B page, joined only by a URL (lightning-window.v1) and the archive contract |
| Licence | Apache-2.0 throughout; no See Through code | CERN-OHL-S v2 if see3d/model/pf are used (§3.3 notices). Apache-2.0 is possible if the page uses only kuiper-law.js (sha256-identical in Learn the Kuiper) and its Apache-2.0 2D descent. Choose in writing; never relicense silently | each work keeps its licence; no code crosses; data CC BY 4.0 with the EUMETSAT 6.3 credit; OSM joins ODbL (a flag, not a legal opinion) |
| MapLibre | 3.6.2 only (release index.html:133) | 4.7.1 vendored; see3d.js:172-177 wraps private terrain internals | two documents, one MapLibre each; a proof asserts the version per page |
| Honesty risk | low; captions specified | high: awe on four days of data; ZEND 16 ≈ 0.74 m/px vs a ≥4.5 km pixel | as B on the page |
| Accessibility | native checkbox, keyboard, 44 px targets | no `prefers-reduced-motion` in descent/see3d/model/pf; WebGL only; needs a text/table alternative | as B, but A remains the accessible path |
| Phone cost | zero at boot; 10k/40k caps; boot already 17.4 s of long tasks (budget F1) | 835,787 B of JS plus 803,086 B MapLibre; never measured on a phone | B's cost only when opened; never at GridAtlas boot |
| Cost | in flight | new page; descent.js already in five versions; one maintainer | A + archive (built) + page later |
| Main risk | R01 clipping, R03, R07, the budget | overselling; licence drift; See Through has no proofs | two surfaces drifting apart; a link to an unready receiver (link proof B3: the old See Through link lands as a project) |

## Storyboards
**Professional grid (DNO engineer, developer).**
- A: switch on Weather · Lightning in GridAtlas and choose 7d. The caption gives window, first and last flash, searched hours and "not ground strikes"; a tap gives UTC and the product id to cross-check against the engineer's own strike data.
- C: from the caption, "See through" opens the page on the same window. One storm (23 Oct, 14:00–15:59 UTC, 130 flashes) replays over the line files and stops at an uncertainty disc.
- Never in any option: a per-substation score.

**Public education (class, parish council).** On B or C, the page opens on the slot field. "Each dot is ten minutes; grey is when nobody was looking." Asked "how many hit the ground?", the page answers "this data cannot say"; exports carry caveats and credit.

## Recommendation: C, staged, taking the owner-endorsed path (page first, link later)
1. **A now:** veto, then release only by a separate owner PR; complete on its own.
2. **The archive is the hinge:** owner merges lightning PR #2; measure coverage; rollups from sealed days.
3. **The standalone public page, after separate approval.** Needs a written licence choice, a valid cvaa registry, the proofs-and-testing.md set and a real-phone receipt or BLOCKED_HARNESS. Fixture first, live archive after 28 sealed days; public, not linked.
4. **The link last:** after a sealed month, the GridAtlas release, and a See Through receiver that honours lightning-window.v1.

**Not A alone:** no room for the cosmic view (808 B, MapLibre 3.6.2); education unserved.

**Not B alone:** abandons the professional surface, needs the archive anyway, oversells four days of data.

**C:** degrades safely to A, mixes no MapLibre versions or licences, and lets the page-now path proceed without touching GridAtlas.

## Owner decisions required
- Approve or decline the standalone page and where it lives. No repository is created otherwise.
- Licence of the page: CERN-OHL-S v2 or Apache-2.0.
- Whether "a year" may ever be backfilled (subject to EUMETSAT's written permission).
- When to add the GridAtlas link.

**Would change this:** if the collector cannot keep ≥ 95 % of slots for 28 days, the page would mostly show our gaps; stop at A plus a labelled fixture page.
