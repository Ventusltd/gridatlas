/**
 * Module: map-click-network
 *
 * Reads data-grid-gb's precomputed, provenance-bound one-hop projection. It
 * selects only appearances whose explicit validated local voltage equals the
 * declared connection voltage. It never decodes node names, solves a load
 * flow, estimates headroom or decides whether a project can connect.
 */
(() => {
  'use strict';
  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.mapClickNetwork) return;
  const ACCEPTS = 'data-grid-gb.map-click-network.v1';
  const REFUSAL = 'Published topology and parameters are not solved power flow, available headroom, queue position, a connection offer or a connection assessment.';

  function index(product) {
    if (!product || product.schema !== ACCEPTS || !Array.isArray(product.connection_points)) return null;
    const points = new Map();
    for (const point of product.connection_points) {
      if (point?.site_code && !points.has(point.site_code)) points.set(point.site_code, point);
    }
    function at(siteCode, { connectionKv } = {}) {
      const point = points.get(String(siteCode || '').toUpperCase());
      if (!point) return null;
      const wanted = Number.isFinite(connectionKv) ? connectionKv : null;
      const select = rows => wanted == null ? []
        : (rows || []).filter(row => row.local_voltage_kv === wanted);
      return {
        schema: 'gridatlas.module.map-click-network.v1',
        source_schema: ACCEPTS,
        site: {
          site_code: point.site_code, name: point.name,
          transmission_owner: point.transmission_owner,
          voltages_kv: point.voltages_kv, location: point.location
        },
        connection_voltage_kv: wanted,
        fault_current: wanted == null ? null
          : point.fault_current_by_voltage?.[String(wanted)] || null,
        existing_circuits: select(point.existing_circuits),
        planned_changes: select(point.planned_changes),
        transformers: wanted == null ? [] : (point.transformers || []).filter(row =>
          row.voltage_1_kv === wanted || row.voltage_2_kv === wanted),
        reactive_compensation: wanted == null ? [] : (point.reactive_compensation || [])
          .filter(row => row.connection_kv === wanted),
        interconnectors: point.interconnectors || [],
        reconciliation: point.projection_reconciliation || null,
        not_an_assessment: REFUSAL
      };
    }
    return { schema: 'gridatlas.module.map-click-network.v1', source_schema: ACCEPTS,
      points: points.size, at };
  }
  NS.mapClickNetwork = Object.freeze({
    schema: 'gridatlas.module.map-click-network.v1', accepts: ACCEPTS,
    not_an_assessment: REFUSAL, index
  });
})();
