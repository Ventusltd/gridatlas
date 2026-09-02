/* ══════════════════════════════════════════════════════════════════════
   PART 2 - the network, as its operator publishes it
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const GENERATION = '202609012045';
  const PRODUCT = 'https://raw.githubusercontent.com/Ventusltd/data-grid-gb/'
    + 'main/derived/connection-points.v3.json';
  const REQUIRED_SCHEMA = 'data-grid-gb.connection-points.v3';
  /* Appendix D publishes eight current metrics and they are NOT
     interchangeable, so one is quoted and named rather than any of them
     being called "the fault level".
     Codex, 202609011852: an earlier version of this comment and of the
     card said the RMS break current is "the one switchgear is rated
     against". That overclaims. Switchgear carries several relevant
     ratings - making capacity, short-time withstand, peak withstand -
     and this is ONE published breaker-duty metric among the eight. */
  const QUOTED_METRIC = 'three_phase_rms_break_current_ka';
  const QUOTED_METRIC_LABEL = 'three-phase RMS break current';
  const DEG = Math.PI / 180;

  const state = {
    schema: 'gridatlas.substation-intelligence.v2',
    generation: GENERATION,
    product: PRODUCT,
    loaded: false,
    points: 0,
    located: 0,
    product_schema: null,
    quoted_metric: QUOTED_METRIC,
    failures: []
  };
  window.__GRIDATLAS_NETWORK__ = state;

  /* ONE geodesy, and it is the module's.
     --------------------------------------------------------------
     This carried its own haversine using 2*R*asin(sqrt(a)) while the
     estate canonical form is R*2*atan2(sqrt(a), sqrt(1-a)). They
     agree algebraically and differ in the last place, and the
     difference was invisible for as long as this half of the
     cartridge was a monolith the all-versions scan could not read.
     202609012350 extracted it, the scan found it immediately, and
     the answer is not to retype the right form here but to stop
     having a second implementation at all. */
  const GEODESY = (window.__GRIDATLAS_MODULES__ || {}).geodesy;
  if (!GEODESY) throw new Error("substation-intelligence requires the geodesy module");
  const distanceKm = GEODESY.distanceKm;

  const NOISE = /\b(SUBSTATION|SUB STATION|SUBSTN|GRID|SUPPLY|POINT|GSP|NATIONAL|POWER|STATION|WIND|FARM|WINDFARM|OFFSHORE|ONSHORE|EXTENSION|400KV|275KV|132KV|66KV|33KV|11KV|NGET|SSE|SP|SHE)\b/g;
  function normalise(name) {
    return String(name || '').toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ').replace(NOISE, ' ')
      .split(/\s+/).filter(Boolean).join(' ');
  }

  const byName = new Map();
  const located = [];

  const ready = (async () => {
    try {
      const response = await fetch(PRODUCT, { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const product = await response.json();
      state.product_schema = product?.schema || null;
      if (product?.schema !== REQUIRED_SCHEMA) {
        state.failures.push('schema is ' + String(product?.schema)
          + ', this cartridge answers only ' + REQUIRED_SCHEMA);
        return false;
      }
      for (const point of product.connection_points || []) {
        const key = normalise(point.name);
        if (key && !byName.has(key)) byName.set(key, point);
        if (point.location) located.push(point);
      }
      state.points = (product.connection_points || []).length;
      state.located = located.length;
      state.counts = product.counts || null;
      state.join = product.join || null;
      state.source = product.source || null;
      state.loaded = true;
      return true;
    } catch (error) {
      state.failures.push('network product: ' + String(error?.message || error));
      return false;
    }
  })();
  state.ready = ready;

  state.byName = (name) => state.loaded
    ? (byName.get(normalise(name)) || null) : null;

  /* The owner product's coordinates are NOT used for anything a reader
     sees. Codex, 202609011852: WBUR's exact-name join binds a different
     West Burton 96.42 km from the project, and exact text equality is not
     exact identity. The Atlas measures on its own substation payload and
     always has; this stays available for callers that want it, marked,
     and the card is proven never to print a distance from here. */
  state.location_join_is_unverified = true;
  state.nearest = (lon, lat, options) => {
    if (!state.loaded) return null;
    const minimumKv = options?.minimumKv ?? 0;
    const limit = options?.limit ?? 1;
    const found = [];
    for (const point of located) {
      if (Math.max(...point.voltages_kv) < minimumKv) continue;
      found.push({ point, km: distanceKm(lon, lat, point.location.lon, point.location.lat) });
    }
    found.sort((a, b) => a.km - b.km);
    return limit === 1 ? (found[0] || null) : found.slice(0, limit);
  };

  /* One line a card can print, built only from what is published, or null
     when nothing is. An empty sentence about a substation is worse than
     silence. */
  /* connectionKv is the voltage the connection is actually made at: the
     declared point of connection's class, or the class of the substation
     being measured to. Given one, the fault current is quoted at THAT
     busbar group rather than across the site.

     An outside review put the reason plainly: fault duty at a 400 kV
     busbar and at a 132 kV busbar are different physical quantities
     governing different switchgear, so a range spanning both is
     meaningless to the engineer reading it - and the more correctly the
     metric is named, the more readily the eye trusts it. */
  state.summarise = (name, options) => {
    const point = state.byName(name);
    if (!point) return null;
    const connectionKv = options && Number(options.connectionKv);
    const parts = [];
    if (point.circuits) {
      parts.push(point.circuits + (point.circuits === 1 ? ' circuit' : ' circuits'));
    }
    if (point.transformers) parts.push(point.transformers + ' transformers');
    const rating = point.circuit_winter_rating_mva;
    if (rating) {
      /* The product does not split ratings by voltage, and a site with
         several voltages will show a range no single circuit could span -
         Blackhillock publishes 23 to 1,995 MVA. So it is marked site-wide
         wherever it appears, rather than sitting beside a bus-specific
         fault figure as though it shared its scope. */
      parts.push('circuit winter ratings across the site '
        + rating.min.toLocaleString('en-GB')
        + '\u2013' + rating.max.toLocaleString('en-GB') + ' MVA');
    }
    /* Prefer the busbar group the connection is made at. Fall back to the
       site-wide envelope only when the voltage is unknown or the product
       does not publish that group, and say which was used either way. */
    const byVoltage = point.fault_current_by_voltage || null;
    let peak = point.fault_current?.peak || null;
    let faultScope = 'site';
    let faultKv = null;
    if (Number.isFinite(connectionKv) && byVoltage) {
      const key = Object.keys(byVoltage)
        .find(k => Math.abs(Number(k) - connectionKv) < 0.5);
      if (key && byVoltage[key]?.peak) {
        peak = byVoltage[key].peak;
        faultScope = 'bus';
        faultKv = Number(key);
      }
    }
    const metric = peak?.metrics?.[QUOTED_METRIC];
    if (metric) {
      parts.push(QUOTED_METRIC_LABEL + ' ' + metric.min.toFixed(1) + '\u2013'
        + metric.max.toFixed(1) + ' ' + metric.unit
        + (faultScope === 'bus'
          ? ' at the ' + faultKv + ' kV busbars'
          : ' across every busbar at this site')
        + ' over ' + peak.scenarios + ' peak-demand rows'
        + (peak.locations?.length ? ' at ' + peak.locations.length
          + (peak.locations.length === 1 ? ' bus' : ' buses') : '')
        + (peak.winters?.length
          ? ' (' + peak.winters[0] + ' to ' + peak.winters[peak.winters.length - 1] + ')'
          : ''));
    }
    if (point.reactive_compensation?.units) {
      parts.push(point.reactive_compensation.units + ' reactive compensation units');
    }
    if (point.planned_changes) {
      const years = point.planned_change_years || [];
      parts.push(point.planned_changes + ' changes published for '
        + (years.length ? years[0] + '\u2013' + years[years.length - 1] : 'later years'));
    }
    if (!parts.length) return null;
    /* Everything above is aggregated at SITE CODE, not selected for a
       bus. Where a site carries more than one voltage the numbers span
       them, so the reader is told that before reading any of them -
       otherwise a sentence under a 400 kV point of connection reads as a
       400 kV result. West Burton is exactly this case: WBUR1 is 132 kV
       and WBUR4 is 400 kV, and its published fault range spans both. */
    const voltages = point.voltages_kv || [];
    /* Site-wide is now about what remains site-wide. Once the fault
       current is quoted at a busbar group, the label must not claim the
       whole sentence is site-wide - only the parts that still are. */
    const siteWide = voltages.length > 1;
    const busLocations = point.fault_current?.peak?.locations || [];
    return {
      site_code: point.site_code,
      transmission_owner: point.transmission_owner,
      voltages_kv: voltages,
      site_wide: siteWide,
      bus_locations: busLocations,
      fault_scope: faultScope,
      fault_kv: faultKv,
      scope_label: faultScope === 'bus'
        ? ('Fault current is quoted at the ' + faultKv + ' kV busbars, the '
           + 'voltage this connection is made at. Circuit counts, ratings, '
           + 'transformers and planned changes remain site-wide across the '
           + voltages.slice().sort((a, b) => b - a).join('/') + ' kV buses here')
        : (siteWide
          ? ('Site-wide published envelope across the '
             + voltages.slice().sort((a, b) => b - a).join('/') + ' kV buses at this site, '
             + 'not a value for any one bus')
          : ('Published for this site, which carries one voltage: '
             + (voltages[0] || '?') + ' kV')),
      sentence: parts.join(' \u00b7 '),
      metric_named: QUOTED_METRIC_LABEL,
      metrics_not_interchangeable: 'Appendix D publishes eight current '
        + 'metrics and they are not interchangeable; this is one published '
        + 'breaker-duty metric, and switchgear carries several relevant '
        + 'ratings besides it.',
      attribution: 'NESO Electricity Ten Year Statement 2025, appendices B and D, '
        + 'via Ventusltd/data-grid-gb',
      not_an_assessment: 'Published parameters. Not a statement about whether '
        + 'any project can connect here.'
    };
  };
})();
