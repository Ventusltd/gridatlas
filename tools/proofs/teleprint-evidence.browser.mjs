/**
 * FIFTY CHROME SESSIONS, THROUGH OUR OWN APP.
 * ---------------------------------------------------------------------------
 * "You must record evidence via at least 50 chrome sessions 25 for print
 *  source code feature and 25 for print pdf feature via our app NOT CHROME or
 *  any other browser."
 *
 * So: 25 sessions that press "Print source code" and 25 that press "Print PDF",
 * each in a FRESH Chrome that is closed before the next one starts, each on a
 * different scenario -- viewport, orientation, layer selection, deep link. The
 * evidence is the FILE THE APP PRODUCED, read back off disk and measured, not a
 * screenshot of a button and not a claim in a log.
 *
 * WHAT "VIA OUR APP" MEANS HERE, PRECISELY. Nothing presses Ctrl+P and nothing
 * calls the browser's own print-to-PDF. The runner clicks the controls the
 * reader clicks, in the File menu, and the bytes are written by our own PDF
 * writer and our own source collector. The one browser facility used is
 * getDisplayMedia, because a page cannot photograph its own compositor without
 * it -- and that is the same call the reader's own press makes. Chrome is
 * launched with --auto-accept-this-tab-capture so the chooser does not need a
 * human hand; the code path underneath is the reader's, unchanged.
 *
 * WHERE THE EVIDENCE GOES. Everything heavy -- PDFs, text files, screenshots --
 * is written under the offline directory and NEVER into git:
 *   "All evidence that is data heavey for testing most be offline"
 *   "github must received only tested source code"
 * Git gets this runner and the JSON summary of what it measured.
 *
 * WHAT A GREEN RUN DOES NOT PROVE. Every session here is desktop Chrome driving
 * an emulated viewport. It is not an iPhone, and the phone paths -- the native
 * share sheet, iOS Safari's handling of a[download] -- are not exercised by it.
 * That distinction is recorded in the summary rather than glossed.
 *
 *   node tools/proofs/teleprint-evidence.browser.mjs <base-url> <out-dir> [--sessions 50]
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2];
const OUT = process.argv[3];
if (!BASE || !OUT) {
  console.error('usage: node teleprint-evidence.browser.mjs <base-url> <out-dir> [--sessions N]');
  process.exit(2);
}
const sessionsArg = process.argv.indexOf('--sessions');
const TOTAL = sessionsArg > 0 ? Number(process.argv[sessionsArg + 1]) : 50;

/* Geometry and content are varied together so that a defect that only appears
   in one shape is not hidden by twenty-four runs in another. Portrait and
   landscape, phone through ultrawide, with and without a selected project. */
const GEOMETRIES = [
  { name: 'phone-portrait', width: 393, height: 852, dpr: 3 },
  { name: 'phone-landscape', width: 852, height: 393, dpr: 3 },
  { name: 'ipad-portrait', width: 834, height: 1112, dpr: 2 },
  { name: 'desktop', width: 1400, height: 900, dpr: 1 },
  { name: 'ultrawide', width: 2327, height: 1156, dpr: 1 }
];
const DEEP_LINKS = [
  '',
  '?repd_ref=2484&technology=wind_offshore',
  '?repd_ref=18790&technology=bess',
  '?technology=solar',
  '?technology=wind_onshore'
];
const LAYER_SETS = [[], ['400'], ['400', '275'], ['400', '275', '132'], ['400', '275', '132', '66']];

