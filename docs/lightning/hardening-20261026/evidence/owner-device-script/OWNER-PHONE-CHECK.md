# Lightning overlay: 10-minute iPhone check

**Preview:** https://ventusltd.github.io/gridatlas/atlas/v/202610270024/ (works only after that preview is merged and GitHub Pages has deployed it)
**Live:** https://ventusltd.github.io/gridatlas/atlas/ (the bare https://ventusltd.github.io/gridatlas/ redirects here)
**Generation under test:** 202610270024 (variant E, v9.162). The module is `atlas/modules/202610270024-uk-lightning-overlay.js`, 24,780 bytes, sha256 `2976cae7…f890bf`.

The quoted text below comes from the module itself. It was run against the real feed `Ventusltd/lightning@4b35a6c:data/uk_lightning.geojson`, which has 408 flashes from 2026-10-21 12:32:19 UTC to 2026-10-25 11:15:58 UTC. That feed run had query end 2026-10-27 00:27 UTC. The earlier run 38f2126, with query end 2026-10-26 20:30 UTC, held the same 408 flashes. The test used phone mode: iPhone, coarse pointer, 10,000-point cap. Runner and outputs: `captions.mjs` and `out/` in this folder.

## Before you start (1 minute)

- **Use Safari itself.** Your 26 Oct screenshots came from an in-app browser. If you have time, repeat step 7 in that in-app browser as well.
- **UK time is UTC.** Clocks went back on 25 Oct, so the time on your phone is the UTC time the captions use.
- **Write down the time** you start.
- **These things will differ from this sheet, and none of them is a failure:**
  - The **Refresh** line shows a time later than "2026-10-27 00:27 UTC". The feed refreshes every few hours.
  - The label and status line end in **" STALE"**. That is the correct behaviour whenever the Refresh time is more than 4 hours before now.
  - The Refresh line says "latest detection" with a time later than **2026-10-25 11:15:58 UTC**. That means new lightning has arrived and the counts here are out of date. Note it in the RESULT block; we will recompute.
- **The phone shows one space** where this sheet's code shows two ("Window  …").

## Part A: the preview URL

**1. Original map unchanged (OFF by default).**
Open the preview. Wait for the map, centred on Great Britain. On a phone the panel starts closed, and the button at the bottom right reads **"▴ LAYERS"**. The top menu reads File, Edit, View, Scope, Grid, About.
**FAIL if** you see any of these:
- yellow dots on the map
- "GRIDATLAS COMPOSITION FAILED"
- a different menu, basemap or starting view from the live URL (open it in a second tab to compare)

**2. The new row exists and is OFF.**
Tap **▴ LAYERS**. The button becomes **"▾ HIDE LAYERS"**. Scroll the Layers panel to the very bottom. The last group is titled **"WEATHER · EUMETSAT LIGHTNING IMAGER"**. It has one unticked box labelled:
`Lightning Flashes (Optical) [WAIT]`
No chips and no caption appear under it. The groups above it look and are ticked exactly as on the live URL.
**FAIL if** any of these happen:
- the box is already ticked
- chips or caption text show while it is unticked
- any original group has moved, vanished or changed its ticks

**3. No lightning row in the Grid menu.**
Tap **Grid** in the top menu and scroll its whole list. Then close it.
**FAIL if** any row mentions Lightning, Weather or EUMETSAT.

**4. Switch ON: check the feed-mode wording (default 24H).**
Tick the box. You will briefly see `[LOAD]` and `LOADING`. Then, with **24H** highlighted:
- Label: `Lightning Flashes (Optical) [UNKNOWN | 24h]`
- Status line (orange dot): `UNKNOWN · 0 seen in the available 7-day feed · 24 hours requested · searched unknown`
- `Window 2026-10-26 hh:mm UTC → 2026-10-27 hh:mm UTC (24 hours, latest)`. Here hh:mm is now; the start is exactly 24 h earlier.
- `Actual none seen in the available 7-day feed for this window (unknown, not zero)`
- `Flashes 0 seen in the available 7-day feed · 24 hours requested`
- `Refresh live feed 2026-10-27 00:27 UTC (last collection window 2026-10-26 21:27 UTC → 2026-10-27 00:27 UTC; latest detection 2026-10-25 11:15:58 UTC; 7-day retention; archive not yet published: HTTP 404; earlier hours unknown, not zero)`
- `Searched EUMETSAT unknown (live feed records only its last collection window)`
- Footer: `Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5`

**◀ PREV**, **LATEST** and **NEXT ▶** are all greyed out. That is correct: there is no archive to step through.

**FAIL if** anything implies zero lightning or a known search. That means any of these:
- "EMPTY"
- "NO FLASHES DETECTED"
- "SEARCHED 100%"
- a percentage after "Searched EUMETSAT"
- "0 lightning"
- the status line still reads in the old style, for example "PARTIAL · 3 FLASHES DRAWN · SEARCHED UNKNOWN". That would mean you are on the old preview 202610262323.

