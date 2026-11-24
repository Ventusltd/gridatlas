# lightning-time-window-ux — date picker, labels and full-period semantics

## Scope
Specify, read-only, the period controls, captions and failure states for the lightning layer inside the ORIGINAL GridAtlas skin, by mapping UK Energy Tracker V6 and the draft `history-window.mjs` onto the original Layers panel. No files in any clone were touched; all evidence is under `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/lightning-time-window-ux/`.

## Method and commands
- Read: `uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js` (L12-31), `.../load_price_history_data.js` (L13-23), `generation_history/load_generation_history_data.js` (L7-13, L17-28), `generation_daily_mwh_by_technology_fuelhh_index.json`, their consumers `generation_history/live-config.js`, `live_data_pipeline/live-config.js`, `index.md` L48-66, L166-182, `generation_history/index.md` L169-176.
- `git -C /home/claude/lightning show origin/feature/one-year-utc-lightning-history:history-window.mjs` and `:docs/HISTORY_ONE_YEAR.md`, `:history.py`, `:tests/test_history_window.mjs`; `data/uk_lightning.geojson` metadata (python3 -I).
- GridAtlas: `atlas/releases/202608300453-atlas-v9/ventusv8.css`, `index.html`, `ventus-corev8engine.js` L622-642, L989-1048; `atlas/cartridges/202609062358-substation-intelligence-v9-63.js` L4428-4476 (inventory), L4594-4618 (`.gm-layer*`), L5777-5837 (proxies), L6063-6080 (click/change closers), L6093-6099 (MutationObserver), L6597-6676 (pipeline-news `.key-group` precedent), L6790-6875 (card bar/sheet); `atlas/cartridges/202609241334-sld-sandbox-v9-8.js` L2532-2563 (dash toggle, 44px, collapse rule), L5809-5813 (`trayTarget()`); `atlas/preview/lightning/weather-module.js` L45-117 (rejected V5).
- Probe of the draft loader: `node scripts/probe.mjs` → `probe-output.txt`.
- Served-browser measurement on port 8106 (`python3 -m http.server 8106 --directory /home/claude`), Playwright 1.63 Chromium, 1440×900 and 360×740 (Android UA, touch, dpr 3), wait = networkidle ≤20 s then 3 s: `scripts/measure-panel.mjs` (real page) and `scripts/measure-synthetic-panel.mjs` (synthetic 60+3 panel under the real CSS); outputs `measure-*.json`, PNGs `*-synthetic-panel-lightning-{OFF,ON-scrolled}.png`. Server killed afterwards; both clones clean.

