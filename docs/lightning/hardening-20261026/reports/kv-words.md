# kv-words: plain wording for the lightning label, status line and caption lines 1–2

Node only. Patched copy: `evidence/kv-words/module-I-words.js` (35,279 B, sha256 f808580a…, **+1,656 B**, cap 44,781 B, 9,502 B spare). Edits: `edits.mjs`. Before/after samples on the real archive (`2a49652`: 29 searched days, 1,480 flashes) at 13:45 and 15:00 UTC: `samples-*.txt`.

## Findings

1. **The owner's screenshot is reproduced exactly.** With the real index at 13:45 UTC, I renders `[≥1,480 | 30d STALE]` and `PARTIAL · 1,480 FLASHES DRAWN · SEARCHED 88% · STALE`.
2. **STALE at 13:45 came from `now>x.nextDue` (line 47), not from a 4 h age.** The index was generated at 10:43 and `next_update_due_utc` was 13:43, so the flag was set 3 h 02 min after the last run. The new rule shows the collector time only when the run is more than 4 h old (W2).
3. **"30 days" touches 31 UTC days.** The window runs 27 Sep 13:45 → 27 Oct 13:45, and counts are made per whole UTC day. So the honest figure is "29 of 31 days", not "of 30" (and 3M is "of 93", not "of 90"). The Window line gives the exact times, which makes this checkable.
4. **PREV pages share their boundary date.** For example, 27 Sep is in both the 30D page and its PREV page. Overview sums are whole-day sums, so that date's flashes appear on both pages. The wording says "days", not "in window", so it stays true. Fixing the sums themselves belongs to another lane.

## Grammar (all states)

- **Label**: `Lightning Flashes (Optical) [<count> | <scope>]`. This is the shell's `[count | quantity]` convention. The period token (`30d`) and `STALE` are removed. The active chip already shows the period.
- **Status line** (caps): `<COUNT FLASHES> · <SCOPE>[ (N IN PART)][ · COLLECTOR LAST RAN HH:MM UTC]`. The state words PARTIAL, READY and SEARCHED n% are gone. The dot colour still carries the state, and `S.last.state` is unchanged.
- **Caption line 1** (`window`): `Window  <period> · d Mon HH:MM → [d Mon ]HH:MM UTC · latest|earlier page` (the year appears only if it is not the current year).
- **Caption line 2** (new `days` slot, bold, coloured like the status dot): which days or hours were searched, and which were not, with "(unknown, not zero)".
- **Short windows (12H, 24H, 48H)** count hours, because whole days would mislead there. **7D and longer, and CUSTOM,** count UTC days.
- **Stale**: shown when the collector's last run is more than 4 h old: `COLLECTOR LAST RAN 10:43 UTC`. A run on an earlier date adds the date (`26 Oct 08:55`). Clock skew of more than 15 min adds `(DEVICE CLOCK BEHIND)`. No timestamp gives `COLLECTOR LAST RUN UNKNOWN`. The Refresh line's `STALE` becomes `overdue`.
- **Rules applied**: no `≥`, and no percentages in these four strings. Honesty phrases kept: "optical", "unknown, not zero", "searched unknown", "NO FLASHES DETECTED" (only at full coverage), and "never searched".

## Spec by state (real outputs from samples-module-I-words.txt)

