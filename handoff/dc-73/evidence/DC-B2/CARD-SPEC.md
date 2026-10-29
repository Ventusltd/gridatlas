SPEC READY

# DC-B2 · Data-centre tap: card and map spec (Grid Engine 30/30/30)

Lane DC-B2 (Team B), issue #73 step 8. This is a design plus a node prototype; no browser was run. Written 29 Oct 2026, 20:00 UTC.

Builds on the live offtakers card (`tools/offtakers/src/05-card-camera.js`, `06-tap-card.js`) and reuses its dock, its 44 px controls, `cq()` CSV escaping, `RG`/`near`/`RpH` (the M5/M6 REPD record join) and its camera guard (`cm`/`cw`). Only a tap on a data-centre dot (class `c`) opens this card. All other classes keep the existing `oc()` card.

## 0. Measured facts the design rests on (node prototype)

Run: `node evidence/DC-B2/proto.mjs <grid_substations.geojson> <repd_master.json> <offtakers_filtered_202610290945.geojson>`. Output is in `proto-output.txt`, per-site rows in `proto-sites.json` and input hashes in `inputs.sha256`.

The prototype used:
- **Substations:** 5,800 qualifying (≥ 33 kV) from the engine's own pinned `data/grid_substations.geojson`.
- **REPD:** 9,636 sites (10,784 projects), grouped per point.
- **Conventional:** 358 offtakers class-B power stations, as a proxy until the step-5 dataset (DUKES 5.11 / GPPD) lands.
- **Tap points:** the 164 data-centre sites (offtakers class C).

| Measure (164 sites) | Median | P90 | Max |
|---|---:|---:|---:|
| 10th substation, km | 5.4 | 11.2 | 23.0 |
| 30th substation, km | 11.9 | 20.7 | 39.8 |
| 10th REPD site, km | 4.2 | 7.5 | 23.0 |
| 30th REPD site, km | 8.9 | 13.6 | 39.6 |
| Nearest conventional, km | 4.6 | 20.9 | 65.7 |
| 30th conventional, km (no cap) | 51.6 | 120.7 | 275.8 |
| Nearest 400 kV / 275 kV / 132 kV / 33–66 kV, km | 7.8 / 8.1 / 2.3 / 1.2 | 18.9 / 59.9 / 7.6 / 4.0 | |

Consequences:
- **Substations:** for 20 of 164 sites, the 30th substation is more than 20 km away, so the framing rule (§6) must not chase it. One site has fewer than 30 within 40 km.
- **Conventional:** only 27 of 164 sites have 30 conventional sites within 40 km. 137 have fewer (median 19), and 5 have none. The conventional list will often be short, and the card must say so (§4). This may change with the step-5 dataset, so DC-B1 re-measures with `proto.mjs`.
- **Voltage:** 26 sites have no 275 kV substation and 4 have no 400 kV substation within 40 km.
- **Compute:** 3.6 ms per tap in node for three full brute-force scans. Budget 30 ms on a phone; measure in the browser (§10).
- **Payloads:** 90 links plus 90 nodes come to 22.6 KB of GeoJSON. The largest CSV across all 164 sites is 16.8 KB.

## 1. Engine contract (so the 30s are the engine's, not a re-implementation)

**Substations.** The original `link.measure.nearestSubstations` is fixed at `LINK_COUNT = 5` within `MAX_LINK_KM = 40`, so it cannot return 30.
- `nearest30(x, y, subs, band)` scans the same `__GRIDATLAS_NEON_LINKS__.substations` list with the same `measure.distanceKm`, the same 40 km cap and the same sort.
- **Parity test (required):** for every one of the 164 sites, `nearest30(...).slice(0, 5)` deep-equals `nearestSubstations(x, y, subs)` (same objects, same km).
- **Voltage band** (§4 chips) filters on `kv[0]` (highest voltage): 400 = ≥ 400; 275 = 275–399; 132 = 132–274; 33–66 = 33–131.

**REPD.** The existing `RG()` register and `near()` grouping are used with `NR = 30` for this card only. The offtakers card keeps 15. The M6 record join (`RpQ`/`RpB`/`RpJ`, from `11b-repd-records.js` and `04-repd-record-m5.js`) is unchanged.

