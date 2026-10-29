// annotations.mjs: the source-only layer of tools/lightning/src: file sections and `///` comments, anchored to text in the
// M4 module ('A', variant layers) or, with in:'B', the M4b module (variant dots). Comment text is restored from the
// module's own history (the header and // comments stripped by build-M stage A1/A2 from L3 202610281340, the K
// 202610280950 comments trimmed in L) and from the build scripts that made each change (build-L3, build-M, build-M2,
// build-M3, build-M4, fixes-m4, build-M4b; lane reports named per change).

export const FILES = [
  { name: '00-header.js', at: null, head: `
UK lightning overlay: readable source. Build: node tools/lightning/build.mjs (docs/LIGHTNING-SOURCE.md).
Lines starting with /// (like this one) and the ///#if / ///#else / ///#endif variant blocks are source only; a line
ending in /// continues on the next line. Everything else ships byte for byte in atlas/modules/<GEN>-uk-lightning-overlay.js.
Variants: "layers" (M4 202610290045: the listed technologies' own REPD layers are switched on) and "dots" (M4b
202610290050: only the listed sites are drawn, as REPD-styled dots). @@GEN@@ is the generation stamp.

00 header: the shipped header comments, the IIFE, the aliases and the constants.` },
  { name: '01-helpers.js', at: "ymd=t=>new Date(t).toISOString()", head: `
01 helpers: date and number formatting, GeoJSON guards, the device cap, month arithmetic and the published state S.` },
  { name: '02-transport.js', at: 'note=m=>S.errors.push', head: `
02 transport: fetch for .json (no redirects, 15 s timeout that also covers the body), XMLHttpRequest for the live feed,
and the LRU of day/grid promises.` },
  { name: '03-index.js', at: 'vk=r=>{let n=r&&r.count', head: `
03 archive index v2 (Ventusltd/lightning data/history/index.json): every row validated; coverage from scan_windows.` },
  { name: '04-windows.js', at: 'wf=now=>{', head: `
04 windows and day files: UTC, end-anchored [start,end) windows; hourly or daily shard targets; a 4-wide fan-out.` },
  { name: '05-cells.js', at: "ok=f=>f&&f.type==='Feature'", head: `
05 flashes and cells: feature validation and de-duplication, month grids, the REPD land mask, the cell layer data.` },
  { name: '06-load.js', at: 'ff=async(w,now,reason)=>{', head: `
06 tiers: the live feed (7 days only), the archive overview (cells), the archive detail (points, budgeted).` },
  { name: '07-captions.js', at: 'cf=(r,now)=>{', head: `
07 state and captions: the state machine (cf) and the caption lines (cp). Unknown is never shown as zero.` },
  { name: '08-map.js', at: "mh=()=>{let m=window.__GRIDATLAS_V9_MAP__", head: `
08 map: the map handle, the card position, the cell layers, the point layers and the tap handler.` },
  { name: '09-card.js', at: "cd=(m,x,y,lb,ti,su,de,wh,o={})=>{", head: `
09 card: the docked card (flash, cell or REPD project), the cell card and the short flash ID.` },
  { name: '10-neon.js', at: "NP='gridatlas-lightning-neon'", head: `
10 nearest substations and the camera: the original's own measure drawn as its neon arrival in Lightning-owned layers,
and the framing rules (M2R-layout F1-F3, M2R-camera fix C, M2R-taps T1).` },
  { name: '11-repd-map.js', at: '/* ---- M4b: the listed REPD sites', in: 'B', head: `
11 REPD on the map, per variant: "layers" switches the listed technologies' own REPD layers on through their Layers
checkboxes (M3/M4); "dots" draws only the listed sites as REPD-styled dots and never touches a Layers control (M4b).` },
  { name: '12-repd.js', at: '/* ---- REPD projects near a tap (M2, M3)', head: `
12 REPD projects near a tap (M, M2, M3): the register, the filter chips, the list, the links and the project view.` },
  { name: '13-panel.js', at: 'BTN=(a,t,x)=>', head: `
13 panel: the Layers-panel group (main and fullscreen curtain), its label and status line, and the batched repaint pt.` },
  { name: '14-actions.js', at: 'sp=p=>{S.period=p;', head: `
14 actions: period, navigation, load, the ON/OFF switch, the toggle binding and the HIDE LAYERS clearance.` },
  { name: '15-install.js', at: 'ins=()=>{if(S.installed)return true;', head: `
15 install: after the menu bar, Pipeline News and the map exist; the public NS.ukLightning surface.` },
];

