/**
 * substation-intelligence-v9-63, generation 202609020006 (UTC).
 *
 * ASSEMBLED by tools/build-cartridge.mjs from the parts below. Do not edit
 * this file: edit a part and rebuild under a new generation. Each part is
 * hashed in manifests/202609020006-substation-intelligence-v9-63-parts.json.
 *
 *   carried_shell_script   atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js
 *   module                 atlas/modules/202609011950-geodesy.js
 *   module                 atlas/modules/202609012245-network-topology.js
 *   module                 atlas/modules/202609012245-electrical-distance.js
 *   module                 atlas/modules/202609012250-rating-envelope.js
 *   module                 atlas/modules/202609012320-injection-response.js
 *   module                 atlas/modules/202609012345-planned-change.js
 *   module                 atlas/modules/202609012350-owner-boundary.js
 *   part                   atlas/parts/202609012350-substation-intelligence-body.js
 */

'use strict';

window.initVentusMap = function({ config, center, zoom }) {
    if (typeof maplibregl === 'undefined') {
        document.getElementById('fatal-banner').style.display = 'block';
        throw new Error('CRITICAL: MapLibre failed to load.');
    }

    // ── Utilities ────────────────────────────────────────────────────────────────
    function deepFreeze(obj) {
        Object.keys(obj).forEach(prop => {
            if (typeof obj[prop] === 'object' && obj[prop] !== null) deepFreeze(obj[prop]);
        });
        return Object.freeze(obj);
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normalizeStatus(status) {
        return String(status ?? '').trim().toLowerCase();
    }

    function fmt(n, decimals) {
        return n.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    }

    // ── Earth model ───────────────────────────────────────────────────────────────
    const EARTH_RADIUS_KM = 6378.137;
    const MAX_RADIUS_KM   = Math.PI * EARTH_RADIUS_KM; // 20037.508 km

    // ── V5.1: Named constants ────────────────────────────────────────────────────
    const DEG_TO_RAD          = Math.PI / 180;
    const HIT_RADIUS_VERTEX_PX = 18;   
    const HIT_RADIUS_EDGE_PX   = 22;   
    const CLICK_DEBOUNCE_MS    = 220;  
    const HOVER_THROTTLE_MS    = 100;  
    const POPUP_MAX_WIDTH      = '300px';
    const ZONE_DRAW_VERTICES   = 24;   
    const ZONE_DRAW_DEFAULT_KM = 0.337; 

    function haversine(lon1, lat1, lon2, lat2) {
        const R = EARTH_RADIUS_KM, r = Math.PI / 180;
        const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Config Loading ────────────────────────────────────────────────────────────
    const GRID_CONFIG = deepFreeze(config);
    const RUNTIME_STATE = {};
    GRID_CONFIG.forEach(group => {
        group.layers.forEach(layer => {
            RUNTIME_STATE[layer.id] = { status: 'WAIT', loading: false, loaded: false };
        });
    });

    const layerConfigById = new Map(
        GRID_CONFIG.flatMap(g => g.layers).map(l => [l.id, l])
    );

    // Removed naei_co2 from here so it gets its own dedicated source
    const REPD_IDS    = ['solar','solar_operational','solar_roof','wind','wind_onshore_operational','wind_offshore_operational','bess','bess_operational','biomass','tidal','hydrogen','hydro','flywheel','act','geothermal','caes'];
    const TRANSIT_IDS = ['elizabeth','lu','dlr','metro','tram','hs2'];
    const TRANSIT_SOURCE_MAP = { 'elizabeth':'src-elizabeth','lu':'src-lu','dlr':'src-metros','metro':'src-metros','tram':'src-metros','hs2':'src-hs2' };
    const TRANSIT_URLS = { 'src-elizabeth':'/elizabeth_line.geojson','src-lu':'/london_underground.geojson','src-metros':'/uk_metros_trams.geojson','src-hs2':'/hs2.geojson' };

    const SEARCH_THRESHOLD = {
        'solar':50,'solar_roof':0.5,'wind':50,'bess':50,'biomass':50,
        'tidal':10,'hydrogen':10,'hydro':10,'flywheel':1,'act':10,'geothermal':1,'caes':1
    };

    const TECH_TERMS = new Map([
        ['solar','solar farm'],['solar_roof','rooftop solar'],['wind','wind farm'],
        ['bess','battery storage'],['biomass','biomass plant'],['tidal','tidal energy'],
        ['hydrogen','hydrogen plant'],['hydro','hydro power'],['flywheel','flywheel storage'],
        ['act','advanced conversion energy'],['geothermal','geothermal energy'],['caes','compressed air energy storage']
    ]);

    const TECH_COLOURS = new Map([
        ['solar','#ffff00'],['solar_roof','#ffcc00'],['wind','#00ffff'],['bess','#ffae00'],
        ['biomass','#39ff14'],['tidal','#00bfff'],['hydrogen','#ffffff'],['hydro','#00aaff'],
        ['flywheel','#ff69b4'],['act','#ff6600'],['geothermal','#ff3300'],['caes','#88aaff']
    ]);

    const STATUS_COLOURS = {
        'operational':'#00ff88','under construction':'#ffcc00','awaiting construction':'#ffaa00',
        'consented':'#ff8800','planning permission granted':'#ff8800','planning approved':'#ff8800',
        'application submitted':'#8888ff','pre-construction':'#aaaaff'
    };

    let statusMode  = false;
    let radiusMode  = false;
    let radiusMarker  = null;
    let radiusCenter  = null;
    
    let radiusAreaMode = false;
    let radiusAreaMarker = null;
    let radiusAreaCenter = null;

    // ── ZONE DRAW STATE ───────────────────────────────────────────────────────────
    const ZONE_DRAW_MAX_KM      = MAX_RADIUS_KM;
    let zoneDrawMode      = false;
    let zoneDrawPoints    = [];   
    let zoneDrawDragging  = false;
    let zoneDrawDragIdx   = -1;
    let zoneDrawJustDragged = false;
    let _zoneDrawCollapsed = false;

    function _zoneDrawGetRadius() {
        const input = document.getElementById('zonedraw-radius-input');
        if (!input) return ZONE_DRAW_DEFAULT_KM;
        const v = parseFloat(input.value);
        if (isNaN(v) || v <= 0) return ZONE_DRAW_DEFAULT_KM;
        if (v > ZONE_DRAW_MAX_KM) return ZONE_DRAW_MAX_KM;
        return v;
    }

    function _zoneDrawCirclePoints(lon, lat, radiusKm, n) {
        const R = EARTH_RADIUS_KM, DEG = Math.PI / 180;
        const ad = radiusKm / R;
        const lat1 = lat * DEG;
        return Array.from({ length: n }, (_, i) => {
            const b = (i / n) * 2 * Math.PI;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(b));
            const lon2 = lon * DEG + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
            return [lon2 / DEG, lat2 / DEG];
        });
    }

    function _zoneDrawCalcArea(pts) {
        if (pts.length < 3) return { areaKm2: 0, areaHa: 0, areaAc: 0, areaMi2: 0, areaM2: 0, perimKm: 0, pitches: 0 };
        let area = 0;
        const R = EARTH_RADIUS_KM;
        for (let i = 0; i < pts.length; i++) {
            const j  = (i + 1) % pts.length;
            const xi = pts[i][0] * Math.PI / 180, yi = pts[i][1] * Math.PI / 180;
            const xj = pts[j][0] * Math.PI / 180, yj = pts[j][1] * Math.PI / 180;
            area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
        }
        const areaKm2 = Math.abs(area) * R * R / 2;
        let perimKm = 0;
        for (let i = 0; i < pts.length; i++) perimKm += haversine(pts[i][0], pts[i][1], pts[(i+1)%pts.length][0], pts[(i+1)%pts.length][1]);
        const areaM2 = areaKm2 * 1e6;
        return { areaKm2, areaHa: areaM2 / 10000, areaAc: areaM2 / 4046.85642, areaMi2: areaKm2 * 0.386102, areaM2, perimKm, pitches: areaM2 / 7140 };
    }

    function _zoneDrawUpdateLayers(dragOnly) {
        if (!map.getSource('src-zonedraw-fill')) return;
        const n = zoneDrawPoints.length;
        if (n < 3) {
            ['fill','line','points'].forEach(s => map.getSource(`src-zonedraw-${s}`).setData({ type: 'FeatureCollection', features: [] }));
            return;
        }
        const ring = [...zoneDrawPoints, zoneDrawPoints[0]];
        map.getSource('src-zonedraw-fill').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }] });
        map.getSource('src-zonedraw-line').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ring } }] });
        if (dragOnly) {
            map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features:
                zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }))
            });
        } else {
            const vFeatures = zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }));
            const mFeatures = [];
            zoneDrawPoints.forEach((c, i) => {
                const b = zoneDrawPoints[(i + 1) % n];
                [0.33, 0.5, 0.66].forEach(t => {
                    mFeatures.push({ type: 'Feature', properties: { kind: 'mid', edgeIdx: i, t }, geometry: { type: 'Point', coordinates: [c[0]+(b[0]-c[0])*t, c[1]+(b[1]-c[1])*t] } });
                });
            });
            map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features: [...vFeatures, ...mFeatures] });
        }
    }

    let _zoneDrawPopupRaf = null;

    function _zoneDrawShowPopup() {
        if (zoneDrawPoints.length < 3) return;
        const { areaKm2, areaHa, areaAc, areaMi2, areaM2, perimKm, pitches } = _zoneDrawCalcArea(zoneDrawPoints);
        const centLon = zoneDrawPoints.reduce((s, p) => s + p[0], 0) / zoneDrawPoints.length;
        const centLat = zoneDrawPoints.reduce((s, p) => s + p[1], 0) / zoneDrawPoints.length;
        if (_zoneDrawCollapsed) {
            openPopup([centLon, centLat], `
                <div onclick="window._zdExpand&&window._zdExpand()" style="font-family:monospace;background:#000;padding:5px 10px;border:1px solid #ff6600;border-radius:4px;cursor:pointer;color:#ff6600;font-size:11px;white-space:nowrap;">
                    ◉ ${fmt(areaKm2,3)} km² · ⚽ ${fmt(pitches,0)} pitches &nbsp;▾
                </div>`);
            window._zdExpand = () => { _zoneDrawCollapsed = false; _zoneDrawShowPopup(); };
        } else {
            openPopup([centLon, centLat], `
                <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff6600;border-radius:4px;min-width:230px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <b style="color:#ff6600;font-size:13px;">◉ Zone Draw</b>
                        <span onclick="window._zdCollapse&&window._zdCollapse()" style="color:#555;font-size:12px;cursor:pointer;padding:0 4px;user-select:none;" title="Collapse">▴ hide</span>
                    </div>
                    <div style="color:#ffae00;font-size:13px;margin-bottom:10px;">⚽ ${fmt(pitches,1)} football pitches</div>
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;">
                        <span style="color:#888;">Square Metres</span><span style="color:#fff;">${fmt(areaM2,0)}</span>
                        <span style="color:#888;">Hectares</span><span style="color:#fff;">${fmt(areaHa,2)}</span>
                        <span style="color:#888;">Acres</span><span style="color:#fff;">${fmt(areaAc,2)}</span>
                        <span style="color:#888;">Square Kilometres</span><span style="color:#fff;">${fmt(areaKm2,4)}</span>
                        <span style="color:#888;">Square Miles</span><span style="color:#fff;">${fmt(areaMi2,3)}</span>
                        <span style="color:#888;">Perimeter</span><span style="color:#fff;">${fmt(perimKm,2)} km</span>
                    </div>
                    <div style="color:#555;font-size:10px;margin-top:8px;line-height:1.4;">
                        <b style="color:#ff6600;">HOW TO USE:</b><br>
                        • <b>Drag orange dots</b> to reshape polygon<br>
                        • <b>Click light dots</b> on edges to add points<br>
                        • <b>Undo button</b> in top-left removes last point<br>
                        • <b>Click elsewhere</b> to start new zone
                    </div>
                </div>`);
            window._zdCollapse = () => { _zoneDrawCollapsed = true; _zoneDrawShowPopup(); };
        }
    }

    function _zoneDrawShowPopupDebounced() {
        if (_zoneDrawPopupRaf) return;
        _zoneDrawPopupRaf = requestAnimationFrame(() => { _zoneDrawPopupRaf = null; _zoneDrawShowPopup(); });
    }

    function _zoneDrawClear() {
        zoneDrawPoints    = [];
        zoneDrawDragging  = false;
        zoneDrawDragIdx   = -1;
        zoneDrawJustDragged = false;
        _zoneDrawCollapsed  = false;
        window._zdExpand    = null;
        window._zdCollapse  = null;
        closeActivePopup();
        _zoneDrawUpdateLayers(false);
        const el = document.getElementById('zonedraw-display');
        if (el) el.style.display = 'none';
    }

    function zoneDrawUndo() {
        if (zoneDrawPoints.length <= 3) { _zoneDrawClear(); return; }
        zoneDrawPoints.pop();
        _zoneDrawUpdateLayers(false);
        _zoneDrawShowPopup();
    }

    function toggleZoneDrawMode() {
        zoneDrawMode = !zoneDrawMode;
        const btn = document.getElementById('btn-zonedraw');
        if (btn) { btn.classList.toggle('active', zoneDrawMode); btn.setAttribute('aria-pressed', zoneDrawMode); }
        map.getCanvas().style.cursor = zoneDrawMode ? 'crosshair' : '';
        if (zoneDrawMode) {
            if (radiusMode)     toggleRadiusMode();
            if (radiusAreaMode) toggleRadiusAreaMode();
            if (measureMode)    toggleMeasureMode();
            const el = document.getElementById('zonedraw-display');
            if (el) el.style.display = 'block';
        } else {
            _zoneDrawClear();
        }
    }

    function _zoneDrawNearVertex(px) {
        for (let i = 0; i < zoneDrawPoints.length; i++) {
            const vpx = map.project(zoneDrawPoints[i]);
            const dx = px.x - vpx.x, dy = px.y - vpx.y;
            if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS_VERTEX_PX) return i;
        }
        return -1;
    }

    function _zoneDrawNearEdgeDot(px) {
        for (let i = 0; i < zoneDrawPoints.length; i++) {
            const j = (i + 1) % zoneDrawPoints.length;
            const a = zoneDrawPoints[i], b = zoneDrawPoints[j];
            for (const t of [0.33, 0.5, 0.66]) {
                const dot = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
                const dpx = map.project(dot);
                const dx = px.x - dpx.x, dy = px.y - dpx.y;
                if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS_EDGE_PX) return { insertIdx: j, dot };
            }
        }
        return null;
    }

    function _zoneDrawOnClick(e) {
        if (zoneDrawDragging) return;
        if (zoneDrawJustDragged) { zoneDrawJustDragged = false; return; }
        const lon = e.lngLat.lng, lat = e.lngLat.lat;

        if (zoneDrawPoints.length === 0) {
            const km = _zoneDrawGetRadius();
            zoneDrawPoints = _zoneDrawCirclePoints(lon, lat, km, ZONE_DRAW_VERTICES);
            _zoneDrawCollapsed = false;

            const mpp = (km * 2000) / (window.innerWidth * 0.6);
            const lat1 = lat * Math.PI / 180;
            const targetZoom = Math.log2(156543 * Math.cos(lat1) / mpp);
            const clampedZoom = Math.max(8, Math.min(19, targetZoom));
            map.easeTo({ center: [lon, lat], zoom: clampedZoom, duration: 600 });

            _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
            return;
        }

        const px = map.project([lon, lat]);
        if (_zoneDrawNearVertex(px) >= 0) return;

        const edgeHit = _zoneDrawNearEdgeDot(px);
        if (edgeHit) {
            zoneDrawPoints.splice(edgeHit.insertIdx, 0, [edgeHit.dot[0], edgeHit.dot[1]]);
            _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
            return;
        }

        const km = _zoneDrawGetRadius();
        zoneDrawPoints = _zoneDrawCirclePoints(lon, lat, km, ZONE_DRAW_VERTICES);
        _zoneDrawCollapsed = false;
        const mpp = (km * 2000) / (window.innerWidth * 0.6);
        const lat1 = lat * Math.PI / 180;
        const targetZoom = Math.log2(156543 * Math.cos(lat1) / mpp);
        map.easeTo({ center: [lon, lat], zoom: Math.max(8, Math.min(19, targetZoom)), duration: 600 });
        _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
    }

    function _zoneDrawOnMouseDown(e) {
        if (!zoneDrawMode || zoneDrawPoints.length < 3) return;
        const px = map.project(e.lngLat);
        if (_zoneDrawNearEdgeDot(px)) return;
        const vi = _zoneDrawNearVertex(px);
        if (vi >= 0) {
            zoneDrawDragging = true; zoneDrawDragIdx = vi;
            map.dragPan.disable();
            map.getCanvas().style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    function _zoneDrawOnMouseMove(e) {
        if (!zoneDrawMode || zoneDrawPoints.length < 3) return;
        if (zoneDrawDragging && zoneDrawDragIdx >= 0) {
            zoneDrawPoints[zoneDrawDragIdx] = [e.lngLat.lng, e.lngLat.lat];
            _zoneDrawUpdateLayers(true);
            _zoneDrawShowPopupDebounced();
            return;
        }
        const px = map.project(e.lngLat);
        const vi = _zoneDrawNearVertex(px);
        const edgeHit = vi < 0 ? _zoneDrawNearEdgeDot(px) : null;
        map.getCanvas().style.cursor = vi >= 0 ? 'grab' : (edgeHit ? 'copy' : 'crosshair');
    }

    function _zoneDrawOnMouseUp() {
        if (!zoneDrawDragging) return;
        zoneDrawDragging    = false;
        zoneDrawDragIdx     = -1;
        zoneDrawJustDragged = true;
        map.dragPan.enable();
        map.getCanvas().style.cursor = 'crosshair';
        _zoneDrawUpdateLayers(false);
        _zoneDrawShowPopup();
        setTimeout(() => { zoneDrawJustDragged = false; }, 50);
    }


    const urlCache = {};
    let globalSubsData  = null;
    let allREPDFeatures = [];
    let searchIndex     = [];

    // ── Single popup instance — prevents accumulation ────────────────────────────
    let activePopup = null;
    function openPopup(lngLat, html, maxWidth) {
        if (activePopup) { activePopup.remove(); activePopup = null; }
        activePopup = new maplibregl.Popup({ maxWidth: maxWidth || POPUP_MAX_WIDTH })
            .setLngLat(lngLat)
            .setHTML(html)
            .addTo(map);
        activePopup.on('close', () => { activePopup = null; });
        return activePopup;
    }
    function closeActivePopup() {
        if (activePopup) { activePopup.remove(); activePopup = null; }
    }
    window._closePopupKeepShape = () => closeActivePopup();

    // ── Fullscreen ───────────────────────────────────────────────────────────────
    let fsActive = false;
    let curtainOpen = false;

    window.enterFullscreen = function() {
        fsActive = true;
        document.body.classList.add('fs-active');
        document.documentElement.classList.add('fs-active');
        document.getElementById('map-container').classList.add('is-fullscreen');
        document.getElementById('btn-fullscreen').style.display = 'none';
        const el = document.getElementById('map-container');
        if (el.requestFullscreen) { el.requestFullscreen().catch(() => {}); }
        else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
        setTimeout(() => map.resize(), 50);
    };

    window.exitFullscreen = function() {
        fsActive = false;
        curtainOpen = false;
        document.body.classList.remove('fs-active');
        document.documentElement.classList.remove('fs-active');
        document.getElementById('map-container').classList.remove('is-fullscreen');
        document.getElementById('btn-fullscreen').style.display = '';
        document.getElementById('fs-curtain').classList.remove('curtain-open');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        setTimeout(() => map.resize(), 50);
    };

    function toggleCurtain() {
        curtainOpen = !curtainOpen;
        const curtain = document.getElementById('fs-curtain');
        const tab = document.getElementById('fs-curtain-tab');
        curtain.classList.toggle('curtain-open', curtainOpen);
        tab.innerText = curtainOpen ? '⬆ Close' : '⬇ Layers';
    }

    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fsActive) exitFullscreen(); });
    document.addEventListener('webkitfullscreenchange', () => { if (!document.webkitFullscreenElement && fsActive) exitFullscreen(); });

    // ── Radius Tool ───────────────────────────────────────────────────────────────
    const RADIUS_MIN = 1;
    const RADIUS_MAX = MAX_RADIUS_KM; 

    function getRadiusValue() {
        const raw = parseFloat(document.getElementById('radius-input').value);
        if (isNaN(raw) || raw < RADIUS_MIN) return RADIUS_MIN;
        if (raw > RADIUS_MAX) return RADIUS_MAX;
        return raw;
    }

    function validateRadiusInput() {
        const input = document.getElementById('radius-input');
        const raw = parseFloat(input.value);
        const invalid = isNaN(raw) || raw < RADIUS_MIN || raw > RADIUS_MAX;
        input.classList.toggle('invalid', invalid);
        return !invalid;
    }

    // ── Measure Tool ──────────────────────────────────────────────────────────────
    let measureMode = false;
    let measurePoints = [];
    let measureClosed = false;
    let _lastMouseMoveRaf = null;

    function updateMeasureDisplay() {
        const lineEl  = document.getElementById('m-line');
        const perimEl = document.getElementById('m-perim');
        const areaEl  = document.getElementById('m-area');
        const hint    = document.getElementById('m-hint');
        const undoBtn = document.getElementById('btn-measure-undo');

        undoBtn.style.display = (measurePoints.length > 0 && !measureClosed) ? 'inline-block' : 'none';

        if (measurePoints.length < 2) {
            lineEl.style.display = 'none'; perimEl.style.display = 'none'; areaEl.style.display = 'none';
            hint.innerText = 'Click to add points · Double-click to close polygon';
            return;
        }

        let totalKm = 0;
        for (let i = 1; i < measurePoints.length; i++) {
            totalKm += haversine(measurePoints[i-1][0], measurePoints[i-1][1], measurePoints[i][0], measurePoints[i][1]);
        }

        if (!measureClosed) {
            lineEl.style.display = 'block'; perimEl.style.display = 'none'; areaEl.style.display = 'none';
            document.getElementById('m-km').innerText = fmt(totalKm, 2);
            document.getElementById('m-m').innerText  = fmt(totalKm * 1000, 0);
            document.getElementById('m-mi').innerText = fmt(totalKm * 0.621371, 2);
            hint.innerText = 'Double-click last point to close polygon';
        } else {
            const closingKm = haversine(measurePoints[measurePoints.length-1][0], measurePoints[measurePoints.length-1][1], measurePoints[0][0], measurePoints[0][1]);
            const perimKm = totalKm + closingKm;
            let area = 0;
            const R = EARTH_RADIUS_KM;
            for (let i = 0; i < measurePoints.length; i++) {
                const j  = (i + 1) % measurePoints.length;
                const xi = measurePoints[i][0] * Math.PI / 180; const yi = measurePoints[i][1] * Math.PI / 180;
                const xj = measurePoints[j][0] * Math.PI / 180; const yj = measurePoints[j][1] * Math.PI / 180;
                area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
            }
            const areaKm2 = Math.abs(area) * R * R / 2;
            const areaHa  = areaKm2 * 100; const areaAc  = areaKm2 * 247.105;

            lineEl.style.display  = 'none'; perimEl.style.display = 'block'; areaEl.style.display  = 'block';
            document.getElementById('m-pkm').innerText = fmt(perimKm, 2); document.getElementById('m-pm').innerText  = fmt(perimKm * 1000, 0);
            document.getElementById('m-km2').innerText = fmt(areaKm2, 3); document.getElementById('m-ha').innerText  = fmt(areaHa, 1);
            document.getElementById('m-ac').innerText  = fmt(areaAc, 1);
            hint.innerText = 'Click 📏 Measure again to reset';
        }
    }

    function updateMeasureLayers() {
        if (!map.getSource('src-measure-line')) return;
        const lineCoords = [...measurePoints];
        if (measureClosed && measurePoints.length > 2) lineCoords.push(measurePoints[0]);
        map.getSource('src-measure-line').setData({ type: 'FeatureCollection', features: lineCoords.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords } }] : [] });
        map.getSource('src-measure-fill').setData({ type: 'FeatureCollection', features: measureClosed && measurePoints.length > 2 ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...measurePoints, measurePoints[0]]] } }] : [] });
        map.getSource('src-measure-points').setData({ type: 'FeatureCollection', features: measurePoints.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) });
    }

    function clearMeasure() {
        measurePoints = []; measureClosed = false; updateMeasureLayers(); updateMeasureDisplay();
        document.getElementById('measure-display').style.display = 'none';
    }

    function undoLastMeasurePoint() {
        if (measurePoints.length === 0 || measureClosed) return;
        measurePoints.pop(); updateMeasureLayers(); updateMeasureDisplay();
    }

    function toggleMeasureMode() {
        measureMode = !measureMode;
        const btn = document.getElementById('btn-measure');
        btn.classList.toggle('active', measureMode); btn.setAttribute('aria-pressed', measureMode);
        map.getCanvas().style.cursor = measureMode ? 'crosshair' : '';
        if (!measureMode) { clearMeasure(); } else {
            if (radiusMode) toggleRadiusMode();
            if (radiusAreaMode) toggleRadiusAreaMode();
            if (zoneDrawMode) toggleZoneDrawMode();
            document.getElementById('measure-display').style.display = 'block'; updateMeasureDisplay();
        }
    }

    // ── Radius Area Tool ──────────────────────────────────────────────────────────
    function toggleRadiusAreaMode() {
        radiusAreaMode = !radiusAreaMode;
        const btn = document.getElementById('btn-radius-area');
        if(btn) {
            btn.classList.toggle('active', radiusAreaMode); 
            btn.setAttribute('aria-pressed', radiusAreaMode);
        }
        const popupEl = document.getElementById('radius-area-popup');
        if(popupEl) popupEl.style.display = radiusAreaMode ? 'block' : 'none';
        
        map.getCanvas().style.cursor = radiusAreaMode ? 'crosshair' : '';
        
        if (radiusAreaMode && radiusMode) toggleRadiusMode();
        if (radiusAreaMode && measureMode) toggleMeasureMode();
        if (radiusAreaMode && zoneDrawMode) toggleZoneDrawMode();
        
        if (!radiusAreaMode) { 
            if(map.getSource('src-radius-area')) {
                map.getSource('src-radius-area').setData({ type: 'FeatureCollection', features: [] });
            }
            radiusAreaCenter = null; 
            if (radiusAreaMarker) { radiusAreaMarker.remove(); radiusAreaMarker = null; }
            closeActivePopup();
        }
    }

    function doRadiusAreaMeasure(lon, lat) {
        const input = document.getElementById('radius-area-input');
        if(!input) return;
        const km = parseFloat(input.value);
        if (isNaN(km) || km <= 0 || km > MAX_RADIUS_KM) {
            input.classList.add('invalid');
            return;
        }
        input.classList.remove('invalid');
        radiusAreaCenter = { lon, lat };

        if(map.getSource('src-radius-area')) {
            map.getSource('src-radius-area').setData(createGeoJSONCircle(lon, lat, km));
        }
        if (radiusAreaMarker) radiusAreaMarker.remove(); radiusAreaMarker = null;

        // Calculate Geodesic Spherical Cap Area
        const R = EARTH_RADIUS_KM;
        const areaKm2  = 2 * Math.PI * R * R * (1 - Math.cos(km / R));
        const areaM2   = areaKm2 * 1000000;
        const areaHa   = areaM2 / 10000;
        const areaAc   = areaM2 / 4046.85642;
        const areaMi2  = areaKm2 * 0.386102;
        const pitches  = areaM2 / 7140;

        openPopup([lon, lat], `
            <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff00ff;border-radius:4px;min-width:220px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <b style="color:#ff00ff;font-size:13px;">◵ ${km}km radius</b>
                    <span onclick="window._closePopupKeepShape()" style="color:#555;font-size:14px;cursor:pointer;line-height:1;padding:0 2px;user-select:none;" title="Close popup, keep circle">✕</span>
                </div>
                <div style="color:#ffae00;font-size:13px;margin-bottom:10px;">⚽ ${fmt(pitches, 1)} football pitches</div>
                <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;">
                    <span style="color:#888;">Square Metres</span><span style="color:#fff;">${fmt(areaM2, 0)}</span>
                    <span style="color:#888;">Hectares</span><span style="color:#fff;">${fmt(areaHa, 2)}</span>
                    <span style="color:#888;">Acres</span><span style="color:#fff;">${fmt(areaAc, 2)}</span>
                    <span style="color:#888;">Square Kilometres</span><span style="color:#fff;">${fmt(areaKm2, 3)}</span>
                    <span style="color:#888;">Square Miles</span><span style="color:#fff;">${fmt(areaMi2, 3)}</span>
                </div>
            </div>`);
    }

    // ── Clock ─────────────────────────────────────────────────────────────────────
    setInterval(() => {
        const now    = new Date();
        const target = new Date(Date.UTC(2050, 0, 1, 0, 0, 0));
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
        document.getElementById('date').innerText  = now.toLocaleDateString('en-GB');
        document.getElementById('days').innerText  = Math.floor((target - now) / 86400000) + ' DAYS';
    }, 1000);

    // ── Map Init ──────────────────────────────────────────────────────────────────
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: center,
        zoom: zoom,
        attributionControl: false
    });

    new ResizeObserver(() => map.resize()).observe(document.getElementById('map'));

    // ── UI State ──────────────────────────────────────────────────────────────────
    function updateUIState(id, state, stats) {
        RUNTIME_STATE[id].status = state;
        ['lbl-', 'fs-lbl-'].forEach(prefix => {
            const span = document.getElementById(`${prefix}${id}`);
            if (span) {
                const baseText = span.getAttribute('data-base-label');
                if (stats && stats.count > 0) {
                    let unitStr = '';
                    if (id === 'naei_co2') {
                        unitStr = `${fmt(stats.mw, 0)} tCO₂e`;
                    } else {
                        unitStr = stats.mw >= 1000 ? `${(stats.mw / 1000).toFixed(1)}GW` : `${Math.round(stats.mw)}MW`;
                    }
                    span.innerText = `${baseText} [${stats.count} | ${unitStr}]`;
                } else {
                    span.innerText = `${baseText} [${state}]`;
                }
                span.style.opacity = state === 'FAIL' ? '0.5' : '1';
            }
        });
    }

    // ── Fetch Queue ───────────────────────────────────────────────────────────────
    class FetchQueue {
        constructor(concurrency) { this.concurrency = concurrency; this.active = 0; this.queue = []; }
        async add(task) {
            if (this.active >= this.concurrency) await new Promise(resolve => this.queue.push(resolve));
            this.active++;
            try { return await task(); }
            finally { this.active--; if (this.queue.length > 0) this.queue.shift()(); }
        }
    }
    const networkQueue = new FetchQueue(4);

    async function fetchWithTimeout(url, ms = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
            return response;
        } catch (err) { clearTimeout(id); throw err; }
    }

    async function fetchAndParseGeoJSON(url) {
        if (urlCache[url]) return await urlCache[url];
        const promise = fetchWithTimeout(url)
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data.features)) { console.error(`[INVALID GEOJSON] ${url}`, data); return []; }
                console.log(`[DATA LOADED] ${url}: ${data.features.length} features`); return data.features;
            })
            .catch(err => { delete urlCache[url]; console.error(`[FETCH ERROR] ${url}`, err); throw err; });
        urlCache[url] = promise;
        return promise;
    }

    // ── Geometry ──────────────────────────────────────────────────────────────────
    function snapLines(features, subs) {
        if (!subs || !subs.length) return features;

        const TOLERANCE_DEG_SQ = 0.001 * 0.001; 
        const RAD = Math.PI / 180;

        const snapCoordinate = (coord) => {
            let best = coord, min = Infinity;
            const latCos = Math.cos(coord[1] * RAD);
            subs.forEach(s => {
                const sc = s.geometry && s.geometry.coordinates;
                if (!sc) return;
                const dx = (coord[0] - sc[0]) * latCos;
                const dy = (coord[1] - sc[1]);
                const d = dx * dx + dy * dy;
                if (d < min && d <= TOLERANCE_DEG_SQ) { min = d; best = sc; }
            });
            return best;
        };

        return features.map(f => {
            const geom = f.geometry;
            if (!geom || !geom.coordinates) return f;
            if (geom.type === 'LineString') {
                const c = [...geom.coordinates];
                if (c.length > 0) { 
                    c[0] = snapCoordinate(c[0]); 
                    c[c.length - 1] = snapCoordinate(c[c.length - 1]); 
                }
                return { ...f, geometry: { ...geom, coordinates: c } };
            }
            if (geom.type === 'MultiLineString') {
                const coords = geom.coordinates.map(line => {
                    const l = [...line];
                    if (l.length > 0) { 
                        l[0] = snapCoordinate(l[0]); 
                        l[l.length - 1] = snapCoordinate(l[l.length - 1]); 
                    }
                    return l;
                });
                return { ...f, geometry: { ...geom, coordinates: coords } };
            }
            return f;
        });
    }

    function createGeoJSONCircle(lon, lat, radiusKm) {
        const points = radiusKm > 5000 ? 128 : radiusKm > 500 ? 96 : 64;
        const R = EARTH_RADIUS_KM, DEG = Math.PI / 180;
        const ad = radiusKm / R;
        const lat1 = lat * DEG;
        const coords = Array.from({ length: points }, (_, i) => {
            const b = (i / points) * 2 * Math.PI;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(b));
            const lon2 = lon * DEG + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
            return [lon2 / DEG, lat2 / DEG];
        });
        coords.push(coords[0]);
        return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] };
    }

    function drawRadiusCircle(lon, lat, radiusKm) { map.getSource('src-radius-circle').setData(createGeoJSONCircle(lon, lat, radiusKm)); }
    function clearRadiusCircle() { map.getSource('src-radius-circle').setData({ type: 'FeatureCollection', features: [] }); }

    let _visibleInteractiveIds = [];
    let _visibleHoverIds = [];

    function _rebuildVisibleCache(allLayerIds) {
        _visibleInteractiveIds = allLayerIds.filter(id => {
            try { return map.getLayoutProperty(id, 'visibility') === 'visible'; }
            catch(e) { return false; }
        });
        _visibleHoverIds = [..._visibleInteractiveIds];
    }

    let _lastHoverMs = 0;

    // ── Popup / Search ────────────────────────────────────────────────────────────
    function buildSearchButtons(name, capacity, tech) {
        const threshold = SEARCH_THRESHOLD[tech] !== undefined ? SEARCH_THRESHOLD[tech] : 50;
        if (capacity < threshold) return '';
        const term = TECH_TERMS.get(tech) || 'energy project';
        const q = encodeURIComponent(`${name} ${term} UK`);
        const newsUrl  = `https://news.google.com/search?q=${q}`;
        const imageUrl = `https://www.google.com/search?q=${q}&tbm=isch`;
        return `<div class="popup-search-btns">
            <a class="popup-btn popup-btn-news" href="${newsUrl}" target="_blank" rel="noopener noreferrer">📰 NEWS</a>
            <a class="popup-btn popup-btn-images" href="${imageUrl}" target="_blank" rel="noopener noreferrer">🖼 IMAGES</a>
        </div>`;
    }

    function buildSearchIndex() {
        searchIndex = allREPDFeatures
            .filter(f => f && f.properties && f.properties.name)
            .map(f => ({ feature: f, nameLower: String(f.properties.name).toLowerCase(), capacity: Number(f.properties.capacity) || 0 }));
    }

    function flyToProject(feature) {
        const [lon, lat] = feature.geometry.coordinates;
        const p = feature.properties;
        const cap = p.capacity ? `${p.capacity} MW` : '';
        const mounting = (p.mounting && p.mounting !== 'nan') ? ` | ${escapeHTML(p.mounting)}` : '';
        map.flyTo({ center: [lon, lat], zoom: 12, duration: 1800, essential: true });
        setTimeout(() => {
            openPopup([lon, lat], `<div style="font-family:monospace;background:#000;padding:6px">
                    <b style="color:#00ffff;font-size:13px">${escapeHTML(p.name)}</b><br>
                    <span style="color:#888">${escapeHTML(p.raw_tech || p.tech)}${mounting}</span><br>
                    <span style="color:#ffae00">${escapeHTML(cap)}</span>
                    <span style="color:#666"> | ${escapeHTML(p.status)}</span><br>
                    <span style="color:#555;font-size:10px">${escapeHTML(p.operator)}</span>
                    ${REPD_IDS.includes(p.tech) ? buildSearchButtons(p.name, parseFloat(p.capacity) || 0, p.tech) : ''}
                </div>`);
        }, 1900);
    }

    // V9 canonical project deep links. Identity is resolved only by official REPD Ref;
    // URL names and coordinates are never used to manufacture a match.
    async function focusCanonicalProjectDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const repdRef = String(params.get('repd_ref') || '').trim();
        if (!/^[A-Za-z0-9-]{1,40}$/.test(repdRef)) return;

        try {
            const requestedTechnology = String(params.get('technology') || '').trim();
            const allowedTechnologies = new Set(['solar', 'bess', 'wind_onshore', 'wind_offshore']);
            if (!allowedTechnologies.has(requestedTechnology)) throw new Error('canonical project technology is invalid');
            const manifestResponse = await fetch('/uk_renewables_pipeline/v9/data/v9.1/build_manifest.json', { cache: 'no-store' });
            if (!manifestResponse.ok) throw new Error(`canonical manifest HTTP ${manifestResponse.status}`);
            const manifest = await manifestResponse.json();
            const partitions = Array.isArray(manifest.atlas_partitions)
                ? manifest.atlas_partitions.filter(item => item.technology === requestedTechnology)
                : [];
            if (!partitions.length) throw new Error(`no canonical ${requestedTechnology} partitions`);
            const payloads = await Promise.all(partitions.map(async item => {
                const response = await fetch(`/uk_renewables_pipeline/v9/${item.path}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`canonical project HTTP ${response.status}`);
                return response.json();
            }));
            const feature = payloads.flatMap(payload => Array.isArray(payload.features) ? payload.features : [])
                .find(item => String(item?.properties?.repd_ref || '') === repdRef);
            if (!feature || feature?.geometry?.type !== 'Point') throw new Error(`REPD Ref ${repdRef} not found`);

            const p = feature.properties || {};
            const technology = p.technology === 'bess' ? 'bess' : (p.technology.startsWith('wind_') ? 'wind' : 'solar');
            const atlasFeature = {
                type: 'Feature',
                geometry: feature.geometry,
                properties: {
                    name: p.name,
                    capacity: p.capacity_mw,
                    raw_tech: p.repd_technology,
                    tech: technology,
                    status: p.status,
                    operator: p.operator,
                    repd_ref: p.repd_ref
                }
            };

            if (!map.getSource('src-v9-deep-link')) {
                map.addSource('src-v9-deep-link', { type: 'geojson', data: atlasFeature });
                map.addLayer({
                    id: 'l-v9-deep-link', type: 'circle', source: 'src-v9-deep-link',
                    paint: { 'circle-color': '#00ffff', 'circle-radius': 12, 'circle-stroke-width': 4, 'circle-stroke-color': '#000' }
                });
            } else {
                map.getSource('src-v9-deep-link').setData(atlasFeature);
            }

            const checkbox = document.querySelector(`input[data-layer-id="${technology}"]`);
            if (checkbox && !checkbox.checked) { checkbox.checked = true; handleLayerToggle(technology, true); }
            flyToProject(atlasFeature);
        } catch (error) {
            console.error('[V9 DEEP LINK FAILED]', error);
            const lon = Number(params.get('longitude'));
            const lat = Number(params.get('latitude'));
            if (Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
                map.flyTo({ center: [lon, lat], zoom: 12, duration: 1800, essential: true });
            }
        }
    }

    function searchProjects(query) {
        const resultsEl = document.getElementById('search-results');
        if (!query || query.length < 2) { resultsEl.style.display = 'none'; return; }
        if (!allREPDFeatures.length) {
            resultsEl.innerHTML = '<div class="search-no-results">Load a REPD layer first to enable search</div>';
            resultsEl.style.display = 'block'; return;
        }
        const q = query.toLowerCase();
        const matches = searchIndex.filter(item => item.nameLower.includes(q)).sort((a, b) => b.capacity - a.capacity).slice(0, 12).map(item => item.feature);
        if (!matches.length) { resultsEl.innerHTML = '<div class="search-no-results">No projects found</div>'; resultsEl.style.display = 'block'; return; }
        resultsEl.innerHTML = matches.map((f, i) => {
            const p   = f.properties;
            const cap = p.capacity ? ` — ${p.capacity} MW` : '';
            const col = TECH_COLOURS.get(p.tech) || '#888';
            return `<div class="search-result-item" data-idx="${i}"><b>${escapeHTML(p.name)}</b><span style="color:#555">${escapeHTML(cap)}</span><br>
                <span style="color:${col};font-size:9px">${escapeHTML(p.raw_tech || p.tech)}</span>
                <span style="color:#444;font-size:9px"> | ${escapeHTML(p.status || '')}</span></div>`;
        }).join('');
        resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
            el.addEventListener('click', () => { flyToProject(matches[i]); resultsEl.style.display = 'none'; document.getElementById('search-input').value = matches[i].properties.name; });
        });
        resultsEl.style.display = 'block';
    }

    // ── Export ────────────────────────────────────────────────────────────────────
    function exportCSV() {
        if (!allREPDFeatures.length) { alert('Load a REPD layer first'); return; }
        const visibleTechs = REPD_IDS.filter(id => { const cb = document.querySelector(`input[data-layer-id="${id}"]`); return cb && cb.checked; });
        const rows = allREPDFeatures.filter(f => visibleTechs.includes(f.properties.tech));
        if (!rows.length) { alert('No visible REPD layers to export — tick some layers first'); return; }
        const headers = ['name','tech','raw_tech','capacity_mw','status','operator','mounting','longitude','latitude'];
        const csv = [headers.join(','), ...rows.map(f => {
            const p = f.properties; const [lon, lat] = f.geometry.coordinates;
            return [`"${(p.name||'').replace(/"/g, '""')}"`,`"${(p.tech||'').replace(/"/g, '""')}"`,`"${(p.raw_tech||'').replace(/"/g, '""')}"`,p.capacity,`"${(p.status||'').replace(/"/g, '""')}"`,`"${(p.operator||'').replace(/"/g, '""')}"`,`"${(p.mounting||'').replace(/"/g, '""')}"`,lon, lat].join(',');
        })].join('\n');
        const blob      = new Blob([csv], { type: 'text/csv' });
        const objectUrl = URL.createObjectURL(blob);
        const a         = document.createElement('a'); a.href = objectUrl; a.download = `globalgrid2050_export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
    }

    // ── Status / Radius ───────────────────────────────────────────────────────────
    function toggleStatusMode() {
        statusMode = !statusMode;
        const btn = document.getElementById('btn-status');
        btn.classList.toggle('active', statusMode); btn.setAttribute('aria-pressed', statusMode);
        
        if (map.getLayer('l-naei_co2-glow')) {
            const isBaseVisible = document.querySelector('input[data-layer-id="naei_co2"]')?.checked;
            map.setLayoutProperty('l-naei_co2-glow', 'visibility', statusMode ? 'none' : (isBaseVisible ? 'visible' : 'none'));
        }

        REPD_IDS.forEach(id => {
            if (!map.getLayer(`l-${id}`)) return;
            if (id === 'solar' || id === 'solar_roof') {
                if (map.getLayer(`l-${id}-glow`)) {
                    const isBaseVisible = document.querySelector(`input[data-layer-id="${id}"]`).checked;
                    map.setLayoutProperty(`l-${id}-glow`, 'visibility', statusMode ? 'none' : (isBaseVisible ? 'visible' : 'none'));
                }
            }
            if (statusMode) {
                map.setPaintProperty(`l-${id}`, 'circle-color', ['match', ['downcase', ['coalesce', ['get', 'status'], '']],
                    'operational','#00ff88','under construction','#ffcc00','awaiting construction','#ffaa00',
                    'consented','#ff8800','planning permission granted','#ff8800','planning approved','#ff8800',
                    'application submitted','#8888ff','pre-construction','#aaaaff','#444']);
            } else {
                const layer = layerConfigById.get(id);
                if (id === 'solar_roof') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400']);
                } else if (id === 'solar') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200']);
                } else {
                    map.setPaintProperty(`l-${id}`, 'circle-color', layer.color);
                }
            }
        });
    }

    function toggleRadiusMode() {
        radiusMode = !radiusMode;
        const btn = document.getElementById('btn-radius');
        btn.classList.toggle('active', radiusMode); btn.setAttribute('aria-pressed', radiusMode);
        document.getElementById('radius-popup').style.display = radiusMode ? 'block' : 'none';
        map.getCanvas().style.cursor = radiusMode ? 'crosshair' : '';
        
        if (radiusMode && measureMode) toggleMeasureMode();
        if (radiusMode && radiusAreaMode) toggleRadiusAreaMode();
        if (radiusMode && zoneDrawMode) toggleZoneDrawMode();

        if (!radiusMode) { clearRadiusCircle(); radiusCenter = null; if (radiusMarker) { radiusMarker.remove(); radiusMarker = null; } }
    }

    function doRadiusSearch(lon, lat) {
        if (!validateRadiusInput()) return;
        const km = getRadiusValue(); radiusCenter = { lon, lat }; drawRadiusCircle(lon, lat, km);
        if (radiusMarker) radiusMarker.remove(); radiusMarker = null;
        const nearby = allREPDFeatures.filter(f => { const [flon, flat] = f.geometry.coordinates; return haversine(lon, lat, flon, flat) <= km; }).sort((a, b) => (b.properties.capacity || 0) - (a.properties.capacity || 0));
        if (!nearby.length) {
            openPopup([lon, lat], `
                <div style="font-family:monospace;background:#000;padding:8px">
                    <b style="color:#00ffff">◎ ${km}km radius active</b><br><br>
                    <span style="color:#888;font-size:10px">No REPD assets found in this area.</span><br>
                    <span style="color:#555;font-size:9px;line-height:1.6">Tick layers in the panel below<br>to explore assets within this circle.</span>
                </div>`);
            return;
        }
        const totalMW = nearby.reduce((s, f) => s + (parseFloat(f.properties.capacity) || 0), 0);
        const byTech  = {};
        nearby.forEach(f => { const t = f.properties.tech; byTech[t] = (byTech[t] || 0) + 1; });
        const techSummary = Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span style="color:#888">${escapeHTML(t)}: ${n}</span>`).join('<br>');
        const topAssets = nearby.slice(0, 5).map(f => {
            const p = f.properties;
            return `<div style="border-top:1px solid #222;padding-top:4px;margin-top:4px">
                <b style="color:#ffcc00;font-size:11px">${escapeHTML(p.name)}</b><br>
                <span style="color:#888;font-size:10px">${escapeHTML(p.raw_tech)}</span>
                <span style="color:#ffae00;font-size:10px"> ${p.capacity || '?'} MW</span></div>`;
        }).join('');
        openPopup([lon, lat], `
            <div style="font-family:monospace;background:#000;padding:6px">
                <b style="color:#00ffff">◎ ${km}km — ${nearby.length} assets | ${totalMW.toFixed(1)} MW</b><br>
                <span style="color:#555;font-size:9px;line-height:1.8">Tick layers in the panel to explore this area</span><br><br>
                ${techSummary}${topAssets}
            </div>`);
    }

    // ── DOM Builder ───────────────────────────────────────────────────────────────
    function buildLayerRow(layer, idPrefix) {
        const label = document.createElement('label'); label.className = 'key-item';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.layerId = layer.id; input.setAttribute('data-layer-id', layer.id);
        const span = document.createElement('span'); span.id = `${idPrefix}${layer.id}`; span.setAttribute('data-base-label', layer.label); span.style.color = layer.color; span.style.fontSize = '11px';
        const existing = document.getElementById(`lbl-${layer.id}`); span.innerText = existing ? existing.innerText : `${layer.label} [WAIT]`;
        const mainCb = document.querySelector(`input[data-layer-id="${layer.id}"]`); if (mainCb) input.checked = mainCb.checked;
        label.appendChild(input); label.appendChild(document.createTextNode(' ')); label.appendChild(span);
        return label;
    }

    function buildDOM() {
        const container   = document.getElementById('scada-ui-container');
        const fsContainer = document.getElementById('fs-curtain-keys');
        container.innerHTML = ''; fsContainer.innerHTML = '';
        const fragment   = document.createDocumentFragment();
        const fsFragment = document.createDocumentFragment();

        GRID_CONFIG.forEach(group => {
            const groupDiv   = document.createElement('div'); groupDiv.className = 'key-group';
            const fsGroupDiv = document.createElement('div'); fsGroupDiv.className = 'key-group';
            groupDiv.innerHTML = fsGroupDiv.innerHTML = `<div class="key-title">${group.group}</div>`;
            group.layers.forEach(layer => {
                const label = document.createElement('label'); label.className = 'key-item';
                const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.layerId = layer.id; input.setAttribute('data-layer-id', layer.id);
                const span  = document.createElement('span'); span.id = `lbl-${layer.id}`; span.setAttribute('data-base-label', layer.label); span.style.color = layer.color; span.innerText = `${layer.label} [WAIT]`;
                label.appendChild(input); label.appendChild(document.createTextNode(' ')); label.appendChild(span);
                groupDiv.appendChild(label); fsGroupDiv.appendChild(buildLayerRow(layer, 'fs-lbl-'));
            });
            fragment.appendChild(groupDiv); fsFragment.appendChild(fsGroupDiv);
        });

        const bmHTML = `<div class="key-title">Basemap</div><label class="key-item"><input type="radio" name="bm" value="dark" checked> Dark</label><label class="key-item"><input type="radio" name="bm" value="sat"> Satellite</label>`;
        const bmGroup = document.createElement('div'); bmGroup.className = 'key-group'; bmGroup.innerHTML = bmHTML; fragment.appendChild(bmGroup);
        const fsBmGroup = document.createElement('div'); fsBmGroup.className = 'key-group'; fsBmGroup.innerHTML = bmHTML.replace(/name="bm"/g, 'name="bm-fs"'); fsFragment.appendChild(fsBmGroup);

        container.appendChild(fragment); fsContainer.appendChild(fsFragment);

        container.addEventListener('change', e => {
            if (e.target.type === 'checkbox' && e.target.dataset.layerId) {
                const layerId = e.target.dataset.layerId; const isVisible = e.target.checked;
                const fsCb = document.querySelector(`#fs-curtain-keys input[data-layer-id="${layerId}"]`); if (fsCb) fsCb.checked = isVisible;
                handleLayerToggle(layerId, isVisible);
            } else if (e.target.name === 'bm') {
                map.setLayoutProperty('l-sat', 'visibility', e.target.value === 'sat' ? 'visible' : 'none');
                const fsBm = document.querySelector(`input[name="bm-fs"][value="${e.target.value}"]`); if (fsBm) fsBm.checked = true;
            }
        });

        fsContainer.addEventListener('change', e => {
            if (e.target.type === 'checkbox' && e.target.dataset.layerId) {
                const layerId = e.target.dataset.layerId; const isVisible = e.target.checked;
                const mainCb = document.querySelector(`#scada-ui-container input[data-layer-id="${layerId}"]`); if (mainCb) mainCb.checked = isVisible;
                handleLayerToggle(layerId, isVisible);
            } else if (e.target.name === 'bm-fs') {
                map.setLayoutProperty('l-sat', 'visibility', e.target.value === 'sat' ? 'visible' : 'none');
                const mainBm = document.querySelector(`input[name="bm"][value="${e.target.value}"]`); if (mainBm) mainBm.checked = true;
            }
        });

        document.getElementById('fs-curtain-tab').addEventListener('click', toggleCurtain);

        const input = document.getElementById('search-input'); const btn = document.getElementById('search-btn'); const resultsEl = document.getElementById('search-results');
        input.addEventListener('input', () => searchProjects(input.value));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') searchProjects(input.value); if (e.key === 'Escape') resultsEl.style.display = 'none'; });
        btn.addEventListener('click', () => searchProjects(input.value));
        document.getElementById('map').addEventListener('click', () => { resultsEl.style.display = 'none'; });

        document.getElementById('btn-export').addEventListener('click', exportCSV); document.getElementById('btn-status').addEventListener('click', toggleStatusMode);
        document.getElementById('btn-radius').addEventListener('click', toggleRadiusMode); document.getElementById('btn-measure').addEventListener('click', toggleMeasureMode);
        document.getElementById('btn-measure-undo').addEventListener('click', undoLastMeasurePoint);

        const radiusInput = document.getElementById('radius-input');
        if(radiusInput) {
            radiusInput.addEventListener('input', () => validateRadiusInput());
            radiusInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (validateRadiusInput() && radiusCenter) doRadiusSearch(radiusCenter.lon, radiusCenter.lat); } e.stopPropagation(); });
            radiusInput.addEventListener('blur', () => {
                const raw = parseFloat(radiusInput.value);
                if (isNaN(raw) || raw < RADIUS_MIN) radiusInput.value = RADIUS_MIN; else if (raw > RADIUS_MAX) radiusInput.value = RADIUS_MAX;
                radiusInput.classList.remove('invalid'); if (radiusCenter) doRadiusSearch(radiusCenter.lon, radiusCenter.lat);
            });
        }

        const btnRadiusArea = document.getElementById('btn-radius-area');
        if (btnRadiusArea) btnRadiusArea.addEventListener('click', toggleRadiusAreaMode);

        const btnZoneDraw = document.getElementById('btn-zonedraw');
        if (btnZoneDraw) btnZoneDraw.addEventListener('click', toggleZoneDrawMode);

        const btnZoneDrawUndo = document.getElementById('btn-zonedraw-undo');
        if (btnZoneDrawUndo) btnZoneDrawUndo.addEventListener('click', zoneDrawUndo);

        const zdRadiusInput = document.getElementById('zonedraw-radius-input');
        if (zdRadiusInput) {
            zdRadiusInput.addEventListener('keydown', e => { e.stopPropagation(); });
            zdRadiusInput.addEventListener('blur', () => {
                const raw = parseFloat(zdRadiusInput.value);
                if (isNaN(raw) || raw <= 0) zdRadiusInput.value = String(ZONE_DRAW_DEFAULT_KM);
                else if (raw > ZONE_DRAW_MAX_KM) zdRadiusInput.value = String(ZONE_DRAW_MAX_KM);
            });
        }

        const rAreaInput = document.getElementById('radius-area-input');
        if (rAreaInput) {
            rAreaInput.addEventListener('keydown', e => { 
                if (e.key === 'Enter') { 
                    e.preventDefault(); 
                    if (radiusAreaCenter) doRadiusAreaMeasure(radiusAreaCenter.lon, radiusAreaCenter.lat); 
                } 
                e.stopPropagation(); 
            });
            rAreaInput.addEventListener('blur', () => {
                const raw = parseFloat(rAreaInput.value);
                if (isNaN(raw) || raw <= 0) rAreaInput.value = 1; else if (raw > MAX_RADIUS_KM) rAreaInput.value = MAX_RADIUS_KM;
                rAreaInput.classList.remove('invalid'); 
                if (radiusAreaCenter) doRadiusAreaMeasure(radiusAreaCenter.lon, radiusAreaCenter.lat);
            });
        }
    }

    // ── Layer Hydration ───────────────────────────────────────────────────────────
    function handleLayerToggle(layerId, isVisible) {
        if (map.getLayer(`l-${layerId}`)) map.setLayoutProperty(`l-${layerId}`, 'visibility', isVisible ? 'visible' : 'none');
        if (map.getLayer(`l-${layerId}-glow`)) map.setLayoutProperty(`l-${layerId}-glow`, 'visibility', (isVisible && !statusMode) ? 'visible' : 'none');
        const mapId = `l-${layerId}`;
        if (isVisible) {
            if (!_visibleInteractiveIds.includes(mapId)) _visibleInteractiveIds.push(mapId);
            if (!_visibleHoverIds.includes(mapId)) _visibleHoverIds.push(mapId);
        } else {
            _visibleInteractiveIds = _visibleInteractiveIds.filter(id => id !== mapId);
            _visibleHoverIds = _visibleHoverIds.filter(id => id !== mapId);
        }
        if (isVisible && layerId !== '400') hydrateLayer(layerId);
    }

    function getLayerConfig(layerId) { return layerConfigById.get(layerId); }

    function getSourceIdForLayer(layerId) {
        if (REPD_IDS.includes(layerId)) return 'src-repd';
        if (TRANSIT_IDS.includes(layerId)) return TRANSIT_SOURCE_MAP[layerId];
        if (layerId === 'naei_co2') return 'src-naei_co2';
        return `src-${layerId}`;
    }

    async function hydrateLayer(layerId) {
        const state = RUNTIME_STATE[layerId];
        if (!state || state.loaded || state.loading) return;
        state.loading = true; updateUIState(layerId, 'LOAD');
        const layerConfig = getLayerConfig(layerId);
        if (!layerConfig) { updateUIState(layerId, 'FAIL'); state.loading = false; return; }

        if (TRANSIT_IDS.includes(layerId)) {
            const sourceId = TRANSIT_SOURCE_MAP[layerId];
            const siblings = TRANSIT_IDS.filter(id => TRANSIT_SOURCE_MAP[id] === sourceId && id !== layerId);
            if (siblings.some(id => RUNTIME_STATE[id] && RUNTIME_STATE[id].loaded)) { state.loaded = true; state.loading = false; updateUIState(layerId, 'OK'); return; }
        }

        await networkQueue.add(async () => {
            try {
                let features = await fetchAndParseGeoJSON(layerConfig.url);
                if (features.length === 0) { updateUIState(layerId, 'EMPTY'); state.loading = false; return; }
                if (layerConfig.isSubs) globalSubsData = features;
                if (layerConfig.snap) {
                    if (!globalSubsData) { const subsLayer = getLayerConfig('subs'); globalSubsData = await fetchAndParseGeoJSON(subsLayer.url); }
                    console.warn(`[SNAP] Runtime snapping active for "${layerId}" — ${features.length} features. Move to build pipeline when possible.`);
                    features = snapLines(features, globalSubsData);
                }
                const sourceId = getSourceIdForLayer(layerId);
                const source   = map.getSource(sourceId);
                if (!source) { console.error(`[SOURCE MISSING] ${sourceId}`); updateUIState(layerId, 'FAIL'); state.loading = false; return; }
                source.setData({ type: 'FeatureCollection', features });
                state.loaded = true; state.loading = false;

                if (REPD_IDS.includes(layerId)) {
                    allREPDFeatures = features; buildSearchIndex();
                    function evalFilter(filter, props) {
                        if (!filter) return true;
                        const op = filter[0];
                        if (op === '==') { const v = filter[1][0] === 'get' ? props[filter[1][1]] : null; return String(v).toLowerCase() === String(filter[2]).toLowerCase(); }
                        if (op === 'all') { return filter.slice(1).every(f => evalFilter(f, props)); }
                        if (op === '>=') { const v = filter[1][0] === 'coalesce' ? (parseFloat(props[filter[1][1][1]]) || 0) : 0; return v >= filter[2]; }
                        return true;
                    }
                    REPD_IDS.forEach(id => {
                        if (!RUNTIME_STATE[id]) return;
                        RUNTIME_STATE[id].loaded = true; RUNTIME_STATE[id].loading = false;
                        const lCfg = getLayerConfig(id);
                        const filtered = lCfg && lCfg.filter ? features.filter(f => evalFilter(lCfg.filter, f.properties)) : features.filter(f => f.properties.tech === id);
                        const idStats = filtered.reduce((acc, f) => { 
                            acc.count++; 
                            acc.mw += parseFloat(f.properties.capacity) || 0; 
                            return acc; 
                        }, { count: 0, mw: 0 });
                        updateUIState(id, idStats.count > 0 ? 'OK' : 'EMPTY', idStats.count > 0 ? idStats : null);
                    });
                    if (statusMode) { toggleStatusMode(); toggleStatusMode(); }
                } else if (layerId === 'naei_co2') {
                    const stats = features.reduce((acc, f) => { 
                        acc.count++; 
                        acc.mw += parseFloat(f.properties.emission_tco2e) || 0; 
                        return acc; 
                    }, { count: 0, mw: 0 });
                    updateUIState(layerId, stats.count > 0 ? 'OK' : 'EMPTY', stats.count > 0 ? stats : null);
                } else if (TRANSIT_IDS.includes(layerId)) {
                    TRANSIT_IDS.forEach(tid => { if (TRANSIT_SOURCE_MAP[tid] === TRANSIT_SOURCE_MAP[layerId] && RUNTIME_STATE[tid]) { RUNTIME_STATE[tid].loaded = true; RUNTIME_STATE[tid].loading = false; updateUIState(tid, 'OK'); } });
                } else { 
                    updateUIState(layerId, 'OK'); 
                }
            } catch (err) { console.error(`[LAYER FAILED] ${layerId}:`, err); state.loading = false; updateUIState(layerId, 'FAIL'); }
        });
    }

    // ── Map Load ──────────────────────────────────────────────────────────────────
    map.on('load', () => {
        buildDOM();
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });

        map.addSource('src-radius-circle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-radius-circle-fill',   type: 'fill', source: 'src-radius-circle', paint: { 'fill-color': '#00ffff', 'fill-opacity': 0.04 } });
        map.addLayer({ id: 'l-radius-circle-stroke', type: 'line', source: 'src-radius-circle', paint: { 'line-color': '#00ffff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } });

        map.addSource('src-radius-area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-radius-area-fill',   type: 'fill', source: 'src-radius-area', paint: { 'fill-color': '#ff00ff', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'l-radius-area-stroke', type: 'line', source: 'src-radius-area', paint: { 'line-color': '#ff00ff', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } });

        map.addSource('src-measure-line',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-measure-fill',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-measure-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-measure-fill',   type: 'fill',   source: 'src-measure-fill',   paint: { 'fill-color': '#ffff00', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'l-measure-line',   type: 'line',   source: 'src-measure-line',   paint: { 'line-color': '#ffff00', 'line-width': 2, 'line-dasharray': [3, 2] } });
        map.addLayer({ id: 'l-measure-points', type: 'circle', source: 'src-measure-points', paint: { 'circle-color': '#ffff00', 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });

        // ── Zone Draw layers (orange accent) ──────────────────────────────────────
        map.addSource('src-zonedraw-fill',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-zonedraw-line',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-zonedraw-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-zonedraw-fill',   type: 'fill',   source: 'src-zonedraw-fill',   paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'l-zonedraw-line',   type: 'line',   source: 'src-zonedraw-line',   paint: { 'line-color': '#ff6600', 'line-width': 3, 'line-dasharray': [4, 2] } });
        map.addLayer({ id: 'l-zonedraw-points', type: 'circle', source: 'src-zonedraw-points', paint: {
            'circle-color':   ['case', ['==', ['get', 'kind'], 'vertex'], '#ff6600', '#ffaa44'],
            'circle-radius':  ['case', ['==', ['get', 'kind'], 'vertex'], 9, 6],
            'circle-stroke-width': 2, 'circle-stroke-color': '#000',
            'circle-opacity': ['case', ['==', ['get', 'kind'], 'vertex'], 1, 0.85]
        } });

        const allLayerIds = [];

        GRID_CONFIG.forEach(group => {
            group.layers.forEach(layer => {
                if (REPD_IDS.includes(layer.id) || TRANSIT_IDS.includes(layer.id) || layer.id === 'ev' || layer.id === 'naei_co2') return;
                if (layer.id === '400') {
                    map.addSource('src-400', {
                        type: 'geojson',
                        data: '../cartridges/5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993/grid_400kv.geojson'
                    });
                } else {
                    map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                }
                const layerObject = {
                    id: `l-${layer.id}`, type: layer.type === 'line' ? 'line' : 'circle', source: `src-${layer.id}`, layout: { visibility: 'none' },
                    paint: layer.type === 'line' ? { 'line-color': layer.color, 'line-width': layer.width } : { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' }
                };
                if (layer.filter)  layerObject.filter  = layer.filter; if (layer.minzoom) layerObject.minzoom  = layer.minzoom;
                map.addLayer(layerObject); allLayerIds.push(`l-${layer.id}`);
            });
        });

        // ── Heavy Industry (Custom VIP styling) ──
        map.addSource('src-naei_co2', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ 
            id: `l-naei_co2-glow`, 
            type: 'circle', 
            source: 'src-naei_co2', 
            filter: ['>=', ['coalesce', ['get', 'emission_tco2e'], 0], 50000], 
            layout: { visibility: 'none' }, 
            paint: { 
                'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'], 
                'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,20,200000,40,1000000,60,5000000,90], 
                'circle-opacity': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,0.15,200000,0.25,1000000,0.35], 
                'circle-blur': 1.0, 
                'circle-stroke-width': 0 
            } 
        });
        map.addLayer({
            id: 'l-naei_co2',
            type: 'circle',
            source: 'src-naei_co2',
            layout: { visibility: 'none' },
            paint: {
                'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,'#ffcc00',50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'], 
                'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,6,50000,10,200000,14,1000000,20,5000000,28], 
                'circle-stroke-width': 1.5, 
                'circle-stroke-color': '#000', 
                'circle-opacity': 0.85
            }
        });
        allLayerIds.push('l-naei_co2-glow', 'l-naei_co2');

        Object.keys(TRANSIT_URLS).forEach(sourceId => { map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); });
        TRANSIT_IDS.forEach(id => {
            const layer = getLayerConfig(id);
            const layerObject = {
                id: `l-${id}`, type: 'circle', source: TRANSIT_SOURCE_MAP[id], layout: { visibility: 'none' },
                paint: { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
            };
            if (layer.filter)  layerObject.filter  = layer.filter; if (layer.minzoom) layerObject.minzoom  = layer.minzoom;
            map.addLayer(layerObject); allLayerIds.push(`l-${id}`);
        });

        map.addSource('src-ev', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-ev', type: 'circle', source: 'src-ev', layout: { visibility: 'none' }, paint: { 'circle-color': '#00ff88', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 } });
        allLayerIds.push('l-ev');

        map.addSource('src-repd', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        REPD_IDS.forEach(id => {
            const layer = getLayerConfig(id);
            if (id === 'solar_roof') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 1.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],1.0,26,2.0,30,5.0,36,10.0,44], 'circle-opacity': 0.15, 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'solar') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 4.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,'#ffff00',20.0,'#ffaa00',50.0,'#ff4400',200.0,'#ff0000'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,22,20.0,32,50.0,44,200.0,60,500.0,80], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,0.12,20.0,0.18,50.0,0.25,200.0,0.35], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'solar_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#00ff88',50.0,'#00cc66',200.0,'#009944',350.0,'#006622'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,28,50.0,36,200.0,56,350.0,70,500.0,88], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'bess_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#ffb3d9',50.0,'#ff69b4',200.0,'#ff1493',350.0,'#cc0066'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'wind_onshore_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#99ffee',50.0,'#00ffcc',200.0,'#00ccaa',350.0,'#008877'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'wind_offshore_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#99ccff',50.0,'#3399ff',200.0,'#0055dd',350.0,'#003399'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            const circlePaint = id === 'solar_roof'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,7,0.5,7,0.99,8,1.0,16,2.0,18,5.0,22,10.0,28], 'circle-stroke-width': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,1,0.99,1,1.0,2], 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
                : id === 'solar'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 }
                : id === 'solar_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#66ff99',10,'#33ff77',50,'#00dd55',100,'#00bb44',200,'#008833',350,'#006622',500,'#004411'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,10,10,14,50,18,100,22,200,28,350,35,500,42], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'bess_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffccee',10,'#ffb3d9',50,'#ff69b4',100,'#ff1493',200,'#dd0077',350,'#990066',500,'#660044'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'wind_onshore_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ccfff5',10,'#99ffee',50,'#00ffcc',100,'#00ddaa',200,'#00aa88',350,'#007766',500,'#004433'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'wind_offshore_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#cce5ff',10,'#99ccff',50,'#3399ff',100,'#0066ee',200,'#0044bb',350,'#003399',500,'#001166'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : { 'circle-color': layer.color, 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 };

            map.addLayer({ id: `l-${id}`, type: 'circle', source: 'src-repd', filter: layer.filter, layout: { visibility: 'none' }, paint: circlePaint });
            allLayerIds.push(`l-${id}`);
        });

        // ── PERF: seed the visible layer cache from actual map state after all layers are added
        _rebuildVisibleCache(allLayerIds);

        // ── Map Events ────────────────────────────────────────────────────────────

        let _pendingToolClick = null;

        map.getCanvas().addEventListener('mousedown', e => {
            if (!zoneDrawMode) return;
            const lngLat = map.unproject([e.offsetX, e.offsetY]);
            _zoneDrawOnMouseDown({ lngLat, preventDefault: () => e.preventDefault() });
        });

        map.on('click', e => {
            if (measureMode) {
                _pendingToolClick = setTimeout(() => {
                    _pendingToolClick = null;
                    if (!measureClosed) {
                        measurePoints.push([e.lngLat.lng, e.lngLat.lat]);
                        updateMeasureLayers();
                        updateMeasureDisplay();
                    }
                }, CLICK_DEBOUNCE_MS);
                return;
            }
            if (zoneDrawMode) { _zoneDrawOnClick(e); return; }
            if (radiusMode) { doRadiusSearch(e.lngLat.lng, e.lngLat.lat); return; }
            if (radiusAreaMode) { doRadiusAreaMeasure(e.lngLat.lng, e.lngLat.lat); return; }

            if (!_visibleInteractiveIds.length) return;
            const features = map.queryRenderedFeatures(e.point, { layers: _visibleInteractiveIds });

            if (!features.length) return;
            const p    = features[0].properties || {}; const name = p.name || p.SiteName || p['Site Name'] || 'Unnamed Asset';

            if (p.type === 'supermarket') {
                const address = [p.street, p.city, p.postcode].filter(Boolean).join(', '); const area = p.area_m2 ? `${p.area_m2.toLocaleString()} m²` : '';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:${p.colour || '#00ffff'};font-size:13px">${escapeHTML(p.brand || name)}</b><br>${p.name && p.name !== p.brand ? `<span style="color:#fff">${escapeHTML(p.name)}</span><br>` : ''}<span style="color:#888">${escapeHTML(address)}</span><br>${area ? `<span style="color:#ffae00">Area: ${escapeHTML(area)}</span>` : ''}</div>`); return;
            }

            if (p.type === 'elizabeth_line_station') {
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#60399E;font-size:13px">${escapeHTML(name)}</b><br><span style="color:#888">Elizabeth Line Station</span><br><span style="color:#555;font-size:10px">${escapeHTML(p.operator)}</span></div>`); return;
            }

            if (p.type === 'stadium') {
                const club = p.club ? `<span style="color:#fff">${escapeHTML(p.club)}</span><br>` : ''; const cap = p.capacity && p.capacity !== "Unknown" ? `Capacity: ${Number(p.capacity).toLocaleString()}` : 'Capacity: Unknown';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#e5ff00;font-size:13px">${escapeHTML(name)}</b><br>${club}<span style="color:#888">${escapeHTML(p.sport)}</span><br><span style="color:#ffae00">${escapeHTML(cap)}</span></div>`); return;
            }

            if (p.type === 'naei_emitter') {
                const tonnes = p.emission_tco2e ? Number(p.emission_tco2e).toLocaleString('en-GB', { maximumFractionDigits: 0 }) : 'Unknown';
                const dataLabel = p.datatype === 'O' ? 'Self-reported by the company' : p.datatype === 'M' ? 'Estimated by the government' : 'Official figures';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:8px 10px;border:1px solid #ff4400;border-radius:4px;min-width:220px;max-width:280px"><b style="color:#ff4400;font-size:13px">🏭 ${escapeHTML(name)}</b><br><span style="color:#888;font-size:10px">Run by: ${escapeHTML(p.operator || 'Unknown')}</span><br><span style="color:#aaa;font-size:10px">Industry: ${escapeHTML(p.sector || 'Unknown')}</span><br><span style="color:#aaa;font-size:10px">Country: ${escapeHTML(p.country || 'UK')}</span><br><br><span style="color:#ff4400;font-size:12px">Greenhouse gases pumped into the air in 2023:</span><br><b style="color:#fff;font-size:13px">${tonnes} tonnes</b><br><span style="color:#555;font-size:9px">Carbon dioxide and nitrous oxide combined — measured in CO₂ equivalent tonnes</span><br><br><span style="color:#444;font-size:9px">${escapeHTML(dataLabel)} · UK Government emissions database</span></div>`); return;
            }

            const tech = p.tech || ''; const rawTech = p.raw_tech || p.type || tech; const voltage = p.voltage || ''; const capacity = parseFloat(p.capacity) || 0; const powerKw = p.power_kw || null; const connectors = p.connectors || ''; const status = p.status || ''; const operator = p.operator || ''; const mounting = (p.mounting && p.mounting !== 'nan') ? ` | ${escapeHTML(p.mounting)}` : ''; const capStr = capacity ? `${capacity} MW` : ''; const statusCol = STATUS_COLOURS[normalizeStatus(status)] || '#888'; const searchBtns = REPD_IDS.includes(tech) ? buildSearchButtons(name, capacity, tech) : ''; const evFields = powerKw ? `<span style="color:#00ff88;font-size:10px">${powerKw} kW</span>${connectors ? `<span style="color:#555;font-size:10px"> | ${escapeHTML(connectors)}</span>` : ''}<br>` : '';
            openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#00ffff;font-size:13px">${escapeHTML(name)}</b><br><span style="color:#888">${escapeHTML(rawTech)}${voltage ? ` | ${escapeHTML(voltage)}` : ''}${mounting}</span><br>${evFields}${capStr ? `<span style="color:#ffae00">${escapeHTML(capStr)}</span>` : ''}${status ? `<span style="color:${statusCol};font-size:10px"> ● ${escapeHTML(status)}</span>` : ''}<br>${operator ? `<span style="color:#555;font-size:10px">${escapeHTML(operator)}</span>` : ''}${searchBtns}</div>`);
        });

        map.on('dblclick', e => {
            if (_pendingToolClick) { clearTimeout(_pendingToolClick); _pendingToolClick = null; }
            if (zoneDrawMode) { e.preventDefault(); return; }
            if (!measureMode || measurePoints.length < 2) return;
            e.preventDefault();
            measureClosed = true;
            updateMeasureLayers();
            updateMeasureDisplay();
        });

        window.addEventListener('mouseup', () => { if (zoneDrawMode) _zoneDrawOnMouseUp(); });

        map.on('mousemove', e => {
            if (zoneDrawMode) { _zoneDrawOnMouseMove(e); return; }

            if (measureMode || radiusMode || radiusAreaMode) { map.getCanvas().style.cursor = 'crosshair'; return; }

            if (!_visibleHoverIds.length) { map.getCanvas().style.cursor = ''; return; }

            const now = Date.now();
            if (now - _lastHoverMs < HOVER_THROTTLE_MS) return;
            _lastHoverMs = now;

            if (_lastMouseMoveRaf) return;
            _lastMouseMoveRaf = requestAnimationFrame(() => {
                _lastMouseMoveRaf = null;
                const features = map.queryRenderedFeatures(e.point, { layers: _visibleHoverIds });
                map.getCanvas().style.cursor = features.length ? 'pointer' : '';
            });
        });

        GRID_CONFIG.forEach(group => { group.layers.forEach(layer => { if (layer.preload && layer.id !== '400') hydrateLayer(layer.id); }); });
        const state400 = RUNTIME_STATE['400'];
        if (state400) { state400.loaded = true; state400.loading = false; updateUIState('400', 'OK'); }
        focusCanonicalProjectDeepLink();
    });
};