**Conventional.** This uses the step-5 dataset when it lands, with the same 40 km cap and nearest 30, keeping status and MW as stated.

**Area summary counts (§5)** come from the full scan, not from the 30 list. "Within 10 km" is therefore never capped at 30, and no "30+" appears.

**One cap everywhere: 40 km.** Nothing beyond 40 km is listed or drawn, which matches the engine's "beyond this, silence is more honest". If a set has no entry within 40 km, the card states the nearest one beyond the cap in words (as with `beyondRadiusNearest`). It is never drawn.

## 2. Tabs, not sections

**Decision:** four tabs, `Area · Substations · REPD · Conventional`.

**Why not sections:** at 52 px a row, 90 rows are 4,680 px, which is 9 screens of the 524 px expanded card before any REPD record opens. With tabs, at most 30 rows are in the DOM at once. Each tab panel is rendered on first open, not on tap.

**Tablist markup:**
- `role="tablist"`, `aria-label="Data-centre vicinity sets"`;
- each tab has `role="tab"`, `aria-selected` and `aria-controls`; each panel has `role="tabpanel"` and `aria-labelledby`;
- ← → move between tabs, Home and End jump to the ends, and selection follows focus.

**Default tab: Area.** The tab bar is always visible, including in the collapsed (peek) card, and doubles as the summary: each tab shows its count and reach.

Tab labels: two lines, 11 px monospace, centred.

| Tab | Line 1 | Line 2 (examples) |
|---|---|---|
| Area | `Area` | `5·10·20 km` |
| Substations | `Substations` | `30 · ≤20.7 km` |
| REPD | `REPD` | `30 · ≤8.9 km` |
| Conventional | `Conventional` | `19 · ≤40 km` |

- Line 2 is `{n listed} · ≤{km of the farthest listed, 1 dp} km`.
- When the count is 0: `none ≤40 km`.
- While loading: `…`.
- On failure: `unavailable`.

## 3. Pixel budget at 393 × 852 (CSS px)

Card width is `min(480, 393 − 16) = 377`. The inner width, with 8 px padding, is 361. A monospace 11 px character is about 6.6 px, so one line holds **54 characters**. Every fixed string below is at most 54 characters per line unless it is marked as wrapping. Headings with `{n}` and names may wrap; give them 32 px.

### Peek state (default after a tap; the details are collapsed)

| Block | Height | Content |
|---|---:|---|
| Bar | 44 | Title (≤ 38 characters, ellipsis), then the `−` and `×` buttons, 44 × 44 each |
| Gap | 6 | |
| Site line | 16 | `{name} · {operator or "operator not listed"}`, one line with ellipsis |
| Site MW line | 16 | §7 wording, one line with ellipsis; the full text is in the details |
| Gap | 6 | |
| Tab bar | 52 | 4 tabs, each 86 × 52 (≥ 44 × 44), 3 px gaps: 4 × 86 + 3 × 3 = 353 ≤ 361 |
| Gap | 6 | |
| Caption | 32 | Two lines: `Straight lines only: not cable routes, capacity` / `or connection offers. Pipeline ≠ commitment.` |
| Bottom padding | 8 | |
| Border | 2 | |
| **Total** | **188** | |

**Camera band:** with the card docked 8 px above the bottom, the free map band is:
- top inset 150 (the existing `ck` T);
- bottom inset 8 + 188 + 24 = 220;
- left and right insets 40.

That gives a band of **313 × 482 px**. It is width-limited, so the half-short side is **156 px**. The camera rule in §6 uses 156.

### Expanded state (a tab is open)

- **Height:** the existing `cpos` rule, `max(240, min(H − t − 8, H − 8 − 320))`. At 852 with t = 60, the maximum is **524 px**.
- **Sticky top, 140 px:** bar 44 + 6 + site 16 + MW 16 + 6 + tab bar 52. It stays put while the panel scrolls.
- **Scroll region, 384 px:** about 7 rows.
- **Rows:** 52 px each (12 top padding, 16 line 1, 16 line 2, 8 bottom). The whole row is one link and the tap target.
- **Panel controls:** the voltage chips row (Substations tab only) and the reveal button are each 44 px high, full width.
- **Camera:** the camera does not move on expand or collapse. The map band shrinks to 146 px while the card is expanded, and that is accepted. `−` or tapping the open tab again returns the card to peek.

