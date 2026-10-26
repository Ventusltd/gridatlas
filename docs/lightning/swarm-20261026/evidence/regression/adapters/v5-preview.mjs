/**
 * Adapter for the REJECTED V5 preview (atlas/preview/lightning/) — exists so the
 * lightning-cases harness can be exercised today and so the candidate's adapter has
 * a worked example. Every function receives the Playwright page after the composition
 * booted (map + menuBar.installed + >=60 proxies).
 */
export default {
  name: 'v5-preview',
  async ready(page) { await page.waitForFunction(() => window.__GRIDATLAS_WEATHER_LIGHTNING__?.installed === true, null, { timeout: 30000 }); },
  /** Switch lightning ON the way a reader does: the native Layers panel checkbox (desktop panel is open by default; on a phone open it with the LAYERS toggle first). */
  async turnOn(page) {
    const wrapper = page.locator('.scada-wrapper');
    if (await wrapper.getAttribute('data-gridatlas-collapsed') === '1') await page.locator('#gridatlas-dash-toggle').click();
    const native = page.locator('#scada-ui-container input[data-weather-layer="uk_lightning"]');
    await native.scrollIntoViewIfNeeded();
    await native.click();
  },
  /** Resolve when the status word leaves WAIT/LOAD. */
  async waitTerminal(page, timeoutMs) { await page.waitForFunction(() => !/\[(WAIT|LOAD)\]/.test(document.getElementById('lbl-uk_lightning')?.textContent || ''), null, { timeout: timeoutMs }); },
  async readState(page) {
    return page.evaluate(() => {
      const map = window.__GRIDATLAS_V9_MAP__; const st = window.__GRIDATLAS_WEATHER_LIGHTNING__ || {};
      let features = null, visible = null, rendered = null;
      try { features = map.getSource('src-uk_lightning')?._data?.features?.length ?? null; visible = map.getLayoutProperty('l-uk_lightning', 'visibility'); rendered = map.queryRenderedFeatures({ layers: ['l-uk_lightning'] }).length; } catch { }
      return { label: document.getElementById('lbl-uk_lightning')?.textContent || '', status: st.status, errors: st.errors, latest_utc: st.latest_utc ?? null, feed_status: st.feed_status ?? null, features, visible, rendered, checked: document.querySelector('#scada-ui-container input[data-weather-layer="uk_lightning"]')?.checked ?? null };
    });
  }
  // selectWindow(page, startIso, endIso) is deliberately absent: V5 has no date window.
  // The candidate adapter must return { perDay: { 'YYYY-MM-DD': 0 | 'UNKNOWN' | n }, total, message }.
};