/**
 * Module: geodesy
 *
 * One Earth radius for the whole estate, and the three operations every
 * measurement here is built from. This existed three times tonight - in
 * the sandbox, in the substation cartridge and in the data repository -
 * which is exactly how two of them end up on different radii without
 * anyone noticing.
 *
 * Radius 6378.137 km, matching Ventusltd/grid-distance-maths. Haversine.
 * No projection, no turf, no second radius for geometry.
 *
 * Pure functions. No DOM, no network, no state.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.geodesy) return;

  const EARTH_RADIUS_KM = 6378.137;
  const DEG = Math.PI / 180;

  function distanceKm(lon1, lat1, lon2, lat2) {
    const dLat = (lat2 - lat1) * DEG;
    const dLon = (lon2 - lon1) * DEG;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
    /* atan2, in this operand order, because that is the form every version
       of this estate has shipped - ventus-corev8engine.js haversine() and
       every cartridge carried from it.
       -------------------------------------------------------------------
       The extraction wrote 2 * R * asin(sqrt(a)) instead. Algebraically the
       same; numerically one unit in the last place apart, which the
       all-versions proof caught on West Burton Solar to Cottam:
       7.050150827184836 shipped, 7.050150827184837 from the module. It is
       1e-15 km and changes no figure any reader will ever see - and it is
       still wrong, because the claim being made is PARITY. A module that is
       nearly the incumbent is a module that has to be argued about every
       time a digit differs. */
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* A polygon reduces to the mean of its outer ring, not its first corner.
     A substation drawn as a compound outline would otherwise be measured
     from whichever vertex the mapper happened to start at.

     Point, Polygon and MultiPolygon, and NOTHING ELSE. The first draft of
     this module accepted any nested coordinate array and so returned a
     mean for a LineString where the incumbent returns null; the parity
     proof caught it against the live cartridge. Extraction is not the
     moment to change behaviour, so the behaviour is pinned here and any
     widening becomes its own version with its own reasoning.

     One deliberate difference, on malformed input only: this returns null
     where the incumbent would throw on a Point with no coordinates. No
     real geometry reaches that path, and a proof asserts it. */
  function representativePoint(geometry) {
    if (!geometry) return null;
    const { type, coordinates } = geometry;
    if (type === 'Point') {
      return Array.isArray(coordinates) && coordinates.length >= 2
        ? [coordinates[0], coordinates[1]] : null;
    }
    const ring = type === 'Polygon' ? coordinates && coordinates[0]
      : type === 'MultiPolygon' ? coordinates && coordinates[0] && coordinates[0][0]
        : null;
    if (!Array.isArray(ring) || !ring.length) return null;
    let sumLon = 0;
    let sumLat = 0;
    for (const point of ring) {
      sumLon += point[0];
      sumLat += point[1];
    }
    return [sumLon / ring.length, sumLat / ring.length];
  }

  /* OpenStreetMap's `voltage` is VOLTS at every magnitude, and a feature
     may carry several separated by a semicolon. Magnitude is not the unit:
     750 is a DC traction supply at a railway depot, not 750 kV. An audit
     of the served payload found 229 features (3.95%) carrying a token
     below 1,000, every one of which had been misread. An explicit `kv`
     property is already kilovolts and is trusted as such. */
  function voltagesKv(properties) {
    if (!properties) return [];
    const out = [];
    const explicit = properties.kv ?? properties.KV;
    if (explicit != null && String(explicit).trim() !== '') {
      for (const token of String(explicit).match(/\d+(?:\.\d+)?/g) || []) {
        const value = Number(token);
        if (Number.isFinite(value) && value > 0) out.push(value);
      }
    }
    const volts = properties.voltage ?? properties.VOLTAGE;
    if (volts != null) {
      for (const token of String(volts).match(/\d+(?:\.\d+)?/g) || []) {
        const value = Number(token);
        if (Number.isFinite(value) && value > 0) out.push(value / 1000);
      }
    }
    return [...new Set(out)].sort((a, b) => b - a);
  }

  /* Projection and bearing, carried in from the sandbox verbatim.
     ----------------------------------------------------------------------
     The deep scan found the body carrying a SECOND geodesy section - "the
     geodesy the layout needs, all on R_ATLAS" - four hundred lines away
     from the first. Two geodesies in one file, on a constant that must
     never differ, is the configuration that produced the divergence the
     all-versions proof caught. Both belong here, on the one radius, and
     the body now delegates rather than defining.

     The bodies below are the incumbent's, character for character apart
     from the radius identifier, so parity is a property of the move rather
     than something to argue about afterwards. */
  function destinationPoint(lon, lat, km, bearingDeg) {
    const ad = km / EARTH_RADIUS_KM;
    const brg = bearingDeg * DEG;
    const p1 = lat * DEG;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(ad)
      + Math.cos(p1) * Math.sin(ad) * Math.cos(brg));
    const l2 = lon * DEG + Math.atan2(
      Math.sin(brg) * Math.sin(ad) * Math.cos(p1),
      Math.cos(ad) - Math.sin(p1) * Math.sin(p2));
    return [l2 / DEG, p2 / DEG];
  }

  function initialBearingDeg(lon1, lat1, lon2, lat2) {
    const p1 = lat1 * DEG; const p2 = lat2 * DEG;
    const dl = (lon2 - lon1) * DEG;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / DEG + 360) % 360;
  }

  NS.geodesy = Object.freeze({
    schema: 'gridatlas.module.geodesy.v1',
    EARTH_RADIUS_KM,
    distanceKm,
    destinationPoint,
    initialBearingDeg,
    representativePoint,
    voltagesKv
  });
})();