### Safari check

In Safari with its toolbars, the viewport is about 393 × 660, so H = 660:
- expanded maximum is `max(240, 660 − 328) = 332 px`, so the scroll region is 192 px, about 3.5 rows;
- peek stays at 188 px, so the band is 313 × 290 and the half-short side is still 145 px;
- the zooms in §6 drop by `log2(156/145) = 0.1`, which is acceptable.

## 4. List rows, reveal and wording per tab

### Progressive reveal (per set; state lives in the card and is never persisted)

1. **On open:** the nearest **10** of each set are drawn (up to 30 links) and listed.
2. **At the foot of each set's 10 rows:** a 44 px button reading `Show all {n} on the map and in this list`, where n = the number listed within 40 km. It is hidden when n ≤ 10.
   - Pressing it lists and draws all n for that set.
   - The button then reads `Show nearest 10 only`.
3. **Area tab:** the button `Draw all {N} links` (N = total listed across the three sets) reveals all three sets.
4. **Short set** (n < 30): the line under the tab panel heading reads `Only {n} {set noun} within 40 km of this site; all are listed.`
   - The set nouns are `substations ≥33 kV`, `REPD sites` and `conventional power sites`.
   - When n = 0: `None within 40 km. Nearest: {name}, {km} km (not drawn).`

### Substations tab

**Heading line** (colour `#ffccee`):
`Screening · {n} nearest substations ≥33 kV (straight line)` (wraps to 2 lines when n ≥ 10; allow 32 px)

**Voltage chips** (44 px, `aria-pressed`): `All · 400 · 275 · 132 · 33–66 kV`. A chip re-ranks the nearest 30 within that band from the full scan.

**Row:**
- Line 1: `{rank}. {km 2dp} km · {kV max} kV · {name or "unnamed substation"}`
- Line 2: `{other kV, e.g. "also 132, 33 kV" or "single voltage"} · OSM ▸`

A row tap uses the existing `pv`-style sub-card, which shows that substation and its own 5 nearest REPD projects. It has the `◀ back to data centre` button.

**Caption:** `Mapped substations (OpenStreetMap, ODbL 1.0). Not capacity, headroom or a connection point.`

### REPD tab

**Heading line** (colour `#88aa00`, text `#c6dd7a` for 4.5:1 on `#000`):
`Screening · {n} nearest REPD sites{ (m projects; those at one point grouped)}, straight line`

**Status chips:** the existing `RpF.st` set, `All · Operational · Consented · Planning`.

**Row:**
- Line 1: `{rank}. {km} km · {tech} {MW stated} MW · {status as registered}`
- Line 2: `{name}{ · capacity not stated} ▸`

A row tap uses the existing `pv()` REPD sub-card with the full M6 record and `◀ back to data centre`. **Records are joined on row tap and for the CSV, not for all 30 at open.**

**Caption:** `REPD (DESNZ, OGL v3.0). Status as registered, not as built. MW is installed capacity as registered, not export or connection capacity.`

### Conventional tab

**Heading line** (colour `#999988`, text `#c9c9bb`):
`Screening · {n} nearest conventional power sites, straight line`

**Row:**
- Line 1: `{rank}. {km} km · {fuel/type} · {MW stated} MW · {status}`
- Line 2: `{name} · {source short name} ▸`
- When MW is unknown, line 1 reads `· MW not stated ·`.
- A closed, closing or converted station adds `· no connection rights implied` to line 2.

**Same plant in two sets:** if a conventional site is within 300 m of a REPD site with the same fuel family (biomass, EfW, landfill gas), both rows get line 2 suffix `· also in {REPD|Conventional} list`. This is discovery-tier: the rows are never merged and never double-counted in the MW sums (§5).

**Caption:** `{dataset name, licence}. MW is installed capacity as stated by the source, not export or connection capacity. Proximity to a power station is not access to its output or its grid connection.`

## 5. Area tab (summary)

This is the default panel. Exact layout: monospace, column widths 20 + 3 × 11 = 53 characters. The numbers below are illustrative, not from a real site.

