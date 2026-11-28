// A version registers this worker for its own directory after an explicit save.
// Only the version entry can fall back to a saved plan. Map tiles and GPS are never cached.
const entry = new URL(self.registration.scope);
const savedPlanKey = new URL('__saved-field-plan__', entry).href;
const cacheName = 'ventus-satnav-offline-plans-v1';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function openPlan(request) {
  let response;
  try {
    // The online entry is only a loader. A cached HTTP 200 for that loader
    // would conceal a disconnected origin and leave its dependencies unavailable.
    response = await fetch(request, {cache: 'no-store'});
    if (response.status < 500) return response;
  } catch {
    // Offline navigation can still open the user's last explicitly saved copy.
  }
  const saved = await caches.match(savedPlanKey, {cacheName});
  return saved || response || new Response('This version has no saved field plan on this device.', {
    status: 503,
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
}

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  const target = new URL(event.request.url);
  if (target.origin !== entry.origin) return;
  if (target.pathname !== entry.pathname && target.pathname !== entry.pathname + 'index.html') return;
  event.respondWith(openPlan(event.request));
});
