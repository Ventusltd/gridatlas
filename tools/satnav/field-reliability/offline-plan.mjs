// SPDX-License-Identifier: Apache-2.0
// Saves the planned pins on this device only, after the user presses Save.
const cacheName = 'ventus-satnav-offline-plans-v1';

function fieldPlan(pins, maths) {
  if (!Array.isArray(pins) || pins.length < 2 || pins.length > 20000) {
    throw new Error('Choose between 2 and 20,000 plan pins before saving.');
  }
  const coordinates = pins.map(pin => {
    const at = pin?.coordinate ?? pin;
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)
        || Math.abs(at[0]) > 180 || Math.abs(at[1]) > 90) {
      throw new Error('A plan pin has invalid coordinates.');
    }
    return [at[0], at[1]];
  });
  let totalM = 0;
  const legs = coordinates.slice(1).map((to, i) => {
    const from = coordinates[i];
    const metres = maths.distanceKm(...from, ...to) * 1000;
    const bearing = metres > 0 ? maths.initialBearingDeg(...from, ...to) : null;
    if (!Number.isFinite(metres) || metres < 0 || (bearing !== null && !Number.isFinite(bearing))) {
      throw new Error('Unable to measure the selected plan.');
    }
    totalM += metres;
    return [Math.round(metres), bearing === null ? null : (Math.round(bearing) + 360) % 360];
  });
  return {coordinates, legs, totalM: Math.round(totalM), savedAt: new Date().toISOString()};
}

// This function is embedded in the saved HTML so it can run without a network or dependencies.
function displayPlan() {
  const plan = JSON.parse(document.getElementById('saved-plan').textContent);
  const points = plan.coordinates;
  const byId = id => document.getElementById(id);
  const formatDistance = m => m < 1000 ? m + ' m' : (m / 1000).toLocaleString('en-GB', {maximumFractionDigits: 2}) + ' km';
  const scope = new URL('./', location.href);
  const previous = byId('previous'), next = byId('next');
  let index = 0;
  let x = points[0][0];
  const projected = points.map(([lng, lat], i) => {
    if (i) x += ((lng - points[i - 1][0] + 540) % 360) - 180;
    return [x, lat];
  });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [lng, lat] of projected) {
    minX = Math.min(minX, lng); maxX = Math.max(maxX, lng);
    minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
  }
  const cos = Math.max(0.000001, Math.cos((minY + maxY) * Math.PI / 360));
  const scaleX = (maxX - minX) * cos;
  const scaleY = maxY - minY;
  const scale = Math.min(scaleX ? 284 / scaleX : Infinity, scaleY ? 150 / scaleY : Infinity);
  const factor = Number.isFinite(scale) ? scale : 1;
  const chart = projected.map(([lng, lat]) => [
    +(160 + (lng - (minX + maxX) / 2) * cos * factor).toFixed(2),
    +(90 - (lat - (minY + maxY) / 2) * factor).toFixed(2),
  ]);
  byId('line').setAttribute('points', chart.map(p => p.join(',')).join(' '));
  byId('summary').textContent = points.length.toLocaleString('en-GB') + ' pins · ' + formatDistance(plan.totalM) + ' planned';
  byId('saved-at').textContent = 'Saved ' + new Date(plan.savedAt).toLocaleString('en-GB');
  function showPin() {
    const [lng, lat] = points[index], leg = plan.legs[index];
    byId('pin').textContent = 'Pin ' + (index + 1) + ' of ' + points.length;
    byId('coordinate').textContent = lat.toFixed(5) + '°, ' + lng.toFixed(5) + '°';
    byId('leg').textContent = leg
      ? 'To next pin: ' + formatDistance(leg[0]) + (leg[1] === null ? '' : ' · ' + leg[1] + '° true')
      : 'Last planned pin';
    byId('marker').setAttribute('cx', chart[index][0]);
    byId('marker').setAttribute('cy', chart[index][1]);
    previous.disabled = index === 0; next.disabled = index === points.length - 1;
  }
  previous.onclick = () => { if (index > 0) index--; showPin(); };
  next.onclick = () => { if (index < points.length - 1) index++; showPin(); };
  byId('reload').onclick = () => location.reload();
  byId('forget').onclick = async () => {
    try {
      const cache = await caches.open('ventus-satnav-offline-plans-v1');
      await cache.delete(new URL('__saved-field-plan__', scope));
      const message = document.createElement('p');
      message.textContent = 'Saved plan removed from this device.';
      document.querySelector('main').replaceChildren(message, byId('reload'));
    } catch {
      byId('saved-at').textContent = 'Could not remove the saved plan. Try again.';
    }
  };
  showPin();
}

