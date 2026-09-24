/** Keep ordinary feature cards clear of the fixed search/menu controls.
 * Project cards have their own draggable bar and mobile sheet; preserve it.
 */
(() => {
  let queued = false;
  function fit() {
    queued = false;
    const container = window.__GRIDATLAS_V9_MAP__?.getContainer();
    if (!container) return;
    const map = container.getBoundingClientRect();
    const menu = document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect();
    const search = document.querySelector('.search-bar-wrapper')?.getBoundingClientRect();
    for (const popup of container.querySelectorAll('.maplibregl-popup')) {
      if (popup.querySelector('.gridatlas-card-bar') || popup.classList.contains('gridatlas-sheet')) continue;
      const content = popup.querySelector('.maplibregl-popup-content');
      const close = popup.querySelector('.maplibregl-popup-close-button');
      if (!content || !close) continue;
      // A normal feature popup's close control otherwise measures only 20px.
      close.style.minWidth = '44px';
      close.style.minHeight = '44px';
      close.style.color = '#bfe9ee';
      close.style.background = '#0a1a1d';
      close.style.border = '1px solid #2f6f75';
      content.style.paddingTop = '44px';
      const top = Math.max(map.top, menu?.bottom || 0, search?.bottom || 0) + 8;
      const bottom = Math.min(map.bottom, window.innerHeight) - 8;
      content.style.setProperty('max-height', Math.max(44, bottom - top - 20) + 'px', 'important');
      const rect = popup.getBoundingClientRect();
      const left = Math.max(map.left + 8, Math.min(rect.left, map.right - rect.width - 8));
      const y = Math.max(top, Math.min(rect.top, bottom - rect.height));
      if (rect.top < top || rect.bottom > bottom || rect.left < map.left || rect.right > map.right) {
        popup.classList.add('gridatlas-free');
        popup.style.setProperty('--gx', left + 'px');
        popup.style.setProperty('--gy', y + 'px');
      }
    }
  }
  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(fit); }
  }
  // Observe content insertion, not our own style writes.
  new MutationObserver(schedule).observe(document.documentElement, {childList: true, subtree: true});
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  schedule();
})();
