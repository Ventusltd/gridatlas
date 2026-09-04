/**
 * SLD runtime styles, mechanically lifted from the v9.106 sandbox body.
 *
 * This module owns only the seven template-literal CSS values. The sandbox
 * still owns when each surface is installed and the DOM element receiving it.
 * Keeping those lifecycles in place makes this a byte-for-byte style move,
 * not a UI redesign. The sibling substation cartridge carries this module
 * because it executes before sld-sandbox and has the required headroom.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.sldStyles) throw new Error('sld-styles module registered twice');

  NS.sldStyles = Object.freeze({
    schema: 'gridatlas.module.sld-styles.v1',
  neonBlock(BLOCK_CLASS) {
    return `
.${BLOCK_CLASS}{margin-top:7px;padding-top:6px;border-top:1px solid #123;font-family:monospace}
.${BLOCK_CLASS} .neon-hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.06em;
  color:#5fbdc2;font-weight:bold;text-transform:uppercase}
.${BLOCK_CLASS} .neon-beta{font-size:8px;letter-spacing:.06em;padding:1px 4px;border-radius:2px;
  background:#3a2f12;color:#e0b050;border:1px solid #6a5320;text-transform:uppercase}
.${BLOCK_CLASS} ol{list-style:none;margin:5px 0 0;padding:0}
.${BLOCK_CLASS} li{display:flex;align-items:baseline;gap:6px;padding:2px 0}
.${BLOCK_CLASS} .neon-km{color:#5fbdc2;font-weight:bold;font-variant-numeric:tabular-nums;
  min-width:54px;text-shadow:0 0 6px rgba(95,189,194,.35)}
.${BLOCK_CLASS} .neon-name{color:#9fb3ba;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;flex:1;max-width:150px}
.${BLOCK_CLASS} .neon-kv{color:#ffae00;font-size:9px;white-space:nowrap;cursor:help}
.${BLOCK_CLASS} .neon-kvnote{margin-top:6px;font-size:10px;line-height:1.45}
.${BLOCK_CLASS} .neon-kvnote b{color:#ffae00;font-weight:normal}
.${BLOCK_CLASS} .neon-pin{display:block;width:100%;margin-top:7px;padding:5px 6px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#8b9aa1;
  font:inherit;font-size:10px;letter-spacing:.05em;cursor:pointer;text-transform:uppercase}
.${BLOCK_CLASS} .neon-pin:hover{border-color:#5fbdc2;color:#bfe9ee}
.${BLOCK_CLASS} .neon-pin[aria-pressed="false"]{color:#5f7a80;border-color:#1d3238}
.${BLOCK_CLASS} .neon-layout{display:block;width:100%;margin-top:7px;padding:5px 6px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;
  font:inherit;font-size:10px;letter-spacing:.05em;cursor:pointer;text-transform:uppercase}
.${BLOCK_CLASS} .neon-layout:hover{border-color:#5fbdc2;color:#bfe9ee;background:#0d2429}
/* The measurement and its qualifiers, as one element. A hairline rule and
   six pixels of padding: nothing here colours or grades the number. */
