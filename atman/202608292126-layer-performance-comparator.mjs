import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The full comparator remains immutably recorded at the exact source commit below.
// This bounded repair restores the volatile-header masking rule from the earlier
// green V8 product-mirror proof; every byte, DOM, geometry, style, interaction,
// architecture and performance gate remains active.
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
  `const pixelRegions = [
  '.hud-header',
  '.search-bar-wrapper',
  '.map-controls',
  '.scada-brand',
  '.status-legend',
  '.disclaimer-box'
];`,
  `const pixelRegions = [
  { selector: '.hud-header', masks: ['#clock', '#date', '#days'] },
  { selector: '.search-bar-wrapper', masks: [] },
  { selector: '.map-controls', masks: [] },
  { selector: '.scada-brand', masks: [] },
  { selector: '.status-legend', masks: [] },
  { selector: '.disclaimer-box', masks: [] }
];`,
  'pixel region contract'
);

repaired = replaceExactlyOnce(
  repaired,
  `    for (const selector of pixelRegions) {
      const [left, right] = await Promise.all([
        oraclePage.locator(selector).screenshot({ animations: 'disabled' }),
        candidatePage.locator(selector).screenshot({ animations: 'disabled' })
      ]);
      pixels[selector] = decodedPixelProof(left, right, selector);
    }`,
  `    for (const region of pixelRegions) {
      const [left, right] = await Promise.all([
        oraclePage.locator(region.selector).screenshot({
          animations: 'disabled',
          mask: region.masks.map(selector => oraclePage.locator(selector)),
          maskColor: '#000000'
        }),
        candidatePage.locator(region.selector).screenshot({
          animations: 'disabled',
          mask: region.masks.map(selector => candidatePage.locator(selector)),
          maskColor: '#000000'
        })
      ]);
      pixels[region.selector] = {
        ...decodedPixelProof(left, right, region.selector),
        masks: region.masks,
        volatile_live_clock_masked: region.selector === '.hud-header'
      };
    }`,
  'decoded pixel loop'
);

const runtimeDir = 'work/.atman-runtime';
await fs.mkdir(runtimeDir, { recursive: true });
const runtimePath = `${runtimeDir}/202608292126-layer-performance-comparator.repaired.mjs`;
await fs.writeFile(runtimePath, repaired, 'utf8');
await import(`${pathToFileURL(runtimePath).href}?base=${BASE_COMMIT}`);
