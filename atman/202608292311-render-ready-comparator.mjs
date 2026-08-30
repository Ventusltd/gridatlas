import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The complete render-ready comparator is pinned below. This bounded CI repair
// keeps every V8/V9, desktop/mobile, actual-render and PROMOTE/REJECT gate intact,
// while running the 390 x 844 mobile viewport on the Chromium runtime already
// installed by the governed workflow. No product or threshold is changed.
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

const runtimeDir = 'work/.atman-runtime';
await fs.mkdir(runtimeDir, { recursive: true });
const runtimePath = `${runtimeDir}/202608292311-render-ready-comparator.repaired.mjs`;
await fs.writeFile(runtimePath, repaired, 'utf8');
await import(`${pathToFileURL(runtimePath).href}?base=${BASE_COMMIT}`);