function scenario(index) {
  const geometry = GEOMETRIES[index % GEOMETRIES.length];
  const link = DEEP_LINKS[index % DEEP_LINKS.length];
  const layers = LAYER_SETS[index % LAYER_SETS.length];
  return { geometry, link, layers };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/* A PDF is inspected structurally rather than trusted. Every one of these can
   fail on a real defect: a truncated writer, a blank capture, a page that is
   not the size of the capture, furniture painted over the record. */
function inspectPdf(buffer, expect) {
  const head = buffer.subarray(0, 9).toString('latin1');
  const tail = buffer.subarray(-32).toString('latin1');
  const text = buffer.toString('latin1');
  const media = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const width = media ? Number(media[1]) : null;
  const height = media ? Number(media[2]) : null;
  const imageMatch = text.match(/\/Subtype\s*\/Image[^>]*?\/Width\s+(\d+)[^>]*?\/Height\s+(\d+)/);
  return {
    startsPdf: head.startsWith('%PDF-'),
    endsEof: tail.includes('%%EOF'),
    flate: text.includes('/FlateDecode'),
    deviceRgb: text.includes('/DeviceRGB'),
    pageWidth: width,
    pageHeight: height,
    imageWidth: imageMatch ? Number(imageMatch[1]) : null,
    imageHeight: imageMatch ? Number(imageMatch[2]) : null,
    /* The page must be exactly the capture's width, and TALLER than it by the
       provenance strip -- never shorter (that is a crop) and never equal (that
       means the strip is painted on the record). */
    widthMatchesCapture: !!(imageMatch && width === Number(imageMatch[1])),
    stripOutsideImage: !!(imageMatch && height > Number(imageMatch[2])),
    /* THE CHECK THAT WAS MISSING, AND IT MATTERED.
       widthMatchesCapture compares the PDF PAGE to the IMAGE INSIDE IT. Those
       are equal by construction, so it passes even when the capture holds a
       fraction of the screen -- and it did: a 393x852 viewport at dpr 3 is
       1179x2556 real pixels, and an unconstrained getDisplayMedia returned
       786x1704. The receipt said "1:1"; the file held 44% of the screen. The
       only honest comparison is against the READER'S OWN PIXELS. */
    screenPixelWidth: expect ? Math.round(expect.width * expect.dpr) : null,
    capturedEveryScreenPixel: !!(imageMatch && expect
      && Number(imageMatch[1]) >= Math.round(expect.width * expect.dpr)),
    captureScale: (imageMatch && expect)
      ? Number(imageMatch[1]) / Math.round(expect.width * expect.dpr) : null,
    bytes: buffer.length,
    expect
  };
}

function inspectSource(text) {
  const files = (text.match(/^FILE: /gm) || []).length;
  const notRead = (text.match(/^NOT READ -- (\d+)/m) || [])[1];
  let state = null;
  const block = text.match(/THE SCREEN THIS CAME FROM\n=+\n([\s\S]*?)\n=+\nCONTENTS/);
  if (block) { try { state = JSON.parse(block[1]); } catch (_) { state = null; } }
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    header: text.startsWith('====='),
    marksTeleprint: text.includes('TELEPRINT OF THE SOURCE CODE'),
    files,
    /* A source print with no cartridge in it is not a print of THIS app. */
    carriesCartridge: /substation-intelligence/.test(text),
    carriesLivePage: text.includes('THE LIVE PAGE AS IT STOOD'),
    /* `|| true` was here. A check that cannot fail is worse than no check:
       it reports green forever and reads, to anyone scanning the summary, as
       evidence that gaps are declared. An independent review of the offline
       evidence caught it. */
    declaresGaps: text.includes('NOT READ') || text.includes('NOT READ: none'),
    notReadCount: notRead ? Number(notRead) : 0,
    state
  };
}

await ensureDir(OUT);
const results = [];
let pdfSessions = 0;
let sourceSessions = 0;

