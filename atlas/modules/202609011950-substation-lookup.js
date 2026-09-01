/**
 * Module: substation-lookup
 *
 * Finding a substation by the name someone wrote, and by position. Two
 * jobs, one boundary:
 *
 *   normalise(name)   the lookup key, matching the one data-grid-gb's own
 *                     join uses, so a name that matched there matches here
 *   index(points)     a name map and a located list, built once
 *   nearest(...)      the closest located sites, measured on the estate's
 *                     single radius via the geodesy module
 *
 * It does NOT fetch, render, summarise or decide. The cartridge fetches;
 * the summary module writes sentences; this only finds.
 *
 * Depends on: geodesy.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.substationLookup) return;

  const geodesy = NS.geodesy;
  if (!geodesy) {
    // Fail loudly at load rather than quietly at first use: a module whose
    // dependency is missing has nothing useful to do.
    throw new Error('substation-lookup requires the geodesy module');
  }

  /* Deliberately dull. This is a lookup key, not a search engine, and it
     must stay byte-compatible with the normalisation the owner product's
     join uses - if the two drift, a name that joined upstream stops
     resolving downstream and nobody sees it happen. */
  const NOISE = /\b(SUBSTATION|SUB STATION|SUBSTN|GRID|SUPPLY|POINT|GSP|NATIONAL|POWER|STATION|WIND|FARM|WINDFARM|OFFSHORE|ONSHORE|EXTENSION|400KV|275KV|132KV|66KV|33KV|11KV|NGET|SSE|SP|SHE)\b/g;

  function normalise(name) {
    return String(name || '').toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(NOISE, ' ')
      .split(/\s+/).filter(Boolean).join(' ');
  }

  function index(points) {
    const byName = new Map();
    const located = [];
    for (const point of points || []) {
      const key = normalise(point && point.name);
      if (key && !byName.has(key)) byName.set(key, point);
      if (point && point.location) located.push(point);
    }
    return {
      size: byName.size,
      located: located.length,
      byName: (name) => byName.get(normalise(name)) || null,
      /* Nearest by measurement, not by guess. minimumKv filters on the
         highest voltage the site declares; limit 1 returns one match or
         null, anything else returns a sorted list. */
      nearest: (lon, lat, options) => {
        const minimumKv = (options && options.minimumKv) || 0;
        const limit = (options && options.limit) || 1;
        const found = [];
        for (const point of located) {
          const voltages = point.voltages_kv || [];
          if (!voltages.length || Math.max(...voltages) < minimumKv) continue;
          found.push({
            point,
            km: geodesy.distanceKm(lon, lat, point.location.lon, point.location.lat)
          });
        }
        found.sort((a, b) => a.km - b.km);
        return limit === 1 ? (found[0] || null) : found.slice(0, limit);
      }
    };
  }

  NS.substationLookup = Object.freeze({
    schema: 'gridatlas.module.substation-lookup.v1',
    normalise,
    index
  });
})();