/**
 * Module: network-topology
 *
 * What the network operator publishes about ONE site: its nodes, the
 * circuits that land on them, the transformers between them, the changes
 * it has published for future years, and which other sites those circuits
 * reach. Appendix B of the Electricity Ten Year Statement, read as a
 * node/branch model and reported as facts.
 *
 * Successor at generation 202609012245: the node-level adjacency this module
 * already builds is now handed OUT, so that the electrical-distance module
 * can traverse it instead of building a second one. A second implementation
 * of voltageOf would be a second opinion about which voltages are real, and
 * this estate has already shipped one cartridge carrying two geodesies that
 * disagreed in the last place. Nothing else changed: at() is byte-for-byte
 * the incumbent's, and the parity proof holds the two to identical answers
 * on the published payload.
 *
 * It answers "what is here, and what is it connected to". It does not
 * answer "can this project connect", and it cannot: that depends on queue
 * position, committed connections, consent and commercial terms which no
 * published appendix contains. The product says so itself and the refusal
 * travels inside every result, in the same object as the numbers, because
 * a caveat in a different place from the figure is a caveat nobody reads.
 *
 * Three disciplines, each of them a defect this estate has already shipped:
 *
 *   VOLTAGE IS NEVER MIXED. A card printed "5.1-49.6 kA" across a 132 kV
 *   and a 400 kV busbar and an engineer would have read it as one number
 *   for one point. So every answer here is grouped by the voltage of the
 *   node the circuit lands on, and a caller asking for one voltage gets
 *   only that voltage. There is no site-wide range in this module at all.
 *
 *   VOLTAGE IS NEVER DECODED. The node-code convention (digit 1->132,
 *   2->275, 4->400) is derived, not documented, and the product reports
 *   726 of 2,679 nodes whose voltage their site does not declare. This
 *   reads `voltage_kv` and honours `voltage_consistent_with_site`; where
 *   that is false the voltage is `null` and the node is grouped under
 *   'undeclared', never guessed from its name.
 *
 *   R, X AND B ARE NOT A LOAD FLOW. They are published percentages on a
 *   100 MVA base. Carrying them is publishing; solving with them would
 *   need a declared model, generation and load assumptions, tap positions
 *   and contingencies, and validation against a trusted solver. This
 *   module carries them and says what base they are on. It computes
 *   nothing from them.
 *
 * Fail closed: an unrecognised schema yields no index and therefore no
 * answers, rather than plausible ones from a shape that has moved.
 *
 * Depends on: nothing. Topology is not geometry - this module never
 * measures a distance and never touches a coordinate.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.networkTopology) return;

  const ACCEPTS = 'data-grid-gb.transmission-network.v1';

  const NOT_AN_ASSESSMENT =
    'Counts, lengths, ratings and impedances are what the network operator '
    + 'publishes about this site. None of them states whether any project can '
    + 'connect here, which depends on queue position, committed connections, '
    + 'consent and commercial terms that no published appendix contains.';

  const IMPEDANCE_BASIS =
    'R, X and B are percentages on a 100 MVA base, as published. They are '
    + 'network parameters, not a solved power flow.';

  const UNDECLARED = 'undeclared';

  /* A node's voltage is trusted only where the product says the site
     declares it. Everything else is undeclared - never inferred from the
     digit in the node code, which is a derived convention the product
     itself marks as undocumented. */
  function voltageOf(node) {
    if (!node) return null;
    if (node.voltage_consistent_with_site !== true) return null;
    return Number.isFinite(node.voltage_kv) ? node.voltage_kv : null;
  }

  const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));

  function ratingsOf(row) {
    const seasons = { winter: row.winter_mva, spring: row.spring_mva,
      summer: row.summer_mva, autumn: row.autumn_mva };
    const published = {};
    for (const [season, value] of Object.entries(seasons)) {
      if (Number.isFinite(value)) published[season] = value;
    }
    return Object.keys(published).length ? published : null;
  }

  function parametersOf(row) {
    const published = {};
    for (const [key, field] of [['r_pct', 'r_pct_100mva'], ['x_pct', 'x_pct_100mva'],
      ['b_pct', 'b_pct_100mva']]) {
      if (Number.isFinite(row[field])) published[key] = row[field];
    }
    return Object.keys(published).length ? published : null;
  }

  /**
   * @param product  the parsed data-grid-gb transmission-network payload
   * @returns an index, or null if the schema is not the one this reads
   */
  function index(product) {
    if (!product || product.schema !== ACCEPTS) return null;

    const nodes = new Map();
    for (const node of product.nodes || []) {
      if (node && node.node) nodes.set(node.node, node);
    }

    const sitesByCode = new Map();
    const sitesByName = new Map();
    for (const site of product.sites || []) {
      if (!site || !site.code) continue;
      sitesByCode.set(String(site.code).toUpperCase(), site);
      if (site.name) sitesByName.set(String(site.name).toUpperCase().trim(), site);
    }

    /* Branches are indexed by the node they land on, both ends, because a
       circuit is a fact about both of its sites. */
    const byNode = new Map();
    function land(nodeName, entry) {
      if (!nodeName) return;
      if (!byNode.has(nodeName)) byNode.set(nodeName, []);
      byNode.get(nodeName).push(entry);
    }
    for (const [kind, rows] of [['circuit', product.circuits],
      ['transformer', product.transformers], ['planned_change', product.planned_changes]]) {
      for (const row of rows || []) {
        if (!row) continue;
        land(row.node_1, { kind, row, near: 'node_1', far: 'node_2' });
        land(row.node_2, { kind, row, near: 'node_2', far: 'node_1' });
      }
    }

    function siteOf(nodeName) {
      const node = nodes.get(nodeName);
      return node ? node.site_code : null;
    }

    /* The adjacency, handed out rather than rebuilt.
       ------------------------------------------------------------------
       Every accessor here is a READ of the structures at() already uses,
       so a traversal cannot disagree with a one-hop view about which
       nodes exist, which site a node belongs to, or whether a node's
       voltage is trustworthy. planned_change rows are excluded from
       edges: a change published for 2029 is not a path a current can
       take today, and treating it as one would be the headroom lie in a
       new costume. They remain available through at(). */
    function graph() {
      return {
        schema: 'gridatlas.module.network-topology.graph.v1',
        has: (name) => nodes.has(name),
        nodeVoltageKv: (name) => voltageOf(nodes.get(name)),
        nodeSiteCode: (name) => {
          const node = nodes.get(name);
          return node ? node.site_code : null;
        },
        /* circuits and transformers only - see above */
        edgesAt: (name) => (byNode.get(name) || [])
          .filter((entry) => entry.kind !== 'planned_change'),
        nodesOfSite: (code) => {
          const wanted = String(code || '').toUpperCase();
          const out = [];
          for (const node of nodes.values()) {
            if (String(node.site_code || '').toUpperCase() === wanted) out.push(node.node);
          }
          return out.sort();
        },
        siteByCode: (code) => sitesByCode.get(String(code || '').toUpperCase()) || null,
        ratingsOf,
        parametersOf
      };
    }

    function resolve(key) {
      if (!key) return null;
      const wanted = String(key).toUpperCase().trim();
      return sitesByCode.get(wanted) || sitesByName.get(wanted) || null;
    }

    /**
     * Everything published about one site, grouped by the voltage of the
     * node each branch lands on. Never a site-wide range.
     *
     * @param key          site code or exact site name
     * @param options      { voltageKv } to restrict to one voltage
     */
    function at(key, options) {
      const site = resolve(key);
      if (!site) return null;
      const wantedKv = options && Number.isFinite(options.voltageKv)
        ? options.voltageKv : null;

      const siteNodes = [];
      for (const node of nodes.values()) {
        if (node.site_code !== site.code) continue;
        const kv = voltageOf(node);
        if (wantedKv != null && kv !== wantedKv) continue;
        siteNodes.push({ node: node.node, voltage_kv: kv });
      }
      siteNodes.sort((a, b) => a.node.localeCompare(b.node));

      const byVoltage = new Map();
      const neighbours = new Map();

      for (const entry of siteNodes) {
        for (const landing of byNode.get(entry.node) || []) {
          const farNode = landing.row[landing.far];
          const farSiteCode = siteOf(farNode);
          const farSite = farSiteCode ? sitesByCode.get(farSiteCode) : null;
          const internal = farSiteCode === site.code;

          const key2 = bandKey(entry.voltage_kv);
          if (!byVoltage.has(key2)) {
            byVoltage.set(key2, { voltage_kv: entry.voltage_kv,
              circuits: [], transformers: [], planned_changes: [] });
          }
          const band = byVoltage.get(key2);

          const published = {
            from_node: entry.node,
            to_node: farNode,
            to_site_code: farSiteCode,
            to_site_name: farSite ? farSite.name : null,
            within_this_site: internal,
            transmission_owner: landing.row.transmission_owner || null,
            parameters_pct_100mva: parametersOf(landing.row),
            ratings_mva: ratingsOf(landing.row)
          };

          if (landing.kind === 'circuit') {
            published.circuit_type = landing.row.circuit_type || null;
            if (Number.isFinite(landing.row.ohl_km)) published.ohl_km = landing.row.ohl_km;
            if (Number.isFinite(landing.row.cable_km)) published.cable_km = landing.row.cable_km;
            band.circuits.push(published);
          } else if (landing.kind === 'transformer') {
            if (Number.isFinite(landing.row.rating_mva)) published.rating_mva = landing.row.rating_mva;
            delete published.ratings_mva;
            band.transformers.push(published);
          } else {
            published.year = landing.row.year || null;
            published.status = landing.row.status || null;
            published.asset = landing.row.asset || null;
            band.planned_changes.push(published);
          }

          /* A neighbour is another SITE this site's circuits reach. An
             internal branch is not a neighbour, and a planned change is
             not a neighbour either - it has not been built. */
          if (landing.kind === 'circuit' && !internal && farSiteCode) {
            if (!neighbours.has(farSiteCode)) {
              neighbours.set(farSiteCode, {
                site_code: farSiteCode,
                site_name: farSite ? farSite.name : null,
                circuits: 0
              });
            }
            neighbours.get(farSiteCode).circuits += 1;
          }
        }
      }

      const voltages = [...byVoltage.entries()]
        .sort((a, b) => {
          if (a[0] === UNDECLARED) return 1;
          if (b[0] === UNDECLARED) return -1;
          return Number(b[0]) - Number(a[0]);
        })
        .map(([, band]) => band);

      return {
        schema: 'gridatlas.module.network-topology.v1',
        source: ACCEPTS,
        site: {
          code: site.code,
          name: site.name,
          transmission_owner: site.transmission_owner || null,
          voltages_kv: Array.isArray(site.voltages_kv) ? site.voltages_kv.slice() : []
        },
        requested_voltage_kv: wantedKv,
        nodes: siteNodes,
        by_voltage: voltages,
        neighbours: [...neighbours.values()].sort((a, b) => b.circuits - a.circuits),
        counts: {
          nodes: siteNodes.length,
          circuits: voltages.reduce((sum, band) => sum + band.circuits.length, 0),
          transformers: voltages.reduce((sum, band) => sum + band.transformers.length, 0),
          planned_changes: voltages.reduce((sum, band) => sum + band.planned_changes.length, 0),
          neighbour_sites: neighbours.size
        },
        impedance_basis: IMPEDANCE_BASIS,
        not_an_assessment: NOT_AN_ASSESSMENT
      };
    }

    return {
      schema: 'gridatlas.module.network-topology.v1',
      source: ACCEPTS,
      counts: {
        sites: sitesByCode.size,
        nodes: nodes.size,
        branch_landings: byNode.size
      },
      site: resolve,
      at,
      graph
    };
  }

  NS.networkTopology = Object.freeze({
    schema: 'gridatlas.module.network-topology.v1',
    accepts: ACCEPTS,
    not_an_assessment: NOT_AN_ASSESSMENT,
    impedance_basis: IMPEDANCE_BASIS,
    index
  });
})();

