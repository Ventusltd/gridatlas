(() => {
  'use strict';

  const PARQUET_URL = 'https://ventusltd.github.io/gridatlas/data/repd_projects_202608290716.parquet';
  const PARQUET_SHA256 = '174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b';
  const MANIFEST_URL = 'https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json';
  const MANIFEST_SHA256 = '8850567ff9f1d2b6996b4e0d9707320030f3466a0b821cdcfc5325322b8be8c8';
  const GEOCODER_BASE = 'https://api.postcodes.io';
  const GLOBAL_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
  const FALSE_ORIGIN = Object.freeze({ latitude: 49.766807, longitude: -7.55716 });

  const state = {
    schema: 'gridatlas.v9-place-global-search.v3',
    generation: '202608301624',
    version: 'v9.5',
    geocoder: GEOCODER_BASE,
    global_geocoder: GLOBAL_GEOCODER_URL,
    geocoder_providers: ['postcodes.io', 'Nominatim / OpenStreetMap'],
    geocoder_requests: 0,
    global_geocoder_requests: 0,
    geocoder_failures: [],
    last_location_selection: null,
    parquet_url: PARQUET_URL,
    parquet_sha256: PARQUET_SHA256,
    ready: false,
    map_captured: false,
    query_count: 0,
    last_query: '',
    last_results: [],
    last_selection: null,
    failures: [],
    deep_link: { status: 'IDLE', repd_ref: null, resolved: false, mapped: false }
  };
  window.__GRIDATLAS_PLACE_SEARCH__ = state;

  let runtimePromise = null;
  let manifestPromise = null;
  let debounceTimer = null;
  let activeQuerySerial = 0;

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function sqlString(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
  }

  function normaliseCompact(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function parseGroups(query) {
    return String(query ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(group => group.split('/').map(term => term.replace(/[^a-z0-9]/g, '')).filter(Boolean))
      .filter(group => group.length);
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  async function verifyManifest() {
    manifestPromise ||= (async () => {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      invariant(response.ok, `REPD manifest HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      invariant(await sha256Hex(bytes) === MANIFEST_SHA256, 'REPD manifest SHA-256 mismatch');
      const manifest = JSON.parse(new TextDecoder().decode(bytes));
      invariant(manifest?.schema === 'gridatlas.build-manifest.v1', 'REPD manifest schema mismatch');
      invariant(manifest?.generation === '202608290716', 'REPD generation mismatch');
      invariant(manifest?.closure?.rows === 11069, 'REPD row closure mismatch');
      invariant(manifest?.closure?.postcodes === 9505, 'REPD postcode closure mismatch');
      invariant(manifest?.closure?.addresses === 11059, 'REPD address closure mismatch');
      invariant(manifest?.parquet?.sha256 === PARQUET_SHA256, 'REPD Parquet identity mismatch');
      return manifest;
    })();
    return manifestPromise;
  }

  async function runtime() {
    runtimePromise ||= (async () => {
      await verifyManifest();
      const duckdb = await import(DUCKDB_MODULE);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      invariant(bundle?.mainModule && bundle?.mainWorker, 'DuckDB-WASM bundle unavailable');
      const workerUrl = URL.createObjectURL(new Blob([
        `importScripts(${JSON.stringify(bundle.mainWorker)});`
      ], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const database = new duckdb.AsyncDuckDB(logger, worker);
      try {
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      } finally {
        URL.revokeObjectURL(workerUrl);
      }
      const connection = await database.connect();
      return { connection, database, worker };
    })();
    return runtimePromise;
  }

  function installMapCapture() {
    if (!window.maplibregl?.Map || window.__GRIDATLAS_V9_MAP_CAPTURE_INSTALLED__) return;
    const NativeMap = window.maplibregl.Map;
    const ProxyMap = new Proxy(NativeMap, {
      construct(target, args, newTarget) {
        const instance = Reflect.construct(target, args, newTarget);
        window.__GRIDATLAS_V9_MAP__ = instance;
        state.map_captured = true;
        return instance;
      }
    });
    window.maplibregl.Map = ProxyMap;
    window.__GRIDATLAS_V9_MAP_CAPTURE_INSTALLED__ = true;
  }

  installMapCapture();

  function buildWhere(query) {
    const groups = parseGroups(query);
    invariant(groups.length > 0, 'empty search query');
    const searchable = `lower(concat_ws(' ', coalesce(name,''), coalesce(repd_address_display,''), coalesce(repd_postcode,''), coalesce(county,''), coalesce(planning_authority,''), coalesce(repd_ref,'')))`;
    const compactPostcode = `regexp_replace(upper(coalesce(repd_postcode,'')), '[^A-Z0-9]', '', 'g')`;
    const compactRef = `regexp_replace(upper(coalesce(repd_ref,'')), '[^A-Z0-9]', '', 'g')`;
    return groups.map(group => {
      const alternatives = [];
      for (const term of group) {
        const compact = normaliseCompact(term);
        alternatives.push(`${searchable} LIKE ${sqlString(`%${term}%`)}`);
        if (compact) {
          alternatives.push(`${compactPostcode} LIKE ${sqlString(`%${compact}%`)}`);
          alternatives.push(`${compactRef} = ${sqlString(compact)}`);
        }
      }
      return `(${alternatives.join(' OR ')})`;
    }).join(' AND ');
  }

  function buildScore(query) {
    const compact = normaliseCompact(query);
    const firstTerm = parseGroups(query).flat()[0] || '';
    const clauses = [];
    if (compact) {
      clauses.push(`CASE WHEN regexp_replace(upper(coalesce(repd_postcode,'')), '[^A-Z0-9]', '', 'g') = ${sqlString(compact)} THEN 10000 ELSE 0 END`);
      clauses.push(`CASE WHEN upper(coalesce(repd_ref,'')) = ${sqlString(compact)} THEN 9000 ELSE 0 END`);
    }
    if (firstTerm) {
      clauses.push(`CASE WHEN lower(coalesce(name,'')) = ${sqlString(firstTerm)} THEN 2000 ELSE 0 END`);
      clauses.push(`CASE WHEN lower(coalesce(name,'')) LIKE ${sqlString(`${firstTerm}%`)} THEN 500 ELSE 0 END`);
      clauses.push(`CASE WHEN lower(coalesce(repd_address_display,'')) LIKE ${sqlString(`%${firstTerm}%`)} THEN 200 ELSE 0 END`);
    }
    return clauses.length ? clauses.join(' + ') : '0';
  }

  function rowObject(row) {
    return row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  }

  async function queryOfficialRepd(query, serial = null) {
    const trimmed = String(query ?? '').trim();
    if (trimmed.length < 2) return [];
    const { connection } = await runtime();
    const sql = `
      SELECT
        repd_ref, name, repd_address_display, repd_postcode, county,
        planning_authority, technology, status, capacity_mw, longitude, latitude,
        (${buildScore(trimmed)}) AS search_score
      FROM read_parquet(${sqlString(PARQUET_URL)})
      WHERE ${buildWhere(trimmed)}
      ORDER BY search_score DESC, TRY_CAST(repd_ref AS BIGINT) ASC NULLS LAST, capacity_mw DESC NULLS LAST, name ASC
      LIMIT 25
    `;
    const table = await connection.query(sql);
    if (serial !== null && serial !== activeQuerySerial) return [];
    const results = table.toArray().map(rowObject).map(row => ({
      repd_ref: String(row.repd_ref ?? ''),
      name: String(row.name ?? ''),
      address: String(row.repd_address_display ?? ''),
      postcode: String(row.repd_postcode ?? ''),
      county: String(row.county ?? ''),
      planning_authority: String(row.planning_authority ?? ''),
      technology: String(row.technology ?? ''),
      status: String(row.status ?? ''),
      capacity_mw: row.capacity_mw == null ? null : Number(row.capacity_mw),
      longitude: row.longitude == null ? null : Number(row.longitude),
      latitude: row.latitude == null ? null : Number(row.latitude),
      score: Number(row.search_score || 0)
    }));
    state.query_count += 1;
    state.last_query = trimmed;
    state.last_results = results.slice(0, 25);
    return results;
  }

  function hasSafeMapPoint(result) {
    if (!Number.isFinite(result.longitude) || !Number.isFinite(result.latitude)) return false;
    if (Math.abs(result.longitude) < 1e-12 && Math.abs(result.latitude) < 1e-12) return false;
    if (Math.abs(result.latitude - FALSE_ORIGIN.latitude) < 1e-9 && Math.abs(result.longitude - FALSE_ORIGIN.longitude) < 1e-9) return false;
    return result.longitude >= -180 && result.longitude <= 180 && result.latitude >= -90 && result.latitude <= 90;
  }

  function setDeepLink(result) {
    const url = new URL(window.location.href);
    url.searchParams.set('repd_ref', result.repd_ref);
    history.replaceState(history.state, '', url);
  }

  function selectResult(result) {
    setDeepLink(result);
    const map = window.__GRIDATLAS_V9_MAP__;
    const canMap = hasSafeMapPoint(result) && map && typeof map.flyTo === 'function';
    state.last_selection = {
      repd_ref: result.repd_ref,
      name: result.name,
      postcode: result.postcode,
      mapped: Boolean(canMap),
      longitude: result.longitude,
      latitude: result.latitude
    };
    if (!canMap) return;
    map.flyTo({ center: [result.longitude, result.latitude], zoom: 12, duration: 1200, essential: true });
    const cap = Number.isFinite(result.capacity_mw) ? `${result.capacity_mw.toLocaleString('en-GB')} MW` : '';
    const location = [result.address, result.postcode, result.county].filter(Boolean).join(' · ');
    new window.maplibregl.Popup({ maxWidth: '340px' })
      .setLngLat([result.longitude, result.latitude])
      .setHTML(`<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#00ffff;font-size:13px">${escapeHtml(result.name)}</b><br><span style="color:#888">${escapeHtml(result.technology)}</span>${cap ? `<br><span style="color:#ffae00">${escapeHtml(cap)}</span>` : ''}<br><span style="color:#aaa;font-size:10px">${escapeHtml(location)}</span><br><span style="color:#555;font-size:9px">REPD ${escapeHtml(result.repd_ref)} · ${escapeHtml(result.status)}</span></div>`)
      .addTo(map);
  }

  // ---- 202608301136 UK gazetteer lane (LOCATION_ONLY, never claims REPD identity) ----
  const FULL_POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;
  const OUTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/;
  let locationPopup = null;

  async function geocoderGet(path, query) {
    state.geocoder_requests += 1;
    try {
      const response = await fetch(`${GEOCODER_BASE}${path}`, { cache: 'default' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`postcodes.io ${response.status} for ${path}`);
      const body = await response.json();
      return body?.result ?? null;
    } catch (error) {
      state.geocoder_failures.push({
        query: String(query ?? ''),
        path,
        message: String(error?.message || error)
      });
      throw error;
    }
  }

  function joinParts(...parts) {
    return parts.filter(Boolean).join(' · ');
  }

  async function queryUkGazetteer(query) {
    const raw = String(query ?? '').trim();
    if (raw.length < 2) return [];
    const compact = normaliseCompact(raw);
    const out = [];
    try {
      if (FULL_POSTCODE.test(compact)) {
        const result = await geocoderGet(`/postcodes/${encodeURIComponent(compact)}`, raw);
        if (result && Number.isFinite(result.longitude) && Number.isFinite(result.latitude)) {
          out.push({
            kind: 'postcode',
            provider: 'postcodes.io',
            label: result.postcode,
            sublabel: joinParts(result.admin_district, result.admin_county, result.region),
            longitude: result.longitude,
            latitude: result.latitude
          });
          return out;
        }
      } else if (OUTCODE.test(compact)) {
        const result = await geocoderGet(`/outcodes/${encodeURIComponent(compact)}`, raw);
        if (result && Number.isFinite(result.longitude) && Number.isFinite(result.latitude)) {
          out.push({
            kind: 'postcode_district',
            provider: 'postcodes.io',
            label: result.outcode,
            sublabel: joinParts(
              Array.isArray(result.admin_district) ? result.admin_district.join(', ') : result.admin_district,
              Array.isArray(result.region) ? result.region.join(', ') : result.region
            ),
            longitude: result.longitude,
            latitude: result.latitude
          });
          return out;
        }
      }

      const places = await geocoderGet(`/places?q=${encodeURIComponent(raw)}&limit=8`, raw);
      for (const place of Array.isArray(places) ? places : []) {
        if (!Number.isFinite(place.longitude) || !Number.isFinite(place.latitude)) continue;
        out.push({
          kind: 'place',
          provider: 'postcodes.io',
          label: place.name_1,
          sublabel: joinParts(place.local_type, place.county_unitary, place.region),
          longitude: place.longitude,
          latitude: place.latitude
        });
      }
    } catch (error) {
      console.warn('[V9 UK GAZETTEER]', error);
    }
    return out;
  }

  async function queryGlobalGazetteer(query) {
    const raw = String(query ?? '').trim();
    if (raw.length < 2) return [];
    const compact = normaliseCompact(raw);
    if (FULL_POSTCODE.test(compact) || OUTCODE.test(compact)) return [];
    state.global_geocoder_requests += 1;
    try {
      const url = new URL(GLOBAL_GEOCODER_URL);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '8');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'en');
      url.searchParams.set('q', raw);
      const response = await fetch(url, {
        cache: 'default',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`Nominatim ${response.status}`);
      const body = await response.json();
      const out = [];
      for (const row of Array.isArray(body) ? body : []) {
        const longitude = Number(row.lon);
        const latitude = Number(row.lat);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
        const display = String(row.display_name || '').trim();
        const label = String(row.name || row.address?.city || row.address?.town || row.address?.village || display.split(',')[0] || raw).trim();
        out.push({
          kind: 'global_place',
          provider: 'Nominatim / OpenStreetMap',
          label,
          sublabel: display || raw,
          longitude,
          latitude
        });
      }
      return out;
    } catch (error) {
      state.geocoder_failures.push({
        query: raw,
        path: GLOBAL_GEOCODER_URL,
        provider: 'Nominatim / OpenStreetMap',
        message: String(error?.message || error)
      });
      console.warn('[V9.5 GLOBAL GAZETTEER]', error);
      return [];
    }
  }

  function dedupeGlobalLocations(ukResults, globalResults) {
    return globalResults.filter(globalResult => !ukResults.some(ukResult => {
      const sameLabel = String(globalResult.label).trim().toLowerCase() === String(ukResult.label).trim().toLowerCase();
      const close = Math.abs(globalResult.longitude - ukResult.longitude) < 0.03 && Math.abs(globalResult.latitude - ukResult.latitude) < 0.03;
      return sameLabel && close;
    }));
  }

  function selectLocation(result) {
    const url = new URL(window.location.href);
    url.searchParams.delete('repd_ref');
    history.replaceState(history.state, '', url);
    const map = window.__GRIDATLAS_V9_MAP__;
    const canMap = hasSafeMapPoint(result) && map && typeof map.flyTo === 'function';
    state.last_location_selection = { ...result, mapped: Boolean(canMap) };
    if (!canMap) return;
    const zoom = result.kind === 'postcode' ? 13 : result.kind === 'postcode_district' ? 11 : result.kind === 'global_place' ? 12 : 12;
    const provider = result.provider || 'postcodes.io';
    map.flyTo({ center: [result.longitude, result.latitude], zoom, duration: 1200, essential: true });
    if (locationPopup) locationPopup.remove();
    locationPopup = new window.maplibregl.Popup({ maxWidth: '300px' })
      .setLngLat([result.longitude, result.latitude])
      .setHTML(`<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#00ffff;font-size:13px">${escapeHtml(result.label)}</b><br><span style="color:#aaa;font-size:10px">${escapeHtml(result.sublabel)}</span><br><span style="color:#555;font-size:9px">Location only · ${escapeHtml(provider)} · no project identity claimed</span></div>`)
      .addTo(map);
  }

  function renderResults(repdResults, resultsEl, ukResults = [], globalResults = []) {
    resultsEl.innerHTML = '';
    if (!repdResults.length && !ukResults.length && !globalResults.length) {
      const empty = document.createElement('div');
      empty.className = 'search-no-results';
      empty.textContent = 'No REPD project, postcode, address or place match';
      resultsEl.appendChild(empty);
      resultsEl.style.display = 'block';
      return;
    }

    for (const result of repdResults) {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.repdRef = result.repd_ref;
      const location = [result.address, result.postcode, result.county].filter(Boolean).join(' · ');
      const capacity = Number.isFinite(result.capacity_mw) ? `${result.capacity_mw.toLocaleString('en-GB')} MW` : '';
      item.innerHTML = `<b>${escapeHtml(result.name)}</b><br><span>${escapeHtml(location)}</span>${capacity ? `<br><span style="color:#ffae00">${escapeHtml(capacity)}</span>` : ''}<span style="color:#555"> · REPD ${escapeHtml(result.repd_ref)}</span>`;
      item.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        resultsEl.style.display = 'none';
        selectResult(result);
      });
      resultsEl.appendChild(item);
    }

    function renderLocationLane(title, locations) {
      if (!locations.length) return;
      const divider = document.createElement('div');
      divider.className = 'search-no-results';
      divider.textContent = title;
      resultsEl.appendChild(divider);
      for (const result of locations) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.locationKind = result.kind;
        item.dataset.locationProvider = result.provider || '';
        item.innerHTML = `<b>${escapeHtml(result.label)}</b><br><span>${escapeHtml(result.sublabel)}</span><span style="color:#555"> · fly to only, not a REPD project</span>`;
        item.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          resultsEl.style.display = 'none';
          selectLocation(result);
        });
        resultsEl.appendChild(item);
      }
    }

    renderLocationLane('UK location', ukResults);
    renderLocationLane('Global location', globalResults);
    resultsEl.style.display = 'block';
  }

  async function executeSearch(input, resultsEl, includeGlobal = false) {
    const serial = ++activeQuerySerial;
    const query = input.value.trim();
    if (query.length < 2) {
      resultsEl.innerHTML = '';
      resultsEl.style.display = 'none';
      return;
    }
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div class="search-no-results">Searching REPD projects, postcodes, addresses and places…</div>';
    try {
      const [results, ukLocations, rawGlobalLocations] = await Promise.all([
        queryOfficialRepd(query, serial),
        queryUkGazetteer(query),
        includeGlobal ? queryGlobalGazetteer(query) : Promise.resolve([])
      ]);
      if (serial !== activeQuerySerial) return;
      const globalLocations = dedupeGlobalLocations(ukLocations, rawGlobalLocations);
      renderResults(results, resultsEl, ukLocations, globalLocations);
    } catch (error) {
      if (serial !== activeQuerySerial) return;
      state.failures.push({ query, message: String(error?.message || error) });
      resultsEl.innerHTML = '<div class="search-no-results">Search unavailable — V8 map remains usable</div>';
      resultsEl.style.display = 'block';
      console.error('[V9.5 PLACE SEARCH]', error);
    }
  }

  async function waitForCapturedMap(timeoutMs = 60000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const map = window.__GRIDATLAS_V9_MAP__;
      if (map && typeof map.flyTo === 'function') return map;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('GridAtlas map was not captured for exact REPD deep link');
  }

  async function receiveExactRepdDeepLink(input, resultsEl) {
    const repdRef = String(new URLSearchParams(window.location.search).get('repd_ref') || '').trim();
    if (!repdRef) {
      state.deep_link = { status: 'ABSENT', repd_ref: null, resolved: false, mapped: false };
      return;
    }

    state.deep_link = { status: 'RECEIVING', repd_ref: repdRef, resolved: false, mapped: false };
    try {
      invariant(/^[A-Za-z0-9-]{1,40}$/.test(repdRef), 'invalid exact REPD deep-link identity');
      input.value = repdRef;
      const results = await queryOfficialRepd(repdRef);
      const exact = results.find(result => String(result.repd_ref) === repdRef);
      invariant(exact, `official REPD identity ${repdRef} was not found`);
      renderResults(results, resultsEl);
      await waitForCapturedMap();
      selectResult(exact);
      invariant(state.last_selection?.repd_ref === repdRef, 'exact REPD selection was not retained');
      invariant(state.last_selection?.mapped === true, 'exact REPD identity did not fly to a safe map point');
      document.body.dataset.gridatlasRepdRef = repdRef;
      document.body.dataset.gridatlasRepdDeepLink = 'resolved';
      state.deep_link = {
        status: 'RESOLVED',
        repd_ref: repdRef,
        resolved: true,
        mapped: true,
        name: exact.name,
        postcode: exact.postcode,
        longitude: exact.longitude,
        latitude: exact.latitude
      };
    } catch (error) {
      const message = String(error?.message || error);
      state.failures.push({ phase: 'exact_repd_deep_link', repd_ref: repdRef, message });
      state.deep_link = { status: 'FAILED', repd_ref: repdRef, resolved: false, mapped: false, message };
      document.body.dataset.gridatlasRepdDeepLink = 'failed';
      console.error('[V9 EXACT REPD DEEP LINK]', error);
    }
  }

  function bindSearch() {
    const input = document.getElementById('search-input');
    const button = document.getElementById('search-btn');
    const resultsEl = document.getElementById('search-results');
    invariant(input && button && resultsEl, 'V8 search controls missing');
    input.setAttribute('placeholder', 'Search project, address, postcode or place...');
    input.setAttribute('aria-label', 'Search project, address, postcode or place');

    input.addEventListener('input', event => {
      event.stopImmediatePropagation();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => executeSearch(input, resultsEl, false), 180);
    }, true);

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearTimeout(debounceTimer);
        executeSearch(input, resultsEl, true);
      } else if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        resultsEl.style.display = 'none';
      }
    }, true);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearTimeout(debounceTimer);
      executeSearch(input, resultsEl, true);
    }, true);

    state.ready = true;
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      bindSearch();
      const input = document.getElementById('search-input');
      const resultsEl = document.getElementById('search-results');
      void receiveExactRepdDeepLink(input, resultsEl);
    } catch (error) {
      state.failures.push({ phase: 'bind', message: String(error?.message || error) });
      console.error('[V9 PLACE SEARCH INIT]', error);
    }
  }, { once: true });
})();