```
Within (straight line)     5 km      10 km      20 km
Substations ≥33 kV            8         22         61
  of which ≥275 kV            1          2          4
REPD projects                12         41        198
  MW stated              145 MW     410 MW   2,310 MW
  not stated                  2          5         19
Conventional sites            1          1          5
  MW stated               48 MW      48 MW   1,620 MW
  not stated                  0          0          1
```

**Count rules:**
- Counts and MW come from the full scan within each radius, so they are not limited to 30.
- REPD MW counts operational, consented and planning together, de-duplicated as `RpW` does.
- Below the table, one line splits REPD MW at 20 km by status: `REPD at 20 km: operational {MW} · consented {MW} · planning {MW}`.
- Conventional MW at 20 km is split the same way: `Conventional at 20 km: operating {MW} · closing/closed {MW}`.
- A count of 0 prints `0`. An MW cell where nothing is stated prints `–`, never `0 MW`.

**Nearest by voltage** (4 lines, colour `#ffccee` bullet):

```
Nearest 400 kV   7.84 km · {name}
Nearest 275 kV   8.10 km · {name}
Nearest 132 kV   2.31 km · {name}
Nearest 33–66 kV 1.20 km · {name}
```

When a voltage has nothing within 40 km: `Nearest 275 kV   none ≤40 km (59.9 km, not drawn)`.

**Legend** (one row per set, each with its line sample drawn in CSS):
- `━ Substations (rose, solid)`
- `╍ REPD sites (olive, dashed)`
- `┈ Conventional (grey, dotted)`
- `◯ 5 · 10 · 20 km rings`

**Captions** under the table (all wrap; colour `#8b9aa1`):
1. `Counts within straight-line circles around the site point. Not cable routes, capacity, headroom or connection offers.`
2. `MW is installed capacity as each register states it, not export or connection capacity. Supply MW is never added to the site's MW.`
3. `Not stated is unknown, not zero.`

**Download button** (44 px): `Download all {N} as CSV (vicinity sheet)`. The same button appears at the foot of every tab.

## 6. Map treatment

### Colours per set

The colours come from a CIEDE2000 search over sRGB in the prototype. Each is at least 20 ΔE from every existing map colour (lightning violet ramp, REPD tech and status colours, substation cyan, offtakers palette, pin azure, text colours). They stay at least 20.7 apart under simulated protanopia and deuteranopia, and each is at least 7:1 on black.

| Set | Line / node | Text on `#000` | Nearest existing colour, ΔE | Dash | Node |
|---|---|---|---|---|---|
| Substations | `#ffccee` rose | `#ffccee` | `#e8eef9`, 20.2 | solid | filled circle |
| REPD sites | `#88aa00` olive | `#c6dd7a` | `#39ff14`, 22.2 | `[2, 2]` | filled circle, `#000` 1 px stroke |
| Conventional | `#999988` smoke grey | `#c9c9bb` | `#5fbdc2`, 22.7 | `[0.5, 2]` round cap | hollow ring, 2 px |

Pairwise ΔE between the set colours is 58.0, 34.8 and 22.5. Colour is never the only cue: each set also has its own dash, its own node shape and a tab and legend label.

**Rings:** 5, 10 and 20 km circles in `#8b9aa1`, opacity 0.45, width 1, dash `[3, 3]`. Each has a 10 px label at north: `5 km`, `10 km`, `20 km`.

### Layers

There are 12 layers on two link sources plus the pin and rings. All carry their own ids, prefix `gridatlas-offtakers-dc-*`, and are cleared by `nc()`.

| Source | Layers |
|---|---|
| Link lines (`properties: set, rank, km, drawn`) | glow (data-driven colour); core ×3 (one per set; filtered, because `line-dasharray` is not data-driven); flow (selected set only) |
| Link nodes | node; label |
| Rings | ring lines; ring labels |
| Pin | halo; pin (existing azure) |

- **Tab switch:** `setPaintProperty` changes opacity only. The selected set is 0.9 and the others 0.3. The Area tab shows every set at 0.7. No `setData` is called on a tab switch.
- **Reveal:** `setData` on the two link sources (≤ 22.6 KB).
- **Flow dash:** runs on the selected set only (≤ 30 lines). It is off under `prefers-reduced-motion`.

### Labels

