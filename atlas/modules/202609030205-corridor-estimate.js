/* ══════════════════════════════════════════════════════════════════════
   corridor-estimate - a straight line is not a route, and this says how far off
   ══════════════════════════════════════════════════════════════════════

   Every distance this Atlas prints is a great-circle distance between two
   points. No cable is ever laid that way. The question a reader actually has
   is how much longer the built thing would be, and until now the card said
   nothing at all about it.

   THE SCALAR, AND WHAT IT WAS MEASURED ON.

   Route factor 1.245, calibrated against the published built lengths of GB
   transmission CABLE circuits in the operator's own node/branch model:

     median absolute error   8.45%
     within 15%              73% of circuits
     sample                  95 circuits spanning 59 DISTINCT SITE PAIRS

   The sample is 59, not 95. Parallel circuits between the same two sites
   duplicate the geometry exactly, so quoting 95 would be counting the same
   measurement up to four times and claiming a precision the data has not got.

   WHAT IT IS NOT FOR.

   Not overhead line. The measured OHL factor is 1.13, and it is a different
   number for a physical reason rather than a statistical one: a tower line
   crosses open country in long straight spans, while a cable follows the
   highway network, its bends and its wayleaves. Applying a cable factor to an
   overhead question would overstate the route by about ten per cent and would
   be the wrong model regardless of the error.

   Not below about a kilometre. Where the two ends are under 1 km apart the
   site-centroid resolution dominates the geometry: in that band the median
   published length is 0.59 km against a median error of 52.5%, which is not
   the route factor being wrong, it is the straight line not being a
   measurement of anything at that scale. Those separations are refused rather
   than scaled.

   It is a screening estimate for a corridor. It is not a connection offer, a
   constructability assessment or a consenting design, and the caveat below
   travels with every number this module produces.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const SCHEMA = 'gridatlas.module.corridor-estimate.v1';

  const CABLE_FACTOR = 1.245;
  const OHL_FACTOR = 1.13;
  const MINIMUM_KM = 1;

  const BASIS = Object.freeze({
    factor: CABLE_FACTOR,
    median_absolute_error_pct: 8.45,
    within_15_pct: 73,
    circuits: 95,
    distinct_site_pairs: 59,
    source: 'published built lengths of GB transmission cable circuits',
    sample_note: 'parallel circuits between the same two sites duplicate the '
      + 'geometry, so the sample is 59 distinct site pairs and not 95 circuits',
    minimum_separation_km: MINIMUM_KM,
    below_minimum: 'under about a kilometre the site-centroid resolution '
      + 'dominates: median published length 0.59 km against a median error of '
      + '52.5%, so a straight line between centroids is not measuring route '
      + 'factor and no estimate is offered'
  });

  const CAVEAT = 'Indicative highway-corridor screening only. Not a connection '
    + 'offer, not a constructability assessment and not a consenting design.';

  const NOT_FOR_OVERHEAD = 'Calibrated on cable circuits, which follow the '
    + 'highway network. Overhead line crosses open country and measures 1.13; '
    + 'this factor is not applied to an overhead-line question.';

  /**
   * The corridor estimate for a CABLE route of `km` straight-line distance.
   * @returns null when there is nothing honest to say - no distance, or a
   *   separation short enough that the straight line is not measuring
   *   route factor. Null is the answer, not zero.
   */
  function forCable(km) {
    const straight = Number(km);
    if (!Number.isFinite(straight) || straight <= 0) return null;
    if (straight < MINIMUM_KM) {
      return { km: null, factor: CABLE_FACTOR, straight_km: straight,
        withheld: BASIS.below_minimum };
    }
    return {
      km: straight * CABLE_FACTOR,
      factor: CABLE_FACTOR,
      straight_km: straight,
      withheld: null
    };
  }

  /* Deliberately no forOverhead(). A module that offered one would be used,
     and the 1.13 above is published here so a reader can see WHY the cable
     factor is not the answer to that question - not so that this cartridge
     can start answering it. */

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  NS.corridorEstimate = Object.freeze({
    schema: SCHEMA,
    factor: CABLE_FACTOR,
    overhead_factor: OHL_FACTOR,
    minimum_km: MINIMUM_KM,
    basis: BASIS,
    caveat: CAVEAT,
    not_for_overhead: NOT_FOR_OVERHEAD,
    forCable,
    not_an_assessment: 'An estimated corridor length says nothing about '
      + 'whether a connection is available, consentable or affordable.'
  });
})();