/**
 * Module: electrical-distance
 *
 * How far away a substation is, measured in the network operator's own
 * published circuits rather than in kilometres.
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything this estate has measured until now has been geometry. The
 * geodesy module answers "how many kilometres from this project to that
 * substation", and it answers it correctly, to the last place. But a
 * kilometre is not a connection. Two substations 7 km apart can be on
 * opposite sides of a network boundary with no circuit between them; two
 * substations 90 km apart can be the two ends of a single published
 * circuit. A map that shows only the first number invites the reader to
 * infer the second, and that inference is wrong often enough to be
 * dangerous in a document someone spends money on.
 *
 * So this module answers a different question, from a different source:
 * on the network Appendix B actually publishes, how many circuits lie
 * between these two sites, and which ones? Every hop is a published row
 * with an identity. The answer is a citation, not an estimate.
 *
 * WHAT IT IS NOT
 * --------------
 * A hop count is not a distance. Two hops is not "twice as far" as one,
 * and a site one hop away is not thereby available to connect to. It is
 * not an impedance either: R, X and B are carried on every hop exactly as
 * published, and this module contains no arithmetic over them at all -
 * summing impedance along a path is the first step of a load flow, and a
 * load flow needs a declared model, base values, taps, generation and load
 * assumptions, contingencies and validation against a trusted solver. None
 * of those are in this file, so neither is the sum.
 *
 * THE ONE RULE THAT SHAPES THE TRAVERSAL
 * --------------------------------------
 * A voltage may only change across a transformer, and when it does the
 * transformer is named in the path. A circuit whose two ends carry
 * different declared voltages is not a voltage change - it is a
 * contradiction in the data, and the traversal refuses it and says so
 * rather than quietly walking through. Undeclared voltages are carried as
 * undeclared and never guessed from a node code.
 *
 *   node tools/proofs/modules/202609012245-electrical-distance.proof.mjs
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.electricalDistance) return;

  const SCHEMA = 'gridatlas.module.electrical-distance.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const NOT_A_DISTANCE =
    'Hops are published circuits between two sites, not a distance. A site '
    + 'one hop away may be a hundred kilometres away, and a site ten '
    + 'kilometres away may be on no shared circuit at all.';

  const NOT_A_CAPACITY =
    'A path existing on the published network says nothing about whether '
    + 'anything can flow along it for a new project. Ratings are the '
    + 'circuit\'s, not a spare allowance, and queue position, committed '
    + 'connections, consent and commercial terms appear in no appendix.';

  const IMPEDANCE_CARRIED =
    'R, X and B are reproduced on each hop exactly as published, on a '
    + '100 MVA base. They are not added, scaled or combined anywhere in '
    + 'this module. A sum of them would be the beginning of a load flow, '
    + 'which needs a declared model this data does not contain.';

  const UNDECLARED = 'undeclared';

  /* A traversal must not invent a voltage, so the two ends of an edge are
     compared only when BOTH are declared. */
  function crossing(graph, nearNode, farNode) {
    const near = graph.nodeVoltageKv(nearNode);
    const far = graph.nodeVoltageKv(farNode);
    return {
      near_kv: near,
      far_kv: far,
      both_declared: near != null && far != null,
      changes: near != null && far != null && near !== far
    };
  }

  function describe(graph, entry, nearNode) {
    const farNode = entry.row[entry.far];
    const cross = crossing(graph, nearNode, farNode);
    return {
      kind: entry.kind,
      from_node: nearNode,
      to_node: farNode,
      from_site_code: graph.nodeSiteCode(nearNode) || null,
      to_site_code: graph.nodeSiteCode(farNode) || null,
      from_voltage_kv: cross.near_kv,
      to_voltage_kv: cross.far_kv,
      voltage_changed: cross.changes,
      /* The transformer's own published ratio, where it has one. Only 140
         of 1,472 transformers carry it, so it is reported when present and
         never reconstructed from the two node voltages when absent - a
         reconstructed ratio would be this module's opinion wearing the
         product's authority. */
      voltage_ratio_kv: entry.kind === 'transformer'
        && typeof entry.row.voltage_ratio_kv === 'string'
        ? entry.row.voltage_ratio_kv : null,
      /* carried, never computed with */
      ratings_mva: graph.ratingsOf(entry.row),
      transformer_rating_mva: entry.kind === 'transformer'
        && Number.isFinite(entry.row.rating_mva) ? entry.row.rating_mva : null,
      parameters_pct_100mva: graph.parametersOf(entry.row)
    };
  }

  /**
   * Is this edge legal to walk?
   *
   * A transformer is the only thing that may change voltage. A circuit
   * that appears to change voltage is a contradiction between two
   * published node records, and it is refused and reported rather than
   * traversed - a silent walk through it would mix voltages, which is the
   * exact failure this estate holds itself to never repeating.
   */
  function legality(kind, cross) {
    if (!cross.changes) return { legal: true, refusal: null };
    if (kind === 'transformer') return { legal: true, refusal: null };
    return {
      legal: false,
      refusal: 'a ' + kind + ' whose two ends carry different declared '
        + 'voltages (' + cross.near_kv + ' kV and ' + cross.far_kv + ' kV); '
        + 'only a transformer may change voltage, so this edge is not walked'
    };
  }

  function startNodes(graph, site, voltageKv) {
    const nodes = graph.nodesOfSite(site.code);
    if (voltageKv == null) return nodes;
    return nodes.filter((name) => graph.nodeVoltageKv(name) === voltageKv);
  }

  /**
   * The shortest published path between two sites, in circuits.
   *
   * Breadth-first, so the first arrival is a fewest-hop path. Where
   * several paths tie, the one found first by sorted node order is
   * returned and `ties` says how many others arrived at the same depth,
   * because "the" path implies a uniqueness the network does not have.
   *
   * @param index      a network-topology index (must expose graph())
   * @param fromKey    site code or exact site name
   * @param toKey      site code or exact site name
   * @param options    { voltageKv, maxHops }
   * @returns a result object, or null if either site is unknown
   */
  function between(index, fromKey, toKey, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const from = index.site(fromKey);
    const to = index.site(toKey);
    if (!from || !to) return null;

    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
    const maxHops = Number.isFinite(opts.maxHops) ? opts.maxHops : 6;

    const targets = new Set(graph.nodesOfSite(to.code));
    const origins = startNodes(graph, from, voltageKv);

    const base = {
      schema: SCHEMA,
      from: { code: from.code, name: from.name },
      to: { code: to.code, name: to.name },
      requested_voltage_kv: voltageKv,
      max_hops: maxHops,
      not_a_distance: NOT_A_DISTANCE,
      not_a_capacity: NOT_A_CAPACITY,
      impedance_basis: IMPEDANCE_CARRIED
    };

    if (!origins.length) {
      return Object.assign({}, base, {
        reached: false,
        reason: voltageKv == null
          ? 'the origin site publishes no nodes in this product'
          : 'the origin site publishes no node at ' + voltageKv + ' kV',
        hops: null, path: [], refusals: [], ties: 0, explored_nodes: 0
      });
    }

    if (from.code === to.code) {
      return Object.assign({}, base, {
        reached: true, hops: 0, path: [], refusals: [], ties: 0,
        explored_nodes: origins.length,
        reason: 'the same site'
      });
    }

    const seen = new Map();
    const refusals = [];
    let frontier = [];
    for (const name of origins.slice().sort()) {
      if (targets.has(name)) {
        return Object.assign({}, base, {
          reached: true, hops: 0, path: [], refusals: [], ties: 0,
          explored_nodes: 1,
          reason: 'both site codes resolve to the same node'
        });
      }
      seen.set(name, null);
      frontier.push(name);
    }

    for (let depth = 1; depth <= maxHops; depth += 1) {
      const next = [];
      const arrivals = [];
      for (const nearNode of frontier) {
        for (const entry of graph.edgesAt(nearNode)) {
          const farNode = entry.row[entry.far];
          if (!farNode || !graph.has(farNode)) continue;
          const cross = crossing(graph, nearNode, farNode);
          const verdict = legality(entry.kind, cross);
          if (!verdict.legal) {
            refusals.push({
              at_node: nearNode, to_node: farNode,
              kind: entry.kind, reason: verdict.refusal
            });
            continue;
          }
          if (seen.has(farNode)) continue;
          seen.set(farNode, { via: entry, from: nearNode });
          if (targets.has(farNode)) arrivals.push(farNode);
          else next.push(farNode);
        }
      }

      if (arrivals.length) {
        arrivals.sort();
        const path = [];
        let cursor = arrivals[0];
        while (cursor) {
          const step = seen.get(cursor);
          if (!step) break;
          path.unshift(describe(graph, step.via, step.from));
          cursor = step.from;
        }
        return Object.assign({}, base, {
          reached: true,
          hops: path.length,
          path,
          transformers_crossed: path.filter((h) => h.kind === 'transformer').length,
          voltage_changes: path.filter((h) => h.voltage_changed).length,
          ties: arrivals.length - 1,
          refusals,
          explored_nodes: seen.size,
          arrival_node: arrivals[0]
        });
      }

      if (!next.length) break;
      frontier = next.sort();
    }

    return Object.assign({}, base, {
      reached: false,
      reason: 'no published path within ' + maxHops + ' hops'
        + (voltageKv == null ? '' : ' from a ' + voltageKv + ' kV node')
        + '; this is a statement about the published network, not about '
        + 'whether the two sites are connected in reality',
      hops: null, path: [], refusals, ties: 0, explored_nodes: seen.size
    });
  }

  /**
   * Every site reachable within N hops, with the hop count at which it was
   * first reached. The neighbourhood a click is actually in, electrically.
   *
   * @param index    a network-topology index
   * @param key      site code or exact site name
   * @param options  { hops, voltageKv }
   */
  function within(index, key, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const site = index.site(key);
    if (!site) return null;

    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
    const limit = Number.isFinite(opts.hops) ? opts.hops : 2;

    const origins = startNodes(graph, site, voltageKv);
    const seen = new Set(origins);
    const bySite = new Map();
    const refusals = [];
    let frontier = origins.slice().sort();

    for (let depth = 1; depth <= limit; depth += 1) {
      const next = [];
      for (const nearNode of frontier) {
        for (const entry of graph.edgesAt(nearNode)) {
          const farNode = entry.row[entry.far];
          if (!farNode || !graph.has(farNode) || seen.has(farNode)) continue;
          const cross = crossing(graph, nearNode, farNode);
          const verdict = legality(entry.kind, cross);
          if (!verdict.legal) {
            refusals.push({ at_node: nearNode, to_node: farNode,
              kind: entry.kind, reason: verdict.refusal });
            continue;
          }
          seen.add(farNode);
          next.push(farNode);
          const code = graph.nodeSiteCode(farNode);
          if (!code || String(code).toUpperCase() === String(site.code).toUpperCase()) continue;
          if (bySite.has(code)) continue;
          const far = graph.siteByCode(code);
          bySite.set(code, {
            code,
            name: far ? far.name : null,
            hops: depth,
            first_node: farNode,
            voltage_kv: cross.far_kv,
            via: entry.kind
          });
        }
      }
      if (!next.length) break;
      frontier = next.sort();
    }

    const sites = [...bySite.values()].sort((a, b) =>
      a.hops - b.hops || String(a.code).localeCompare(String(b.code)));

    return {
      schema: SCHEMA,
      site: { code: site.code, name: site.name },
      requested_voltage_kv: voltageKv,
      hop_limit: limit,
      origin_nodes: origins.length,
      sites,
      counts: {
        sites: sites.length,
        by_hop: sites.reduce((acc, s) => {
          acc[s.hops] = (acc[s.hops] || 0) + 1;
          return acc;
        }, {})
      },
      refusals,
      not_a_distance: NOT_A_DISTANCE,
      not_a_capacity: NOT_A_CAPACITY
    };
  }

  NS.electricalDistance = Object.freeze({
    schema: SCHEMA,
    requires: REQUIRES,
    not_a_distance: NOT_A_DISTANCE,
    not_a_capacity: NOT_A_CAPACITY,
    impedance_basis: IMPEDANCE_CARRIED,
    undeclared: UNDECLARED,
    between,
    within
  });
})();