for (let index = 0; index < TOTAL; index += 1) {
  /* Alternating rather than 25 then 25: if something degrades over a long run
     -- a leak, a server slowing down -- alternating spreads it across both
     features instead of loading it entirely onto the second. */
  const mode = index % 2 === 0 ? 'pdf' : 'source';
  if (mode === 'pdf') pdfSessions += 1; else sourceSessions += 1;
  const spec = scenario(index);
  const label = `${String(index + 1).padStart(2, '0')}-${mode}-${spec.geometry.name}`;
  const record = { index: index + 1, mode, label, geometry: spec.geometry.name, link: spec.link, ok: false };

  /* A FRESH BROWSER PER SESSION, closed in finally.
     "close used sessions to free up ram" -- and equally, a reused profile
     carries a warm cache and a granted permission into the next run, which
     would make session 50 prove less than session 1. */
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: [
      '--auto-accept-this-tab-capture',
      '--auto-select-desktop-capture-source=Entire screen',
      '--allow-http-screen-capture'
    ]
  });
  try {
    const context = await browser.newContext({
      viewport: { width: spec.geometry.width, height: spec.geometry.height },
      deviceScaleFactor: spec.geometry.dpr,
      acceptDownloads: true,
      permissions: []
    });
    const page = await context.newPage();
    const url = BASE + spec.link;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('#gridatlas-menu-bar').waitFor({ timeout: 90000 });
    /* state:'attached', not the default 'visible'. Both controls live inside
       the File panel, which is hidden until the reader opens File -- so a
       visibility wait times out on a perfectly healthy page. That cost two
       failed smoke sessions and the failure looked like a missing feature. */
    await page.locator('#gridatlas-teleprint-source').waitFor({ state: 'attached', timeout: 60000 });

    /* Turn layers on through their own controls, so the state the print
       records is a state a reader could actually have produced. */
    for (const key of spec.layers) {
      const box = page.locator(`input[type=checkbox]`).filter({ hasNotText: '' });
      void box;
      await page.evaluate((voltage) => {
        const nodes = Array.from(document.querySelectorAll('input[type=checkbox]'));
        const hit = nodes.find(node => {
          const label = node.closest('label') || node.parentElement;
          return label && new RegExp(`\\b${voltage}kV\\b`, 'i').test(label.textContent || '');
        });
        if (hit && !hit.checked) hit.click();
      }, key);
    }
    await page.waitForTimeout(600);

    /* Open File exactly as a reader does -- this is also what starts the
       source preparation, so skipping it would test a path readers never
       take. */
    await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll('.gm-title'))
        .find(node => /file/i.test(node.textContent || ''));
      if (title) title.click();
    });
    await page.waitForTimeout(400);

    const downloadWait = page.waitForEvent('download', { timeout: 120000 });
    await page.evaluate((which) => {
      const id = which === 'pdf' ? 'gridatlas-teleprint-pdf' : 'gridatlas-teleprint-source';
      const node = document.getElementById(id);
      if (node) node.click();
    }, mode);

    const download = await downloadWait;
    const target = path.join(OUT, `${label}${mode === 'pdf' ? '.pdf' : '.txt'}`);
    await download.saveAs(target);
    const buffer = await fs.readFile(target);

    record.file = target;
    record.bytes = buffer.length;
    if (mode === 'pdf') {
      record.pdf = inspectPdf(buffer, spec.geometry);
      /* TWO DIFFERENT QUESTIONS, KEPT APART.
         `ok` asks whether the ENGINE did its job: a real PDF, one page unit
         per captured pixel, the provenance strip outside the record.
         `capturedEveryScreenPixel` asks what the BROWSER was willing to hand
         over, which is not the engine's to control.

         Measured on 2026-09-05 at generation 202609051556: an iPad viewport at
         devicePixelRatio 2 captured 1668x2224 -- every pixel on the screen. A
         phone viewport at devicePixelRatio 3 captured 786x1704 of 1179x2556,
         because Chrome's tab capture tops out at 2x. Failing the whole session
         on that would mark the engine broken for a platform ceiling, and a
         check that is permanently red is a check people learn to ignore.

         So the shortfall is COUNTED and printed in the summary rather than
         hidden, and the receipt on the reader's own sheet states the fraction.
         What is never allowed is calling a reduced capture "1:1". */
      record.ok = record.pdf.startsPdf && record.pdf.endsEof && record.pdf.flate
        && record.pdf.widthMatchesCapture && record.pdf.stripOutsideImage;
    } else {
      record.source = inspectSource(buffer.toString('utf8'));
      record.ok = record.source.marksTeleprint && record.source.files > 0
        && record.source.carriesCartridge && record.source.bytes > 20000
        /* NO UPPER SIZE CHECK, DELIBERATELY. One was here, at 8 MB, on the
           reasoning that a teleprint too large to upload has failed at its
           job. The architect overruled it: "a printer prints what it's given
           it doesn't rely on human induced limits and it's a digital printer
           that doesn't run out of paper 2MB is nothing for vital evidence like
           that". A chat's upload limit is the chat's constraint. The size is
           still RECORDED on every run, so a sudden jump is visible. */
        ;
    }

    /* One screenshot per session, offline, so a human can see what the app
       looked like when the file was produced. */
    await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: false });

    const status = await page.evaluate(() => {
      const node = document.getElementById('gridatlas-teleprint-status');
      return node ? node.textContent : null;
    });
    record.appStatus = status;
    console.log(`${record.ok ? 'PASS' : 'FAIL'} ${label} ${record.bytes} bytes :: ${status || ''}`);
    await context.close().catch(() => {});
  } catch (error) {
    record.error = String((error && error.message) || error);
    console.log(`FAIL ${label} :: ${record.error.split('\n')[0]}`);
  } finally {
    await browser.close().catch(() => {});
  }
  results.push(record);
}

const summary = {
  createdAt: new Date().toISOString(),
  base: BASE,
  outDir: OUT,
  sessions: results.length,
  pdfSessions,
  sourceSessions,
  passed: results.filter(r => r.ok).length,
  /* Stated, never buried: how many captures held every pixel that was on the
     screen, and the range of what the browser actually delivered. */
  capturedEveryScreenPixel: results.filter(r => r.pdf && r.pdf.capturedEveryScreenPixel).length,
  pdfSessionsMeasured: results.filter(r => r.pdf).length,
  captureScaleRange: (() => {
    const scales = results.filter(r => r.pdf && typeof r.pdf.captureScale === 'number')
      .map(r => r.pdf.captureScale);
    return scales.length ? { min: Math.min(...scales), max: Math.max(...scales) } : null;
  })(),
  failed: results.filter(r => !r.ok).length,
  browser: 'installed Chrome via Playwright, one fresh launch per session, closed after',
  captureRoute: 'the app\'s own File-menu controls; getDisplayMedia auto-accepted for this tab',
  notExercised: [
    'a physical iPhone or Android device',
    'the native share sheet',
    'the interactive screen-capture chooser (auto-accepted here)'
  ],
  results
};
await fs.writeFile(path.join(OUT, 'teleprint-evidence-summary.json'),
  JSON.stringify(summary, null, 2) + '\n', 'utf8');
/* Printed on its own line and never folded into the pass count: a reduced
   capture is not an engine failure, and it is not a success either. */
console.log(`\ncapture fidelity: ${summary.capturedEveryScreenPixel} of `
  + `${summary.pdfSessionsMeasured} PDF sessions held every screen pixel`
  + (summary.captureScaleRange
    ? ` (scale ${summary.captureScaleRange.min.toFixed(2)}-${summary.captureScaleRange.max.toFixed(2)})`
    : ''));
console.log(`${summary.passed} passed, ${summary.failed} failed, ${summary.sessions} sessions `
  + `(${pdfSessions} pdf, ${sourceSessions} source)`);
console.log(`evidence: ${OUT}`);
if (summary.failed) process.exitCode = 1;
