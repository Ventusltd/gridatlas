/* GJ-04 PREVIEW ONLY. Official planning facts are not real circuit evidence. Producer Ventusltd/globalgrid2050@07bff3a6d1cdc4d845062cafa1cf49161b135c96. */
(() => {
'use strict';
const ContextModel = (() => {
const factsHash='f9802c96444c21e84b328d612475353861c8053cde31f55196d1ea5862918afb';
const pins=new Map([
 ['https://www.gov.uk/government/news/sea-link-development-consent-decision-announced',{publisher:'Planning Inspectorate',sha256:'b9ba26b90820292e0b181da7993d2d3a2180fc2de0ac53cc6239adeb4cccfaeb',bytes:68432}],
 ['https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',{publisher:'Department for Energy Security and Net Zero',sha256:'c26f93aa307740f8b4ec8ad150b152fb6d30e77f201e5bc31a6da52bba16e0d0',bytes:69536}],
]);
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
function day(value){return value?.precision==='DAY'&&value.value==='2026-10-30'&&Object.keys(value).sort().join(',')==='precision,value';}
async function acceptedNotice(payload){
 try{
  if(payload?.schema!=='globalgrid2050.reviewed-grid-notice.v1'||payload.facts_sha256!==factsHash)throw Error('Unpinned notice');
  const encoded=new TextEncoder().encode(JSON.stringify(canonical(payload.facts))),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))).map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==factsHash)throw Error('Changed fact bytes');
  const f=payload.facts;if(f.application_ref!=='EN020026'||f.reported_network_operator!=='NGET'||f.reported_stage!=='consented'||!day(f.event_date)||!Array.isArray(f.documents)||f.documents.length!==2)throw Error('Unknown fact scope');
  const seen=new Set();for(const d of f.documents){const pin=pins.get(d.url),r=d.source_receipt;if(!pin||seen.has(d.url)||d.publisher!==pin.publisher||d.role!=='government_authority'||d.source_sha256!==pin.sha256||!day(d.published_date)||!day(d.event_date)||d.published_at!==null||r?.source_url!==d.url||r.sha256!==pin.sha256||r.bytes!==pin.bytes||r.http_status!==200||r.retrieved_at!==d.retrieved_at)throw Error('Unreviewed document');seen.add(d.url);}
  const a=payload.approval,reviews=a?.reviews;if(!payload.publishable||payload.review_state!=='NARROW_FACTS_REVIEWED'||payload.notice_count!==1||payload.document_count!==2||a?.state!=='APPROVED_FACTS_ONLY'||a.rights_scope!=='government_html_facts_only_no_images_or_third_party_material'||a.facts_sha256!==factsHash||!Array.isArray(reviews)||reviews.length!==2||new Set(reviews.map(r=>r.role)).size!==2||!reviews.some(r=>r.role==='AGENT_A')||!reviews.some(r=>r.role==='AGENT_B')||reviews.some(r=>r.decision!=='PASS'||!/^https:\/\/github\.com\/Ventusltd\/neural-link-between-agents\/issues\/42#issuecomment-\d+$/.test(r.reference))||reviews[0].reference===reviews[1].reference)throw Error('Independent narrow rights review required');
  return f;
 }catch{return null;}
}

return Object.freeze({factsHash,acceptedNotice});
})();
const ContextPin = {"schema":"gridatlas.journey.official-context.producer-pin.v1","repository":"Ventusltd/globalgrid2050","commit":"07bff3a6d1cdc4d845062cafa1cf49161b135c96","producerState":"SOURCE_PR164_STACKED_UNMERGED_AT_PIN","model":{"bytes":2841,"sha256":"a2ea9cae62e74dc1381482e7f2741bc34d04241103ade3d1232459af57987130","path":"automation/grid_notice_ui/20261117-v938/model.mjs","localPath":"inputs/1333203183eb181a749a11a1e67298d909caddb8/model.mjs"},"artifact":{"bytes":5300,"sha256":"bef90e1a64e4f1921c62f85ee61d636d1fe02fcebd30ea1570a7b3bfd49f5148","path":"automation/grid_notice_ui/20261117-v938/notice.json","localPath":"inputs/1333203183eb181a749a11a1e67298d909caddb8/notice.json","previewPath":"modules/202611171600-official-planning-context.notice.json"},"factsSha256":"f9802c96444c21e84b328d612475353861c8053cde31f55196d1ea5862918afb","reviewReferences":["https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953350836","https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953404444"],"scope":"government_html_facts_only_no_images_or_third_party_material","firstImportedFrom":"1333203183eb181a749a11a1e67298d909caddb8"};
const ContextGeneration = '202611171600';
const ContextCSS = "#gridatlas-gj03 .gj-official-context{border-top:1px dotted #587078;margin-top:8px;padding-top:5px;color:#b6d4d6}#gridatlas-gj03 .gj-official-context summary{color:#0ff;min-height:44px;cursor:pointer}#gridatlas-gj03 .gj-official-context strong{display:block;margin:8px 0;color:#0ff}#gridatlas-gj03 .gj-official-context a{color:#0ff;overflow-wrap:anywhere;display:inline-flex;align-items:center;min-height:44px}#gridatlas-gj03 .gj-official-context a:focus-visible{outline:3px solid #ffd84d;outline-offset:2px}#gridatlas-gj03 .gj-context-caveat{color:#ffd84d}#gridatlas-gj03 .gj-context-source{border-top:1px dotted #587078;margin-top:6px;padding-top:6px}#gridatlas-gj03 .gj-official-context pre{white-space:pre-wrap;overflow-wrap:anywhere}\n";
/** Presentation only. The pinned Pipeline producer consumer owns fact admission. */
function renderOfficialContext({host, document: D, facts, provenance, css = ''}) {
  if (facts) {
    day(facts.event_date);
    if (facts.planned_metric?.kind !== 'planned_transmission_upper_bound' || facts.planned_metric.unit !== 'MW' || !Number.isFinite(facts.planned_metric.value)
        || ['current_capacity_mw', 'commissioned', 'connection', 'repd_ref', 'coordinates'].some(k => facts[k] !== null) || facts.documents?.length !== 2) throw new Error('Unsupported context claim');
    for (const d of facts.documents) { const u = new URL(d.url); if (u.origin !== 'https://www.gov.uk' || u.username || u.password) throw new Error('Non-government context URL'); day(d.published_date); day(d.event_date); for (const value of Object.values(d.milestones || {})) day(value); }
  }
  const node = (tag, text, parent, attrs = {}) => { const e = D.createElement(tag); if (text !== undefined) e.textContent = String(text); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
  const root = node('details', undefined, host, {class: 'gj-official-context', 'data-state': facts ? 'reviewed-facts' : 'withheld'});
  node('style', css, root);
  node('summary', facts ? 'Official planning context · 1 notice' : 'Official planning context · WITHHELD', root);
  if (!facts) {
    node('p', 'Planning context withheld: the pinned source record or its independent narrow fact-rights review is unavailable. Existing Journey and map layers remain separate.', root, {role: 'status'});
  } else {
    node('strong', `${facts.scheme} · ${facts.application_ref}`, root);
    node('p', '1 source-qualified planning notice · 2 government documents. Standalone planning example: no association with the selected map asset is established. These are documentary evidence counts, not counts of network assets or upgrades.', root);
    node('p', `Reported planning stage: ${facts.reported_stage}. Decision: ${day(facts.event_date)}. Reported network operator: ${facts.reported_network_operator}; government publishers are identified separately below.`, root);
    node('p', facts.description, root);
    node('p', `Up to ${facts.planned_metric.value.toLocaleString('en-GB')} ${facts.planned_metric.unit}: planned transmission upper bound. Current capacity, commissioning and available headroom are UNKNOWN.`, root, {class: 'gj-context-caveat'});
    const gaps = node('details', undefined, root);
    node('summary', 'Coverage gaps and boundaries', gaps);
    node('p', 'This notice creates 0 REPD/ETYS/asset joins and supplies 0 accepted real circuit routes or surveyed polylines. Circuit identity, geometry, connection, operating state and coordinates remain WITHHELD or UNKNOWN.', gaps);
    node('p', 'Consent is a planning decision. It does not establish construction, energisation, measured power flow, direction or available connection capacity. UK network coverage is not assessed by this example.', gaps);
    const sources = node('details', undefined, root);
    node('summary', 'Source dates and provenance', sources);
    for (const doc of facts.documents) {
      const article = node('div', undefined, sources, {class: 'gj-context-source'});
      const a = node('a', doc.publisher, article, {target: '_blank', rel: 'noopener noreferrer'});
      const u = new URL(doc.url); if (u.origin !== 'https://www.gov.uk' || u.username || u.password) throw new Error('Non-government context URL');
      a.setAttribute('href', u.href);
      node('p', `Published: ${day(doc.published_date)}. Decision: ${day(doc.event_date)}. Retrieved: ${doc.retrieved_at}. Source update time: UNKNOWN.`, article);
      for (const [name, value] of Object.entries(doc.milestones || {})) node('p', `${name.replaceAll('_', ' ')}: ${day(value)}`, article);
      node('pre', `HTML SHA256 ${doc.source_sha256}\n${doc.source_receipt.bytes} source bytes; document ${doc.source_record_id}`, article);
    }
    node('p', 'Narrow government-authored facts under the stated Open Government Licence v3.0. Images, logos, linked submissions and third-party material are excluded. No document bodies are republished here.', sources);
    const p = node('p', undefined, sources); node('a', 'Open Government Licence v3.0', p, {href: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/', target: '_blank', rel: 'noopener noreferrer'});
    node('pre', `Producer ${provenance.repository}@${provenance.commit}\nArtifact ${provenance.path}\nArtifact SHA256 ${provenance.sha256}\nFact SHA256 ${provenance.factsSha256}`, sources);
  }
  return Object.freeze({element: root, close() { root.open = false; }, destroy() { root.remove(); }});
}

function day(value) {
  if (value?.precision !== 'DAY' || !/^\d{4}-\d{2}-\d{2}$/.test(value.value)) throw new Error('Context date requires day precision');
  return value.value + ' (day precision)';
}

/** Explicit DOM extension contract: append to the public #gridatlas-gj03-panel. */
function createOfficialContextBridge({document: D, window: W, map, container, resolveFacts, cancelPending, render, provenance, css}) {
  if (!container || !W.MutationObserver || !map?.on || !map?.off) throw new Error('Existing native map/container unavailable');
  let alive = true, current = null, host = null, epoch = 0, state = 'waiting-for-journey';
  async function attach() {
    if (!alive) return;
    const target = D.getElementById('gridatlas-gj03-panel');
    if (target === host && current) return;
    ++epoch; current?.destroy(); current = null; host = target;
    if (!host) { state = 'waiting-for-journey'; return; }
    const ticket = epoch;
    try {
      const facts = await resolveFacts();
      if (!alive || epoch !== ticket || !host?.isConnected || host !== target) return;
      current = render({host, document: D, facts, provenance, css}); state = facts ? 'reviewed-facts' : 'withheld';
    } catch {
      if (!alive || epoch !== ticket || !host?.isConnected || host !== target) return;
      current = render({host, document: D, facts: null, provenance, css}); state = 'withheld';
    }
  }
  // Direct children only: Journey root mounting/removal. No document-wide subtree observer.
  const observer = new W.MutationObserver(attach); observer.observe(container, {childList: true});
  function destroy() { if (!alive) return; alive = false; ++epoch; observer.disconnect(); map.off('remove', destroy); cancelPending?.(); current?.destroy(); current = null; host = null; state = 'removed'; }
  map.on('remove', destroy); attach();
  return Object.freeze({close() { current?.close(); }, destroy, snapshot: () => ({alive, state, attached: !!current})});
}

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

})();