const N = (at, text, opt = {}) => ({ at, text, ...opt });
export const NOTES = [
  // ---------------------------------------------------------------- 00 header
  N('/* uk-lightning-overlay, generation', `
The L3 header, as written before build-M stage A1 shortened it to one line (generation 202610281340):
  EUMETSAT MTG Lightning Imager (L2-LFL) optical flashes, OFF by default, appended last to the original Layers panel
  and fullscreen curtain; no request, source, layer or listener until switched on; never persisted. Optical flashes are
  NOT confirmed ground strikes; a day never searched is unknown, never zero. Above the device cap the window draws as
  tappable ≈10 km cells (data/history/grid) within 30 km of a REPD site.
Rules trimmed from lightning history-window.mjs (data-plane/hourly-lookback-index-v2 @ f7db76c). No engine, Pipeline
News or menu-proxy attribute. Name glossary: docs/lightning/CANDIDATE-202610261949.md.
The shipped header comments below are part of the module bytes (the generation proof reads them).`),
  N("let MX=Math.max", `
Aliases (build-M A3): Math.max/min, Array.isArray, Date.parse (static, no this), appendChild and getBoundingClientRect
helpers, and U, the phrase every unknown count carries. NS is the shared window.__GRIDATLAS_MODULES__ namespace, the only
global this module writes.`),
  N("let GEN='@@GEN@@'", `
Identity and sources. GEN is stamped by the build. AR: the archive (index, days, grid) on Ventusltd/lightning main;
FEED: the 7-day live feed. TMO: the 15 s request timeout; BUDGET: the most points ever drawn; RQ: the most day files per
window (and the LRU size). PERIODS: [key, label, ms] or [key, label, -months]; custom = CUSTOM UTC dates. LONG: periods
that need the archive. COLOUR: status dot colour by state letter (LOADING, PARTIAL, UNKNOWN, BEFORE-ARCHIVE, FAIL).`),

  // ---------------------------------------------------------------- 01 helpers
  N("ymd=t=>new Date(t).toISOString()", `
ymd: UTC date; ds: date -> ms; Q: getElementById; E: throw. T/Ts: UTC minute/second text, 'unknown' if not finite.`),
  N("N=n=>Number(n).toLocaleString('en-GB')", `
N: grouped number; pl: plural; dm/hm/dt: short date, hh:mm, both; du: duration in h/min (LR-words W8: hours grouped);
hz: a window of 48 h or less (hour clip); de: end text; sv: "x of y searched"; lr: when the collector last ran and how far
it searched; F7: the live-feed flash phrase; AGO: age, via du (LR-words W6).`),
  N('ov=(a,b,c,d)=>', `
ov: overlap of [a,b) and [c,d); FC: FeatureCollection; bx: inside the UK box; isFC; tm: a flash's time (Z added when
missing); msg: an error's text, sanitised by cs (LR-security S3).`),
  N("ph=()=>{try{return matchMedia", `
The device point cap: 10,000 on a phone (coarse pointer or <= 700 px), else 40,000. Above it a window draws as cells.`),
  N('mm=(t,k)=>{', `
mm: t minus k calendar months, the day clamped to the target month (3M, 6M, 12M).`),
  N("S={schema:'gridatlas.module.uk-lightning-overlay.v1'", `
State machine (published as NS.ukLightning.state): installed, waiting_for, on, requests, errors, last; period, end and h
(the PREV/NEXT stack of window ends), from/to (CUSTOM), consent (LOAD POINTS), serial (cancels stale loads), idx/ie (index
and its error), res (the drawn result), sfs (the panel groups). lru: url -> {p: promise, sealed}.`),

  // ---------------------------------------------------------------- 02 transport
  N('gj=(u,cache,raw)=>', `
gj: fetch JSON (or bytes with raw) with the 15 s timeout covering the body; a redirect is refused; "HTTP n" on error.
M2 (build-M2 gj-abort): once its own timer has aborted, any rejection (a body stream that errors on abort, as the
bridge's may) is reported as the timeout, not as "Failed to fetch".`),
  N('gx=u=>{S.requests++', `
gx: the live feed by XMLHttpRequest (same timeout; a redirect is refused through responseURL).`),
  N('lg=k=>{if(!lru.has(k))return', `
lg/ls: LRU get and set, at most RQ entries.`),

  // ---------------------------------------------------------------- 03 index
  N('vk=r=>{let n=r&&r.count', `
vk: one index v2 row; parts are hourly days/YYYY/MM/DD/HH.json with integer counts; a bad row throws with its date.`),
  N('ni=raw=>{', `
ni: normalise the index: schema, observation, generated_utc, cutoff and the scan windows; by = date -> row; lost
(shard_lost) days are unknown, never searched.`),
  N('stale=(g,now,f=g)=>', `
stale: the archive last searched more than 4 h ago, or its index is dated more than 15 min after the device clock.`),
  N("li=q=>{if(!S.ip)", `
li: load the index once (q busts the cache after a mismatch); unsealed LRU entries are dropped when it changes.`),
  N('cv=(x,ws,we)=>{', `
cv: coverage of [ws,we) from scan_windows (union): f fraction searched, r runs, a/b first/last scan, d dates, u unknown
dates, l lost days, ny not yet searched (ms at the end), bf before the archive (ms), k known days, pp partly searched days.`),

  // ---------------------------------------------------------------- 04 windows
  N('wf=now=>{', `
wf: the window {s, e, span, atLatest, period, label, clamped, custom}; S.end anchors PREV/NEXT, CUSTOM uses whole UTC dates.`),
  N('tg=(row,ws,we)=>', `
tg: the shard targets of one index row inside the window (a daily file, or the hourly parts that overlap it).`),
  N('sh=(t,date)=>{', `
sh: fetch one day file (the HTTP cache is used only for a sealed day), check schema, date, count, bytes and sha256 against its index row.`),
  N('fr=async(rows,ws,we,sn)=>', `
fr: fan out over the shard targets, 4 at a time, abandoned when S.serial moves on; failures are kept per day.`),

  // ---------------------------------------------------------------- 05 cells
  N("ok=f=>f&&f.type==='Feature'", `
ok: a valid optical-flash Point inside the UK box with a finite time and a scalar id. co: collect the features of the
window, de-duplicated by id (or time and position), sorted by time; a.bad counts the rejected ones.`),
  N("gg=mo=>{if(!/^\\d{4}-\\d\\d$/.test(mo))", `
Cells: month grids grid/YYYY-MM.json (0.1°, per UTC day); a day counts only if coverage, count and sha256 match its index
row. LR-security S1: 2 MB cap, checked on the raw bytes before parsing. The const below stays const: test-engine asserts
its text (build-M A5 KEEP).`),
  N("LM=()=>{if(!LM.a)", `
Land mask: cells whose centre is within 30 km of an onshore REPD site, as run lengths over the 140 x 120 grid; totals keep
every cell. L3 (LR-bugs LRB1) dropped the REPD placeholder 49.766807,-7.55716 (OSGB 0,0): 5,508 -> 5,472 cells. The
const in the loop below stays const (build-M A5 KEEP).`),
  N('gd=async(rows,sn)=>{', `
gd: the cell layer data for the window's known days: n flashes in all cells, k drawn inside the mask, st days not yet in a
grid, e the refused month's reason (LR-bugs LRB3), T the glow floor = max(30, p95 of drawn cells). LRB2: if every grid day
is stale, fall back to the summary.`),

  // ---------------------------------------------------------------- 06 load
  N('ff=async(w,now,reason)=>{', `
ff: the live feed tier (7 days only); reason names why the archive was not used.`),
  N('lw=async(now,sn,q)=>{', `
lw: load a window: the index, then BEFORE-ARCHIVE, overview (cells) or detail (points). Within the device cap, 32 MB and
RQ files, points load for any window; above, cells draw and LOAD POINTS asks first (S.consent). arch counts whole UTC
days above 48 h (LR-bugs LRB4 + LR-numbers F1), J's hour clip at 48 h or less.`),
  N('let got=await fr(tf,w.s,w.e,sn)', `
A sha256 mismatch on an unsealed day means the archive is being rewritten: reload the index once, then say so.`),

  // ---------------------------------------------------------------- 07 captions
  N('cf=(r,now)=>{', `
cf: classify a result: FAIL, BEFORE-ARCHIVE, PARTIAL, UNKNOWN, READY·DETAIL, READY·OVERVIEW or EMPTY, with reasons.`),
  N('DN=r=>{let g=r.gd;', `
DN: the cell caption (LR-words W1 with LRB3's reason): what the map shows, what is counted but not drawn.`),
  N('cp=(r,now,k)=>{', `
cp: the caption lines window, days, actual, flashes, refresh, searched, warning and footer. Every number is either
measured or named unknown; a day never searched is never zero (complexity 82: see reports/V-maintain.md).`),

  // ---------------------------------------------------------------- 08 map
  N("mh=()=>{let m=window.__GRIDATLAS_V9_MAP__", `
mh: the original's MapLibre map (window.__GRIDATLAS_V9_MAP__), or null. sf: the text font the style already uses.`),
  N("HIT=SRC+'-hit'", `
pc: close the card and its neon layers. cs: strip format characters (bidi) and cap at 200 (LR-security). el: element
with inline style and text (DOM: shell classes, inline styles on own nodes only).`),
  N('cpos=()=>{let c=S.pp', `
cpos: dock the card at the bottom of the map like the original's (kv-card), lifted clear of the original's bottom
controls, never over the menu bar. M2R-layout F1 (MAJOR-1): an open card never rises above the container top + 320 px.
M2R-camera fix C (fixes-m4): on a map under 500 px tall with at least 300 px beside the card, the card docks right (c.sd).`),
  N('cx=()=>{let m=mh();pc();', `
cx: remove every Lightning source and layer.`),
  N("CS=SRC+'-cells'", `
Cells: REPD-style graduated core (n <= 3 about 1 px, faint) and a glow for the top 5 %, violet ramp on log10 n
(1/3/10/30/100/300); ids avoid 'l-'. RP: the original's project and substation layers, which win a tap; *glow* layers
never do (LR-taps F3). Cells sit below the original's projects.`),
  N('dw=(fc,cl)=>{', `
dw: one source, a points layer, an invisible 44 px hit layer and (clustered) count labels; hidden until data.`),
  N('tap=e=>{let m=mh();if(!S.on||S.busy', `
tap: a flash (or cluster) under the tap wins, then the nearest cell unless a project or substation of the original is
hit. No work while loading or with no hit layer (LR-regress m2, LR-taps F2). Other click handlers always run.`),
  N("let p=f.properties||{};if(p.cluster){let go=z=>(cm(m)", `
A cluster tap zooms in; cm(m) first drops the module's pending framing (M4, M2R-taps T1).`),
  N("let rq=S.pp&&S.pp.ps&&m.getLayer(NI[13])", `
dots: a tap on a drawn listed site opens that site's project view, as its row does.`, { in: 'B' }),
  N('if(h&&h.length){for(let q of h)S.ly', `
layers: a tap on a drawn REPD dot belongs to the engine and closes the card (as L3); the tapped dot's technology is handed
to the reader and every other layer this module switched on is released (M2R-l3regress MINOR M3-L1, fixes-m4).`),

  // ---------------------------------------------------------------- 09 card
  N("cd=(m,x,y,lb,ti,su,de,wh,o={})=>{", `
cd: the card. lb aria label, ti title, su summary, de detail, wh what was tapped ("optical flash" | "cell centre" |
"project"); o: np (no REPD list: the project view), open, foot, back [label, action], g (dots: the site to draw).
c.re re-opens the same card (for "◀ back"); the title wraps (LR-layout). M2R-layout F3: re-frame on expand, collapse and
minimise. M2R-a11y MAJOR-1: one visually hidden polite status region per card, outside the closed <details>.`),
  N('cb=p=>{let c=p.cell', `
cb: a cell's south-west corner, only for a well-formed cell of the drawn result (LR-security S2: safe-integer n).
cc: the cell card (LR-words W3: "N optical flashes in this ≈10 km cell").`),
  N('sid=s=>{', `
sid: short ID = product sensing window + flash index (W_XX-..._<start>_<end>_N__..._0000:<index>); the full ID stays
in the detail line.`),

  // ---------------------------------------------------------------- 10 neon and camera
  N("NP='gridatlas-lightning-neon'", `
The neon layer and source ids; the REPD ones (p-*) join the set so close, period, LATEST and OFF remove them too (build-M
B1; dots adds p-glow, p-dot and the pdots source).`),
  N('nr=(m,c,x,y)=>{', `
nr: nearest substations: the original's own measure (__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations: >= 33 kV,
<= 40 km, 5 links) drawn as its neon arrival (glow, core, two flow layers, teal nodes, labels, pale origin ring; kv-neon)
in Lightning-owned layers, in the technology colour #d8c96a. link.selectAt is not used: it treats its origin as a project
(stale project reference, cancelled arrivals, a false arrival record; kv-arrival-api). S.fk: the points to frame.`),
  N('if(!c.o.np)Rp(m,c,x,y,M);', `
The REPD list runs for lightning cards only, never in the project view (build-M2 nr-repd).`),
  N("let rm=false;try{rm=matchMedia('(prefers-reduced-motion", `
Flow: the cartridge's own 24 frozen dash patterns (measure.flowDash) when present; off under reduced motion.`),
  N('nf=(m,c,x,y,n)=>{', `
nf: fired on the tap; retried every 2 s (15 times) while the same card is open if the substation list is not loaded yet.
The project view always flies to the project, even with no substation within 40 km (build-M2 nf-fly).`),
  N('cw=()=>Promise.resolve()', `
M4 (M2R-taps MAJOR T1): MapLibre 3.6.2's stop() fires moveend synchronously, so a pending once('moveend', ck) ran its
fitBounds nested inside the next camera move, left an orphan render frame and froze redraws after fast row/back cycles.
cw: the pending framing runs in a microtask after the stop that fired it, only when the map is then not moving.
cm: every module camera move first drops the module's pending framing (nz, ck, RpR, the cluster zoom, the fit button).`),
  N('nz=(m,x,y)=>{try{cm(m)', `
nz: the original arrival's flyTo (zoom 12, 1200 ms), then frame at moveend.`),
  N('ck=f=>{try{let m=mh()', `
ck: frame S.fk when an end is outside the free area (screen pixels: x 20..W-R+20, y T-20..H-B), or always with f === 1
(M2R-layout F2). Padding: top 150, sides 40, bottom card + 24 capped at H-270 only when L3's fit is impossible
(M2R-diff MD1); docked card (c.sd, fix C): top 60, right card width + 32, bottom 100.`),

  // ---------------------------------------------------------------- 12 repd
  N('Rp=(m,c,x,y,M)=>{', `
Rp: the REPD list of a lightning card: every register row is measured once (all 10,784 rows), then RpR renders it.`),
  N('RpR=(m,c,pd,box)=>{', `
RpR: render the list for the current filter (MR3: ties with the 10th site are kept), the summary, the chips, the rows,
the links and the camera. Every filter press re-renders it.`),
  N("let lt=RpU(P.flatMap(g=>g.parts)", `
layers (M3): switch on the listed technologies' layers (Ry), name them on the card.`),
  N("c.ps=P;if(P.length)ap(box", `
dots (M4b): keep the drawn list for dot taps and say what the map shows.`, { in: 'B' }),
  N('RpV=(m,c,g)=>{', `
RpV: the project view of one site (a row or, with dots, a dot tap).`),

  // ---------------------------------------------------------------- 13 panel
  N('BTN=(a,t,x)=>', `
BTN/NAV/DATE: the panel controls, in the shell's own classes. bg: build one panel group (key = main | fs); the menu's
bubble-phase click closer never sees these controls.`),
  N('txt=(n,s)=>', `
txt/flag: write only on change. lt: the Layers label ("Lightning Flashes (Optical) [...]"); sl: the status line.`),
  N('pt=loading=>{', `
pt: one batched repaint of every group: toggle, label, chips, CUSTOM, PREV/NEXT/LATEST, status dot and captions; S.last
is the published summary.`),

  // ---------------------------------------------------------------- 14 actions
  N('sp=p=>{S.period=p;', `
sp: choose a period (resets the PREV/NEXT stack and the LOAD POINTS consent).`),
  N('fb=()=>{let e=S.res&&S.res.ev', `
fb: the fit button: frame every drawn flash (a camera move: cm first).`),
  N('nv=(which,sf)=>{', `
nv: PREV, NEXT, LATEST, FIT, LOAD POINTS and CUSTOM apply. LATEST closes the card and its links (LR-taps F1).`),
  N('ld=refresh=>{', `
ld: load and draw the current window; a newer load (S.serial) or OFF discards this one. The cell layer draws in its own
try, so a failed cell layer never marks the load FAIL (LR-regress m1). A period or page change closes the card.`),
  N('so=on=>{if(S.on===on)return;', `
so: switch ON (first request, map click listener, 10-minute refresh while at LATEST) or OFF (everything removed).`),
  N("bt=c=>c.addEventListener('change'", `
bt: the panel's change listener (toggle). layers: a reader's tick or untick of a layer this module holds makes it the
reader's (the module's own dispatch runs with S.lyx set).`),
  N('fit=()=>{let d=Q(', `
fit: keep Lightning-owned text clear of the shell's fixed HIDE LAYERS button (its live rect + 16 px; 96 px if absent).`),

  // ---------------------------------------------------------------- 15 install
  N('ins=()=>{if(S.installed)return true;', `
ins: install after the menu bar, Pipeline News and the map exist; appended last to the Layers panel and the fullscreen
curtain. Polled every 250 ms and on DOM mutations until it succeeds.`),
  N('NS.ukLightning=Object.freeze(', `
The public surface: schema, generation, state, install, setOn, load, windowFor.`),
];