1. Only the selected tab's set is labelled. The Area tab labels rank 1 of each set (3 labels) plus the rings.
2. **Substations tab:** ranks 1–3, plus the nearest drawn 400 kV, 275 kV and 132 kV if they are not already labelled (at most 6).
3. **REPD tab:** ranks 1–3, plus the largest stated MW among those drawn (at most 4).
4. **Conventional tab:** the same rule as the REPD tab (at most 4).
5. **Hard cap:** 6 link labels. The label settings are:
   - `text-size` 10, `text-allow-overlap` false, `symbol-sort-key` = rank (the nearest wins a collision);
   - `text-halo-color #000c10`, `text-halo-width` 1.5;
   - text colour = the set's text colour.
6. **Label text** is at most 22 characters (about 132 px at 10 px):
   - substation: `400 kV · 7.84 km`
   - REPD: `Solar 49.9 MW · 1.20 km`
   - conventional: `CCGT 1,365 MW · 6.84 km`
   - when MW is not stated, the MW is dropped: `Wind · 3.10 km`

### Camera

The site is held at the centre of the free band. The camera does an `easeTo` to the site with padding equal to the band insets (§3) and `zoom = clamp(7.5, 13, log2(78271.517 · cos(lat) · 156 / (r · 1000)))`, with r in km and a minimum of 2 km. A zoom of 7.5 is the 40 km cap at 52° N.

**Initial radius:** r₀ = max(10th substation km, 10th REPD site km, nearest conventional km).
- Measured zoom: median **10.08**, P10 8.56, maximum 11.46.
- For comparison, framing all 90 would give a median zoom of 7.62 and pin every London site at the 40 km clamp. Framing the nearest 10 of each set gives 8.31.

