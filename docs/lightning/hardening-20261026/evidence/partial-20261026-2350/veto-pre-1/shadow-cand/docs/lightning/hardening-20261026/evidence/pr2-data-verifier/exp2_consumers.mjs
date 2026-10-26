// EXPERIMENT 2 (pr2-data-verifier): feed the REAL index produced by experiment 1 to
// (a) PR #2's own client normaliseIndex (history-window.mjs @ f7db76c) and
// (b) the candidate overlay's index validator (vk/ni) extracted VERBATIM from
//     atlas/modules/202610261949-uk-lightning-overlay.js @ fda6b10 (read-only).
// Then answer R02: what does the overlay see if the collector published a v1 (PR #1 shape) index.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [,, WT, OVERLAY, INDEX_JSON] = process.argv;
const client = await import(pathToFileURL(WT + '/history-window.mjs').href);
const real = JSON.parse(readFileSync(INDEX_JSON, 'utf8'));

// (a) PR #2 client
const m = client.normaliseIndex(real);
console.log('[client] schemaVersion', m.schemaVersion, 'rows', m.days.length, 'cutoffMs', new Date(m.cutoffMs).toISOString(),
  'lastScanEnd', new Date(m.lastScanEndMs).toISOString(), 'coverageStart', new Date(m.coverageStartMs).toISOString());
console.log('[client] stale at generated+3h59?', client.isStale(m, m.generatedMs + 3.98 * 36e5), ' at generated+4h01?', client.isStale(m, m.generatedMs + 4.02 * 36e5));

// (b) overlay validator, verbatim extraction
const src = readFileSync(OVERLAY, 'utf8');
const lines = src.split('\n');
const grab = (startRe, endRe) => { const s = lines.findIndex((l) => startRe.test(l)); let e = s; while (!endRe.test(lines[e])) e++; return lines.slice(s, e + 1).join('\n'); };
const vkSrc = grab(/^vk=r=>/, /b\('sealed'\)\},$/);
const niSrc = grab(/^ni=raw=>/, /cutoffDate:raw\.cutoff_date_utc\}\},$/);
console.log('[overlay] extracted vk lines:', vkSrc.split('\n').length, ' ni lines:', niSrc.split('\n').length);
const factory = new Function(`
  const DAY=864e5,HOUR=36e5,DRE=/^\\d{4}-\\d{2}-\\d{2}$/,ds=d=>Date.parse(d+'T00:00:00Z'),E=m=>{throw new TypeError(m)};
  const ${vkSrc.replace(/,\s*$/, ';')}
  const ${niSrc.replace(/,\s*$/, ';')}
  return { vk, ni };
`);
const { ni } = factory();
const x = ni(real);
console.log('[overlay] ni(real v2 index) OK: rows', x.days.length, 'lastScan', new Date(x.lastScan).toISOString(), 'covStart', new Date(x.covStart).toISOString(), 'nextDue', new Date(x.nextDue).toISOString());

// R02: a v1 index in PR #1 shape (built from the same real content, as PR #1 history.py would publish it)
const v1 = {
  schema: 'uk-lightning-history-index.v1', generated_utc: real.generated_utc, collection_interval_hours: 3, collection_lookback_hours: 3,
  next_update_due_utc: real.next_update_due_utc, cutoff_date_utc: real.cutoff_date_utc, retention: real.retention, source: real.source, source_url: real.source_url,
  observation: real.observation, bounds_wsen: real.bounds_wsen, max_shard_bytes: 25000000, archive_first_enabled_utc: real.archive_first_enabled_utc,
  archived_observations: real.archived_observations, first_observation_utc: real.first_observation_utc, last_observation_utc: real.last_observation_utc,
  scan_windows: real.scan_windows,
  days: real.days.filter((r) => r.count > 0).map((r) => ({ date: r.date, path: r.path, count: r.count, first_observation_utc: r.first_observation_utc, last_observation_utc: r.last_observation_utc })),
  status: real.status
};
try { ni(v1); console.log('[overlay] ni(v1) unexpectedly accepted'); } catch (e) { console.log('[overlay] ni(v1) throws:', e.constructor.name + ': ' + e.message); }
const mv1 = client.normaliseIndex(v1);
console.log('[client] normaliseIndex(v1) OK: schemaVersion', mv1.schemaVersion, 'rows', mv1.days.length, 'rows with flashes', mv1.days.filter((r) => r.count > 0).length,
  '2026-10-23 ->', JSON.stringify(mv1.dayMap.get('2026-10-23')));

// What the overlay does next (lw): x=null, ie='unsupported index schema ...' -> ff(w,now,ie) if window within 7 days, else E(... needs the archive ...)
console.log('[overlay] consequence per lw(): index error -> live-feed tier for windows starting >= now-7d with reason text; windows older than 7 d -> TypeError "<label> needs the archive (archive not yet published); the live feed keeps 7 days" -> FAIL state.');

// Tamper checks against the real index: observation sentence, a row with count 0 and scanned 0, a 'none' row with count 0
const tamper = (f) => { const c = JSON.parse(JSON.stringify(real)); f(c); try { ni(c); return 'accepted'; } catch (e) { return e.message; } };
console.log('[overlay] observation sentence changed ->', tamper((c) => { c.observation = 'satellite optical flashes; not verified ground strike locations'; }));
console.log('[overlay] none-row given count 0 ->', tamper((c) => { const r = c.days.find((d) => d.coverage === 'none'); r.count = 0; }));
console.log('[overlay] count 0 with scanned 0 ->', tamper((c) => { const r = c.days.find((d) => d.count === 0); r.scanned_seconds = 0; }));
console.log('[overlay] sealed missing ->', tamper((c) => { delete c.days[0].sealed; }));
console.log('[overlay] path .geojson ->', tamper((c) => { const r = c.days.find((d) => d.path); r.path = r.path.replace('.json', '.geojson'); }));
