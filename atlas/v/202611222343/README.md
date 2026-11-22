# GridAtlas V9.197 — repair fullscreen Layers curtain

Owner iPhone defect: the floating HIDE LAYERS button in V9.196 changed the original SCADA wrapper's `collapsed` state even in fullscreen, where the layer controls are instead owned by the original `#fs-curtain` and `#fs-curtain-tab`. The button label changed but no visible panel opened.

This successor preserves the full V9.196 rescue source (first 3,865 bytes unchanged) and adds one guarded adapter at the end. In normal view the original SCADA toggle and listeners are unchanged. In genuine or CSS-only Safari fullscreen, clicking the **same floating button** fires the original GridAtlas curtain-tab handler, displays/hides the actual curtain, and updates visible/accessible labels. In real fullscreen the original curtain (with its listeners intact) is moved into the fullscreen element, not cloned. The original Grid Engine, Vicinity 30/30/30 and A4/PDF link machinery are untouched.

CI must compare V9.195's working native curtain against V9.196's broken button in fullscreen, then prove V9.197's *actual panel visibility*, touch hit targets and original layer checkbox synchronisation in Chromium/WebKit phone portrait and landscape. SHA-pinned source-only independent twin mandatory; no missing or truncated files. Physical iPhone Safari remains owner acceptance, not claimed by headless browser.
