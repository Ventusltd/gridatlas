# Lane copy-consistency: lightning overlay copy vs original GridAtlas conventions

Static analysis only. No browser was started. The only executions were node:vm/minidom runs of the fix designer's suite and a sample renderer.

- **Subject:** `hardening/evidence/opus-fix-designer/fixed-module-D.js` (23,226 B, sha256 9c5e2725…). It differs from `wt/atlas/modules/202610262323-uk-lightning-overlay.js` only in the two `202610262310`→`202610262323` generation stamps, which have the same length.
- **Originals:** I read the shell `wt/atlas/releases/202608300453-atlas-v9/` (index.html, ventusv8.css, ventus-corev8engine.js and the 4 release scripts). I also read the four live cartridges in `wt/atlas/current.json`: streaming-parquet-bridge 202609241251, place-global-search 202609071213, sld-sandbox 202609241334 and substation-intelligence 202609062358.
- **Inputs:** ChatGPT's `origin/chatgpt-veto:docs/lightning/CHATGPT-OWNER-IPHONEREVIEW-20261026.md`, items M02 and M04.
- **Evidence folder:** `hardening/evidence/copy-consistency/`. It holds `edits.mjs` (the edits, with uniqueness and byte-delta checks), `edits.out.txt`, `module-D-copy.js` (D with every edit applied), `tests-D.log` and `tests-D-copy.log`, `sample.mjs` and `samples.txt` (the rendered label, status and captions for 12H/48H/7D/12M, before and after).

## Original conventions (what the shell and cartridges do)

| Topic | Original convention (source) | D |
|---|---|---|
| Layer label | Title Case, e.g. "Solar PV (Operational Only)", "Major Stadiums" (index.html ukConfig, every one of the ~60 labels). The suffix is `[STATE]` with an UPPERCASE single-word token (WAIT/LOAD/OK/EMPTY/FAIL), or `[count \| quantity]` (engine `updateUIState`). Substation uses `[1,234 within 5 km]` | "Lightning flashes (optical)" is sentence case. Its tokens and the `[n \| period]` shape match |
| Numbers | `toLocaleString('en-GB')` in all four cartridges and the postcode search. The engine label count is raw | `N()` uses en-GB everywhere except the `${c.r}` runs count and `${N(bytes)} bytes` |
| Sizes | "MB" with a space ("10 MB", "35.7 MB", "5.92 MB"). MiB appears nowhere in the originals | "32 MB" with a 32e6 check is consistent. The budget text shows raw bytes ("27,560,000 bytes") |
| UTC | `toISOString().replace('T',' ').slice(0,16)+' UTC'` gives `2026-09-05 10:35 UTC` (substation-intelligence) | `T()` is identical. `Ts()` adds seconds for observation times, which is acceptable precision |
| Units | Spaced: "10 km", "15 s"-style, "1 – 160 km" | Mixed: "every 3 h" and "15 s", but `AGO` writes "0h 5min" |
| Separators | " · " joins items (63 uses), " — " starts a consequence clause, " \| " sits inside a label bracket, an en dash marks numeric ranges | Same. "→" is used for UTC intervals, which is clear |
| Ellipsis | "…" (U+2026), only in progressive prose ("Reading the decade…"). "..." appears only as JS spread | D has none, and the LOADING/[LOAD] tokens carry none, which matches the engine |
| Buttons | The source is Title Case or a short verb ("⬇ Export CSV", "↩ Undo Point", "GO"). `.map-ctrl-btn` CSS sets `text-transform:uppercase` | The source is uppercase ("◀ PREV", "LOAD POINTS", "APPLY"). The visual result is identical |
| Empty | The engine shows `[EMPTY]` when a loaded layer has 0 features, and "No projects found" | D shows `[EMPTY]` only when the window is 100% searched, and UNKNOWN otherwise. This is stricter, which is correct |
| Unknown | "Unknown" (Title Case) as a popup field value ("Capacity: Unknown"). In prose it is lowercase: "position unknown", "unknown failure. Nothing here is inferred from its absence." | Lowercase in prose ("unknown, not zero"), which is consistent |
| Spelling | British: normalise, summarise, colour (in prose), "Data Ctrs", "Harbours" | British or neutral, with one exception: "mid-day" (standard British is "midday") |
| Status legend | `.status-dot` mixed case ("Under Construction"). It is not uppercased by CSS, and its font size is 8px | The status line is written in caps in the source. M04 legibility is the fix designer's lane |

## Results

| ID | Check | Status | Evidence | Command |
|---|---|---|---|---|
| CC01 | UTC date-time format | PASS | samples.txt | `MODULE=<m> node --test sample.mjs` |
| CC02 | en-GB thousands separators | FAIL (cosmetic): runs count is raw (12M archive ≈ 2,920 runs) → C04 | fixed-module-D.js `cp()` | read |
| CC03 | MB vs MiB, size wording | FAIL (cosmetic): budget shows raw bytes → C05. No MiB, decimal MB is consistent | `lw()` r.budget | read |
| CC04 | British English | FAIL (cosmetic): "mid-day" → C03 | `cp()` overview | read |
| CC05 | Unit spacing | FAIL (cosmetic): "0h 5min" → C02 | `AGO` | read |
| CC06 | Period naming | FAIL (cosmetic): chip "12M", label "12m", caption "1 year" → C01 | `PERIODS` | samples.txt |
| CC07 | Separators and ellipses | PASS | — | read |
| CC08 | Capitalisation of layer label | FAIL (cosmetic): sentence case among ~60 Title Case labels → C10 | `BASE` | read |
| CC09 | Button verbs | PASS. Abbreviation "PREV" is optional, see below | `bg()` | read |
| CC10 | Empty and unknown phrasing | PASS overall. The feed "no flashes in the live feed" is weaker than the rest of the module → C07 | samples.txt | as CC01 |
| CC11 | M02 feed context near the period selector | FAIL (UX, owner veto): fixed by C06–C09 | samples.txt | as CC01 |
| CC12 | Regression of the fix suite after the edits | 23/24 pass. Only F6 fails, by design, because its regex pins `[1 \| 7d]` (see C09) | tests-D.log (24/24), tests-D-copy.log | `MODULE=module-D-copy.js node --test test-fixes.mjs` |
| CC13 | Status-line case style (caps vs the original mixed case) | OWNER_DECISION | — | — |

