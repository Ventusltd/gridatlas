/**
 * Module: click-computation
 *
 * One deterministic answer envelope for a map click. It coordinates facts
 * already owned by small modules; it does not fetch, render, solve a load
 * flow, estimate headroom, or turn proximity into a connection claim.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.clickComputation) return;

  const REFUSAL = 'This answer combines published facts and straight-line measurements. '
    + 'It is not solved power flow, available headroom, queue position, a connection offer '
    + 'or a connection assessment.';

  const stateOf = value => value == null ? 'unavailable' : 'answered';

  function create(dependencies = {}) {
    const geodesy = dependencies.geodesy || NS.geodesy || null;
    const declared = dependencies.declaredConnections || NS.declaredConnections || null;
    const gridScope = dependencies.gridScope || NS.gridScope || null;
    const mapClickNetwork = dependencies.mapClickNetwork || NS.mapClickNetwork || null;
    const sourceRegistry = dependencies.sourceRegistry || NS.sourceRegistry || null;

    function compute(input = {}) {
      const lon = Number(input.lon);
      const lat = Number(input.lat);
      const originValid = Number.isFinite(lon) && Number.isFinite(lat)
        && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
      if (!originValid) return null;

      const repdRef = input.repdRef == null ? null : String(input.repdRef);
      const connectionKv = Number.isFinite(input.connectionKv) ? input.connectionKv : null;
      const siteCode = input.siteCode == null ? null : String(input.siteCode).toUpperCase();
      const mapped = Array.isArray(input.mappedSubstations) ? input.mappedSubstations : [];
      const sourceSurvey = sourceRegistry?.survey
        ? sourceRegistry.survey(input.scope || window) : null;

      let declaredAnswer = null;
      if (repdRef && declared?.resolve) {
        declaredAnswer = declared.resolve(repdRef, [lon, lat], mapped);
      }

      let mappedAnswer = null;
      if (gridScope?.compute) {
        mappedAnswer = gridScope.compute([lon, lat], mapped, input.scopeOptions || {});
      }

      let networkAnswer = null;
      let networkIndexState = 'unavailable';
      if (mapClickNetwork?.index && input.networkProduct) {
        const index = mapClickNetwork.index(input.networkProduct);
        networkIndexState = index ? 'ready' : 'schema-refused';
        if (index && siteCode && connectionKv != null) {
          networkAnswer = index.at(siteCode, { connectionKv });
        }
      }

      const sources = {
        declared_connection: {
          state: repdRef ? stateOf(declaredAnswer) : 'not-requested', value: declaredAnswer
        },
        mapped_measurement: {
          state: stateOf(mappedAnswer), value: mappedAnswer
        },
        published_network: {
          state: networkAnswer ? 'answered'
            : networkIndexState === 'schema-refused' ? 'schema-refused'
              : !input.networkProduct ? 'product-unavailable'
                : !siteCode ? 'identity-unavailable'
                  : connectionKv == null ? 'voltage-unavailable' : 'site-unavailable',
          value: networkAnswer
        }
      };
      const missing = Object.entries(sources)
        .filter(([, item]) => !['answered', 'not-requested'].includes(item.state))
        .map(([id, item]) => ({ id, state: item.state }));

      return {
        schema: 'gridatlas.module.click-computation.v1',
        origin: { lon, lat }, repd_ref: repdRef,
        site_code: siteCode, connection_voltage_kv: connectionKv,
        sources, missing, source_survey: sourceSurvey,
        complete: missing.length === 0,
        not_an_assessment: REFUSAL
      };
    }

    return Object.freeze({ schema: 'gridatlas.module.click-computation.v1', compute });
  }

  NS.clickComputation = Object.freeze({
    schema: 'gridatlas.module.click-computation.v1',
    not_an_assessment: REFUSAL,
    create
  });
})();
