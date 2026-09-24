/** Keep ordinary feature cards clear of the fixed search/menu controls.
 * Project cards have their own draggable bar and mobile sheet; preserve it.
 */
(() => {
  let queued = false;
  const ordinaryStyles = new WeakMap();
  function fit() {
    queued = false;
    const container = window.__GRIDATLAS_V9_MAP__?.getContainer();
    if (!container) return;
    const map = container.getBoundingClientRect();
    const menu = document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect();
    const search = document.querySelector('.search-bar-wrapper')?.getBoundingClientRect();
    for (const popup of container.querySelectorAll('.maplibregl-popup')) {
      const content = popup.querySelector('.maplibregl-popup-content');
      const close = popup.querySelector('.maplibregl-popup-close-button');
      if (!content || !close) continue;
      if (popup.querySelector('.gridatlas-card-bar') || popup.classList.contains('gridatlas-sheet')) {
        // Arrival cards gain their project bar asynchronously. Give back only
        // styles we still own; do not leave a second decorated close button or
        // an extra 44px header above the project's own controls.
        for (const saved of ordinaryStyles.get(content) || []) {
          if (saved.element.style.getPropertyValue(saved.property) === saved.written) {
            if (saved.previous) saved.element.style.setProperty(saved.property, saved.previous, saved.priority);
            else saved.element.style.removeProperty(saved.property);
          }
        }
        ordinaryStyles.delete(content);
        continue;
      }
      if (!ordinaryStyles.has(content)) {
        ordinaryStyles.set(content, [
          ...['min-width', 'min-height', 'color', 'background', 'border'].map(property => ({element: close, property})),
          {element: content, property: 'padding-top'}
        ].map(saved => ({...saved, previous: saved.element.style.getPropertyValue(saved.property),
          priority: saved.element.style.getPropertyPriority(saved.property)})));
      }
      // A normal feature popup's close control otherwise measures only 20px.
      close.style.minWidth = '44px';
      close.style.minHeight = '44px';
      close.style.color = '#bfe9ee';
      close.style.background = '#0a1a1d';
      close.style.border = '1px solid #2f6f75';
      content.style.paddingTop = '44px';
      for (const saved of ordinaryStyles.get(content)) saved.written = saved.element.style.getPropertyValue(saved.property);
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
