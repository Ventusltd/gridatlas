/**
 * Module: declared-connections
 *
 * The 400 kV public record: what each DCO-scale scheme has DECLARED as its
 * point of connection, taken from Development Consent Orders, Planning
 * Inspectorate documents and public project statements. The table binds a
 * register identity (REPD ref) to a NAMED substation, and the functions
 * here bind that name to the served payload and measure the distance -
 * measured, never asserted.
 *
 * The rule this exists to keep: bind to the public record or say nothing.
 * A nearest-substations list is a measurement; it was listing closer 33 and
 * 132 kV points under schemes whose Order names a 400 kV connection, which
 * read as connecting them to the wrong network. This table is the answer,
 * and it is data with three small functions, so it lives in a module where
 * a proof can read every record and a cut can hash it on its own.
 *
 * WHAT IT WILL NOT DO
 * It does not say whether a connection is available, likely or adequate. A
 * declared point of connection is a fact about a consent, not a judgement
 * about the network. `poc_status` distinguishes a far end that exists from
 * one not yet built or under construction, because drawing both the same
 * would say something untrue.
 *
 * Extracted from the sld-sandbox body at generation 202609012128 (UTC),
 * record for record; the parity proof reads the previously served bytes
 * and asserts the table is unchanged.
 *
 * Pure. No DOM, no network, no state. Depends on: geodesy.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.declaredConnections) return;

  const geodesy = NS.geodesy;
  if (!geodesy) throw new Error('declared-connections requires the geodesy module');
  const distanceKm = geodesy.distanceKm;

  const RECORDS = Object.freeze({
    '10914': { works: "an up to 400 kV substation collating the satellite sites at 132 kV and site generation at 33 kV (Work No. 4A)",
      poc_works: "reuse of an ex-generation bay: busbars, a 400 kV 3-phase 4000 A breaker, metering and protection (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation consented within the DCO',
      source: 'Cottam Solar Project Order 2024, granted 5 Sep 2024 (EN010133)' },
    '10915': { works: "an up to 400 kV substation collating the satellite sites at 132 kV and site generation at 33 kV (Work No. 4A)",
      poc_works: "reuse of an ex-generation bay: busbars, a 400 kV 3-phase 4000 A breaker, metering and protection (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation consented within the DCO',
      source: 'Cottam Solar Project Order 2024, granted 5 Sep 2024 (EN010133)' },
    '10916': { works: "an up to 400 kV customer substation at West Burton 3 with reactive power units; up to 132 kV site substations at WB1 and WB2 (Works 3A-3C)",
      poc_works: "a new GIS bay by extension of main busbar 4 and reserve busbar 3/4 gas zones (Work No. 4)",
      substation: 'West Burton Substation',
      via: 'a new 400 kV customer substation at West Burton 3 and a 400 kV cable to the former generator bay',
      source: 'West Burton Solar Project Order, granted 24 Jan 2025 (EN010132)' },
    '10917': { works: "an up to 400 kV customer substation at West Burton 3 with reactive power units; up to 132 kV site substations at WB1 and WB2 (Works 3A-3C)",
      poc_works: "a new GIS bay by extension of main busbar 4 and reserve busbar 3/4 gas zones (Work No. 4)",
      substation: 'West Burton Substation',
      via: 'a new 400 kV customer substation at West Burton 3 and a 400 kV cable to the former generator bay',
      source: 'West Burton Solar Project Order, granted 24 Jan 2025 (EN010132)' },
    '9809': { works: "a scheme substation with reactive power units and a 400 kV harmonic filter compound (Work No. 3)",
      poc_works: "one new 400 kV generation bay at Cottam (Work No. 4C)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation and a 7.5 km 400 kV underground cable',
      source: 'Gate Burton Energy Park Order, granted 2024 (EN010131)' },
    '9810': { works: "a scheme substation with reactive power units and a 400 kV harmonic filter compound (Work No. 3)",
      poc_works: "one new 400 kV generation bay at Cottam (Work No. 4C)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation and a 7.5 km 400 kV underground cable',
      source: 'Gate Burton Energy Park Order, granted 2024 (EN010131)' },
    '12281': { works: "two scheme substations, each 2 x 400/33 kV 150/75/75 MVA transformers with 400 kV GIS (Works 3A-3B)",
      poc_works: "the standard 400 kV bay kit at a free bay at Cottam (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'an 18.5 km 400 kV underground cable to a free bay',
      source: 'Tillbridge Solar Order 2025 (EN010142)' },
    '12282': { works: "two scheme substations, each 2 x 400/33 kV 150/75/75 MVA transformers with 400 kV GIS (Works 3A-3B)",
      poc_works: "the standard 400 kV bay kit at a free bay at Cottam (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'an 18.5 km 400 kV underground cable to a free bay',
      source: 'Tillbridge Solar Order 2025 (EN010142)' },
    '14806': { poc_status: 'not_built',
      poc_status_note: 'the point of connection is NGET\u2019s new substation beside the existing High Marnham, built as Great Grid Upgrade works; the line is drawn to the existing site',
      substation: 'High Marnham Substation',
      via: "NGET's new substation adjacent to the existing High Marnham (Great Grid Upgrade)",
      source: 'One Earth Solar Farm DCO, consented (EN010159)' },
    '14807': { poc_status: 'not_built',
      poc_status_note: 'the point of connection is NGET\u2019s new substation beside the existing High Marnham, built as Great Grid Upgrade works; the line is drawn to the existing site',
      substation: 'High Marnham Substation',
      via: "NGET's new substation adjacent to the existing High Marnham (Great Grid Upgrade)",
      source: 'One Earth Solar Farm DCO, consented (EN010159)' },
    '13599': { works: "up to four 33-400 kV transformers (160 t, up to 15 x 9.5 x 10.5 m each) in a compound of up to 40,000 m2 (ES Ch.2 s2.8)",
      poc_works: "a National Grid-delivered extension of Bicker Fen, AIS or GIS, sited for multiple customers (s2.13)",
      substation: 'Bicker Fen Substation',
      via: 'a 400 kV cable and a consented extension of Bicker Fen shared with Heckington Fen',
      source: 'Beacon Fen Energy Park DCO, granted Aug 2026 (EN010151)' },
    '13600': { works: "up to four 33-400 kV transformers (160 t, up to 15 x 9.5 x 10.5 m each) in a compound of up to 40,000 m2 (ES Ch.2 s2.8)",
      poc_works: "a National Grid-delivered extension of Bicker Fen, AIS or GIS, sited for multiple customers (s2.13)",
      substation: 'Bicker Fen Substation',
      via: 'a 400 kV cable and a consented extension of Bicker Fen shared with Heckington Fen',
      source: 'Beacon Fen Energy Park DCO, granted Aug 2026 (EN010151)' },
    '9806': { works: "transformers with bunding and blast walls, switchgear, and harmonic filtering reactive power compensation (Work No. 4)",
      poc_works: "a new generation bay plus an AIS-or-GIS extension and a cable sealing end compound at Bicker Fen (Works 6A-6C)",
      substation: 'Bicker Fen Substation',
      via: 'the consented Bicker Fen extension shared with Beacon Fen',
      source: 'Heckington Fen Solar Park DCO, granted (EN010123)' },
    '9807': { works: "transformers with bunding and blast walls, switchgear, and harmonic filtering reactive power compensation (Work No. 4)",
      poc_works: "a new generation bay plus an AIS-or-GIS extension and a cable sealing end compound at Bicker Fen (Works 6A-6C)",
      substation: 'Bicker Fen Substation',
      via: 'the consented Bicker Fen extension shared with Beacon Fen',
      source: 'Heckington Fen Solar Park DCO, granted (EN010123)' },
    '13644': { poc_status: 'under_construction',
      poc_status_note: 'a new 400 kV four-bay substation is under construction at Thorpe Marsh',
      substation: 'Thorpe Marsh Substation',
      via: 'a new 400 kV four-bay substation under construction at Thorpe Marsh',
      source: 'public planning and contractor records; construction under way' },
    '19801': { poc_status: 'under_construction',
      poc_status_note: 'a new 400 kV four-bay substation is under construction at Thorpe Marsh',
      substation: 'Thorpe Marsh Substation',
      via: 'a new 400 kV four-bay substation under construction at Thorpe Marsh',
      source: 'public planning and contractor records; construction under way' },
    /* Little Crow is the counter-archetype and belongs here precisely
       because it is NOT a 400 kV story: no customer transmission
       substation, no long cable, and a point of connection that is a
       circuit crossing the site rather than a substation to draw a line
       to. Stating that plainly is worth more than drawing nothing. */
    '6557': { poc_kind: 'circuit', poc_status: 'existing',
      circuit: 'the Keadby \u2013 Broughton \u2013 Teed \u2013 Scawby Brook overhead 132 kV line circuit (Northern Powergrid)',
      via: 'a looped connection into an existing 132 kV circuit within the site, with 99.9 MW of export capacity secured',
      kv: 132,
      source: 'Little Crow Solar Park Grid Network Constraints Report, EN010101, November 2020' },
    '7175': { poc_kind: 'circuit', poc_status: 'existing',
      circuit: 'the Keadby \u2013 Broughton \u2013 Teed \u2013 Scawby Brook overhead 132 kV line circuit (Northern Powergrid)',
      via: 'a looped connection into an existing 132 kV circuit within the site, with 99.9 MW of export capacity secured',
      kv: 132,
      source: 'Little Crow Solar Park Grid Network Constraints Report, EN010101, November 2020' },
    '11928': { substation: 'West Burton Substation',
      via: 'a 400 kV grid connection at the former power station site (West Burton C); financial close July 2026',
      source: 'public project records' }
  });

  /* Public works at named substations, shown wherever the name is - the
     "customer and NG substations that do not exist yet" half of the logic.
     Descriptions of the network, never advice about a scheme. */

  const SUBSTATION_WORKS = Object.freeze({
    'thorpe marsh substation':
      'A new 400 kV four-bay substation is under construction here (public record).',
    'high marnham substation':
      'NGET is building a new substation adjacent to the existing one (Great Grid Upgrade, public record).',
    'bicker fen substation':
      'A consented extension here will connect Beacon Fen and Heckington Fen (public record).'
  });

  const worksAt = (name) => SUBSTATION_WORKS[String(name || '').toLowerCase()] || null;

  /* What the Order says is known the moment the identity is known: the
     substation, the voltage class, the route, the consented works and the
     citation need no payload, no fetch and no map. The distance is the one
     part that must be measured, so it is the one part marked pending. */
  function provisional(repdRef) {
    const declared = RECORDS[String(repdRef || '')];
    if (!declared) return null;
    if (declared.poc_kind === 'circuit') {
      // Nothing to measure to and nothing to draw: say what is declared.
      return { poc: declared.circuit, kv: declared.kv || null, at: null,
        km: null, pending: false, kind: 'circuit',
        poc_status: declared.poc_status || 'existing',
        via: declared.via, source: declared.source, works: null,
        customer_works: declared.works || null, poc_works: declared.poc_works || null };
    }
    return {
      poc: declared.substation, kv: 400, at: null, km: null, pending: true,
      kind: 'substation', poc_status: declared.poc_status || 'existing',
      poc_status_note: declared.poc_status_note || null,
      via: declared.via, source: declared.source,
      works: worksAt(declared.substation),
      customer_works: declared.works || null,
      poc_works: declared.poc_works || null
    };
  }

  /* Bind the declared name to the served payload. Only a substation of the
     declared class (>= 400 kV) with exactly that name counts; a 132 kV site
     that happens to share the name is not the point of connection. */
  function resolve(repdRef, origin, subs) {
    const declared = RECORDS[String(repdRef || '')];
    if (!declared) return null;
    if (declared.poc_kind === 'circuit') return provisional(repdRef);
    const wanted = declared.substation.toLowerCase();
    const works = SUBSTATION_WORKS[wanted] || null;
    const match = (Array.isArray(subs) ? subs : [])
      .filter(s => String(s.name).toLowerCase() === wanted
        && Array.isArray(s.kv) && s.kv[0] >= 400)
      .sort((a, b) => b.kv[0] - a.kv[0])[0] || null;
    if (!match) {
      return { poc: declared.substation, kv: 400, at: null, km: null,
        kind: 'substation', poc_status: declared.poc_status || 'existing',
        poc_status_note: declared.poc_status_note || null,
        via: declared.via, source: declared.source, works,
        customer_works: declared.works || null,
        poc_works: declared.poc_works || null };
    }
    return { poc: match.name, kv: Math.round(match.kv[0]), at: match.at,
      km: distanceKm(origin[0], origin[1], match.at[0], match.at[1]),
      kind: 'substation', poc_status: declared.poc_status || 'existing',
      poc_status_note: declared.poc_status_note || null,
      via: declared.via, source: declared.source, works,
      customer_works: declared.works || null,
      poc_works: declared.poc_works || null };
  }

  /* The nearest transmission (>= 400 kV) substation in the payload, and
     separately the nearest one WITH A NAME: an unnamed OSM node can win on
     raw distance and the reader still wants an identity. Two measurements,
     no judgement about either. */
  function nearestTransmission(origin, subs) {
    let best = null;
    let bestNamed = null;
    for (const s of (Array.isArray(subs) ? subs : [])) {
      if (!(Array.isArray(s.kv) && s.kv[0] >= 400)) continue;
      const km = distanceKm(origin[0], origin[1], s.at[0], s.at[1]);
      if (!best || km < best.km) {
        best = { name: s.name || 'Unnamed substation', km, at: s.at };
      }
      if (s.name && (!bestNamed || km < bestNamed.km)) {
        bestNamed = { name: s.name, km, at: s.at };
      }
    }
    if (best) {
      best.works = worksAt(best.name);
      if (bestNamed && bestNamed.name !== best.name) {
        best.named = bestNamed;
        best.named.works = worksAt(bestNamed.name);
      }
    }
    return best;
  }

  NS.declaredConnections = Object.freeze({
    schema: 'gridatlas.module.declared-connections.v1',
    records: RECORDS,
    substationWorks: SUBSTATION_WORKS,
    count: Object.keys(RECORDS).length,
    isDeclared: (repdRef) => Object.prototype.hasOwnProperty.call(RECORDS, String(repdRef || '')),
    worksAt,
    provisional,
    resolve,
    nearestTransmission
  });
})();
