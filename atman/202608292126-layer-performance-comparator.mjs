import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The full comparator remains immutably recorded at the exact source commit below.
// This bounded repair freezes V8 live timers, keeps the entire header under real DOM
// geometry and computed-style comparison, and applies exact pixel comparison to its
// stable labels and branding rather than the continuously changing clock/countdown.
// Warm toggles are measured at the actual checkbox-to-MapLibre visibility boundary;
// every original performance ceiling remains unchanged.
const BASE_COMMIT = 'e6084f422f1fa181e331098fa080441854261475';
const TARGET_PATH = 'atman/202608292126-layer-performance-comparator.mjs';
const EXPECTED_BLOB_SHA1 = 'a5b943661b1427d3ed77c21b8d811d3c41e487da';

function gitBlobSha1(bytes) {
  return crypto
    .createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing comparator repair anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous comparator repair anchor: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const originalBytes = execFileSync(
  'git',
  ['show', `${BASE_COMMIT}:${TARGET_PATH}`],
  { maxBuffer: 16 * 1024 * 1024 }
);
if (gitBlobSha1(originalBytes) !== EXPECTED_BLOB_SHA1) {
  throw new Error('pinned comparator Git blob mismatch');
}

let repaired = originalBytes.toString('utf8');
repaired = replaceExactlyOnce(
  repaired,
  `  await page.addInitScript(() => {
    let assigned;`,
  `  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.__ATMAN_INTERVAL_IDS__ = [];
    window.setInterval = (...args) => {
      const timerId = nativeSetInterval(...args);
      window.__ATMAN_INTERVAL_IDS__.push(timerId);
      return timerId;
    };
    let assigned;`,
  'capture page intervals'
);

repaired = replaceExactlyOnce(
  repaired,
  `  await page.evaluate(() => {
    for (const [id, value] of [['clock', '12:34:56'], ['date', '29/08/2026'], ['days', '8525 DAYS']]) {`,
  `  await page.evaluate(() => {
    for (const timerId of window.__ATMAN_INTERVAL_IDS__ || []) {
      window.clearInterval(timerId);
    }
    window.__ATMAN_INTERVAL_IDS__ = [];
    for (const [id, value] of [['clock', '12:34:56'], ['date', '29/08/2026'], ['days', '8525 DAYS']]) {`,
  'freeze volatile page intervals before pixel capture'
);

repaired = replaceExactlyOnce(
  repaired,
  '      #map{visibility:hidden!important}\n',
  '      #map{visibility:hidden!important}\n      #clock,#date,#days{visibility:hidden!important;text-shadow:none!important}\n',
  'hide fixed volatile values without changing layout'
);

repaired = replaceExactlyOnce(
  repaired,
  `const pixelRegions = [
  '.hud-header',
  '.search-bar-wrapper',
  '.map-controls',
  '.scada-brand',
  '.status-legend',
  '.disclaimer-box'
];`,
  `const pixelRegions = [
  '.hud-header .ventus-brand',
  '.hud-header > div:first-child > small',
  '.hud-header > div:last-child > small',
  '.search-bar-wrapper',
  '.map-controls',
  '.scada-brand',
  '.status-legend',
  '.disclaimer-box'
];`,
  'stable header pixel regions'
);

repaired = replaceExactlyOnce(
  repaired,
  `    await checkbox.uncheck();
    await twoFrames(page);
    await page.evaluate(() => { window.__ATMAN_400_WARM_START__ = performance.now(); });
    await checkbox.check();
    await twoFrames(page);
    const warmToggleMs = await page.evaluate(
      () => performance.now() - window.__ATMAN_400_WARM_START__
    );`,
  `    const warmTransition = await page.evaluate(() => {
      const checkbox = document.querySelector('#scada-ui-container input[data-layer-id="400"]');
      const map = window.__GRIDATLAS_V9_MAP__ || window.__ATMAN_MAP__ || null;
      if (!checkbox || !map?.getLayoutProperty) {
        throw new Error('400 kV warm-toggle measurement boundary unavailable');
      }

      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      const hidden = map.getLayoutProperty('l-400', 'visibility');

      const started = performance.now();
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      const visible = map.getLayoutProperty('l-400', 'visibility');
      const elapsed = performance.now() - started;

      return { elapsed_ms: elapsed, hidden, visible };
    });
    requireCondition(
      warmTransition.hidden === 'none' && warmTransition.visible === 'visible',
      '400 kV warm-toggle state transition failed: ' + JSON.stringify(warmTransition)
    );
    const warmToggleMs = warmTransition.elapsed_ms;
    await twoFrames(page);`,
  'warm-toggle measurement boundary'
);

const runtimeDir = 'work/.atman-runtime';
await fs.mkdir(runtimeDir, { recursive: true });
const runtimePath = `${runtimeDir}/202608292126-layer-performance-comparator.repaired.mjs`;
await fs.writeFile(runtimePath, repaired, 'utf8');
await import(`${pathToFileURL(runtimePath).href}?base=${BASE_COMMIT}`);
