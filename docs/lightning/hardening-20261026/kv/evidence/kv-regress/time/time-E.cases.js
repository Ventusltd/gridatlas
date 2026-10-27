// time-E extra cases (E01-E06). Appended to the T01-T15 body by time-boundaries.vm.mjs; same helpers and signature.
// SYNTHETIC fixtures only. Each case runs in a fresh boot() under the process TZ.
const R = v => ({ s: v.w && iso(v.w.s), e: v.w && iso(v.w.e), atLatest: v.w && v.w.atLatest });
const IXR = (now, from, cutoff = '2025-01-01') => ({ gen: now - 30 * MIN, cutoff, scan: [[P(from), now]] });
const FEAT = (t, i) => ({ type: 'Feature', id: 'edge-' + i, geometry: { type: 'Point', coordinates: [-1.5, 52.5] }, properties: { time_utc: t, observation_kind: 'optical_lightning_flash' } });
const FEED = (qe, times) => ({ type: 'FeatureCollection', metadata: { synthetic: 'SYNTHETIC', query_start_utc: iso(qe - 3 * H), query_end_utc: iso(qe), latest_detection_utc: iso(qe - H) }, features: times.map(FEAT) });

// ---------------------------------------------------------------- E01 UK clock change, 01:00 UTC 25 Oct 2026
T('E01', 'UK clock change 25 Oct 2026 01:00 UTC: 12H/24H/48H at ms edges, CUSTOM day-so-far, refresh age, 7D PREV/NEXT', async c => {
  const out = [], ix = FULL('2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z');
  for (const n of ['2026-10-25T00:59:59.999Z', '2026-10-25T01:00:00.000Z', '2026-10-25T01:00:00.001Z', '2026-10-25T02:00:00.000Z']) {
    const now = P(n); await setup(c, now, ix); const a = await period(c, '12h'); const b = await period(c, '24h');
    out.push(...winAsserts(a, now - 12 * H, now).map(x => ({ ...x, what: `${n} 12H: ${x.what}` })), ...winAsserts(b, now - DAY, now).map(x => ({ ...x, what: `${n} 24H: ${x.what}` })));
  }
  const n48 = P('2026-10-26T00:30:00Z'); await setup(c, n48, ix); const d = await period(c, '48h');
  out.push(...winAsserts(d, n48 - 2 * DAY, n48), A('48H over the change = 96 flashes (not 94/98)', d.ids.length === 96, d.ids.length));
  const nd = P('2026-10-25T23:30:00Z'); await setup(c, nd, ix); const e = await period(c, 'custom');
  out.push(A('CUSTOM default at 23:30 UTC 25 Oct = 2026-10-25 (London local 23:30 GMT, Kolkata 26th)', e.inputs.from === '2026-10-25' && e.inputs.to === '2026-10-25' && e.inputs.toMax === '2026-10-25', e.inputs),
    ...winAsserts(e, P('2026-10-25T00:00:00Z'), nd), A('day-so-far 00:00-23:30 UTC = 47', e.ids.length === 47, e.ids.length));
  // refresh age: wall clocks in London differ from UTC elapsed across the change
  for (const [g, n, txt, st] of [['2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z', '2h 0min', false], ['2026-10-24T23:00:00Z', '2026-10-25T03:00:00.000Z', '4h 0min', false], ['2026-10-24T23:00:00Z', '2026-10-25T03:00:00.001Z', '4h 0min', true]]) {
    const gen = P(g), now = P(n); const v = await setup(c, now, { gen, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), gen]] });
    out.push(A(`gen ${g}, now ${n}: "Refresh archive ${Tm(gen)} (${txt} ago" STALE=${st}`, v.caps.refresh.includes(`Refresh archive ${Tm(gen)} (${txt} ago`) && /STALE/.test(v.caps.refresh) === st && /STALE/.test(v.label) === st, { refresh: v.caps.refresh, label: v.label }));
  }
  const n7 = P('2026-10-28T12:00:00Z'); await setup(c, n7, FULL('2026-09-01T00:00:00Z', '2026-10-28T12:00:00Z'));
  const p0 = await period(c, '7d'); const p1 = await nav(c, 'prev'); const p2 = await nav(c, 'next');
  out.push(...winAsserts(p1, n7 - 14 * DAY, n7 - 7 * DAY), A('7D NEXT over the change returns to latest', p2.w.atLatest && p2.w.s === p0.w.s && p2.w.e === p0.w.e, R(p2)));
  return out;
});

