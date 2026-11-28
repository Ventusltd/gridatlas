/* The field map covers the ordinary dashboard. Keep its Layers button and expose
 * the engine's original, synchronised layer controls above the map. */
(() => {
  const root = document.documentElement;

  function mount() {
    const toggle = document.getElementById('gridatlas-dash-toggle');
    const dashboard = document.querySelector('.scada-wrapper');
    const curtain = document.getElementById('fs-curtain');
    if (!toggle || !dashboard || !curtain || !document.getElementById('satnav-compact')) return false;

    const style = document.createElement('style');
    style.textContent = `
      html.satnav-field-layers body:not(.fs-active) .scada-wrapper { display:none!important }
      html.satnav-field-layers #fs-curtain {
        display:none!important; position:fixed; top:auto; left:auto;
        right:max(8px,env(safe-area-inset-right)); bottom:calc(max(12px,env(safe-area-inset-bottom)) + 52px);
        width:min(380px,calc(100% - max(8px,env(safe-area-inset-left)) - max(8px,env(safe-area-inset-right))));
        max-height:calc(100dvh - max(var(--gridatlas-menu-bar-clear,42px),env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)) - 60px);
        padding:10px 12px; overflow:auto; overscroll-behavior:contain;
        transform:none; transition:none; z-index:10042; border:1px solid #367078; border-radius:6px; background:#081820fa;
      }
      html.satnav-field-layers.satnav-layers-open #fs-curtain { display:block!important }
      html.satnav-field-layers #fs-curtain .key-item { min-height:44px; box-sizing:border-box; align-items:center }
      html.satnav-field-layers #gridatlas-dash-toggle {
        right:max(12px,env(safe-area-inset-right)); bottom:max(12px,env(safe-area-inset-bottom)); min-height:44px; z-index:10043;
      }`;
    document.head.append(style);
    root.classList.add('satnav-field-layers');
    toggle.setAttribute('aria-controls', curtain.id);
    function reflect() {
      const fullscreen = document.fullscreenElement || document.webkitFullscreenElement ||
        document.body.classList.contains('fs-active');
      const open = fullscreen ? curtain.classList.contains('curtain-open') :
        dashboard.dataset.gridatlasCollapsed !== '1';
      root.classList.toggle('satnav-layers-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    const changes = new MutationObserver(reflect);
    changes.observe(dashboard, {attributes:true, attributeFilter:['data-gridatlas-collapsed']});
    changes.observe(curtain, {attributes:true, attributeFilter:['class']});
    changes.observe(document.body, {attributes:true, attributeFilter:['class']});
    document.addEventListener('fullscreenchange', reflect);
    document.addEventListener('webkitfullscreenchange', reflect);
    curtain.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        toggle.click();
        toggle.focus();
      }
    });
    reflect();
    return true;
  }

  if (!mount()) {
    const pending = new MutationObserver(() => { if (mount()) pending.disconnect(); });
    pending.observe(document.documentElement, {childList:true, subtree:true});
  }
})();
