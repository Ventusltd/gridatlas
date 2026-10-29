/// UK lightning overlay: readable source. Build: node tools/lightning/build.mjs (docs/LIGHTNING-SOURCE.md).
/// Lines starting with /// (like this one) and the ///#if / ///#else / ///#endif variant blocks are source only; a line
/// ending in /// continues on the next line. Everything else ships byte for byte in atlas/modules/<GEN>-uk-lightning-overlay.js.
/// Variants: "layers" (M4 202610290045: the listed technologies' own REPD layers are switched on) and "dots" (M4b
/// 202610290050: only the listed sites are drawn, as REPD-styled dots). @@GEN@@ is the generation stamp.
///
/// 00 header: the shipped header comments, the IIFE, the aliases and the constants.
///
/// The L3 header, as written before build-M stage A1 shortened it to one line (generation 202610281340):
/// EUMETSAT MTG Lightning Imager (L2-LFL) optical flashes, OFF by default, appended last to the original Layers panel
/// and fullscreen curtain; no request, source, layer or listener until switched on; never persisted. Optical flashes are
/// NOT confirmed ground strikes; a day never searched is unknown, never zero. Above the device cap the window draws as
/// tappable ≈10 km cells (data/history/grid) within 30 km of a REPD site.
/// Rules trimmed from lightning history-window.mjs (data-plane/hourly-lookback-index-v2 @ f7db76c). No engine, Pipeline
/// News or menu-proxy attribute. Name glossary: docs/lightning/CANDIDATE-202610261949.md.
/// The shipped header comments below are part of the module bytes (the generation proof reads them).
/* uk-lightning-overlay, generation @@GEN@@ (UTC). EUMETSAT MTG LI L2-LFL optical flashes, OFF by default, never persisted; NOT confirmed ground strikes; unsearched is unknown, never zero. Long periods: ≈10 km cells within 30 km of a REPD site. */
/* M2: a tap lists the nearest REPD project sites (straight-line, 40 km; projects at one point grouped; status and technology filters; 10 km / 40 km summary); a row flies to the project and draws its nearest-substation links, with "◀ back" to the lightning card. Distance only: never "affected". */
/* M4: a module camera move never starts inside another (MapLibre fires moveend synchronously from stop()): the pending framing is dropped before each own move and otherwise runs after the stop that fired it, only when the map is not moving. */
///#if dots
/* M4b: the listed REPD sites only are drawn as REPD-styled dots (the engine's glow + core paint); the Layers controls are never touched. */
///#else
/* M3: the original REPD map layers of the listed technologies are switched on through their own Layers checkboxes, and only those M3 switched on are switched off again on close, lightning OFF, a period change, LATEST or a new list. */
///#endif
/* M5: every listed REPD project shows its full REPD record (address, postcode, county, region, ref, operator, planning) from the pinned parquet the map's project search reads, joined only on an exact point, name, MW and type match; plus an Area summary. */
(()=>{'use strict';
/// Aliases (build-M A3): Math.max/min, Array.isArray, Date.parse (static, no this), appendChild and getBoundingClientRect
/// helpers, and U, the phrase every unknown count carries. NS is the shared window.__GRIDATLAS_MODULES__ namespace, the only
/// global this module writes.
let MX=Math.max,///
  MN=Math.min,///
  AI=Array.isArray,///
  DP=Date.parse,///
  ap=(p,c)=>p.appendChild(c),///
  gr=e=>e.getBoundingClientRect(),///
  U='unknown, not zero',///
  NS=(window.__GRIDATLAS_MODULES__=window.__GRIDATLAS_MODULES__||{});
if(NS.ukLightning||typeof document==='undefined')return;
/// Identity and sources. GEN is stamped by the build. AR: the archive (index, days, grid) on Ventusltd/lightning main;
/// FEED: the 7-day live feed. TMO: the 15 s request timeout; BUDGET: the most points ever drawn; RQ: the most day files per
/// window (and the LRU size). PERIODS: [key, label, ms] or [key, label, -months]; custom = CUSTOM UTC dates. LONG: periods
/// that need the archive. COLOUR: status dot colour by state letter (LOADING, PARTIAL, UNKNOWN, BEFORE-ARCHIVE, FAIL).
let GEN='@@GEN@@',///
  AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/',///
  IX_SCHEMA='uk-lightning-history-index.v2',///
  GS='uk-lightning-history-grid.v1',
FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',///
  FEED_SCHEMA='FeatureCollection/optical_lightning_flash',
SRC='gridatlas-lightning',///
  LAYER='l-gridatlas-lightning',///
  DAY=864e5,///
  HOUR=36e5,///
  TMO=15000,///
  BUDGET=40000,///
  RQ=400,///
  DRE=/^\d{4}-\d{2}-\d{2}$/,///
  TOE='timeout after 15 s',///
  NA=e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable',
PERIODS=[['12h','12 hours',12*HOUR],['24h','24 hours',DAY],['48h','48 hours',2*DAY],///
    ['7d','7 days',7*DAY],['30d','30 days',30*DAY],['3m','3 months',-3],///
    ['6m','6 months',-6],['12m','12 months',-12],['custom','Custom UTC dates',0]],
LONG=['30d','3m','6m','12m'],BASE='Lightning Flashes (Optical)',TITLE='Weather · EUMETSAT Lightning Imager',
FOOTER=`Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are ${U} · UK box −11.0,49.5 → 3.0,61.5`,
COLOUR=st=>({L:'#888',P:'#ffcc00',U:'#ff8800',B:'#ff8800',F:'#ff4444'})[st[0]]||'#00ff88',
