/* Read-only adapter for the selected origin in GridAtlas Vicinity. */
(function () {
  'use strict';
  const reader = 'https://ventusltd.github.io/legislation/legal-evidence/';

  function evidenceUrl(arrival, selectedRef) {
    let url;
    try { url = new URL(arrival); } catch { return null; }
    if (url.origin !== 'https://ventusltd.github.io' || url.username || url.password ||
        !/^\/gridatlas\/atlas\/(?:v\/\d{12}\/)?(?:index\.html)?$/.test(url.pathname)) return null;
    const query = url.searchParams;
    const keys = ['repd_ref','origin_id','origin_type','project','name','technology','capacity_mw','status','latitude','longitude'];
    if (keys.some(key => query.getAll(key).length > 1)) return null;
    const ref = query.get('repd_ref');
    if (!/^[1-9]\d{0,11}$/.test(ref || '') || String(selectedRef) !== ref) return null;
    if ((query.has('origin_type') && query.get('origin_type') !== 'repd') ||
        (query.has('origin_id') && query.get('origin_id') !== 'repd:' + ref)) return null;
    for (const [key, min, max] of [['latitude',49.5,61.5], ['longitude',-11,3]]) {
      const value = query.get(key);
      if (!value?.trim() || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) return null;
    }
    if (Math.abs(Number(query.get('latitude'))-49.766807) < .0001 &&
        Math.abs(Number(query.get('longitude'))+7.55716) < .0001) return null;
    const result = new URL(reader);
    result.searchParams.set('source_app','gridatlas');
    result.searchParams.set('repd_ref',ref);
    const version = /\/atlas\/v\/(\d{12})\//.exec(url.pathname);
    if (version) result.searchParams.set('source_release',version[1]);
    for (const [key,value,limit] of [['project',query.get('project') || query.get('name'),180],
      ['technology',query.get('technology'),80],['status',query.get('status'),80]]) {
      if (value?.trim()) result.searchParams.set(key,value.trim().slice(0,limit));
    }
    const mw = query.get('capacity_mw');
    if (mw?.trim() && Number.isFinite(Number(mw)) && Number(mw) > 0) result.searchParams.set('mw',String(Number(mw)));
    return result.href;
  }

  function render(card, arrival) {
    const box = card?.__vicFocus?.box;
    if (!box) return;
    const anchor = box.querySelector('[data-legislation-evidence]');
    const href = card.isConnected && card.project && card.__vicFocus.origin
      ? evidenceUrl(arrival, card.r?.p?.repd_ref) : null;
    if (!href) { anchor?.remove(); return; }
    if (anchor?.href === href) return;
    const link = anchor || box.ownerDocument.createElement('a');
    link.href = href;
    link.textContent = 'Legal evidence';
    link.dataset.legislationEvidence = '';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (!anchor) box.appendChild(link);
  }

  if (typeof module === 'object' && module.exports) module.exports = {evidenceUrl, render};
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let active, observer;
  function sync() {
    const card = window.__GRIDATLAS_MODULES__?.ukOfftakers?.state?.pp;
    if (active !== card) {
      observer?.disconnect();
      active = card;
      if (active) {
        observer = new MutationObserver(() => render(active,window.location.href));
        observer.observe(active,{subtree:true,childList:true});
      }
    }
    render(active,window.location.href);
  }
  // The focus cartridge changes this attribute as the project card opens/closes.
  const focus = new MutationObserver(sync);
  focus.observe(document.documentElement,{attributes:true,attributeFilter:['data-vicinity-focus']});
  window.addEventListener('pagehide',() => { focus.disconnect(); observer?.disconnect(); },{once:true});
  sync();
})();