**5. Each chip, 12H to 12M.**
Tap each chip in turn. Only the tapped chip is highlighted.
- **Window line:** the end is now and the start is now minus the period. For 3M, 6M and 12M the start has the same day and time, 3, 6 or 12 months earlier. For example, at 2026-10-27 14:00 UTC the 12M line reads `Window 2025-10-27 14:00 UTC → 2026-10-27 14:00 UTC (12 months, latest)`.
- **Refresh, Searched and footer:** the same as in step 4 for every chip.

| Chip | Label | Status line | Flashes line (start) | Yellow warning line | Dots on map |
|---|---|---|---|---|---|
| 12H | `[UNKNOWN \| 12h]` | `UNKNOWN · 0 seen in the available 7-day feed · 12 hours requested · searched unknown` | `Flashes 0 seen in the available 7-day feed · 12 hours requested` | none | none |
| 24H | `[UNKNOWN \| 24h]` | same, with `24 hours` | same, with `24 hours` | none | none |
| 48H | see the 48H note below | | | none | |
| 7D | `[≥408 \| 7d]` | `PARTIAL · 408 seen in the available 7-day feed · 7 days requested · searched unknown` | `Flashes 408 seen in the available 7-day feed · 7 days requested · 408 drawn as points (live feed count 408 within the 10,000-point cap for this phone)` | none | many, UK-wide |
| 30D | `[≥408 \| 30d]` | `PARTIAL · 408 seen in the available 7-day feed · 30 days requested · older history unknown · searched unknown` | `Flashes 408 seen in the available 7-day feed · 30 days requested · older history unknown · 408 drawn as points (…10,000-point cap for this phone)` | `archive not yet published: earlier coverage unknown, not zero` | same 408 |
| 3M | `[≥408 \| 3m]` | as 30D, with `3 months requested` | as 30D, with `3 months` | same | same 408 |
| 6M | `[≥408 \| 6m]` | as 30D, with `6 months requested` | as 30D, with `6 months` | same | same 408 |
| 12M | `[≥408 \| 12m]` | as 30D, with `12 months requested` | as 30D, with `12 months` | same | same 408 |

For 7D through 12M the Actual line reads `Actual first 2026-10-21 12:32:19 UTC · last 2026-10-25 11:15:58 UTC`. For 12H and 24H it reads the "none seen … (unknown, not zero)" line from step 4.

**48H note.** The window slides with the clock, so the 3 flashes of 25 Oct leave it during today:

| If you check (UTC, 27 Oct) | 48H label | Status line | Actual |
|---|---|---|---|
| before 03:28 | `[≥3 \| 48h]` | `PARTIAL · 3 seen in the available 7-day feed · 48 hours requested · searched unknown` | `first 2026-10-25 03:28:34 UTC · last 2026-10-25 11:15:58 UTC` |
| 03:29 to 04:12 | `[≥2 \| 48h]` | `PARTIAL · 2 seen …` | `first 2026-10-25 04:12:28 UTC · last 2026-10-25 11:15:58 UTC` |
| 04:13 to 11:15 | `[≥1 \| 48h]` | `PARTIAL · 1 seen …` | `first 2026-10-25 11:15:58 UTC · last 2026-10-25 11:15:58 UTC` |
| after 11:16 | `[UNKNOWN \| 48h]` | `UNKNOWN · 0 seen in the available 7-day feed · 48 hours requested · searched unknown` | `none seen … (unknown, not zero)` |

**If you check on 28 Oct after 12:32 UTC,** 7D starts losing the oldest flashes (407 at 13:00, 393 at 18:00). Record what you see; that is not a failure.

**FAIL if** any of these happen:
- a count differs from this sheet while "latest detection" still reads 2026-10-25 11:15:58 UTC
- 30D–12M lack "older history unknown" or the yellow warning
- any label shows a bare number without "≥"
- 7D–12M draw no dots
- 12H/24H draw dots

**6. The "outside the current view" count (the 3 western-Scotland flashes).**
The 3 flashes are at about 55.37N 4.21W (Ayrshire), 55.31N 5.44W (Kintyre/Arran) and 55.16N 4.49W (Galloway). The count is taken when a chip is tapped. **Panning alone does not update it**; tap the chip again after moving the map.

- **6a. If it is before 03:28 UTC,** use **48H**. Otherwise use **CUSTOM**:
  1. Tap **CUSTOM**.
  2. Set both **From (UTC)** and **To (incl.)** to **25 Oct 2026**.
  3. Tap **APPLY**.

  You should see:
  - Label `Lightning Flashes (Optical) [≥3 | custom]`
  - Status line `PARTIAL · 3 seen in the available 7-day feed · Custom UTC dates requested · searched unknown`
  - `Window UTC dates 2026-10-25 to 2026-10-25 inclusive = 2026-10-25 00:00 UTC → 2026-10-26 00:00 UTC`
  - `Actual first 2026-10-25 03:28:34 UTC · last 2026-10-25 11:15:58 UTC`
