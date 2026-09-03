/* ══════════════════════════════════════════════════════════════════════
   technology-coverage - which technologies the measurement runs for, and
   what each measurement is a measurement OF
   ══════════════════════════════════════════════════════════════════════

   WHAT WAS MEASURED BEFORE THIS MODULE WAS WRITTEN.

   The request was to extend the nearest-substation computation to the twenty
   wider-fleet REPD technologies, on the report that it ran only for the
   spine. Driven in Chrome against the live composition (v9.88, generation
   202609030234) on the wider fleet's own MAP link:

     ?repd_ref=8795 ... &technology=biomass   Caledon Green, Landfill Gas
     ?repd_ref=626  ... &technology=biomass   Pitsea Tipp,   Landfill Gas

   Both arrived, flew, opened the card, ticked the Subs control and DREW THE
   LINKS. Caledon Green measured 1.74 km at 132 kV, 2.98 km at 275 kV and
   5.70 km at 33 kV; Pitsea Tipp named Coryton South Substation at 7.70 km
   and printed its 400 kV scope sentence with the denominator in it. So the
   wider fleet was ALREADY computing, and a change that claimed to enable it
   would have been a change that did nothing while saying it did something.

   There IS a four-member technology allow-list in this estate:

     const allowedTechnologies = new Set(['solar','bess','wind_onshore','wind_offshore']);

   It lives at line 805 of the IMMUTABLE SHELL, atlas/releases/
   202608300453-atlas-v9/ventus-corev8engine.js, inside the shell's own
   focusCanonicalProjectDeepLink(). It rejects every value the wider fleet
   can send, because those four are exactly the four types the wider fleet is
   DEFINED as excluding. Its rejection is caught, and its only effects are a
   console line and a flyTo the arrival lane in this cartridge has already
   performed - which is why the measurement runs anyway. The shell is carried
   forward verbatim by contract and this module does not reach into it.

   WHAT THIS MODULE ACTUALLY CHANGES.

   One thing: OFFSHORE WIND NOW MEASURES. It used to open a card and withhold
   the distance, on the reasoning that a turbine in the North Sea does not
   reach the nearest onshore substation by a straight line. The reasoning
   about routes was right and is kept in full below; the conclusion was
   over-cautious. An offshore project's export cable does land at an onshore
   substation, so the distance to the nearest mapped substation is a real
   measurement of a real thing, provided the card says what it measured.

   WHAT "NEAREST" CANNOT BE MADE TO MEAN HERE, MEASURED RATHER THAN ASSUMED.

   The coordinator asked for an onshore-only filter, so that "nearest onshore
   substation" would mean onshore. The pinned substation product cannot carry
   one. Counted over all 5,800 features of

     atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson

   the only properties present are voltage (5,800), name (4,460), operator
   (3,264), brand (1,310), source (684), type (72), capacity (15) and colour
   (3). The OSM `location` tag - the field that would say offshore, platform
   or underwater - is present on ZERO of them.

   That leaves the name, and the name does not separate them either. Fourteen
   features carry "offshore" in their name; read against their coordinates, at
   least four are ONSHORE substations serving an offshore wind farm, which is
   precisely what an offshore project should be measured to - Hornsea
   (-0.2598, 53.6582) and Hornsea Two (-0.2604, 53.6568) at 400/220 kV,
   Thanet's explicitly-named onshore substation (1.3459, 51.3089), and the
   European Offshore Wind Deployment Centre (-2.0650, 57.2158). The rest are
   genuinely platforms at sea: Neart na Gaoithe North and South, Sheringham
   Shoal 1 and 2, Humber Gateway, Westermost Rough, Rampion, Burbo Bank 2.

   So a name filter would drop Hornsea - a landfall connection - from the very
   search it was supposed to sharpen. No onshore filter is applied, and this
   module says so on the card instead of pretending to one. An offshore
   project is measured against the SAME 5,800 features, at the SAME >=33 kV
   floor, by the SAME straight line as every other technology, and the card
   carries two extra sentences: that the line crosses water and is not the
   export cable, and that the set searched contains substations that are
   themselves offshore - named where one is returned, so the reader can see
   which. A stated limit, rather than a hidden one. A filter whose predicate
   is wrong four times in fourteen is worse than no filter, because it looks
   like precision.

   WHAT DOES NOT CHANGE, AND MUST NOT.

     - The straight line stays. It is the measurement, it is first, and the
       corridor-estimate module still sits beside it saying how far off a
       built route typically is. Nothing here replaces it.
     - Every superlative keeps carrying its sample. This module supplies the
       sample LABEL for each policy so the card cannot print "nearest"
       without printing what it searched.
     - The coordinate denominator stays. The operator publishes connection
       points and only a fraction carry coordinates; that count is computed
       at render time by nearestScope() and is not restated here, because a
       literal would go quietly false the day the pinned product moves.
     - Nothing here grades anything. No verdict word appears anywhere in this
       module, not even to disown one: the sandbox proof greps the served
       bytes for them and cannot tell a comment from a card, which is the
       right way round. A distance and a voltage, stated, and the things a
       distance cannot answer named rather than implied.

   THE ROSTER IS BY NAME ON PURPOSE.

   The Atlas never receives a raw REPD technology. Pipeline News' MAP link
   sends `technology=<t>`, the COLOUR BUCKET - so twenty raw types arrive as
   nine bucket values, and "Landfill Gas" reaches this cartridge as
   "biomass". Every one of the twenty is listed below against its bucket, so
   a proof can assert coverage by REPD name rather than by bucket, and so
   anyone reading this can see that the twenty are accounted for rather than
   assumed.
   ══════════════════════════════════════════════════════════════════════ */