## Proposed edits (exact old → new against D; each old string occurs exactly once)

**Must-do for M02: C06–C09, +214 B in total.**

- **C06** (+124). Old: `N=n=>Number(n).toLocaleString('en-GB'),`
  New: ``N=n=>Number(n).toLocaleString('en-GB'),F7=r=>`${N(r.ev.length)} seen in the available 7-day feed · ${r.w.label} requested${r.old?' · older history unknown':''}`,``
  This adds one shared M02 phrase. `F7` is unused in D.
- **C07** (−7). Old: ``L.actual=first||'Actual  no flashes in the live feed in this window';L.flashes=`Flashes ${N(n)} in window (live feed, 7-day retention)${drawn}` ``
  New: ``L.actual=first||'Actual  none seen in the available 7-day feed for this window (unknown, not zero)';L.flashes=`Flashes ${F7(r)}${drawn}` ``
  This strengthens honesty: the empty feed now says "unknown, not zero". "7-day retention" survives in the Refresh line.
- **C08** (+69). Old: `return(st.startsWith('READY')`
  New: ``return(r.mode==='feed'&&st!=='FAIL'?`${st} · ${F7(r)} · searched unknown`:st.startsWith('READY')``
  This keeps "searched unknown" and gives the following results:
  - 12M: `PARTIAL · 408 seen in the available 7-day feed · 12 months requested · older history unknown · searched unknown`
  - empty 12H: `UNKNOWN · 0 seen in the available 7-day feed · 12 hours requested · searched unknown`
  The status line no longer carries "FLASHES DRAWN". The browser suite's drawn-count reader falls back to the caption "N drawn as points" (lightning-hardening.browser.mjs:145-146), so it still works.
- **C09** (+28). Old: `n>0?N(n):c.st==='PARTIAL'` → New: `n>0?(c.st==='PARTIAL'?'≥':'')+N(n):c.st==='PARTIAL'`
  The label becomes `[≥408 | 12m]`. A PARTIAL count is a lower bound. **The fix-designer suite's F6 must change at test-fixes.mjs:165** from `/\[1 \| 7d\]/` to `/\[≥?1 \| 7d\]/`.

**Consistency edits: C01–C05 and C10, +34 B in total.**

- **C01** (+3). `['12m','1 year',-12]` → `['12m','12 months',-12]`. This matches the chip, the label and M02 ("12 months requested").
- **C02** (+2). ``return`${Math.floor(m/60)}h ${m%60}min` `` → ``return`${Math.floor(m/60)} h ${m%60} min` ``
- **C03** (−1). `may lie outside a mid-day window edge` → `may lie outside a midday window edge`
- **C04** (+19). `${c.r} successful runs` → `${N(c.r)} successful run${c.r===1?'':'s'}`
- **C05** (+11). ``r.budget=`${N(count)} flashes, ${N(bytes)} bytes` `` → ``r.budget=`${N(count)} flashes, ${(bytes/1e6).toFixed(1)} MB` ``
- **C10** (0). `BASE='Lightning flashes (optical)'` → `BASE='Lightning Flashes (Optical)'`

**Total: +248 B** (23,226 → 23,474). The node `--check` syntax check passes. The opus-byte-budget ledger gives a proof cap of 24,000 B. The fix designer's own E changes share the remaining 526 B of headroom. If bytes get tight, keep C06–C09 and drop C10, C01 and C02 first.

**Deliberately not changed**

- The warning `archive not yet published: earlier coverage unknown, not zero` starts in lowercase. The exact string is pinned by owner-device test-fixes.mjs:215 and browser T6 (:268).
- The aria-label `from date (UTC)` is pinned by test-fixes.mjs:248.
- The "BEFORE-ARCHIVE" raw token, "◀ PREV" (CSS uppercases it anyway), the footer coordinate notation, and the `Ts` seconds.

## Risks and notes

- **Upstream parity.** The upstream `history-window.mjs` (lightning repo, used by PR2 tests) also says "1 year", "mid-day" and "1 successful runs" (test_history_window.mjs:97, :476). C01, C03 and C04 make the overlay's wording diverge until the same edits land upstream. No wording-parity harness was found.
- **Re-anchoring.** The H08 fix in E rewrites the `const c=r.cov;if(c)` block, which contains C04's text. E's M04 typography may also rewrite `sl()` and `cp()`. Re-anchor if those lines move.
- **CC13 (OWNER_DECISION).** C08 mixes an uppercase state token with sentence-case detail, as M02 worded it and as the original `.status-dot` does. The other statuses stay in all caps. A full move to sentence case is out of scope for a minimal set.
- **Period token in the label.** "12m" in the label bracket sits where the original shows units ("340MW") and could be misread as metres or mega. C09 plus C01 make the caption unambiguous, so I left the token unchanged.