// ---------------------------------------------------------------- E02 31 Dec -> 1 Jan and month ends
T('E02', '31 Dec -> 1 Jan at ms edges; month-end calendar windows (3M/6M) and PREV/NEXT round trips', async c => {
  const out = [], ix = n => FULL('2026-11-15T00:00:00Z', n);
  for (const [n, day] of [['2026-12-31T23:59:59.999Z', '2026-12-31'], ['2027-01-01T00:00:00.000Z', '2027-01-01']]) {
    const now = P(n); c.S.from = c.S.to = ''; c.S.period = '24h'; /* fresh page: From/To are session-sticky by design (line 159) */ await setup(c, now, ix(n)); const a = await period(c, '24h'); const b = await period(c, 'custom');
    out.push(...winAsserts(a, now - DAY, now).map(x => ({ ...x, what: `${n} 24H: ${x.what}` })),
      A(`${n}: CUSTOM default From/To and max = ${day}`, b.inputs.from === day && b.inputs.to === day && b.inputs.toMax === day, b.inputs),
      A(`${n}: CUSTOM caption not inverted and names ${day}`, b.caps.window.includes(`UTC dates ${day} to ${day} inclusive`), b.caps.window));
  }
  const ny = P('2027-01-05T12:00:00Z'); await setup(c, ny, ix('2027-01-05T12:00:00Z'));
  const y = await custom(c, '2026-12-31', '2027-01-01');
  out.push(...winAsserts(y, P('2026-12-31T00:00:00Z'), P('2027-01-02T00:00:00Z')), A('31 Dec + 1 Jan = 96', y.ids.length === 96, y.ids.length));
  const n30 = P('2026-12-01T00:00:00.000Z'); await setup(c, n30, FULL('2026-09-25T00:00:00Z', '2026-12-01T00:00:00Z'));
  const m30 = await period(c, '30d'); const m31 = await nav(c, 'prev');
  out.push(...winAsserts(m30, n30 - 30 * DAY, n30), ...winAsserts(m31, n30 - 60 * DAY, n30 - 30 * DAY));
  // calendar months anchored on a month end: start clamps to the shorter month's last day
  for (const [n, p, s] of [['2026-05-31T12:00:00Z', '3m', '2026-02-28T12:00:00Z'], ['2026-03-31T12:00:00Z', '3m', '2025-12-31T12:00:00Z'], ['2026-08-31T12:00:00Z', '6m', '2026-02-28T12:00:00Z'], ['2026-12-31T12:00:00Z', '12m', '2025-12-31T12:00:00Z']]) {
    const now = P(n); await setup(c, now, IXR(now, '2025-01-01T00:00:00Z', '2024-01-01')); const v0 = await period(c, p);
    out.push(A(`${p} at ${n}: window [${s}, now)`, v0.w.s === P(s) && v0.w.e === now && v0.w.atLatest, R(v0)));
    const v1 = await nav(c, 'prev'); const v2 = await nav(c, 'next');
    out.push(A(`${p} at ${n}: PREV ends at ${s}`, v1.w.e === P(s), R(v1)), A(`${p} at ${n}: PREV then NEXT returns to the latest window (no day lost)`, v2.w.atLatest && v2.w.s === v0.w.s && v2.w.e === v0.w.e, { ...R(v2), caption: v2.caps.window }));
  }
  // two pages back then two forward from 31 Mar
  const nm = P('2026-03-31T12:00:00Z'); await setup(c, nm, IXR(nm, '2025-01-01T00:00:00Z', '2024-01-01'));
  const q0 = await period(c, '3m'); const q1 = await nav(c, 'prev'); const q2 = await nav(c, 'prev'); const q3 = await nav(c, 'next');
  out.push(A('3M 31 Mar: PREV,PREV,NEXT returns to page 1 [2025-09-30, 2025-12-31)', q3.w.s === q1.w.s && q3.w.e === q1.w.e, { page1: R(q1), page2: R(q2), next: R(q3) }));
  return out;
});