.${BLOCK_CLASS} .neon-answer{margin:0 0 8px;padding:6px 0 8px;
  border-bottom:1px solid #123}
.${BLOCK_CLASS} .neon-answer > .neon-caveat:first-child{margin-top:0}
/* The card sits over the map and used to be immovable, with only MapLibre's
   own hairline close cross. It gets a bar: grab it to move the card out of the
   way, and two controls big enough to hit without aiming. */
/* Measured on the live map: the card was 563px tall inside a 319px map and
   hung 403px below it, so the caveat and the layout button could not be
   reached at all. The content is now bounded to the map and scrolls, and the
   bar stays put at the top of that scroll so the controls never leave. */
.maplibregl-popup-content{max-height:var(--gridatlas-card-max, 60vh) !important;
  overflow-y:auto !important;overflow-x:hidden;overscroll-behavior:contain}
.gridatlas-card-bar{position:sticky;top:-6px;z-index:2;flex:0 0 auto;
  display:flex;align-items:center;gap:6px;margin:-6px -6px 6px;
  padding:5px 6px;background:#0a1a1d;border-bottom:1px solid #1d3238;
  border-radius:3px 3px 0 0;cursor:grab;user-select:none;touch-action:none;font-family:monospace}
.gridatlas-card-bar:active{cursor:grabbing}
.gridatlas-card-bar .grip{color:#3f6f75;letter-spacing:2px;font-size:11px}
.gridatlas-card-bar .label{color:#8b9aa1;font-size:10px;max-width:190px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar .label{color:#5fbdc2;font-weight:bold;max-width:230px}
.gridatlas-card-bar .spacer{flex:1}
.gridatlas-card-bar button{background:#050a0d;border:1px solid #2f6f75;color:#5fbdc2;
  font:inherit;font-size:14px;line-height:1;min-width:44px;height:44px;border-radius:3px;
  cursor:pointer;padding:0 6px}
.gridatlas-card-bar button:hover{color:#bfe9ee;border-color:#5fbdc2;background:#0d2429}
.gridatlas-card-bar button.close:hover{color:#ff8f8f;border-color:#ff5d5d}
.maplibregl-popup.gridatlas-free{position:fixed !important;transform:none !important;
  left:var(--gx) !important;top:var(--gy) !important;z-index:12}
.maplibregl-popup.gridatlas-free .maplibregl-popup-tip{display:none !important}
.maplibregl-popup.gridatlas-min .maplibregl-popup-content > *:not(.gridatlas-card-bar){display:none !important}
.maplibregl-popup.gridatlas-min .maplibregl-popup-content{padding:6px !important;
  border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25)}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar{margin:0;border-bottom:0;
  border-radius:3px;background:#08171a}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar button.min{border-color:#5fbdc2;color:#bfe9ee}
.${BLOCK_CLASS} .neon-caveat{margin-top:6px;color:#68797f;font-size:9px;line-height:1.5}
.${BLOCK_CLASS} .neon-caveat b{color:#8b9aa1;font-weight:bold}
/* The immutable shell predates phone-landscape use. These are composition
   overrides, not a mutation of the attested shell: the left control stack can
   scroll inside a short map, and search results cannot extend below it. */
@media (max-height:600px){
  .map-controls{max-height:min(70%,calc(100dvh - 100px));overflow-y:auto;
    overscroll-behavior:contain;scrollbar-width:thin}
  .search-results{max-height:calc(100dvh - 140px) !important}
}
@media (pointer:coarse){
  .map-ctrl-btn,.search-btn{min-height:44px}
  .search-input{min-height:44px;box-sizing:border-box}
  .${BLOCK_CLASS} .neon-pin,.${BLOCK_CLASS} .neon-layout{min-height:44px}
}
/* ── THE CARD IS A DOCKED SHEET ON A PHONE ───────────────────────────────
   Measured on a verified iPhone-class device (393x852 at dpr 3,
   pointer:coarse, hover:none, 5 touch points, document.hidden false): the
   anchored card opened at y=426, 819px tall, so its bottom edge was 393px
   BELOW the screen and the end of it was unreachable at every scroll
   position. Its left edge sat at x=-89 at 390px wide. Anchoring is the wrong
   idea on a phone - a 340px box hung off a marker in a 393px viewport has
   nowhere to go - so on a coarse pointer or a narrow window the card docks
   to the bottom edge, full width, and nothing has to be dragged.
   No rule below reads technology: three buckets light no layer at all. */
html.gridatlas-sheet-open .maplibregl-popup.gridatlas-sheet{
  position:fixed !important;left:0 !important;right:0 !important;
  top:auto !important;bottom:0 !important;transform:none !important;
  width:100vw !important;max-width:100vw !important;
  margin:0 !important;padding:0 !important;z-index:400 !important}
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-tip{display:none !important}
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-content{
  max-height:var(--gridatlas-sheet-h,56dvh) !important;
  width:100% !important;max-width:100% !important;
  border-radius:12px 12px 0 0;box-sizing:border-box;
  border-top:1px solid #2f6f75;box-shadow:0 -8px 24px rgba(0,0,0,.55);
  padding-bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important}
.maplibregl-popup.gridatlas-sheet.gridatlas-min .maplibregl-popup-content{
  max-height:none !important}
/* MapLibre's own hairline cross is 20x18 and now sits inside a full-width
   sheet whose bar already carries a 44px close. Two closes, one of them
   unhittable, is worse than one. */
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-close-button{display:none !important}
/* WHEN A CONTROL AND THE ANSWER WANT THE SAME PIXELS, THE ANSWER WINS.
   Four bars printed over the card's text on every load: the tray with the
   GB PRICES and VERSIONS bars (all inside .map-controls at y 698-822), HIDE
   LAYERS at y 796 on z-index 9999, and the credit strip at y 827. None is
   deleted and none goes UNDER the sheet, which would make it unreachable:
   they are lifted clear, still on the map and still 44px. The offset reads
   the same var the sheet is sized from, so the two cannot disagree. */
html.gridatlas-sheet-open .map-controls{
  bottom:calc(var(--gridatlas-sheet-h,56dvh) + 12px) !important;
  max-height:calc(100dvh - var(--gridatlas-sheet-h,56dvh) - 120px) !important;
  overflow-y:auto;overscroll-behavior:contain}
html.gridatlas-sheet-open #gridatlas-dash-toggle{
  bottom:calc(var(--gridatlas-sheet-h,56dvh) + 12px) !important}
/* Not an attribution: the OSM and CARTO credit is .custom-map-attrib at the
   top of the map and does not move. This is a shout-out that was printing
   across the card's sentences. Hidden only while a sheet is open. */
html.gridatlas-sheet-open .podcast-shoutout{display:none !important}`;
  },
  bootStatus(STATUS_ID) {
    return `
#${STATUS_ID}{position:absolute;left:50%;top:14px;transform:translateX(-50%);
  z-index:5;max-width:min(92vw,420px);padding:7px 11px;border-radius:4px;
  background:rgba(6,18,21,.93);border:1px solid #21454b;color:#9fb3ba;
  font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;
  text-align:center;pointer-events:auto}
#${STATUS_ID}[data-kind="failed"]{border-color:#7a4a4a;color:#d0a9a9}
#${STATUS_ID} button{display:block;margin:7px auto 0;padding:4px 12px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#bfe9ee;
  font:inherit;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
#${STATUS_ID} button:hover{border-color:#5fbdc2}
@media (prefers-reduced-motion:no-preference){
  #${STATUS_ID}[data-kind="waiting"]{animation:ga-status-pulse 2.4s ease-in-out infinite}
}
@keyframes ga-status-pulse{0%,100%{opacity:.72}50%{opacity:1}}`;
  },
  versionLedger(LEDGER_ID) {
    return `
#${LEDGER_ID}{margin-top:6px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#${LEDGER_ID} > button{display:block;width:100%;padding:6px 8px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-align:left}
#${LEDGER_ID} > button:hover{border-color:#5fbdc2;color:#bfe9ee}
#${LEDGER_ID} .vl-body{display:none;margin-top:5px;padding:8px;border:1px solid #1d3238;
  border-radius:3px;background:rgba(6,18,21,.94);max-width:min(88vw,300px);
  max-height:min(56vh,380px);overflow:auto;overscroll-behavior:contain}
#${LEDGER_ID}[data-open="1"] .vl-body{display:block}
#${LEDGER_ID} .vl-row{padding:4px 0;border-bottom:1px solid #142226}
#${LEDGER_ID} .vl-head{display:flex;justify-content:space-between;gap:8px}
#${LEDGER_ID} .vl-ver{color:#bfe9ee;font-weight:bold}
#${LEDGER_ID} .vl-status{margin-left:5px;color:#ff9b73;font-size:9px;font-weight:bold}
#${LEDGER_ID} .vl-when{color:#5f7a80;font-size:10px}
#${LEDGER_ID} .vl-scope{color:#9fb3ba;font-size:10px;line-height:1.4;margin-top:1px}
#${LEDGER_ID} .vl-reason{color:#df9b83;font-size:9px;line-height:1.35;margin-top:2px}
#${LEDGER_ID} .vl-note{margin:7px 0 0;color:#6f8288;font-size:10px;line-height:1.45}`;
  },
  mobileTray(TRAY_ID) {
    return `
#${TRAY_ID}{display:flex;gap:4px;font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
#${TRAY_ID} button{min-height:44px;padding:6px 10px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
#${TRAY_ID} button[aria-pressed="true"]{border-color:#5fbdc2;color:#bfe9ee;
  background:rgba(0,255,255,0.08)}
#${TRAY_ID} button[disabled]{opacity:.45;cursor:default}
.map-controls.gm-tools-collapsed > .map-ctrl-btn{display:none}`;
  },
  gbConditions(GB_ID) {
    return `
#${GB_ID}{margin-top:6px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#${GB_ID} > button{display:block;width:100%;padding:6px 8px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-align:left}
#${GB_ID} > button:hover{border-color:#5fbdc2;color:#bfe9ee}
#${GB_ID} .gb-body{display:none;margin-top:5px;padding:8px;border:1px solid #1d3238;
  border-radius:3px;background:rgba(6,18,21,.94);max-width:min(88vw,260px);
  max-height:min(52vh,340px);overflow:auto;overscroll-behavior:contain}
#${GB_ID}[data-open="1"] .gb-body{display:block}
#${GB_ID} .gb-row{display:flex;justify-content:space-between;gap:8px;
  padding:2px 0;border-bottom:1px solid #142226}
#${GB_ID} .gb-k{color:#7d8f95}
#${GB_ID} .gb-v{color:#bfe9ee;font-weight:bold}
#${GB_ID} .gb-v em{color:#5f7a80;font-style:normal;font-weight:normal;font-size:10px}
#${GB_ID} .gb-note{margin:7px 0 0;color:#6f8288;font-size:10px;line-height:1.45}
#${GB_ID} .gb-note.gb-point{color:#9fb3ba;border-top:1px solid #142226;padding-top:6px}
#${GB_ID} .gb-note.gb-point b{color:#d8a76a}
#${GB_ID} .gb-more{display:block;margin-top:7px;color:#5fbdc2;font-size:10px;
  text-decoration:none;letter-spacing:.04em}
#${GB_ID} .gb-more:hover{text-decoration:underline}`;
  },
  sldPanel(PANEL_ID) {
    return `
/* Top RIGHT, below the search box. The Atlas keeps its own tool buttons down
   the left edge -- EXPORT CSV, RADIUS SEARCH, ZONE DRAW, MEASURE -- and a
   panel on that side covers them, and the search bar occupies 72-96px inside
   the map container on the right, so the panel clears it at 112px. Both offsets
   were measured on the live map: no headless test catches a collision with a
   component the panel knows nothing about. */
#${PANEL_ID}{position:absolute;right:14px;top:112px;bottom:14px;z-index:11;width:310px;
  max-width:calc(100% - 28px);box-sizing:border-box;overflow:auto;font:11px/1.5 'Courier New',monospace;
  color:#cfe9ee;background:rgba(2,8,11,.93);border:1px solid #0b5f63;border-radius:5px;
  padding:11px 12px;box-shadow:0 0 22px rgba(0,255,255,.14);backdrop-filter:blur(3px);display:none}
#${PANEL_ID}[data-open="true"]{display:block}
#${PANEL_ID} h4{margin:0 0 2px;font-size:10px;letter-spacing:.09em;color:#5fbdc2;text-transform:uppercase;
  display:flex;align-items:center;gap:7px}
#${PANEL_ID} .sld-beta{font-size:8px;padding:1px 4px;border-radius:2px;background:#3a2f12;
  color:#e0b050;border:1px solid #6a5320}
#${PANEL_ID} .sld-site{color:#fff;font-size:12px;font-weight:bold;margin:2px 0 8px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${PANEL_ID} h4.sld-drag{cursor:grab;user-select:none;touch-action:none}
#${PANEL_ID} h4.sld-drag:active{cursor:grabbing}
#${PANEL_ID} .sld-min{margin-left:auto}
#${PANEL_ID} .sld-min,#${PANEL_ID} .sld-close{cursor:pointer;background:#050a0d;
  border:1px solid #2f6f75;color:#5fbdc2;font:inherit;font-size:12px;line-height:1;
  min-width:44px;height:44px;border-radius:3px;padding:0 5px}
#${PANEL_ID} .sld-min:hover{color:#bfe9ee;border-color:#5fbdc2}
#${PANEL_ID} .sld-close:hover{color:#ff8f8f;border-color:#ff5d5d}
#${PANEL_ID}[data-min="true"] > *:not(h4){display:none}
#${PANEL_ID}[data-min="true"]{width:auto;padding:7px 9px;
  box-shadow:0 0 14px rgba(95,189,194,.25)}
#${PANEL_ID}[data-min="true"] h4{margin:0}
#${PANEL_ID}[data-min="true"] .sld-min{border-color:#5fbdc2;color:#bfe9ee}
#${PANEL_ID} .sld-to{color:#8b9aa1;font-size:9.5px;margin:-6px 0 8px}
#${PANEL_ID} .sld-target{margin:0 0 9px;padding:7px 8px;border:1px solid #1d3238;
  border-radius:3px;background:#050a0d}
#${PANEL_ID} .sld-target-row{display:flex;justify-content:space-between;align-items:baseline}
#${PANEL_ID} .sld-target-row b{color:#e0b050;font-variant-numeric:tabular-nums}
#${PANEL_ID} .sld-basis{display:flex;align-items:center;gap:6px;margin-top:5px}
#${PANEL_ID} .sld-basis span{color:#8b9aa1;font-size:10px;white-space:nowrap}
#${PANEL_ID} .sld-basis select{flex:1}
#${PANEL_ID} .sld-danger{margin-top:6px;color:#ff5d5d;font-size:9px;line-height:1.5;
  border-left:2px solid #ff5d5d;padding-left:6px}
#${PANEL_ID} .sld-fitted{margin-top:6px;color:#8b9aa1;font-size:9px;line-height:1.5}
#${PANEL_ID} .sld-fitted b{color:#6fb582}
#${PANEL_ID} .sld-fitted b.sld-off{color:#ff5d5d}
#${PANEL_ID} .sld-ratio-note{margin-top:6px;color:#d9b45f;font-size:9px;line-height:1.5;
  border-left:2px solid #8b6c28;padding-left:6px}
#${PANEL_ID} .sld-tabs{display:flex;gap:5px;margin-bottom:8px}
#${PANEL_ID} .sld-tabs button{flex:1;background:#050a0d;border:1px solid #1d3238;color:#7f939a;
  font:inherit;font-size:9px;padding:4px;cursor:pointer;border-radius:3px;text-transform:uppercase}
#${PANEL_ID} .sld-tabs button[data-on="true"]{color:#5fbdc2;border-color:#5fbdc2}
#${PANEL_ID} .sld-grid{display:grid;grid-template-columns:1fr 62px;gap:3px 7px;align-items:center}
#${PANEL_ID} label{color:#8b9aa1;font-size:10px}
#${PANEL_ID} input,#${PANEL_ID} select{width:100%;background:#050a0d;border:1px solid #1d3238;
  color:#d8dee6;font:inherit;font-size:10px;padding:2px 4px;border-radius:2px}
#${PANEL_ID} input:focus,#${PANEL_ID} select:focus{outline:1px solid #5fbdc2}
#${PANEL_ID} .sld-out{margin-top:9px;padding-top:8px;border-top:1px solid #10262b;
  display:grid;grid-template-columns:1fr auto;gap:2px 8px}
#${PANEL_ID} .sld-out b{color:#e0b050;font-variant-numeric:tabular-nums}
#${PANEL_ID} .sld-out .lit{color:#5fbdc2}
#${PANEL_ID} .sld-warn{margin-top:7px;color:#d9963c;font-size:9px;line-height:1.45}
#${PANEL_ID} .sld-caveat{margin-top:7px;padding-top:7px;border-top:1px solid #10262b;
  color:#68797f;font-size:9px;line-height:1.5}
#${PANEL_ID} .sld-caveat b{color:#8b9aa1}
#${PANEL_ID} .sld-hint{margin-top:6px;color:#5f7a80;font-size:9px;line-height:1.45}
#${PANEL_ID} .sld-finance{margin-top:9px;border-top:1px solid #214047;padding-top:7px}
#${PANEL_ID} .sld-finance summary{min-height:32px;display:flex;align-items:center;cursor:pointer;
  color:#d9b45f;font-weight:bold;letter-spacing:.05em;user-select:none}
#${PANEL_ID} .sld-fin-grid{display:grid;grid-template-columns:1fr 76px;gap:3px 7px;align-items:center}
#${PANEL_ID} .sld-fin-section{grid-column:1/-1;margin-top:7px;padding-top:5px;
  border-top:1px solid #10262b;color:#5fbdc2;font-size:9px;text-transform:uppercase}
#${PANEL_ID} .sld-fin-grid input[type="checkbox"]{width:24px;justify-self:end}
#${PANEL_ID} .sld-fin-out{margin:8px 0;padding:7px;background:#050a0d;border:1px solid #1d3238;
  display:grid;grid-template-columns:1fr auto;gap:2px 8px}
#${PANEL_ID} .sld-fin-out b{color:#d9b45f;font-variant-numeric:tabular-nums;text-align:right}
#${PANEL_ID} .sld-fin-note{margin:6px 0;color:#8b9aa1;font-size:9px;line-height:1.5}
@media (max-width:700px){#${PANEL_ID}{width:auto;left:8px;right:8px;top:96px;bottom:8px}}
@media (pointer:coarse){
  #${PANEL_ID} .sld-tabs button,#${PANEL_ID} input,#${PANEL_ID} select,
  #${PANEL_ID} .sld-finance summary{min-height:44px}
}`;
  },
  fullscreenLayers() {
    return `.gridatlas-fs-layers{position:absolute !important;left:0;right:0;bottom:0;
      max-height:42vh;overflow:auto;z-index:9;background:rgba(2,8,11,.94);
      border-top:1px solid #0b5f63;backdrop-filter:blur(3px)}`;
  }
  });
})();
