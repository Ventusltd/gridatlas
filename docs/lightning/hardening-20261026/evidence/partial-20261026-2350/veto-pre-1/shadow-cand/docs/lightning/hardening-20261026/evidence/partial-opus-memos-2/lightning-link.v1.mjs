/* lightning-link.v1.mjs -- PROPOSED companion to ventus-grid-engine/deeplink/contract.js.
 * Design prototype only (opus-memos-2, issue #32 section 10). Not wired into any product, not committed anywhere.
 * Adapted, not copied in place, from the earlier scratchpad prototype think/atlas-bridge-work/lightning-link.mjs.
 *
 * A lightning link names a UTC WINDOW and a VIEW. It never names a project, a site, a flash-to-asset relation or
 * "latest". It is kept OUT of contract.js PARAMS on purpose: buildDeepLink() loops over Object.keys(PARAMS)
 * (contract.js:214-218), so adding keys there would change every project link the auditor checks.
 *
 * Carrier: the URL FRAGMENT on both receivers.
 *   - See Through's stable route forwards only location.hash (kuiper-belt/see-through/index.html:12).
 *   - No original GridAtlas script reads location.hash (composer, shell, four live cartridges: 0 reads), and the map
 *     is built without MapLibre's hash option (substation-intelligence-v9-63.js:664-670), so every original lane sees
 *     an empty query -- a plain visit -- and the GridAtlas root redirect keeps the fragment (gridatlas/index.html:2).
 */
export const LIGHTNING_VOCABULARY = 'lightning-window.v1';
export const LIGHTNING_PERIODS = Object.freeze(['12h', '24h', '48h', '7d', '30d', '3m', '6m', '12m', 'custom']);
export const LIGHTNING_PARAMS = Object.freeze({
    lightning:       { required: true,  note: 'period; one of LIGHTNING_PERIODS (history-window.mjs PERIODS)' },
    lightning_end:   { required: true,  units: 'UTC instant, ISO 8601 ending in Z; the exclusive end of [start, end)' },
    lightning_start: { required: false, note: 'custom only; a named period derives its start from its end' },
    lightning_lon:   { required: false, units: 'degrees east of the VIEW centre, 3 decimals; only as a pair' },
    lightning_lat:   { required: false, units: 'degrees north of the VIEW centre, 3 decimals; only as a pair' },
    lightning_zoom:  { required: false, note: 'view zoom 3..10; above 10 is finer than the instrument locates (~10 km)' }
});
export const LIGHTNING_RULES = Object.freeze({
    carrier: 'fragment',
    latest_crosses_the_bridge: false,      // a link freezes its window; "latest" is a moving target
    max_zoom: 10,
    coordinate_decimals: 3,
    activation: 'user-gesture-only',       // a receiver may pre-select a window; it never switches a layer on
    receiver_writes_the_address: false,    // sld-sandbox invalidates a pending arrival on hashchange (:3474)
    combine_with_an_arrival_link: false,   // v1: a project/interconnector arrival and a window never share one URL
    max_span: 'one calendar year',
    keys_are_never_repurposed: true        // a changed meaning takes a new key name, so no version key in the URL
});
/* Receivers. `honours` flips only when the receiving code reads this vocabulary; today neither does. */
export const LIGHTNING_RECEIVERS = Object.freeze({
    'gridatlas-v9': Object.freeze({ route: 'https://ventusltd.github.io/gridatlas/atlas/', honours: false }),
    'see-through-lightning': Object.freeze({ route: 'https://ventusltd.github.io/kuiper-belt/see-through-lightning/', honours: false, exists: false })
});
/* Query keys that start an ORIGINAL GridAtlas arrival: sld-sandbox projectKeys (:6597) plus the interconnector lane. */
export const ARRIVAL_KEYS = Object.freeze(['repd_ref', 'longitude', 'latitude', 'project', 'technology', 'capacity_mw', 'status', 'interconnector']);
export const UK_BOX = Object.freeze({ west: -11, south: 49.5, east: 3, north: 61.5 });

const HOUR = 3600000, DAY = 86400000;
const FIXED = { '12h': 12 * HOUR, '24h': DAY, '48h': 2 * DAY, '7d': 7 * DAY, '30d': 30 * DAY };
const MONTHS = { '3m': 3, '6m': 6, '12m': 12 };
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

function minusMonths(ms, count) {               // the same calendar rule as history-window.mjs minusMonths (:62-68)
    const d = new Date(ms);
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - count, 1,
        d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
    const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(d.getUTCDate(), length));
    return first.getTime();
}
const instant = (v) => {
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : NaN;
    if (typeof v === 'number') return v;
    return typeof v === 'string' && UTC_INSTANT.test(v) ? Date.parse(v) : NaN;
};
export function derivedStart(period, endMs) {
    if (MONTHS[period]) return minusMonths(endMs, MONTHS[period]);
    if (FIXED[period]) return endMs - FIXED[period];
    return null;
}
const usablePoint = (lon, lat) => Number.isFinite(lon) && Number.isFinite(lat)
    && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && !(Math.abs(lon) < 1e-9 && Math.abs(lat) < 1e-9);