/**
 * Module: rating-envelope
 *
 * What the operator publishes a circuit can carry, season by season -
 * and a structural refusal to add those numbers up.
 *
 * WHY THE REFUSAL IS THE FEATURE
 * ------------------------------
 * A substation with eight 400 kV circuits rated 3,000 MVA each does not
 * have 24,000 MVA of anything. The ratings are thermal limits on
 * individual branches under stated seasonal conditions; they are not
 * additive, they are not simultaneous, and the sum is not a quantity that
 * exists in the network. Yet a sum is the single easiest number to
 * produce from this data and the single most persuasive to a reader, and
 * once printed it is indistinguishable from a capacity figure. That is
 * how a published rating becomes an invented headroom number.
 *
 * So this module reports each circuit's ratings individually, names the
 * season each one belongs to, and contains no code path that produces a
 * site total. The proof asserts the absence, not merely the intent.
 *
 * WHAT IT ADDS BEYOND "THE MINIMUM AND THE MAXIMUM"
 * -------------------------------------------------
 * The owner product already publishes a site-wide winter envelope
 * (`circuit_winter_rating_mva.min/max`). Three things it does not do,
 * which are done here:
 *
 *   1. All four seasons, not winter alone. Summer ratings are the binding
 *      ones for a thermally limited circuit, and the product carries them
 *      on 1,276 of 1,392 circuits - the 116 without are OFTO-labelled and
 *      are reported as not published rather than filled in.
 *
 *   2. Scoped to a voltage. A site-wide range across a 132 kV and a
 *      400 kV busbar is a number about no busbar at all.
 *
 *   3. Implausible values named rather than averaged away. Four circuits
 *      publish winter_mva of exactly 9999, on spans of a kilometre or
 *      less with zero impedance; planned changes reach 69,275. These have
 *      the shape of placeholders, not ratings. A module that quietly
 *      includes them in a maximum reports a lie with a citation attached,
 *      so they are carried, flagged, and excluded from the envelope with
 *      the exclusion stated.
 *
 *   node tools/proofs/modules/202609012250-rating-envelope.proof.mjs
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.ratingEnvelope) return;

  const SCHEMA = 'gridatlas.module.rating-envelope.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const SEASONS = Object.freeze(['winter', 'spring', 'summer', 'autumn']);
  const FIELD = Object.freeze({
    winter: 'winter_mva', spring: 'spring_mva',
    summer: 'summer_mva', autumn: 'autumn_mva'
  });

  const NEVER_SUMMED =
    'These are per-circuit thermal ratings under stated seasonal '
    + 'conditions. They are not additive and they are not simultaneous: '
    + 'the sum of the circuits at a site is not a quantity that exists in '
    + 'the network, and this module contains no code that produces one.';

  const NOT_A_CAPACITY =
    'A rating is what a circuit is rated to carry, not what is free on '
    + 'it. Existing flows, committed connections, queue position, outage '
    + 'conditions and commercial terms decide what a project could use, '
    + 'and no published appendix contains any of them.';

  /* A rating that is obviously not a rating.
     -----------------------------------------------------------------
     9999 on a one-kilometre span with zero impedance is a placeholder,
     not a thermal limit; so is 69,275 on a hundred-metre cable. The test
     is deliberately narrow - a value at or above this threshold is
     flagged, nothing else is second-guessed - because a module that
     starts judging which published numbers it believes has stopped
     reporting the published record. */
  const IMPLAUSIBLE_MVA = 9999;

  function seasonsOf(row) {
    const published = {};
    const absent = [];
    for (const season of SEASONS) {
      const value = row[FIELD[season]];
      if (Number.isFinite(value)) published[season] = value;
      else absent.push(season);
    }
    return { published, absent };
  }

  function flagsFor(published) {
    const flags = [];
    for (const [season, value] of Object.entries(published)) {
      if (value >= IMPLAUSIBLE_MVA) {
        flags.push({
          season,
          value,
          reason: 'at or above ' + IMPLAUSIBLE_MVA + ' MVA, which has the '
            + 'shape of a placeholder rather than a thermal rating; it is '
            + 'reported and excluded from the range below'
        });
      }
    }
    return flags;
  }

  /**
   * Every circuit landing at a site, at one voltage, with its own
   * seasonal ratings. No total anywhere.
   *
   * @param index      a network-topology index exposing graph()
   * @param key        site code or exact site name
   * @param options    { voltageKv }
   */
  function at(index, key, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const site = index.site(key);
    if (!site) return null;

    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;

    const nodes = graph.nodesOfSite(site.code)
      .filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);

    const circuits = [];
    const seen = new Set();
    for (const nodeName of nodes) {
      for (const entry of graph.edgesAt(nodeName)) {
        if (entry.kind !== 'circuit') continue;
        const far = entry.row[entry.far];
        const id = [nodeName, far].sort().join('|');
        if (seen.has(id)) continue;
        seen.add(id);
        const { published, absent } = seasonsOf(entry.row);
        if (!Object.keys(published).length) continue;
        circuits.push({
          from_node: nodeName,
          to_node: far,
          to_site_code: graph.nodeSiteCode(far) || null,
          voltage_kv: graph.nodeVoltageKv(nodeName),
          circuit_type: typeof entry.row.circuit_type === 'string' ? entry.row.circuit_type : null,
          ohl_km: Number.isFinite(entry.row.ohl_km) ? entry.row.ohl_km : null,
          cable_km: Number.isFinite(entry.row.cable_km) ? entry.row.cable_km : null,
          ratings_mva: published,
          seasons_not_published: absent,
          flags: flagsFor(published),
          parameters_pct_100mva: graph.parametersOf(entry.row)
        });
      }
    }

    circuits.sort((a, b) => String(a.to_node).localeCompare(String(b.to_node)));

    /* The per-season RANGE across circuits - a lowest and a highest
       rating, which are two real published values - never a sum, and
       never a mean, which would be a number no circuit is rated at. */
    const by_season = {};
    for (const season of SEASONS) {
      const values = circuits
        .filter((c) => Number.isFinite(c.ratings_mva[season])
          && c.ratings_mva[season] < IMPLAUSIBLE_MVA)
        .map((c) => c.ratings_mva[season]);
      const excluded = circuits
        .filter((c) => Number.isFinite(c.ratings_mva[season])
          && c.ratings_mva[season] >= IMPLAUSIBLE_MVA).length;
      by_season[season] = values.length
        ? {
          lowest_circuit_mva: Math.min.apply(null, values),
          highest_circuit_mva: Math.max.apply(null, values),
          circuits: values.length,
          excluded_as_implausible: excluded
        }
        : { circuits: 0, excluded_as_implausible: excluded, published: false };
    }

    const flagged = circuits.filter((c) => c.flags.length);
    const missingSeasons = circuits.filter((c) => c.seasons_not_published.length);

    return {
      schema: SCHEMA,
      site: { code: site.code, name: site.name },
      requested_voltage_kv: voltageKv,
      scope: voltageKv == null
        ? 'every voltage at this site; a range across two busbar voltages '
          + 'is a number about neither of them'
        : voltageKv + ' kV nodes at this site only',
      circuits,
      by_season,
      counts: {
        circuits: circuits.length,
        with_a_flagged_value: flagged.length,
        with_a_season_not_published: missingSeasons.length
      },
      never_summed: NEVER_SUMMED,
      not_a_capacity: NOT_A_CAPACITY
    };
  }

  NS.ratingEnvelope = Object.freeze({
    schema: SCHEMA,
    requires: REQUIRES,
    seasons: SEASONS,
    implausible_mva: IMPLAUSIBLE_MVA,
    never_summed: NEVER_SUMMED,
    not_a_capacity: NOT_A_CAPACITY,
    at
  });
})();

