// Independent ground truth for every period window and its PREV page.
// Usage: node truth.mjs <archive dir> <now ISO>   (archive dir holds history/index.json + history/days/...)
import { readFileSync } from 'node:fs';
const [dir, nowIso] = process.argv.slice(2);
const NOW = Date.parse(nowIso), H = 36e5, D = 864e5;
const ix = JSON.parse(readFileSync(dir + '/history/index.json', 'utf8'));
const iso = t => new Date(t).toISOString(), ymd = t => iso(t).slice(0, 10), ds = d => Date.parse(d + 'T00:00:00Z');
const months = (t, k) => { const d = new Date(t), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d.getTime(); };
const flashes = [];
for (const r of ix.days) if (r.count > 0) for (const f of JSON.parse(readFileSync(dir + '/history/' + r.path, 'utf8')).features) flashes.push(Date.parse(f.properties.time_utc.replace(/(T[\d:.]+)$/, '$1Z')));
const sw = ix.scan_windows.map(w => [Date.parse(w.start_utc), Date.parse(w.end_utc)]).sort((a, b) => a[0] - b[0]);
const union = []; for (const [s, e] of sw) { const l = union.at(-1); if (l && s <= l[1]) l[1] = Math.max(l[1], e); else union.push([s, e]); }
const searched = (a, b) => union.reduce((n, [s, e]) => n + Math.max(0, Math.min(b, e) - Math.max(a, s)), 0);
const P = [['12h', 12 * H], ['24h', D], ['48h', 2 * D], ['7d', 7 * D], ['30d', 30 * D], ['3m', -3], ['6m', -6], ['12m', -12]];
const cutoff = ds(ix.cutoff_date_utc), lastScan = Math.max(...sw.map(w => w[1]));
const rows = [];
for (const [p, span] of P) {
  let e = NOW;
  for (const page of ['current', 'prev']) {
    let s = span < 0 ? months(e, -span) : e - span; const clamp = s < cutoff; if (clamp) s = cutoff;
    const n = flashes.filter(t => t >= s && t < e).length, sec = searched(s, e);
    const dates = []; for (let t = ds(ymd(s)); t < e; t += D) dates.push(ymd(t));
    const touched = dates.map(d => ix.days.find(r => r.date === d)).filter(Boolean);
    const sd = touched.filter(r => r.coverage !== 'none'), full = touched.filter(r => r.coverage === 'full').length;
    const wholeDaySum = touched.reduce((a, r) => a + (r.count || 0), 0);
    const searchedDates = sd.map(r => r.date);
    rows.push({ period: p, page, start: iso(s), end: iso(e), clamped: clamp, window_h: +((e - s) / H).toFixed(2), flashes: n, whole_day_index_sum: wholeDaySum,
      searched_h: +(sec / H).toFixed(2), searched_pct: +(100 * sec / (e - s)).toFixed(1), unsearched_h: +((e - s - sec) / H).toFixed(2),
      tail_not_yet_searched_h: +(Math.max(0, e - Math.max(s, lastScan)) / H).toFixed(2), calendar_dates: dates.length, searched_dates: sd.length, full_dates: full,
      searched_range: searchedDates.length ? searchedDates[0] + '..' + searchedDates.at(-1) : null, never_searched_dates: dates.length - sd.length });
    e = s; if (clamp) break;
  }
}
console.log(JSON.stringify({ archive: dir.split('/').pop(), now: nowIso, index_generated: ix.generated_utc, next_update_due: ix.next_update_due_utc, last_scan_end: iso(lastScan), total_flashes: flashes.length, scanned_days: ix.scanned_days, rows }, null, 1));
