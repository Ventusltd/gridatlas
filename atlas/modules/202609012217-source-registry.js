/**
 * Module: source-registry
 *
 * "Click anywhere on a map and the neons that already work via Pipeline News
 * look for cartridges and code." — Vikram, 2026-09-01.
 *
 * The looking is this module. The Atlas is a composition of cartridges that
 * find each other through `window.__GRIDATLAS_*` globals, and the deep scan
 * of 1 Sep 2026 found fifteen such surfaces ever registered, thirteen live,
 * and nothing anywhere that documents them. Every consumer therefore does
 * its own `window.__GRIDATLAS_NETWORK__?.something` and quietly does less
 * when the answer is undefined. That is how a click on blank space came to
 * report only what OpenStreetMap has mapped, while the cartridge holding
 * NESO's 886 published connection points sat loaded in the same page.
 *
 * So: one registry, declared once, that answers three questions.
 *
 *   WHAT COULD ANSWER      the sources this estate knows about, each with
 *                          what it contributes and whether it is required.
 *   WHAT IS ANSWERING NOW  probed live, by looking for the surface AND the
 *                          specific capability, because a cartridge that
 *                          has loaded but not yet fetched is present and
 *                          not yet useful, and those are different states.
 *   WHAT DID NOT           named, with the reason, in the result itself.
 *
 * The third is the point. A reader who is told "3 of 4 sources answered;
 * NESO's published network did not, because its payload had not loaded" can
 * judge the answer. A reader shown a shorter answer cannot, and will
 * reasonably assume the map has told them everything it knows.
 *
 * It reads. It never fetches, never renders, and never decides what a
 * finding means.
 *
 * Successor to 202609012135 at generation 202609012217: every source that
 * fetches a product declares what it REQUIRES (repository, product, schema)
 * and the survey carries that in every state, because a contract stated
 * only once the load has succeeded is no help to the reader of a failure.
 * The GB price rollup, fetched since v9.41 without a row here, is
 * registered with the loader state the sandbox now publishes.
 *
 * Depends on: nothing.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.sourceRegistry) return;

  /* The registry is DECLARED, not discovered by scanning window.
     ----------------------------------------------------------------------
     Enumerating every __GRIDATLAS_* global would report whatever happens to
     be there, including surfaces this estate has never agreed to consume,
     and would silently start using a new one the day someone adds it. A
     declared list is a contract: adding a source is an edit here, with a
     reason, and a proof that the probe actually works. */
  const SOURCES = [
    {
      id: 'map',
      surface: '__GRIDATLAS_V9_MAP__',
      contributes: 'the map itself: where the click happened, and what is drawn',
      probe: (w) => (w.__GRIDATLAS_V9_MAP__ ? 'ready' : 'absent')
    },
    {
      id: 'mapped-substations',
      surface: '__GRIDATLAS_NEON_LINKS__',
      contributes: 'substations as OpenStreetMap has them mapped, and the '
        + 'measurement the neon links already use',
      probe: (w) => {
        const links = w.__GRIDATLAS_NEON_LINKS__;
        if (!links) return 'absent';
        if (typeof links.measure?.distanceKm !== 'function') return 'loaded, cannot measure';
        if (!links.substations_loaded) return 'loaded, no substations yet';
        return 'ready';
      },
      detail: (w) => ({ substations: w.__GRIDATLAS_NEON_LINKS__?.substations_loaded || 0 })
    },
    {
      id: 'neso-connection-points',
      surface: '__GRIDATLAS_NETWORK__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/connection-points.v3.json',
        schema: 'data-grid-gb.connection-points.v3' },
      contributes: "NESO's published connection points: circuits, transformers, "
        + 'per-voltage fault current and planned changes',
      probe: (w) => {
        const network = w.__GRIDATLAS_NETWORK__;
        if (!network) return 'absent';
        if (network.failed) return 'failed to load';
        if (!network.loaded) return 'loading';
        return 'ready';
      },
      detail: (w) => ({ connection_points: w.__GRIDATLAS_NETWORK__?.count || null,
        schema: w.__GRIDATLAS_NETWORK__?.schema || null })
    },
    {
      id: 'grid-scope',
      surface: '__GRIDATLAS_MODULES__.gridScope',
      contributes: 'the census of what is mapped around a point, in distance bands',
      probe: (w) => (w.__GRIDATLAS_MODULES__?.gridScope ? 'ready' : 'absent')
    },
    {
      id: 'network-topology',
      surface: '__GRIDATLAS_MODULES__.networkTopology + __GRIDATLAS_TOPOLOGY__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/gb-transmission-network.v1.json',
        schema: 'data-grid-gb.transmission-network.v1' },
      contributes: 'circuits, transformers, planned changes and neighbouring '
        + 'sites at a named substation, per voltage',
      /* Generation 202609012135: the module alone is not the source. At v9.67
         this probe said "ready" because the module object existed, while
         the ten-megabyte product it indexes had never been fetched by any
         cartridge - the module was on disk and answered nothing. Ready now
         means the product is indexed; idle means it will load on the first
         click that asks; the other states are what the loader says. */
      probe: (w) => {
        if (!w.__GRIDATLAS_MODULES__?.networkTopology) return 'absent';
        const loader = w.__GRIDATLAS_TOPOLOGY__;
        if (!loader) return 'module present, no loader in this composition';
        if (loader.state === 'ready') return 'ready';
        if (loader.state === 'loading') return 'loading';
        if (loader.state === 'failed') return 'failed to load';
        return 'idle, loads on first use';
      },
      detail: (w) => ({ sites: w.__GRIDATLAS_TOPOLOGY__?.sites || null,
        bytes: w.__GRIDATLAS_TOPOLOGY__?.bytes || null,
        schema: w.__GRIDATLAS_TOPOLOGY__?.schema || null })
    },
    {
      id: 'declared-connections',
      surface: '__GRIDATLAS_MODULES__.declaredConnections',
      contributes: 'points of connection bound to a made Order or a published '
        + 'planning document',
      probe: (w) => (w.__GRIDATLAS_MODULES__?.declaredConnections?.count > 0 ? 'ready' : 'absent'),
      detail: (w) => ({ records: w.__GRIDATLAS_MODULES__?.declaredConnections?.count || null })
    },
    {
      id: 'gb-electricity-conditions',
      surface: '__GRIDATLAS_GB_CONDITIONS__',
      contributes: 'the GB wholesale price context a project card carries: '
        + 'negative-price days and the record daily mean, from the owner rollup',
      requires: { repository: 'Ventusltd/data-gb-electricity',
        product: 'derived/price-decade-rollup.json',
        schema: 'data-gb-electricity.price-decade-rollup.v2' },
      /* Withheld is its own state: the product was reached and was not the
         schema this consumer answers, so the panel shows nothing and says
         why. That is neither a failure of the network nor a source ready. */
      probe: (w) => {
        const loader = w.__GRIDATLAS_GB_CONDITIONS__;
        if (!loader) return 'absent';
        if (loader.state === 'ready') return 'ready';
        if (loader.state === 'loading') return 'loading';
        if (loader.state === 'failed') return 'failed to load';
        if (loader.state === 'withheld') return 'withheld: ' + String(loader.reason || 'schema not supported');
        return 'idle, loads on first use';
      },
      detail: (w) => ({ schema: w.__GRIDATLAS_GB_CONDITIONS__?.schema || null,
        renders: w.__GRIDATLAS_GB_CONDITIONS__?.renders || 0 })
    }
  ];

  const READY = 'ready';

  /**
   * Probe every declared source against a window.
   * @param scope  the window to read; defaults to this one. Passing it in is
   *               what lets a proof drive the probe without a browser.
   */
  function survey(scope) {
    const w = scope || window;
    const sources = SOURCES.map((source) => {
      let state = 'absent';
      let detail = null;
      try { state = source.probe(w) || 'absent'; }
      catch (error) { state = `probe threw: ${error && error.message}`; }
      if (state === READY && typeof source.detail === 'function') {
        try { detail = source.detail(w); } catch (_) { detail = null; }
      }
      return { id: source.id, surface: source.surface,
        contributes: source.contributes, requires: source.requires || null,
        state, ready: state === READY, detail };
    });

    const ready = sources.filter(s => s.ready);
    const missing = sources.filter(s => !s.ready);

    return {
      schema: 'gridatlas.module.source-registry.v1',
      sources,
      ready: ready.map(s => s.id),
      missing: missing.map(s => ({ id: s.id, state: s.state })),
      counts: { declared: sources.length, ready: ready.length, missing: missing.length },
      /* Written as a sentence here so a card cannot compose its own and get
         it wrong, and so an absence is never presented as an absence in the
         world rather than in this page. */
      sentence: missing.length === 0
        ? `All ${sources.length} sources answered.`
        : `${ready.length} of ${sources.length} sources answered. Not answering: `
          + missing.map(s => `${s.id} (${s.state})`).join(', ')
          + '. What they would have added is missing from this answer, not '
          + 'absent from the world.'
    };
  }

  /** Is one source usable right now. */
  function ready(id, scope) {
    const source = SOURCES.find(s => s.id === id);
    if (!source) return false;
    try { return source.probe(scope || window) === READY; }
    catch (_) { return false; }
  }

  NS.sourceRegistry = Object.freeze({
    schema: 'gridatlas.module.source-registry.v1',
    declared: SOURCES.map(s => s.id),
    survey,
    ready
  });
})();
