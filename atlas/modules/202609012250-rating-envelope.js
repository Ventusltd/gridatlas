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