/**
 * Module: injection-response
 *
 * A DECLARED DC power-flow model of the published GB transmission network,
 * used to answer one question: if power is injected here, which circuits
 * carry it, and what fraction of it does each one carry?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A POWER FLOW AND NOT A PRETENDED ONE
 * ─────────────────────────────────────────────────────────────────────
 *
 * The standing rule in this estate has been that R, X and B are carried
 * and never computed with, because "the ETYS node/branch dataset is not a
 * solved power-flow model merely because it contains R/X/B". That rule is
 * right, and it is not repealed here. What it forbids is calling published
 * parameters a solution. What it permits - what it was always pointing at -
 * is a model that DECLARES itself: states its equations, its base, its
 * slack, its assumptions and its validation, and is honest about which
 * quantities it cannot produce.
 *
 * A full AC load flow of GB needs generation and load at every node,
 * transformer tap positions, voltage set points, contingency definitions
 * and validation against a trusted solver. None of those are published in
 * Appendix B, and this module does not invent them, so it does not
 * pretend to a load flow.
 *
 * An INJECTION RESPONSE needs none of them. It is the linear sensitivity
 * of branch flows to a transfer between two points - the power-transfer
 * distribution factor - and it depends only on the network's topology and
 * its series reactances, both of which ARE published. It is the quantity a
 * connection engineer wants first: not "what is flowing today", which
 * nobody publishes, but "where would my power go".
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE DECLARED MODEL
 * ─────────────────────────────────────────────────────────────────────
 *
 *   Equations   DC approximation:  P = B' · θ,  and for each branch
 *               f_ij = (θ_i − θ_j) / x_ij
 *   Base        100 MVA, the base the product publishes R/X/B on.
 *   Reactance   x = x_pct_100mva / 100, per unit. Resistance is NOT used:
 *               the DC approximation neglects it, and saying so is part of
 *               the declaration.
 *   Voltages    Assumed flat at 1.0 per unit. Not published, not solved.
 *   Angles      Assumed small, so sin θ ≈ θ. Valid for a transmission
 *               network under normal conditions; it is an approximation
 *               and it is named as one.
 *   Losses      Zero, by construction of the DC approximation. Real losses
 *               are of order 1-2% and are not represented.
 *   Slack       DECLARED explicitly, never inferred silently. Every answer
 *               names the node the power is withdrawn at, because a
 *               transfer has two ends and quoting only one is meaningless.
 *   Taps        Not published, therefore not modelled. Transformers are
 *               represented by their series reactance alone.
 *   Shunts      b_pct_100mva is carried by the product and is NOT used:
 *               line charging does not appear in a DC model.
 *   Contingency None. This is the intact network.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THE ANSWER IS NOT
 * ─────────────────────────────────────────────────────────────────────
 *
 * It is not a loading, and it is not headroom. It says what fraction of a
 * NEW injection would appear on each circuit. What is already flowing on
 * that circuit is not published anywhere in this product, so the sum of
 * the two - which is what determines whether the circuit is full - cannot
 * be computed here by anyone, including this module. A circuit carrying
 * 38% of a 500 MW injection is carrying 190 MW of it; whether that
 * circuit can accept 190 MW more depends on facts no appendix contains.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ZERO-REACTANCE BRANCHES
 * ─────────────────────────────────────────────────────────────────────
 *
 * The product publishes circuits with x_pct_100mva of exactly 0 - zero
 * length spans, busbar couplers, some series devices. 1/x is undefined for
 * these, and substituting a small number would silently invent a
 * reactance. They are instead treated as what they physically are: a
 * short, meaning the two nodes are electrically the same bus. The nodes
 * are merged before the matrix is built, the merge is counted, and the
 * count is reported in the answer.
 *
 *   node tools/proofs/modules/202609012320-injection-response.proof.mjs
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.injectionResponse) return;

  const SCHEMA = 'gridatlas.module.injection-response.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const BASE_MVA = 100;

  const DECLARED_MODEL = Object.freeze({
    method: 'linear DC power flow (injection response / power transfer distribution factor)',
    equations: 'P = B′ · θ ; branch flow f_ij = (θ_i − θ_j) / x_ij',
    base_mva: BASE_MVA,
    reactance: 'x = x_pct_100mva / 100, per unit, as published',
    resistance: 'not used; the DC approximation neglects series resistance',
    shunt_susceptance: 'not used; line charging does not appear in a DC model',
    voltages: 'assumed flat at 1.0 per unit; not published and not solved',
    angles: 'assumed small, so sin θ ≈ θ',
    losses: 'zero by construction; real losses are of order 1-2% and are not represented',
    transformer_taps: 'not published, therefore not modelled; transformers are their series reactance only',
    contingencies: 'none; this is the intact network',
    slack: 'declared explicitly on every answer, never inferred silently'
  });

  const NOT_A_LOADING =
    'This is the response to a NEW injection, not a loading. What is '
    + 'already flowing on these circuits is published nowhere in this '
    + 'product, so the total flow - which is what decides whether a '
    + 'circuit is full - cannot be computed here by anyone.';

  const NOT_A_CONNECTION_OFFER =
    'A fraction of an injection appearing on a circuit is not permission '
    + 'to use that circuit. Queue position, committed connections, outage '
    + 'conditions, consent and commercial terms decide what a project may '
    + 'connect, and no published appendix contains any of them.';

  /* ── union-find, for shorting zero-reactance branches ──────────────── */
  function makeUnionFind() {
    const parent = new Map();
    function find(x) {
      if (!parent.has(x)) { parent.set(x, x); return x; }
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root);
      let cursor = x;
      while (parent.get(cursor) !== cursor) {
        const next = parent.get(cursor);
        parent.set(cursor, root);
        cursor = next;
      }
      return root;
    }
    return {
      find,
      union(a, b) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return false;
        parent.set(ra, rb);
        return true;
      }
    };
  }

  /* The matrix assembly, taking an explicit node list so the caller
     decides the scope - one site, one voltage, or the whole product -
     without a second copy of this code existing for each case. */
  function assemble(graph, nodeNames, { voltageKv, includeTransformers }) {
    const inScope = new Set(nodeNames);
    const uf = makeUnionFind();
    for (const n of nodeNames) uf.find(n);

    const branches = [];
    const seen = new Set();
    let shorted = 0;
    let skippedNoReactance = 0;

    for (const name of nodeNames) {
      for (const entry of graph.edgesAt(name)) {
        if (entry.kind === 'transformer' && !includeTransformers) continue;
        const far = entry.row[entry.far];
        if (!inScope.has(far)) continue;
        const id = [name, far].sort().join('|') + '|' + entry.kind
          + '|' + (entry.row.x_pct_100mva ?? 'n');
        if (seen.has(id)) continue;
        seen.add(id);

        const xPct = entry.row.x_pct_100mva;
        if (!Number.isFinite(xPct)) { skippedNoReactance += 1; continue; }
        if (xPct === 0) {
          /* physically a short: the two nodes are the same bus */
          if (uf.union(name, far)) shorted += 1;
          continue;
        }
        branches.push({
          from: name, to: far, kind: entry.kind,
          x_pu: xPct / 100,
          row: entry.row
        });
      }
    }

    /* After shorting, work in terms of bus representatives. */
    const busOf = (name) => uf.find(name);
    const buses = [...new Set(nodeNames.map(busOf))].sort();
    const busIndex = new Map(buses.map((b, i) => [b, i]));

    const edges = [];
    for (const b of branches) {
      const i = busIndex.get(busOf(b.from));
      const j = busIndex.get(busOf(b.to));
      if (i === undefined || j === undefined || i === j) continue;
      edges.push({ i, j, b: 1 / b.x_pu, meta: b });
    }

    return {
      schema: SCHEMA,
      declared_model: DECLARED_MODEL,
      voltage_kv: voltageKv,
      includes_transformers: includeTransformers,
      buses, busIndex, busOf, edges,
      counts: {
        nodes: nodeNames.length,
        buses: buses.length,
        branches: edges.length,
        shorted_zero_reactance: shorted,
        skipped_no_published_reactance: skippedNoReactance
      }
    };
  }

  /* ── sparse conjugate gradient on the reduced B' matrix ────────────── */
  function multiply(model, x, slackIndex) {
    const y = new Float64Array(x.length);
    for (const e of model.edges) {
      if (e.i === slackIndex || e.j === slackIndex) {
        /* the slack angle is pinned at zero, so its column contributes
           nothing and its row is not solved */
        if (e.i !== slackIndex) y[e.i] += e.b * x[e.i];
        if (e.j !== slackIndex) y[e.j] += e.b * x[e.j];
        continue;
      }
      const d = x[e.i] - x[e.j];
      y[e.i] += e.b * d;
      y[e.j] -= e.b * d;
    }
    return y;
  }

  function solve(model, injection, slackIndex, tolerance, maxIterations) {
    const n = model.buses.length;
    const x = new Float64Array(n);
    let r = new Float64Array(injection);
    r[slackIndex] = 0;
    let p = new Float64Array(r);
    let rr = 0;
    for (let k = 0; k < n; k += 1) rr += r[k] * r[k];
    const target = tolerance * tolerance * Math.max(rr, 1e-30);
    let iterations = 0;
    for (; iterations < maxIterations && rr > target; iterations += 1) {
      const ap = multiply(model, p, slackIndex);
      let pap = 0;
      for (let k = 0; k < n; k += 1) pap += p[k] * ap[k];
      if (!(Math.abs(pap) > 1e-30)) break;
      const alpha = rr / pap;
      let rrNext = 0;
      for (let k = 0; k < n; k += 1) {
        x[k] += alpha * p[k];
        r[k] -= alpha * ap[k];
        rrNext += r[k] * r[k];
      }
      const beta = rrNext / rr;
      for (let k = 0; k < n; k += 1) p[k] = r[k] + beta * p[k];
      rr = rrNext;
    }
    x[slackIndex] = 0;
    return { theta: x, iterations, residual: Math.sqrt(rr) };
  }

  /**
   * Inject `mw` at one node and withdraw it at the declared slack; report
   * the flow this puts on every branch that carries a meaningful share.
   *
   * @param model     from modelFor()
   * @param options   { atNode, slackNode, mw, minimumShare }
   */
  function respond(model, options) {
    const opts = options || {};
    const mw = Number.isFinite(opts.mw) ? opts.mw : 100;
    const atBus = model.busOf(opts.atNode);
    const slackBus = model.busOf(opts.slackNode);
    const i = model.busIndex.get(atBus);
    const s = model.busIndex.get(slackBus);
    if (i === undefined || s === undefined) return null;
    if (i === s) {
      return {
        schema: SCHEMA,
        declared_model: DECLARED_MODEL,
        injected_mw: mw,
        at_node: opts.atNode,
        slack_node: opts.slackNode,
        same_bus: true,
        reason: 'the injection point and the slack are the same electrical '
          + 'bus once zero-reactance branches are shorted, so there is no '
          + 'transfer to distribute',
        branches: [],
        not_a_loading: NOT_A_LOADING,
        not_a_connection_offer: NOT_A_CONNECTION_OFFER
      };
    }

    const n = model.buses.length;
    const p = new Float64Array(n);
    p[i] = mw / BASE_MVA;      /* per unit on the declared base */
    p[s] = -mw / BASE_MVA;

    const solved = solve(model, p, s, 1e-10, Math.min(4 * n, 20000));

    const minimumShare = Number.isFinite(opts.minimumShare) ? opts.minimumShare : 0.01;
    const flows = [];
    for (const e of model.edges) {
      const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
      const flowMw = flowPu * BASE_MVA;
      const share = mw === 0 ? 0 : flowMw / mw;
      if (Math.abs(share) < minimumShare) continue;
      const row = e.meta.row;
      const ratings = {};
      for (const [season, field] of [['winter', 'winter_mva'], ['spring', 'spring_mva'],
        ['summer', 'summer_mva'], ['autumn', 'autumn_mva']]) {
        if (Number.isFinite(row[field])) ratings[season] = row[field];
      }
      flows.push({
        from_node: e.meta.from,
        to_node: e.meta.to,
        kind: e.meta.kind,
        x_pct_100mva: e.meta.x_pu * 100,
        flow_mw: flowMw,
        share_of_injection: share,
        published_ratings_mva: Object.keys(ratings).length ? ratings : null,
        transformer_rating_mva: e.meta.kind === 'transformer'
          && Number.isFinite(row.rating_mva) ? row.rating_mva : null
      });
    }
    flows.sort((a, b) => Math.abs(b.share_of_injection) - Math.abs(a.share_of_injection));

    /* Validation carried in the answer, not asserted in a comment.
       Kirchhoff at the injection bus: the shares leaving it must sum to
       one, or the solve did not converge and the answer is not usable. */
    let leavingInjection = 0;
    for (const e of model.edges) {
      const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
      if (e.i === i) leavingInjection += flowPu;
      if (e.j === i) leavingInjection -= flowPu;
    }
    const kirchhoff = leavingInjection * BASE_MVA / (mw || 1);

    return {
      schema: SCHEMA,
      declared_model: DECLARED_MODEL,
      injected_mw: mw,
      at_node: opts.atNode,
      slack_node: opts.slackNode,
      same_bus: false,
      branches: flows,
      counts: {
        branches_in_model: model.edges.length,
        branches_carrying_at_least: minimumShare,
        branches_reported: flows.length
      },
      convergence: {
        iterations: solved.iterations,
        residual: solved.residual,
        converged: solved.residual < 1e-6
      },
      validation: {
        kirchhoff_at_injection: kirchhoff,
        kirchhoff_error: Math.abs(kirchhoff - 1),
        passes: Math.abs(kirchhoff - 1) < 1e-6,
        /* Exact by Kirchhoff's current law under the DC model: everything
           injected at a bus must leave it along the branches. It is
           checked at runtime and carried in the answer rather than
           asserted in a comment, because a solve that has not converged
           produces a plausible-looking set of flows that are wrong. */
        what_it_checks: 'the shares leaving the injection bus must sum to 1.0'
      },
      not_a_loading: NOT_A_LOADING,
      not_a_connection_offer: NOT_A_CONNECTION_OFFER
    };
  }

  /**
   * Convenience: build a model over every node at one voltage.
   */
  function modelFor(index, options) {
    if (!index || typeof index.graph !== 'function') return null;
    const graph = index.graph();
    if (!graph || graph.schema !== REQUIRES) return null;
    const opts = options || {};
    const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
    const includeTransformers = opts.includeTransformers === true;

    const names = [];
    for (const name of (opts.nodeNames || [])) {
      if (voltageKv == null || graph.nodeVoltageKv(name) === voltageKv) names.push(name);
    }
    if (!names.length) return null;
    return assemble(graph, names, { voltageKv, includeTransformers });
  }

  NS.injectionResponse = Object.freeze({
    schema: SCHEMA,
    requires: REQUIRES,
    base_mva: BASE_MVA,
    declared_model: DECLARED_MODEL,
    not_a_loading: NOT_A_LOADING,
    not_a_connection_offer: NOT_A_CONNECTION_OFFER,
    modelFor,
    assemble,
    respond
  });
})();

