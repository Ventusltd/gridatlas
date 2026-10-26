# Independent owner-iPhone review — standalone Lightning 202610262323

**Evidence:** Six owner-supplied 26 Oct 2026 ~23:48–23:49 UTC iPhone Safari-in-app-browser screenshots in the ChatGPT conversation (12H, 24H, 48H, 7D, 6M, 12M). A seventh screenshot is unrelated LinkedIn activity and was NOT used. Original PNG bytes are conversation attachments, not committed to GitHub by this review. The app is the public standalone route \`https://ventusltd.github.io/gridatlas/atlas/v/202610262323/\`. This is **real owner-device evidence** rather than a local browser simulation. Snapshot served is generation 202610262323; published \`atlas/current.json\` remains 202609241334.

## Actual observations on the same phone
| Requested window | Label in image | Visible optical points | Evidence |
|---|---|---|---|
| 12H | UNKNOWN · 12h | none | Screenshot in conversation |
| 24H | UNKNOWN · 24h | none | Screenshot in conversation |
| 48H | PARTIAL · 3 FLASHES DRAWN · SEARCHED UNKNOWN | none obvious at current map extent | Screenshot in conversation |
| 7D | PARTIAL · 408 FLASHES DRAWN · SEARCHED UNKNOWN | many points | Screenshot in conversation |
| 6M | PARTIAL · 408 FLASHES DRAWN · SEARCHED UNKNOWN | many points | Screenshot in conversation |
| 12M | PARTIAL · 408 FLASHES DRAWN · SEARCHED UNKNOWN | many points | Screenshot in conversation |

Do not equate count equality with genuine 12-month archival coverage. In feed mode \`ff()\` filters the single currently available seven-day GeoJSON against the selected larger window. That yields a legitimate observed-subset count of 408 in 7D/6M/12M, but **earlier months are UNKNOWN, not empty or zero**.

The genuine \`Ventusltd/lightning@main:data/uk_lightning.geojson\` at this review contains 408 features, with earliest \`2026-10-21T12:32:19.282Z\`, latest \`2026-10-25T11:15:58.149Z\`, query end \`2026-10-26T20:30:09.316Z\`. Its actual last-48h filtered features at 2026-10-26T23:48 UTC are exactly:
- 2026-10-25T03:28:34.229Z, lon -4.212, lat 55.374302
- 2026-10-25T04:12:28.190Z, lon -5.4351, lat 55.306801
- 2026-10-25T11:15:58.149Z, lon -4.4874, lat 55.1637

Those locations are western Scotland and may be OUTSIDE/behind the northern edge of the owner's unchanged map viewport. This is **not yet proven a map plotting defect**. Do not auto-pan the original map unasked; consider an explicit Lightning-owned *FIT FLASHES* affordance or a clear "3 flashes outside current view" message if a map-bounds test confirms.

## Screenshot-confirmed issues and verdict

**M01 — FAIL: bottom-right HIDE LAYERS obscures the required caption.**
Across all six screenshots, the status line + UTC Window line pass behind the fixed native HIDE LAYERS button. Caption's important lower lines (Actual first/last, archive availability, refreshing status, optical/not-ground-strike source disclaimer) are not legibly exposed. The standalone candidate's \`atlas/modules/202610262323-uk-lightning-overlay.js\` installs the main group with \`main.group.style.paddingBottom='64px'\`, but that does not prevent *horizontal overlap with the button* or ensure last-caption reachability in the existing scroll viewport. The original release shell CSS has \`.scada-wrapper {max-height:38vh}\` and \`.scada-keys {display:grid; grid-template-columns:1fr 1fr; overflow-y:auto}\`. The required solution must be Lightning-owned only: add a suitable group grid-column span + layout width/containment and reserve/reflow the right/bottom button hit region *inside* the new group, or place its evidence within a scrollable Lightning sub-area entirely clear of the native control. Do not move original HIDE LAYERS button or change immutable shell/CSS. Test with actual \`getBoundingClientRect()\`, \`elementFromPoint()\`, scroll-to-bottom, and screenshots: at 393×852, 390×844, 360×740, and the owner's actual iPhone viewport; footer, every caption line and 44px button must be reachable, visible and unobstructed in BOTH main Layers and fullscreen curtain.

**M02 — FAIL/UX: 12M and 6M labelling implies a full-window plotted count without enough coverage context.**
The \`lt()\` label says \`Lightning flashes (optical) [408 | 12m]\` / \`[408 | 6m]\`. The main visible line \`PARTIAL · 408 FLASHES DRAWN · SEARCHED UNKNOWN\` is good, but does not independently reveal this is **only available 7-day-feed data**. Show near the period selector \`408 seen in available 7-day feed · 12 months requested · older history UNKNOWN (archive not published)\` (appropriately concise). Include actual oldest/latest observation UTC in legible view. On no observed detections in the selected 12H/24H with unknown search coverage, do not suggest definitively \`0 lightning\`.

**M03 — NEEDS_VIEWPORT_CHECK: 48H says three drawn; none obvious in screenshot.** Direct feed verification shows 3 genuine flashes off western Scotland (coordinates above). Capture \`map.getBounds()\`, \`map.project(coords)\`, \`map.getSource('gridatlas-lightning')\`, and actual layer visibility after choosing 48H. Prove whether these 3 are rendered outside current camera; if yes, pass transport/count but flag weak discoverability. Do not report lost data unless in-viewport points genuinely fail to paint. Independently verify 7D points appear; screenshot already supports yes.

**M04 — FAIL/UX: caption legibility.** Candidate uses \`font:10px/1.5 'Courier New'\` and 9px on disclaimer in a narrow iPhone embedded browser; screenshot shows faint hard-to-read grey on black and abbreviated/slivered text. Prefer Lightning-owned font sizing 12–13px and stronger contrast, wrap ordinary text, with compact headline separately. Confirm scrolling and unaffected native layer/menu typography.

**M05 — KNOWN INDEPENDENT RED: H08 artificial feed coverage state.** Published candidate contains \`cp()\`'s truthful \`L.searched='Searched EUMETSAT unknown ...'\` feed branch followed by a generic \`const c=r.cov;if(c)\` that overwrites it with an invalid searched percentage whenever \`r.mode==='feed'\` but \`cov\` exists. Actual feed \`cov:null\` so screenshots correctly read \`SEARCHED UNKNOWN\`; do not mark H08 fixed merely because normal snapshots look good. The independent Testcode Node VM failure reproduces this exact oversight. Fix in NEW immutable generation and rerun untouched H08.

## Stop/go
**NO LIVE RELEASE.** Standalone preview works on owner iPhone, but M01 remains hard visual veto, M02/M04 need UI clarity, M03 needs viewport investigation and H08 is still independently RED in a hostile/edge fixture. Release V6/V7/V8/V10 gates not green. Do not overwrite immutable preview 202610262323: create a new generation/PR, rerun all V1–V15 and owner iOS Safari review.

No screenshot, quote, timestamp, status or provenance is claimed beyond the genuine attached images and pinned feed.