// ---------------------------------------------------------------- E03 leap day 2028-02-29
T('E03', 'Leap day 2028-02-29: ms edges, 7D across it, 3M/12M anchored on it and PREV/NEXT round trip', async c => {
  const out = [], ix = n => ({ gen: P(n) - 30 * MIN, cutoff: '2025-01-01', scan: [[P('2028-02-01T00:00:00Z'), P(n)]] });
  for (const [n, day] of [['2028-02-29T23:59:59.999Z', '2028-02-29'], ['2028-03-01T00:00:00.000Z', '2028-03-01'], ['2028-02-29T00:00:00.000Z', '2028-02-29']]) {
    const now = P(n); c.S.from = c.S.to = ''; c.S.period = '24h'; /* fresh page: From/To are session-sticky by design (line 159) */ await setup(c, now, ix(n)); const a = await period(c, '24h'); const b = await period(c, 'custom');
    out.push(...winAsserts(a, now - DAY, now).map(x => ({ ...x, what: `${n} 24H: ${x.what}` })), A(`${n}: CUSTOM default/max = ${day}`, b.inputs.from === day && b.inputs.toMax === day, b.inputs));
  }
  const n7 = P('2028-03-03T12:00:00Z'); await setup(c, n7, ix('2028-03-03T12:00:00Z')); const w7 = await period(c, '7d');
  out.push(...winAsserts(w7, n7 - 7 * DAY, n7), A('7D across 29 Feb = 336', w7.ids.length === 336, w7.ids.length));
  const n3 = P('2028-05-31T12:00:00Z'); await setup(c, n3, IXR(n3, '2027-01-01T00:00:00Z')); const m3 = await period(c, '3m');
  out.push(A('3M at 2028-05-31 starts 2028-02-29 12:00', m3.w.s === P('2028-02-29T12:00:00Z'), R(m3)));
  const nl = P('2029-02-28T12:00:00Z'); await setup(c, nl, IXR(nl, '2027-01-01T00:00:00Z')); const y9 = await period(c, '12m');
  out.push(A('12M at 2029-02-28 starts 2028-02-28 12:00 (366 days incl. leap day)', y9.w.s === P('2028-02-28T12:00:00Z'), R(y9)));
  const nL = P('2028-02-29T12:00:00Z'); await setup(c, nL, IXR(nL, '2025-01-01T00:00:00Z', '2025-01-01'));
  const y0 = await period(c, '12m'); const y1 = await nav(c, 'prev'); const y2 = await nav(c, 'next');
  out.push(A('12M at 2028-02-29: window [2027-02-28 12:00, now)', y0.w.s === P('2027-02-28T12:00:00Z') && y0.w.e === nL, R(y0)),
    A('12M PREV page = [2026-02-28 12:00, 2027-02-28 12:00)', y1.w.s === P('2026-02-28T12:00:00Z') && y1.w.e === P('2027-02-28T12:00:00Z'), R(y1)),
    A('12M PREV then NEXT returns to the latest window (29 Feb not dropped)', y2.w.atLatest && y2.w.s === y0.w.s && y2.w.e === y0.w.e, { ...R(y2), caption: y2.caps.window }));
  return out;
});

// ---------------------------------------------------------------- E04 23:59:59.999 / 00:00:00.000 edges (point inclusion, labels)
T('E04', '23:59:59.999 / 00:00:00.000: [start,end) point inclusion, zone-less ms times, CUSTOM labels', async c => {
  const out = [], now = P('2026-10-27T00:00:00.000Z');
  const times = ['2026-10-25T23:59:59.999Z', '2026-10-26T00:00:00.000Z', '2026-10-26T12:00:00.000Z', '2026-10-26T23:59:59.999Z', '2026-10-27T00:00:00.000Z', '2026-10-26T23:59:59.999'];
  const v = await setup(c, now, null, FEED(now - 10 * MIN, times)); // index 404 -> live feed, 24H
  out.push(A('24H [2026-10-26 00:00:00.000, 2026-10-27 00:00:00.000): includes start and 23:59:59.999, excludes 25th 23:59:59.999 and end instant', JSON.stringify(v.ids.sort()) === JSON.stringify(['edge-1', 'edge-2', 'edge-3', 'edge-5']), v.ids),
    A('zone-less 23:59:59.999 read as UTC in every TZ (edge-5 kept)', v.ids.includes('edge-5'), v.ids),
    A('Actual line: first 2026-10-26 00:00:00 UTC, last 2026-10-26 23:59:59 UTC', v.caps.actual === 'Actual  first 2026-10-26 00:00:00 UTC · last 2026-10-26 23:59:59 UTC', v.caps.actual),
    A('UTC only', utcOnly(v).length === 0, utcOnly(v)));
  const n2 = P('2026-10-26T23:59:59.999Z'); await setup(c, n2, FULL('2026-10-01T00:00:00Z', '2026-10-26T23:59:59.999Z'));
  const cu = await period(c, 'custom');
  out.push(A('CUSTOM To=today at 23:59:59.999: caption "2026-10-26 to 2026-10-26 inclusive"', cu.caps.window.includes('UTC dates 2026-10-26 to 2026-10-26 inclusive'), cu.caps.window),
    A('CUSTOM window = [2026-10-26 00:00, now), 48 flashes, atLatest', cu.w.s === P('2026-10-26T00:00:00Z') && cu.w.e === n2 && cu.w.atLatest && cu.ids.length === 48, { ...R(cu), n: cu.ids.length }));
  const pa = await custom(c, '2026-10-25', '2026-10-25');
  out.push(A('past CUSTOM day ends exactly at 2026-10-26 00:00:00.000 (end exclusive), 48', pa.w.e === P('2026-10-26T00:00:00Z') && pa.ids.length === 48, { ...R(pa), n: pa.ids.length }));
  return out;
});