/**
 * Module: planned-change
 *
 * What the network operator has PUBLISHED as planned for the circuits and
 * transformers that touch one site: additions, changes and removals, by
 * the year they are published against.
 *
 * WHY THIS EXISTS
 * ---------------
 * Appendix B carries 2,230 rows that are not the network. They are the
 * operator's statement of what the network is planned to look like in
 * 2026, 2028, 2030 and 2033: a circuit to be added, a circuit whose
 * parameters are to change, a transformer to be removed. The topology
 * module carries them and the graph it hands out deliberately refuses to
 * walk them, which is right - a circuit published for 2030 is not a path
 * a current can take today. But refusing to walk them is not the same as
 * reporting them, and a reader looking at a site with four published
 * additions in 2028 is entitled to be told so, with the year and the
 * status and the published parameters, in the operator's own words.
 *
 * So this module reports the planned rows that land at a site, grouped by
 * year and then by status, with real counts. It reads the same product the
 * topology module reads and resolves sites, nodes and voltages through the
 * topology index rather than through a second opinion of its own.
 *
 * WHAT IT IS NOT
 * --------------
 * A published plan is not infrastructure. Every entry this module returns
 * is marked as a publication about a future year, it is never mixed into
 * a list of circuits that exist, and nothing here can be traversed: the
 * module contains no path, no hop and no neighbour, and the graph it
 * borrows excludes these rows from its edges by construction.
 *
 * A published plan is not a commitment either. The operator publishes
 * planned changes as its current view of network development; the view
 * moves between editions, an addition can be deferred or dropped, and a
 * year against a row is the year the row is published for, not a
 * consent, not a delivery date and not a date on which anything could
 * connect. A "Removed" row says a circuit is planned to be taken out; it
 * does not say why, and it does not say what replaces it.
 *
 * And, as everywhere in this estate: nothing here states whether a project
 * can connect. R, X and B on a planned row are carried as published on a
 * 100 MVA base and never computed with; ratings on a planned row are the
 * planned circuit's, not a spare allowance; voltages are trusted only where
 * the product says the site declares them and are never decoded from a
 * node code.
 *
 * ONE PUBLISHED FACT THAT IS WORTH CARRYING
 * -----------------------------------------
 * 552 of the 2,230 planned rows sit on a node pair that already has a
 * circuit or transformer published for today, and 16 of those are marked
 * "Addition" - a second circuit on an existing pair, on the face of it.
 * Whether a pair is published today is a fact from the same product, so
 * each entry carries it. It is a cross-reference, not a judgement about
 * what the addition means.
 *
 *   node tools/proofs/modules/202609012345-planned-change.proof.mjs
 */
