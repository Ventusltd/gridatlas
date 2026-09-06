/* Measurement labels occupy a separate layout area, never the drawing canvas. */
(() => {
  const registry = window.__GRIDATLAS_MODULES__ ||= {};
  let state = null;
  function close() {
    if (!state) return;
    const {map, host, rail, control, marker, style} = state;
    state = null;
    marker.replaceWith(control);
    rail.remove(); style.remove();
    host.removeAttribute('data-measurement-dock');
    document.body.removeAttribute('data-measurement-dock');
    map.resize();
  }
  function open(map, controlId) {
    if (state?.control.id === controlId) return;
    close();
    const canvas = map.getContainer();
    const host = canvas.parentElement;
    const control = document.getElementById(controlId);
    if (!control || !host) throw Error('Measurement dock requires its existing control and map host');
    const marker = document.createComment('measurement control home');
    control.before(marker);
    const rail = document.createElement('aside');
    rail.id = 'gridatlas-measurement-dock';
    rail.setAttribute('aria-label', 'Shape measurements and controls');
    const controls = document.createElement('div');
    controls.className = 'measurement-dock-controls';
    controls.append(control);
    const values = document.createElement('div');
    values.className = 'measurement-dock-values';
    rail.append(controls, values);
    const style = document.createElement('style');
    style.textContent = `
#map-container[data-measurement-dock] #map{width:calc(100% - 280px)!important;margin-left:280px!important}
#gridatlas-measurement-dock{position:absolute;left:0;top:64px;bottom:0;width:280px;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background:#080b10;border-right:1px solid #58646d;color:#fff;z-index:1100;padding:10px;font:12px/1.4 ui-monospace,monospace}
#gridatlas-measurement-dock .radius-popup{position:static!important;transform:none!important;margin:0 0 10px!important;width:auto!important;min-width:0!important;max-width:100%!important;box-sizing:border-box}
#gridatlas-measurement-dock .measurement-dock-values>div{min-width:0!important;box-sizing:border-box;max-width:100%}
#gridatlas-measurement-dock button,#gridatlas-measurement-dock input{min-height:36px}
body[data-measurement-dock] #codex-tool-layers{visibility:hidden!important;pointer-events:none!important}
@media(max-width:700px){
 #map-container[data-measurement-dock] #map{width:100%!important;margin-left:0!important;height:calc(100% - min(240px,38dvh))!important}
 #gridatlas-measurement-dock{top:auto;right:0;width:100%;height:min(240px,38dvh);border-right:0;border-top:1px solid #58646d;padding:8px 12px;display:grid;grid-template-columns:minmax(110px,0.8fr) minmax(180px,1.4fr);gap:8px;z-index:1100}
 #gridatlas-measurement-dock .measurement-dock-values>div{padding:6px!important}
 #gridatlas-measurement-dock .radius-popup{padding:6px!important}
 #gridatlas-measurement-dock .radius-input-row{flex-wrap:wrap}
}
@media(max-width:350px){#gridatlas-measurement-dock{grid-template-columns:1fr}}
`;
    document.head.append(style);
    host.append(rail);
    host.setAttribute('data-measurement-dock', controlId);
    document.body.setAttribute('data-measurement-dock', controlId);
    state = {map, host, rail, control, marker, style, values};
    map.resize();
  }
  function show(html) {
    if (!state) throw Error('Open measurement controls before showing results');
    const scroll = state.rail.scrollTop;
    state.values.innerHTML = html;
    state.rail.scrollTop = scroll;
  }
  function clearValues() {if (state) state.values.replaceChildren();}
  registry.measurementDock = Object.freeze({schema:'gridatlas.measurement-dock.v1',open,show,close,clearValues});
})();
