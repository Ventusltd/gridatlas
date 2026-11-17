// Bounded public-map attachment. No private card closures, new map or network fetch.
const registry = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (!registry.gridJourneyPreview) {
  let controller = null, timer = null, attempts = 0, stopped = false;
  function mount(map = window.__GRIDATLAS_V9_MAP__) {
    stopped = false;
    if (controller?.snapshot().alive) return controller;
    controller = null;
    controller = createJourneyController({map, document, window, planner: JourneyEngine.planJourney, fixture: JourneyFixture, css: JourneyCSS, generation: JourneyGeneration});
    return controller;
  }
  function attach() {
    if (stopped) return;
    if (window.__GRIDATLAS_V9_MAP__) { try { mount(); } catch (e) { console.warn('[Grid Journey preview]', e.message); } return; }
    if (++attempts < 120) timer = setTimeout(attach, 250);
    else console.warn('[Grid Journey preview] native map unavailable; no replacement map created');
  }
  registry.gridJourneyPreview = Object.freeze({schema: 'gridatlas.journey.preview.v1', generation: JourneyGeneration, mount, open(options) { return mount().open(options); }, setOrigin(origin) { return mount().setOrigin(origin); }, snapshot: () => controller?.snapshot() || {status: 'map-unavailable'}, destroy() { stopped = true; clearTimeout(timer); controller?.destroy(); controller = null; }});
  attach();
}
