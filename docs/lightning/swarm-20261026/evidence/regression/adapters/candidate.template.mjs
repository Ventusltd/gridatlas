/**
 * TEMPLATE adapter for the lightning CANDIDATE — copy, fill in, and pass with --adapter.
 * Keep the four required functions; add selectWindow() when the candidate has a date window.
 * Do not use force:true clicks: a hit that needs force is a hit-target failure, not a pass.
 */
export default {
  name: 'candidate',
  async ready(page) { /* wait for the candidate's own installed sentinel */ await page.waitForFunction(() => true); },
  async turnOn(page) { /* click the REAL control a reader uses, in #scada-ui-container (open the LAYERS toggle first on a phone) */ throw new Error('candidate adapter: turnOn not implemented'); },
  async waitTerminal(page, timeoutMs) { /* resolve when the label leaves its loading state */ throw new Error('candidate adapter: waitTerminal not implemented'); },
  async readState(page) { /* return { label, status, features, visible, rendered, checked, latest_utc } */ throw new Error('candidate adapter: readState not implemented'); },
  async selectWindow(page, startIso, endIso) { /* drive the date window; return { perDay: { 'YYYY-MM-DD': 0 | 'UNKNOWN' | n }, total, message } */ throw new Error('candidate adapter: selectWindow not implemented'); }
};