/** Emitter. w = { period, end, start? } as ms, Date or ISO-Z; view = { longitude, latitude, zoom } or null. */
export function buildLightningLink(receiverId, w, view = null, receivers = LIGHTNING_RECEIVERS) {
    const r = receivers[receiverId];
    if (!r) throw new Error('buildLightningLink: unknown receiver ' + receiverId);
    if (!r.honours) throw new Error('buildLightningLink: ' + receiverId + ' does not honour ' + LIGHTNING_VOCABULARY
        + ' yet; a link to it would land and be silently inert');
    if (!w || !LIGHTNING_PERIODS.includes(w.period)) throw new Error('buildLightningLink: unknown period ' + (w && w.period));
    const end = instant(w.end);
    if (!Number.isFinite(end)) throw new Error('buildLightningLink: lightning_end is required; "latest" never crosses the bridge');
    const start = w.period === 'custom' ? instant(w.start) : derivedStart(w.period, end);
    if (!Number.isFinite(start) || start >= end) throw new Error('buildLightningLink: start must precede end');
    if (start < minusMonths(end, 12)) throw new Error('buildLightningLink: longer than one calendar year');
    const u = new URLSearchParams();
    u.set('lightning', w.period);
    u.set('lightning_end', new Date(end).toISOString());
    if (w.period === 'custom') u.set('lightning_start', new Date(start).toISOString());
    const lon = view ? Number(view.longitude) : NaN, lat = view ? Number(view.latitude) : NaN;
    if (view && view.longitude != null && view.latitude != null && usablePoint(lon, lat)) {
        u.set('lightning_lon', lon.toFixed(LIGHTNING_RULES.coordinate_decimals));
        u.set('lightning_lat', lat.toFixed(LIGHTNING_RULES.coordinate_decimals));
        const z = Number(view.zoom);
        if (view.zoom != null && Number.isFinite(z) && z >= 3) u.set('lightning_zoom', String(Math.min(LIGHTNING_RULES.max_zoom, Math.round(z * 10) / 10)));
    }
    return r.route + '#' + u.toString();
}

/** Receiver. Reports what was asked and what can be honoured, separately; never coerces silently.
 *  `problems` make the link unhonourable; `notes` are honoured with a visible statement. */
export function parseLightningLink(href, { nowMs = null } = {}) {
    const url = new URL(href);
    const h = new URLSearchParams(url.hash.replace(/^#/, ''));
    const q = new URLSearchParams(url.search);
    const present = h.has('lightning');
    const problems = [], notes = [];
    if (!present && q.has('lightning')) notes.push('lightning keys in the query are not this vocabulary (v1 uses the fragment)');
    const period = present ? h.get('lightning') : null;
    const known_period = LIGHTNING_PERIODS.includes(period);
    if (present && !known_period) problems.push('unknown period');
    const rawEnd = h.get('lightning_end');
    const end = instant(rawEnd);
    if (present && !Number.isFinite(end)) problems.push(rawEnd === null ? 'no end ("latest" never crosses the bridge)' : 'end is not a UTC instant ending in Z');
    let start = null;
    if (known_period && Number.isFinite(end)) {
        start = period === 'custom' ? instant(h.get('lightning_start')) : derivedStart(period, end);
        if (!Number.isFinite(start)) { problems.push('custom window without a UTC start'); start = null; }
        else if (start >= end) { problems.push('start does not precede end'); start = null; }
        else if (start < minusMonths(end, 12)) { problems.push('longer than one calendar year'); start = null; }
    }
    const num = (k) => { const v = h.get(k); if (v === null || v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
    let longitude = num('lightning_lon'), latitude = num('lightning_lat');
    if (longitude === null || latitude === null || !usablePoint(longitude, latitude)) { longitude = null; latitude = null; }
    let zoom = num('lightning_zoom');
    if (zoom !== null && zoom < 3) zoom = null;
    if (zoom !== null && zoom > LIGHTNING_RULES.max_zoom) { notes.push('zoom ' + zoom + ' capped at ' + LIGHTNING_RULES.max_zoom + ': finer than the instrument locates'); zoom = LIGHTNING_RULES.max_zoom; }
    const in_uk_box = longitude === null ? null : (longitude >= UK_BOX.west && longitude <= UK_BOX.east && latitude >= UK_BOX.south && latitude <= UK_BOX.north);
    if (in_uk_box === false) notes.push('view centre is outside the archive box; nothing is collected there');
    const end_in_future = nowMs !== null && Number.isFinite(end) ? end > nowMs : null;
    if (end_in_future) notes.push('end is in the future; the receiver clamps it to now and says so');
    const mixed_with_arrival = present && ARRIVAL_KEYS.some((k) => q.has(k));
    if (mixed_with_arrival) problems.push('a project or interconnector arrival and a lightning window cannot share one URL in v1');
    return {
        vocabulary: LIGHTNING_VOCABULARY, present, period, known_period,
        start_utc: start === null ? null : new Date(start).toISOString(),
        end_utc: Number.isFinite(end) ? new Date(end).toISOString() : null,
        end_in_future, longitude, latitude, zoom, view_usable: longitude !== null, in_uk_box, mixed_with_arrival,
        activation: LIGHTNING_RULES.activation,
        honourable: present && problems.length === 0,
        problems, notes
    };
}
