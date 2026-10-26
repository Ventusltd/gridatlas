## Experimental branch-hosted preview — no change to production

**Candidate pinned to commit:** `fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d` (draft PR #30). This is the original un-hardened candidate generation `202610261949`, NOT Claude's improved build.

**Direct HTML test URL (third-party static proxy):**
https://raw.githack.com/Ventusltd/gridatlas/fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d/atlas/v/202610261949/index.html

### Basis for this preview route
The versioned loader `atlas/v/202610261949/index.html` and its `current.json` exist at this precise SHA, with relative paths to the original immutable release shell, cartridges and manifests. The raw.githack.com service is documented to serve GitHub HTML/JS/CSS with correct Content-Type; the pinned SHA prevents accidental version drift. Its HTML-entry anti-phishing interstitial might ask the reviewer to confirm once. This route neither modifies `main` nor updates the GitHub Pages live pointer, triggers a GitHub Pages deployment, changes `atlas/current.json`, or merges a PR.

### Strong limitations
**NOT a verified working/browser-acceptance-tested URL from this session.** Runtime DNS/network in the independent ChatGPT test container could not resolve raw.githack.com or ventusltd.github.io; external browser inspection could not retrieve the candidate. The service is an external third-party proxy, not a VentusLtd-owned deployment. It may fail or be blocked by network security products or origin/CORS/cache policy. It MUST NOT be described as a production-ready preview, release receipt, or evidence of working real device interaction.

If it opens: view original GridAtlas separately (https://ventusltd.github.io/gridatlas/atlas/), then compare visually. Lightning is OFF by default; look at the native Layers panel, scroll to the LAST group `Weather · EUMETSAT Lightning Imager`, select `Lightning flashes (optical)`; verify source/period, 12h/24h/48h/7d, click actual controls, confirm original menus/map/search/SLD still work. Data archive PR #2 is unmerged, so expect 7-day live feed fallback with honest gaps, not 12 months of complete history. Known bugs H01-H05 remain in this original candidate and are being investigated on Claude's separate branch; a visually opened page is NOT sign-off.

When Claude pushes a new immutable candidate generation and SHA, use its pinned `atlas/v/<new generation>/index.html` URL instead of referring to this old build. Real accessibility, phone Safari, and unmocked data are still outstanding owner/device acceptance gates.