(function installTechnologyCoverage() {
  'use strict';

  const SCHEMA = 'gridatlas.technology-coverage.v1';

  /* The twenty wider-fleet REPD technologies, each against the bucket the
     MAP link actually sends. Counts are the live wider-fleet payload,
     202609030009, 1,104 rows - carried so a drift in either side is visible
     rather than silent. Every one of the 1,104 rows carries a usable
     coordinate pair; none is withheld for want of a location. */
  const WIDER_FLEET = Object.freeze([
    Object.freeze({ repd: 'Landfill Gas',                       bucket: 'biomass',    rows: 275 }),
    Object.freeze({ repd: 'Anaerobic Digestion',                bucket: 'biomass',    rows: 253 }),
    Object.freeze({ repd: 'Biomass (dedicated)',                bucket: 'biomass',    rows: 159 }),
    Object.freeze({ repd: 'EfW Incineration',                   bucket: 'biomass',    rows: 122 }),
    Object.freeze({ repd: 'Small Hydro',                        bucket: 'hydro',      rows: 108 }),
    Object.freeze({ repd: 'Hydrogen',                           bucket: 'hydrogen',   rows: 60 }),
    Object.freeze({ repd: 'Advanced Conversion Technologies',   bucket: 'act',        rows: 37 }),
    Object.freeze({ repd: 'Large Hydro',                        bucket: 'hydro',      rows: 28 }),
    Object.freeze({ repd: 'Pumped Storage Hydroelectricity',    bucket: 'hydro',      rows: 15 }),
    Object.freeze({ repd: 'Tidal Stream',                       bucket: 'tidal',      rows: 14 }),
    Object.freeze({ repd: 'Sewage Sludge Digestion',            bucket: 'biomass',    rows: 12 }),
    Object.freeze({ repd: 'Geothermal',                         bucket: 'geothermal', rows: 5 }),
    Object.freeze({ repd: 'Shoreline Wave',                     bucket: 'tidal',      rows: 4 }),
    Object.freeze({ repd: 'Liquid Air Energy Storage',          bucket: 'caes',       rows: 2 }),
    Object.freeze({ repd: 'Biomass (co-firing)',                bucket: 'biomass',    rows: 2 }),
    Object.freeze({ repd: 'Hot Dry Rocks (HDR)',                bucket: 'geothermal', rows: 2 }),
    Object.freeze({ repd: 'Compressed Air Energy Storage',      bucket: 'caes',       rows: 2 }),
    Object.freeze({ repd: 'Fuel Cell (Hydrogen)',               bucket: 'hydrogen',   rows: 2 }),
    Object.freeze({ repd: 'Flywheels',                          bucket: 'flywheel',   rows: 1 }),
    Object.freeze({ repd: 'Unknown',                            bucket: 'other',      rows: 1 })
  ]);

  /* The spine, for completeness: the four the wider fleet is defined as
     excluding, and the four the shell's allow-list accepts. */
  const SPINE = Object.freeze(['solar', 'bess', 'wind_onshore', 'wind_offshore']);

  /* Offshore wind, in every spelling the register and the engine use. This
     is no longer a withholding set - it selects a DIFFERENT NOTE, not a
     different answer. */
  const OFFSHORE_TECHS = Object.freeze([
    'wind_offshore', 'wind_offshore_operational'
  ]);
  const OFFSHORE = new Set(OFFSHORE_TECHS);

  /* Named as offshore in the substation product. Used only to LABEL a
     returned row, never to remove one - see the header for the four onshore
     substations this pattern also matches, which is exactly why it does not
     filter. */
  const OFFSHORE_NAMED = /\boffshore\b/i;
  const ONSHORE_NAMED = /\bonshore\b/i;

  const PRODUCT = Object.freeze({
    features: 5800,
    with_location_tag: 0,
    offshore_in_name: 14,
    of_those_onshore: 4,
    source: 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson'
  });

  /* The sentence the card prints under an offshore project's distances. It
     keeps every word of the old withholding note that was ABOUT ROUTES,
     because none of that reasoning was wrong; it drops only the conclusion
     that therefore nothing should be measured. */
  const OFFSHORE_NOTE =
    'This is a straight line from the project to the nearest mapped '
    + 'substation, and for an offshore project that line crosses water. It is '
    + 'not the export cable and not its length. An offshore project reaches an '
    + 'offshore substation, an export cable and a landfall before anything '
    + 'onshore, and the route inland is then chosen for consent and ground '
    + 'conditions rather than for distance, so the built length is longer than '
    + 'this by an amount no distance can tell you.';

  const OFFSHORE_SET_NOTE =
    'The set searched is the same 5,800 mapped substations used for every '
    + 'other technology. It carries no field saying which of them are onshore: '
    + 'the OSM location tag is absent from all 5,800, and of the 14 whose name '
    + 'contains "offshore" at least 4 are onshore substations serving an '
    + 'offshore wind farm. No onshore filter is applied, because one built on '
    + 'the name would drop those 4 - including Hornsea at 400/220 kV, which is '
    + 'a landfall connection. Where a result is itself named as an offshore '
    + 'substation it is marked below.';

  /* The label under which a measurement is made. The card must never print
     the word "nearest" without one of these beside it. */
  const SAMPLE = Object.freeze({
    mapped_substations: 'nearest of the mapped substations at or above the '
      + 'voltage floor that this search could see'
  });

  function bucketOf(tech) {
    return String(tech == null ? '' : tech).trim();
  }

  /**
   * What the measurement is, for one technology id.
   *
   * There is no `measure: false` branch. Every technology the register or
   * the wider fleet can send is measured; what differs is the note that
   * goes with it. A technology this module has never heard of is measured
   * too - the arrival lane already continues past an unknown id, and
   * refusing arithmetic over two coordinates because a string was
   * unfamiliar is how 109 offshore projects got nothing at all.
   */
  function policy(tech) {
    const id = bucketOf(tech);
    const offshore = OFFSHORE.has(id);
    return Object.freeze({
      technology: id || null,
      measure: true,
      offshore,
      sample: SAMPLE.mapped_substations,
      /* Both notes, in order, for offshore; nothing extra for the rest.
         The generic straight-line-is-not-a-route caveat is the card's own
         and is printed for every technology either way. */
      notes: Object.freeze(offshore ? [OFFSHORE_NOTE, OFFSHORE_SET_NOTE] : [])
    });
  }

  /**
   * Is this substation NAME one of the ones the product calls offshore?
   * Labelling only. A true here marks a row; it never removes one.
   */
  function namedOffshore(name) {
    const text = String(name == null ? '' : name);
    return OFFSHORE_NAMED.test(text) && !ONSHORE_NAMED.test(text);
  }

  /** The roster, by REPD name, for a proof to assert against. */
  function widerFleetNames() {
    return WIDER_FLEET.map(entry => entry.repd);
  }

  /** The bucket values the wider fleet's MAP link can actually send. */
  function widerFleetBuckets() {
    return [...new Set(WIDER_FLEET.map(entry => entry.bucket))].sort();
  }

  /** Every wider-fleet technology measures. Stated as a function so a proof
      cannot pass by reading a literal that stopped being true. */
  function measuredCount() {
    return WIDER_FLEET.filter(entry => policy(entry.bucket).measure).length;
  }

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  NS.technologyCoverage = Object.freeze({
    schema: SCHEMA,
    wider_fleet: WIDER_FLEET,
    spine: SPINE,
    offshore_techs: OFFSHORE_TECHS,
    product: PRODUCT,
    offshore_note: OFFSHORE_NOTE,
    offshore_set_note: OFFSHORE_SET_NOTE,
    sample: SAMPLE,
    policy,
    namedOffshore,
    widerFleetNames,
    widerFleetBuckets,
    measuredCount,
    /* Said once, here, so no caller has to phrase it and none can soften it. */
    not_a_connection: 'A distance to a mapped substation is not a connection, '
      + 'a capacity, a queue position or an offer, for any technology on this '
      + 'list.',
    shell_allow_list_note: 'The four-member technology allow-list in the '
      + 'immutable shell rejects every wider-fleet value and is caught; the '
      + 'arrival lane in this cartridge has already flown and carded by then, '
      + 'so it costs a console line and nothing else. The shell is carried '
      + 'forward verbatim and is not edited here.'
  });
})();