## Findings
1. **The tracker is start-anchored (Year + Start + Period, `end = start + periodDays − 1 s`, clamped to min 2016-01-01 and today+7 d; prev/next nudge start by `periodDays`)** — control_price_history.js L16, L21; load_price_history_data.js L21. **The draft loader is end-anchored, `[start,end)`, calendar months, custom = inclusive UTC dates, next clamped to now** (history-window.mjs L31-61). For a prospective, ≤1-year archive the end-anchored model is right (default "latest"); the Year select has no meaning and must be dropped. Keep the tracker's prev/next, period vocabulary, Promise caches and tiering.
2. **Tiers in the tracker: generation `tierFor()` sends 12h…30d to one 30-day high-frequency file and 3m+ to daily summaries (L10); price sends only 12m/5y/10y to daily (L15).** The draft's split is "≤31 days → detail shards (4 concurrent, cap 40,000), else overview = index only" (L101, L148-152). Adopt the generation rule with one addition: 30d/custom ≤31 days must be gated by the index sum (`Σ count` of overlapping days) before fetching — a stormy month can exceed the cap many times.
3. **The draft label does not meet the owner's list.** Running it (probe B2): a custom window starting `2026-10-21 18:00` reports "Observations within selected UTC dates 2026-10-21T12:32:19Z", a detection 5.5 h before the selection (L89-93 uses day-level first/last). It never uses `scan_windows` (the index's record of successful EUMETSAT searches, history.py L242-260), so it cannot distinguish "searched, no flashes" from "never searched"; `archiveAvailability` is a constant string (L145); no staleness, no optical-flash caveat in the text. **The UI must compute coverage itself from `result.index.scan_windows` and `archive_first_enabled_utc`** (both are present in the result object; probe C).
4. **Retention edge throws instead of clamping** (L139-140; probe A2): a 12-month window ending yesterday rejects with "Requested dates precede available one-year archive retention", so PREV from any 12m window, and the second PREV from a 6m window, would surface as an error. The UI must pre-clamp the start to `cutoff_date_utc` and disable PREV when the previous window's end ≤ cutoff; the loader should ideally clamp and flag (lane: archive).
5. **Live feed cannot carry the captions.** `data/uk_lightning.geojson` metadata has `query_start_utc/query_end_utc` (the last 3 h query, collect.py L203-211), `latest_detection_utc`, `retention_days: 7`, no generation time and no scan history; actual coverage today is 2026-10-21 12:32 → 2026-10-25 11:15 (5 days, not 7), a 26 h detection gap before `query_end 2026-10-26 13:05`. Every owner-demanded line except "collection window" needs `data/history/index.json`, which does not exist on main (`ls data/history` → no such file). **The archive PR is a hard prerequisite of the time-window UI.**
6. **One shard failure voids the window**: `Promise.all` over day files (L155-158) rejects on any 404, although the index already carries per-day counts. UI must render index counts and name the missing dates (`allSettled` semantics).
7. **Surfaces.** The menu bar proxies only `input[type=checkbox][data-layer-id|data-pn-layer]` plus `name="bm"` radios (substation L4456-4476, L5777-5836); a cartridge `.key-group` in `#scada-ui-container` is invisible to the Grid dropdown unless the cartridge adds its own `.gm-layer` row. Its document click listener closes every panel on any BUTTON/INPUT click not carrying `data-gridatlas-layer-proxy` (L6065-6076), **so period/date controls cannot live in the Grid dropdown**; only the toggle can. A body-wide MutationObserver re-runs `adoptLate()`+`syncAll()` (63 proxies) on every DOM mutation (L6093-6099): caption updates must be batched, no ticking clocks.
8. **Append-last is geometry-safe; prepend (V5, weather-module.js L71, L104) is not.** Synthetic 60+3 panel under the real CSS, 1440×900: wrapper 368 px, map 518 px, `.scada-keys` scrollHeight 1361 are identical before/after appending the lightning group OFF — it fills the empty right cell of grid row 7 beside PIPELINE NEWS (x 726, y 1795). ON: wrapper/map unchanged, scrollHeight 1361→1463. 360×740 expanded: wrapper 307, map 419 unchanged OFF and ON. Native `.key-item` row = 19 px, checkbox 17×17; `.map-ctrl-btn` chips 22 px on desktop, 44×44 with the sld-sandbox coarse-pointer rule on the phone (`measure-synthetic-panel-output.json`).
9. **BLOCKED_DEPENDENCY**: on the real served page MapLibre (cdn.jsdelivr.net) is refused, the engine builds 0 controls, the menu reports "found 0 + 0" (`measure-panel-output.json`); finding 8 is therefore from a synthetic panel and must be re-measured live by the parity lane.
10. **Pre-existing**: the sld-sandbox fixed `▾ HIDE LAYERS` toggle (bottom 12 px, right 12 px, z 9999) overlaps the panel's bottom-right corner for whatever group is last — visible on both screenshots; not introduced by lightning.

## Specification

