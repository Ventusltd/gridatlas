// The existing Journey panel is the public, removable DOM extension point.
const registry = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (!registry.gridJourneyOfficialContext) {
  let bridge = null, timer = null, attempts = 0, stopped = false, pending = null, abort = null;
  async function resolveFacts() {
    if (pending) return pending;
    const task = (async () => {
      const controller = new AbortController(); abort = controller; const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const url = new URL(ContextPin.artifact.previewPath, new URL('../../', document.baseURI));
        const response = await fetch(url, {cache: 'no-store', credentials: 'same-origin', signal: controller.signal});
        if (!response.ok || Number(response.headers.get('content-length')) > 8000) return null;
        if (!response.body?.getReader) return null;
        const reader = response.body.getReader(), chunks = []; let length = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 8000) { await reader.cancel(); return null; } chunks.push(part.value); } } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(length); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        if (digest !== ContextPin.artifact.sha256) return null;
        return ContextModel.acceptedNotice(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)));
      } catch { return null; } finally { clearTimeout(timeout); if (abort === controller) abort = null; }
    })();
    pending = task; const facts = await task; if (!facts && pending === task) pending = null; return facts;
  }
  function mount(map = window.__GRIDATLAS_V9_MAP__) {
    stopped = false;
    if (bridge?.snapshot().alive) return bridge;
    bridge = createOfficialContextBridge({document, window, map, container: document.getElementById('map-container'), resolveFacts, cancelPending() { abort?.abort(); pending = null; }, render: renderOfficialContext, provenance: {repository: ContextPin.repository, commit: ContextPin.commit, path: ContextPin.artifact.path, sha256: ContextPin.artifact.sha256, factsSha256: ContextPin.factsSha256}, css: ContextCSS});
    return bridge;
  }
  function attach() {
    if (stopped) return;
    if (window.__GRIDATLAS_V9_MAP__ && document.getElementById('map-container')) { try { mount(); } catch (e) { console.warn('[Journey official context]', e.message); } return; }
    if (++attempts < 120) timer = setTimeout(attach, 250);
  }
  registry.gridJourneyOfficialContext = Object.freeze({schema: 'gridatlas.journey.official-context.preview.v1', generation: ContextGeneration, mount, close() { bridge?.close(); }, snapshot: () => bridge?.snapshot() || {state: 'native-map-unavailable'}, destroy() { stopped = true; clearTimeout(timer); bridge?.destroy(); bridge = null; }});
  attach();
}