| State | Label `[…]` | Status line | Caption 1 | Caption 2 |
|---|---|---|---|---|
| **Feed only** (archive 404), ≤7D | `[444 \| live feed]` | `444 FLASHES · LIVE 7-DAY FEED · SEARCHED UNKNOWN` | `Window  7 days · 20 Oct 13:45 → 27 Oct 13:45 UTC · latest` | `Live 7-day feed · archive not yet published · hours searched unknown` |
| Feed only, 30D–12M | `[444 \| last 7 days only]` | `444 FLASHES · LAST 7 DAYS ONLY · OLDER NOT YET COLLECTED` | `Window  12 months · 27 Oct 2025 13:45 → 27 Oct 13:45 UTC · latest` | `Last 7 days only (live feed) · archive not yet published · earlier days unknown, not zero` |
| **Archive, partial**, days | `[1,480 \| 29 of 31 days searched]` | `1,480 FLASHES · 29 OF 31 DAYS SEARCHED (9 IN PART)` | `Window  30 days · 27 Sep 13:45 → 27 Oct 13:45 UTC · latest` | `29 of 31 days searched (29 Sep–27 Oct, 9 in part) · 2 not yet searched (unknown, not zero)` |
| Archive, partial, hours | `[29 \| 8 h 35 min of 12 hours searched]` | `29 FLASHES · 8 H 35 MIN OF 12 HOURS SEARCHED` | `Window  12 hours · 27 Oct 01:45 → 13:45 UTC · latest` | `Searched 8 h 35 min of 12 hours (27 Oct 01:45 → 10:20 UTC) · 3 h 25 min not searched (unknown, not zero)` |
| **Full coverage** | `[28 \| all 4 days searched]` | `28 FLASHES · ALL 4 DAYS SEARCHED` | `Window  UTC dates 2026-10-01 to 2026-10-04 inclusive (4 days)` | `All 4 days searched (1 Oct–4 Oct)` |
| **Stale collector** (>4 h) | unchanged | `… · COLLECTOR LAST RAN 10:43 UTC` | unchanged | unchanged |
| **Index unavailable** (not 404) | `[444 \| live feed]` | as feed only | as feed only | `Live 7-day feed · archive unavailable: <reason> · hours searched unknown` |
| **Window before archive** (no searched day) | `[UNKNOWN \| 0 of 92 days searched]` | `UNKNOWN · 0 OF 92 DAYS SEARCHED` | `Window  3 months · 27 Apr 13:45 → 27 Jul 13:45 UTC · earlier page` | `None of the 92 days searched yet (unknown, not zero) · archive starts 29 Sep` |
| Before 1-year retention (`r.before`) | `[UNKNOWN \| before archive]` | `UNKNOWN · BEFORE ARCHIVE (FROM 27 OCT 2025)` | `Window  UTC dates 2025-01-01 to 2025-01-31 inclusive (31 days)` | `Before the 1-year archive (from 27 Oct 2025): never searched (unknown, not zero)` |
| **PREV pages** | same grammar | same grammar | `… · earlier page` (for example `Window  30 days · 28 Aug 13:45 → 27 Sep 13:45 UTC · earlier page`) | same grammar |
| **CUSTOM** | same grammar (no `\| custom`) | same grammar | `Window  UTC dates 2026-10-10 to 2026-10-20 inclusive (11 days)`. Today gives `(1 day, to now)` | `11 of 11 days searched (10 Oct–20 Oct, 4 in part)` |

Zero flashes reads `none found` when coverage is partial and `NO FLASHES DETECTED` at full coverage. 12M reads `29 of 366 … · 337 not yet searched`. FAIL is unchanged. Overview mode, and days that were skipped or failed, use the index sum; otherwise the count is the flashes drawn. This removes the old "≥".

**Fit at 393 px** (about 46 characters per line): the label is at most 2 lines, the status line at most 2 lines, and caption 2 is 2 lines (3 when it carries an index error).

## Code map (fixed-module-I.js lines; deltas from edits.mjs)

| Edit | Line | Δ B | What |
|---|---|---|---|
| W1 | 19 | +774 | Helpers: `pl` plural, `dm` "29 Sep[ 2025]", `hm` HH:MM, `dt`, `du` "8 h 35 min", `hz` hour mode, `de` end time, `sv` scope phrase, `lr` collector phrase |
| W2 | 47 | −23 | `stale=(g,now)=>!(now-g<=4*HOUR&&g<=now+9e5)` (drops `now>x.nextDue`) |
| W3/b/c | 50, 52, 53 | +87 | `cv` adds `k` (searched days), `fs`/`lz` (first and last searched date) and `pp` (part-searched days) |
| W4 | 96 | +26 | `cf` exposes collector time `g` |
| W5 | 98–99 | +1,015 | `cp`: new `L.days` (caption 2), rewritten `L.window` (caption 1). `notice` retired |
| W6 | 108 | −147 | Feed bold notice text removed (now in caption 2) |
| W7 | 115 | +6 | Refresh `· STALE` becomes `· overdue` |
| W8 | 174 | −18 | Caption order `window, days, actual, …`. `days` is bold |
| W9 | 181–182 | −2 | `lt` label, plus `fn` count rule |
| W10 | 183–184 | −103 | `sl` status line, caps via `toUpperCase()` (FAIL reasons excluded) |
| W11 | 193 | +41 | Caption 2 colour = `c.colour` |
| **Total** | | **+1,656** | 33,623 → 35,279 B |

## Tests

85/91 pass. The 6 failures all pin the old words, and each needs a one-line rewrite:

- **H02/F4 (128) and T11 (474)**: `x.label() /STALE/` becomes `x.status() /COLLECTOR LAST R[AU]N/`. `S.last.stale` still asserts.
- **F6 (192)**: `/\[≥?1 \| 7d\]/` becomes `/\[1 \| live feed\]/`.
- **R04 (218)**: `/\| custom/` becomes `/^Window  UTC dates/` on `cap('window')`.
- **H1 (755–761, 770)**: the label becomes `[1 | last 7 days only]` and the status becomes `1 FLASH · LAST 7 DAYS ONLY · OLDER NOT YET COLLECTED`. The `notice` assertions move to `cap('days')`, with the bold style checked on `children[1]`.

Not done: the lower `Searched EUMETSAT n% of window` line keeps its percentage (it is qualified, and tests pin it).