### Control set (all surfaces share one state object; mirrors are repainted from it)
| Control | Values / behaviour |
|---|---|
| Toggle | `.key-item` checkbox, no `data-layer-id`/`data-pn-layer`/`name=bm`; OFF by default, never persisted. Label suffix follows engine vocabulary (L637): `[WAIT]` off, `[LOAD]`, `[408 \| 24h]` (count \| period), `[EMPTY \| 24h]`, `[UNKNOWN \| 24h]`, `[FAIL]` (opacity .5), `STALE` appended inside the bracket. |
| Period chips | `12H 24H 48H 7D 30D 3M 6M 12M CUSTOM`, `.map-ctrl-btn`, active chip `.active` + `aria-pressed`. Named periods are end-anchored: end = now (UTC) for "latest"; months by calendar (`minusMonths`). Default 24H. |
| CUSTOM | Two `type=date` inputs (UTC dates, `min=cutoff_date_utc`, `max=today UTC`) + APPLY; window = from 00:00Z → (to+1 day) 00:00Z, "to" inclusive. from>to → inline `border-color:#ff4444`, message in caption, no load. |
| ◀ PREV / NEXT ▶ | Shift by the window span (`previousUtcWindow`/`nextUtcWindow`). NEXT disabled when end ≥ now. PREV disabled when previous end ≤ `cutoff_date_utc`; otherwise start pre-clamped to cutoff and labelled "clamped to retention start". |
| LATEST | Re-anchor end to now, refresh index (`refresh:true`). Enabled only when not at latest. |
| LOAD POINTS | Shown in overview mode when span ≤31 days and index sum > cap: loads newest 40,000 with explicit "N of M" consent. |
| Drill-down | In overview the three busiest UTC dates render as chips; tap → CUSTOM single day → detail. |
| Auto-refresh | Only while ON and at "latest": index every 10 min; today's shard re-fetched on `generated_utc` change. Past-anchored windows never move. |
| Caching | Index Promise (revision = `generated_utc`), shard Promises per URL; sealed days (date < today UTC) with default HTTP caching, today + index `no-store` (budget lane to confirm). |

### Tier per period
| Period | Tier | Requests |
|---|---|---|
| 12h, 24h, 48h, 7d | detail (points) | ≤2 / ≤2 / ≤3 / ≤8 shards, 4 concurrent |
| 30d, custom ≤31 d | detail if index Σ ≤ 40,000 else overview-first + LOAD POINTS | ≤31 shards |
| 3m, 6m, 12m, custom >31 d | overview: index only, daily counts, map layer emptied (never stale points under a long label) | 1 |