(() => {
  'use strict';

  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.plannedChange) return;

  const SCHEMA = 'gridatlas.module.planned-change.v1';
  const ACCEPTS = 'data-grid-gb.transmission-network.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const NOT_EXISTING =
    'Every entry here is a change the network operator has published for '
    + 'a future year. None of it is a circuit or a transformer that exists '
    + 'today, none of it is a path, and none of it is counted among the '
    + 'site\'s circuits anywhere in this estate.';

  const NOT_A_COMMITMENT =
    'A published plan is the operator\'s current view of network '
    + 'development, and the view moves between editions. It is not a '
    + 'commitment to build, not a consent, and the year on a row is the '
    + 'year it is published for - not a delivery date and not a date on '
    + 'which anything could connect.';

  const NOT_AN_ASSESSMENT =
    'Nothing here states whether any project can connect at this site, '
    + 'before or after a planned change. That depends on queue position, '
    + 'committed connections, consent and commercial terms which no '
    + 'published appendix contains. A rating on a planned row is the '
    + 'planned asset\'s rating, not a spare allowance.';

  const IMPEDANCE_BASIS =
    'R, X and B on a planned row are percentages on a 100 MVA base, as '
    + 'published for the planned asset. They are carried and not computed '
    + 'with.';

  /* The order the statuses are presented in. Anything the product
     publishes that is not one of these three is kept and sorted after
     them by name, never dropped. */
  const STATUS_ORDER = Object.freeze(['Addition', 'Change', 'Removed']);
  const ASSETS = Object.freeze(['circuit', 'transformer']);

  const asString = (v) => (typeof v === 'string' && v.length ? v : null);
  const asNumber = (v) => (Number.isFinite(v) ? v : null);

  function statusRank(status) {
    const i = STATUS_ORDER.indexOf(status);
    return i === -1 ? STATUS_ORDER.length : i;
  }

  /* Years are published as strings ("2026"). They are sorted numerically
     where they parse and left in their published form on the entry. */
  function yearRank(year) {
    const n = Number(year);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  /**
   * Is there a circuit or a transformer published for TODAY between
   * these two nodes? Read off the graph's edges, which are circuits and
   * transformers only, so a planned row can never vouch for itself.
   */
  function publishedToday(graph, nearNode, farNode) {
    const today = { circuit: false, transformer: false };
    for (const entry of graph.edgesAt(nearNode)) {
      if (entry.row[entry.far] !== farNode) continue;
      if (entry.kind === 'circuit') today.circuit = true;
      if (entry.kind === 'transformer') today.transformer = true;
    }
    return today;
  }

  /**
   * @param product  the parsed data-grid-gb transmission-network payload
   * @returns an index, or null if the schema is not the one this reads
   */
  function index(product) {
    if (!product || product.schema !== ACCEPTS) return null;
    const topology = NS.networkTopology;
    if (!topology || typeof topology.index !== 'function') return null;
    const base = topology.index(product);
    if (!base || typeof base.graph !== 'function') return null;
    const graph = base.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    const rows = Array.isArray(product.planned_changes) ? product.planned_changes : [];

    /* Planned rows land on their two nodes exactly as branches do in the
       topology module, so that a site query is a lookup and not a scan. */
    const byNode = new Map();
    for (const row of rows) {
      if (!row) continue;
      for (const [near, far] of [['node_1', 'node_2'], ['node_2', 'node_1']]) {
        const name = row[near];
        if (!name) continue;
        if (!byNode.has(name)) byNode.set(name, []);
        byNode.get(name).push({ row, near, far });
      }
    }

    /* Product-wide tallies. These are counts of published rows, each
       counted once, and they are the only place in this module where a
       row is counted without reference to a site. */
    const tally = { by_year: {}, by_status: {}, by_asset: {} };
    for (const row of rows) {
      if (!row) continue;
      const y = asString(row.year) || 'unstated';
      const s = asString(row.status) || 'unstated';
      const a = asString(row.asset) || 'unstated';
      tally.by_year[y] = (tally.by_year[y] || 0) + 1;
      tally.by_status[s] = (tally.by_status[s] || 0) + 1;
      tally.by_asset[a] = (tally.by_asset[a] || 0) + 1;
    }

    function describe(landing, nearNode) {
      const row = landing.row;
      const farNode = row[landing.far];
      const farSiteCode = graph.nodeSiteCode(farNode) || null;
      const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
      const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
      const asset = asString(row.asset);
      const entry = {
        publication: 'planned',
        year: asString(row.year),
        status: asString(row.status),
        asset,
        from_node: nearNode,
        to_node: farNode,
        from_site_code: nearSiteCode,
        to_site_code: farSiteCode,
        to_site_name: farSite ? farSite.name : null,
        within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
        /* trusted only where the site declares it; null otherwise */
        from_voltage_kv: graph.nodeVoltageKv(nearNode),
        to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
        transmission_owner: asString(row.transmission_owner),
        labels: Array.isArray(row.labels) ? row.labels.slice() : [],
        /* carried, never computed with */
        parameters_pct_100mva: graph.parametersOf(row),
        pair_published_today: graph.has(farNode)
          ? publishedToday(graph, nearNode, farNode)
          : { circuit: false, transformer: false }
      };
      if (asset === 'transformer') {
        entry.rating_mva = asNumber(row.rating_mva);
        entry.voltage_ratio_kv = asString(row.voltage_ratio_kv);
      } else {
        entry.circuit_type = asString(row.circuit_type);
        entry.ohl_km = asNumber(row.ohl_km);
        entry.cable_km = asNumber(row.cable_km);
        entry.ratings_mva = graph.ratingsOf(row);
      }
      return entry;
    }

    /**
     * Every planned change landing at one site, grouped by year and then
     * by status. A row landing on two nodes of the same site is reported
     * once, from the first node it is met at in sorted node order.
     *
     * @param key      site code or exact site name
     * @param options  { voltageKv } to restrict to rows landing on a node
     *                 the site declares at that voltage
     */
    function at(key, options) {
      const site = base.site(key);
      if (!site) return null;
      const opts = options || {};
      const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;

      const nodes = graph.nodesOfSite(site.code)
        .filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);

      const seen = new Set();
      const entries = [];
      for (const nodeName of nodes) {
        for (const landing of byNode.get(nodeName) || []) {
          if (seen.has(landing.row)) continue;
          seen.add(landing.row);
          entries.push(describe(landing, nodeName));
        }
      }

      /* year -> status -> entries, in a stable presentation order */
      const years = new Map();
      for (const entry of entries) {
        const y = entry.year || 'unstated';
        if (!years.has(y)) years.set(y, new Map());
        const statuses = years.get(y);
        const s = entry.status || 'unstated';
        if (!statuses.has(s)) statuses.set(s, []);
        statuses.get(s).push(entry);
      }

      const by_year = [...years.entries()]
        .sort((a, b) => yearRank(a[0]) - yearRank(b[0]) || a[0].localeCompare(b[0]))
        .map(([year, statuses]) => {
          const by_status = [...statuses.entries()]
            .sort((a, b) => statusRank(a[0]) - statusRank(b[0]) || a[0].localeCompare(b[0]))
            .map(([status, list]) => {
              list.sort((a, b) => String(a.to_node).localeCompare(String(b.to_node)));
              const by_asset = {};
              for (const a of ASSETS) by_asset[a] = list.filter((e) => e.asset === a).length;
              return { status, entries: list, counts: { entries: list.length, by_asset } };
            });
          const counts = { entries: 0, by_status: {} };
          for (const group of by_status) {
            counts.entries += group.counts.entries;
            counts.by_status[group.status] = group.counts.entries;
          }
          return { year, by_status, counts };
        });

      const counts = { planned_changes: entries.length, by_year: {}, by_status: {}, by_asset: {} };
      for (const y of by_year) counts.by_year[y.year] = y.counts.entries;
      for (const e of entries) {
        const s = e.status || 'unstated';
        const a = e.asset || 'unstated';
        counts.by_status[s] = (counts.by_status[s] || 0) + 1;
        counts.by_asset[a] = (counts.by_asset[a] || 0) + 1;
      }
      counts.on_a_pair_published_today = entries
        .filter((e) => e.pair_published_today.circuit || e.pair_published_today.transformer).length;

      return {
        schema: SCHEMA,
        source: ACCEPTS,
        site: { code: site.code, name: site.name },
        requested_voltage_kv: voltageKv,
        scope: voltageKv == null
          ? 'rows landing on any node of this site; each entry carries the '
            + 'declared voltage of the node it lands on, and undeclared is '
            + 'undeclared'
          : 'rows landing on a node this site declares at ' + voltageKv + ' kV only',
        nodes_considered: nodes.length,
        by_year,
        counts,
        not_existing: NOT_EXISTING,
        not_a_commitment: NOT_A_COMMITMENT,
        not_an_assessment: NOT_AN_ASSESSMENT,
        impedance_basis: IMPEDANCE_BASIS
      };
    }

    return {
      schema: SCHEMA,
      source: ACCEPTS,
      counts: Object.assign({ planned_changes: rows.length }, tally),
      site: base.site,
      at
    };
  }

  NS.plannedChange = Object.freeze({
    schema: SCHEMA,
    accepts: ACCEPTS,
    requires: REQUIRES,
    status_order: STATUS_ORDER,
    not_existing: NOT_EXISTING,
    not_a_commitment: NOT_A_COMMITMENT,
    not_an_assessment: NOT_AN_ASSESSMENT,
    impedance_basis: IMPEDANCE_BASIS,
    index
  });
})();

/**
 * Module: owner-boundary
 *
 * Which transmission owner the published assets at a site belong to, and
 * which circuits cross from one owner's network into another's.
 *
 * WHY THIS EXISTS
 * ---------------
 * Great Britain's transmission network is not one network. Appendix B
 * publishes a `transmission_owner` on every site, node, circuit and
 * transformer, and four values occur: NGET in England and Wales, SPT in
 * southern Scotland, SHET in the north of Scotland, and OFTO for the
 * offshore assets. Most circuits sit wholly inside one owner's network.
 * Sixty-two do not: their two ends are nodes that different owners
 * publish, and a circuit like that is the seam between two networks.
 *
 * That seam is worth naming because a connection near it involves more
 * than one party. It is a fact about who publishes what, read straight
 * off the product, and it is reported here with both owners named on
 * every boundary circuit so that nobody has to infer it from a map colour.
 *
 * WHAT IT IS NOT
 * --------------
 * Ownership is not a statement about who a project would contract with.
 * Connection agreements in Great Britain are made with the system operator
 * and the relevant owner under a framework this data does not describe,
 * and a site being NGET's says nothing about the counterparty, the process
 * or the terms of any connection at it. This module reports the published
 * owner of the published assets and stops there.
 *
 * Nor is an owner ever inferred. Forty-nine nodes publish no owner - all
 * of them on placeholder site codes such as OFFS and ONSH that the product
 * does not list as sites - and where a node's owner is not published it is
 * reported as unknown. A circuit with an unknown end is reported as
 * undetermined, not as a boundary and not as internal. Nothing is read
 * from a site name, a node code or a neighbour.
 *
 * TWO DIFFERENT FACTS, KEPT APART
 * -------------------------------
 * A circuit carries its own `transmission_owner`, and so do the nodes at
 * its two ends. A BOUNDARY circuit is one whose two END nodes belong to
 * different owners. Separately, seven circuits in the product carry an
 * owner that matches neither end - SPT and OFTO circuits between SHET
 * nodes at Hunterston, Inverness and Nedd. That is not a boundary by the
 * definition above; it is the asset's own published owner differing from
 * the owner of the nodes it lands on, and it is reported as exactly that.
 *
 * Voltages are trusted only where the site declares them and never decoded
 * from a node code; assets are counted per voltage and never across
 * voltages. R, X and B are carried and never computed with. No rating here
 * is headroom.
 *
 *   node tools/proofs/modules/202609012350-owner-boundary.proof.mjs
 */
(() => {
  'use strict';

  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.ownerBoundary) return;

  const SCHEMA = 'gridatlas.module.owner-boundary.v1';
  const ACCEPTS = 'data-grid-gb.transmission-network.v1';
  const REQUIRES = 'gridatlas.module.network-topology.graph.v1';

  const NOT_A_COUNTERPARTY =
    'The transmission owner is the party the network operator publishes '
    + 'as owning an asset. It is not a statement about who a project would '
    + 'contract with, under what process, or on what terms; none of that '
    + 'is in any published appendix.';

  const NOT_AN_ASSESSMENT =
    'An ownership boundary is a fact about who publishes which asset. It '
    + 'says nothing about whether any project can connect on either side '
    + 'of it, and a rating on a boundary circuit is that circuit\'s rating, '
    + 'not a spare allowance across the boundary.';

  const NEVER_INFERRED =
    'An owner is reported only where the product publishes one on the '
    + 'record in question. A node with no published owner is unknown, a '
    + 'circuit with an unknown end is undetermined, and nothing is read '
    + 'from a site name, a node code or a neighbour.';

  const UNKNOWN = 'unknown';
  const UNDECLARED = 'undeclared';

  const asString = (v) => (typeof v === 'string' && v.length ? v : null);
  const asNumber = (v) => (Number.isFinite(v) ? v : null);
  const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));

  /**
   * @param product  the parsed data-grid-gb transmission-network payload
   * @returns an index, or null if the schema is not the one this reads
   */
  function index(product) {
    if (!product || product.schema !== ACCEPTS) return null;
    const topology = NS.networkTopology;
    if (!topology || typeof topology.index !== 'function') return null;
    const base = topology.index(product);
    if (!base || typeof base.graph !== 'function') return null;
    const graph = base.graph();
    if (!graph || graph.schema !== REQUIRES) return null;

    /* The owner of a NODE, from the node record and nowhere else. The
       graph does not hand this out, so it is read from the product here;
       the graph is still the only authority on which nodes exist, which
       site they belong to and what voltage may be trusted. */
    const nodeOwner = new Map();
    for (const node of product.nodes || []) {
      if (node && node.node) nodeOwner.set(node.node, asString(node.transmission_owner));
    }
    const ownerOfNode = (name) => (nodeOwner.has(name) ? nodeOwner.get(name) : null);

    /**
     * The relation between the two ends of a branch, by published owner.
     *   'boundary'     both ends published, and they differ
     *   'internal'     both ends published, and they agree
     *   'undetermined' at least one end publishes no owner
     */
    function relation(nearOwner, farOwner) {
      if (nearOwner == null || farOwner == null) return 'undetermined';
      return nearOwner === farOwner ? 'internal' : 'boundary';
    }

    function describe(entry, nearNode) {
      const row = entry.row;
      const farNode = row[entry.far];
      const nearOwner = ownerOfNode(nearNode);
      const farOwner = graph.has(farNode) ? ownerOfNode(farNode) : null;
      const assetOwner = asString(row.transmission_owner);
      const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
      const farSiteCode = graph.has(farNode) ? graph.nodeSiteCode(farNode) || null : null;
      const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
      const out = {
        kind: entry.kind,
        from_node: nearNode,
        to_node: farNode,
        from_site_code: nearSiteCode,
        to_site_code: farSiteCode,
        to_site_name: farSite ? farSite.name : null,
        within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
        from_voltage_kv: graph.nodeVoltageKv(nearNode),
        to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
        /* the three published owners, each named for what it is */
        from_owner: nearOwner || UNKNOWN,
        to_owner: farOwner || UNKNOWN,
        asset_owner: assetOwner || UNKNOWN,
        ends: relation(nearOwner, farOwner),
        /* the asset's own owner set against the ends it lands on; null
           where either end is unknown, because "matches neither" cannot
           be said of an end that has not been published */
        asset_owner_matches_an_end: assetOwner && nearOwner && farOwner
          ? (assetOwner === nearOwner || assetOwner === farOwner)
          : null,
        /* carried, never computed with */
        parameters_pct_100mva: graph.parametersOf(row)
      };
      if (entry.kind === 'circuit') {
        out.circuit_type = asString(row.circuit_type);
        out.ohl_km = asNumber(row.ohl_km);
        out.cable_km = asNumber(row.cable_km);
        out.ratings_mva = graph.ratingsOf(row);
      } else {
        out.rating_mva = asNumber(row.rating_mva);
        out.voltage_ratio_kv = asString(row.voltage_ratio_kv);
      }
      return out;
    }

    /**
     * Ownership at one site: the site's own published owner, the owner of
     * each of its nodes, the assets landing on those nodes counted per
     * owner within each voltage, and every boundary branch named with both
     * owners.
     *
     * @param key      site code or exact site name
     * @param options  { voltageKv } to restrict to nodes the site declares
     *                 at that voltage
     */
    function at(key, options) {
      const site = base.site(key);
      if (!site) return null;
      const opts = options || {};
      const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;

      const nodeNames = graph.nodesOfSite(site.code)
        .filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);

      const nodes = nodeNames.map((name) => ({
        node: name,
        voltage_kv: graph.nodeVoltageKv(name),
        transmission_owner: ownerOfNode(name) || UNKNOWN
      }));

      /* Assets are counted once per site even when both ends are here,
         and grouped under the declared voltage of the node they were
         first met at in sorted node order. */
      const seen = new Set();
      const bands = new Map();
      const boundary_circuits = [];
      const boundary_transformers = [];
      const undetermined = [];
      const asset_owner_differs = [];

      function band(kv) {
        const k = bandKey(kv);
        if (!bands.has(k)) {
          bands.set(k, { voltage_kv: kv, by_owner: {}, circuits: 0, transformers: 0, nodes: 0 });
        }
        return bands.get(k);
      }
      function count(b, owner, what) {
        const o = owner || UNKNOWN;
        if (!b.by_owner[o]) b.by_owner[o] = { nodes: 0, circuits: 0, transformers: 0 };
        b.by_owner[o][what] += 1;
        b[what] += 1;
      }

      for (const n of nodes) count(band(n.voltage_kv), n.transmission_owner, 'nodes');

      for (const nodeName of nodeNames) {
        for (const entry of graph.edgesAt(nodeName)) {
          if (seen.has(entry.row)) continue;
          seen.add(entry.row);
          const d = describe(entry, nodeName);
          const b = band(d.from_voltage_kv);
          count(b, d.asset_owner === UNKNOWN ? null : d.asset_owner,
            entry.kind === 'circuit' ? 'circuits' : 'transformers');
          if (d.ends === 'boundary') {
            (entry.kind === 'circuit' ? boundary_circuits : boundary_transformers).push(d);
          } else if (d.ends === 'undetermined') {
            undetermined.push(d);
          }
          if (d.asset_owner_matches_an_end === false) asset_owner_differs.push(d);
        }
      }

      const by_voltage = [...bands.entries()]
        .sort((a, b) => {
          if (a[0] === UNDECLARED) return 1;
          if (b[0] === UNDECLARED) return -1;
          return Number(b[0]) - Number(a[0]);
        })
        .map(([, b]) => b);

      const owners = new Set();
      for (const b of by_voltage) for (const o of Object.keys(b.by_owner)) owners.add(o);

      const byPair = (list) => list.sort((a, b) =>
        String(a.from_node).localeCompare(String(b.from_node))
        || String(a.to_node).localeCompare(String(b.to_node)));

      return {
        schema: SCHEMA,
        source: ACCEPTS,
        site: {
          code: site.code,
          name: site.name,
          transmission_owner: asString(site.transmission_owner) || UNKNOWN
        },
        requested_voltage_kv: voltageKv,
        scope: voltageKv == null
          ? 'every node of this site, counted within its own declared voltage; '
            + 'no count here spans two voltages'
          : 'nodes this site declares at ' + voltageKv + ' kV only',
        nodes,
        by_voltage,
        owners_present: [...owners].sort(),
        boundary_circuits: byPair(boundary_circuits),
        boundary_transformers: byPair(boundary_transformers),
        undetermined: byPair(undetermined),
        asset_owner_differs_from_both_ends: byPair(asset_owner_differs),
        counts: {
          nodes: nodes.length,
          nodes_with_unknown_owner: nodes.filter((n) => n.transmission_owner === UNKNOWN).length,
          owners_present: owners.size,
          circuits: by_voltage.reduce((s, b) => s + b.circuits, 0),
          transformers: by_voltage.reduce((s, b) => s + b.transformers, 0),
          boundary_circuits: boundary_circuits.length,
          boundary_transformers: boundary_transformers.length,
          undetermined: undetermined.length,
          asset_owner_differs_from_both_ends: asset_owner_differs.length
        },
        not_a_counterparty: NOT_A_COUNTERPARTY,
        never_inferred: NEVER_INFERRED,
        not_an_assessment: NOT_AN_ASSESSMENT
      };
    }

    /**
     * Every boundary branch in the product, each reported once, with both
     * owners named. The seam between the networks as a list.
     */
    function boundaries() {
      const out = [];
      const seen = new Set();
      const pairs = {};
      for (const [kind, rows] of [['circuit', product.circuits], ['transformer', product.transformers]]) {
        for (const row of rows || []) {
          if (!row || seen.has(row)) continue;
          seen.add(row);
          const d = describe({ kind, row, near: 'node_1', far: 'node_2' }, row.node_1);
          if (d.ends !== 'boundary') continue;
          out.push(d);
          const pair = [d.from_owner, d.to_owner].sort().join('/');
          pairs[pair] = (pairs[pair] || 0) + 1;
        }
      }
      return {
        schema: SCHEMA,
        source: ACCEPTS,
        branches: out.sort((a, b) =>
          String(a.from_node).localeCompare(String(b.from_node))
          || String(a.to_node).localeCompare(String(b.to_node))),
        counts: {
          boundary_circuits: out.filter((d) => d.kind === 'circuit').length,
          boundary_transformers: out.filter((d) => d.kind === 'transformer').length,
          by_owner_pair: pairs
        },
        not_a_counterparty: NOT_A_COUNTERPARTY,
        never_inferred: NEVER_INFERRED,
        not_an_assessment: NOT_AN_ASSESSMENT
      };
    }

    const ownerTally = {};
    for (const node of product.nodes || []) {
      const o = (node && asString(node.transmission_owner)) || UNKNOWN;
      ownerTally[o] = (ownerTally[o] || 0) + 1;
    }

    return {
      schema: SCHEMA,
      source: ACCEPTS,
      counts: {
        nodes: nodeOwner.size,
        nodes_by_owner: ownerTally
      },
      site: base.site,
      at,
      boundaries
    };
  }

  NS.ownerBoundary = Object.freeze({
    schema: SCHEMA,
    accepts: ACCEPTS,
    requires: REQUIRES,
    unknown: UNKNOWN,
    not_a_counterparty: NOT_A_COUNTERPARTY,
    never_inferred: NEVER_INFERRED,
    not_an_assessment: NOT_AN_ASSESSMENT,
    index
  });
})();

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
