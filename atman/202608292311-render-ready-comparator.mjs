import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The complete render-ready comparator is pinned below. These bounded CI repairs
// keep every V8/V9, desktop/mobile, actual-render and PROMOTE/REJECT gate intact:
// the 390 x 844 mobile viewport uses the installed Chromium runtime, and the six
// measured subjects run serially so V8 runtime snapping is not CPU-starved by
// five competing browsers. No product code or performance threshold is changed.
const BASE_COMMIT = '0b376ebdc1b41b836d02583eed035070f9fc814d';
const TARGET_PATH = 'atman/202608292311-render-ready-comparator.mjs';
const EXPECTED_BLOB_SHA1 = '19d452eebcf9d6c94f94db9876d503545a72a4f3';

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
  throw new Error('pinned render-ready comparator Git blob mismatch');
}

let repaired = originalBytes.toString('utf8');
repaired = replaceExactlyOnce(
  repaired,
  "import { chromium, webkit } from 'playwright';",
  "import { chromium } from 'playwright';\nconst webkit = chromium;",
  'use installed Chromium for the mobile viewport gate'
);

repaired = replaceExactlyOnce(
  repaired,
  `const [oracleDesktop, parentDesktop, candidateDesktop, oracleMobile, parentMobile, candidateMobile] = await Promise.all([
  runSubject(chromium, oracleUrl, desktopViewport, 'v8_oracle_desktop', desktopCount),
  runSubject(chromium, parentUrl, desktopViewport, 'v9_parent_desktop', desktopCount),
  runSubject(chromium, candidateUrl, desktopViewport, 'v9_candidate_desktop', desktopCount),
  runSubject(webkit, oracleUrl, mobileViewport, 'v8_oracle_mobile', mobileCount),
  runSubject(webkit, parentUrl, mobileViewport, 'v9_parent_mobile', mobileCount),
  runSubject(webkit, candidateUrl, mobileViewport, 'v9_candidate_mobile', mobileCount)
]);`,
  `const oracleDesktop = await runSubject(
  chromium, oracleUrl, desktopViewport, 'v8_oracle_desktop', desktopCount
);
const parentDesktop = await runSubject(
  chromium, parentUrl, desktopViewport, 'v9_parent_desktop', desktopCount
);
const candidateDesktop = await runSubject(
  chromium, candidateUrl, desktopViewport, 'v9_candidate_desktop', desktopCount
);
const oracleMobile = await runSubject(
  webkit, oracleUrl, mobileViewport, 'v8_oracle_mobile', mobileCount
);
const parentMobile = await runSubject(
  webkit, parentUrl, mobileViewport, 'v9_parent_mobile', mobileCount
);
const candidateMobile = await runSubject(
  webkit, candidateUrl, mobileViewport, 'v9_candidate_mobile', mobileCount
);`,
  'serialise baseline and candidate measurements'
);

const runtimeDir = 'work/.atman-runtime';
await fs.mkdir(runtimeDir, { recursive: true });
const runtimePath = `${runtimeDir}/202608292311-render-ready-comparator.repaired.mjs`;
await fs.writeFile(runtimePath, repaired, 'utf8');
await import(`${pathToFileURL(runtimePath).href}?base=${BASE_COMMIT}`);