- **6b. Whole of Great Britain on screen** (the starting view): the Flashes line ends `… 3 drawn as points (live feed count 3 within the 10,000-point cap for this phone)` with **no** "outside the current view". Zoom in on south-west Scotland to see 3 small yellow dots. They are tiny at the starting zoom.
- **6c.** Pinch the map to zoom into London so that Scotland is off screen. Tap **APPLY** (CUSTOM) or **48H** again. The Flashes line now ends `· 3 of 3 outside the current view`.

**FAIL if** any of these happen:
- 6b shows "outside the current view" while all of Scotland is on screen
- 6c lacks `3 of 3 outside the current view`
- you cannot find the dots at all after zooming into south-west Scotland

The count measures the whole map area, including the part behind the Layers panel. Dots hidden behind the panel therefore count as "in view", and that is not a failure.

**7. Every caption line readable above HIDE LAYERS: panel.**
Tap **12M**. This gives the longest caption, including the yellow warning. Scroll the Layers panel slowly to the very bottom. Read, in order:
- the status line
- Window
- Actual
- Flashes
- Refresh
- Searched
- the yellow warning
- the footer, which ends with `UK box −11.0,49.5 → 3.0,61.5`

Each line must be fully visible, wrapped inside the panel, and **above or left of the "▾ HIDE LAYERS" button**. Nothing may sit under the button or be cut at the right edge. The text is readable light grey at about 12 px. Turn the phone to landscape and back, then re-check the last 3 lines.

**FAIL if** any of these happen:
- any word of any line is hidden by HIDE LAYERS
- any word is cut off
- the footer can't be scrolled into view
- a tap on the bottom caption lines toggles the panel instead
- the text is too faint to read

Take a screenshot either way.

**8. The same check in fullscreen.**
1. Tap the map's **⛶** fullscreen button.
2. Tap the **"⬇ LAYERS"** tab at top centre.
3. Scroll the dropped-down panel to the bottom.

The lightning group is last. Its box is **ticked**, **12M** is highlighted, and the caption text is identical to step 7. The **"▾ HIDE LAYERS"** button can still show at the bottom right on iPhone. Repeat the line-by-line check from step 7, then tap **✕ Exit**.

**FAIL if** any of these happen:
- the box or chip state differs from the panel
- any caption line is hidden or cut
- the footer is unreachable

Take a screenshot.

**9. OFF again.**
Untick the box in the panel. The label returns to `Lightning Flashes (Optical) [WAIT]`. The chips and caption disappear, and **every yellow dot vanishes**. Re-enter fullscreen: its box is unticked too. Reload the page: the box is still unticked.

**FAIL if** any of these happen:
- any dot remains
- the box is ticked after reloading
- any other layer's tick or the map view changed because of lightning

## Part B: the live URL

**10a. Before release** (live still on generation 202609241334): open the live URL, tap **▴ LAYERS** and scroll to the bottom. There must be **no** "WEATHER · EUMETSAT LIGHTNING IMAGER" group, and the Grid menu has no lightning row.
**FAIL if** lightning appears on live before the release is announced.

**10b. After release:** repeat steps 1–9 on the live URL. Every quoted string must be identical, except for the time-dependent parts named above.

## RESULT (copy, fill in, paste back)

```
OWNER PHONE CHECK – lightning 202610270024
Date/time started (UTC = UK time):
iPhone model / iOS version:
Browser (Safari / in-app: which app):
Preview URL tested:   yes / not yet merged
Live URL state:       before release (10a) / after release (10b)
Refresh line time shown:            latest detection shown:
STALE shown? yes/no

1  Original map unchanged, OFF by default ......... PASS / FAIL:
2  Row last in Layers, unticked, [WAIT] ........... PASS / FAIL:
3  No lightning row in Grid menu .................. PASS / FAIL:
4  Feed-mode wording (UNKNOWN, searched unknown,
   archive not yet published: HTTP 404) ........... PASS / FAIL:
5  Chips 12H 24H 48H 7D 30D 3M 6M 12M
   counts seen: 12H=  24H=  48H=  7D=  30D=  3M=  6M=  12M=
   ................................................ PASS / FAIL:
6  Outside-view: used 48H / CUSTOM 25 Oct
   whole-GB view suffix absent? yes/no
   London view shows "3 of 3 outside the current view"? yes/no
   ................................................ PASS / FAIL:
7  All caption lines readable above HIDE LAYERS (panel)
   portrait / landscape ........................... PASS / FAIL:
8  Same in fullscreen curtain ..................... PASS / FAIL:
9  OFF again, dots gone, still OFF after reload ... PASS / FAIL:
10 Live URL (10a no lightning / 10b identical) .... PASS / FAIL:
Screenshots attached (steps 7, 8, any failure):
Anything else odd:
```