export function offlinePlanDocument(pins, maths) {
  const data = fieldPlan(pins, maths);
  // Only validated number pairs, measured legs and our own ISO date reach the data element.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Saved field plan · Ventus SatNav</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#07151a;color:#e4f6f7;font:1rem/1.45 system-ui,sans-serif}
main{max-width:40rem;margin:auto;padding:1rem}h1{margin:.4rem 0}p{margin:.5rem 0}svg{display:block;width:100%;max-height:38vh;border:1px solid #48777c;border-radius:.5rem;background:#0a2026}
button{min-height:44px;margin:.2rem .25rem .2rem 0;padding:.35rem .85rem;color:inherit;background:#123239;border:1px solid #56868a;border-radius:.4rem;font:inherit}
button:focus-visible{outline:2px solid white}button:disabled{opacity:.48}small{color:#b1ced0}footer{margin-top:.8rem}
</style></head><body><main><h1>Saved field plan</h1><p id="summary"></p>
<svg viewBox="0 0 320 180" role="img" aria-label="North-up diagram of the planned pins"><polyline id="line" fill="none" stroke="#58d9e3" stroke-width="2.5"/><circle id="marker" r="5.5" fill="#ffdc73" stroke="#07151a" stroke-width="2"/></svg>
<p><small>Planned straight lines · North up · GPS off</small></p>
<section aria-live="polite"><strong id="pin"></strong><p id="coordinate"></p><p id="leg"></p></section>
<button id="previous" type="button">Previous pin</button><button id="next" type="button">Next pin</button>
<footer><p><small id="saved-at"></small></p><button id="reload" type="button">Reopen live map</button><button id="forget" type="button">Forget saved plan</button>
<p><small>Check access rights, restrictions and safe working arrangements before entering land.</small></p></footer>
</main><script type="application/json" id="saved-plan">${JSON.stringify(data)}</script>
<script>(${displayPlan.toString()})()</script></body></html>`;
}

async function activateWorker(scope) {
  const workerURL = new URL('../satnav-offline-plan-20261128-worker.js', scope);
  const existing = await navigator.serviceWorker.getRegistration(scope);
  if (existing?.scope === scope.href) {
    for (const worker of [existing.active, existing.installing, existing.waiting]) {
      if (worker && worker.scriptURL !== workerURL.href) throw new Error('This version uses a different offline map.');
    }
    if (existing.active?.state === 'activated') return;
  }
  const registration = await navigator.serviceWorker.register(workerURL, {scope: scope.pathname});
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('Offline access did not start. Try again while online.');
  if (worker.state === 'activated') return;
  await new Promise((resolve, reject) => {
    const finish = () => {
      if (worker.state === 'activated') { cleanup(); resolve(); }
      if (worker.state === 'redundant') { cleanup(); reject(new Error('Offline access could not start.')); }
    };
    const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', finish); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Offline access timed out. Try again.')); }, 15000);
    worker.addEventListener('statechange', finish);
    finish();
  });
}

export function mountOfflinePlan({container, getPins, maths}) {
  const scope = new URL('./', location.href);
  if (!/\/atlas\/v\/satnav-[\w.-]+\/$/.test(scope.pathname)) throw new Error('A versioned SatNav entry is required.');
  const key = new URL('__saved-field-plan__', scope);
  const area = document.createElement('details');
  area.innerHTML = '<summary>Offline plan</summary><p>Save selected pins on this device for offline reading.</p><button type="button">Save plan</button> <button type="button">Forget saved plan</button><p role="status"></p>';
  const [save, forget] = area.querySelectorAll('button');
  const status = area.querySelector('[role="status"]');
  container.append(area);
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
    save.disabled = forget.disabled = true;
    status.textContent = 'Offline saving is unavailable in this browser.';
    return area;
  }

  async function change(action) {
    save.disabled = forget.disabled = true;
    try {
      if (action === 'save') {
        const html = offlinePlanDocument(getPins(), maths);
        await activateWorker(scope);
        const cache = await caches.open(cacheName);
        await cache.put(key, new Response(html, {headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          'Cache-Control': 'no-store',
        }}));
        status.textContent = 'Saved. Reopen this map address offline to read the plan.';
      } else {
        const cache = await caches.open(cacheName);
        await cache.delete(key);
        status.textContent = 'Saved plan removed from this device.';
      }
    } catch (error) {
      status.textContent = error?.message || 'Could not change the saved plan on this device.';
    } finally {
      save.disabled = forget.disabled = false;
    }
  }
  save.onclick = () => change('save');
  forget.onclick = () => change('forget');
  return area;
}
