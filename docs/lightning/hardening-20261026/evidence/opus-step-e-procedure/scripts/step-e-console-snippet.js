/* GridAtlas Step E probe (issue #32, fda6b10). READ-ONLY: no clicks, requests or storage writes. Prints one JSON block. */
(()=>{
const W=window,M=W.__GRIDATLAS_MODULES__||{},S=M.ukLightning?M.ukLightning.state:null;
const B=W.__GRIDATLAS_MAP_READY__||{},Q=W.__GRIDATLAS_PLACE_SEARCH__||{},A=W.__GRIDATLAS_ATLAS__||{},map=W.__GRIDATLAS_V9_MAP__;
const all=s=>[...document.querySelectorAll(s)],tx=e=>e?e.textContent.trim():null,hid=e=>!!e.closest('[hidden]');
const iso=v=>typeof v==='number'&&isFinite(v)?new Date(v).toISOString():null;
let L='module absent (baseline route?)';
if(S){
 const r=S.res;L={};
 for(const k in S){const v=S[k];if(v===null||(typeof v!=='object'&&typeof v!=='function'))L[k]=v;}
 Object.assign(L,{
  phase:S.on?'ON':S.requests?'OFF-after-ON':'OFF-never-ON',
  waiting_for:S.waiting_for,errors:S.errors,last:S.last,feed_cached:!!S.fp,
  index:S.idx?{generated_utc:S.idx.raw.generated_utc,cutoff:S.idx.cutoffDate,days:S.idx.days.length}:null,
  res:r?{mode:r.mode,from:iso(r.w.s),to:iso(r.w.e),drawn:(r.ev||[]).length,failed_files:(r.fl||[]).length,fail:r.fail||null}:null,
  surfaces:all('[data-lightning-control]').map(i=>i.closest('[data-lightning-group]').dataset.lightningGroup+'='+i.checked),
  labels:all('[data-lightning-label]').map(tx),
  status:all('[data-lightning-dot]').map(d=>hid(d)?'hidden':tx(d.parentNode)),
  captions:all('[data-lightning-caption]').map(c=>hid(c)?'hidden':[...c.children].map(tx)),
  map_layer:map&&map.getLayer('l-gridatlas-lightning')?map.getLayoutProperty('l-gridatlas-lightning','visibility'):null,
  map_source:!!(map&&map.getSource('gridatlas-lightning'))
 });
}
const st=map&&map.getStyle?map.getStyle():null,g='[data-lightning-group] ';
const out={
 t_utc:new Date().toISOString(),href:location.href,ua:navigator.userAgent,
 viewport:[innerWidth,innerHeight,devicePixelRatio],coarse:matchMedia('(pointer: coarse)').matches,secure:isSecureContext,
 generation:A.generation||null,sld_sha256:((A.loaded_cartridges||[]).find(c=>c.id==='sld-sandbox')||{}).sha256||null,
 menu_inspect:M.menuBar&&M.menuBar.inspect?M.menuBar.inspect():null,
 proxies:all('#gridatlas-menu-bar [data-gridatlas-layer-proxy]').length,
 markers:all('[data-gridatlas-layer-key]').length,
 inputs:[all('input[data-layer-id]').length,all('input[data-pn-layer]').length],
 leak:all([g+'[data-layer-id]',g+'[data-pn-layer]',g+'[data-gridatlas-layer-proxy]',g+'[data-gridatlas-layer-key]'].join()).length,
 fetch_name:W.fetch.name,
 intercepted_on_demand:B.intercepted_on_demand,
 bridge:{failures:B.failures||null,loaded:Object.keys(B.loaded_on_demand||{})},
 search:{ready:Q.ready,failures:(Q.failures||[]).length,geocoder_failures:(Q.geocoder_failures||[]).length},
 style_layers_sources:st?[st.layers.length,Object.keys(st.sources).length]:null,
 lightning:L
};
const j=JSON.stringify(out,null,1);console.log(j);try{copy(j)}catch(e){}return j.length+' chars';
})();