**After `Show all {n}` for a set:** the camera refits to r = max(current r, that set's farthest listed km). For the 20 sites whose 30th substation is more than 20 km away, this lands at about zoom 8.3. That is the only automatic zoom-out.

**Links beyond the view:** if any drawn link ends outside the band, the panel shows `{k} drawn links end outside this view` with a 44 px button `Fit all drawn links`. The button refits to the farthest drawn link (40 km at most, zoom 7.5).

**Motion:**
- `duration` is 900 ms, or 0 under `prefers-reduced-motion`.
- No camera move starts inside another (the existing `cm`/`cw` guard).
- A tab switch never moves the camera.
- A row tap opens the existing sub-card flow (`pv`), which flies to that point at zoom 12. `◀ back` restores the data-centre card, the tab, the reveal state and the camera centre and zoom saved before the row tap.

## 7. Site header wording (IT load vs connection; pipeline)

**Title (bar):** `Data centre (screening)`

**Site line:** `{name} · {operator}`, or `{name} · operator not listed`.

**MW line** (peek, one line; never summed, never derived from one another):

| Case | Wording |
|---|---|
| Both known | `IT load {a} MW · grid connection {b} MW` |
| IT load only | `IT load {a} MW · grid connection not stated` |
| Connection only | `Grid connection {b} MW · IT load not stated` |
| Neither | `IT load and grid connection not stated` |

**Details, first lines:**
1. `Status: {operational | under construction | consented | in planning | connection request | announced} · {source}, {date}`
2. `A pipeline entry is not a commitment: plans change, stall or are withdrawn.`, shown for every status other than operational.
3. `IT load is what the computing equipment draws. Grid connection is the import capacity agreed with the network operator, which also covers cooling and losses. Neither is derived from the other here.`
4. When either MW is missing: `Not stated is unknown, not zero.`
5. When the site came only from OpenStreetMap: `Listed in OpenStreetMap; no open IT-load or connection figure found.`
6. Record line: `Record · {source} ({licence})`, one per merged source, as `LIC()` does.

**Collapsed summary** (screen-reader live region; the `<summary>` text):
`Data centre · {n_s} substations, {n_r} REPD sites, {n_c} conventional within 40 km · details`

**Footer** (`NOTSHOWN`, extended):
`Not shown here: electricity use, connection terms, TEC, queue position, consent, viability.`

## 8. CSV export (all 90, whatever is drawn)

The export always contains every listed row of all three sets, independent of the reveal state and the chips (the substation band chip set to All).

- **Filename:** `datacentre-vicinity-{GEN}-{siteId}.csv`, with `siteId` reduced to `[A-Za-z0-9_-]`, at most 40 characters.
- **REPD records:** at click, the button reads `Preparing… (joining REPD records)` and runs `RpQ` for all listed REPD projects, with a 15 s timeout. If the join fails, rows use the map register and their `source` column says so. The export never blocks on the join.

Comment lines (4), then the header:

```
# GridAtlas data-centre vicinity sheet · generation {GEN} · site {id} {name} · point {lon},{lat} · {ISO time}
# Straight-line distances from the site point. Not cable routes, capacity, headroom, connection offers or feasibility.
# Site: IT load {a MW|not stated} · grid connection {b MW|not stated} ({source}). Never added together. A pipeline entry is not a commitment.
# MW columns are installed capacity as each source states it, not export or connection capacity. "not stated" is unknown, not zero.
set,rank,name,ref,type_or_voltage,status,kv_max,kv_all,mw_stated,mw_basis,km_straight_line,lon,lat,drawn_on_map,source,licence,data_date
```

**Rows:**
- **Site row:** `data centre,0,{name},{id},data centre,{status},,,{IT MW|not stated},IT load,0,...`
- **Second site row,** only when connection MW is known: `data centre,0,...,{conn MW},grid connection,...`. IT load and connection are therefore two rows, never one cell.
- **Substation:** `substation,{rank},{name},,{kV max} kV,,{kv max},"{kv list ;}",,,{km},...,OpenStreetMap as loaded by the map,ODbL 1.0,not carried`
- **REPD project:** one row per project, with REPD sites at one point expanded and sharing a rank. `mw_basis = installed (REPD)`; the source and licence are as the existing `csv()` writes them.
- **Conventional:** `mw_basis = installed ({source})`, licence per record.

**Safety** (the existing R-otsec ORS5 rules via `cq()`):
- `\p{Cf}` is stripped.
- A text cell starting with `= + - @ TAB CR` gets a leading `'`.
- Numbers stay numbers.
- Cells containing `" , CR LF #` are quoted.
- Each cell is capped at 200 characters (`cs()`).
- **Row cap:** 400 rows. **Byte cap:** 256 KB. The measured maximum is 16.8 KB. If a cap is hit, the last row is `# truncated at {cap}`.

## 9. Accessibility

- All targets are at least 44 × 44 px.
- Tab, chip and reveal buttons carry `aria-pressed` or `aria-selected`.
- **Live region**, on tab change and on reveal: `{Set}: {shown} of {n} shown on the map, nearest {km} km.`
- **Focus:**
  - after a reveal, focus stays on the toggled button;
  - after `◀ back`, focus returns to the row that opened the sub-card;
  - Escape closes the card.
- **Contrast:** all text colours are at least 4.5:1 on `#000`: rose 15.1, `#c6dd7a` 14.0, `#c9c9bb` 12.6, `#8b9aa1` 7.2. The raw olive `#88aa00` (7.8:1) is used only for lines and nodes.

## 10. Performance budget (to be measured in the browser by the perf lane)

| Item | Budget | Prototype evidence |
|---|---|---|
| Tap → peek card painted (excluding the REPD register fetch) | ≤ 100 ms on a mid phone | 3.6 ms per tap in node for 3 full scans (15,794 points) |
| Link payload, 90 links | ≤ 32 KB, 2 `setData` calls | 22.6 KB |
| Map layers added | 12 | — |
| DOM rows at once | ≤ 30 plus area table | — |
| REPD record joins | on row tap or CSV only | — |
| Animation | flow on ≤ 30 lines, rAF, off with reduced motion | — |
| CSV | ≤ 256 KB | 16.8 KB maximum |

**Measure on a 4× CPU-throttled 393 × 852 emulation:**
- long tasks on tap;
- frame time with all 90 drawn and flow running;
- heap delta after 20 taps, open and close (this must return to baseline).

## 11. Open items for DC-B1

1. Re-run `proto.mjs` against the step-5 conventional dataset when it lands. The conventional counts and the r₀ median depend on it.
2. `nearest30` needs the parity test in §1 before anything else.
3. The voltage band edges (§1) are a proposal. Check them against the substation-intelligence cartridge's own bands if it has them.
