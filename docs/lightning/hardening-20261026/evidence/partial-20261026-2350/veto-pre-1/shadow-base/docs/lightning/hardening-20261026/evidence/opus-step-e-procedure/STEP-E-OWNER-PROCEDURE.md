# Step E owner procedure: unmocked network and real devices (issue #32 §8 Step E, R07, R08)

Candidate: generation 202610261949, SHA fda6b10. The module, cartridge, loader and `current.json` the public route serves are byte-identical on main 3c5717e and fda6b10 (sha256 3ce0ddc1…, b7d4d665…, e1e403f6…, a3957e79…). Production `atlas/current.json` on 3c5717e still names 202609241334. Evidence: `evidence/opus-step-e-procedure/` (PROVENANCE.txt gives each artefact's harness).

**Nothing here is a Step E PASS.** The sandbox cannot run Step E: the proxy refuses CONNECT to ventusltd.github.io, CARTO tiles/glyphs, extensions.duckdb.org and cdn.jsdelivr.net (`curl/proxy-status-relay-failures.txt`), and there is no WebKit or device.

## 0. What the sandbox did establish (harness labelled)

| Fact | Harness | Evidence |
|---|---|---|
| Feed `raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson`: HTTP/2 200, 215,536 B, 408 features, `access-control-allow-origin: *`, `cache-control: max-age=300`, strong `etag`; `If-None-Match` repeat → **304** (22:56:41Z) | sandbox curl via proxy, not a browser | `curl/feed-resume.*` |
| `data/history/index.json` → **404** with ACAO `*`, no ETag (22:30Z): archive unpublished; the loader reads "HTTP 404", not a CORS failure | sandbox curl | `curl/raw-githubusercontent-index.*` |
| LAN http address: `crypto.subtle` undefined, "GRIDATLAS COMPOSITION FAILED … 'digest'"; 127.0.0.1 composes | Chromium headless, no shim, 393×852 | `secure-context-check.log` |
| Snippet: 0 requests, lightning state unchanged in 9/9 states, two identical runs | lead-shim, Chromium, 1440×900 | `snippet-validation-run3/` |
| Owner iPhone Safari, live Pages, 7D ON: 408 points and captions | LIVE real device | `wt/docs/lightning/hardening-20261026/evidence/owner-device-20261026/` |

With `max-age=300`, a repeat feed XHR within 5 minutes may come from browser cache (DevTools: "(disk cache)"); after 5 minutes it revalidates to 304. The index uses `cache:'no-cache'` (module line 46); a 304 is possible only once it exists with an ETag.

## 1. (a) Serve the candidate

Routes, in order of preference:

1. **Public Pages route (all devices, no setup):** `https://ventusltd.github.io/gridatlas/atlas/v/202610261949/`, published by main 3c5717e. It is HTTPS, so it is a secure context. The baseline for comparison is `https://ventusltd.github.io/gridatlas/atlas/`.
2. **Desktop localhost:** from the folder that contains the `gridatlas` clone, at fda6b10 or main 3c5717e:
   `python3 -m http.server 8000 --bind 127.0.0.1`
   Then open `http://localhost:8000/gridatlas/atlas/v/202610261949/` (candidate) and `http://localhost:8000/gridatlas/atlas/` (baseline).
3. **Android against the desktop server:** connect the phone over USB with USB debugging enabled, run `adb reverse tcp:8000 tcp:8000`, then open `http://localhost:8000/gridatlas/atlas/v/202610261949/` in Chrome on the phone. Localhost on the phone is a secure context.

Do **not** use `http://192.168.x.x:8000/…` or any LAN IP: it fails the loader's `crypto.subtle` check (atlas/index.html:28,70) and shows "GRIDATLAS COMPOSITION FAILED" — a test-route artefact, not a candidate fault. The iPhone uses route 1.

## 2. (b) Desktop Chrome HAR for the lightning requests

1. Guest window (no extensions). DevTools › Network: tick **Preserve log**, leave **Disable cache unticked** (the 304 test needs it), filter `raw.githubusercontent.com`.
2. Load the candidate; wait for map and Layers panel. **Check:** zero rows (OFF fetches nothing).
3. In the last Layers group, "Weather · EUMETSAT Lightning Imager", tick lightning, select **7D**, wait for `[408 | 7d]` or similar.
4. For each row note Status, response `access-control-allow-origin`, `cache-control`, `etag`, `content-length`, request `origin`/`if-none-match`. Expect `index.json` 404 (today) and `uk_lightning.geojson` 200.
5. Untick. **Check:** no new rows; points gone.
6. Wait ≥5 minutes after step 3, reload with F5 (not Ctrl+Shift+R). **Check:** no lightning rows until you tick again (reload = OFF). Tick, 7D: the feed shows **304** with `if-none-match` (or `(disk cache)` if under 5 minutes); `index.json` 404 again.
7. Console: no "blocked by CORS policy", no red errors from raw.githubusercontent.com. Paste the snippet (§5); save its JSON.
8. Network › download icon › **Export HAR (sanitized)** as `desktop-chrome-<version>-<route>-<UTC>.har`.

On the baseline route repeat steps 2 and 7 only, for the snippet's baseline numbers.

## 3. (c) Real-device checks: Android Chrome and iPhone Safari

Portrait, Pages route (or `adb reverse` on Android). One screenshot per step, named `<device>-<browser>-<step>-<HHMM>UTC.png`.

| Step | Action | Screenshot shows | What to look for |
|---|---|---|---|
| S0 | Open **baseline** route | baseline-rest | OFF-parity reference |
| S1 | Open **candidate** route | rest | Same as S0 |
| S2 | Tap **▴ LAYERS**, scroll to bottom | layers-open | 13 original groups in order (Topology first); "Weather · EUMETSAT Lightning Imager" last, row `[WAIT]` |
| S3 | Close Layers; tap **Grid** menu | grid-open | Original list unchanged; one lightning row at the panel foot |
| S4 | Tap lightning row, then **7D**; scroll to show captions | on-captions | Points, `[N | 7d]`, state line, seven caption lines incl. "…not confirmed ground strikes · Missing days are unknown, not zero" |
| S4b | Optional: **30D**, **12M** | on-12m | The owner's "stuck at 7 days" (feed fallback) |
| S5 | Untick | off | Matches S0 bar the Weather group; no points; captions hidden |
| S6 | Reload | reload | OFF, `[WAIT]` |

Android, after S1, S4, S5 and S6: desktop `chrome://inspect/#devices` › **inspect**, paste the snippet, save the JSON. iPhone needs Safari Web Inspector on a Mac (iPhone Settings › Safari › Advanced › Web Inspector; Mac Safari › Develop › <iPhone>); without one, record "snippet not run (no Mac)".

Note any visual difference between S0 and S1/S5, and whether **▾ HIDE LAYERS** covers the S4 captions (pre-existing overlap, already seen on the owner's iPhone, P14).

## 4. (d) Record device, browser and version

Fill in one block per device:

```
device:          <make model>             (Android: Settings › About phone; iPhone: Settings › General › About › Model Name)
os:              <Android 15 / iOS 19.x>  (iPhone: Settings › General › About › iOS Version; Safari = iOS version)
browser:         <Chrome 1xx.0.xxxx.xx>   (chrome://version on desktop and Android)
route:           <full URL> served by <Pages 3c5717e | localhost fda6b10 | adb reverse>
network:         <wifi/4G/5G>, VPN or content blockers: <none / name>
started/ended:   <UTC>
snippet ua:      <the "ua" field of the snippet JSON, if run>
```

## 5. The read-only console snippet

`evidence/opus-step-e-procedure/scripts/step-e-console-snippet.js`, 2,904 bytes, sha256 `8e725126fae5fd8dd0d79d22369aca7e73232a3f8023d7b9063dff0e0ee86def`. No clicks, requests or storage writes; prints one JSON block and copies it where `copy()` exists. Chrome may first ask you to type `allow pasting`.

```js
/* GridAtlas Step E probe (issue #32, fda6b10). READ-ONLY: no clicks, requests or storage writes. Prints one JSON block. */
(()=>{
const W=window,M=W.__GRIDATLAS_MODULES__||{},S=M.ukLightning?M.ukLightning.state:null;
const B=W.__GRIDATLAS_MAP_READY__||{},Q=W.__GRIDATLAS_PLACE_SEARCH__||{},A=W.__GRIDATLAS_ATLAS__||{},map=W.__GRIDATLAS_V9_MAP__;
const all=s=>[...document.querySelectorAll(s)],tx=e=>e?e.textContent.trim():null,hid=e=>!!e.closest('[hidden]');
const iso=v=>typeof v==='number'&&isFinite(v)?new Date(v).toISOString():null;
let L='module absent (baseline route?)';
if(S){
 const r=S.res;L={};
 for(const k in S){const v=S[k];if(v===null||(typeof v!=='object'&&typeof v!=='function'))L[k]=v;}
 Object.assign(L,{
  phase:S.on?'ON':S.requests?'OFF-after-ON':'OFF-never-ON',
  waiting_for:S.waiting_for,errors:S.errors,last:S.last,feed_cached:!!S.fp,
  index:S.idx?{generated_utc:S.idx.raw.generated_utc,cutoff:S.idx.cutoffDate,days:S.idx.days.length}:null,
  res:r?{mode:r.mode,from:iso(r.w.s),to:iso(r.w.e),drawn:(r.ev||[]).length,failed_files:(r.fl||[]).length,fail:r.fail||null}:null,
  surfaces:all('[data-lightning-control]').map(i=>i.closest('[data-lightning-group]').dataset.lightningGroup+'='+i.checked),
  labels:all('[data-lightning-label]').map(tx),
  status:all('[data-lightning-dot]').map(d=>hid(d)?'hidden':tx(d.parentNode)),
  captions:all('[data-lightning-caption]').map(c=>hid(c)?'hidden':[...c.children].map(tx)),
  map_layer:map&&map.getLayer('l-gridatlas-lightning')?map.getLayoutProperty('l-gridatlas-lightning','visibility'):null,
  map_source:!!(map&&map.getSource('gridatlas-lightning'))
 });
}
const st=map&&map.getStyle?map.getStyle():null,g='[data-lightning-group] ';
const out={
 t_utc:new Date().toISOString(),href:location.href,ua:navigator.userAgent,
 viewport:[innerWidth,innerHeight,devicePixelRatio],coarse:matchMedia('(pointer: coarse)').matches,secure:isSecureContext,
 generation:A.generation||null,sld_sha256:((A.loaded_cartridges||[]).find(c=>c.id==='sld-sandbox')||{}).sha256||null,
 menu_inspect:M.menuBar&&M.menuBar.inspect?M.menuBar.inspect():null,
 proxies:all('#gridatlas-menu-bar [data-gridatlas-layer-proxy]').length,
 markers:all('[data-gridatlas-layer-key]').length,
 inputs:[all('input[data-layer-id]').length,all('input[data-pn-layer]').length],
 leak:all([g+'[data-layer-id]',g+'[data-pn-layer]',g+'[data-gridatlas-layer-proxy]',g+'[data-gridatlas-layer-key]'].join()).length,
 fetch_name:W.fetch.name,
 intercepted_on_demand:B.intercepted_on_demand,
 bridge:{failures:B.failures||null,loaded:Object.keys(B.loaded_on_demand||{})},
 search:{ready:Q.ready,failures:(Q.failures||[]).length,geocoder_failures:(Q.geocoder_failures||[]).length},
 style_layers_sources:st?[st.layers.length,Object.keys(st.sources).length]:null,
 lightning:L
};
const j=JSON.stringify(out,null,1);console.log(j);try{copy(j)}catch(e){}return j.length+' chars';
})();
```

Expected (shim reference, not live truth):
- **Baseline:** `generation` 202609241334, `lightning` "module absent".
- **Candidate at rest and after reload:** generation 202610261949, `sld_sha256` b7d4d6657b1d…, `menu_inspect` {engine 60, pipeline 3, total 63, unique 63, complete true}, `proxies` 63, `markers` 63, `leak` 0, `fetch_name` "gridAtlasMaplibreWorkerFetch", `intercepted_on_demand` 0, `phase` "OFF-never-ON", `requests` 0, `map_source` false; `style_layers_sources` equal to the baseline's (shim: [100,56]).
- **Candidate ON:** `requests` 2, `ie` "HTTP 404", `res.mode` "feed", `map_source` true.
- **Candidate after OFF:** `map_layer` null, `map_source` false.

## 6. (e) PASS/FAIL criteria

**R07 — live CORS/cache of raw.githubusercontent.com** (desktop HAR plus one phone).
PASS needs all of: feed 200 with ACAO `*`; no CORS/network console error; points drawn with caption "archive not yet published: HTTP 404"; `cache-control` and `etag` present; after §2 step 6 the feed is a 304 to `If-None-Match` or a cache hit, never a fresh 215 kB 200 within 5 minutes; zero lightning requests while OFF and after reload until ON.
FAIL on any CORS error, status 0, "network error", missing ACAO, request while OFF, or lightning request to another host.
A PASS covers the **feed path only**: index 200/304 and `days/*.json` stay BLOCKED_DEPENDENCY until PR #2's archive is published.

**R08 — sandbox-blocked dependencies**, one verdict each per device, baseline vs candidate:
- *Tiles/glyphs:* PASS if candidate tiles and labels match the baseline at S0/S1/S5; missing on both = pre-existing/network, not a candidate FAIL.
- *DuckDB/REPD and search:* tick one REPD layer (e.g. Solar) and run one postcode search on both routes. PASS if the results match and the snippet shows `bridge.failures` null, `search.failures` 0; FAIL if the candidate differs.
- *iOS WebKit:* PASS only if S1–S6 all hold on iPhone Safari: no composition banner; 13 groups in order with Weather last; the Grid row is tappable and the panel stays open; ON draws points with seven captions; OFF matches S0; reload is OFF. Otherwise FAIL. The owner's 22:44 screenshot proves **transport and drawing work live on WebKit**: partial evidence, not covering OFF parity, Grid, reload or the snippet.

The owner's already-seen defects (inert 30D–12M chips in feed mode, "searched 2%", HIDE LAYERS occlusion) are D05/D06, D13 and P14 rows; they do not decide the WebKit verdict.

## 7. What stays BLOCKED until the owner runs this

| ID | Status now | What closes it |
|---|---|---|
| Step E (§8) | BLOCKED_DEPENDENCY | §2, §3 and §4 completed and filed |
| R07 feed path | BLOCKED_DEPENDENCY (partial evidence: sandbox curl and owner iPhone ON) | §2 HAR and console |
| R07 archive path (index 200/304, day shards) | BLOCKED_DEPENDENCY | archive published (not the owner's run) |
| R08 basemap tiles and glyphs | BLOCKED_DEPENDENCY | §3 S0/S1/S5 on a real device |
| R08 DuckDB/REPD and search | BLOCKED_DEPENDENCY | §6 R08 check |
| R08 iOS WebKit | BLOCKED_HARNESS (partial: transport works live on WebKit) | §3 on iPhone Safari |
| D16 live headers and cache | BLOCKED_DEPENDENCY | §2 |
| P08/P10/V7 on real devices (hit-tested ON/OFF/reload) | BLOCKED_HARNESS (Chromium emulation only) | §3 on Android and iPhone |
| §13.3 owner visual approval | OWNER_DECISION | owner signs after §3 |

Never record any of these as PASS from shim, curl or emulation evidence.

File the HAR, screenshots, snippet JSON and §4 blocks under `docs/lightning/hardening-20261026/evidence/owner-device-<YYYYMMDD>/` with a README naming route, SHA and UTC times.

Unknowns: the Pages route was not fetched from the sandbox (CONNECT 403), so "published by 3c5717e" rests on git plus the owner's screenshot. The 10-minute auto-refresh (module line 174) is out of scope here.