// ---------------------------------------------------------------- E05 4 h stale threshold at exactly 4 h (ms resolution)
T('E05', '4 h stale threshold at exactly 4 h (index and feed, ms), next_update_due boundary', async c => {
  const out = [], gen = P('2026-10-26T18:00:00Z');
  const ix = (x = {}) => ({ gen, cutoff: '2025-10-01', scan: [[P('2026-10-20T00:00:00Z'), gen]], ...x });
  for (const [dt, want, x, tag] of [[4 * H - 1, false, {}, '4h-1ms'], [4 * H, false, {}, 'exactly 4h'], [4 * H + 1, true, {}, '4h+1ms'],
    [2 * H, false, { nextDue: gen + 2 * H }, 'exactly next_update_due (2h)'], [2 * H + 1, true, { nextDue: gen + 2 * H }, 'next_update_due+1ms'],
    [4 * H, false, { nextDue: gen + 6 * H }, 'exactly 4h, next_update_due later'], [4 * H + 1, true, { nextDue: gen + 6 * H }, '4h+1ms, next_update_due later (4h cap wins)']]) {
    const v = await setup(c, gen + dt, ix(x));
    out.push(A(`index ${tag}: STALE=${want} in refresh, label, status and state`, /STALE/.test(v.caps.refresh) === want && /STALE/.test(v.label) === want && /STALE/.test(v.status) === want && (v.last && v.last.stale) === want, { refresh: v.caps.refresh, label: v.label, status: v.status }));
  }
  const now = P('2026-10-26T23:40:00Z');
  for (const [age, want, tag] of [[4 * H, false, 'feed exactly 4h'], [4 * H + 1, true, 'feed 4h+1ms'], [4 * H - 1, false, 'feed 4h-1ms']]) {
    const v = await setup(c, now, null, FEED(now - age, []));
    out.push(A(`${tag}: STALE=${want} (label/status/state)`, /STALE/.test(v.label) === want && /STALE/.test(v.status) === want && (v.last && v.last.stale) === want, { label: v.label, status: v.status }));
  }
  // INFO (not a pass/fail gate): with collection_interval_hours=2 and no next_update_due, the derived due time is gen+3h
  const v2 = await setup(c, gen + 3 * H + 1, { gen, iv: 2, cutoff: '2025-10-01', scan: [[P('2026-10-20T00:00:00Z'), gen]] });
  out.push({ what: 'INFO iv=2, no next_update_due, age 3h+1ms: stale flag (derived due = gen+(iv+1)h)', ok: true, observed: { stale: v2.last && v2.last.stale, refresh: v2.caps.refresh } });
  return out;
});

