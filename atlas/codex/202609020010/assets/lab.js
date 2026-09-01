(() => {
  'use strict';
  const SCHEMA = 'gridatlas.codex-computation-lab.v1';
  const LIMIT = 'Screening only: not solved power flow, available headroom, queue position, a connection offer or a connection assessment.';
  const form = document.getElementById('click-form');
  const answer = document.getElementById('answer');

  function envelope(values) {
    const lon = Number(values.get('lon'));
    const lat = Number(values.get('lat'));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)
      || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    const kv = Number(values.get('connection_kv'));
    return {
      schema: SCHEMA,
      generation: '202609020010',
      origin: { lon, lat },
      repd_ref: values.get('repd_ref') || null,
      site_code: (values.get('site_code') || '').toUpperCase() || null,
      connection_voltage_kv: Number.isFinite(kv) ? kv : null,
      computation_state: 'inputs-only',
      missing: ['declared-connection-product', 'mapped-substation-product',
        'voltage-scoped-network-product'],
      limits: LIMIT
    };
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = envelope(new FormData(form));
    answer.textContent = result ? JSON.stringify(result, null, 2)
      : 'Invalid coordinate: no screening envelope was produced.';
  });

  window.__CODEX_GRID_LAB__ = Object.freeze({ schema: SCHEMA, envelope });
})();