### State machine (status dot = `.status-dot`, shell palette)
`OFF` → `LOADING` (#888) → one of: `READY·DETAIL` (#00ff88 "READY · N FLASHES DRAWN"), `READY·SUMMARY` (#00ff88), `EMPTY-COVERED` (#00ff88 "NO FLASHES DETECTED · SEARCHED 100%"), `PARTIAL` (#ffcc00: tail not yet ingested, head before `archive_first_enabled_utc`, or dates without a scan window), `UNKNOWN` (#ff8800, 0 % searched), `BEFORE-ARCHIVE` (#ff8800, window entirely before cutoff/first-enabled; nothing drawn), `FAIL` (#ff4444: index HTTP/network; or k of n shards failed → still show index counts). `STALE` is a modifier when `now − generated_utc` > 4 h (collector cadence 3 h). Coverage = Σ|window ∩ scan_windows| / |window|; a window end beyond the last scan end is "not yet ingested".

### Caption templates (same text on every surface; `T()` = `YYYY-MM-DD HH:MM UTC`, `Ts()` with seconds, `N()` en-GB thousands, `AGO()` = `Xh Ymin`)
1. `Window  {T(start)} → {T(end)} UTC ({period label}, latest)` / `(…, end exclusive)` / custom: `Window  UTC dates {from} to {to} inclusive = {T(start)} → {T(end)}`; optional second line `UK local {local(start)} → {local(end)} ({GMT|BST})` via `Intl` Europe/London.
2. Detail: `Actual  first {Ts(first)} · last {Ts(last)} UTC` ; empty: `Actual  no archived flashes within this window · last archived flash before window {Ts(prev)} ({AGO} before start)` ; overview: `Actual  on the {n} overlapping UTC dates: first {Ts} · last {Ts} (day-level; may lie outside a mid-day window edge)`.
3. Detail: `Flashes {N(total)} archived in window · {N(shown)} drawn` + `(cap {N(cap)}: newest drawn, {N(total−shown)} older not drawn)` when truncated; overview: `Flashes {N(Σ)} archived on {n} overlapping UTC dates · none drawn (summary mode; choose ≤31 days or LOAD POINTS)`.
4. `Refresh archive {T(generated_utc)} ({AGO} ago; expected every 3 h)` + ` · STALE` when > 4 h.
5. `Searched EUMETSAT {pct}% of window · {runs} successful runs · {T(scanStart∩)} → {T(scanEnd∩)}` ; 0 %: `Searched EUMETSAT 0% of window — no collection run covers these dates`.
6. Warning line (#ffcc00), one of: `Not yet ingested: last {AGO} of window (unknown, not zero)` · `Unknown: {from} to {to} precede archive start {date} (not zero)` · `Unknown: {k} of {n} UTC dates have no collection run` · `Window predates the archive (began {date}; retention from {cutoff}) — nothing can be shown; not zero lightning` · `Archive unavailable: {HTTP 404 | network error} at {T(now)} — nothing shown (unknown, not zero)` · `{k} of {n} day files failed ({dates}); points incomplete, counts from index`.
7. Footer (#555, 9 px): `Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5`.

### Placement, classes, tokens (no new CSS rules, no tracker markup)
Surfaces: (a) `#scada-ui-container` — full group appended LAST (after PIPELINE NEWS, pipeline-news precedent L6597-6626); (b) `#fs-curtain-keys` — same group mirrored; (c) Grid dropdown `.gm-panel-body` — toggle-only mirror row appended last. Phone: toggling ON from the dropdown pre-scrolls `.scada-keys` to the group so `▴ LAYERS` opens on it. Existing classes used: `.key-group .key-title .key-item .map-ctrl-btn(.active) .status-legend .status-dot .radius-input-row .radius-unit .search-input(for date inputs, inline width) .gm-layer-group .gm-layer .gm-layer-box .gm-layer-name`. Tokens = the shell's literal palette, applied inline only on lightning-owned nodes: `#050505/#0a0a0a` surfaces, `#333/#444` borders, `#00ffff` accent, `#888` text, `#555` small print, `#ffcc00` warn, `#ff8800` unknown, `#ff4444` error, `'Courier New',monospace`; 44 px min-height/min-width inline when `matchMedia('(pointer: coarse)').matches || innerWidth <= 700` (sld-sandbox `trayTarget()`, L5811). The toggle row keeps native 19 px height like its 63 neighbours; the 44 px toggle surface on a phone is the Grid dropdown mirror. Controls container carries `hidden` while OFF (zero geometry). The optional on-map caption (increment 2) is a second `.radius-popup` element at inline `left:10px; bottom:…`; not in increment 1.

### DOM (main panel; curtain identical with `-fs` ids)
```html
<div class="key-group" data-lightning-group="main">
  <div class="key-title">Weather · EUMETSAT Lightning Imager</div>
  <label class="key-item"><input type="checkbox" data-lightning-control="toggle" aria-describedby="gridatlas-lightning-caption-main">
    <span data-lightning-label="main" data-base-label="Lightning flashes (optical)" style="color:#ffdf44">Lightning flashes (optical) [WAIT]</span></label>
  <div data-lightning-controls="main" hidden>
    <div role="group" aria-label="Period, UTC" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
      <button type="button" class="map-ctrl-btn active" data-lightning-period="24h" aria-pressed="true">24H</button> <!-- ×9 -->
    </div>
    <div class="radius-input-row" data-lightning-custom hidden>
      <span class="radius-unit">From (UTC)</span><input type="date" class="search-input" data-lightning-date="from" style="width:9.5em;color-scheme:dark">
      <span class="radius-unit">To (incl.)</span><input type="date" class="search-input" data-lightning-date="to" style="width:9.5em;color-scheme:dark">
      <button type="button" class="map-ctrl-btn" data-lightning-nav="apply">APPLY</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
      <button type="button" class="map-ctrl-btn" data-lightning-nav="prev" aria-label="Previous period">◀ PREV</button>
      <button type="button" class="map-ctrl-btn" data-lightning-nav="latest" disabled>LATEST</button>
      <button type="button" class="map-ctrl-btn" data-lightning-nav="next" disabled aria-label="Next period">NEXT ▶</button>
      <button type="button" class="map-ctrl-btn" data-lightning-nav="points" hidden>LOAD POINTS</button>
    </div>
    <div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot"><span data-lightning-dot style="background:#888"></span><span data-lightning-state>LOADING</span></div></div>
    <div id="gridatlas-lightning-caption-main" data-lightning-caption role="status" aria-live="polite" style="font:10px/1.5 'Courier New',monospace;color:#888">
      <div data-cap="window"></div><div data-cap="actual"></div><div data-cap="flashes"></div><div data-cap="refresh"></div>
      <div data-cap="searched"></div><div data-cap="warning" style="color:#ffcc00"></div><div data-cap="footer" style="font-size:9px;color:#555"></div>
    </div>
  </div>
</div>
<!-- Grid dropdown mirror, appended to #gridatlas-menu-bar .gm-panel-body -->
<div class="gm-layer-group" data-lightning-group="menu">Weather · EUMETSAT Lightning Imager</div>
<label class="gm-layer" data-gridatlas-layer-key="weather:lightning"><input type="checkbox" data-gridatlas-layer-proxy="weather:lightning" data-lightning-control="toggle" aria-label="Lightning flashes (optical)"><span class="gm-layer-box" aria-hidden="true"></span><span class="gm-layer-name" data-lightning-label="menu">Lightning flashes (optical) [WAIT]</span></label>
```

### Wireframe, 360 px (panel expanded via ▴ LAYERS, one column; screenshot `phone-360x740-synthetic-panel-lightning-ON-scrolled.png`)
```
▌WEATHER · EUMETSAT LIGHTNING IMAGER
▌☑ Lightning flashes (optical) [408 | 24h]
▌[12H][24H][48H][7D][30D][3M]      44×44 chips, wrap
▌[6M][12M][CUSTOM]
▌[◀ PREV][LATEST][NEXT ▶]
▌● READY · 408 FLASHES DRAWN
▌Window  2026-10-25 13:05 → 2026-10-26 13:05 UTC (24 hours, latest)
▌Actual  first 2026-10-25 13:41:02 · last 2026-10-26 11:15:58 UTC
▌Flashes 408 archived in window · 408 drawn (cap 40,000)
▌Refresh archive 2026-10-26 13:05 UTC (12 min ago; expected every 3 h)
▌Searched EUMETSAT 100% of window · 8 successful runs
▌Times UTC · optical flashes… not confirmed ground strikes · missing days unknown, not zero
```
Desktop 1440×900: same group occupies the right-hand cell of grid row 7 beside PIPELINE NEWS, chips at native 22 px (`desktop-1440x900-synthetic-panel-lightning-ON-scrolled.png`).

## Objections to other lanes
- Transport: do not spend the lane on the rolling `.geojson`; the window UI needs only `index.json` + `days/…/*.json`. Prove `.json` pass-through on the production bridge and stop there.
- Archive: `successful_scan()` refuses `products_examined < 1` (history.py L268-272); since LFL products exist every 10 min, zero products = outage = UNKNOWN, which is correct — document it, or quiet periods become "not searched". Clamp-and-flag at the cutoff instead of throwing; `allSettled` for shards.
- Builder: no prepend, no copied loader, no period controls in the Grid dropdown, no `<style>` with class selectors, no persistence of ON, caption writes batched per load.
- Parity: mask only the lightning group's own box; re-measure finding 8 on the live route because the local harness is BLOCKED_DEPENDENCY; include the scrollbar thumb (scrollHeight changes).
- Menu-contracts: `data-gridatlas-layer-proxy` on the dropdown mirror keeps the panel open on tick (L6072) and `all-controls.browser.mjs` L29 only requires ≥60 proxies; confirm no proof asserts exactly 63 proxies.

## Recommendation for the smallest additive integration
Increment 1 = one additive cartridge after sld-sandbox: the group above in `#scada-ui-container` and `#fs-curtain-keys`, the toggle mirror in the Grid dropdown, a MapLibre circle layer fed by the history client (with UI-side coverage/clamp/allSettled wrappers), OFF by default; prerequisite: archive PR merged and producing `data/history/index.json`. Increment 2 (owner-approved): on-map `.radius-popup` caption card.

## Verdict
BLOCKED — specification complete and geometry-safe placement demonstrated on a synthetic panel, but the time-window UI cannot be built or proven until `data/history/index.json` exists (archive PR unmerged) and live-route geometry is re-measured where MapLibre loads.