// ---------------------------------------------------------------- E06 "<1 min" wording
T('E06', '"<1 min" wording in refresh age and not-yet-ingested tail', async c => {
  const out = [], now = P('2026-10-26T23:40:00Z');
  for (const [dt, want, tag] of [[0, '<1 min', '0 s'], [1, '<1 min', '1 ms'], [29999, '<1 min', '29.999 s'], [30000, '0h 1min', '30 s'], [59999, '0h 1min', '59.999 s'], [60000, '0h 1min', '60 s'], [89999, '0h 1min', '89.999 s']]) {
    const gen = now - dt; const v = await setup(c, now, { gen, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), now]] });
    out.push(A(`refresh age ${tag}: "(${want} ago;"`, v.caps.refresh.includes(`(${want} ago; expected every 3 h)`), v.caps.refresh));
  }
  for (const [gap, want, tag] of [[1, '<1 min', '1 ms'], [20000, '<1 min', '20 s'], [29999, '<1 min', '29.999 s'], [30000, '0h 1min', '30 s']]) {
    const last = now - gap; await setup(c, now, { gen: last - 10 * MIN, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), last]] }); const v = await period(c, '24h');
    out.push(A(`tail ${tag}: "Not yet ingested: last ${want} of window (unknown, not zero)"`, v.caps.warning.includes(`Not yet ingested: last ${want} of window (unknown, not zero)`), v.caps.warning),
      A(`tail ${tag}: searched line not 100%, state PARTIAL`, !/Searched EUMETSAT 100%/.test(v.caps.searched) && v.last && v.last.state === 'PARTIAL', { searched: v.caps.searched, status: v.status }),
      A(`tail ${tag}: ny exact`, v.ny === gap, v.ny), A(`tail ${tag}: UTC only`, utcOnly(v).length === 0, utcOnly(v)));
  }
  // index generated in the future (clock skew): age must not be presented as fresh "<1 min ago"
  const vf = await setup(c, now, { gen: now + 2 * H, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), now]] });
  out.push(A('index generated_utc 2 h in the future: refresh does not claim "<1 min ago"', !/\(<1 min ago/.test(vf.caps.refresh), { refresh: vf.caps.refresh, label: vf.label }));
  return out;
});

// ---------------------------------------------------------------- T12a (amended copy of T12)
T('T12a', 'T12 amended: searched % floored (never rounds a partial window up to 100%, per T14)', async c => {
  const now = P('2026-10-26T23:40:00Z'), out = [];
  for (const [last, txt, tag] of [[P('2026-10-26T21:23:00Z'), '2h 17min', 'scan ends 21:23:00'], [P('2026-10-26T22:40:30Z'), '0h 59min', 'scan ends 59 min 30 s before now'],
    [P('2026-10-25T17:40:00Z'), '24h 0min', 'scan ended before the window (whole 24 h)'], [P('2026-10-26T23:39:00Z'), '0h 1min', '1 min'], [now - 20000, 'NOT-0h0', 'scan ends 20 s before now (sub-minute gap must not read "0h 0min")'], [now, null, 'scan ends at now (no warning)']]) {
    const v = await setup(c, now, { gen: Math.min(last, now) - 10 * MIN, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), last]] }); const v2 = await period(c, '24h');
    const ny = now - Math.max(now - DAY, last), cov = (Math.max(0, last - (now - DAY))) / DAY;
    // 59 min 30 s: round-half-up ("1h 0min") and floor ("0h 59min") both accepted as consistent arithmetic
    const okTxt = txt === 'NOT-0h0' ? /Not yet ingested/.test(v2.caps.warning) && !/last 0h 0min/.test(v2.caps.warning)
      : txt === '0h 59min' ? /Not yet ingested: last (0h 59min|1h 0min) of window/.test(v2.caps.warning)
      : txt ? v2.caps.warning.includes(`Not yet ingested: last ${txt} of window`) : !/Not yet ingested/.test(v2.caps.warning);
    out.push(A(`${tag}: ${txt ? `"Not yet ingested: last ${txt} of window"` : 'no not-yet-ingested warning'}`, okTxt, v2.caps.warning),
      A(`${tag}: searched % + not-ingested = 100% of window (no hour lost/double counted)`, Math.abs(v2.cov + v2.ny / DAY - 1) < 1e-9 && v2.ny === ny, { cov: v2.cov, ny: v2.ny, expectNy: ny }),
      A(`${tag}: searched line ${Math.floor(cov * 100 + 1e-9)}%`, cov > 0 ? v2.caps.searched.includes(`Searched EUMETSAT ${Math.floor(cov * 100 + 1e-9)}% of window`) : /0%/.test(v2.caps.searched), v2.caps.searched),
      A(`${tag}: UTC only`, utcOnly(v2).length === 0, utcOnly(v2)));
  }
  return out;
});
